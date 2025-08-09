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

import { BaseMetadataService } from './BaseMetadataService';
import type { CleanupValidators } from '../MetadataService';

/**
 * Service for managing file-specific metadata operations
 * Handles pinned notes and file-related cleanup operations
 */
export class FileMetadataService extends BaseMetadataService {
    /**
     * Toggles the pinned state of a note
     * @param filePath - Path of the file to pin/unpin
     */
    async togglePinnedNote(filePath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (!settings.pinnedNotes) {
                settings.pinnedNotes = [];
            }

            const isPinned = settings.pinnedNotes.includes(filePath);

            if (isPinned) {
                settings.pinnedNotes = settings.pinnedNotes.filter((p: string) => p !== filePath);
            } else {
                settings.pinnedNotes = [...settings.pinnedNotes, filePath];
            }
        });
    }

    /**
     * Checks if a note is pinned
     * @param filePath - Path of the file to check
     * @returns True if the note is pinned
     */
    isPinned(filePath: string): boolean {
        const pinnedNotes = this.settingsProvider.settings.pinnedNotes || [];
        return pinnedNotes.includes(filePath);
    }

    /**
     * Gets all pinned notes
     * @returns Array of pinned file paths
     */
    getPinnedNotes(): string[] {
        return this.settingsProvider.settings.pinnedNotes || [];
    }

    /**
     * Handles file deletion by removing it from pinned notes
     * @param filePath - Path of the deleted file
     */
    async handleFileDelete(filePath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes && settings.pinnedNotes.includes(filePath)) {
                settings.pinnedNotes = settings.pinnedNotes.filter((p: string) => p !== filePath);
            }
        });
    }

    /**
     * Handles file rename by updating pinned notes
     * @param oldPath - Original file path
     * @param newPath - New file path
     */
    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes) {
                const index = settings.pinnedNotes.indexOf(oldPath);
                if (index > -1) {
                    settings.pinnedNotes[index] = newPath;
                }
            }
        });
    }

    /**
     * Clean up pinned notes using pre-loaded validators
     * @param validators - Pre-loaded data containing vault files
     * @returns True if any metadata was removed/changed
     */
    async cleanupWithValidators(validators: CleanupValidators): Promise<boolean> {
        let hasChanges = false;

        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes && Array.isArray(settings.pinnedNotes)) {
                const validFiles = settings.pinnedNotes.filter((filePath: string) => validators.vaultFiles.has(filePath));

                if (validFiles.length !== settings.pinnedNotes.length) {
                    settings.pinnedNotes = validFiles;
                    hasChanges = true;
                }
            } else if (!settings.pinnedNotes) {
                settings.pinnedNotes = [];
                hasChanges = true;
            }
        });

        return hasChanges;
    }

    /**
     * Clean up pinned notes for files that don't exist
     * @returns True if any changes were made
     */
    async cleanupPinnedNotes(): Promise<boolean> {
        const vaultFiles = new Set(this.app.vault.getMarkdownFiles().map(f => f.path));
        return this.cleanupWithValidators({
            vaultFiles,
            vaultFolders: new Set(),
            dbFiles: [],
            tagTree: new Map()
        });
    }
}
