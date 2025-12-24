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
import { NOTEBOOK_NAVIGATOR_VIEW } from '../../types';

type NavigatorView = {
    navigateToFile: (file: TFile) => void;
    navigateToFolder: (folder: TFolder, options?: { preserveNavigationFocus?: boolean }) => void;
    navigateToTag: (tag: string) => void;
};

type LeafWithView = { view: object | null };

type NavigationAPIHost = {
    app: {
        vault: { getFolderByPath: (path: string) => TFolder | null };
        workspace: { getLeavesOfType: (viewType: string) => LeafWithView[] };
    };
    getPlugin: () => { activateView: () => Promise<object | null> };
};

/**
 * Navigation API - Navigate to files in the navigator
 */
export class NavigationAPI {
    constructor(private api: NavigationAPIHost) {}

    /**
     * Navigate to a specific file and select it
     * @param file - File to navigate to
     */
    async reveal(file: TFile): Promise<void> {
        const view = await this.ensureViewOpen();
        if (!view) {
            throw new Error('Could not open navigator view');
        }

        view.navigateToFile(file);
    }

    /**
     * Select a folder in the navigator navigation pane
     * @param folder - Folder to select
     */
    async navigateToFolder(folder: TFolder): Promise<void> {
        const view = await this.ensureViewOpen();
        if (!view) {
            throw new Error('Could not open navigator view');
        }

        const resolvedFolder = this.api.app.vault.getFolderByPath(folder.path);
        if (!resolvedFolder) {
            return;
        }

        view.navigateToFolder(resolvedFolder, { preserveNavigationFocus: true });
    }

    /**
     * Select a tag in the navigator navigation pane
     * @param tag - Tag to select (e.g. '#work' or 'work')
     */
    async navigateToTag(tag: string): Promise<void> {
        const view = await this.ensureViewOpen();
        if (!view) {
            throw new Error('Could not open navigator view');
        }

        view.navigateToTag(tag);
    }

    /**
     * Ensure the navigator view is open
     */
    private async ensureViewOpen(): Promise<NavigatorView | null> {
        const plugin = this.api.getPlugin();
        const leaves = this.api.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);

        const existingView = this.extractNavigatorView(leaves);
        if (existingView) {
            return existingView;
        }

        await plugin.activateView();
        const newLeaves = this.api.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
        return this.extractNavigatorView(newLeaves);
    }

    private extractNavigatorView(leaves: LeafWithView[]): NavigatorView | null {
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view && this.isNavigatorView(view)) {
                return view;
            }
        }
        return null;
    }

    private isNavigatorView(view: object): view is NavigatorView {
        if (!('navigateToFile' in view) || typeof view.navigateToFile !== 'function') {
            return false;
        }
        if (!('navigateToFolder' in view) || typeof view.navigateToFolder !== 'function') {
            return false;
        }
        if (!('navigateToTag' in view) || typeof view.navigateToTag !== 'function') {
            return false;
        }

        return true;
    }
}
