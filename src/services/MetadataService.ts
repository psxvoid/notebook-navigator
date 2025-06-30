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

import { TFile, TFolder } from 'obsidian';
import { NotebookNavigatorSettings, SortOption } from '../settings';
import { ItemType } from '../types';

/**
 * Type for entity that can have metadata (folder or tag)
 */
type EntityType = typeof ItemType.FOLDER | typeof ItemType.TAG;

/**
 * Service for managing all folder and file metadata operations
 * Centralizes handling of folder colors, icons, sort overrides, and pinned notes
 * Provides cleanup operations for deleted files/folders
 */

export class MetadataService {
    private updateQueue: Promise<void> = Promise.resolve();
    
    /**
     * Creates a new MetadataService instance
     * @param app - The Obsidian app instance
     * @param settings - The current plugin settings
     * @param updateSettings - Function to update and persist settings
     */
    constructor(
        private app: any,
        private settings: NotebookNavigatorSettings,
        private updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>
    ) {}
    
    /**
     * Saves settings and triggers UI update
     * Uses a queue to serialize updates and prevent race conditions
     */
    private async saveAndUpdate(updater: (settings: NotebookNavigatorSettings) => void): Promise<void> {
        // Queue this update to run after any pending updates
        this.updateQueue = this.updateQueue.then(async () => {
            try {
                await this.updateSettings(updater);
            } catch (error) {
                // Failed to save settings, re-throw to propagate
                throw error;
            }
        });
        
        return this.updateQueue;
    }

    /**
     * Validates that a folder exists in the vault
     */
    private validateFolder(folderPath: string): boolean {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        return folder instanceof TFolder;
    }

