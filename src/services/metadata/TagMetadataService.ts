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

import { App } from 'obsidian';
import { SortOption } from '../../settings';
import { ItemType } from '../../types';
import { ISettingsProvider } from '../../interfaces/ISettingsProvider';
import { ITagTreeProvider } from '../../interfaces/ITagTreeProvider';
import { BaseMetadataService } from './BaseMetadataService';
import type { CleanupValidators } from '../MetadataService';

/**
 * Service for managing tag-specific metadata operations
 * Handles tag colors, icons, sort overrides, and cleanup operations
 */
export class TagMetadataService extends BaseMetadataService {
    constructor(
        app: App,
        settingsProvider: ISettingsProvider,
        private getTagTreeProvider: () => ITagTreeProvider | null
    ) {
        super(app, settingsProvider);
    }
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
     * Gets the custom color for a tag, checking ancestors if not directly set
     * @param tagPath - Path of the tag
     * @returns The color value or undefined
     */
    getTagColor(tagPath: string): string | undefined {
        // First check if this tag has a color directly set
        const directColor = this.getEntityColor(ItemType.TAG, tagPath);
        if (directColor) return directColor;

        // If no direct color, check ancestors
        const pathParts = tagPath.split('/');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const ancestorPath = pathParts.slice(0, i).join('/');
            const ancestorColor = this.getEntityColor(ItemType.TAG, ancestorPath);
            if (ancestorColor) return ancestorColor;
        }

        return undefined;
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
        // Get valid tags from TagTreeService
        const tagTreeProvider = this.getTagTreeProvider();
        const validTagPaths = tagTreeProvider?.getAllTagPaths() || [];
        const validTags = new Set(validTagPaths);

        const validator = (path: string) => validTags.has(path);

        const results = await Promise.all([
            this.cleanupMetadata(this.settingsProvider.settings, 'tagColors', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'tagIcons', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'tagSortOverrides', validator)
        ]);

        return results.some(changed => changed);
    }

    /**
     * Clean up tag metadata using pre-loaded validators
     * @param validators - Pre-loaded data for validation
     * @returns True if any changes were made
     */
    async cleanupWithValidators(_validators: CleanupValidators): Promise<boolean> {
        // Get valid tags from TagTreeService
        const tagTreeProvider = this.getTagTreeProvider();
        const validTagPaths = tagTreeProvider?.getAllTagPaths() || [];
        const validTags = new Set(validTagPaths);

        const validator = (path: string) => validTags.has(path);

        const results = await Promise.all([
            this.cleanupMetadata(this.settingsProvider.settings, 'tagColors', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'tagIcons', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'tagSortOverrides', validator)
        ]);

        return results.some(changed => changed);
    }
}
