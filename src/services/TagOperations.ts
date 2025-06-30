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
        // Create regex patterns for the tag
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
}