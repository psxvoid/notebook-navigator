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
 * Navigation API - Navigate to files, folders, and tags
 */
export class NavigationAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Navigate to a specific folder
     * @param folder - Folder to navigate to
     */
    async navigateToFolder(folder: TFolder): Promise<NavigationResult> {
        try {
            const view = await this.ensureViewOpen();
            if (!view) {
                return { success: false, error: 'Could not open navigator view' };
            }

            // Navigate to the first file in the folder
            const files = folder.children.filter(child => child instanceof TFile) as TFile[];
            if (files.length > 0) {
                await view.navigateToFile(files[0]);
            }
            return { success: true, path: folder.path };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Navigate to a specific tag
     * @param tag - Tag string (e.g., '#work' or '#project/active')
     */
    async navigateToTag(tag: string): Promise<NavigationResult> {
        try {
            const view = await this.ensureViewOpen();
            if (!view) {
                return { success: false, error: 'Could not open navigator view' };
            }

            // Use the tag navigation modal for now
            await view.navigateToTagWithModal();
            return { success: true, path: tag };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Navigate to a specific file and select it
     * @param file - File to navigate to
     */
    async navigateToFile(file: TFile): Promise<NavigationResult> {
        try {
            const view = await this.ensureViewOpen();
            if (!view) {
                return { success: false, error: 'Could not open navigator view' };
            }

            await view.navigateToFile(file);
            return { success: true, path: file.path };
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

            const view = await this.ensureViewOpen();
            if (!view) {
                return { success: false, error: 'Could not open navigator view' };
            }

            await view.navigateToFile(activeFile);
            return { success: true, path: activeFile.path };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Ensure the navigator view is open
     */
    private async ensureViewOpen(): Promise<NotebookNavigatorView | null> {
        const plugin = this.api.getPlugin();
        const leaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');

        if (leaves.length === 0) {
            await plugin.activateView();
            const newLeaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');
            if (newLeaves.length > 0) {
                return newLeaves[0].view as NotebookNavigatorView;
            }
            return null;
        }

        return leaves[0].view as NotebookNavigatorView;
    }
}
