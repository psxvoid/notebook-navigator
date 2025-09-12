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
import { NavigatorContext } from '../../types';

/**
 * Service for managing file-specific metadata operations
 * Handles pinned notes and file-related cleanup operations
 */
export class FileMetadataService extends BaseMetadataService {
    /**
     * Toggles the pinned state of a note in a specific context
     * @param filePath - Path of the file to pin/unpin
     * @param context - Context to toggle ('folder' or 'tag')
     */
    async togglePinnedNote(filePath: string, context: NavigatorContext): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (!settings.pinnedNotes) {
                settings.pinnedNotes = {};
            }

            if (!settings.pinnedNotes[filePath]) {
                // Create new pin with only specified context
                settings.pinnedNotes[filePath] = {
                    folder: context === 'folder',
                    tag: context === 'tag'
                };
            } else {
                // Toggle the specific context
                settings.pinnedNotes[filePath][context] = !settings.pinnedNotes[filePath][context];

                // Remove if unpinned from all contexts
                if (!settings.pinnedNotes[filePath].folder && !settings.pinnedNotes[filePath].tag) {
                    delete settings.pinnedNotes[filePath];
                }
            }
        });
    }

    /**
     * Checks if a note is pinned
     * @param filePath - Path of the file to check
     * @param context - Optional context to check ('folder' or 'tag')
     * @returns True if the note is pinned (in any context or specified context)
     */
    isPinned(filePath: string, context?: NavigatorContext): boolean {
        const contexts = this.settingsProvider.settings.pinnedNotes?.[filePath];
        if (!contexts) return false;

        if (!context) {
            return contexts.folder || contexts.tag;
        }

        return contexts[context] || false;
    }

    /**
     * Gets all pinned notes
     * @param context - Optional context filter ('folder' or 'tag')
     * @returns Array of pinned file paths
     */
    getPinnedNotes(context?: NavigatorContext): string[] {
        const pinnedNotes = this.settingsProvider.settings.pinnedNotes || {};

        if (!context) {
            return Object.keys(pinnedNotes);
        }

        return Object.entries(pinnedNotes)
            .filter(([_, contexts]) => contexts[context])
            .map(([path]) => path);
    }

    /**
     * Handles file deletion by removing it from pinned notes
     * @param filePath - Path of the deleted file
     */
    async handleFileDelete(filePath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes?.[filePath]) {
                delete settings.pinnedNotes[filePath];
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
            if (settings.pinnedNotes?.[oldPath]) {
                // Save contexts and delete old entry
                const contexts = settings.pinnedNotes[oldPath];
                delete settings.pinnedNotes[oldPath];
                // Add with new path
                settings.pinnedNotes[newPath] = contexts;
            }
        });
    }

    /**
     * Clean up pinned notes using pre-loaded validators
     * @param validators - Pre-loaded data containing vault files
     * @returns True if any metadata was removed/changed
     */
    async cleanupWithValidators(validators: CleanupValidators): Promise<boolean> {
        // Check if cleanup is needed first
        const settings = this.settingsProvider.settings;
        if (!settings.pinnedNotes || Object.keys(settings.pinnedNotes).length === 0) {
            return false;
        }

        const invalidPaths = Object.keys(settings.pinnedNotes).filter(path => !validators.vaultFiles.has(path));

        if (invalidPaths.length === 0) {
            // Nothing to clean up
            return false;
        }

        // Only save if there are changes
        await this.saveAndUpdate(settings => {
            invalidPaths.forEach(path => delete settings.pinnedNotes[path]);
        });

        return true;
    }

    /**
     * Clean up pinned notes for files that don't exist
     * @returns True if any changes were made
     */
    async cleanupPinnedNotes(): Promise<boolean> {
        const vaultFiles = new Set(this.app.vault.getFiles().map(f => f.path));
        return this.cleanupWithValidators({
            vaultFiles,
            vaultFolders: new Set(),
            dbFiles: [],
            tagTree: new Map()
        });
    }
}
