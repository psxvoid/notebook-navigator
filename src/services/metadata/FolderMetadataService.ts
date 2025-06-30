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
            // Ensure all metadata objects exist
            if (!settings.folderColors) settings.folderColors = {};
            if (!settings.folderIcons) settings.folderIcons = {};
            if (!settings.folderSortOverrides) settings.folderSortOverrides = {};
            if (!settings.pinnedNotes) settings.pinnedNotes = {};

            // Update direct folder metadata
            if (settings.folderColors[oldPath]) {
                settings.folderColors[newPath] = settings.folderColors[oldPath];
                delete settings.folderColors[oldPath];
            }
            if (settings.folderIcons[oldPath]) {
                settings.folderIcons[newPath] = settings.folderIcons[oldPath];
                delete settings.folderIcons[oldPath];
            }
            if (settings.folderSortOverrides[oldPath]) {
                settings.folderSortOverrides[newPath] = settings.folderSortOverrides[oldPath];
                delete settings.folderSortOverrides[oldPath];
            }

            // Handle nested folders
            const oldPathPrefix = oldPath + '/';
            
            // Update nested folder colors
            const colorsToUpdate: Array<{oldPath: string, newPath: string, color: string}> = [];
            for (const path in settings.folderColors) {
                if (path.startsWith(oldPathPrefix)) {
                    const newNestedPath = newPath + path.substring(oldPath.length);
                    colorsToUpdate.push({
                        oldPath: path,
                        newPath: newNestedPath,
                        color: settings.folderColors[path]
                    });
                }
            }
            for (const update of colorsToUpdate) {
                settings.folderColors[update.newPath] = update.color;
                delete settings.folderColors[update.oldPath];
            }

            // Update nested folder icons
            const iconsToUpdate: Array<{oldPath: string, newPath: string, icon: string}> = [];
            for (const path in settings.folderIcons) {
                if (path.startsWith(oldPathPrefix)) {
                    const newNestedPath = newPath + path.substring(oldPath.length);
                    iconsToUpdate.push({
                        oldPath: path,
                        newPath: newNestedPath,
                        icon: settings.folderIcons[path]
                    });
                }
            }
            for (const update of iconsToUpdate) {
                settings.folderIcons[update.newPath] = update.icon;
                delete settings.folderIcons[update.oldPath];
            }

            // Update nested folder sort overrides
            const sortOverridesToUpdate: Array<{oldPath: string, newPath: string, sort: SortOption}> = [];
            for (const path in settings.folderSortOverrides) {
                if (path.startsWith(oldPathPrefix)) {
                    const newNestedPath = newPath + path.substring(oldPath.length);
                    sortOverridesToUpdate.push({
                        oldPath: path,
                        newPath: newNestedPath,
                        sort: settings.folderSortOverrides[path]
                    });
                }
            }
            for (const update of sortOverridesToUpdate) {
                settings.folderSortOverrides[update.newPath] = update.sort;
                delete settings.folderSortOverrides[update.oldPath];
            }

            // Handle pinned notes
            const pinnedNotesToUpdate: Array<{oldPath: string, newPath: string, notes: string[]}> = [];
            
            // Handle direct folder pinned notes
            if (settings.pinnedNotes[oldPath]) {
                const updatedNotes = settings.pinnedNotes[oldPath].map((notePath: string) => {
                    if (notePath.startsWith(oldPath + '/')) {
                        return newPath + notePath.substring(oldPath.length);
                    }
                    return notePath;
                });
                pinnedNotesToUpdate.push({
                    oldPath: oldPath,
                    newPath: newPath,
                    notes: updatedNotes
                });
            }
            
            // Handle nested folder pinned notes
            for (const path in settings.pinnedNotes) {
                if (path.startsWith(oldPathPrefix)) {
                    const newNestedPath = newPath + path.substring(oldPath.length);
                    const updatedNotes = settings.pinnedNotes[path].map((notePath: string) => {
                        if (notePath.startsWith(oldPath + '/')) {
                            return newPath + notePath.substring(oldPath.length);
                        }
                        return notePath;
                    });
                    pinnedNotesToUpdate.push({
                        oldPath: path,
                        newPath: newNestedPath,
                        notes: updatedNotes
                    });
                }
            }
            
            for (const update of pinnedNotesToUpdate) {
                settings.pinnedNotes[update.newPath] = update.notes;
                delete settings.pinnedNotes[update.oldPath];
            }
        });
    }

    /**
     * Handles folder deletion by removing all associated metadata
     * @param folderPath - Path of the deleted folder
     */
    async handleFolderDelete(folderPath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            const pathPrefix = folderPath + '/';

            // Remove folder color
            if (settings.folderColors?.[folderPath]) {
                delete settings.folderColors[folderPath];
            }

            // Remove folder icon
            if (settings.folderIcons?.[folderPath]) {
                delete settings.folderIcons[folderPath];
            }

            // Remove folder sort override
            if (settings.folderSortOverrides?.[folderPath]) {
                delete settings.folderSortOverrides[folderPath];
            }

            // Remove pinned notes for this folder
            if (settings.pinnedNotes?.[folderPath]) {
                delete settings.pinnedNotes[folderPath];
            }

            // Clean up nested folders
            if (settings.folderColors) {
                for (const nestedPath in settings.folderColors) {
                    if (nestedPath.startsWith(pathPrefix)) {
                        delete settings.folderColors[nestedPath];
                    }
                }
            }

            if (settings.folderIcons) {
                for (const nestedPath in settings.folderIcons) {
                    if (nestedPath.startsWith(pathPrefix)) {
                        delete settings.folderIcons[nestedPath];
                    }
                }
            }

            if (settings.folderSortOverrides) {
                for (const nestedPath in settings.folderSortOverrides) {
                    if (nestedPath.startsWith(pathPrefix)) {
                        delete settings.folderSortOverrides[nestedPath];
                    }
                }
            }

            // Clean up pinned notes for nested folders
            if (settings.pinnedNotes) {
                for (const folderPath in settings.pinnedNotes) {
                    if (folderPath.startsWith(pathPrefix)) {
                        delete settings.pinnedNotes[folderPath];
                    }
                }
            }
        });
    }

    /**
     * Clean up folder metadata for non-existent folders
     * @returns True if any changes were made
     */
    async cleanupFolderMetadata(): Promise<boolean> {
        let hasChanges = false;
        
        await this.saveAndUpdate(settings => {
            // Clean up folder colors
            if (settings.folderColors) {
                for (const folderPath in settings.folderColors) {
                    const folder = this.app.vault.getAbstractFileByPath(folderPath);
                    if (!(folder instanceof TFolder)) {
                        delete settings.folderColors[folderPath];
                        hasChanges = true;
                    }
                }
            }

            // Clean up folder icons
            if (settings.folderIcons) {
                for (const folderPath in settings.folderIcons) {
                    const folder = this.app.vault.getAbstractFileByPath(folderPath);
                    if (!(folder instanceof TFolder)) {
                        delete settings.folderIcons[folderPath];
                        hasChanges = true;
                    }
                }
            }

            // Clean up folder sort overrides
            if (settings.folderSortOverrides) {
                for (const folderPath in settings.folderSortOverrides) {
                    const folder = this.app.vault.getAbstractFileByPath(folderPath);
                    if (!(folder instanceof TFolder)) {
                        delete settings.folderSortOverrides[folderPath];
                        hasChanges = true;
                    }
                }
            }
        });
        
        return hasChanges;
    }
}