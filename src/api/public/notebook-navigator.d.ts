/**
 * Notebook Navigator Plugin API Type Definitions
 * Version: 1.0.1
 *
 * Download this file to your Obsidian plugin project to get TypeScript support
 * for the Notebook Navigator API.
 *
 * Usage:
 * ```typescript
 * import type { NotebookNavigatorAPI } from './notebook-navigator';
 *
 * const nn = app.plugins.plugins['notebook-navigator']?.api as NotebookNavigatorAPI;
 * if (nn) {
 *   const folder = app.vault.getFolderByPath('Projects');
 *   if (folder) {
 *     await nn.metadata.setFolderMeta(folder, { icon: 'lucide:folder-star' });
 *   }
 * }
 * ```
 */

import { TFile, TFolder, EventRef } from 'obsidian';

// Core types

/**
 * Icon string format for type-safe icon specifications
 * Must be either 'lucide:<icon-name>' or 'emoji:<emoji>'
 */
export type IconString = `lucide:${string}` | `emoji:${string}`;

/**
 * Metadata associated with a folder
 */
export interface FolderMetadata {
    /** CSS color value (hex, rgb, hsl, named colors) */
    color?: string;
    /** CSS background color value */
    backgroundColor?: string;
    /** Icon identifier in format 'lucide:<name>' or 'emoji:<unicode>' */
    icon?: IconString;
}

/**
 * Metadata associated with a tag
 */
export interface TagMetadata {
    /** CSS color value (hex, rgb, hsl, named colors) */
    color?: string;
    /** CSS background color value */
    backgroundColor?: string;
    /** Icon identifier in format 'lucide:<name>' or 'emoji:<unicode>' */
    icon?: IconString;
}

/**
 * Currently selected navigation item (folder or tag)
 * Discriminated union ensures only one can be selected at a time
 */
export type NavItem = { folder: TFolder; tag: null } | { folder: null; tag: string } | { folder: null; tag: null };

/**
 * Current file selection state in the navigator
 */
export interface SelectionState {
    /** Array of currently selected files */
    files: readonly TFile[];
    /** The file that has keyboard focus (can be null) */
    focused: TFile | null;
}

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
    context: { folder: boolean; tag: boolean };
}

/**
 * Type alias for the Map structure returned by the API for pinned notes
 * Maps file paths to their pinning context states
 */
export type Pinned = Map<string, { folder: boolean; tag: boolean }>;

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

    /** Fired when selection changes in the list pane */
    'selection-changed': {
        state: SelectionState;
    };

    /** Fired when pinned files change */
    'pinned-files-changed': {
        /** All currently pinned files with their context information as a Map */
        files: Readonly<Pinned>;
    };

    /** Fired when folder metadata changes */
    'folder-changed': {
        folder: TFolder;
        metadata: FolderMetadata;
    };

    /** Fired when tag metadata changes */
    'tag-changed': {
        tag: string;
        metadata: TagMetadata;
    };
}

/**
 * Main Notebook Navigator API interface
 * @version 1.0.1
 */
export interface NotebookNavigatorAPI {
    /** Get the API version string */
    getVersion(): string;

    /** Check if storage system is ready for metadata operations */
    isStorageReady(): boolean;

    /** Metadata operations for folders, tags, and pinned files */
    metadata: {
        // Folder metadata
        /** Get all metadata for a folder */
        getFolderMeta(folder: TFolder): FolderMetadata | null;
        /** Set folder metadata (color and/or icon). Pass null to clear a property */
        setFolderMeta(folder: TFolder, meta: Partial<FolderMetadata>): Promise<void>;

        // Tag metadata
        /** Get all metadata for a tag */
        getTagMeta(tag: string): TagMetadata | null;
        /** Set tag metadata (color and/or icon). Pass null to clear a property */
        setTagMeta(tag: string, meta: Partial<TagMetadata>): Promise<void>;

        // Pinned files
        /** Get all pinned files with their context information as a Map */
        getPinned(): Readonly<Pinned>;
        /** Check if a file is pinned (no context = any, 'all' = both) */
        isPinned(file: TFile, context?: PinContext): boolean;
        /** Pin a file (defaults to 'all' - both contexts) */
        pin(file: TFile, context?: PinContext): Promise<void>;
        /** Unpin a file (defaults to 'all' - both contexts) */
        unpin(file: TFile, context?: PinContext): Promise<void>;
    };

    /** Navigation operations */
    navigation: {
        /** Reveal and select a file in the navigator */
        reveal(file: TFile): Promise<void>;
    };

    /** Query current selection state */
    selection: {
        /** Get the currently selected folder or tag in navigation pane */
        getNavItem(): NavItem;
        /** Get current file selection state */
        getCurrent(): SelectionState;
    };

    // Event subscription
    /** Subscribe to navigator events with type safety */
    on<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void): EventRef;
    /** Subscribe to an event only once - automatically unsubscribes after first trigger */
    once<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void): EventRef;
    /** Unsubscribe from an event */
    off(ref: EventRef): void;
}

/**
 * API Changelog
 *
 * Version 1.0.1 (2025-09-16)
 * - Added backgroundColor property to FolderMetadata and TagMetadata interfaces
 *
 * Version 1.0.0 (2025-09-15)
 * - Initial public API release
 */
