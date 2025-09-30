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

import type { TFile } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { isSupportedHomepageFile } from '../../utils/homepageUtils';
import type { RevealFileOptions } from '../../hooks/useNavigatorReveal';
import WorkspaceCoordinator from './WorkspaceCoordinator';

type HomepageTrigger = 'startup' | 'settings-change' | 'command';

interface WorkspaceReadyOptions {
    shouldActivateOnStartup: boolean;
}

/**
 * Handles homepage resolution and opening behaviour, including deferred triggers
 * while the workspace is loading.
 */
export default class HomepageController {
    private readonly plugin: NotebookNavigatorPlugin;
    private readonly workspace: WorkspaceCoordinator;
    private isWorkspaceReady = false;
    private pendingTrigger: HomepageTrigger | null = null;
    private lastHomepagePath: string | null = null;

    constructor(plugin: NotebookNavigatorPlugin, workspace: WorkspaceCoordinator) {
        this.plugin = plugin;
        this.workspace = workspace;
    }

    resolveHomepageFile(): TFile | null {
        const { homepage } = this.plugin.settings;
        if (!homepage) {
            return null;
        }

        const candidate = this.plugin.app.vault.getAbstractFileByPath(homepage);
        if (!isSupportedHomepageFile(candidate)) {
            return null;
        }

        return candidate;
    }

    /**
     * Marks the workspace as ready and processes the pending homepage trigger.
     */
    async handleWorkspaceReady(options: WorkspaceReadyOptions): Promise<void> {
        this.isWorkspaceReady = true;

        if (this.plugin.isShuttingDown()) {
            return;
        }

        if (options.shouldActivateOnStartup) {
            await this.workspace.activateNavigatorView();
        }

        const trigger = this.pendingTrigger ?? 'startup';
        this.pendingTrigger = null;
        await this.open(trigger, true);
    }

    async open(trigger: HomepageTrigger, force = false): Promise<boolean> {
        if (this.plugin.isShuttingDown()) {
            return false;
        }

        if (!this.isWorkspaceReady && trigger !== 'startup') {
            this.pendingTrigger = trigger;
            return false;
        }

        const homepageFile = this.resolveHomepageFile();
        if (!homepageFile) {
            this.lastHomepagePath = null;
            return false;
        }

        if (!force && homepageFile.path === this.lastHomepagePath) {
            return false;
        }

        const leaf = await this.workspace.activateNavigatorView();
        const shouldFocusPane = trigger === 'command' || (trigger === 'startup' && this.plugin.settings.startView === 'files');
        const revealOptions: RevealFileOptions = {
            source: trigger === 'startup' ? 'startup' : trigger === 'command' ? 'manual' : 'auto',
            isStartupReveal: trigger === 'startup',
            preserveNavigationFocus: this.plugin.settings.startView === 'navigation' && trigger !== 'command'
        };

        this.workspace.revealFileInNearestFolder(homepageFile, revealOptions);

        if (shouldFocusPane) {
            this.workspace.focusFilePane(leaf);
        }

        await this.plugin.app.workspace.openLinkText(homepageFile.path, '', false);
        this.lastHomepagePath = homepageFile.path;
        return true;
    }

    /**
     * Clears the cached homepage path to ensure the next open re-evaluates it.
     */
    resetCachedHomepage(): void {
        this.lastHomepagePath = null;
    }
}
