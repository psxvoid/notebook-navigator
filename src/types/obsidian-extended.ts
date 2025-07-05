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
 * Type guard to safely cast App to ExtendedApp
 */
export function isExtendedApp(app: App): app is ExtendedApp {
    return app && typeof app === 'object';
}

/**
 * Common timeout values used throughout the plugin
 */
export const TIMEOUTS = {
    /** Delay for auto-reveal clear operation */
    AUTO_REVEAL_CLEAR: 100,
    /** Threshold for detecting file creation vs rename */
    FILE_CREATION_THRESHOLD: 200,
    /** Delay for version history modal to open */
    VERSION_HISTORY_DELAY: 500,
    /** Delay for rename mode trigger */
    RENAME_MODE_DELAY: 0,
    /** Delay for focus restoration after deletion */
    FOCUS_RESTORE_DELAY: 100,
    /** Delay for drag image cleanup */
    DRAG_IMAGE_CLEANUP: 0,
    /** Debounce delay for resize observer */
    RESIZE_DEBOUNCE: 100,
    /** Throttle delay for keyboard navigation */
    KEYBOARD_NAV_THROTTLE: 16
} as const;

/**
 * Error message keys for consistent error handling
 */
export const ERROR_KEYS = {
    CREATE_FOLDER: 'createFolder',
    CREATE_FILE: 'createFile',
    RENAME_FOLDER: 'renameFolder',
    RENAME_FILE: 'renameFile',
    DELETE_FOLDER: 'deleteFolder',
    DELETE_FILE: 'deleteFile',
    DUPLICATE_NOTE: 'duplicateNote',
    DUPLICATE_FOLDER: 'duplicateFolder',
    CREATE_CANVAS: 'createCanvas',
    CREATE_DATABASE: 'createDatabase',
    OPEN_VERSION_HISTORY: 'openVersionHistory',
    REVEAL_IN_EXPLORER: 'revealInExplorer',
    FAILED_TO_DELETE_FILE: 'failedToDeleteFile',
    VERSION_HISTORY_NOT_FOUND: 'versionHistoryNotFound',
    DRAWING_ALREADY_EXISTS: 'drawingAlreadyExists',
    FAILED_TO_CREATE_DRAWING: 'failedToCreateDrawing'
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