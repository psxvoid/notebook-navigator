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

import { Platform, type TFile } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { isSupportedHomepageFile } from '../../utils/homepageUtils';
import type { RevealFileOptions } from '../../hooks/useNavigatorReveal';
import WorkspaceCoordinator from './WorkspaceCoordinator';

// Indicates what triggered the homepage opening
type HomepageTrigger = 'startup' | 'command';

interface WorkspaceReadyOptions {
    // Whether to activate the navigator view during workspace initialization
    shouldActivateOnStartup: boolean;
}

/**
 * Handles homepage resolution and opening behaviour, including deferred triggers
 * while the workspace is loading.
 */
export default class HomepageController {
    private readonly plugin: NotebookNavigatorPlugin;
    private readonly workspace: WorkspaceCoordinator;
    // Tracks whether workspace layout has finished loading
    private isWorkspaceReady = false;
    // Stores a deferred homepage trigger to execute once workspace is ready
    private pendingTrigger: HomepageTrigger | null = null;
    constructor(plugin: NotebookNavigatorPlugin, workspace: WorkspaceCoordinator) {
        this.plugin = plugin;
        this.workspace = workspace;
    }

    /**
     * Resolves the configured homepage path to a file object if valid
     */
    resolveHomepageFile(): TFile | null {
        const { homepage, mobileHomepage, useMobileHomepage } = this.plugin.settings;
        const useMobileOverride = Platform.isMobile && useMobileHomepage;

        const resolvePath = (path: string | null): TFile | null => {
            if (!path) {
                return null;
            }

            const candidate = this.plugin.app.vault.getAbstractFileByPath(path);
            if (!isSupportedHomepageFile(candidate)) {
                return null;
            }

            return candidate;
        };

        const primaryFile = resolvePath(useMobileOverride ? mobileHomepage : homepage);
        if (primaryFile) {
            return primaryFile;
        }

        if (useMobileOverride) {
            const fallbackFile = resolvePath(homepage);
            if (fallbackFile) {
                return fallbackFile;
            }
        }

        return null;
    }

    /**
     * Marks the workspace as ready and processes the pending homepage trigger.
     */
    async handleWorkspaceReady(options: WorkspaceReadyOptions): Promise<void> {
        this.isWorkspaceReady = true;

        if (this.plugin.isShuttingDown()) {
            return;
        }

        // Activate navigator view if configured to show on startup
        if (options.shouldActivateOnStartup) {
            await this.workspace.activateNavigatorView();
        }

        // Execute any deferred homepage trigger or default to startup
        const trigger = this.pendingTrigger ?? 'startup';
        this.pendingTrigger = null;
        await this.open(trigger);
    }

    /**
     * Opens the configured homepage file if it exists and conditions are met
     */
    async open(trigger: HomepageTrigger): Promise<boolean> {
        if (this.plugin.isShuttingDown()) {
            return false;
        }

        // Defer opening until workspace is ready
        if (!this.isWorkspaceReady && trigger !== 'startup') {
            this.pendingTrigger = trigger;
            return false;
        }

        const homepageFile = this.resolveHomepageFile();
        if (!homepageFile) {
            return false;
        }

        const revealOptions: RevealFileOptions = {
            source: trigger === 'startup' ? 'startup' : 'manual',
            isStartupReveal: trigger === 'startup',
            preserveNavigationFocus: this.plugin.settings.startView === 'navigation' && trigger === 'startup'
        };

        // Reveal homepage in navigator
        this.workspace.revealFileInNearestFolder(homepageFile, revealOptions);

        // Open homepage file in the editor
        // Use command queue to track the homepage open operation if available
        const { commandQueue } = this.plugin;
        if (commandQueue) {
            const result = await commandQueue.executeHomepageOpen(homepageFile, () =>
                this.plugin.app.workspace.openLinkText(homepageFile.path, '', false)
            );

            return result.success;
        }

        // Fallback for when command queue is not available
        await this.plugin.app.workspace.openLinkText(homepageFile.path, '', false);
        return true;
    }
}