    /**
     * Validates a CSS color format
     */
    private validateColor(color: string): boolean {
        const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-zA-Z]+)$/;
        return colorRegex.test(color);
    }

    // ========== Generic Color Management ==========

    /**
     * Sets a custom color for an entity (folder or tag)
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @param color - CSS color value
     */
    private async setEntityColor(entityType: EntityType, path: string, color: string): Promise<void> {
        // Validate folder if it's a folder type
        if (entityType === ItemType.FOLDER && !this.validateFolder(path)) {
            return;
        }
        
        // Validate color format
        if (!this.validateColor(color)) {
            return;
        }
        
        await this.saveAndUpdate(settings => {
            if (entityType === ItemType.FOLDER) {
                if (!settings.folderColors) {
                    settings.folderColors = {};
                }
                settings.folderColors[path] = color;
            } else {
                if (!settings.tagColors) {
                    settings.tagColors = {};
                }
                settings.tagColors[path] = color;
            }
        });
    }

    /**
     * Removes the custom color from an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     */
    private async removeEntityColor(entityType: EntityType, path: string): Promise<void> {
        if (entityType === ItemType.FOLDER && this.settings.folderColors?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderColors![path];
            });
        } else if (entityType === ItemType.TAG && this.settings.tagColors?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.tagColors![path];
            });
        }
    }

    /**
     * Gets the custom color for an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @returns The color value or undefined
     */
    private getEntityColor(entityType: EntityType, path: string): string | undefined {
        if (entityType === ItemType.FOLDER) {
            return this.settings.folderColors?.[path];
        } else {
            return this.settings.tagColors?.[path];
        }
    }

    // ========== Generic Icon Management ==========

    /**
     * Sets a custom icon for an entity (folder or tag)
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @param iconId - Lucide icon identifier
     */
    private async setEntityIcon(entityType: EntityType, path: string, iconId: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (entityType === ItemType.FOLDER) {
                if (!settings.folderIcons) {
                    settings.folderIcons = {};
                }
                settings.folderIcons[path] = iconId;
            } else {
                if (!settings.tagIcons) {
                    settings.tagIcons = {};
                }
                settings.tagIcons[path] = iconId;
            }
            
            // Update recently used icons
            if (!settings.recentlyUsedIcons) {
                settings.recentlyUsedIcons = [];
            }
            
            // Remove if already exists and add to front
            settings.recentlyUsedIcons = [
                iconId,
                ...settings.recentlyUsedIcons.filter((id: string) => id !== iconId)
            ].slice(0, 10); // Keep only 10 most recent
        });
    }

    /**
     * Removes the custom icon from an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     */
    private async removeEntityIcon(entityType: EntityType, path: string): Promise<void> {
        if (entityType === ItemType.FOLDER && this.settings.folderIcons?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderIcons![path];
            });
        } else if (entityType === ItemType.TAG && this.settings.tagIcons?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.tagIcons![path];
            });
        }
    }

    /**
     * Gets the custom icon for an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @returns The icon ID or undefined
     */
    private getEntityIcon(entityType: EntityType, path: string): string | undefined {
        if (entityType === ItemType.FOLDER) {
            return this.settings.folderIcons?.[path];
        } else {
            return this.settings.tagIcons?.[path];
        }
    }

    // ========== Generic Sort Override Management ==========

    /**
     * Sets a custom sort order for an entity (folder or tag)
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @param sortOption - Sort option to apply
     */
    private async setEntitySortOverride(entityType: EntityType, path: string, sortOption: SortOption): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (entityType === ItemType.FOLDER) {
                if (!settings.folderSortOverrides) {
                    settings.folderSortOverrides = {};
                }
                settings.folderSortOverrides[path] = sortOption;
            } else {
                if (!settings.tagSortOverrides) {
                    settings.tagSortOverrides = {};
                }
                settings.tagSortOverrides[path] = sortOption;
            }
        });
    }

    /**
     * Removes the custom sort order from an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     */
    private async removeEntitySortOverride(entityType: EntityType, path: string): Promise<void> {
        if (entityType === ItemType.FOLDER && this.settings.folderSortOverrides?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderSortOverrides![path];
            });
        } else if (entityType === ItemType.TAG && this.settings.tagSortOverrides?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.tagSortOverrides![path];
            });
        }
    }

    /**
     * Gets the sort override for an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @returns The sort option or undefined
     */
    private getEntitySortOverride(entityType: EntityType, path: string): SortOption | undefined {
        if (entityType === ItemType.FOLDER) {
            return this.settings.folderSortOverrides?.[path];
        } else {
            return this.settings.tagSortOverrides?.[path];
        }
    }

    // ========== Public API - Folder Methods (for backward compatibility) ==========

    /**
     * Sets a custom color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderColor(folderPath: string, color: string): Promise<void> {
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

    // ========== Public API - Tag Methods (for backward compatibility) ==========

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

    // ========== Pinned Notes Management ==========

    /**
     * Toggles the pinned state of a note in a folder
     * @param folderPath - Path of the containing folder
     * @param filePath - Path of the file to pin/unpin
     */
    async togglePinnedNote(folderPath: string, filePath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (!settings.pinnedNotes) {
                settings.pinnedNotes = {};
            }

            const currentPinned = settings.pinnedNotes[folderPath] || [];
            const isPinned = currentPinned.includes(filePath);

            if (isPinned) {
                // Unpin
                settings.pinnedNotes[folderPath] = currentPinned.filter((p: string) => p !== filePath);
                // Remove empty entries
                if (settings.pinnedNotes[folderPath].length === 0) {
                    delete settings.pinnedNotes[folderPath];
                }
            } else {
                // Pin
                settings.pinnedNotes[folderPath] = [...currentPinned, filePath];
            }
        });
    }

    /**
     * Checks if a note is pinned in a folder
     * @param folderPath - Path of the containing folder
     * @param filePath - Path of the file to check
     * @returns True if the note is pinned
     */
    isPinned(folderPath: string, filePath: string): boolean {
        const pinnedNotes = this.settings.pinnedNotes?.[folderPath] || [];
        return pinnedNotes.includes(filePath);
    }

    /**
     * Gets all pinned notes for a folder
     * @param folderPath - Path of the folder
     * @returns Array of pinned file paths
     */
    getPinnedNotes(folderPath: string): string[] {
        return this.settings.pinnedNotes?.[folderPath] || [];
    }

    // ========== Rename and Delete Handlers ==========

    /**
     * Generic handler for entity rename operations
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param oldPath - Previous entity path
     * @param newPath - New entity path
     */
    private async handleEntityRename(entityType: EntityType, oldPath: string, newPath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (entityType === ItemType.FOLDER) {
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
            } else {
                // Handle tag rename
                // Ensure all metadata objects exist
                if (!settings.tagColors) settings.tagColors = {};
                if (!settings.tagIcons) settings.tagIcons = {};
                if (!settings.tagSortOverrides) settings.tagSortOverrides = {};

                // Update direct tag metadata
                if (settings.tagColors[oldPath]) {
                    settings.tagColors[newPath] = settings.tagColors[oldPath];
                    delete settings.tagColors[oldPath];
                }
                if (settings.tagIcons[oldPath]) {
                    settings.tagIcons[newPath] = settings.tagIcons[oldPath];
                    delete settings.tagIcons[oldPath];
                }
                if (settings.tagSortOverrides[oldPath]) {
                    settings.tagSortOverrides[newPath] = settings.tagSortOverrides[oldPath];
                    delete settings.tagSortOverrides[oldPath];
                }

                // Handle nested tags
                const oldPathPrefix = oldPath + '/';
                
                // Update nested tag colors
                const colorsToUpdate: Array<{oldPath: string, newPath: string, color: string}> = [];
                for (const path in settings.tagColors) {
                    if (path.startsWith(oldPathPrefix)) {
                        const newNestedPath = newPath + path.substring(oldPath.length);
                        colorsToUpdate.push({
                            oldPath: path,
                            newPath: newNestedPath,
                            color: settings.tagColors[path]
                        });
                    }
                }
                for (const update of colorsToUpdate) {
                    settings.tagColors[update.newPath] = update.color;
                    delete settings.tagColors[update.oldPath];
                }

                // Update nested tag icons
                const iconsToUpdate: Array<{oldPath: string, newPath: string, icon: string}> = [];
                for (const path in settings.tagIcons) {
                    if (path.startsWith(oldPathPrefix)) {
                        const newNestedPath = newPath + path.substring(oldPath.length);
                        iconsToUpdate.push({
                            oldPath: path,
                            newPath: newNestedPath,
                            icon: settings.tagIcons[path]
                        });
                    }
                }
                for (const update of iconsToUpdate) {
                    settings.tagIcons[update.newPath] = update.icon;
                    delete settings.tagIcons[update.oldPath];
                }

                // Update nested tag sort overrides
                const sortOverridesToUpdate: Array<{oldPath: string, newPath: string, sort: SortOption}> = [];
                for (const path in settings.tagSortOverrides) {
                    if (path.startsWith(oldPathPrefix)) {
                        const newNestedPath = newPath + path.substring(oldPath.length);
                        sortOverridesToUpdate.push({
                            oldPath: path,
                            newPath: newNestedPath,
                            sort: settings.tagSortOverrides[path]
                        });
                    }
                }
                for (const update of sortOverridesToUpdate) {
                    settings.tagSortOverrides[update.newPath] = update.sort;
                    delete settings.tagSortOverrides[update.oldPath];
                }
            }
        });
    }

    /**
     * Generic handler for entity deletion
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the deleted entity
     */
    private async handleEntityDelete(entityType: EntityType, path: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            const pathPrefix = path + '/';

            if (entityType === ItemType.FOLDER) {
                // Remove folder color
                if (settings.folderColors?.[path]) {
                    delete settings.folderColors[path];
                }

                // Remove folder icon
                if (settings.folderIcons?.[path]) {
                    delete settings.folderIcons[path];
                }

                // Remove folder sort override
                if (settings.folderSortOverrides?.[path]) {
                    delete settings.folderSortOverrides[path];
                }

                // Remove pinned notes for this folder
                if (settings.pinnedNotes?.[path]) {
                    delete settings.pinnedNotes[path];
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
            } else {
                // Handle tag deletion
                // Remove tag color
                if (settings.tagColors?.[path]) {
                    delete settings.tagColors[path];
                }

                // Remove tag icon
                if (settings.tagIcons?.[path]) {
                    delete settings.tagIcons[path];
                }

                // Remove tag sort override
                if (settings.tagSortOverrides?.[path]) {
                    delete settings.tagSortOverrides[path];
                }

                // Clean up nested tags
                if (settings.tagColors) {
                    for (const nestedPath in settings.tagColors) {
                        if (nestedPath.startsWith(pathPrefix)) {
                            delete settings.tagColors[nestedPath];
                        }
                    }
                }

                if (settings.tagIcons) {
                    for (const nestedPath in settings.tagIcons) {
                        if (nestedPath.startsWith(pathPrefix)) {
                            delete settings.tagIcons[nestedPath];
                        }
                    }
                }

                if (settings.tagSortOverrides) {
                    for (const nestedPath in settings.tagSortOverrides) {
                        if (nestedPath.startsWith(pathPrefix)) {
                            delete settings.tagSortOverrides[nestedPath];
                        }
                    }
                }
            }
        });
    }

    /**
     * Handles tag rename by updating all associated metadata
     * @param oldPath - Previous tag path (without #)
     * @param newPath - New tag path (without #)
     */
    async handleTagRename(oldPath: string, newPath: string): Promise<void> {
        return this.handleEntityRename('tag', oldPath, newPath);
    }

    /**
     * Handles tag deletion by removing all associated metadata
     * @param tagPath - Path of the deleted tag (without #)
     */
    async handleTagDelete(tagPath: string): Promise<void> {
        return this.handleEntityDelete('tag', tagPath);
    }

    /**
     * Handles folder rename by updating all associated metadata
     * @param oldPath - Previous folder path
     * @param newPath - New folder path
     */
    async handleFolderRename(oldPath: string, newPath: string): Promise<void> {
        return this.handleEntityRename('folder', oldPath, newPath);
    }

    /**
     * Handles folder deletion by removing all associated metadata
     * @param folderPath - Path of the deleted folder
     */
    async handleFolderDelete(folderPath: string): Promise<void> {
        return this.handleEntityDelete('folder', folderPath);
    }

    // ========== Cleanup Operations ==========

    /**
     * Comprehensive cleanup of all metadata on plugin startup
     * Removes references to deleted files and folders from all settings
     * @returns True if any changes were made
     */
    async cleanupAllMetadata(): Promise<boolean> {
        let hasChanges = false;
        
        // First check if any cleanup is needed
        const checkAndClean = (settings: NotebookNavigatorSettings) => {
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

            // Clean up pinned notes
            if (settings.pinnedNotes) {
                for (const folderPath in settings.pinnedNotes) {
                    const filePaths = settings.pinnedNotes[folderPath];
                    if (!Array.isArray(filePaths)) {
                        // Remove invalid entry
                        delete settings.pinnedNotes[folderPath];
                        hasChanges = true;
                        continue;
                    }
                    
                    const validFiles = filePaths.filter((filePath: string) => {
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        return file instanceof TFile;
                    });

                    if (validFiles.length !== filePaths.length) {
                        settings.pinnedNotes[folderPath] = validFiles;
                        hasChanges = true;
                    }

                    // Remove empty entries
                    if (validFiles.length === 0) {
                        delete settings.pinnedNotes[folderPath];
                        hasChanges = true;
                    }
                }
            }
        };
        
        // Run the cleanup check
        checkAndClean(this.settings);
        
        // Only save if changes were made
        if (hasChanges) {
            await this.saveAndUpdate(checkAndClean);
        }
        
        return hasChanges;
    }

    /**
     * Handles file deletion by removing it from pinned notes
     * @param filePath - Path of the deleted file
     */
    async handleFileDelete(filePath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            // Remove file from pinned notes in all folders
            if (settings.pinnedNotes) {
                for (const folderPath in settings.pinnedNotes) {
                    const pinnedFiles = settings.pinnedNotes[folderPath];
                    const index = pinnedFiles.indexOf(filePath);
                    if (index > -1) {
                        pinnedFiles.splice(index, 1);

                        // Remove the folder entry if no more pinned files
                        if (pinnedFiles.length === 0) {
                            delete settings.pinnedNotes[folderPath];
                        }
                    }
                }
            }
        });
    }
}