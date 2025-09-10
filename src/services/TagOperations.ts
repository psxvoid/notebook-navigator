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

import { App, TFile } from 'obsidian';
import { getDBInstance } from '../storage/fileOperations';

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
     * Pattern for tag boundaries: must be followed by whitespace, any Unicode punctuation, or end of line
     * Uses Unicode property escapes (\\p{P}) to support non-ASCII punctuation (e.g., Japanese、Arabic, CJK)
     */
    private static readonly TAG_BOUNDARY = '(?=\\s|$|\\p{P})';

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

    constructor(private app: App) {}

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
     * Adds a tag to multiple files
     * @param tag - The tag to add (without #)
     * @param files - Files to add the tag to
     * @returns Object with counts of files modified and skipped
     */
    async addTagToFiles(tag: string, files: TFile[]): Promise<{ added: number; skipped: number }> {
        let added = 0;
        let skipped = 0;

        for (const file of files) {
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
            const tags = db.getCachedTags(file.path);
            tags.forEach(tag => {
                const lowerTag = tag.toLowerCase();
                // Only add if we haven't seen this tag (case-insensitive)
                if (!canonicalTags.has(lowerTag)) {
                    canonicalTags.set(lowerTag, tag);
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
        const db = getDBInstance();
        const allTags = db.getCachedTags(file.path);

        // Normalize to lowercase for comparison
        const lowerTag = tag.toLowerCase();

        // Check if any existing tag is the same or an ancestor
        return allTags.some((existingTag: string) => {
            const lowerExistingTag = existingTag.toLowerCase();

            // Exact match (case-insensitive)
            if (lowerExistingTag === lowerTag) return true;

            // Check if we already have an ancestor tag
            // e.g., if we want to add "project/example" but file has "project"
            return lowerTag.startsWith(`${lowerExistingTag}/`);
        });
    }

    /**
     * Adds a tag to a single file's frontmatter
     */
    private async addTagToFile(file: TFile, tag: string): Promise<void> {
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
        let hadTag = false;

        // Remove from frontmatter
        try {
            await this.app.fileManager.processFrontMatter(file, fm => {
                if (!fm.tags) return;

                if (Array.isArray(fm.tags)) {
                    const originalLength = fm.tags.length;
                    fm.tags = fm.tags.filter((t: string) => {
                        const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                        return cleanTag.toLowerCase() !== tag.toLowerCase();
                    });

                    if (fm.tags.length < originalLength) {
                        hadTag = true;
                    }

                    if (fm.tags.length === 0) {
                        delete fm.tags;
                    }
                } else if (typeof fm.tags === 'string') {
                    const tags = fm.tags.split(',').map((t: string) => t.trim());
                    const filteredTags = tags.filter((t: string) => {
                        const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                        return cleanTag.toLowerCase() !== tag.toLowerCase();
                    });

                    if (filteredTags.length < tags.length) {
                        hadTag = true;
                    }

                    if (filteredTags.length === 0) {
                        delete fm.tags;
                    } else {
                        fm.tags = filteredTags.length === 1 ? filteredTags[0] : filteredTags;
                    }
                }
            });
        } catch (error) {
            console.error('Error removing tag from frontmatter:', error);
        }

        // Remove from inline content only if tag might exist
        // First, read the content to check if we need to process it
        const content = await this.app.vault.read(file);
        if (this.hasSpecificInlineTag(content, tag)) {
            await this.app.vault.process(file, content => {
                const newContent = this.removeInlineTags(content, tag);
                if (newContent !== content) {
                    hadTag = true;
                }
                return newContent;
            });
        }

        return hadTag;
    }

    /**
     * Removes any descendant tags of the given tag from a file
     * e.g., if adding "project", removes "project/example", "project/task1", etc.
     */
    private async removeDescendantTagsFromFile(file: TFile, ancestorTag: string): Promise<void> {
        // Get all current tags from the file
        const currentTags = this.getTagsFromFiles([file]);

        // Find descendant tags to remove (case-insensitive)
        const lowerAncestor = ancestorTag.toLowerCase();
        const descendantTags = currentTags.filter(tag => tag.toLowerCase().startsWith(`${lowerAncestor}/`));

        if (descendantTags.length === 0) return;

        // Create lowercase set for efficient lookup
        const lowerDescendantSet = new Set(descendantTags.map(t => t.toLowerCase()));

        // Remove descendant tags from frontmatter
        try {
            await this.app.fileManager.processFrontMatter(file, fm => {
                if (!fm.tags) return;

                if (Array.isArray(fm.tags)) {
                    fm.tags = fm.tags.filter((tag: string) => {
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        // Case-insensitive check
                        return !lowerDescendantSet.has(cleanTag.toLowerCase());
                    });

                    if (fm.tags.length === 0) {
                        delete fm.tags;
                    }
                } else if (typeof fm.tags === 'string') {
                    const tags = fm.tags.split(',').map((t: string) => t.trim());
                    const filteredTags = tags.filter((tag: string) => {
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        // Case-insensitive check
                        return !lowerDescendantSet.has(cleanTag.toLowerCase());
                    });

                    if (filteredTags.length === 0) {
                        delete fm.tags;
                    } else {
                        fm.tags = filteredTags.length === 1 ? filteredTags[0] : filteredTags;
                    }
                }
            });
        } catch (error) {
            console.error('Error removing descendant tags from frontmatter:', error);
        }

        // Remove descendant tags from inline content only if any exist
        // First check if we need to process at all
        const content = await this.app.vault.read(file);
        const hasAnyDescendantTag = descendantTags.some(tag => this.hasSpecificInlineTag(content, tag));

        if (hasAnyDescendantTag) {
            await this.app.vault.process(file, content => {
                let newContent = content;
                for (const descendantTag of descendantTags) {
                    newContent = this.removeInlineTags(newContent, descendantTag);
                }
                return newContent;
            });
        }
    }

    /**
     * Clears all tags from a single file
     * @returns Whether the file had any tags to clear
     */
    private async clearAllTagsFromFile(file: TFile): Promise<boolean> {
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
                    delete fm.tags;
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
}
