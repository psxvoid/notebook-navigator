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
import type { SelectionState, TagRef } from '../types';
import { STORAGE_KEYS } from '../../types';
import { localStorage } from '../../utils/localStorage';

/**
 * Selection API - Manage and query selection state in the navigator
 */
export class SelectionAPI {
    /**
     * Internal state for tracking all selections
     */
    private selectionState = {
        // File selection state
        files: new Set<string>(),
        primaryFile: null as TFile | null,
        // Navigation selection state
        navigationFolder: null as TFolder | null,
        navigationTag: null as string | null
    };

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
                const folder = this.api.app.vault.getAbstractFileByPath(folderPath);
                if (folder instanceof TFolder) {
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
    getSelectedNavigationItem(): { folder: TFolder | null; tag: string | null } {
        return {
            folder: this.selectionState.navigationFolder,
            tag: this.selectionState.navigationTag
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

        // Trigger appropriate navigation event
        if (folder) {
            this.api.trigger('folder-selected', {
                folder
            });
        } else if (tag) {
            this.api.trigger('tag-selected', {
                tag: tag as TagRef
            });
        }
    }

    /**
     * Update the file selection state
     * Called by React components when file selection changes
     * @internal
     */
    updateFileState(selectedFiles: Set<string>, primaryFile: TFile | null): void {
        const oldCount = this.selectionState.files.size;
        this.selectionState.files = new Set(selectedFiles);
        this.selectionState.primaryFile = primaryFile;

        // Trigger event if selection has changed
        if (oldCount !== selectedFiles.size || oldCount === 0) {
            // Get TFile objects for the event
            const fileObjects: TFile[] = [];
            for (const path of selectedFiles) {
                const file = this.api.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    fileObjects.push(file);
                }
            }

            this.api.trigger('file-selection-changed', {
                files: fileObjects,
                focused: primaryFile
            });
        }
    }

    /**
     * Get the current selection state
     * @returns Current selection state with files and focused file
     */
    getSelectionState(): SelectionState {
        const files: TFile[] = [];

        for (const path of this.selectionState.files) {
            const file = this.api.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                files.push(file);
            }
        }

        return {
            files,
            focused: this.selectionState.primaryFile
        };
    }
}
