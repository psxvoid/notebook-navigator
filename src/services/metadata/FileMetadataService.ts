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
import { PinnedNote, PinContext, ItemType } from '../../types';

/**
 * Service for managing file-specific metadata operations
 * Handles pinned notes and file-related cleanup operations
 */
export class FileMetadataService extends BaseMetadataService {
    /**
     * Toggles the pinned state of a note in a specific context
     * @param filePath - Path of the file to pin/unpin
     * @param context - Context to toggle (ItemType.FOLDER or ItemType.TAG)
     */
    async togglePinnedNote(filePath: string, context: PinContext): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (!settings.pinnedNotes) {
                settings.pinnedNotes = [];
            }

            // Find existing pinned note
            const existingIndex = settings.pinnedNotes.findIndex((p: PinnedNote) => p.path === filePath);

            if (existingIndex >= 0) {
                // Note exists, toggle the specific context
                const pinnedNote = settings.pinnedNotes[existingIndex];
                pinnedNote.context[context] = !pinnedNote.context[context];

                // If both contexts are false, remove the note
                if (!pinnedNote.context[ItemType.FOLDER] && !pinnedNote.context[ItemType.TAG]) {
                    settings.pinnedNotes.splice(existingIndex, 1);
                }
            } else {
                // Note doesn't exist, create new with specified context
                const newPinnedNote: PinnedNote = {
                    path: filePath,
                    context: {
                        [ItemType.FOLDER]: context === ItemType.FOLDER,
                        [ItemType.TAG]: context === ItemType.TAG
                    }
                };
                settings.pinnedNotes.push(newPinnedNote);
            }
        });
    }

    /**
     * Checks if a note is pinned
     * @param filePath - Path of the file to check
     * @param context - Optional context to check (ItemType.FOLDER or ItemType.TAG)
     * @returns True if the note is pinned (in any context or specified context)
     */
    isPinned(filePath: string, context?: PinContext): boolean {
        const pinnedNotes = this.settingsProvider.settings.pinnedNotes || [];
        const pinnedNote = pinnedNotes.find((p: PinnedNote) => p.path === filePath);

        if (!pinnedNote) return false;

        // If no context specified, check if pinned in any context
        if (!context) {
            return pinnedNote.context[ItemType.FOLDER] || pinnedNote.context[ItemType.TAG] || false;
        }

        // Check specific context
        return pinnedNote.context[context] || false;
    }

    /**
     * Gets all pinned notes
     * @param context - Optional context filter (ItemType.FOLDER or ItemType.TAG)
     * @returns Array of pinned file paths
     */
    getPinnedNotes(context?: PinContext): string[] {
        const pinnedNotes = this.settingsProvider.settings.pinnedNotes || [];

        if (!context) {
            // Return all pinned paths
            return pinnedNotes.map((p: PinnedNote) => p.path);
        }

        // Return paths pinned in specific context
        return pinnedNotes.filter((p: PinnedNote) => p.context[context]).map((p: PinnedNote) => p.path);
    }

    /**
     * Handles file deletion by removing it from pinned notes
     * @param filePath - Path of the deleted file
     */
    async handleFileDelete(filePath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes) {
                const index = settings.pinnedNotes.findIndex((p: PinnedNote) => p.path === filePath);
                if (index >= 0) {
                    settings.pinnedNotes.splice(index, 1);
                }
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
                const pinnedNote = settings.pinnedNotes.find((p: PinnedNote) => p.path === oldPath);
                if (pinnedNote) {
                    pinnedNote.path = newPath;
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
                const validNotes = settings.pinnedNotes.filter((note: PinnedNote) => validators.vaultFiles.has(note.path));

                if (validNotes.length !== settings.pinnedNotes.length) {
                    settings.pinnedNotes = validNotes;
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
