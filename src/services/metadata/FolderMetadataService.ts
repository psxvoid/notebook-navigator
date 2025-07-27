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

import { TFolder } from 'obsidian';
import { SortOption } from '../../settings';
import { ItemType } from '../../types';
import { BaseMetadataService } from './BaseMetadataService';

/**
 * Service for managing folder-specific metadata operations
 * Handles folder colors, icons, sort overrides, and cleanup operations
 */
export class FolderMetadataService extends BaseMetadataService {
    /**
     * Validates that a folder exists in the vault
     */
    private validateFolder(folderPath: string): boolean {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        return folder instanceof TFolder;
    }

    /**
     * Sets a custom color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderColor(folderPath: string, color: string): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntityColor(ItemType.FOLDER, folderPath, color);
    }

    /**
     * Removes the custom color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderColor(folderPath: string): Promise<void> {
        return this.removeEntityColor(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the custom color for a folder
     * @param folderPath - Path of the folder
     * @returns The color value or undefined
     */
    getFolderColor(folderPath: string): string | undefined {
        return this.getEntityColor(ItemType.FOLDER, folderPath);
    }

    /**
     * Sets a custom icon for a folder
     * @param folderPath - Path of the folder
     * @param iconId - Lucide icon identifier
     */
    async setFolderIcon(folderPath: string, iconId: string): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntityIcon(ItemType.FOLDER, folderPath, iconId);
    }

    /**
     * Removes the custom icon from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderIcon(folderPath: string): Promise<void> {
        return this.removeEntityIcon(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the custom icon for a folder
     * @param folderPath - Path of the folder
     * @returns The icon ID or undefined
     */
    getFolderIcon(folderPath: string): string | undefined {
        return this.getEntityIcon(ItemType.FOLDER, folderPath);
    }

    /**
     * Sets a custom sort order for a folder
     * @param folderPath - Path of the folder
     * @param sortOption - Sort option to apply
     */
    async setFolderSortOverride(folderPath: string, sortOption: SortOption): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntitySortOverride(ItemType.FOLDER, folderPath, sortOption);
    }

    /**
     * Removes the custom sort order from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderSortOverride(folderPath: string): Promise<void> {
        return this.removeEntitySortOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the sort override for a folder
     * @param folderPath - Path of the folder
     * @returns The sort option or undefined
     */
    getFolderSortOverride(folderPath: string): SortOption | undefined {
        return this.getEntitySortOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Handles folder rename by updating all associated metadata
     * @param oldPath - Previous folder path
     * @param newPath - New folder path
     */
    async handleFolderRename(oldPath: string, newPath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            // Update all metadata types
            this.updateNestedPaths(settings.folderColors, oldPath, newPath);
            this.updateNestedPaths(settings.folderIcons, oldPath, newPath);
            this.updateNestedPaths(settings.folderSortOverrides, oldPath, newPath);

            // Handle pinned notes separately (different structure)
            if (settings.pinnedNotes?.[oldPath]) {
                settings.pinnedNotes[newPath] = settings.pinnedNotes[oldPath];
                delete settings.pinnedNotes[oldPath];
            }
        });
    }

    /**
     * Handles folder deletion by removing all associated metadata
     * @param folderPath - Path of the deleted folder
     */
    async handleFolderDelete(folderPath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            this.deleteNestedPaths(settings.folderColors, folderPath);
            this.deleteNestedPaths(settings.folderIcons, folderPath);
            this.deleteNestedPaths(settings.folderSortOverrides, folderPath);

            // Delete pinned notes
            delete settings.pinnedNotes?.[folderPath];
        });
    }

    /**
     * Clean up folder metadata for non-existent folders
     * @returns True if any changes were made
     */
    async cleanupFolderMetadata(): Promise<boolean> {
        const validator = (path: string) => {
            const folder = this.app.vault.getAbstractFileByPath(path);
            return folder instanceof TFolder;
        };

        const results = await Promise.all([
            this.cleanupMetadata(this.plugin.settings, 'folderColors', validator),
            this.cleanupMetadata(this.plugin.settings, 'folderIcons', validator),
            this.cleanupMetadata(this.plugin.settings, 'folderSortOverrides', validator)
        ]);

        return results.some(changed => changed);
    }
}
