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

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { strings } from '../i18n';
import { FolderNoteType, FOLDER_NOTE_TYPE_EXTENSIONS, FolderNoteCreationPreference } from '../types/folderNote';
import { createDatabaseContent } from './fileCreationUtils';
import { isExcalidrawFile, stripExcalidrawSuffix } from './fileNameUtils';
import { CommandQueueService } from '../services/CommandQueueService';
import { promptForFolderNoteType } from '../modals/FolderNoteTypeModal';
import { showNotice } from './noticeUtils';

/**
 * Settings required for detecting folder notes
 */
export interface FolderNoteDetectionSettings {
    enableFolderNotes: boolean;
    folderNoteName: string;
}

/**
 * Settings required for creating folder notes
 */
export interface FolderNoteCreationSettings {
    folderNoteType: FolderNoteCreationPreference;
    folderNoteName: string;
    folderNoteProperties: string;
}

/** Set of file extensions that are valid for folder notes */
const SUPPORTED_FOLDER_NOTE_EXTENSIONS = new Set<string>(Object.values(FOLDER_NOTE_TYPE_EXTENSIONS));

/**
 * Checks if a file extension is supported for folder notes
 * @param extension - The file extension to check
 * @returns True if the extension is supported
 */
export function isSupportedFolderNoteExtension(extension: string): boolean {
    return SUPPORTED_FOLDER_NOTE_EXTENSIONS.has(extension);
}

/**
 * Gets the folder note for a folder if it exists
 * @param folder - The folder to check for a folder note
 * @param settings - Settings for folder note detection
 * @returns The folder note file or null if not found
 */
export function getFolderNote(folder: TFolder, settings: FolderNoteDetectionSettings): TFile | null {
    if (!settings.enableFolderNotes) {
        return null;
    }

    const expectedName = settings.folderNoteName || folder.name;
    let excalidrawCandidate: TFile | null = null;

    for (const child of folder.children) {
        if (!(child instanceof TFile)) {
            continue;
        }

        if (child.parent?.path !== folder.path) {
            continue;
        }

        if (!SUPPORTED_FOLDER_NOTE_EXTENSIONS.has(child.extension)) {
            continue;
        }

        if (child.basename === expectedName) {
            // Prefer exact basename matches when both regular and Excalidraw notes exist.
            return child;
        }

        if (!excalidrawCandidate && isExcalidrawFile(child) && stripExcalidrawSuffix(child.basename) === expectedName) {
            // Keep Excalidraw variant as fallback when no exact match is present.
            excalidrawCandidate = child;
        }
    }

    return excalidrawCandidate;
}

/**
 * Checks if a file is a folder note for a given folder
 * @param file - The file to check
 * @param folder - The folder to check against
 * @param settings - Settings for folder note detection
 * @returns True if the file is a folder note for the given folder
 */
export function isFolderNote(file: TFile, folder: TFolder, settings: FolderNoteDetectionSettings): boolean {
    if (!settings.enableFolderNotes) {
        return false;
    }

    if (!SUPPORTED_FOLDER_NOTE_EXTENSIONS.has(file.extension)) {
        return false;
    }

    if (file.parent?.path !== folder.path) {
        return false;
    }

    const expectedName = settings.folderNoteName || folder.name;
    if (file.basename === expectedName) {
        return true;
    }

    if (!isExcalidrawFile(file) || stripExcalidrawSuffix(file.basename) !== expectedName) {
        return false;
    }

    // Use preferred folder note selection so plain notes win over Excalidraw variants.
    const preferred = getFolderNote(folder, settings);
    return preferred?.path === file.path;
}

/**
 * Creates a new folder note for a folder
 * @param app - The Obsidian app instance
 * @param folder - The folder to create a folder note for
 * @param settings - Settings for folder note creation
 * @param commandQueue - Optional command queue service for opening the note
 * @returns The created folder note file, or null if creation failed
 */
export async function createFolderNote(
    app: App,
    folder: TFolder,
    settings: FolderNoteCreationSettings,
    commandQueue?: CommandQueueService | null
): Promise<TFile | null> {
    const existingNote = getFolderNote(folder, {
        enableFolderNotes: true,
        folderNoteName: settings.folderNoteName
    });

    if (existingNote) {
        showNotice(strings.fileSystem.errors.folderNoteAlreadyExists, { variant: 'warning' });
        return null;
    }

    let selectedType: FolderNoteType | null = null;

    if (settings.folderNoteType === 'ask') {
        selectedType = await promptForFolderNoteType(app, folder);
        if (!selectedType) {
            return null;
        }
    } else {
        selectedType = settings.folderNoteType;
    }

    const extension = FOLDER_NOTE_TYPE_EXTENSIONS[selectedType];
    const baseName = settings.folderNoteName || folder.name;
    const noteFileName = `${baseName}.${extension}`;
    const notePath = normalizePath(`${folder.path}/${noteFileName}`);

    const conflictingItem = app.vault.getAbstractFileByPath(notePath);
    if (conflictingItem) {
        showNotice(strings.fileSystem.errors.folderNoteAlreadyExists, { variant: 'warning' });
        return null;
    }

    // Generate content based on folder note type
    let content = '';

    if (selectedType === 'markdown') {
        const trimmedBlock = settings.folderNoteProperties.replace(/\r\n/g, '\n').trim();
        if (trimmedBlock.length > 0) {
            content = `---\n${trimmedBlock}\n---\n`;
        }
    } else if (selectedType === 'canvas') {
        content = '{}';
    } else if (selectedType === 'base') {
        content = createDatabaseContent();
    }

    try {
        const file = await app.vault.create(notePath, content);
        if (commandQueue) {
            await commandQueue.executeOpenFolderNote(folder.path, async () => {
                await app.workspace.getLeaf().openFile(file);
            });
        } else {
            await app.workspace.getLeaf().openFile(file);
        }
        return file;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showNotice(strings.fileSystem.errors.createFile.replace('{error}', message), { variant: 'warning' });
    }
    return null;
}
