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

import { TFile, WorkspaceLeaf } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { NOTEBOOK_NAVIGATOR_VIEW } from '../../types';
import { NotebookNavigatorView } from '../../view/NotebookNavigatorView';
import type { RevealFileOptions } from '../../hooks/useNavigatorReveal';

/**
 * Coordinates interactions with Obsidian's workspace that relate to the Notebook Navigator view.
 * Handles creation/focusing of the view and delegates reveal operations to the React layer.
 */
export default class WorkspaceCoordinator {
    private readonly plugin: NotebookNavigatorPlugin;

    constructor(plugin: NotebookNavigatorPlugin) {
        this.plugin = plugin;
    }

    /**
     * Ensures the navigator view exists in the workspace and returns the active leaf for it.
     */
    async activateNavigatorView(): Promise<WorkspaceLeaf | null> {
        const { workspace } = this.plugin.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);

        if (leaves.length > 0) {
            leaf = leaves[0];
            workspace.revealLeaf(leaf);
        } else {
            leaf = workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: NOTEBOOK_NAVIGATOR_VIEW, active: true });
                workspace.revealLeaf(leaf);
            }
        }

        return leaf;
    }

    /**
     * Retrieves all workspace leaves hosting the navigator view.
     */
    private getNavigatorLeaves(): WorkspaceLeaf[] {
        return this.plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
    }

    /**
     * Forwards a "manual" reveal to every navigator view.
     */
    revealFileInActualFolder(file: TFile, options?: RevealFileOptions): void {
        this.getNavigatorLeaves().forEach(leaf => {
            const { view } = leaf;
            if (view instanceof NotebookNavigatorView) {
                view.navigateToFile(file, options);
            }
        });
    }

    /**
     * Forwards an auto reveal that preserves the current navigation context when possible.
     */
    revealFileInNearestFolder(file: TFile, options?: RevealFileOptions): void {
        this.getNavigatorLeaves().forEach(leaf => {
            const { view } = leaf;
            if (view instanceof NotebookNavigatorView) {
                view.revealFileInNearestFolder(file, options);
            }
        });
    }

    /**
     * Focuses the navigator's file pane if the target leaf is available.
     */
    focusFilePane(targetLeaf: WorkspaceLeaf | null): void {
        const leaf = targetLeaf ?? this.getNavigatorLeaves()[0] ?? null;
        if (!leaf) {
            return;
        }

        const { view } = leaf;
        if (view instanceof NotebookNavigatorView) {
            view.focusFilePane();
        }
    }
}
