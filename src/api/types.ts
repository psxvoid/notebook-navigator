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

import { FolderAppearance, TagAppearance } from '../hooks/useListPaneAppearance';

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
export interface NavigationResult {
    /** Whether the navigation was successful */
    success: boolean;
    /** Path of the navigated item (if successful) */
    path?: string;
    /** Error message (if failed) */
    error?: string;
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * All available event types that can be subscribed to
 */
export type NotebookNavigatorEventType =
    | 'navigation-changed' // User navigated to a different folder or tag
    | 'storage-ready' // Storage system is initialized and ready
    | 'file-selection-changed'; // File selection changed in the list pane

/**
 * Event payload definitions for each event type
 */
export interface NotebookNavigatorEvents {
    /** Fired when user navigates to a different folder or tag */
    'navigation-changed': {
        type: 'folder' | 'tag';
        path: string;
    };

    /** Fired when the storage system is ready for queries */
    'storage-ready': void;

    /** Fired when file selection changes in the list pane */
    'file-selection-changed': {
        /** Array of selected file paths */
        files: string[];
        /** Number of selected files */
        count: number;
    };
}
