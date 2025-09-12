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

import { TFolder, TFile } from 'obsidian';
import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import type { SelectionState, NavItem } from '../types';
import { STORAGE_KEYS } from '../../types';
import { localStorage } from '../../utils/localStorage';

/**
 * Selection API - Manage and query selection state in the navigator
 */
export class SelectionAPI {
    /**
     * Internal state for tracking all selections
     */
    private selectionState: {
        files: Set<string>;
        primaryFile: TFile | null;
        navigationFolder: TFolder | null;
        navigationTag: string | null;
    } = {
        // File selection state
        files: new Set<string>(),
        primaryFile: null,
        // Navigation selection state
        navigationFolder: null,
        navigationTag: null
    };

    // Snapshot signature of last-emitted selection to ensure events fire when
    // selection content changes (even if the count stays the same)
    private lastSelectionSignature = '';

    constructor(private api: NotebookNavigatorAPI) {
        // Initialize navigation state from localStorage
        this.initializeNavigationState();
    }

    /**
     * Initialize navigation state from localStorage on startup
     */
    private initializeNavigationState(): void {
        try {
            const folderPath = localStorage.get<string>(STORAGE_KEYS.selectedFolderKey);
            const tagName = localStorage.get<string>(STORAGE_KEYS.selectedTagKey);

            if (tagName) {
                this.selectionState.navigationTag = tagName;
                this.selectionState.navigationFolder = null;
            } else if (folderPath) {
                const folder = this.api.app.vault.getFolderByPath(folderPath);
                if (folder) {
                    this.selectionState.navigationFolder = folder;
                    this.selectionState.navigationTag = null;
                }
            }
        } catch (error) {
            console.error('Failed to initialize navigation state from localStorage:', error);
        }
    }

    /**
     * Get the currently selected navigation item (folder or tag)
     * @returns Object with either folder or tag selected (only one can be selected at a time)
     */
    getNavItem(): NavItem {
        if (this.selectionState.navigationFolder) {
            return {
                folder: this.selectionState.navigationFolder,
                tag: null
            };
        } else if (this.selectionState.navigationTag) {
            return {
                folder: null,
                tag: this.selectionState.navigationTag
            };
        }
        return {
            folder: null,
            tag: null
        };
    }

    /**
     * Update the navigation selection state
     * Called by React components when navigation changes
     * @internal
     */
    updateNavigationState(folder: TFolder | null, tag: string | null): void {
        this.selectionState.navigationFolder = folder;
        this.selectionState.navigationTag = tag;

        // Build the NavItem with proper discriminated union
        let item: NavItem;
        if (folder) {
            item = { folder, tag: null };
        } else if (tag) {
            item = { folder: null, tag };
        } else {
            item = { folder: null, tag: null };
        }

        // Trigger the consolidated navigation event
        this.api.trigger('nav-item-changed', { item });
    }

    /**
     * Update the file selection state
     * Called by React components when file selection changes
     * @internal
     */
    updateFileState(selectedFiles: Set<string>, primaryFile: TFile | null): void {
        // Compute a stable signature for selected paths + primary file
        const sortedPaths = Array.from(selectedFiles).sort();
        const primaryPath = primaryFile ? primaryFile.path : '';
        const newSignature = `${sortedPaths.join('|')}::${primaryPath}`;

        // Update internal state
        this.selectionState.files = new Set(selectedFiles);
        this.selectionState.primaryFile = primaryFile;

        // Emit event only when selection content actually changes
        if (newSignature !== this.lastSelectionSignature) {
            this.lastSelectionSignature = newSignature;

            // Get TFile objects for the event
            const fileObjects: TFile[] = [];
            for (const path of selectedFiles) {
                const file = this.api.app.vault.getFileByPath(path);
                if (file) fileObjects.push(file);
            }

            this.api.trigger('selection-changed', {
                state: {
                    files: fileObjects,
                    focused: primaryFile
                }
            });
        }
    }

    /**
     * Get the current selection state
     * @returns Current selection state with files and focused file
     */
    getCurrent(): SelectionState {
        const files: TFile[] = [];

        for (const path of this.selectionState.files) {
            const file = this.api.app.vault.getFileByPath(path);
            if (file) files.push(file);
        }

        return {
            files,
            focused: this.selectionState.primaryFile
        };
    }
}
