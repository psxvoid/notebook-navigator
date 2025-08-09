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
import { STORAGE_KEYS } from '../../types';
import { localStorage } from '../../utils/localStorage';

/**
 * Selection API - Get current selection state in the navigator
 */
export class SelectionAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Get the currently selected folder or tag in the navigation pane
     * @returns Object with either folder or tag selected (only one can be selected at a time)
     */
    getNavigationSelection(): { folder: TFolder | null; tag: string | null } {
        // Read from localStorage since the selection is persisted there
        const folderPath = localStorage.get<string>(STORAGE_KEYS.selectedFolderKey);
        const tagName = localStorage.get<string>(STORAGE_KEYS.selectedTagKey);

        // If a tag is selected, it takes precedence
        if (tagName) {
            return {
                folder: null,
                tag: tagName
            };
        }

        // Otherwise check for a folder
        if (folderPath) {
            const folder = this.api.app.vault.getAbstractFileByPath(folderPath);
            if (folder instanceof TFolder) {
                return {
                    folder: folder,
                    tag: null
                };
            }
        }

        return { folder: null, tag: null };
    }

    /**
     * Get the currently selected files in the file list
     * @returns Array of selected TFile objects
     */
    getSelectedFiles(): TFile[] {
        // For selected files, we need to check if the view is open
        // because file selection is not persisted (only the single selectedFile is)
        const leaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');
        if (leaves.length === 0) {
            // If view is not open, return the last selected file if available
            const filePath = localStorage.get<string>(STORAGE_KEYS.selectedFileKey);
            if (filePath) {
                const file = this.api.app.vault.getFileByPath(filePath);
                return file ? [file] : [];
            }
            return [];
        }

        // If view is open, try to get the selection from the React component
        // For now, we can only return the single selected file from localStorage
        // TODO: In the future, we could expose the full selection context through the view
        const filePath = localStorage.get<string>(STORAGE_KEYS.selectedFileKey);
        if (filePath) {
            const file = this.api.app.vault.getFileByPath(filePath);
            return file ? [file] : [];
        }

        return [];
    }
}
