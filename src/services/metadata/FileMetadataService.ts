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

import { TFile } from 'obsidian';
import { BaseMetadataService } from './BaseMetadataService';

/**
 * Service for managing file-specific metadata operations
 * Handles pinned notes and file-related cleanup operations
 */
export class FileMetadataService extends BaseMetadataService {
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

    /**
     * Handles file rename by updating pinned notes
     * @param oldPath - Previous file path
     * @param newPath - New file path
     */
    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes) {
                for (const folderPath in settings.pinnedNotes) {
                    const pinnedFiles = settings.pinnedNotes[folderPath];
                    const index = pinnedFiles.indexOf(oldPath);
                    if (index > -1) {
                        pinnedFiles[index] = newPath;
                    }
                }
            }
        });
    }

    /**
     * Clean up pinned notes for non-existent files
     * @returns True if any changes were made
     */
    async cleanupPinnedNotes(): Promise<boolean> {
        let hasChanges = false;

        await this.saveAndUpdate(settings => {
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
        });

        return hasChanges;
    }
}
