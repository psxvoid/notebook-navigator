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
import { ItemType, NavigatorContext } from '../../types';
import { ShortcutType, type ShortcutEntry } from '../../types/shortcuts';
import type { NotebookNavigatorSettings } from '../../settings';

/**
 * Service for managing file-specific metadata operations
 * Handles pinned notes and file-related cleanup operations
 */
export class FileMetadataService extends BaseMetadataService {
    private validateFile(filePath: string): boolean {
        return this.app.vault.getFileByPath(filePath) !== null;
    }

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
            if (settings.fileIcons?.[filePath]) {
                delete settings.fileIcons[filePath];
            }
            if (settings.fileColors?.[filePath]) {
                delete settings.fileColors[filePath];
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

            this.updateNestedPaths(settings.fileIcons, oldPath, newPath);
            this.updateNestedPaths(settings.fileColors, oldPath, newPath);

            const shortcuts = settings.shortcuts;
            if (Array.isArray(shortcuts) && shortcuts.length > 0) {
                let updatedShortcuts: ShortcutEntry[] | null = null;

                shortcuts.forEach((shortcut, index) => {
                    if (shortcut.type !== ShortcutType.NOTE) {
                        return;
                    }
                    if (shortcut.path !== oldPath) {
                        return;
                    }

                    if (!updatedShortcuts) {
                        updatedShortcuts = [...shortcuts];
                    }

                    updatedShortcuts[index] = {
                        ...shortcut,
                        path: newPath
                    };
                });

                if (updatedShortcuts) {
                    settings.shortcuts = updatedShortcuts;
                }
            }
        });
    }

    async setFileIcon(filePath: string, iconId: string): Promise<void> {
        if (!this.validateFile(filePath)) {
            return;
        }
        await this.setEntityIcon(ItemType.FILE, filePath, iconId);
    }

    async removeFileIcon(filePath: string): Promise<void> {
        await this.removeEntityIcon(ItemType.FILE, filePath);
    }

    getFileIcon(filePath: string): string | undefined {
        return this.getEntityIcon(ItemType.FILE, filePath);
    }

    async setFileColor(filePath: string, color: string): Promise<void> {
        if (!this.validateFile(filePath)) {
            return;
        }
        await this.setEntityColor(ItemType.FILE, filePath, color);
    }

    async removeFileColor(filePath: string): Promise<void> {
        await this.removeEntityColor(ItemType.FILE, filePath);
    }

    getFileColor(filePath: string): string | undefined {
        const color = this.getEntityColor(ItemType.FILE, filePath);
        if (!color) {
            return undefined;
        }
        const icon = this.getEntityIcon(ItemType.FILE, filePath);
        if (!icon || icon.startsWith('emoji:')) {
            return undefined;
        }
        return color;
    }

    /**
     * Clean up pinned notes using pre-loaded validators
     * @param validators - Pre-loaded data containing vault files
     * @returns True if any metadata was removed/changed
     */
    async cleanupWithValidators(
        validators: CleanupValidators,
        targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings
    ): Promise<boolean> {
        let hasChanges = false;
        const pinnedNotes = targetSettings.pinnedNotes;
        if (pinnedNotes && Object.keys(pinnedNotes).length > 0) {
            const invalidPaths = Object.keys(pinnedNotes).filter(path => !validators.vaultFiles.has(path));

            if (invalidPaths.length > 0) {
                if (targetSettings === this.settingsProvider.settings) {
                    await this.saveAndUpdate(settings => {
                        invalidPaths.forEach(path => {
                            if (settings.pinnedNotes) {
                                delete settings.pinnedNotes[path];
                            }
                        });
                    });
                } else {
                    invalidPaths.forEach(path => {
                        if (targetSettings.pinnedNotes) {
                            delete targetSettings.pinnedNotes[path];
                        }
                    });
                }

                hasChanges = true;
            }
        }

        const fileIconCleanup = await this.cleanupMetadata(targetSettings, 'fileIcons', path => validators.vaultFiles.has(path));
        const fileColorCleanup = await this.cleanupMetadata(targetSettings, 'fileColors', path => validators.vaultFiles.has(path));

        return hasChanges || fileIconCleanup || fileColorCleanup;
    }

    /**
     * Clean up pinned notes for files that don't exist
     * @returns True if any changes were made
     */
    async cleanupPinnedNotes(targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings): Promise<boolean> {
        const vaultFiles = new Set(this.app.vault.getFiles().map(f => f.path));
        return this.cleanupWithValidators(
            {
                vaultFiles,
                vaultFolders: new Set(),
                dbFiles: [],
                tagTree: new Map()
            },
            targetSettings
        );
    }
}
