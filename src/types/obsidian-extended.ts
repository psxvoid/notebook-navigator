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

import { App, Plugin, View, WorkspaceLeaf, TFile } from 'obsidian';

/**
 * Extended Obsidian type definitions for internal/undocumented APIs
 * These are based on actual Obsidian behavior but not part of the official API
 */

/**
 * Extended App interface with additional methods
 */
export interface ExtendedApp extends App {
    /**
     * Shows a file in the system file explorer (Finder/Explorer)
     * @param path - Vault-relative path to the file
     */
    showInFolder(path: string): Promise<void>;

    /**
     * View registry for accessing registered view types
     */
    viewRegistry?: {
        typeByExtension?: Record<string, string>;
    };

    /**
     * Metadata type manager for registered extensions
     */
    metadataTypeManager?: {
        registeredExtensions?: string[];
    };

    /**
     * Plugin registry for checking installed plugins
     */
    plugins?: {
        plugins?: Record<string, Plugin>;
        enabledPlugins?: Set<string>;
        disablePluginAndSave?(pluginId: string): Promise<void>;
        enablePluginAndSave?(pluginId: string): Promise<void>;
    };
}

/**
 * Extended View interface with file property
 */
export interface FileView extends View {
    file?: TFile;
}

/**
 * Extended WorkspaceLeaf with typed view
 */
export interface ExtendedWorkspaceLeaf extends WorkspaceLeaf {
    view: FileView;
}

/**
 * Navigator-specific window extensions
 */
export interface NavigatorWindowFlags {
    notebookNavigatorOpeningVersionHistory?: boolean;
    notebookNavigatorOpeningFolderNote?: boolean;
}

/**
 * Common timeout values used throughout the plugin
 */
export const TIMEOUTS = {
    // Debounce Delays
    /** Debounce for keyboard, focus, and search input */
    DEBOUNCE_KEYBOARD: 100,
    /** Debounce for content processing and tree updates */
    DEBOUNCE_CONTENT: 300,
    /** Debounce for settings text input */
    DEBOUNCE_SETTINGS: 1000,

    // Throttle Delays
    /** Throttle delay for keyboard navigation (60fps) */
    KEYBOARD_THROTTLE: 16,

    // Operation Delays
    /** Delay for file system operations to complete */
    FILE_OPERATION_DELAY: 100,

    // Intervals
    /** Interval for statistics refresh */
    INTERVAL_STATISTICS: 1000,

    // Notice Durations
    /** Duration for error messages */
    NOTICE_ERROR: 2000,
    /** Duration for help messages */
    NOTICE_HELP: 10000,

    // Special
    /** Yields control to the event loop, allowing pending operations to complete */
    YIELD_TO_EVENT_LOOP: 0
} as const;

/**
 * Obsidian command IDs
 */
export const OBSIDIAN_COMMANDS = {
    EDIT_FILE_TITLE: 'workspace:edit-file-title',
    SYNC_HISTORY: 'sync:show-sync-history',
    VERSION_HISTORY: 'sync:view-version-history',
    REVEAL_IN_NAVIGATOR: 'notebook-navigator:reveal-active-file'
} as const;

/**
 * Extend the global Window interface for plugin state
 */
declare global {
    interface Window {
        notebookNavigatorOpeningVersionHistory?: boolean;
        notebookNavigatorOpeningFolderNote?: boolean;
    }
}
