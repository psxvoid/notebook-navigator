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

import { App, Notice, TFile, TFolder, normalizePath } from 'obsidian';
import { strings } from '../i18n';
import { FolderNoteType, FOLDER_NOTE_TYPE_EXTENSIONS } from '../types/folderNote';
import { createDatabaseContent } from './fileCreationUtils';
import { CommandQueueService } from '../services/CommandQueueService';

export interface FolderNoteDetectionSettings {
    enableFolderNotes: boolean;
    folderNoteName: string;
}

export interface FolderNoteCreationSettings {
    folderNoteType: FolderNoteType;
    folderNoteName: string;
    folderNoteProperties: string[];
}

const SUPPORTED_FOLDER_NOTE_EXTENSIONS = new Set<string>(Object.values(FOLDER_NOTE_TYPE_EXTENSIONS));

export function getFolderNote(folder: TFolder, settings: FolderNoteDetectionSettings): TFile | null {
    if (!settings.enableFolderNotes) {
        return null;
    }

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

        const expectedName = settings.folderNoteName || folder.name;
        if (child.basename === expectedName) {
            return child;
        }
    }

    return null;
}

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
    return file.basename === expectedName;
}

export async function createFolderNote(
    app: App,
    folder: TFolder,
    settings: FolderNoteCreationSettings,
    commandQueue?: CommandQueueService | null
): Promise<void> {
    const extension = FOLDER_NOTE_TYPE_EXTENSIONS[settings.folderNoteType];
    const baseName = settings.folderNoteName || folder.name;
    const noteFileName = `${baseName}.${extension}`;
    const notePath = normalizePath(`${folder.path}/${noteFileName}`);

    const existingNote = getFolderNote(folder, {
        enableFolderNotes: true,
        folderNoteName: settings.folderNoteName
    });

    if (existingNote) {
        new Notice(strings.fileSystem.errors.folderNoteAlreadyExists);
        return;
    }

    const conflictingItem = app.vault.getAbstractFileByPath(notePath);
    if (conflictingItem) {
        new Notice(strings.fileSystem.errors.folderNoteAlreadyExists);
        return;
    }

    let content = '';

    if (settings.folderNoteType === 'markdown') {
        if (settings.folderNoteProperties.length > 0) {
            const properties = settings.folderNoteProperties.map(prop => `${prop}: true`).join('\n');
            content = `---\n${properties}\n---\n`;
        }
    } else if (settings.folderNoteType === 'canvas') {
        content = '{}';
    } else if (settings.folderNoteType === 'base') {
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
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(strings.fileSystem.errors.createFile.replace('{error}', message));
    }
}
