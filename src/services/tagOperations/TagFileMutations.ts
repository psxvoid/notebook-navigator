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

import { App, TFile, parseFrontMatterTags } from 'obsidian';
import { getDBInstance } from '../../storage/fileOperations';
import type { NotebookNavigatorSettings } from '../../settings/types';
import { normalizeTagPathValue } from '../../utils/tagPrefixMatcher';
import { mutateFrontmatterTagFields } from '../tagRename/frontmatterTagMutator';

type TextRange = {
    start: number;
    end: number;
};

/**
 * Type for frontmatter objects that may contain a tags property
 */
type TagsFrontmatter = Record<string, unknown> & { tags?: unknown };

/**
 * Low-level tag mutation operations for individual files
 * Handles both frontmatter and inline tag modifications
 */
export class TagFileMutations {
    // Pattern for valid tag characters: Unicode letters, numbers, underscore, hyphen, and forward slash
    private static readonly TAG_CHAR_CLASS = '[\\p{L}\\p{N}_\\-/]+';
    // Pattern for tag boundaries: matches when next character is whitespace, end of line, or not an allowed tag character
    private static readonly TAG_BOUNDARY = '(?=$|[^\\p{L}\\p{N}_\\-/])';
    // Complete pattern for matching any inline tag with optional leading space
    private static readonly INLINE_TAG_PATTERN = new RegExp(
        `(\\s)?#${TagFileMutations.TAG_CHAR_CLASS}${TagFileMutations.TAG_BOUNDARY}`,
        'gu'
    );
    // Pattern for testing if content contains any inline tags (without global flag for test())
    private static readonly INLINE_TAG_TEST_PATTERN = new RegExp(
        `(\\s)?#${TagFileMutations.TAG_CHAR_CLASS}${TagFileMutations.TAG_BOUNDARY}`,
        'u'
    );
    // Pattern for validating tag names
    private static readonly TAG_NAME_PATTERN = new RegExp(`^${TagFileMutations.TAG_CHAR_CLASS}$`, 'u');

    constructor(
        private readonly app: App,
        private readonly getSettings: () => NotebookNavigatorSettings
    ) {}

    /**
     * Checks if a file is a markdown file
     */
    isMarkdownFile(file: TFile): boolean {
        return file.extension === 'md';
    }

    /**
     * Validates tag name format according to Obsidian tag rules
     * Rejects empty tags, leading/trailing slashes, and double slashes
     */
    isValidTagName(tag: string): boolean {
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
        return TagFileMutations.TAG_NAME_PATTERN.test(candidate);
    }

    /**
     * Extracts the leaf segment from a tag path
     * For "folder/subfolder/tag" returns "tag"
     */
    getTagLeaf(tagPath: string): string {
        const parts = tagPath.split('/');
        return parts[parts.length - 1] ?? tagPath;
    }

    /**
     * Checks if a file has a specific tag or an ancestor tag
     * Returns true if file has an ancestor tag (won't add "project/task" if file has "project")
     */
    async fileHasTagOrAncestor(file: TFile, tag: string): Promise<boolean> {
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        const db = getDBInstance();
        const allTags = db.getCachedTags(file.path);
        const normalizedTag = normalizeTagPathValue(tag);
        if (normalizedTag.length === 0) {
            return false;
        }

        return allTags.some((existingTag: string) => {
            const normalizedExistingTag = normalizeTagPathValue(existingTag);
            if (normalizedExistingTag.length === 0) {
                return false;
            }
            if (normalizedExistingTag === normalizedTag) {
                return true;
            }
            return normalizedTag.startsWith(`${normalizedExistingTag}/`);
        });
    }

