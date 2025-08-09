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
import type { ViewState } from '../types';
import { localStorage } from '../../utils/localStorage';

/**
 * View API - Control the navigator view
 */
export class ViewAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Open the navigator view
     */
    async open(): Promise<void> {
        const plugin = this.api.getPlugin();
        await plugin.activateView();
    }

    /**
     * Close the navigator view
     */
    close(): void {
        const leaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');
        for (const leaf of leaves) {
            leaf.detach();
        }
    }

    /**
     * Check if navigator view is open
     */
    isOpen(): boolean {
        const leaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');
        return leaves.length > 0;
    }

    /**
     * Get current view state
     */
    getViewState(): ViewState | null {
        const leaves = this.api.app.workspace.getLeavesOfType('notebook-navigator');
        if (leaves.length === 0) return null;

        const plugin = this.api.getPlugin();

        return {
            isOpen: true,
            isActive: this.api.app.workspace.getActiveViewOfType(leaves[0].view.getViewType() as never) !== null,
            paneWidth: localStorage.get<number>(plugin.keys.navigationPaneWidthKey) || 300,
            dualPane: plugin.settings.dualPane,
            focusedPane: 'navigation' // Would need to get from UI state
        };
    }

    /**
     * Set pane width
     */
    setPaneWidth(width: number): void {
        const plugin = this.api.getPlugin();
        localStorage.set(plugin.keys.navigationPaneWidthKey, width);
    }

    /**
     * Toggle single pane mode
     */
    async toggleSinglePaneMode(): Promise<void> {
        const plugin = this.api.getPlugin();
        plugin.settings.dualPane = !plugin.settings.dualPane;
        await plugin.saveSettings();
    }
}
