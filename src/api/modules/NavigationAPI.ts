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

import { TFile } from 'obsidian';
import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import { NotebookNavigatorView } from '../../view/NotebookNavigatorView';
import { NOTEBOOK_NAVIGATOR_VIEW } from '../../types';

/**
 * Navigation API - Navigate to files in the navigator
 */
export class NavigationAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Navigate to a specific file and select it
     * @param file - File to navigate to
     */
    async reveal(file: TFile): Promise<void> {
        const view = await this.ensureViewOpen();
        if (!view) {
            throw new Error('Could not open navigator view');
        }

        await view.navigateToFile(file);
    }

    /**
     * Ensure the navigator view is open
     */
    private async ensureViewOpen(): Promise<NotebookNavigatorView | null> {
        const plugin = this.api.getPlugin();
        const leaves = this.api.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);

        if (leaves.length === 0) {
            await plugin.activateView();
            const newLeaves = this.api.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            if (newLeaves.length > 0 && newLeaves[0].view instanceof NotebookNavigatorView) {
                return newLeaves[0].view;
            }
            return null;
        }

        if (leaves[0].view instanceof NotebookNavigatorView) {
            return leaves[0].view;
        }
        return null;
    }
}
