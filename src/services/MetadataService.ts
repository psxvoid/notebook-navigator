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

import { App, TFile, TFolder } from 'obsidian';
import { NotebookNavigatorSettings, SortOption } from '../settings';

/**
 * Service for managing all folder and file metadata operations
 * Centralizes handling of folder colors, icons, sort overrides, and pinned notes
 * Provides cleanup operations for deleted files/folders
 */
export class MetadataService {
    private app: App;
    
    /**
     * Creates a new MetadataService instance
     * @param plugin - The plugin instance for accessing settings and saving
     */
    constructor(
        private plugin: any // Using 'any' to avoid circular dependency with NotebookNavigatorPlugin
    ) {
        this.app = plugin.app;
    }
    
    /**
     * Saves settings and triggers UI update
     * Uses the plugin's settings updater if available
     */
    private async saveAndUpdate(): Promise<void> {
        await this.plugin.saveSettings();
    }

    // ========== Folder Color Management ==========

    /**
     * Sets a custom color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderColor(folderPath: string, color: string): Promise<void> {
        if (!this.plugin.settings.folderColors) {
            this.plugin.settings.folderColors = {};
        }
        this.plugin.settings.folderColors[folderPath] = color;
        await this.saveAndUpdate();
    }

    /**
     * Removes the custom color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderColor(folderPath: string): Promise<void> {
        if (this.plugin.settings.folderColors && this.plugin.settings.folderColors[folderPath]) {
            delete this.plugin.settings.folderColors[folderPath];
            await this.saveAndUpdate();
        }
    }

    /**
     * Gets the custom color for a folder
     * @param folderPath - Path of the folder
     * @returns The color value or undefined
     */
    getFolderColor(folderPath: string): string | undefined {
        return this.plugin.settings.folderColors?.[folderPath];
    }

    // ========== Folder Icon Management ==========

    /**
     * Sets a custom icon for a folder
     * @param folderPath - Path of the folder
     * @param iconId - Lucide icon identifier
     */
    async setFolderIcon(folderPath: string, iconId: string): Promise<void> {
        if (!this.plugin.settings.folderIcons) {
            this.plugin.settings.folderIcons = {};
        }
        this.plugin.settings.folderIcons[folderPath] = iconId;
        
        // Update recently used icons
        if (!this.plugin.settings.recentlyUsedIcons) {
            this.plugin.settings.recentlyUsedIcons = [];
        }
        
        // Remove if already exists and add to front
        this.plugin.settings.recentlyUsedIcons = [
            iconId,
            ...this.plugin.settings.recentlyUsedIcons.filter((id: string) => id !== iconId)
        ].slice(0, 10); // Keep only 10 most recent
        
        await this.saveAndUpdate();
    }

    /**
     * Removes the custom icon from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderIcon(folderPath: string): Promise<void> {
        if (this.plugin.settings.folderIcons && this.plugin.settings.folderIcons[folderPath]) {
            delete this.plugin.settings.folderIcons[folderPath];
            await this.saveAndUpdate();
        }
    }

    /**
     * Gets the custom icon for a folder
     * @param folderPath - Path of the folder
     * @returns The icon ID or undefined
     */
    getFolderIcon(folderPath: string): string | undefined {
        return this.plugin.settings.folderIcons?.[folderPath];
    }

    // ========== Folder Sort Override Management ==========

    /**
     * Sets a custom sort order for a folder
     * @param folderPath - Path of the folder
     * @param sortOption - Sort option to apply
     */
    async setFolderSortOverride(folderPath: string, sortOption: SortOption): Promise<void> {
        if (!this.plugin.settings.folderSortOverrides) {
            this.plugin.settings.folderSortOverrides = {};
        }
        this.plugin.settings.folderSortOverrides[folderPath] = sortOption;
        await this.saveAndUpdate();
    }

    /**
     * Removes the custom sort order from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderSortOverride(folderPath: string): Promise<void> {
        if (this.plugin.settings.folderSortOverrides && this.plugin.settings.folderSortOverrides[folderPath]) {
            delete this.plugin.settings.folderSortOverrides[folderPath];
            await this.saveAndUpdate();
        }
    }

    /**
     * Gets the sort override for a folder
     * @param folderPath - Path of the folder
     * @returns The sort option or undefined
     */
    getFolderSortOverride(folderPath: string): SortOption | undefined {
        return this.plugin.settings.folderSortOverrides?.[folderPath];
    }

    // ========== Pinned Notes Management ==========

    /**
     * Toggles the pinned state of a note in a folder
     * @param folderPath - Path of the containing folder
     * @param filePath - Path of the file to pin/unpin
     */
    async togglePinnedNote(folderPath: string, filePath: string): Promise<void> {
        if (!this.plugin.settings.pinnedNotes) {
            this.plugin.settings.pinnedNotes = {};
        }

        const currentPinned = this.plugin.settings.pinnedNotes[folderPath] || [];
        const isPinned = currentPinned.includes(filePath);

        if (isPinned) {
            // Unpin
            this.plugin.settings.pinnedNotes[folderPath] = currentPinned.filter((p: string) => p !== filePath);
            // Remove empty entries
            if (this.plugin.settings.pinnedNotes[folderPath].length === 0) {
                delete this.plugin.settings.pinnedNotes[folderPath];
            }
        } else {
            // Pin
            this.plugin.settings.pinnedNotes[folderPath] = [...currentPinned, filePath];
        }

        await this.saveAndUpdate();
    }

