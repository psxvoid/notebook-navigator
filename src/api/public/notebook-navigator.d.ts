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
 * Metadata associated with a folder
 */
export interface FolderMetadata {
    /** CSS color value (hex, rgb, hsl, named colors) */
    color?: string;
    /** Icon identifier in format 'lucide:<name>' or 'emoji:<unicode>' */
    icon?: string;
}

/**
 * Metadata associated with a tag
 */
export interface TagMetadata {
    /** CSS color value (hex, rgb, hsl, named colors) */
    color?: string;
    /** Icon identifier in format 'lucide:<name>' or 'emoji:<unicode>' */
    icon?: string;
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
 * Current file selection state in the navigator
 */
export interface SelectionState {
    /** Array of currently selected files */
    files: TFile[];
    /** The file that has keyboard focus (can be null) */
    focused: TFile | null;
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
        delete(files: TFile[]): Promise<void>;
        /** Move files to a target folder */
        move(files: TFile[], folder: TFolder): Promise<MoveResult>;
    };

    /** Metadata operations for folders, tags, and pinned files */
    metadata: {
        // Folder metadata
        /** Get all metadata for a folder */
        getFolderMeta(folder: TFolder): FolderMetadata | null;
        /** Set folder color (any CSS color format) */
        setFolderColor(folder: TFolder, color: string): Promise<void>;
        /** Remove folder color */
        clearFolderColor(folder: TFolder): Promise<void>;
        /** Set folder icon ('lucide:name' or 'emoji:📁') */
        setFolderIcon(folder: TFolder, icon: string): Promise<void>;
        /** Remove folder icon */
        clearFolderIcon(folder: TFolder): Promise<void>;

        // Tag metadata
        /** Get all metadata for a tag */
        getTagMeta(tag: string): TagMetadata | null;
        /** Set tag color (any CSS color format) */
        setTagColor(tag: string, color: string): Promise<void>;
        /** Remove tag color */
        clearTagColor(tag: string): Promise<void>;
        /** Set tag icon ('lucide:name' or 'emoji:🏷️') */
        setTagIcon(tag: string, icon: string): Promise<void>;
        /** Remove tag icon */
        clearTagIcon(tag: string): Promise<void>;

        // Pinned files
        /** Get all pinned files */
        getPinned(): TFile[];
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
        getNavItem(): { folder: TFolder | null; tag: string | null };
        /** Get current file selection state */
        getCurrent(): SelectionState;
    };

    // Event subscription
    /** Subscribe to navigator events */
    on(event: string, callback: (data: unknown) => void): EventRef;
    /** Unsubscribe from an event */
    off(ref: EventRef): void;
}
