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

/**
 * Notebook Navigator Public API Types
 *
 * These types are exposed to external plugins through the API.
 * The API consistently uses Obsidian's native types (TFile, TFolder)
 * rather than string paths for better type safety and integration.
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Icon string format for type-safe icon specifications
 * Must be either 'lucide:<icon-name>' or 'emoji:<emoji>'
 */
export type IconString = `lucide:${string}` | `emoji:${string}`;

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * Metadata for customizing folder appearance in the navigator
 */
export interface FolderMetadata {
    /** CSS color value (hex, rgb, hsl, named colors) */
    color?: string;
    /** Icon identifier (e.g., 'lucide:folder' or 'emoji:📁') */
    icon?: IconString;
}

/**
 * Metadata for customizing tag appearance in the navigator
 */
export interface TagMetadata {
    /** CSS color value (hex, rgb, hsl, named colors) */
    color?: string;
    /** Icon identifier (e.g., 'lucide:tag' or 'emoji:🏷️') */
    icon?: IconString;
}

// ============================================================================
// PIN CONTEXT TYPES
// ============================================================================

/**
 * Context where a note can be pinned
 * - 'folder': Pin appears when viewing folders
 * - 'tag': Pin appears when viewing tags
 * - 'all': Pin appears in both folder and tag views
 */
export type PinContext = 'folder' | 'tag' | 'all';

/**
 * Pinned file with context information
 */
export interface PinnedFile {
    /** The pinned file */
    file: TFile;
    /** Which context the file is pinned in */
    context: {
        /** Whether pinned in folder context */
        folder: boolean;
        /** Whether pinned in tag context */
        tag: boolean;
    };
}

// ============================================================================
// OPERATION RESULTS
// ============================================================================

/**
 * Result of a file move operation
 */
export interface MoveResult {
    /** Number of files successfully moved */
    movedCount: number;
    /** Number of files skipped (already exist at destination) */
    skippedCount: number;
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
    /** Fired when the storage system is ready for queries */
    'storage-ready': void;

    /** Fired when the navigation selection changes (folder, tag, or nothing) */
    'nav-item-changed': {
        item: NavItem;
    };

    /** Fired when file selection changes in the list pane */
    'file-selection-changed': {
        /** Array of selected TFile objects */
        files: readonly TFile[];
        /** The focused file (cursor position) */
        focused: TFile | null;
    };

    /** Fired when pinned files change */
    'pinned-files-changed': {
        /** All currently pinned files with their context information */
        files: readonly PinnedFile[];
    };

    /** Fired when folder metadata changes */
    'folder-metadata-changed': {
        folder: TFolder;
        metadata: FolderMetadata;
    };

    /** Fired when tag metadata changes */
    'tag-metadata-changed': {
        tag: string;
        metadata: TagMetadata;
    };
}

// ============================================================================
// SELECTION STATE
// ============================================================================

/**
 * Currently selected navigation item (folder or tag)
 * Discriminated union ensures only one can be selected at a time
 */
export type NavItem = { folder: TFolder; tag: null } | { folder: null; tag: string } | { folder: null; tag: null };

/**
 * Current file selection state
 */
export interface SelectionState {
    /** Array of currently selected files */
    files: readonly TFile[];
    /** The file that has keyboard focus (can be null) */
    focused: TFile | null;
}