    /**
     * Adds a tag to a file's frontmatter
     * First removes any descendant tags to avoid redundancy
     */
    async addTagToFile(file: TFile, tag: string): Promise<void> {
        if (!this.isMarkdownFile(file)) {
            return;
        }

        // First, remove any descendant tags of the new tag
        await this.removeDescendantTagsFromFile(file, tag);

        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter: TagsFrontmatter) => {
                const rawTags = frontmatter.tags;
                const isEmptyString = typeof rawTags === 'string' && rawTags.trim().length === 0;

                if (rawTags === undefined || rawTags === null || isEmptyString) {
                    frontmatter.tags = [tag];
                    return;
                }

                if (Array.isArray(rawTags)) {
                    // Filter out non-string values and empty strings from the tags array
                    const normalizedTags = rawTags
                        .filter((value): value is string => typeof value === 'string')
                        .map(value => value.trim())
                        .filter((value): value is string => value.length > 0);
                    const nextTags = Array.from(new Set([...normalizedTags, tag]));
                    frontmatter.tags = nextTags;
                    return;
                }

                if (typeof rawTags === 'string') {
                    const tags = rawTags
                        .split(',')
                        .map((value: string) => value.trim())
                        // Filter out empty strings and ensure type safety
                        .filter((value): value is string => value.length > 0);
                    tags.push(tag);
                    frontmatter.tags = Array.from(new Set(tags));
                    return;
                }

                frontmatter.tags = [tag];
            });
        } catch (error: unknown) {
            console.error('[Notebook Navigator] Error adding tag to frontmatter', error);
            throw error;
        }
    }

    /**
     * Removes a specific tag from a file
     * Returns true if the tag was found and removed
     */
    async removeTagFromFile(file: TFile, tag: string): Promise<boolean> {
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
     * Removes all descendant tags of a given ancestor tag from a file
     * Used when adding a parent tag to avoid redundancy
     */
    async removeDescendantTagsFromFile(file: TFile, ancestorTag: string): Promise<boolean> {
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
     * Collects all descendant tags of the specified ancestor tag from a file
     * Returns tag strings and normalized set for efficient lookup
     */
    collectDescendantTags(file: TFile, ancestorTag: string): { tags: string[]; normalizedSet: Set<string> } | null {
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
     * Removes all tags from a file's frontmatter and inline content
     * Returns true if any tags were removed
     */
    async clearAllTagsFromFile(file: TFile): Promise<boolean> {
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        let hadTags = false;
        const db = getDBInstance();
        const cachedTags = db.getCachedTags(file.path);
        if (cachedTags.length === 0) {
            return false;
        }

        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                const rawTags = frontmatter.tags;
                const hasTags =
                    typeof rawTags === 'string'
                        ? rawTags.trim().length > 0
                        : Array.isArray(rawTags)
                          ? rawTags.length > 0
                          : Boolean(rawTags);

                if (hasTags) {
                    hadTags = true;
                    this.cleanupFrontmatterTags(frontmatter);
                }
            });
        } catch (error) {
            console.error('[Notebook Navigator] Error clearing frontmatter tags', error);
            throw error;
        }

        const content = await this.app.vault.read(file);
        if (this.hasInlineTags(content)) {
            await this.app.vault.process(file, current => {
                const next = this.removeAllInlineTags(current);
                if (next !== current) {
                    hadTags = true;
                }
                return next;
            });
        }

        return hadTags;
    }

    /**
     * Removes tags from both frontmatter and inline content
     * Uses predicate function to determine which tags to remove
     */
    async stripTagsFromFile(
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
     * Gets all unique tags from multiple files
     * Returns sorted array of tag strings without # prefix
     */
    getTagsFromFiles(files: TFile[]): string[] {
        const canonicalTags = new Map<string, string>();
        const db = getDBInstance();

        for (const file of files) {
            if (!this.isMarkdownFile(file)) {
                continue;
            }

            const tags = db.getCachedTags(file.path);
            tags.forEach(tag => {
                const normalizedTag = normalizeTagPathValue(tag);
                if (normalizedTag.length === 0) {
                    return;
                }
                if (!canonicalTags.has(normalizedTag)) {
                    canonicalTags.set(normalizedTag, tag);
                }
            });
        }

        return Array.from(canonicalTags.values()).sort();
    }

    private async stripTagsFromFrontmatter(
        file: TFile,
        shouldRemove: (normalizedTag: string) => boolean,
        failureContext: string
    ): Promise<boolean> {
        let changed = false;
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                let removedCanonicalTags = false;
                const mutated = mutateFrontmatterTagFields(frontmatter, field => {
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
                    this.cleanupFrontmatterTags(frontmatter);
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

    private cleanupFrontmatterTags(frontmatter: Record<string, unknown>): void {
        const settings = this.getSettings();
        const keepProperty = Boolean(settings?.keepEmptyTagsProperty);
        if (keepProperty) {
            frontmatter.tags = [];
            return;
        }
        // Safely delete the tags property if it exists
        if (Reflect.has(frontmatter, 'tags')) {
            delete frontmatter.tags;
        }
    }

    private async stripInlineTags(file: TFile, tags: string[]): Promise<boolean> {
        const uniqueTags = Array.from(new Set(tags.map(tag => tag.trim()).filter((value): value is string => value.length > 0)));
        if (uniqueTags.length === 0) {
            return false;
        }
        uniqueTags.sort((a, b) => b.length - a.length);
        const tagPatterns = uniqueTags.map(tag => ({
            tag,
            pattern: this.buildSpecificTagPattern(tag)
        }));

        let hasInlineMatch = false;
        let cachedContent: string | undefined;
        // Access the vault's read method if it exists (not all vault implementations have it)
        const vaultWithRead = this.app.vault as { read?: (file: TFile) => Promise<string> };
        if (typeof vaultWithRead.read === 'function') {
            try {
                cachedContent = await vaultWithRead.read(file);
                if (typeof cachedContent === 'string') {
                    const contentToCheck = cachedContent;
                    hasInlineMatch = tagPatterns.some(({ pattern }) => this.matchesPattern(contentToCheck, pattern));
                }
            } catch (error: unknown) {
                console.error('[Notebook Navigator] Failed to read file while stripping inline tags', error);
                throw error instanceof Error ? error : new Error('[Notebook Navigator] Failed to read file while stripping inline tags');
            }
        } else {
            hasInlineMatch = true;
        }

        if (!hasInlineMatch) {
            return false;
        }

        if (typeof cachedContent === 'string') {
            const result = this.applyInlineTagRemoval(cachedContent, tagPatterns);
            if (!result.changed) {
                return false;
            }

            await this.app.vault.modify(file, result.content);
            return true;
        }

        let changed = false;
        await this.app.vault.process(file, content => {
            const result = this.applyInlineTagRemoval(content, tagPatterns);
            if (result.changed) {
                changed = true;
            }
            return result.content;
        });
        return changed;
    }

    /**
     * Removes inline tags from content based on provided patterns.
     * Returns the modified content and whether any changes were made.
     */
    private applyInlineTagRemoval(content: string, tagPatterns: { tag: string; pattern: RegExp }[]): { content: string; changed: boolean } {
        if (tagPatterns.length === 0) {
            return { content, changed: false };
        }

        let updatedContent = content;
        let changed = false;
        // Calculate ranges where tags should not be removed (code blocks, inline code, HTML)
        let exclusionRanges = this.computeInlineTagExclusionRanges(updatedContent);

        for (const { pattern } of tagPatterns) {
            const { content: nextContent, exclusionRanges: nextRanges } = this.removeInlineTagsWithPattern(
                updatedContent,
                pattern,
                exclusionRanges
            );
            if (nextContent !== updatedContent) {
                changed = true;
                updatedContent = nextContent;
            }
            exclusionRanges = nextRanges;
        }

        return { content: updatedContent, changed };
    }

    private removeAllInlineTags(content: string): string {
        return content.replace(TagFileMutations.INLINE_TAG_PATTERN, '');
    }

    private hasInlineTags(content: string): boolean {
        return TagFileMutations.INLINE_TAG_TEST_PATTERN.test(content);
    }

    private buildSpecificTagPattern(tag: string): RegExp {
        const escapedTag = this.escapeRegExp(tag);
        return new RegExp(`(\\s)?#${escapedTag}${TagFileMutations.TAG_BOUNDARY}`, 'giu');
    }

    /**
     * Removes inline tags matching the pattern while preserving tags in protected contexts
     */
    private removeInlineTagsWithPattern(
        content: string,
        pattern: RegExp,
        exclusionRanges?: TextRange[]
    ): { content: string; exclusionRanges: TextRange[] } {
        pattern.lastIndex = 0;
        const ranges = exclusionRanges ?? this.computeInlineTagExclusionRanges(content);
        // Track removals to update exclusion ranges correctly
        const removals: { start: number; length: number }[] = [];
        const updatedContent = content.replace(pattern, (match: string, leadingWhitespace: string | undefined, offset: number) => {
            const whitespace = leadingWhitespace ?? '';
            const tagIndex = offset + whitespace.length;
            // Skip removal if tag is within protected context
            if (this.isIndexWithinRanges(tagIndex, ranges)) {
                return match;
            }
            removals.push({ start: offset, length: match.length });
            return '';
        });
        // Adjust exclusion ranges to account for removed text
        if (removals.length > 0) {
            let delta = 0;
            for (const removal of removals) {
                const adjustedStart = removal.start - delta;
                this.shiftRangesAfterRemoval(ranges, adjustedStart, removal.length);
                delta += removal.length;
            }
        }
        return {
            content: updatedContent,
            exclusionRanges: ranges
        };
    }

    private matchesPattern(content: string, pattern: RegExp): boolean {
        pattern.lastIndex = 0;
        return pattern.test(content);
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Identifies text ranges where inline tags should be preserved (code blocks, inline code, HTML tags)
     */
    private computeInlineTagExclusionRanges(content: string): TextRange[] {
        const fencedBlocks = this.findFencedCodeBlockRanges(content);
        const inlineCodeSpans = this.findInlineCodeRanges(content, fencedBlocks);
        const htmlTagRanges = this.findHtmlTagRanges(content);
        return this.mergeRanges([...fencedBlocks, ...inlineCodeSpans, ...htmlTagRanges]);
    }

    /**
     * Finds ranges of fenced code blocks (```code``` or ~~~code~~~)
     */
    private findFencedCodeBlockRanges(content: string): TextRange[] {
        const ranges: TextRange[] = [];
        const fencePattern = /^(\s*)([`~]{3,}).*$/u;
        let index = 0;
        let fenceStart: number | null = null;
        let fenceLength = 0;
        let fenceChar: string | null = null;

        while (index < content.length) {
            const lineEnd = content.indexOf('\n', index);
            const line = lineEnd === -1 ? content.slice(index) : content.slice(index, lineEnd);
            const match = line.match(fencePattern);

            if (fenceStart === null) {
                // Look for opening fence
                if (match && match[2]) {
                    fenceStart = index;
                    fenceLength = match[2].length;
                    fenceChar = match[2][0] ?? null;
                }
            } else if (match && match[2]) {
                // Look for matching closing fence (same character type and at least same length)
                const matchChar = match[2][0] ?? null;
                if (matchChar === fenceChar && match[2].length >= fenceLength) {
                    const blockEnd = lineEnd === -1 ? content.length : lineEnd + 1;
                    ranges.push({
                        start: fenceStart,
                        end: blockEnd
                    });
                    // Reset for next block
                    fenceStart = null;
                    fenceLength = 0;
                    fenceChar = null;
                }
            }

            if (lineEnd === -1) {
                break;
            }
            index = lineEnd + 1;
        }

        // Handle unclosed fence block at end of file
        if (fenceStart !== null) {
            ranges.push({
                start: fenceStart,
                end: content.length
            });
        }

        return ranges;
    }

    /**
     * Finds ranges of inline code spans (`code`) excluding areas already in code blocks
     */
    private findInlineCodeRanges(content: string, excluded: TextRange[]): TextRange[] {
        const ranges: TextRange[] = [];
        const mergedExcluded = this.mergeRanges([...excluded]);
        let searchIndex = 0;

        while (searchIndex < content.length) {
            const nextBacktick = content.indexOf('`', searchIndex);
            if (nextBacktick === -1) {
                break;
            }

            const containing = this.findRangeContainingIndex(nextBacktick, mergedExcluded);
            if (containing) {
                searchIndex = containing.end;
                continue;
            }

            // Count consecutive backticks for the opening sequence
            let tickCount = 1;
            while (nextBacktick + tickCount < content.length && content[nextBacktick + tickCount] === '`') {
                tickCount += 1;
            }

            // Find matching closing sequence with same number of backticks
            const closingIndex = this.findClosingBacktick(content, nextBacktick + tickCount, tickCount, mergedExcluded);
            if (closingIndex === -1) {
                searchIndex = nextBacktick + tickCount;
                continue;
            }

            const rangeEnd = closingIndex + tickCount;
            ranges.push({
                start: nextBacktick,
                end: rangeEnd
            });
            searchIndex = rangeEnd;
        }

        return ranges;
    }

    /**
     * Finds the closing backtick sequence for an inline code span
     */
    private findClosingBacktick(content: string, startIndex: number, tickCount: number, excluded: TextRange[]): number {
        let searchIndex = startIndex;

        while (searchIndex < content.length) {
            const nextBacktick = content.indexOf('`', searchIndex);
            if (nextBacktick === -1) {
                return -1;
            }

            const containing = this.findRangeContainingIndex(nextBacktick, excluded);
            if (containing) {
                searchIndex = containing.end;
                continue;
            }

            // Count consecutive backticks at current position
            let runLength = 1;
            while (nextBacktick + runLength < content.length && content[nextBacktick + runLength] === '`') {
                runLength += 1;
            }

            // Check if this matches the opening sequence length
            if (runLength === tickCount) {
                return nextBacktick;
            }

            // Skip past this backtick sequence
            searchIndex = nextBacktick + runLength;
        }

        return -1;
    }

    /**
     * Finds ranges of HTML tags where hash symbols should be preserved
     */
    private findHtmlTagRanges(content: string): TextRange[] {
        const ranges: TextRange[] = [];
        // Matches HTML tags including attributes
        const htmlPattern = /<\/?[A-Za-z](?:[\w:-]*)(?:\s[^<>]*?)?>/g;
        let match: RegExpExecArray | null;

        while ((match = htmlPattern.exec(content)) !== null) {
            ranges.push({
                start: match.index,
                end: match.index + match[0].length
            });
        }

        return ranges;
    }

    /**
     * Merges overlapping or adjacent text ranges into consolidated ranges
     */
    private mergeRanges(ranges: TextRange[]): TextRange[] {
        if (ranges.length === 0) {
            return [];
        }

        // Sort ranges by start position, then by end position
        const sorted = ranges.slice().sort((a, b) => {
            if (a.start === b.start) {
                return a.end - b.end;
            }
            return a.start - b.start;
        });

        const merged: TextRange[] = [];

        for (const range of sorted) {
            const previous = merged[merged.length - 1];
            if (!previous) {
                merged.push({ start: range.start, end: range.end });
                continue;
            }

            // Merge if current range overlaps or is adjacent to previous
            if (range.start <= previous.end) {
                previous.end = Math.max(previous.end, range.end);
                continue;
            }

            merged.push({ start: range.start, end: range.end });
        }

        return merged;
    }

    /**
     * Shifts ranges forward to account for removed text before the range start.
     * Requires ranges to be sorted and non-overlapping; callers always supply merged ranges.
     */
    private shiftRangesAfterRemoval(ranges: TextRange[], removalStart: number, removalLength: number): void {
        if (removalLength <= 0) {
            return;
        }
        const removalEnd = removalStart + removalLength;
        for (const range of ranges) {
            // Range is completely before removal - no adjustment needed
            if (range.end <= removalStart) {
                continue;
            }
            // Range is completely after removal - shift both start and end
            if (range.start >= removalEnd) {
                range.start -= removalLength;
                range.end -= removalLength;
                continue;
            }
            // Range partially overlaps with removal - adjust end only
            range.end = Math.max(range.start, range.end - removalLength);
        }
    }

    /**
     * Checks if a given index falls within any of the provided ranges
     */
    private isIndexWithinRanges(index: number, ranges: TextRange[]): boolean {
        return this.findRangeContainingIndex(index, ranges) !== null;
    }

    /**
     * Finds the range that contains the given index, or null if none
     */
    private findRangeContainingIndex(index: number, ranges: TextRange[]): TextRange | null {
        let left = 0;
        let right = ranges.length - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const range = ranges[mid];
            if (index < range.start) {
                right = mid - 1;
            } else if (index >= range.end) {
                left = mid + 1;
            } else {
                return range;
            }
        }

        return null;
    }
}
