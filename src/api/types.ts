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
 * Navigation result types
 */
export interface NavigationResult {
    success: boolean;
    path?: string;
    error?: string;
}

/**
 * Selection state
 */
export interface SelectionState {
    folder: string | null;
    tag: string | null;
    files: string[];
}

/**
 * File metadata from cache
 */
export interface CachedFileData {
    path: string;
    mtime: number;
    tags: string[] | null;
    preview: string | null;
    featureImage: string | null;
    metadata: {
        name?: string;
        created?: number;
        modified?: number;
    } | null;
}

/**
 * Folder metadata
 */
export interface FolderMetadata {
    color?: string;
    icon?: string;
    appearance?: FolderAppearance;
}

/**
 * Tag metadata
 */
export interface TagMetadata {
    color?: string;
    icon?: string;
    appearance?: TagAppearance;
    isFavorite?: boolean;
}

/**
 * Event types
 */
export type NotebookNavigatorEventType = 'navigation-changed' | 'storage-ready';

/**
 * Event payloads
 */
export interface NotebookNavigatorEvents {
    'navigation-changed': { type: 'folder' | 'tag'; path: string };
    'storage-ready': void;
}

/**
 * Query options for finding files
 */
export interface FileQueryOptions {
    folder?: string;
    tag?: string;
    tags?: string[];
    hasPreview?: boolean;
    hasFeatureImage?: boolean;
    includeSubfolders?: boolean;
    limit?: number;
}

/**
 * Batch operation results
 */
export interface BatchOperationResult {
    success: number;
    failed: number;
    errors: Array<{ path: string; error: string }>;
}

/**
 * View state
 */
export interface ViewState {
    isOpen: boolean;
    isActive: boolean;
    paneWidth: number;
    dualPane: boolean;
    focusedPane: 'navigation' | 'list';
}
