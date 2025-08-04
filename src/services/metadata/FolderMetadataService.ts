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
import type { CleanupValidators } from '../MetadataService';

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
            this.updateNestedPaths(settings.folderAppearances, oldPath, newPath);

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
            this.deleteNestedPaths(settings.folderAppearances, folderPath);

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
            this.cleanupMetadata(this.settingsProvider.settings, 'folderColors', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'folderIcons', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'folderSortOverrides', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'folderAppearances', validator)
        ]);

        return results.some(changed => changed);
    }

    /**
     * Clean up folder metadata using pre-loaded validators.
     *
     * This method is called during plugin startup as part of a unified cleanup process
     * to avoid multiple iterations over vault files. Instead of each metadata type
     * (colors, icons, sort overrides, appearances) separately checking if folders exist,
     * this method uses pre-loaded data for better performance.
     *
     * The cleanup process:
     * 1. Called from StorageContext during initial sync after all files are processed
     * 2. Uses validators object that contains:
     *    - dbFiles: All files from IndexedDB cache
     *    - tagTree: Complete tag hierarchy
     *    - vaultFiles: Set of all file paths in the vault
     * 3. Builds a set of valid folder paths by extracting parent folders from all files
     * 4. Removes metadata for any folders that no longer exist in the vault
     *
     * @param validators - Pre-loaded data containing vault files, database files, and tag tree
     * @returns True if any metadata was removed/changed
     */
    async cleanupWithValidators(validators: CleanupValidators): Promise<boolean> {
        // Build a set of all valid folder paths by examining the vault's file structure
        const folderPaths = new Set<string>();

        // Extract folder paths from all vault files
        // For example, if we have "folder1/folder2/file.md", we extract:
        // - "folder1"
        // - "folder1/folder2"
        validators.vaultFiles.forEach(filePath => {
            // Split path and rebuild parent folders incrementally
            const parts = filePath.split('/');
            for (let i = 1; i < parts.length; i++) {
                const folderPath = parts.slice(0, i).join('/');
                folderPaths.add(folderPath);
            }
        });

        // Always include root folder
        folderPaths.add('/');

        // Create validator function that checks if a folder path exists
        const validator = (path: string) => folderPaths.has(path);

        const results = await Promise.all([
            this.cleanupMetadata(this.settingsProvider.settings, 'folderColors', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'folderIcons', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'folderSortOverrides', validator),
            this.cleanupMetadata(this.settingsProvider.settings, 'folderAppearances', validator)
        ]);

        return results.some(changed => changed);
    }
}
