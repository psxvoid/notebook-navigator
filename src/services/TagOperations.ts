/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { App, Notice, TFile, parseFrontMatterTags } from 'obsidian';
import { getDBInstance } from '../storage/fileOperations';
import { normalizeTagPathValue } from '../utils/tagPrefixMatcher';
import { normalizeTagPath } from '../utils/tagUtils';
import type { NotebookNavigatorSettings } from '../settings/types';
import { strings } from '../i18n';
import type { TagTreeService } from './TagTreeService';
import type { MetadataService } from './MetadataService';
import { collectRenameFiles, TagDescriptor, TagReplacement, RenameFile, isDescendantRename } from './tagRename/TagRenameEngine';
import { mutateFrontmatterTagFields } from './tagRename/frontmatterTagMutator';
import { TagRenameModal } from '../modals/TagRenameModal';
import { ConfirmModal } from '../modals/ConfirmModal';
import { TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';
import type { ShortcutEntry } from '../types/shortcuts';
import { isTagShortcut } from '../types/shortcuts';

interface TagRenameAnalysis {
    oldTag: TagDescriptor;
    newTag: TagDescriptor;
    replacement: TagReplacement;
    targets: RenameFile[];
    mergeConflict: [TagDescriptor, TagDescriptor] | null;
}

interface TagRenameResult {
    renamed: number;
    total: number;
}

interface TagUsageSummary {
    total: number;
    sample: string[];
}

export interface TagRenameEventPayload {
    /** Original tag path without # prefix (preserves casing) */
    oldPath: string;
    /** New tag path without # prefix (preserves casing) */
    newPath: string;
    /** Original canonical lowercase tag path */
    oldCanonicalPath: string;
    /** New canonical lowercase tag path */
    newCanonicalPath: string;
    /** Indicates if rename merged into an existing tag */
    mergedIntoExisting: boolean;
}

export interface TagDeleteEventPayload {
    /** Deleted tag path without # prefix (preserves casing) */
    path: string;
    /** Deleted canonical lowercase tag path */
    canonicalPath: string;
}

/**
 * Service for managing tag operations.
 * Handles adding tags to files and managing tag hierarchies.
 */
export class TagOperations {
    /**
     * Pattern for valid tag characters: Unicode letters, numbers, underscore, hyphen, and forward slash
     * \p{L} matches any Unicode letter, \p{N} matches any Unicode number
     */
    private static readonly TAG_CHAR_CLASS = '[\\p{L}\\p{N}_\\-/]+';

    /**
     * Pattern for tag boundaries: matches when the next character is whitespace, end of line, or not an allowed tag character
     */
    private static readonly TAG_BOUNDARY = '(?=$|[^\\p{L}\\p{N}_\\-/])';

    private static readonly RENAME_BATCH_SIZE = 10;

    /**
     * Complete pattern for matching any inline tag with optional leading space
     */
    private static readonly INLINE_TAG_PATTERN = new RegExp(`(\\s)?#${TagOperations.TAG_CHAR_CLASS}${TagOperations.TAG_BOUNDARY}`, 'gu');

    /**
     * Pattern for testing if content contains any inline tags (without global flag for test())
     */
    private static readonly INLINE_TAG_TEST_PATTERN = new RegExp(
        `(\\s)?#${TagOperations.TAG_CHAR_CLASS}${TagOperations.TAG_BOUNDARY}`,
        'u'
    );

    constructor(
        private app: App,
        private getSettings: () => NotebookNavigatorSettings,
        private getTagTreeService: () => TagTreeService | null,
        private getMetadataService: () => MetadataService | null
    ) {}

    private readonly tagRenameListeners = new Set<(payload: TagRenameEventPayload) => void>();
    private readonly tagDeleteListeners = new Set<(payload: TagDeleteEventPayload) => void>();

    /**
     * Registers a listener that fires after a successful tag rename.
     * Returns a cleanup function to unsubscribe.
     */
    addTagRenameListener(listener: (payload: TagRenameEventPayload) => void): () => void {
        this.tagRenameListeners.add(listener);
        return () => {
            this.tagRenameListeners.delete(listener);
        };
    }

    /**
     * Registers a listener that fires after a successful tag delete operation.
     * Returns a cleanup function to unsubscribe.
     */
    addTagDeleteListener(listener: (payload: TagDeleteEventPayload) => void): () => void {
        this.tagDeleteListeners.add(listener);
        return () => {
            this.tagDeleteListeners.delete(listener);
        };
    }

    /**
     * Notifies all registered listeners of a successful tag rename
     */
    private notifyTagRenamed(payload: TagRenameEventPayload): void {
        if (this.tagRenameListeners.size === 0) {
            return;
        }
        for (const listener of this.tagRenameListeners) {
            try {
                listener(payload);
            } catch (error) {
                console.error('[Notebook Navigator] Tag rename listener failed', error);
            }
        }
    }

    /**
     * Notifies all registered listeners of a successful tag deletion
     */
    private notifyTagDeleted(payload: TagDeleteEventPayload): void {
        if (this.tagDeleteListeners.size === 0) {
            return;
        }
        for (const listener of this.tagDeleteListeners) {
            try {
                listener(payload);
            } catch (error) {
                console.error('[Notebook Navigator] Tag delete listener failed', error);
            }
        }
    }

    /**
     * Checks if a file is a markdown file
     */
    private isMarkdownFile(file: TFile): boolean {
        return file.extension === 'md';
    }

    /**
     * Cleans up the tags property in frontmatter after edits
     * Preserves the field as an empty array when the setting requires it
     */
    private cleanupFrontmatterTags(fm: { tags?: string | string[] }): void {
        const settings = this.getSettings();
        const keepProperty = Boolean(settings?.keepEmptyTagsProperty);

        if (keepProperty) {
            fm.tags = [];
            return;
        }

        delete fm.tags;
    }

    /**
     * Filters array entries based on normalization and removal predicates
     * Returns filtered array and whether any entries were removed
     */
    private filterStringArrayEntries(
        entries: unknown[],
        normalize: (entry: string) => string | null,
        shouldRemove: (normalized: string) => boolean
    ): { filtered: unknown[]; removed: boolean } {
        let removed = false;
        const filtered: unknown[] = [];

        for (const entry of entries) {
            if (typeof entry !== 'string') {
                filtered.push(entry);
                continue;
            }

            const trimmed = entry.trim();
            if (trimmed.length === 0) {
                removed = true;
                continue;
            }

            const normalized = normalize(trimmed);
            if (normalized === null) {
                filtered.push(trimmed);
                continue;
            }

            if (shouldRemove(normalized)) {
                removed = true;
                continue;
            }

            filtered.push(trimmed);
        }

        return { filtered, removed };
    }

    /**
     * Filters tag values from frontmatter fields based on removal predicate
     * Handles both string and array tag values, normalizing and filtering each entry
     */
    private filterFrontmatterTags(
        value: string | string[],
        shouldRemove: (normalizedTag: string) => boolean
    ): { nextValue?: string | string[]; changed: boolean } {
        if (Array.isArray(value)) {
            const { filtered, removed } = this.filterStringArrayEntries(
                value,
                entry => normalizeTagPathValue(entry),
                normalized => normalized.length === 0 || shouldRemove(normalized)
            );

            if (!removed) {
                return { nextValue: value, changed: false };
            }

            return {
                nextValue: filtered.length === 0 ? undefined : (filtered as string[]),
                changed: true
            };
        }

        if (typeof value === 'string') {
            const parsed = parseFrontMatterTags({ tags: value }) ?? [];
            if (parsed.length === 0) {
                return { nextValue: value, changed: false };
            }

            const { filtered, removed } = this.filterStringArrayEntries(
                parsed,
                entry => normalizeTagPathValue(entry),
                normalized => normalized.length === 0 || shouldRemove(normalized)
            );

            if (!removed) {
                return { nextValue: value, changed: false };
            }

            const filteredTags = filtered.filter((entry): entry is string => typeof entry === 'string');

            if (filteredTags.length === 0) {
                return { changed: true };
            }

            return {
                nextValue: filteredTags.length === 1 ? filteredTags[0] : filteredTags,
                changed: true
            };
        }

        return { nextValue: value, changed: false };
    }

    /**
     * Removes tags matching the removal predicate from file frontmatter
     * Processes all tag and alias fields, cleaning up empty fields
     */
    private async stripTagsFromFrontmatter(
        file: TFile,
        shouldRemove: (normalizedTag: string) => boolean,
        failureContext: string
    ): Promise<boolean> {
        let changed = false;
        try {
            await this.app.fileManager.processFrontMatter(file, fm => {
                let removedCanonicalTags = false;
                const mutated = mutateFrontmatterTagFields(fm, field => {
                    if (Array.isArray(field.value)) {
                        if (field.isAlias) {
                            const result = this.filterAliasValues(field.value as string[], shouldRemove);
                            if (!result.changed) {
                                return;
                            }
                            if (result.nextValue === undefined) {
                                field.remove();
                            } else {
                                field.set(result.nextValue);
                            }
                            return;
                        }

                        const result = this.filterFrontmatterTags(field.value as string[], shouldRemove);
                        if (!result.changed) {
                            return;
                        }
                        if (result.nextValue === undefined) {
                            field.remove();
                            if (field.lowerKey === 'tags') {
                                removedCanonicalTags = true;
                            }
                        } else {
                            field.set(result.nextValue);
                        }
                        return;
                    }

                    const targetValue = field.value;
                    if (typeof targetValue !== 'string') {
                        return;
                    }

                    if (field.isAlias) {
                        const result = this.filterAliasValues(targetValue, shouldRemove);
                        if (!result.changed) {
                            return;
                        }
                        if (result.nextValue === undefined) {
                            field.remove();
                        } else {
                            field.set(result.nextValue);
                        }
                        return;
                    }

                    const result = this.filterFrontmatterTags(targetValue, shouldRemove);
                    if (!result.changed) {
                        return;
                    }
                    if (result.nextValue === undefined) {
                        field.remove();
                        if (field.lowerKey === 'tags') {
                            removedCanonicalTags = true;
                        }
                    } else {
                        field.set(result.nextValue);
                    }
                });

                if (removedCanonicalTags) {
                    this.cleanupFrontmatterTags(fm);
                }

                if (mutated || removedCanonicalTags) {
                    changed = true;
                }
            });
        } catch (error) {
            console.error(`[Notebook Navigator] Failed to ${failureContext}`, error);
        }
        return changed;
    }

    /**
     * Filters alias values from frontmatter fields based on removal predicate
     * Only processes values starting with # as tag aliases
     */
    private filterAliasValues(
        value: string | string[],
        shouldRemove: (normalizedTag: string) => boolean
    ): { nextValue?: string | string[]; changed: boolean } {
        if (Array.isArray(value)) {
            const { filtered, removed } = this.filterStringArrayEntries(
                value,
                entry => {
                    const trimmed = entry.trim();
                    if (!trimmed.startsWith('#')) {
                        return null;
                    }
                    const normalized = normalizeTagPathValue(trimmed);
                    if (normalized.length === 0) {
                        return null;
                    }
                    return normalized;
                },
                shouldRemove
            );

            if (!removed) {
                return { nextValue: value, changed: false };
            }

            return {
                nextValue: filtered.length === 0 ? undefined : (filtered as string[]),
                changed: true
            };
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed.startsWith('#')) {
                return { nextValue: value, changed: false };
            }

            const normalized = normalizeTagPathValue(trimmed);
            if (normalized.length === 0 || !shouldRemove(normalized)) {
                return { nextValue: value, changed: false };
            }

            return { changed: true };
        }

        return { nextValue: value, changed: false };
    }

    /**
     * Removes specified inline tags from file content
     * Sorts tags by length to handle nested tags correctly, processes longer tags first
     */
    private async stripInlineTags(file: TFile, tags: string[]): Promise<boolean> {
        const uniqueTags = Array.from(new Set(tags.map(tag => tag.trim()).filter((tag): tag is string => tag.length > 0)));

        if (uniqueTags.length === 0) {
            return false;
        }

        uniqueTags.sort((a, b) => b.length - a.length);

        let hasInlineMatch = false;
        let cachedContent: string | null = null;
        const vaultRead = (this.app.vault as { read?: (file: TFile) => Promise<string> }).read;
        if (typeof vaultRead === 'function') {
            try {
                cachedContent = await vaultRead.call(this.app.vault, file);
                if (cachedContent !== null) {
                    const contentToCheck = cachedContent;
                    hasInlineMatch = uniqueTags.some(tag => this.hasSpecificInlineTag(contentToCheck, tag));
                }
            } catch (error) {
                console.error('[Notebook Navigator] Failed to read file while stripping inline tags', error);
                throw error instanceof Error ? error : new Error('[Notebook Navigator] Failed to read file while stripping inline tags');
            }
        } else {
            hasInlineMatch = true;
        }

        if (!hasInlineMatch) {
            return false;
        }

        if (cachedContent !== null) {
            let updatedContent = cachedContent;
            let changed = false;
            for (const tag of uniqueTags) {
                const nextContent = this.removeInlineTags(updatedContent, tag);
                if (nextContent !== updatedContent) {
                    changed = true;
                    updatedContent = nextContent;
                }
            }

            if (!changed) {
                return false;
            }

            await this.app.vault.modify(file, updatedContent);
            return true;
        }

        let changed = false;
        await this.app.vault.process(file, content => {
            let nextContent = content;
            for (const tag of uniqueTags) {
                const updated = this.removeInlineTags(nextContent, tag);
                if (updated !== nextContent) {
                    changed = true;
                    nextContent = updated;
                }
            }
            return nextContent;
        });
        return changed;
    }

    /**
     * Removes tags from both frontmatter and inline content
     * Combines frontmatter and inline tag removal into a single operation
     */
    private async stripTagsFromFile(
        file: TFile,
        shouldRemove: (normalizedTag: string) => boolean,
        inlineTags: string[],
        failureContext: string
    ): Promise<boolean> {
        const frontmatterChanged = await this.stripTagsFromFrontmatter(file, shouldRemove, failureContext);
        const inlineChanged = inlineTags.length > 0 ? await this.stripInlineTags(file, inlineTags) : false;
        return frontmatterChanged || inlineChanged;
    }

    /**
     * Collects all descendant tags of the specified ancestor tag from a file
     * Returns tag strings and normalized set for efficient lookup, or null if no descendants found
     */
    private collectDescendantTags(file: TFile, ancestorTag: string): { tags: string[]; normalizedSet: Set<string> } | null {
        const normalizedAncestor = normalizeTagPathValue(ancestorTag);
        if (normalizedAncestor.length === 0) {
            return null;
        }

        const currentTags = this.getTagsFromFiles([file]);
        const descendantTags = currentTags.filter(tag => {
            const normalizedTag = normalizeTagPathValue(tag);
            return normalizedTag.startsWith(`${normalizedAncestor}/`);
        });

        if (descendantTags.length === 0) {
            return null;
        }

        const normalizedSet = new Set(
            descendantTags.map(tag => normalizeTagPathValue(tag)).filter((value): value is string => value.length > 0)
        );

        if (normalizedSet.size === 0) {
            return null;
        }

        return {
            tags: descendantTags,
            normalizedSet
        };
    }

    /**
     * Builds a regex pattern for matching a specific inline tag
     * @param tag - The tag to match (without #)
     * @returns A RegExp for matching the specific tag
     */
    private buildSpecificTagPattern(tag: string): RegExp {
        const escapedTag = this.escapeRegExp(tag);
        return new RegExp(`(\\s)?#${escapedTag}${TagOperations.TAG_BOUNDARY}`, 'giu');
    }

    /**
     * Escapes special regex characters in a string
     *
     * Examples:
     * - "file.txt" → "file\\.txt"
     * - "tag*" → "tag\\*"
     * - "[tag]" → "\\[tag\\]"
     * - "tag?" → "tag\\?"
     * - "(tag)" → "\\(tag\\)"
     * - "tag|other" → "tag\\|other"
     * - "tag$" → "tag\\$"
     * - "tag^start" → "tag\\^start"
     * - "tag{1,3}" → "tag\\{1,3\\}"
     * - "tag\\" → "tag\\\\"
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Validates tag name format according to Obsidian tag rules.
     * Rejects empty tags, leading/trailing slashes, and double slashes.
     */
    private isValidTagName(tag: string): boolean {
        const candidate = tag.trim();
        if (candidate.length === 0) {
            return false;
        }
        if (candidate.startsWith('/') || candidate.endsWith('/')) {
            return false;
        }
        if (candidate.includes('//')) {
            return false;
        }
        const pattern = new RegExp(`^${TagOperations.TAG_CHAR_CLASS}$`, 'u');
        return pattern.test(candidate);
    }

    /**
     * Resolves canonical tag path to its display path using the tag tree.
     * Returns original path if tag tree is unavailable or tag not found.
     */
    private resolveDisplayTagPath(tagPath: string): string {
        const canonical = normalizeTagPathValue(tagPath);
        if (canonical.length === 0) {
            return tagPath;
        }
        const treeService = this.getTagTreeService();
        const node = treeService?.findTagNode(canonical);
        return node?.displayPath ?? tagPath;
    }

    /**
     * Adds a tag to multiple files
     * @param tag - The tag to add (without #)
     * @param files - Files to add the tag to
     * @returns Object with counts of files modified and skipped
     */
    async addTagToFiles(tag: string, files: TFile[]): Promise<{ added: number; skipped: number }> {
        let added = 0;
        let skipped = 0;

        for (const file of files) {
            // Skip non-markdown files
            if (!this.isMarkdownFile(file)) {
                skipped++;
                continue;
            }

            const alreadyHasTag = await this.fileHasTagOrAncestor(file, tag);
            if (alreadyHasTag) {
                skipped++;
                continue;
            }

            await this.addTagToFile(file, tag);
            added++;
        }

        return { added, skipped };
    }

    /**
     * Gets all unique tags from multiple files
     * @param files - Files to get tags from
     * @returns Array of unique tag strings (without #)
     */
    getTagsFromFiles(files: TFile[]): string[] {
        // Use a Map to track lowercase tag -> first canonical form encountered
        const canonicalTags = new Map<string, string>();
        const db = getDBInstance();

        for (const file of files) {
            // Skip non-markdown files
            if (!this.isMarkdownFile(file)) {
                continue;
            }

            const tags = db.getCachedTags(file.path);
            tags.forEach(tag => {
                const normalizedTag = normalizeTagPathValue(tag);
                if (normalizedTag.length === 0) {
                    return;
                }
                // Only add if we haven't seen this tag (case-insensitive)
                if (!canonicalTags.has(normalizedTag)) {
                    canonicalTags.set(normalizedTag, tag);
                }
            });
        }

        // Return canonical forms sorted alphabetically
        return Array.from(canonicalTags.values()).sort();
    }

    /**
     * Removes a specific tag from multiple files
     * @param tag - The tag to remove (without #)
     * @param files - Files to remove the tag from
     * @returns Number of files modified
     */
    async removeTagFromFiles(tag: string, files: TFile[]): Promise<number> {
        let removed = 0;

        for (const file of files) {
            // Skip non-markdown files
            if (!this.isMarkdownFile(file)) {
                continue;
            }

            const hadTag = await this.removeTagFromFile(file, tag);
            if (hadTag) {
                removed++;
            }
        }

        return removed;
    }

    /**
     * Removes all tags from multiple files
     * @param files - Files to clear tags from
     * @returns Number of files modified
     */
    async clearAllTagsFromFiles(files: TFile[]): Promise<number> {
        let cleared = 0;

        for (const file of files) {
            // Skip non-markdown files
            if (!this.isMarkdownFile(file)) {
                continue;
            }

            const hadTags = await this.clearAllTagsFromFile(file);
            if (hadTags) {
                cleared++;
            }
        }

        return cleared;
    }

    /**
     * Checks if content contains any inline tags
     */
    private hasInlineTags(content: string): boolean {
        return TagOperations.INLINE_TAG_TEST_PATTERN.test(content);
    }

    /**
     * Checks if content contains a specific inline tag (case-insensitive)
     */
    private hasSpecificInlineTag(content: string, tag: string): boolean {
        const regex = this.buildSpecificTagPattern(tag);
        return regex.test(content);
    }

    /**
     * Checks if a file already has a specific tag or an ancestor tag.
     * Comparison is case-insensitive (e.g., "TODO" matches "todo").
     * Also returns true if file has an ancestor tag (e.g., won't add "project/task" if file has "project").
     */
    private async fileHasTagOrAncestor(file: TFile, tag: string): Promise<boolean> {
        // Non-markdown files cannot have tags
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        const db = getDBInstance();
        const allTags = db.getCachedTags(file.path);
        const normalizedTag = normalizeTagPathValue(tag);
        if (normalizedTag.length === 0) {
            return false;
        }

        // Check if any existing tag is the same or an ancestor
        return allTags.some((existingTag: string) => {
            const normalizedExistingTag = normalizeTagPathValue(existingTag);
            if (normalizedExistingTag.length === 0) {
                return false;
            }

            // Exact match (case-insensitive)
            if (normalizedExistingTag === normalizedTag) return true;

            // Check if we already have an ancestor tag
            // e.g., if we want to add "project/example" but file has "project"
            return normalizedTag.startsWith(`${normalizedExistingTag}/`);
        });
    }

    /**
     * Adds a tag to a single file's frontmatter
     */
    private async addTagToFile(file: TFile, tag: string): Promise<void> {
        // Skip non-markdown files
        if (!this.isMarkdownFile(file)) {
            return;
        }

        // First, remove any descendant tags of the new tag
        await this.removeDescendantTagsFromFile(file, tag);

        try {
            await this.app.fileManager.processFrontMatter(file, fm => {
                if (!fm.tags) {
                    // No tags yet, create new array
                    fm.tags = [tag];
                } else if (Array.isArray(fm.tags)) {
                    // Add to existing array
                    fm.tags.push(tag);
                    // Ensure uniqueness
                    fm.tags = [...new Set(fm.tags)];
                } else if (typeof fm.tags === 'string') {
                    // Convert string to array and add new tag
                    const tags = fm.tags.split(',').map((t: string) => t.trim());
                    tags.push(tag);
                    fm.tags = [...new Set(tags)];
                }
            });
        } catch (error) {
            console.error('Error adding tag to frontmatter:', error);
            throw error;
        }
    }

    /**
     * Removes a specific tag from a single file
     * @param file - The file to remove the tag from
     * @param tag - The tag to remove (without #)
     * @returns Whether the file had the tag
     */
    private async removeTagFromFile(file: TFile, tag: string): Promise<boolean> {
        // Non-markdown files cannot have tags
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        const normalizedTarget = normalizeTagPathValue(tag);
        if (normalizedTarget.length === 0) {
            return false;
        }

        return this.stripTagsFromFile(file, candidate => candidate === normalizedTarget, [tag], 'remove tag from frontmatter');
    }

    /**
     * Removes any descendant tags of the given tag from a file
     * e.g., if adding "project", removes "project/example", "project/task1", etc.
     */
    private async removeDescendantTagsFromFile(file: TFile, ancestorTag: string): Promise<boolean> {
        // Skip non-markdown files
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        const descendants = this.collectDescendantTags(file, ancestorTag);
        if (!descendants) {
            return false;
        }

        return this.stripTagsFromFile(
            file,
            candidate => descendants.normalizedSet.has(candidate),
            descendants.tags,
            'remove descendant tags from frontmatter'
        );
    }

    /**
     * Clears all tags from a single file
     * @returns Whether the file had any tags to clear
     */
    private async clearAllTagsFromFile(file: TFile): Promise<boolean> {
        // Non-markdown files cannot have tags
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        let hadTags = false;

        // Check if file has any tags using our memory cache
        const db = getDBInstance();
        const cachedTags = db.getCachedTags(file.path);

        if (cachedTags.length === 0) {
            // No tags to remove, skip processing
            return false;
        }

        // Clear frontmatter tags
        try {
            await this.app.fileManager.processFrontMatter(file, fm => {
                if (fm.tags) {
                    hadTags = true;
                    this.cleanupFrontmatterTags(fm);
                }
            });
        } catch (error) {
            console.error('Error clearing frontmatter tags:', error);
            throw error;
        }

        // Only process file content if it actually contains inline tags
        // Our cache told us there are tags, but they might only be in frontmatter
        const content = await this.app.vault.read(file);
        if (this.hasInlineTags(content)) {
            await this.app.vault.process(file, content => {
                const newContent = this.removeAllInlineTags(content);
                if (newContent !== content) {
                    hadTags = true;
                }
                return newContent;
            });
        }

        return hadTags;
    }

    /**
     * Removes a specific inline tag from content
     * Supports Unicode characters in tags (e.g., #TODO_日本語, #проект, #tâche)
     */
    private removeInlineTags(content: string, tag: string): string {
        const regex = this.buildSpecificTagPattern(tag);
        return content.replace(regex, '');
    }

    /**
     * Removes all inline tags from content
     *
     * Examples:
     * - "text #tag more text" → "text more text"
     * - "#todo finish this #urgent" → "finish this"
     * - "Issue #123 is fixed" → "Issue is fixed"
     * - "#project/subtask done" → "done"
     * - "#multi-word-tag text" → "text"
     * - "text#notag" → "text#notag" (preserved - no space before #)
     * - "#tag1 #tag2\n#tag3" → "\n"
     * - "end with #tag" → "end with"
     * - "text  #tag  more" → "text  more" (existing double spaces preserved)
     * - "Task #todo, check #bug." → "Task, check."
     * - "Review (#urgent) and [#task]" → "Review () and []"
     * - "#TODO_日本語 text" → "text" (Unicode support)
     * - "#проект/задача done" → "done" (Cyrillic support)
     * - "#tâche-à-faire text" → "text" (accented characters)
     */
    private removeAllInlineTags(content: string): string {
        return content.replace(TagOperations.INLINE_TAG_PATTERN, '');
    }

    /**
     * Extracts the last segment of a tag path.
     * Example: "project/tasks/urgent" → "urgent"
     */
    private getTagLeaf(tagPath: string): string {
        const parts = tagPath.split('/');
        return parts[parts.length - 1] ?? tagPath;
    }

    /**
     * Builds a summary of files that will be affected by tag rename.
     * Returns up to 8 sample file basenames for display in modal.
     */
    private buildUsageSummaryFromPaths(paths: Iterable<string>): TagUsageSummary {
        const sample: string[] = [];
        let total = 0;

        for (const filePath of paths) {
            total += 1;
            if (sample.length < 8) {
                const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
                if (abstractFile instanceof TFile) {
                    sample.push(abstractFile.basename);
                } else {
                    sample.push(filePath);
                }
            }
        }

        return { total, sample };
    }

    private buildUsageSummary(targets: RenameFile[]): TagUsageSummary {
        return this.buildUsageSummaryFromPaths(targets.map(target => target.filePath));
    }

    /**
     * Analyzes a tag rename operation to determine affected files and potential conflicts.
     * Collects target files and checks for tag merge scenarios.
     */
    private buildRenameAnalysis(oldTagPath: string, newTagPath: string, presetTargets?: RenameFile[] | null): TagRenameAnalysis {
        const oldTag = new TagDescriptor(oldTagPath);
        const newTag = new TagDescriptor(newTagPath);
        const replacement = new TagReplacement(oldTag, newTag);
        const tagTree = this.getTagTreeService();
        const targets = presetTargets ?? collectRenameFiles(this.app, oldTag, tagTree);
        const existingTags = tagTree ? tagTree.getAllTagPaths().map(path => `#${path}`) : [];
        const mergeConflict = existingTags.length > 0 ? replacement.willMergeTags(existingTags) : null;
        return { oldTag, newTag, replacement, targets, mergeConflict };
    }

    /**
     * Executes tag rename across all target files.
     * Shows notice if rename will merge tags.
     */
    private async executeRename(analysis: TagRenameAnalysis): Promise<TagRenameResult> {
        const conflict = analysis.mergeConflict;
        if (conflict) {
            const [origin, clash] = conflict;
            new Notice(`${origin.tag} merges into ${clash.tag}`);
        }

        let renamed = 0;
        for (let index = 0; index < analysis.targets.length; index++) {
            const target = analysis.targets[index];
            if (await target.renamed(analysis.replacement)) {
                renamed++;
            }
            if ((index + 1) % TagOperations.RENAME_BATCH_SIZE === 0) {
                await this.yieldToEventLoop();
            }
        }

        return { renamed, total: analysis.targets.length };
    }

    /**
     * Updates tag metadata keys after a successful rename operation.
     * Migrates colors, icons, backgrounds, sort overrides, and appearances.
     */
    private async updateTagMetadataAfterRename(oldTagPath: string, newTagPath: string, preserveDestination: boolean): Promise<void> {
        const metadataService = this.getMetadataService();
        if (!metadataService) {
            return;
        }

        const trimmedOld = oldTagPath.trim();
        const trimmedNew = newTagPath.trim();
        if (trimmedOld.length === 0 || trimmedNew.length === 0) {
            return;
        }
        if (trimmedOld === trimmedNew) {
            return;
        }

        try {
            await metadataService.handleTagRename(trimmedOld, trimmedNew, preserveDestination);
        } catch (error) {
            console.error('[Notebook Navigator] Failed to update tag metadata after rename', error);
        }
    }

    /**
     * Applies a transformation to tag shortcuts and saves if changes were made
     * Used to update or remove shortcuts while avoiding duplicate entries
     */
    private async mutateTagShortcuts(
        apply: (shortcuts: ShortcutEntry[]) => { changed: boolean; next: ShortcutEntry[] },
        failureContext: string
    ): Promise<void> {
        const metadataService = this.getMetadataService();
        const settingsProvider = metadataService?.getSettingsProvider();
        if (!settingsProvider) {
            return;
        }

        const shortcuts = settingsProvider.settings.shortcuts;
        if (!Array.isArray(shortcuts) || shortcuts.length === 0) {
            return;
        }

        const { changed, next } = apply(shortcuts);
        if (!changed) {
            return;
        }

        settingsProvider.settings.shortcuts = next;
        try {
            await settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error(`[Notebook Navigator] ${failureContext}`, error);
        }
    }

    /**
     * Updates tag shortcuts after a tag is renamed
     * Drops shortcuts that would collide with existing entries after the rename
     */
    private async updateTagShortcutsAfterRename(oldTagPath: string, newTagPath: string): Promise<void> {
        const normalizedOld = normalizeTagPath(oldTagPath);
        const normalizedNew = normalizeTagPath(newTagPath);
        if (!normalizedOld || !normalizedNew) {
            return;
        }
        if (normalizedOld === normalizedNew) {
            return;
        }

        await this.mutateTagShortcuts(shortcuts => {
            const prefix = `${normalizedOld}/`;
            const preservedPaths = new Set<string>();
            for (const shortcut of shortcuts) {
                if (isTagShortcut(shortcut)) {
                    const { tagPath } = shortcut;
                    if (tagPath !== normalizedOld && !tagPath.startsWith(prefix)) {
                        preservedPaths.add(tagPath);
                    }
                }
            }

            const occupiedPaths = new Set<string>();
            let changed = false;
            const updated: ShortcutEntry[] = [];

            for (const shortcut of shortcuts) {
                if (!isTagShortcut(shortcut)) {
                    updated.push(shortcut);
                    continue;
                }

                const currentPath = shortcut.tagPath;
                const isDirectMatch = currentPath === normalizedOld;
                const isDescendantMatch = currentPath.startsWith(prefix);
                let targetPath = currentPath;

                if (isDirectMatch || isDescendantMatch) {
                    const suffix = isDescendantMatch ? currentPath.slice(prefix.length) : '';
                    targetPath = suffix.length > 0 ? `${normalizedNew}/${suffix}` : normalizedNew;
                    if (targetPath !== currentPath) {
                        changed = true;
                    }
                }

                if ((isDirectMatch || isDescendantMatch) && preservedPaths.has(targetPath)) {
                    changed = true;
                    continue;
                }

                if (occupiedPaths.has(targetPath)) {
                    if (targetPath !== currentPath) {
                        changed = true;
                    }
                    continue;
                }

                const nextShortcut = targetPath === currentPath ? shortcut : { ...shortcut, tagPath: targetPath };
                updated.push(nextShortcut);
                occupiedPaths.add(targetPath);
                preservedPaths.add(targetPath);
            }

            return { changed, next: updated };
        }, 'Failed to update tag shortcuts after rename');
    }

    /**
     * Removes all metadata associated with a deleted tag and its descendants
     */
    private async removeTagMetadataAfterDelete(tagPath: string): Promise<void> {
        const metadataService = this.getMetadataService();
        if (!metadataService) {
            return;
        }

        const trimmedPath = tagPath.trim();
        if (trimmedPath.length === 0) {
            return;
        }

        try {
            await metadataService.handleTagDelete(trimmedPath);
        } catch (error) {
            console.error('[Notebook Navigator] Failed to remove tag metadata after delete', error);
        }
    }

    /**
     * Removes all shortcuts associated with a deleted tag and its descendants
     */
    private async removeTagShortcutsAfterDelete(tagPath: string): Promise<void> {
        const normalizedPath = normalizeTagPath(tagPath);
        if (!normalizedPath) {
            return;
        }

        await this.mutateTagShortcuts(shortcuts => {
            const prefix = `${normalizedPath}/`;
            let changed = false;
            const filtered: ShortcutEntry[] = [];

            for (const shortcut of shortcuts) {
                if (!isTagShortcut(shortcut)) {
                    filtered.push(shortcut);
                    continue;
                }

                const currentPath = shortcut.tagPath;
                if (currentPath === normalizedPath || currentPath.startsWith(prefix)) {
                    changed = true;
                    continue;
                }

                filtered.push(shortcut);
            }

            return { changed, next: filtered };
        }, 'Failed to remove tag shortcuts after delete');
    }

    /**
     * Yields control back to the event loop to keep the UI responsive during long operations.
     */
    private async yieldToEventLoop(): Promise<void> {
        await new Promise<void>(resolve => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => resolve());
            } else {
                setTimeout(resolve, 0);
            }
        });
    }

    /**
     * Collects current file paths for a tag and its descendants using the cached tag tree.
     * Returns null when the tag tree is unavailable.
     */
    private collectPreviewPaths(tag: TagDescriptor): string[] | null {
        if (tag.canonicalName.length === 0) {
            return [];
        }

        const tagTreeService = this.getTagTreeService();
        if (!tagTreeService) {
            return null;
        }

        return tagTreeService.collectTagFilePaths(tag.canonicalName);
    }
    /**
     * Orchestrates tag rename operation with validation and user feedback.
     * Returns true if rename succeeded, false if validation failed or no files were modified.
     */
    private async runTagRename(oldTagPath: string, newTagPath: string, presetTargets?: RenameFile[] | null): Promise<boolean> {
        // Reuse preset targets gathered when the modal opened to avoid a second vault scan.
        const analysis = this.buildRenameAnalysis(oldTagPath, newTagPath, presetTargets);

        if (isDescendantRename(analysis.oldTag, analysis.newTag)) {
            new Notice(strings.modals.tagOperation.descendantRenameError);
            return false;
        }

        if (analysis.oldTag.tag === analysis.newTag.tag) {
            new Notice(strings.modals.tagOperation.renameUnchanged.replace('{tag}', analysis.oldTag.tag));
            return false;
        }

        if (analysis.targets.length === 0) {
            new Notice(`#${analysis.oldTag.name}: ${strings.listPane.emptyStateNoNotes}`);
            return false;
        }

        const result = await this.executeRename(analysis);
        if (result.renamed === 0) {
            new Notice(
                strings.modals.tagOperation.renameNoChanges
                    .replace('{oldTag}', analysis.oldTag.tag)
                    .replace('{newTag}', analysis.newTag.tag)
                    .replace('{countLabel}', strings.listPane.emptyStateNoNotes)
            );
            return false;
        }

        await this.updateTagMetadataAfterRename(analysis.oldTag.name, analysis.newTag.name, Boolean(analysis.mergeConflict));
        await this.updateTagShortcutsAfterRename(analysis.oldTag.name, analysis.newTag.name);

        // Notify listeners that tag was renamed
        this.notifyTagRenamed({
            oldPath: analysis.oldTag.name,
            newPath: analysis.newTag.name,
            oldCanonicalPath: analysis.oldTag.canonicalName,
            newCanonicalPath: analysis.newTag.canonicalName,
            mergedIntoExisting: Boolean(analysis.mergeConflict)
        });

        new Notice(
            `${strings.modals.tagOperation.confirmRename}: ${analysis.oldTag.tag} → ${analysis.newTag.tag} (${result.renamed}/${result.total})`
        );
        return true;
    }

    /**
     * Removes a tag and all its descendants from a file
     * Processes both frontmatter and inline tags
     */
    private async deleteTagFromFile(file: TFile, tag: TagDescriptor): Promise<boolean> {
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        const normalizedTarget = normalizeTagPathValue(tag.name);
        if (normalizedTarget.length === 0) {
            return false;
        }

        const descendants = this.collectDescendantTags(file, tag.name);
        const normalizedDescendants = descendants?.normalizedSet ?? new Set<string>();
        const descendantTags = descendants?.tags ?? [];

        const targets = new Set<string>(normalizedDescendants);
        targets.add(normalizedTarget);

        const inlineTags = descendantTags.length > 0 ? [tag.name, ...descendantTags] : [tag.name];
        return this.stripTagsFromFile(file, candidate => targets.has(candidate), inlineTags, 'remove tag hierarchy from frontmatter');
    }

    /**
     * Executes tag deletion across files, removing tag and descendants from all affected files
     * Cleans up metadata and shortcuts after successful deletion
     */
    private async runTagDelete(tagPath: string, presetPaths?: readonly string[] | null): Promise<boolean> {
        const descriptor = new TagDescriptor(tagPath);
        const targetPathsSet = new Set<string>();

        if (presetPaths && presetPaths.length > 0) {
            presetPaths.forEach(path => {
                if (typeof path === 'string' && path.length > 0) {
                    targetPathsSet.add(path);
                }
            });
        } else {
            const previewPaths = this.collectPreviewPaths(descriptor);
            if (previewPaths === null) {
                new Notice(strings.fileSystem.notifications.tagOperationsNotAvailable);
                return false;
            }
            previewPaths.forEach(path => {
                if (typeof path === 'string' && path.length > 0) {
                    targetPathsSet.add(path);
                }
            });
        }

        if (targetPathsSet.size === 0) {
            new Notice(`#${descriptor.name}: ${strings.listPane.emptyStateNoNotes}`);
            return false;
        }

        let removed = 0;
        let processed = 0;

        for (const path of targetPathsSet) {
            const abstract = this.app.vault.getAbstractFileByPath(path);
            if (!(abstract instanceof TFile)) {
                processed++;
                continue;
            }

            try {
                if (await this.deleteTagFromFile(abstract, descriptor)) {
                    removed++;
                }
            } catch (error) {
                console.error(`[Notebook Navigator] Failed to delete tag ${descriptor.tag} in ${path}`, error);
            }

            processed++;
            if (processed % TagOperations.RENAME_BATCH_SIZE === 0) {
                await this.yieldToEventLoop();
            }
        }

        if (removed === 0) {
            new Notice(strings.fileSystem.notifications.noTagsToRemove);
            return false;
        }

        await this.removeTagMetadataAfterDelete(descriptor.name);
        await this.removeTagShortcutsAfterDelete(descriptor.name);

        // Notify listeners that tag was deleted
        this.notifyTagDeleted({
            path: descriptor.name,
            canonicalPath: descriptor.canonicalName
        });

        if (removed === 1) {
            new Notice(strings.fileSystem.notifications.tagRemovedFromNote);
        } else {
            new Notice(strings.fileSystem.notifications.tagRemovedFromNotes.replace('{count}', removed.toString()));
        }

        return true;
    }

    /**
     * Prompts user with modal to rename a tag and updates all affected files.
     * Shows affected file count and sample list before confirming rename.
     */
    async promptRenameTag(tagPath: string): Promise<void> {
        const displayPath = this.resolveDisplayTagPath(tagPath);
        const oldTagDescriptor = new TagDescriptor(displayPath);
        const previewPaths = this.collectPreviewPaths(oldTagDescriptor);
        let presetTargets: RenameFile[] | null = null;
        let usage: TagUsageSummary;

        if (previewPaths === null) {
            const targets = collectRenameFiles(this.app, oldTagDescriptor, this.getTagTreeService());
            usage = this.buildUsageSummary(targets);
            presetTargets = targets;
        } else {
            usage = this.buildUsageSummaryFromPaths(previewPaths);
        }

        if (usage.total === 0) {
            new Notice(`#${displayPath}: ${strings.listPane.emptyStateNoNotes}`);
            return;
        }

        const modal = new TagRenameModal(this.app, {
            tagPath: displayPath,
            affectedCount: usage.total,
            sampleFiles: usage.sample,
            onSubmit: async newName => {
                const trimmedName = newName.startsWith('#') ? newName.slice(1) : newName;
                if (!this.isValidTagName(trimmedName)) {
                    new Notice(strings.modals.tagOperation.invalidTagName);
                    return false;
                }
                const newDescriptor = new TagDescriptor(trimmedName);
                if (isDescendantRename(oldTagDescriptor, newDescriptor)) {
                    new Notice(strings.modals.tagOperation.descendantRenameError);
                    return false;
                }
                return this.runTagRename(displayPath, trimmedName, presetTargets);
            }
        });
        modal.open();
    }

    /**
     * Prompts user to confirm tag deletion and removes matching tags from all affected files.
     * Shares usage summary with rename flow for consistent messaging.
     */
    async promptDeleteTag(tagPath: string): Promise<void> {
        if (tagPath === TAGGED_TAG_ID || tagPath === UNTAGGED_TAG_ID) {
            return;
        }

        const displayPath = this.resolveDisplayTagPath(tagPath);
        if (displayPath.length === 0) {
            return;
        }

        const descriptor = new TagDescriptor(displayPath);
        const previewPaths = this.collectPreviewPaths(descriptor);
        if (previewPaths === null) {
            new Notice(strings.fileSystem.notifications.tagOperationsNotAvailable);
            return;
        }

        const uniquePreview = Array.from(new Set(previewPaths));
        const usage = this.buildUsageSummaryFromPaths(uniquePreview);
        const presetPaths = uniquePreview;

        if (usage.total === 0) {
            new Notice(`#${displayPath}: ${strings.listPane.emptyStateNoNotes}`);
            return;
        }

        const countLabel = usage.total === 1 ? strings.modals.tagOperation.file : strings.modals.tagOperation.files;
        const modal = new ConfirmModal(
            this.app,
            strings.modals.tagOperation.deleteTitle.replace('{tag}', `#${displayPath}`),
            strings.modals.tagOperation.deleteWarning
                .replace('{tag}', `#${displayPath}`)
                .replace('{count}', usage.total.toString())
                .replace('{files}', countLabel),
            () => {
                void this.runTagDelete(displayPath, presetPaths);
            },
            strings.modals.tagOperation.confirmDelete,
            {
                buildContent: container => {
                    if (usage.sample.length === 0) {
                        return;
                    }

                    const listContainer = container.createDiv('nn-tag-rename-file-preview');
                    listContainer.createEl('h4', { text: strings.modals.tagOperation.affectedFiles });
                    const list = listContainer.createEl('ul');
                    usage.sample.forEach(fileName => {
                        list.createEl('li', { text: fileName });
                    });
                    const remaining = usage.total - usage.sample.length;
                    if (remaining > 0) {
                        listContainer.createEl('p', {
                            text: strings.modals.tagOperation.andMore.replace('{count}', remaining.toString())
                        });
                    }
                }
            }
        );
        modal.open();
    }

    /**
     * Moves a tag to the root level while preserving its leaf name.
     * Used when dragging a nested tag onto the Tags root section.
     */
    async promoteTagToRoot(sourceTagPath: string): Promise<void> {
        if (sourceTagPath === TAGGED_TAG_ID || sourceTagPath === UNTAGGED_TAG_ID) {
            return;
        }
        const sourceDisplay = this.resolveDisplayTagPath(sourceTagPath);
        if (!sourceDisplay || sourceDisplay.length === 0) {
            return;
        }
        if (!sourceDisplay.includes('/')) {
            return;
        }
        const leaf = this.getTagLeaf(sourceDisplay);
        if (leaf.length === 0 || leaf === sourceDisplay) {
            return;
        }
        await this.runTagRename(sourceDisplay, leaf);
    }

    /**
     * Renames a tag by dragging it onto another tag in the navigation pane.
     * Moves source tag as a child under target tag, preserving the leaf name.
     */
    async renameTagByDrag(sourceTagPath: string, targetTagPath: string): Promise<void> {
        if (targetTagPath === TAGGED_TAG_ID || targetTagPath === UNTAGGED_TAG_ID) {
            return;
        }
        const sourceDisplay = this.resolveDisplayTagPath(sourceTagPath);
        const targetDisplay = this.resolveDisplayTagPath(targetTagPath);
        const leaf = this.getTagLeaf(sourceDisplay);
        const newPath = targetDisplay.length > 0 ? `${targetDisplay}/${leaf}` : leaf;
        await this.runTagRename(sourceDisplay, newPath);
    }
}
