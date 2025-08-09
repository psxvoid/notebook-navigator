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

import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import type { SelectionState } from '../types';
import { localStorage } from '../../utils/localStorage';

/**
 * Selection API - Get and set selected items
 */
export class SelectionAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Get current selection state
     */
    getSelection(): SelectionState {
        const plugin = this.api.getPlugin();
        return {
            folder: localStorage.get(plugin.keys.selectedFolderKey),
            tag: localStorage.get(plugin.keys.selectedTagKey),
            files: localStorage.get<string[]>(plugin.keys.selectedFileKey) || []
        };
    }

    /**
     * Select a folder
     */
    selectFolder(folderPath: string): void {
        const plugin = this.api.getPlugin();
        localStorage.set(plugin.keys.selectedFolderKey, folderPath);
        localStorage.set(plugin.keys.selectedTagKey, null);

        const selection = this.getSelection();
        this.api.trigger('selection-changed', selection);
    }

    /**
     * Select a tag
     */
    selectTag(tagPath: string): void {
        const plugin = this.api.getPlugin();
        localStorage.set(plugin.keys.selectedTagKey, tagPath);
        localStorage.set(plugin.keys.selectedFolderKey, null);

        const selection = this.getSelection();
        this.api.trigger('selection-changed', selection);
    }

    /**
     * Select files
     */
    selectFiles(filePaths: string[]): void {
        const plugin = this.api.getPlugin();
        localStorage.set(plugin.keys.selectedFileKey, filePaths);

        const selection = this.getSelection();
        this.api.trigger('selection-changed', selection);
    }

    /**
     * Clear all selections
     */
    clearSelection(): void {
        const plugin = this.api.getPlugin();
        localStorage.set(plugin.keys.selectedFolderKey, null);
        localStorage.set(plugin.keys.selectedTagKey, null);
        localStorage.set(plugin.keys.selectedFileKey, []);

        const selection = this.getSelection();
        this.api.trigger('selection-changed', selection);
    }
}
