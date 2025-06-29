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

    // ========== Folder Color Management ==========

    /**
     * Sets a custom color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderColor(folderPath: string, color: string): Promise<void> {
        // Validate that the folder exists
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder || !(folder instanceof TFolder)) {
            // Cannot set color for non-existent folder
            return;
        }
        
        // Basic color validation - check if it's a valid CSS color format
        const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-zA-Z]+)$/;
        if (!colorRegex.test(color)) {
            // Invalid color format
            return;
        }
        
        await this.saveAndUpdate(settings => {
            if (!settings.folderColors) {
                settings.folderColors = {};
            }
            settings.folderColors[folderPath] = color;
        });
    }

    /**
     * Removes the custom color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderColor(folderPath: string): Promise<void> {
        if (this.settings.folderColors && this.settings.folderColors[folderPath]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderColors![folderPath];
            });
        }
    }

    /**
     * Gets the custom color for a folder
     * @param folderPath - Path of the folder
     * @returns The color value or undefined
     */
    getFolderColor(folderPath: string): string | undefined {
        return this.settings.folderColors?.[folderPath];
    }

    // ========== Folder Icon Management ==========

    /**
     * Sets a custom icon for a folder
     * @param folderPath - Path of the folder
     * @param iconId - Lucide icon identifier
     */
    async setFolderIcon(folderPath: string, iconId: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (!settings.folderIcons) {
                settings.folderIcons = {};
            }
            settings.folderIcons[folderPath] = iconId;
            
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
     * Removes the custom icon from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderIcon(folderPath: string): Promise<void> {
        if (this.settings.folderIcons && this.settings.folderIcons[folderPath]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderIcons![folderPath];
            });
        }
    }

    /**
     * Gets the custom icon for a folder
     * @param folderPath - Path of the folder
     * @returns The icon ID or undefined
     */
    getFolderIcon(folderPath: string): string | undefined {
        return this.settings.folderIcons?.[folderPath];
    }

    // ========== Folder Sort Override Management ==========

    /**
     * Sets a custom sort order for a folder
     * @param folderPath - Path of the folder
     * @param sortOption - Sort option to apply
     */
    async setFolderSortOverride(folderPath: string, sortOption: SortOption): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (!settings.folderSortOverrides) {
                settings.folderSortOverrides = {};
            }
            settings.folderSortOverrides[folderPath] = sortOption;
        });
    }

    /**
     * Removes the custom sort order from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderSortOverride(folderPath: string): Promise<void> {
        if (this.settings.folderSortOverrides && this.settings.folderSortOverrides[folderPath]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderSortOverrides![folderPath];
            });
        }
    }

    /**
     * Gets the sort override for a folder
     * @param folderPath - Path of the folder
     * @returns The sort option or undefined
     */
    getFolderSortOverride(folderPath: string): SortOption | undefined {
        return this.settings.folderSortOverrides?.[folderPath];
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

            // Update direct folder color
            if (settings.folderColors[oldPath]) {
                settings.folderColors[newPath] = settings.folderColors[oldPath];
                delete settings.folderColors[oldPath];
            }

            // Update direct folder icon
            if (settings.folderIcons[oldPath]) {
                settings.folderIcons[newPath] = settings.folderIcons[oldPath];
                delete settings.folderIcons[oldPath];
            }

            // Update direct folder sort override
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

            // Update pinned notes for the renamed folder and its subfolders
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
            const folderPrefix = folderPath + '/';

            // Clean up nested folder colors
            if (settings.folderColors) {
                for (const path in settings.folderColors) {
                    if (path.startsWith(folderPrefix)) {
                        delete settings.folderColors[path];
                    }
                }
            }

            // Clean up nested folder icons
            if (settings.folderIcons) {
                for (const path in settings.folderIcons) {
                    if (path.startsWith(folderPrefix)) {
                        delete settings.folderIcons[path];
                    }
                }
            }

            // Clean up nested folder sort overrides
            if (settings.folderSortOverrides) {
                for (const path in settings.folderSortOverrides) {
                    if (path.startsWith(folderPrefix)) {
                        delete settings.folderSortOverrides[path];
                    }
                }
            }

            // Clean up pinned notes for nested folders
            if (settings.pinnedNotes) {
                for (const path in settings.pinnedNotes) {
                    if (path.startsWith(folderPrefix)) {
                        delete settings.pinnedNotes[path];
                    }
                }
            }
        });
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