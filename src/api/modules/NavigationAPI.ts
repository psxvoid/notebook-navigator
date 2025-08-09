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
import type { NotebookNavigatorView } from '../../view/NotebookNavigatorView';
import type { NavigationResult } from '../types';

/**
 * Navigation API - Control the navigator view
 */
export class NavigationAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Navigate to a specific folder
     */
    async navigateToFolder(folderPath: string): Promise<NavigationResult> {
        try {
            const folder = this.api.app.vault.getAbstractFileByPath(folderPath);
            if (!folder || !(folder instanceof TFolder)) {
                return { success: false, error: 'Folder not found' };
            }

            const view = await this.ensureViewOpen();
            if (!view) {
                return { success: false, error: 'Could not open navigator view' };
            }

            // For now, navigate to the first file in the folder
            const files = folder.children.filter(child => child instanceof TFile) as TFile[];
            if (files.length > 0) {
                await view.navigateToFile(files[0]);
            }
            this.api.trigger('navigation-changed', { type: 'folder', path: folderPath });
            return { success: true, path: folderPath };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Navigate to a specific tag
     */
    async navigateToTag(tagPath: string): Promise<NavigationResult> {
        try {
            const view = await this.ensureViewOpen();
            if (!view) {
                return { success: false, error: 'Could not open navigator view' };
            }

            // Use the tag navigation modal for now
            await view.navigateToTagWithModal();
            this.api.trigger('navigation-changed', { type: 'tag', path: tagPath });
            return { success: true, path: tagPath };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Navigate to a specific file and select it
     */
    async navigateToFile(filePath: string): Promise<NavigationResult> {
        try {
            const file = this.api.app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                return { success: false, error: 'File not found' };
            }

            const view = await this.ensureViewOpen();
            if (!view) {
                return { success: false, error: 'Could not open navigator view' };
            }

            await view.navigateToFile(file);
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Reveal the currently active file in the navigator
     */
    async revealActiveFile(): Promise<NavigationResult> {
        try {
            const activeFile = this.api.app.workspace.getActiveFile();
            if (!activeFile) {
                return { success: false, error: 'No active file' };
            }

            return await this.navigateToFile(activeFile.path);
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    private async ensureViewOpen() {
        const plugin = this.api.getPlugin();
        const leaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');

        if (leaves.length === 0) {
            await plugin.activateView();
            // Get the newly created view
            const newLeaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');
            return newLeaves[0]?.view as NotebookNavigatorView;
        }

        return leaves[0].view as NotebookNavigatorView;
    }
}