    /**
     * Checks if a note is pinned in a folder
     * @param folderPath - Path of the containing folder
     * @param filePath - Path of the file to check
     * @returns True if the note is pinned
     */
    isPinned(folderPath: string, filePath: string): boolean {
        const pinnedNotes = this.plugin.settings.pinnedNotes?.[folderPath] || [];
        return pinnedNotes.includes(filePath);
    }

    /**
     * Gets all pinned notes for a folder
     * @param folderPath - Path of the folder
     * @returns Array of pinned file paths
     */
    getPinnedNotes(folderPath: string): string[] {
        return this.plugin.settings.pinnedNotes?.[folderPath] || [];
    }

    // ========== Cleanup Operations ==========

    /**
     * Comprehensive cleanup of all metadata on plugin startup
     * Removes references to deleted files and folders from all settings
     */
    async cleanupAllMetadata(): Promise<void> {
        let hasChanges = false;

        // Clean up folder colors
        if (this.plugin.settings.folderColors) {
            for (const folderPath in this.plugin.settings.folderColors) {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!(folder instanceof TFolder)) {
                    delete this.plugin.settings.folderColors[folderPath];
                    hasChanges = true;
                }
            }
        }

        // Clean up folder icons
        if (this.plugin.settings.folderIcons) {
            for (const folderPath in this.plugin.settings.folderIcons) {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!(folder instanceof TFolder)) {
                    delete this.plugin.settings.folderIcons[folderPath];
                    hasChanges = true;
                }
            }
        }

        // Clean up folder sort overrides
        if (this.plugin.settings.folderSortOverrides) {
            for (const folderPath in this.plugin.settings.folderSortOverrides) {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!(folder instanceof TFolder)) {
                    delete this.plugin.settings.folderSortOverrides[folderPath];
                    hasChanges = true;
                }
            }
        }

        // Clean up pinned notes
        if (this.plugin.settings.pinnedNotes) {
            for (const folderPath in this.plugin.settings.pinnedNotes) {
                const filePaths = this.plugin.settings.pinnedNotes[folderPath];
                const validFiles = filePaths.filter((filePath: string) => {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    return file instanceof TFile;
                });

                if (validFiles.length !== filePaths.length) {
                    this.plugin.settings.pinnedNotes[folderPath] = validFiles;
                    hasChanges = true;
                }

                // Remove empty entries
                if (validFiles.length === 0) {
                    delete this.plugin.settings.pinnedNotes[folderPath];
                    hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            await this.saveAndUpdate();
        }
    }

    /**
     * Handles folder rename by updating all associated metadata
     * @param oldPath - Previous folder path
     * @param newPath - New folder path
     */
    async handleFolderRename(oldPath: string, newPath: string): Promise<void> {
        let hasChanges = false;

        // Ensure all metadata objects exist
        if (!this.plugin.settings.folderColors) this.plugin.settings.folderColors = {};
        if (!this.plugin.settings.folderIcons) this.plugin.settings.folderIcons = {};
        if (!this.plugin.settings.folderSortOverrides) this.plugin.settings.folderSortOverrides = {};
        if (!this.plugin.settings.pinnedNotes) this.plugin.settings.pinnedNotes = {};

        // Update direct folder color
        if (this.plugin.settings.folderColors[oldPath]) {
            this.plugin.settings.folderColors[newPath] = this.plugin.settings.folderColors[oldPath];
            delete this.plugin.settings.folderColors[oldPath];
            hasChanges = true;
        }

        // Update direct folder icon
        if (this.plugin.settings.folderIcons[oldPath]) {
            this.plugin.settings.folderIcons[newPath] = this.plugin.settings.folderIcons[oldPath];
            delete this.plugin.settings.folderIcons[oldPath];
            hasChanges = true;
        }

        // Update direct folder sort override
        if (this.plugin.settings.folderSortOverrides[oldPath]) {
            this.plugin.settings.folderSortOverrides[newPath] = this.plugin.settings.folderSortOverrides[oldPath];
            delete this.plugin.settings.folderSortOverrides[oldPath];
            hasChanges = true;
        }

        // Handle nested folders
        const oldPathPrefix = oldPath + '/';
        
        // Update nested folder colors
        const colorsToUpdate: Array<{oldPath: string, newPath: string, color: string}> = [];
        for (const path in this.plugin.settings.folderColors) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                colorsToUpdate.push({
                    oldPath: path,
                    newPath: newNestedPath,
                    color: this.plugin.settings.folderColors[path]
                });
            }
        }
        
        for (const update of colorsToUpdate) {
            this.plugin.settings.folderColors[update.newPath] = update.color;
            delete this.plugin.settings.folderColors[update.oldPath];
            hasChanges = true;
        }

        // Update nested folder icons
        const iconsToUpdate: Array<{oldPath: string, newPath: string, icon: string}> = [];
        for (const path in this.plugin.settings.folderIcons) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                iconsToUpdate.push({
                    oldPath: path,
                    newPath: newNestedPath,
                    icon: this.plugin.settings.folderIcons[path]
                });
            }
        }
        
        for (const update of iconsToUpdate) {
            this.plugin.settings.folderIcons[update.newPath] = update.icon;
            delete this.plugin.settings.folderIcons[update.oldPath];
            hasChanges = true;
        }

        // Update nested folder sort overrides
        const sortOverridesToUpdate: Array<{oldPath: string, newPath: string, sort: SortOption}> = [];
        for (const path in this.plugin.settings.folderSortOverrides) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                sortOverridesToUpdate.push({
                    oldPath: path,
                    newPath: newNestedPath,
                    sort: this.plugin.settings.folderSortOverrides[path]
                });
            }
        }
        
        for (const update of sortOverridesToUpdate) {
            this.plugin.settings.folderSortOverrides[update.newPath] = update.sort;
            delete this.plugin.settings.folderSortOverrides[update.oldPath];
            hasChanges = true;
        }

        // Update pinned notes for the renamed folder and its subfolders
        const pinnedNotesToUpdate: Array<{oldPath: string, newPath: string, notes: string[]}> = [];
        
        // Handle direct folder pinned notes
        if (this.plugin.settings.pinnedNotes[oldPath]) {
            const updatedNotes = this.plugin.settings.pinnedNotes[oldPath].map((notePath: string) => {
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
        for (const path in this.plugin.settings.pinnedNotes) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                const updatedNotes = this.plugin.settings.pinnedNotes[path].map((notePath: string) => {
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
            this.plugin.settings.pinnedNotes[update.newPath] = update.notes;
            delete this.plugin.settings.pinnedNotes[update.oldPath];
            hasChanges = true;
        }

        if (hasChanges) {
            await this.saveAndUpdate();
        }
    }

    /**
     * Handles folder deletion by removing all associated metadata
     * @param folderPath - Path of the deleted folder
     */
    async handleFolderDelete(folderPath: string): Promise<void> {
        let hasChanges = false;

        // Remove folder color
        if (this.plugin.settings.folderColors?.[folderPath]) {
            delete this.plugin.settings.folderColors[folderPath];
            hasChanges = true;
        }

        // Remove folder icon
        if (this.plugin.settings.folderIcons?.[folderPath]) {
            delete this.plugin.settings.folderIcons[folderPath];
            hasChanges = true;
        }

        // Remove folder sort override
        if (this.plugin.settings.folderSortOverrides?.[folderPath]) {
            delete this.plugin.settings.folderSortOverrides[folderPath];
            hasChanges = true;
        }

        // Remove pinned notes for this folder
        if (this.plugin.settings.pinnedNotes?.[folderPath]) {
            delete this.plugin.settings.pinnedNotes[folderPath];
            hasChanges = true;
        }

        // Clean up nested folders
        const folderPrefix = folderPath + '/';

        // Clean up nested folder colors
        if (this.plugin.settings.folderColors) {
            for (const path in this.plugin.settings.folderColors) {
                if (path.startsWith(folderPrefix)) {
                    delete this.plugin.settings.folderColors[path];
                    hasChanges = true;
                }
            }
        }

        // Clean up nested folder icons
        if (this.plugin.settings.folderIcons) {
            for (const path in this.plugin.settings.folderIcons) {
                if (path.startsWith(folderPrefix)) {
                    delete this.plugin.settings.folderIcons[path];
                    hasChanges = true;
                }
            }
        }

        // Clean up nested folder sort overrides
        if (this.plugin.settings.folderSortOverrides) {
            for (const path in this.plugin.settings.folderSortOverrides) {
                if (path.startsWith(folderPrefix)) {
                    delete this.plugin.settings.folderSortOverrides[path];
                    hasChanges = true;
                }
            }
        }

        // Clean up pinned notes for nested folders
        if (this.plugin.settings.pinnedNotes) {
            for (const path in this.plugin.settings.pinnedNotes) {
                if (path.startsWith(folderPrefix)) {
                    delete this.plugin.settings.pinnedNotes[path];
                    hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            await this.saveAndUpdate();
        }
    }

    /**
     * Handles file deletion by removing it from pinned notes
     * @param filePath - Path of the deleted file
     */
    async handleFileDelete(filePath: string): Promise<void> {
        let hasChanges = false;

        // Remove file from pinned notes in all folders
        if (this.plugin.settings.pinnedNotes) {
            for (const folderPath in this.plugin.settings.pinnedNotes) {
                const pinnedFiles = this.plugin.settings.pinnedNotes[folderPath];
                const index = pinnedFiles.indexOf(filePath);
                if (index > -1) {
                    pinnedFiles.splice(index, 1);
                    hasChanges = true;

                    // Remove the folder entry if no more pinned files
                    if (pinnedFiles.length === 0) {
                        delete this.plugin.settings.pinnedNotes[folderPath];
                    }
                }
            }
        }

        if (hasChanges) {
            await this.saveAndUpdate();
        }
    }
}