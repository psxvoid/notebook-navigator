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

import { TFile, TFolder, EventRef } from 'obsidian';

/**
 * Notebook Navigator Public API Types
 *
 * These types are exposed to external plugins through the API.
 * The API consistently uses Obsidian's native types (TFile, TFolder)
 * rather than string paths for better type safety and integration.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Type-safe tag reference
 */
export type TagRef = `#${string}`;

// ============================================================================
// APPEARANCE TYPES (moved from internal hooks)
// ============================================================================

/**
 * Display settings for files in a folder
 */
export interface FolderAppearance {
    showPreview?: boolean;
    showImage?: boolean;
    layoutStyle?: 'list' | 'grid' | 'card';
}

/**
 * Display settings for files with a tag
 */
export interface TagAppearance {
    showPreview?: boolean;
    showImage?: boolean;
    layoutStyle?: 'list' | 'grid' | 'card';
}

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * Metadata for customizing folder appearance in the navigator
 */
export interface FolderMetadata {
    /** Hex color code or CSS color name */
    color?: string;
    /** Icon identifier (e.g., 'lucide:folder' or 'emoji:📁') */
    icon?: string;
    /** Display settings for files in this folder */
    appearance?: FolderAppearance;
}

/**
 * Metadata for customizing tag appearance in the navigator
 */
export interface TagMetadata {
    /** Hex color code or CSS color name */
    color?: string;
    /** Icon identifier (e.g., 'lucide:tag' or 'emoji:🏷️') */
    icon?: string;
    /** Display settings for files with this tag */
    appearance?: TagAppearance;
    /** Whether this tag is marked as a favorite */
    isFavorite?: boolean;
}

// ============================================================================
// OPERATION RESULTS
// ============================================================================

/**
 * Result of a navigation operation
 */
export type NavigationResult = { success: true; target: TFile | TFolder | TagRef } | { success: false; error: string };

/**
 * Result of a file delete operation
 */
export interface DeleteResult {
    /** Number of files successfully deleted */
    deletedCount: number;
    /** Array of errors if any */
    errors: Array<{
        file: TFile;
        error: string;
    }>;
}

/**
 * Result of a file move operation
 */
export interface MoveResult {
    /** Number of files successfully moved */
    movedCount: number;
    /** Array of errors if any */
    errors: Array<{
        file: TFile;
        error: string;
    }>;
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * All available event types that can be subscribed to
 */
export type NotebookNavigatorEventType = keyof NotebookNavigatorEvents;

/**
 * Event payload definitions for each event type
 */
export interface NotebookNavigatorEvents {
    /** Fired when user navigates to a different folder or tag */
    'navigation-changed': {
        type: 'folder' | 'tag';
        path: string | TagRef;
        folder?: TFolder;
        tag?: TagRef;
    };

    /** Fired when the storage system is ready for queries */
    'storage-ready': void;

    /** Fired when file selection changes in the list pane */
    'file-selection-changed': {
        /** Array of selected TFile objects */
        files: TFile[];
        /** Array of selected file paths */
        paths: string[];
        /** The focused file (cursor position) */
        focused: TFile | null;
    };

    /** Fired when pinned files change */
    'pinned-files-changed': {
        files: TFile[];
        action: 'pin' | 'unpin' | 'toggle';
    };

    /** Fired when metadata changes for folders or tags */
    'metadata-changed': {
        scope: 'folder' | 'tag';
        key: 'color' | 'icon' | 'appearance';
        target: TFolder | TagRef;
    };
}

// ============================================================================
// SELECTION STATE
// ============================================================================

/**
 * Current file selection state
 */
export interface SelectionState {
    files: TFile[];
    paths: string[];
    focused: TFile | null;
}

// ============================================================================
// EVENT BUS
// ============================================================================

/**
 * Type-safe event subscription interface
 */
export interface EventBus {
    on<K extends NotebookNavigatorEventType>(type: K, cb: (payload: NotebookNavigatorEvents[K]) => void): EventRef;
    off(ref: EventRef): void;
}
