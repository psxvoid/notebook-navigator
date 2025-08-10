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
}

/**
 * Metadata for customizing tag appearance in the navigator
 */
export interface TagMetadata {
    /** Hex color code or CSS color name */
    color?: string;
    /** Icon identifier (e.g., 'lucide:tag' or 'emoji:🏷️') */
    icon?: string;
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

    /** Fired when a folder is selected in navigation pane */
    'folder-selected': {
        folder: TFolder;
    };

    /** Fired when a tag is selected in navigation pane */
    'tag-selected': {
        tag: string;
    };

    /** Fired when file selection changes in the list pane */
    'file-selection-changed': {
        /** Array of selected TFile objects */
        files: TFile[];
        /** The focused file (cursor position) */
        focused: TFile | null;
    };

    /** Fired when pinned files change */
    'pinned-files-changed': {
        /** All currently pinned files */
        files: TFile[];
    };

    /** Fired when folder metadata changes */
    'folder-metadata-changed': {
        folder: TFolder;
        property: 'color' | 'icon';
    };

    /** Fired when tag metadata changes */
    'tag-metadata-changed': {
        tag: string;
        property: 'color' | 'icon';
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
    focused: TFile | null;
}
