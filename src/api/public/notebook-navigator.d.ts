/**
 * Notebook Navigator Plugin API Type Definitions
 * Version: 1.0.0
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
 *   await nn.file.delete([file]);
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
    /** Icon identifier in format 'lucide:<name>' or 'emoji:<unicode>' */
    icon?: IconString;
}

/**
 * Metadata associated with a tag
 */
export interface TagMetadata {
    /** CSS color value (hex, rgb, hsl, named colors) */
    color?: string;
    /** Icon identifier in format 'lucide:<name>' or 'emoji:<unicode>' */
    icon?: IconString;
}

/**
 * Result of a file move operation
 */
export interface MoveResult {
    /** Number of files successfully moved */
    movedCount: number;
    /** Number of files skipped (already exist at destination) */
    skippedCount: number;
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
        /** All currently pinned files */
        files: readonly TFile[];
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

/**
 * Main Notebook Navigator API interface
 * @version 1.0.0
 */
export interface NotebookNavigatorAPI {
    /** Get the API version string */
    getVersion(): string;

    /** File operations with smart selection management */
    file: {
        /** Delete files (moves to trash) */
        deleteFiles(files: TFile[]): Promise<void>;
        /** Move files to a target folder */
        moveFiles(files: TFile[], folder: TFolder): Promise<MoveResult>;
    };

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
        /** Get all pinned files */
        getPinned(): readonly TFile[];
        /** Check if a file is pinned */
        isPinned(file: TFile): boolean;
        /** Pin a file to the top of file lists */
        pin(file: TFile): Promise<void>;
        /** Unpin a file */
        unpin(file: TFile): Promise<void>;
        /** Toggle pin status of a file */
        togglePin(file: TFile): Promise<void>;
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
    /** Unsubscribe from an event */
    off(ref: EventRef): void;
}
