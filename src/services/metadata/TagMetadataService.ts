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

import { getAllTags } from 'obsidian';
import { SortOption } from '../../settings';
import { ItemType } from '../../types';
import { BaseMetadataService } from './BaseMetadataService';

/**
 * Service for managing tag-specific metadata operations
 * Handles tag colors, icons, sort overrides, and cleanup operations
 */
export class TagMetadataService extends BaseMetadataService {
    /**
     * Sets a custom color for a tag
     * @param tagPath - Path of the tag (e.g., "inbox/processing")
     * @param color - CSS color value
     */
    async setTagColor(tagPath: string, color: string): Promise<void> {
        return this.setEntityColor(ItemType.TAG, tagPath, color);
    }

    /**
     * Removes the custom color from a tag
     * @param tagPath - Path of the tag
     */
    async removeTagColor(tagPath: string): Promise<void> {
        return this.removeEntityColor(ItemType.TAG, tagPath);
    }

    /**
     * Gets the custom color for a tag
     * @param tagPath - Path of the tag
     * @returns The color value or undefined
     */
    getTagColor(tagPath: string): string | undefined {
        return this.getEntityColor(ItemType.TAG, tagPath);
    }

    /**
     * Sets a custom icon for a tag
     * @param tagPath - Path of the tag (e.g., "inbox/processing")
     * @param iconId - Lucide icon identifier
     */
    async setTagIcon(tagPath: string, iconId: string): Promise<void> {
        return this.setEntityIcon(ItemType.TAG, tagPath, iconId);
    }

    /**
     * Removes the custom icon from a tag
     * @param tagPath - Path of the tag
     */
    async removeTagIcon(tagPath: string): Promise<void> {
        return this.removeEntityIcon(ItemType.TAG, tagPath);
    }

    /**
     * Gets the custom icon for a tag
     * @param tagPath - Path of the tag
     * @returns The icon ID or undefined
     */
    getTagIcon(tagPath: string): string | undefined {
        return this.getEntityIcon(ItemType.TAG, tagPath);
    }

    /**
     * Sets a custom sort order for a tag
     * @param tagPath - Path of the tag
     * @param sortOption - Sort option to apply
     */
    async setTagSortOverride(tagPath: string, sortOption: SortOption): Promise<void> {
        return this.setEntitySortOverride(ItemType.TAG, tagPath, sortOption);
    }

    /**
     * Removes the custom sort order from a tag
     * @param tagPath - Path of the tag
     */
    async removeTagSortOverride(tagPath: string): Promise<void> {
        return this.removeEntitySortOverride(ItemType.TAG, tagPath);
    }

    /**
     * Gets the sort override for a tag
     * @param tagPath - Path of the tag
     * @returns The sort option or undefined
     */
    getTagSortOverride(tagPath: string): SortOption | undefined {
        return this.getEntitySortOverride(ItemType.TAG, tagPath);
    }

    /**
     * Clean up tag metadata for non-existent tags
     * @returns True if any changes were made
     */
    async cleanupTagMetadata(): Promise<boolean> {
        let hasChanges = false;
        
        // Collect all existing tags once
        const validTags = new Set<string>();
        const allFiles = this.app.vault.getMarkdownFiles();
        
        for (const file of allFiles) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache) {
                // Use getAllTags to get both frontmatter and inline tags
                const tags = getAllTags(cache);
                if (tags && tags.length > 0) {
                    tags.forEach((tag: string) => {
                        // Remove # prefix for comparison
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        validTags.add(cleanTag);
                        
                        // Also add parent tags
                        const parts = cleanTag.split('/');
                        for (let i = 1; i < parts.length; i++) {
                            const parentTag = parts.slice(0, i).join('/');
                            validTags.add(parentTag);
                        }
                    });
                }
            }
        }
        
        await this.saveAndUpdate(settings => {
            // Clean up tag colors
            if (settings.tagColors) {
                for (const tagPath in settings.tagColors) {
                    if (!validTags.has(tagPath)) {
                        delete settings.tagColors[tagPath];
                        hasChanges = true;
                    }
                }
            }
            
            // Clean up tag icons
            if (settings.tagIcons) {
                for (const tagPath in settings.tagIcons) {
                    if (!validTags.has(tagPath)) {
                        delete settings.tagIcons[tagPath];
                        hasChanges = true;
                    }
                }
            }
            
            // Clean up tag sort overrides
            if (settings.tagSortOverrides) {
                for (const tagPath in settings.tagSortOverrides) {
                    if (!validTags.has(tagPath)) {
                        delete settings.tagSortOverrides[tagPath];
                        hasChanges = true;
                    }
                }
            }
        });
        
        return hasChanges;
    }
}