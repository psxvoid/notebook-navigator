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

import { SortOption } from '../../settings';
import { ItemType } from '../../types';
import { BaseMetadataService } from './BaseMetadataService';
import { buildTagTree } from '../../utils/tagTree';
import { TagTreeNode } from '../../types/storage';
import { getFilteredMarkdownFiles } from '../../utils/fileFilters';

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
        // Build valid tags set first
        const allFiles = getFilteredMarkdownFiles(this.app, this.plugin.settings);
        const { tree: tagTree } = buildTagTree(allFiles, this.app);
        const validTags = this.collectAllTagPaths(tagTree);

        const validator = (path: string) => validTags.has(path);

        const results = await Promise.all([
            this.cleanupMetadata(this.plugin.settings, 'tagColors', validator),
            this.cleanupMetadata(this.plugin.settings, 'tagIcons', validator),
            this.cleanupMetadata(this.plugin.settings, 'tagSortOverrides', validator)
        ]);

        return results.some(changed => changed);
    }

    /**
     * Collects all tag paths from tag tree
     */
    private collectAllTagPaths(tree: Map<string, TagTreeNode>): Set<string> {
        const paths = new Set<string>();

        function addNode(node: TagTreeNode): void {
            paths.add(node.path);
            for (const child of node.children.values()) {
                addNode(child);
            }
        }

        for (const node of tree.values()) {
            addNode(node);
        }

        return paths;
    }
}
