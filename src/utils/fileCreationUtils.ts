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
import { TIMEOUTS, OBSIDIAN_COMMANDS } from '../types/obsidian-extended';
import { executeCommand } from './typeGuards';
import { showNotice } from './noticeUtils';

/**
 * Options for creating a new file
 */
export interface CreateFileOptions {
    /** The file extension (without dot) */
    extension: string;
    /** Initial content for the file */
    content?: string;
    /** Whether to open the file after creation */
    openFile?: boolean;
    /** Whether to trigger rename mode after opening */
    triggerRename?: boolean;
    /** Custom error message key */
    errorKey?: string;
}

/**
 * Generates a unique filename by appending a number if the file already exists
 * @param folderPath - The folder path where the file will be created
 * @param baseName - The base name of the file (without extension)
 * @param extension - The file extension (without dot)
 * @param app - The Obsidian app instance
 * @returns A unique filename
 */
export function generateUniqueFilename(folderPath: string, baseName: string, extension: string, app: App): string {
    let fileName = baseName;
    let counter = 1;

    const makePath = (name: string) => {
        const base = folderPath === '/' ? '' : `${folderPath}/`;
        if (!extension) {
            return normalizePath(`${base}${name}`);
        }
        return normalizePath(`${base}${name}.${extension}`);
    };

    let path = makePath(fileName);

    // Keep incrementing until we find a unique name
    while (app.vault.getFileByPath(path)) {
        fileName = `${baseName} ${counter}`;
        path = makePath(fileName);
        counter++;
    }

    return fileName;
}

/**
 * Creates a new file with the specified options
 * This helper eliminates code duplication across createNewFile, createCanvas, createBase, etc.
 *
 * @param parent - The parent folder to create the file in
 * @param app - The Obsidian app instance
 * @param options - File creation options
 * @returns The created file or null if creation failed
 */
export async function createFileWithOptions(parent: TFolder, app: App, options: CreateFileOptions): Promise<TFile | null> {
    const { extension, content = '', openFile = true, triggerRename = true, errorKey = 'createFile' } = options;

    try {
        // Generate unique file path
        const baseName = strings.fileSystem.defaultNames.untitled;
        const fileName = generateUniqueFilename(parent.path, baseName, extension, app);
        let file: TFile;

        if (extension === 'md' && content.length === 0) {
            file = await app.fileManager.createNewMarkdownFile(parent, fileName);
        } else {
            const base = parent.path === '/' ? '' : `${parent.path}/`;
            const suffix = extension ? `.${extension}` : '';
            const path = normalizePath(`${base}${fileName}${suffix}`);
            file = await app.vault.create(path, content);
        }

        // Open the file if requested
        if (openFile) {
            const leaf = app.workspace.getLeaf(false);
            const openState = extension === 'md' ? { state: { mode: 'source' }, active: true } : undefined;
            await leaf.openFile(file, openState);

            // Trigger rename mode if requested
            if (triggerRename) {
                // We use setTimeout to push this command to the end of the event queue.
                // This gives Obsidian's workspace time to finish opening the file and rendering the editor,
                // making it more likely that the 'edit-file-title' command will find an active editor title to focus.
                // Note: This is a known workaround for a race condition in Obsidian and may fail on slower systems.
                window.setTimeout(() => {
                    executeCommand(app, OBSIDIAN_COMMANDS.EDIT_FILE_TITLE);
                }, TIMEOUTS.FILE_OPERATION_DELAY);
            }
        }

        return file;
    } catch (error: unknown) {
        // Type-safe error message lookup
        const errorMessages = strings.fileSystem.errors as Record<string, string>;
        // Safely extract error message handling non-Error exceptions
        const errorText = error instanceof Error ? error.message : String(error);
        const errorMessage = errorMessages[errorKey]?.replace('{error}', errorText) || `Failed to create file: ${errorText}`;
        showNotice(errorMessage, { variant: 'warning' });
        return null;
    }
}

/**
 * Creates initial content for a database (.base) file
 */
export function createDatabaseContent(): string {
    return JSON.stringify(
        {
            model: {
                version: 1,
                kind: 'Table',
                columns: []
            },
            pluginVersion: '1.0.0'
        },
        null,
        2
    );
}
