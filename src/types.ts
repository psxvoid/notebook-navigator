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

import { App, WorkspaceLeaf } from 'obsidian';

/**
 * Shared types and constants for Notebook Navigator
 * Centralizes type definitions used across multiple modules
 */

/**
 * Unique identifier for the Notebook Navigator view type
 * Used by Obsidian to register and manage the custom view
 */
export const VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT = 'notebook-navigator-react-view';

/**
 * Special tag identifier for untagged notes
 * Using double underscore to avoid conflicts with real tags
 */
export const UNTAGGED_TAG_ID = '__untagged__';

/**
 * Identifies which pane currently has keyboard focus
 * Used for keyboard navigation between folder tree and file list
 */
export type FocusedPane = 'navigation' | 'files';

/**
 * Enum for all item types in the navigator
 * Using const enum for better performance (inlined at compile time)
 */
export const ItemType = {
    FILE: 'file',
    FOLDER: 'folder',
    TAG: 'tag'
} as const;

/**
 * Enum for list pane item types
 * These are specific to the list pane view
 */
export const ListPaneItemType = {
    HEADER: 'header',
    FILE: 'file',
    SPACER: 'spacer'
} as const;

/**
 * Type representing all possible list pane item types
 */
export type ListPaneItemType = (typeof ListPaneItemType)[keyof typeof ListPaneItemType];

/**
 * Enum for navigation pane item types
 * These are specific to the navigation pane (left side)
 */
export const NavigationPaneItemType = {
    FOLDER: 'folder',
    VIRTUAL_FOLDER: 'virtual-folder',
    TAG: 'tag',
    UNTAGGED: 'untagged',
    SPACER: 'spacer',
    LIST_SPACER: 'list-spacer'
} as const;

/**
 * Type representing all possible navigation pane item types
 */
export type NavigationPaneItemType = (typeof NavigationPaneItemType)[keyof typeof NavigationPaneItemType];

/**
 * Navigation pane item height constants for accurate virtualization
 * Used by NavigationPane component
 */
export const NAVITEM_HEIGHTS = {
    desktop: {
        folder: 28, // Fixed height: 5px padding + 18px line-height + 5px padding
        tag: 28, // Matches folder height
        header: 35, // Tag section header
        spacer: 20, // Bottom spacer - matches FileList
        listSpacer: 10 // Spacer between lists (folders/tags)
    },
    mobile: {
        folder: 40, // Fixed height: 11px padding + 18px line-height + 11px padding
        tag: 40, // Matches folder height
        header: 38, // Slightly larger for mobile font sizes
        spacer: 20, // Bottom spacer - matches FileList
        listSpacer: 10 // Spacer between lists (folders/tags)
    }
};

/**
 * Overscan value for all virtualized lists
 * Controls how many items are rendered outside the visible area
 */
export const OVERSCAN = 10;

/**
 * List pane item height constants and measurements
 * Used by ListPane component for virtualization
 */
export const LISTPANE_MEASUREMENTS = {
    heights: {
        // Date group headers
        firstHeader: 35, // var(--nn-date-header-height)
        subsequentHeader: 50, // var(--nn-date-header-height-subsequent)

        // File item components
        basePadding: 16, // var(--nn-file-padding-vertical) * 2
        titleLineHeight: 20, // var(--nn-file-line-height) - for file name/title
        metadataLineHeight: 19, // var(--nn-file-second-line-height) - for metadata (date, parent folder, single preview line)
        multiLineLineHeight: 18, // var(--nn-file-preview-line-height) - for multi-line preview text

        // Constraints
        minTouchTargetHeight: 32, // Minimum height for touch targets
        spacer: 20 // Bottom spacer height
    }
};

/**
 * Type representing all possible item types
 */
export type ItemType = (typeof ItemType)[keyof typeof ItemType];

/**
 * Types of items that can be selected in the navigation pane
 * Either a folder from the file tree or a tag from the tag tree
 * This is a subset of ItemType that excludes 'file'
 */
export type NavigationItemType = typeof ItemType.FOLDER | typeof ItemType.TAG;

/**
 * Type guards for item types
 */
export function isFileType(type: string): type is typeof ItemType.FILE {
    return type === ItemType.FILE;
}

export function isFolderType(type: string): type is typeof ItemType.FOLDER {
    return type === ItemType.FOLDER;
}

export function isTagType(type: string): type is typeof ItemType.TAG {
    return type === ItemType.TAG;
}

/**
 * Keys used for persisting state in browser localStorage
 * Ensures consistent key naming across the plugin
 */
