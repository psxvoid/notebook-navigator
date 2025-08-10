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
     */
    async delete(files: TFile | TFile[]): Promise<void> {
        const plugin = this.api.getPlugin();
        const fileArray = Array.isArray(files) ? files : [files];

        if (fileArray.length === 0) {
            return;
        }

        if (!plugin.fileSystemOps) {
            throw new Error('File operations not available');
        }

        // Use cached confirmBeforeDelete setting
        const confirmBeforeDelete = this.fileState.confirmBeforeDelete;

        // For single file deletion
        if (fileArray.length === 1) {
            await plugin.fileSystemOps.deleteFile(fileArray[0], confirmBeforeDelete, undefined, undefined);
            return;
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

        await plugin.fileSystemOps.deleteFilesWithSmartSelection(
            filePathSet,
            fileArray,
            plugin.settings,
            emptyContext,
            apiDispatch,
            confirmBeforeDelete
        );
    }

    /**
     * Move one or more files to a target folder
     * @param files - File or array of files to move
     * @param targetFolder - Target folder to move files into
     * @returns Result with moved count, skipped files, and errors
     */
    async moveTo(
        files: TFile | TFile[],
        targetFolder: TFolder
    ): Promise<{
        movedCount: number;
        skippedCount: number;
        skipped: TFile[];
        errors: Array<{ file: TFile; error: string }>;
    }> {
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

        // Emit files-moved event
        this.api.trigger('files-moved', {
            files: fileArray.filter(f => {
                // Only include successfully moved files
                return !result.errors.some((e: { file: TFile }) => e.file === f);
            }),
            to: targetFolder
        });

        return {
            movedCount: result.movedCount,
            skippedCount: result.skippedCount,
            skipped: [], // TODO: Track skipped files in FileSystemService
            errors: result.errors.map((e: { file: TFile; error: Error }) => ({
                file: e.file,
                error: e.error.message
            }))
        };
    }
}
