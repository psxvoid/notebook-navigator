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
        const content = await this.app.vault.read(file);
        const metadata = this.app.metadataCache.getFileCache(file);
        
        let newContent = content;
        
        // Update frontmatter tags
        if (metadata?.frontmatter?.tags) {
            newContent = await this.updateFrontmatterTags(file, oldTag, newTag);
        }
        
        // Update inline tags
        newContent = this.updateInlineTags(newContent, oldTag, newTag);
        
        // Only write if content changed
        if (newContent !== content) {
            await this.app.vault.modify(file, newContent);
        }
    }

    /**
     * Deletes a tag from a single file
     */
    private async deleteTagFromFile(file: TFile, tag: string): Promise<void> {
        const content = await this.app.vault.read(file);
        const metadata = this.app.metadataCache.getFileCache(file);
        
        let newContent = content;
        
        // Remove from frontmatter tags
        if (metadata?.frontmatter?.tags) {
            newContent = await this.removeFrontmatterTag(file, tag);
        }
        
        // Remove inline tags
        newContent = this.removeInlineTags(newContent, tag);
        
        // Only write if content changed
        if (newContent !== content) {
            await this.app.vault.modify(file, newContent);
        }
    }

    /**
     * Updates tags in frontmatter
     */
    private async updateFrontmatterTags(file: TFile, oldTag: string, newTag: string): Promise<string> {
        const content = await this.app.vault.read(file);
        
        return await this.app.vault.process(file, (data) => {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata?.frontmatter?.tags) return data;
            
            // Parse frontmatter
            const frontmatterMatch = data.match(/^---\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) return data;
            
            let frontmatter = frontmatterMatch[1];
            
            // Handle different tag formats in frontmatter
            // Format 1: tags: [tag1, tag2]
            const arrayMatch = frontmatter.match(/^tags:\s*\[(.*?)\]/m);
            if (arrayMatch) {
                const tagsStr = arrayMatch[1];
                const tags = tagsStr.split(',').map(t => t.trim().replace(/["']/g, ''));
                const newTags = tags.map(t => {
                    const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                    return cleanTag === oldTag ? newTag : cleanTag;
                });
                
                const newTagsStr = newTags.map(t => `"${t}"`).join(', ');
                frontmatter = frontmatter.replace(arrayMatch[0], `tags: [${newTagsStr}]`);
            }
            
            // Format 2: tags: tag1, tag2
            const inlineMatch = frontmatter.match(/^tags:\s*(.+)$/m);
            if (inlineMatch && !arrayMatch) {
                const tagsStr = inlineMatch[1];
                const tags = tagsStr.split(',').map(t => t.trim());
                const newTags = tags.map(t => {
                    const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                    return cleanTag === oldTag ? newTag : cleanTag;
                });
                
                frontmatter = frontmatter.replace(inlineMatch[0], `tags: ${newTags.join(', ')}`);
            }
            
            // Format 3: tags as list
            if (!arrayMatch && !inlineMatch) {
                // More careful regex to preserve exact formatting
                const listMatch = frontmatter.match(/^(tags:\s*\n)((?:\s*-\s*.+(?:\n|$))+)/m);
                if (listMatch) {
                    const prefix = listMatch[1];  // "tags:\n"
                    const tagsList = listMatch[2]; // the list items
                    
                    // Process each line, preserving exact indentation and line endings
                    const processedList = tagsList.replace(/^(\s*-\s*)(.+)$/gm, (match, indent, tagValue) => {
                        const tag = tagValue.trim().replace(/["']/g, '');
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        const newTagValue = cleanTag === oldTag ? newTag : cleanTag;
                        return `${indent}${newTagValue}`;
                    });
                    
                    frontmatter = frontmatter.replace(listMatch[0], prefix + processedList);
                }
            }
            
            // Reconstruct the content
            return data.replace(frontmatterMatch[0], `---\n${frontmatter}\n---`);
        });
    }

    /**
     * Removes a tag from frontmatter
     */
    private async removeFrontmatterTag(file: TFile, tag: string): Promise<string> {
        const content = await this.app.vault.read(file);
        
        return await this.app.vault.process(file, (data) => {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata?.frontmatter?.tags) return data;
            
            // Parse frontmatter
            const frontmatterMatch = data.match(/^---\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) return data;
            
            let frontmatter = frontmatterMatch[1];
            
            // Handle different tag formats in frontmatter
            // Format 1: tags: [tag1, tag2]
            const arrayMatch = frontmatter.match(/^tags:\s*\[(.*?)\]/m);
            if (arrayMatch) {
                const tagsStr = arrayMatch[1];
                const tags = tagsStr.split(',').map(t => t.trim().replace(/["']/g, ''));
                const newTags = tags.filter(t => {
                    const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                    return cleanTag !== tag;
                });
                
                if (newTags.length === 0) {
                    // Remove the entire tags field if no tags left
                    frontmatter = frontmatter.replace(/^tags:\s*\[.*?\]\n?/m, '');
                } else {
                    const newTagsStr = newTags.map(t => `"${t}"`).join(', ');
                    frontmatter = frontmatter.replace(arrayMatch[0], `tags: [${newTagsStr}]`);
                }
            }
            
            // Format 2: tags: tag1, tag2
            const inlineMatch = frontmatter.match(/^tags:\s*(.+)$/m);
            if (inlineMatch && !arrayMatch) {
                const tagsStr = inlineMatch[1];
                const tags = tagsStr.split(',').map(t => t.trim());
                const newTags = tags.filter(t => {
                    const cleanTag = t.startsWith('#') ? t.substring(1) : t;
                    return cleanTag !== tag;
                });
                
                if (newTags.length === 0) {
                    frontmatter = frontmatter.replace(/^tags:\s*.+\n?/m, '');
                } else {
                    frontmatter = frontmatter.replace(inlineMatch[0], `tags: ${newTags.join(', ')}`);
                }
            }
            
            // Format 3: tags as list
            if (!arrayMatch && !inlineMatch) {
                const listMatch = frontmatter.match(/^(tags:\s*\n)((?:\s*-\s*.+(?:\n|$))+)/m);
                if (listMatch) {
                    const prefix = listMatch[1];
                    const tagsList = listMatch[2];
                    
                    // Split into lines, filter out the matching tag, preserve formatting
                    const lines = tagsList.split('\n');
                    const filteredLines = lines.filter(line => {
                        const match = line.match(/^(\s*-\s*)(.+)$/);
                        if (match) {
                            const tagValue = match[2].trim().replace(/["']/g, '');
                            const cleanTag = tagValue.startsWith('#') ? tagValue.substring(1) : tagValue;
                            return cleanTag !== tag;
                        }
                        return line.trim() !== ''; // Keep non-empty lines
                    });
                    
                    if (filteredLines.length === 0) {
                        // Remove the entire tags field if no tags left
                        frontmatter = frontmatter.replace(listMatch[0], '');
                    } else {
                        frontmatter = frontmatter.replace(listMatch[0], prefix + filteredLines.join('\n') + '\n');
                    }
                }
            }
            
            // Reconstruct the content
            return data.replace(frontmatterMatch[0], `---\n${frontmatter}\n---`);
        });
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