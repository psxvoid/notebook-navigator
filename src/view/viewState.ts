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

import { App, TFolder } from 'obsidian';
import type { NotebookNavigatorView } from './NotebookNavigatorView';
import type NotebookNavigatorPlugin from '../main';
import { isTFile } from '../utils/typeGuards';

/**
 * ViewStateManager handles loading and saving the view's state
 * Manages persistence of expanded folders, selections, and UI preferences
 */
export class ViewStateManager {
    private view: NotebookNavigatorView;
    private app: App;
    private plugin: NotebookNavigatorPlugin;

    constructor(view: NotebookNavigatorView) {
        this.view = view;
        this.app = view.app;
        this.plugin = view.plugin;
    }

    /**
     * Loads persisted state from localStorage
     * Restores expanded folders, selected items, and pane width
     */
    async loadState(): Promise<void> {
        // Load expanded folders
        const expandedFoldersData = localStorage.getItem(this.plugin.keys.expandedFoldersKey);
        if (expandedFoldersData) {
            try {
                const folderPaths = JSON.parse(expandedFoldersData);
                if (Array.isArray(folderPaths)) {
                    // Validate that folders still exist
                    const validPaths = folderPaths.filter(path => {
                        const folder = this.app.vault.getAbstractFileByPath(path);
                        return folder instanceof TFolder;
                    });
                    this.view.expandedFolders = new Set(validPaths);
                }
            } catch (e) {
                console.error('Failed to parse expanded folders:', e);
            }
        }

        // Load selected folder
        const selectedFolderPath = localStorage.getItem(this.plugin.keys.selectedFolderKey);
        if (selectedFolderPath) {
            const folder = this.app.vault.getAbstractFileByPath(selectedFolderPath);
            if (folder instanceof TFolder) {
                this.view.selectedFolder = folder;
            }
        }

        // Load selected file
        const selectedFilePath = localStorage.getItem(this.plugin.keys.selectedFileKey);
        if (selectedFilePath) {
            const file = this.app.vault.getAbstractFileByPath(selectedFilePath);
            if (file && isTFile(file)) {
                this.view.selectedFile = file;
            }
        }

        // Load left pane width
        const savedWidth = localStorage.getItem(this.plugin.keys.leftPaneWidthKey);
        if (savedWidth) {
            const width = parseInt(savedWidth);
            // Validate width is within acceptable range (matching resize handler and CSS constraints)
            if (!isNaN(width) && width >= 150 && width <= 600) {
                this.plugin.settings.leftPaneWidth = width;
                if (this.view.leftPane) {
                    this.view.leftPane.style.width = `${width}px`;
                }
            }
        }
    }

    /**
     * Saves current view state to localStorage
     * Persists expanded folders, selections, and UI preferences
     */
    async saveState(): Promise<void> {
        // Save expanded folders
        const expandedFolderPaths = Array.from(this.view.expandedFolders);
        localStorage.setItem(this.plugin.keys.expandedFoldersKey, JSON.stringify(expandedFolderPaths));

        // Save selected folder
        if (this.view.selectedFolder) {
            localStorage.setItem(this.plugin.keys.selectedFolderKey, this.view.selectedFolder.path);
        } else {
            localStorage.removeItem(this.plugin.keys.selectedFolderKey);
        }

        // Save selected file
        if (this.view.selectedFile) {
            localStorage.setItem(this.plugin.keys.selectedFileKey, this.view.selectedFile.path);
        } else {
            localStorage.removeItem(this.plugin.keys.selectedFileKey);
        }

        // Save left pane width
        localStorage.setItem(this.plugin.keys.leftPaneWidthKey, this.plugin.settings.leftPaneWidth.toString());
    }
}