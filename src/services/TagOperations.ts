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

import { App, TFile, CachedMetadata } from 'obsidian';

/**
 * Service for managing tag rename and delete operations.
 * Handles updating both frontmatter tags and inline tags in note content.
 */
export class TagOperations {
    constructor(private app: App) {}

    /**
     * Renames a tag in all affected files
     * @param oldTag - The current tag path (without #)
     * @param newTag - The new tag path (without #)
     * @param files - Files that contain the tag
     */
    async renameTag(oldTag: string, newTag: string, files: TFile[]): Promise<void> {
        for (const file of files) {
            await this.renameTagInFile(file, oldTag, newTag);
        }
    }

    /**
     * Deletes a tag from all affected files
     * @param tag - The tag path to delete (without #)
     * @param files - Files that contain the tag
     */
    async deleteTag(tag: string, files: TFile[]): Promise<void> {
        for (const file of files) {
            await this.deleteTagFromFile(file, tag);
        }
    }

    /**
     * Renames a tag in a single file
     */
    private async renameTagInFile(file: TFile, oldTag: string, newTag: string): Promise<void> {
        // Handle frontmatter tags
        await this.updateFrontmatterTags(file, oldTag, newTag);
        
        // Handle inline tags
        const content = await this.app.vault.read(file);
        const newContent = this.updateInlineTags(content, oldTag, newTag);
        
        // Only write if inline tags changed
        if (newContent !== content) {
            await this.app.vault.modify(file, newContent);
        }
    }

    /**
     * Deletes a tag from a single file
     */
    private async deleteTagFromFile(file: TFile, tag: string): Promise<void> {
        // Handle frontmatter tags
        await this.removeFrontmatterTag(file, tag);
        
        // Handle inline tags
        const content = await this.app.vault.read(file);
        const newContent = this.removeInlineTags(content, tag);
        
        // Only write if inline tags changed
        if (newContent !== content) {
            await this.app.vault.modify(file, newContent);
        }
    }