export interface LocalStorageKeys {
    expandedFoldersKey: string;
    expandedTagsKey: string;
    expandedVirtualFoldersKey: string;
    selectedFolderKey: string;
    selectedFileKey: string;
    navigationPaneWidthKey: string;
    fileCacheKey: string;
}

/**
 * Singleton instance of localStorage keys
 * Use this instead of defining keys in multiple places
 */
export const STORAGE_KEYS: LocalStorageKeys = {
    expandedFoldersKey: 'notebook-navigator-expanded-folders',
    expandedTagsKey: 'notebook-navigator-expanded-tags',
    expandedVirtualFoldersKey: 'notebook-navigator-expanded-virtual-folders',
    selectedFolderKey: 'notebook-navigator-selected-folder',
    selectedFileKey: 'notebook-navigator-selected-file',
    navigationPaneWidthKey: 'notebook-navigator-navigation-pane-width',
    fileCacheKey: 'notebook-navigator-file-cache'
};

/**
 * Default dimensions for the navigation pane (folder/tag tree)
 * These values are used when no saved state exists
 */
export const NAVIGATION_PANE_DIMENSIONS = {
    defaultWidth: 300,
    minWidth: 150
};

/**
 * Default dimensions for the file pane (file list)
 * The file pane uses flex: 1 so it doesn't have a defaultWidth or maxWidth
 */
export const FILE_PANE_DIMENSIONS = {
    minWidth: 150
};

/**
 * Supported file types in Notebook Navigator
 * Maps file extensions to their corresponding Obsidian leaf types
 */
const SUPPORTED_FILE_TYPES = {
    // Extension to leaf type mapping
    md: 'markdown',
    canvas: 'canvas',
    pdf: 'pdf',
    base: 'base'
} as const;

/**
 * Array of supported leaf types (derived from SUPPORTED_FILE_TYPES values)
 */
const SUPPORTED_LEAF_TYPES = Object.values(SUPPORTED_FILE_TYPES);

/**
 * Type for supported file extensions
 */
export type SupportedFileExtension = keyof typeof SUPPORTED_FILE_TYPES;

/**
 * Type for supported leaf types
 */
export type SupportedLeafType = (typeof SUPPORTED_FILE_TYPES)[SupportedFileExtension];

/**
 * Helper function to check if a file extension is supported
 */
export function isSupportedFileExtension(extension: string): extension is SupportedFileExtension {
    return extension in SUPPORTED_FILE_TYPES;
}

/**
 * Helper function to get all leaves with supported file types
 */
export function getSupportedLeaves(app: App): WorkspaceLeaf[] {
    return SUPPORTED_LEAF_TYPES.flatMap(type => app.workspace.getLeavesOfType(type));
}

/**
 * Virtual folder for organizing tags
 * These are not real folders but act like folders in the UI
 */
export interface VirtualFolder {
    /** Unique identifier for the virtual folder */
    id: string;
    /** Display name of the virtual folder */
    name: string;
    /** Optional custom icon for the virtual folder */
    icon?: string;
}

/**
 * Data attributes for drag-and-drop functionality using event delegation
 * These attributes are added to DOM elements to enable drag-drop without individual event listeners
 */
export interface DragDropAttributes {
    // Draggable element attributes
    'data-draggable'?: 'true';
    'data-drag-type'?: ItemType;
    'data-drag-path'?: string;
    'data-drag-handle'?: 'true';

    // Drop zone attributes
    'data-drop-zone'?: typeof ItemType.FOLDER;
    'data-drop-path'?: string;
    'data-drop-validator'?: typeof ItemType.FOLDER;

    // Interaction attributes
    'data-clickable'?: typeof ItemType.FOLDER | typeof ItemType.FILE;
    'data-click-path'?: string;
    'data-dblclick-action'?: 'expand' | 'preview';
    'data-context-menu'?: ItemType;

    // State attributes
    'data-expanded'?: 'true' | 'false';
    'data-selected'?: 'true' | 'false';
    'data-focused'?: 'true' | 'false';

    // Index for keyboard navigation
    'data-index'?: string;

    // Nesting level for folders
    'data-level'?: string;
}

/**
 * Combined attributes interface for DOM elements
 * Extends standard HTML attributes with our custom data attributes
 */
export interface NavigatorElementAttributes extends DragDropAttributes {
    'data-path': string; // Required path attribute for all items
    class?: string;
    draggable?: 'true' | 'false';
    'aria-label'?: string;
    'aria-expanded'?: 'true' | 'false';
    'aria-selected'?: 'true' | 'false';
}
