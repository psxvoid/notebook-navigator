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
    constructor(private api: NotebookNavigatorAPI) {}

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

        // Use plugin's confirmBeforeDelete setting
        const confirmBeforeDelete = plugin.settings.confirmBeforeDelete;

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

        const emptyDispatch: SelectionDispatch = () => {};

        await plugin.fileSystemOps.deleteFilesWithSmartSelection(
            filePathSet,
            fileArray,
            plugin.settings,
            emptyContext,
            emptyDispatch,
            confirmBeforeDelete
        );
    }

    /**
     * Move one or more files to a target folder
     * @param files - File or array of files to move
     * @param targetFolder - Target folder to move files into
     * @returns Result with moved count, skipped count, and errors
     */
    async move(
        files: TFile | TFile[],
        targetFolder: TFolder
    ): Promise<{
        movedCount: number;
        skippedCount: number;
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

        return {
            movedCount: result.movedCount,
            skippedCount: result.skippedCount,
            errors: result.errors.map((e: { file: TFile; error: Error }) => ({
                file: e.file,
                error: e.error.message
            }))
        };
    }
}
