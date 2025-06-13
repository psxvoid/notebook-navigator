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
    /**
     * Creates a new MetadataService instance
     * @param app - The Obsidian app instance for vault operations
     * @param settings - Plugin settings containing metadata
     * @param saveSettings - Function to persist settings changes
     */
    constructor(
        private app: App,
        private settings: NotebookNavigatorSettings,
        private saveSettings: () => Promise<void>
    ) {}

    // ========== Folder Color Management ==========

    /**
     * Sets a custom color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderColor(folderPath: string, color: string): Promise<void> {
        if (!this.settings.folderColors) {
            this.settings.folderColors = {};
        }
        this.settings.folderColors[folderPath] = color;
        await this.saveSettings();
    }

    /**
     * Removes the custom color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderColor(folderPath: string): Promise<void> {
        if (this.settings.folderColors && this.settings.folderColors[folderPath]) {
            delete this.settings.folderColors[folderPath];
            await this.saveSettings();
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
        if (!this.settings.folderIcons) {
            this.settings.folderIcons = {};
        }
        this.settings.folderIcons[folderPath] = iconId;
        
        // Update recently used icons
        if (!this.settings.recentlyUsedIcons) {
            this.settings.recentlyUsedIcons = [];
        }
        
        // Remove if already exists and add to front
        this.settings.recentlyUsedIcons = [
            iconId,
            ...this.settings.recentlyUsedIcons.filter(id => id !== iconId)
        ].slice(0, 10); // Keep only 10 most recent
        
        await this.saveSettings();
    }

    /**
     * Removes the custom icon from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderIcon(folderPath: string): Promise<void> {
        if (this.settings.folderIcons && this.settings.folderIcons[folderPath]) {
            delete this.settings.folderIcons[folderPath];
            await this.saveSettings();
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
        if (!this.settings.folderSortOverrides) {
            this.settings.folderSortOverrides = {};
        }
        this.settings.folderSortOverrides[folderPath] = sortOption;
        await this.saveSettings();
    }

    /**
     * Removes the custom sort order from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderSortOverride(folderPath: string): Promise<void> {
        if (this.settings.folderSortOverrides && this.settings.folderSortOverrides[folderPath]) {
            delete this.settings.folderSortOverrides[folderPath];
            await this.saveSettings();
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
        if (!this.settings.pinnedNotes) {
            this.settings.pinnedNotes = {};
        }

        const currentPinned = this.settings.pinnedNotes[folderPath] || [];
        const isPinned = currentPinned.includes(filePath);

        if (isPinned) {
            // Unpin
            this.settings.pinnedNotes[folderPath] = currentPinned.filter(p => p !== filePath);
            // Remove empty entries
            if (this.settings.pinnedNotes[folderPath].length === 0) {
                delete this.settings.pinnedNotes[folderPath];
            }
        } else {
            // Pin
            this.settings.pinnedNotes[folderPath] = [...currentPinned, filePath];
        }

        await this.saveSettings();
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
     */
    async cleanupAllMetadata(): Promise<void> {
        let hasChanges = false;

        // Clean up folder colors
        if (this.settings.folderColors) {
            for (const folderPath in this.settings.folderColors) {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!(folder instanceof TFolder)) {
                    delete this.settings.folderColors[folderPath];
                    hasChanges = true;
                }
            }
        }

        // Clean up folder icons
        if (this.settings.folderIcons) {
            for (const folderPath in this.settings.folderIcons) {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!(folder instanceof TFolder)) {
                    delete this.settings.folderIcons[folderPath];
                    hasChanges = true;
                }
            }
        }

        // Clean up folder sort overrides
        if (this.settings.folderSortOverrides) {
            for (const folderPath in this.settings.folderSortOverrides) {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!(folder instanceof TFolder)) {
                    delete this.settings.folderSortOverrides[folderPath];
                    hasChanges = true;
                }
            }
        }

        // Clean up pinned notes
        if (this.settings.pinnedNotes) {
            for (const folderPath in this.settings.pinnedNotes) {
                const filePaths = this.settings.pinnedNotes[folderPath];
                const validFiles = filePaths.filter(filePath => {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    return file instanceof TFile;
                });

                if (validFiles.length !== filePaths.length) {
                    this.settings.pinnedNotes[folderPath] = validFiles;
                    hasChanges = true;
                }

                // Remove empty entries
                if (validFiles.length === 0) {
                    delete this.settings.pinnedNotes[folderPath];
                    hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            await this.saveSettings();
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
        if (!this.settings.folderColors) this.settings.folderColors = {};
        if (!this.settings.folderIcons) this.settings.folderIcons = {};
        if (!this.settings.folderSortOverrides) this.settings.folderSortOverrides = {};
        if (!this.settings.pinnedNotes) this.settings.pinnedNotes = {};

        // Update direct folder color
        if (this.settings.folderColors[oldPath]) {
            this.settings.folderColors[newPath] = this.settings.folderColors[oldPath];
            delete this.settings.folderColors[oldPath];
            hasChanges = true;
        }

        // Update direct folder icon
        if (this.settings.folderIcons[oldPath]) {
            this.settings.folderIcons[newPath] = this.settings.folderIcons[oldPath];
            delete this.settings.folderIcons[oldPath];
            hasChanges = true;
        }

        // Update direct folder sort override
        if (this.settings.folderSortOverrides[oldPath]) {
            this.settings.folderSortOverrides[newPath] = this.settings.folderSortOverrides[oldPath];
            delete this.settings.folderSortOverrides[oldPath];
            hasChanges = true;
        }

        // Handle nested folders
        const oldPathPrefix = oldPath + '/';
        
        // Update nested folder colors
        const colorsToUpdate: Array<{oldPath: string, newPath: string, color: string}> = [];
        for (const path in this.settings.folderColors) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                colorsToUpdate.push({
                    oldPath: path,
                    newPath: newNestedPath,
                    color: this.settings.folderColors[path]
                });
            }
        }
        
        for (const update of colorsToUpdate) {
            this.settings.folderColors[update.newPath] = update.color;
            delete this.settings.folderColors[update.oldPath];
            hasChanges = true;
        }

        // Update nested folder icons
        const iconsToUpdate: Array<{oldPath: string, newPath: string, icon: string}> = [];
        for (const path in this.settings.folderIcons) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                iconsToUpdate.push({
                    oldPath: path,
                    newPath: newNestedPath,
                    icon: this.settings.folderIcons[path]
                });
            }
        }
        
        for (const update of iconsToUpdate) {
            this.settings.folderIcons[update.newPath] = update.icon;
            delete this.settings.folderIcons[update.oldPath];
            hasChanges = true;
        }

        // Update nested folder sort overrides
        const sortOverridesToUpdate: Array<{oldPath: string, newPath: string, sort: SortOption}> = [];
        for (const path in this.settings.folderSortOverrides) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                sortOverridesToUpdate.push({
                    oldPath: path,
                    newPath: newNestedPath,
                    sort: this.settings.folderSortOverrides[path]
                });
            }
        }
        
        for (const update of sortOverridesToUpdate) {
            this.settings.folderSortOverrides[update.newPath] = update.sort;
            delete this.settings.folderSortOverrides[update.oldPath];
            hasChanges = true;
        }

        // Update pinned notes for the renamed folder and its subfolders
        const pinnedNotesToUpdate: Array<{oldPath: string, newPath: string, notes: string[]}> = [];
        
        // Handle direct folder pinned notes
        if (this.settings.pinnedNotes[oldPath]) {
            const updatedNotes = this.settings.pinnedNotes[oldPath].map(notePath => {
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
        for (const path in this.settings.pinnedNotes) {
            if (path.startsWith(oldPathPrefix)) {
                const newNestedPath = newPath + path.substring(oldPath.length);
                const updatedNotes = this.settings.pinnedNotes[path].map(notePath => {
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
            this.settings.pinnedNotes[update.newPath] = update.notes;
            delete this.settings.pinnedNotes[update.oldPath];
            hasChanges = true;
        }

        if (hasChanges) {
            await this.saveSettings();
        }
    }

    /**
     * Handles folder deletion by removing all associated metadata
     * @param folderPath - Path of the deleted folder
     */
    async handleFolderDelete(folderPath: string): Promise<void> {
        let hasChanges = false;

        // Remove folder color
        if (this.settings.folderColors?.[folderPath]) {
            delete this.settings.folderColors[folderPath];
            hasChanges = true;
        }

        // Remove folder icon
        if (this.settings.folderIcons?.[folderPath]) {
            delete this.settings.folderIcons[folderPath];
            hasChanges = true;
        }

        // Remove folder sort override
        if (this.settings.folderSortOverrides?.[folderPath]) {
            delete this.settings.folderSortOverrides[folderPath];
            hasChanges = true;
        }

        // Remove pinned notes for this folder
        if (this.settings.pinnedNotes?.[folderPath]) {
            delete this.settings.pinnedNotes[folderPath];
            hasChanges = true;
        }

        // Clean up nested folders
        const folderPrefix = folderPath + '/';

        // Clean up nested folder colors
        if (this.settings.folderColors) {
            for (const path in this.settings.folderColors) {
                if (path.startsWith(folderPrefix)) {
                    delete this.settings.folderColors[path];
                    hasChanges = true;
                }
            }
        }

        // Clean up nested folder icons
        if (this.settings.folderIcons) {
            for (const path in this.settings.folderIcons) {
                if (path.startsWith(folderPrefix)) {
                    delete this.settings.folderIcons[path];
                    hasChanges = true;
                }
            }
        }

        // Clean up nested folder sort overrides
        if (this.settings.folderSortOverrides) {
            for (const path in this.settings.folderSortOverrides) {
                if (path.startsWith(folderPrefix)) {
                    delete this.settings.folderSortOverrides[path];
                    hasChanges = true;
                }
            }
        }

        // Clean up pinned notes for nested folders
        if (this.settings.pinnedNotes) {
            for (const path in this.settings.pinnedNotes) {
                if (path.startsWith(folderPrefix)) {
                    delete this.settings.pinnedNotes[path];
                    hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            await this.saveSettings();
        }
    }

    /**
     * Handles file deletion by removing it from pinned notes
     * @param filePath - Path of the deleted file
     */
    async handleFileDelete(filePath: string): Promise<void> {
        let hasChanges = false;

        // Remove file from pinned notes in all folders
        if (this.settings.pinnedNotes) {
            for (const folderPath in this.settings.pinnedNotes) {
                const pinnedFiles = this.settings.pinnedNotes[folderPath];
                const index = pinnedFiles.indexOf(filePath);
                if (index > -1) {
                    pinnedFiles.splice(index, 1);
                    hasChanges = true;

                    // Remove the folder entry if no more pinned files
                    if (pinnedFiles.length === 0) {
                        delete this.settings.pinnedNotes[folderPath];
                    }
                }
            }
        }

        if (hasChanges) {
            await this.saveSettings();
        }
    }
}