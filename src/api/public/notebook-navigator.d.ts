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

export interface FolderMetadata {
    color?: string; // Any valid CSS color
    icon?: string; // 'lucide:<name>' or 'emoji:<unicode>'
}

export interface TagMetadata {
    color?: string;
    icon?: string;
}

export interface MoveResult {
    movedCount: number;
    skippedCount: number;
}

export interface SelectionState {
    files: TFile[];
    focused: TFile | null;
}

// Main API interface
export interface NotebookNavigatorAPI {
    getVersion(): string;

    file: {
        delete(files: TFile[]): Promise<void>;
        moveTo(files: TFile[], folder: TFolder): Promise<MoveResult>;
    };

    metadata: {
        // Folders
        getFolderMetadata(folder: TFolder): FolderMetadata | null;
        setFolderColor(folder: TFolder, color: string): Promise<void>;
        clearFolderColor(folder: TFolder): Promise<void>;
        setFolderIcon(folder: TFolder, icon: string): Promise<void>;
        clearFolderIcon(folder: TFolder): Promise<void>;

        // Tags
        getTagMetadata(tag: string): TagMetadata | null;
        setTagColor(tag: string, color: string): Promise<void>;
        clearTagColor(tag: string): Promise<void>;
        setTagIcon(tag: string, icon: string): Promise<void>;
        clearTagIcon(tag: string): Promise<void>;

        // Pins
        listPinnedFiles(): TFile[];
        isPinned(file: TFile): boolean;
        pin(file: TFile): Promise<void>;
        unpin(file: TFile): Promise<void>;
        togglePin(file: TFile): Promise<void>;
    };

    navigation: {
        navigateToFile(file: TFile): Promise<void>;
    };

    selection: {
        getSelectedNavigationItem(): { folder: TFolder | null; tag: string | null };
        getSelectionState(): SelectionState;
    };

    // Events
    on(event: string, callback: (data: unknown) => void): EventRef;
    off(ref: EventRef): void;
}