    /**
     * Updates tags in frontmatter
     */
    private async updateFrontmatterTags(file: TFile, oldTag: string, newTag: string): Promise<void> {
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                if (!fm.tags) return;
                
                // Handle different tag formats
                if (Array.isArray(fm.tags)) {
                    // Tags as array
                    fm.tags = fm.tags.map((tag: string) => {
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        return cleanTag === oldTag ? newTag : tag;
                    });
                } else if (typeof fm.tags === 'string') {
                    // Tags as string (single tag or comma-separated)
                    const tags = fm.tags.split(',').map((t: string) => t.trim());
                    const updatedTags = tags.map((tag: string) => {
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        return cleanTag === oldTag ? newTag : tag;
                    });
                    fm.tags = updatedTags.length === 1 ? updatedTags[0] : updatedTags;
                }
                
                // Ensure uniqueness if array
                if (Array.isArray(fm.tags)) {
                    fm.tags = [...new Set(fm.tags)];
                }
            });
        } catch (error) {
            console.error('Error updating frontmatter tags:', error);
            throw error;
        }
    }

    /**
     * Removes a tag from frontmatter
     */
    private async removeFrontmatterTag(file: TFile, tag: string): Promise<void> {
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                if (!fm.tags) return;
                
                // Handle different tag formats
                if (Array.isArray(fm.tags)) {
                    // Tags as array
                    const filteredTags = fm.tags.filter((t: string) => {
                        const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                        return cleanTag !== tag;
                    });
                    
                    // Remove tags field if empty, otherwise update
                    if (filteredTags.length === 0) {
                        delete fm.tags;
                    } else {
                        fm.tags = filteredTags;
                    }
                } else if (typeof fm.tags === 'string') {
                    // Tags as string (single tag or comma-separated)
                    const tags = fm.tags.split(',').map((t: string) => t.trim());
                    const filteredTags = tags.filter((t: string) => {
                        const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                        return cleanTag !== tag;
                    });
                    
                    if (filteredTags.length === 0) {
                        delete fm.tags;
                    } else {
                        fm.tags = filteredTags.length === 1 ? filteredTags[0] : filteredTags;
                    }
                }
            });
        } catch (error) {
            console.error('Error removing tag from frontmatter:', error);
            throw error;
        }
    }

    /**
     * Updates inline tags in content
     */
    private updateInlineTags(content: string, oldTag: string, newTag: string): string {
        // Create regex patterns for the tag (add # prefix for inline tags)
        const patterns = [
            // Standard tag format: #tag
            new RegExp(`#${this.escapeRegExp(oldTag)}\\b`, 'g'),
            // Tag with nested levels: #parent/child
            new RegExp(`#${this.escapeRegExp(oldTag)}/`, 'g'),
        ];
        
        let newContent = content;
        
        // Replace exact matches
        newContent = newContent.replace(patterns[0], `#${newTag}`);
        
        // Replace parent tags in nested tags
        newContent = newContent.replace(patterns[1], `#${newTag}/`);
        
        return newContent;
    }

    /**
     * Removes inline tags from content
     */
    private removeInlineTags(content: string, tag: string): string {
        // Create regex patterns for the tag
        const patterns = [
            // Standard tag format: #tag (with optional following space)
            new RegExp(`#${this.escapeRegExp(tag)}\\b\\s?`, 'g'),
            // Tag at end of line
            new RegExp(`\\s*#${this.escapeRegExp(tag)}$`, 'gm'),
        ];
        
        let newContent = content;
        
        // Remove tags
        patterns.forEach(pattern => {
            newContent = newContent.replace(pattern, '');
        });
        
        return newContent;
    }

    /**
     * Escapes special regex characters in a string
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }


    /**
     * Gets all parent tags of a given tag
     * e.g., for "project/example/task" returns ["project", "project/example"]
     */
    private getParentTags(tag: string): string[] {
        const parts = tag.split('/');
        const parents: string[] = [];
        
        for (let i = 1; i < parts.length; i++) {
            parents.push(parts.slice(0, i).join('/'));
        }
        
        return parents;
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
            const alreadyHasTag = await this.fileHasTag(file, tag);
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
     * Checks if a file already has a specific tag or a more specific nested version
     */
    private async fileHasTag(file: TFile, tag: string): Promise<boolean> {
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata) return false;

        // Get all tags from the file
        const allTags: string[] = [];

        // Collect frontmatter tags
        const frontmatterTags = metadata.frontmatter?.tags;
        if (frontmatterTags) {
            if (Array.isArray(frontmatterTags)) {
                allTags.push(...frontmatterTags.map((t: string) => 
                    t.startsWith('#') ? t.substring(1) : t
                ));
            } else if (typeof frontmatterTags === 'string') {
                const tags = frontmatterTags.split(',').map((t: string) => t.trim());
                allTags.push(...tags.map((t: string) => 
                    t.startsWith('#') ? t.substring(1) : t
                ));
            }
        }

        // Collect inline tags
        if (metadata.tags) {
            allTags.push(...metadata.tags.map(t => t.tag.substring(1)));
        }

        // Check if any existing tag is the same or more specific
        return allTags.some((existingTag: string) => {
            // Exact match
            if (existingTag === tag) return true;
            
            // Check if existing tag is a child of the tag we want to add
            // e.g., if we want to add "project" but file has "project/example"
            return existingTag.startsWith(tag + '/');
        });
    }

    /**
     * Adds a tag to a single file's frontmatter
     */
    private async addTagToFile(file: TFile, tag: string): Promise<void> {
        // First, remove any parent tags of the new tag
        await this.removeParentTagsFromFile(file, tag);
        
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
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
     * Removes any parent tags of the given tag from a file
     * e.g., if adding "project/example", removes "project"
     */
    private async removeParentTagsFromFile(file: TFile, childTag: string): Promise<void> {
        const parentTags = this.getParentTags(childTag);
        if (parentTags.length === 0) return;

        // Remove parent tags from frontmatter
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                if (!fm.tags) return;
                
                if (Array.isArray(fm.tags)) {
                    fm.tags = fm.tags.filter((tag: string) => {
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        return !parentTags.includes(cleanTag);
                    });
                    
                    if (fm.tags.length === 0) {
                        delete fm.tags;
                    }
                } else if (typeof fm.tags === 'string') {
                    const tags = fm.tags.split(',').map((t: string) => t.trim());
                    const filteredTags = tags.filter((tag: string) => {
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        return !parentTags.includes(cleanTag);
                    });
                    
                    if (filteredTags.length === 0) {
                        delete fm.tags;
                    } else {
                        fm.tags = filteredTags.length === 1 ? filteredTags[0] : filteredTags;
                    }
                }
            });
        } catch (error) {
            console.error('Error removing parent tags from frontmatter:', error);
        }

        // Remove parent tags from inline content
        const content = await this.app.vault.read(file);
        let newContent = content;
        
        for (const parentTag of parentTags) {
            newContent = this.removeInlineTags(newContent, parentTag);
        }
        
        if (newContent !== content) {
            await this.app.vault.modify(file, newContent);
        }
    }

    /**
     * Clears all tags from a single file
     * @returns Whether the file had any tags to clear
     */
    private async clearAllTagsFromFile(file: TFile): Promise<boolean> {
        let hadTags = false;

        // Clear frontmatter tags
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                if (fm.tags) {
                    hadTags = true;
                    delete fm.tags;
                }
            });
        } catch (error) {
            console.error('Error clearing frontmatter tags:', error);
            throw error;
        }

        // Clear inline tags
        const content = await this.app.vault.read(file);
        const newContent = this.removeAllInlineTags(content);
        
        if (newContent !== content) {
            hadTags = true;
            await this.app.vault.modify(file, newContent);
        }

        return hadTags;
    }

    /**
     * Removes all inline tags from content
     */
    private removeAllInlineTags(content: string): string {
        // Remove all tags that start with # followed by word characters, hyphens, or slashes
        // Must be followed by whitespace or end of line to avoid matching things like #1 in issue numbers
        return content.replace(/#[\w\-\/]+(?=\s|$)/g, '');
    }
}