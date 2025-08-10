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
import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import type { SelectionDispatch } from '../../context/SelectionContext';
import type { DeleteResult, MoveResult } from '../types';
import { ItemType } from '../../types';

/**
 * File API - Smart file operations with automatic selection management
 */
export class FileAPI {
    /**
     * Internal state cache for settings
     */
    private fileState = {
        confirmBeforeDelete: true
    };

    constructor(private api: NotebookNavigatorAPI) {
        this.initializeFromSettings();
    }

    /**
     * Initialize internal cache from plugin settings
     */
    private initializeFromSettings(): void {
        const plugin = this.api.getPlugin();
        if (plugin && plugin.settings) {
            this.updateFromSettings(plugin.settings);
        }
    }

    /**
     * Update internal cache when settings change
     * Called by the plugin when settings are modified
     * @internal
     */
    updateFromSettings(settings: { confirmBeforeDelete: boolean }): void {
        this.fileState.confirmBeforeDelete = settings.confirmBeforeDelete;
    }

    /**
     * Delete one or more files with smart selection management
     * Automatically selects the next appropriate file after deletion
     * Uses the plugin's confirmation setting
     * @param files - File or array of files to delete
     * @returns Result with deleted count, skipped files, and errors
     */
    async delete(files: TFile | TFile[]): Promise<DeleteResult> {
        const plugin = this.api.getPlugin();
        const fileArray = Array.isArray(files) ? files : [files];

        if (fileArray.length === 0) {
            return {
                deletedCount: 0,
                errors: []
            };
        }

        if (!plugin.fileSystemOps) {
            throw new Error('File operations not available');
        }

        // Use cached confirmBeforeDelete setting
        const confirmBeforeDelete = this.fileState.confirmBeforeDelete;

        // For single file deletion
        if (fileArray.length === 1) {
            try {
                await plugin.fileSystemOps.deleteFile(fileArray[0], confirmBeforeDelete, undefined, undefined);
                return {
                    deletedCount: 1,
                    errors: []
                };
            } catch (error) {
                return {
                    deletedCount: 0,
                    errors: [
                        {
                            file: fileArray[0],
                            error: error instanceof Error ? error.message : String(error)
                        }
                    ]
                };
            }
        }

        // For multiple files
        const filePathSet = new Set(fileArray.map(f => f.path));

        // Create minimal context for smart selection
        const emptyContext = {
            selectionType: ItemType.FOLDER,
            selectedFolder: undefined,
            selectedTag: undefined
        };

        // Create a dispatch that properly handles selection cleanup
        // Since we're operating via API, we don't need to update UI selection
        // but we should still handle the cleanup action properly
        const apiDispatch: SelectionDispatch = action => {
            // Log the action for debugging if needed
            if (action.type === 'CLEANUP_DELETED_FILE') {
                // The file system service will handle the actual deletion
                // This dispatch is mainly for UI updates which we skip in API mode
                return;
            }
        };

        try {
            await plugin.fileSystemOps.deleteFilesWithSmartSelection(
                filePathSet,
                fileArray,
                plugin.settings,
                emptyContext,
                apiDispatch,
                confirmBeforeDelete
            );

            // All files deleted successfully
            return {
                deletedCount: fileArray.length,
                errors: []
            };
        } catch (error) {
            // Some or all files failed to delete
            return {
                deletedCount: 0,
                errors: fileArray.map(file => ({
                    file,
                    error: error instanceof Error ? error.message : String(error)
                }))
            };
        }
    }

    /**
     * Move one or more files to a target folder
     * @param files - File or array of files to move
     * @param targetFolder - Target folder to move files into
     * @returns Result with moved count, skipped files, and errors
     */
    async moveTo(files: TFile | TFile[], targetFolder: TFolder): Promise<MoveResult> {
        const plugin = this.api.getPlugin();
        const fileArray = Array.isArray(files) ? files : [files];

        if (!plugin.fileSystemOps) {
            throw new Error('File operations not available');
        }

        const result = await plugin.fileSystemOps.moveFilesToFolder({
            files: fileArray,
            targetFolder,
            showNotifications: true
        });

        return {
            movedCount: result.movedCount,
            errors: result.errors.map((e: { file: TFile; error: Error }) => ({
                file: e.file,
                error: e.error.message
            }))
        };
    }
}
