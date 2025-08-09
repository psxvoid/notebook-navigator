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
import type { NavigationItemType } from '../../types';
import type { SelectionDispatch } from '../../context/SelectionContext';

import { ItemType } from '../../types';

// Local type since it's not exported from FileSystemService
interface SelectionContext {
    selectionType: NavigationItemType;
    selectedFolder?: TFolder;
    selectedTag?: string;
}

/**
 * FileSystem API - Smart file deletion with automatic selection management
 */
export class FileSystemAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Delete a file with smart selection
     * Automatically selects the next file in the list after deletion
     * Uses the plugin's confirmation setting
     * @param filePath - Path to the file to delete
     */
    async deleteFile(filePath: string): Promise<void> {
        const plugin = this.api.getPlugin();
        const file = plugin.app.vault.getAbstractFileByPath(filePath);

        if (!(file instanceof TFile)) {
            throw new Error(`File not found: ${filePath}`);
        }

        if (!plugin.fileSystemOps) {
            throw new Error('FileSystem operations not available');
        }

        // Use plugin's confirmBeforeDelete setting
        const confirmBeforeDelete = plugin.settings.confirmBeforeDelete;

        await plugin.fileSystemOps.deleteFile(file, confirmBeforeDelete, undefined, undefined);
    }

    /**
     * Delete multiple files with smart selection
     * Automatically manages selection after deletion
     * Uses the plugin's confirmation setting
     * @param filePaths - Array of file paths to delete
     */
    async deleteFiles(filePaths: string[]): Promise<void> {
        const plugin = this.api.getPlugin();
        const files: TFile[] = [];

        for (const path of filePaths) {
            const file = plugin.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                files.push(file);
            }
        }

        if (files.length === 0) {
            throw new Error('No valid files found to delete');
        }

        if (!plugin.fileSystemOps) {
            throw new Error('FileSystem operations not available');
        }

        // Use plugin's confirmBeforeDelete setting
        const confirmBeforeDelete = plugin.settings.confirmBeforeDelete;

        // Convert files to Set of paths for the delete method
        const filePathSet = new Set(files.map(f => f.path));

        // Use the batch delete method with smart selection
        // We pass empty dispatch since we're not in the UI context
        // Use FOLDER type as a safe default since we're not actually in any context
        const emptyContext: SelectionContext = {
            selectionType: ItemType.FOLDER,
            selectedFolder: undefined,
            selectedTag: undefined
        };

        const emptyDispatch: SelectionDispatch = () => {};

        await plugin.fileSystemOps.deleteFilesWithSmartSelection(
            filePathSet,
            files,
            plugin.settings,
            emptyContext,
            emptyDispatch,
            confirmBeforeDelete
        );
    }

    /**
     * Move files to a target folder
     * @param filePaths - Array of file paths to move
     * @param targetFolderPath - Path to the target folder
     * @returns Result with moved count, skipped count, and errors
     */
    async moveFiles(
        filePaths: string[],
        targetFolderPath: string
    ): Promise<{
        movedCount: number;
        skippedCount: number;
        errors: Array<{ path: string; error: string }>;
    }> {
        const plugin = this.api.getPlugin();
        const targetFolder = plugin.app.vault.getAbstractFileByPath(targetFolderPath);

        if (!(targetFolder instanceof TFolder)) {
            throw new Error(`Target folder not found: ${targetFolderPath}`);
        }

        const files: TFile[] = [];
        for (const path of filePaths) {
            const file = plugin.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                files.push(file);
            }
        }

        if (!plugin.fileSystemOps) {
            throw new Error('FileSystem operations not available');
        }

        const result = await plugin.fileSystemOps.moveFilesToFolder({
            files,
            targetFolder,
            showNotifications: true
        });

        return {
            movedCount: result.movedCount,
            skippedCount: result.skippedCount,
            errors: result.errors.map((e: { file: TFile; error: Error }) => ({
                path: e.file.path,
                error: e.error.message
            }))
        };
    }
}
