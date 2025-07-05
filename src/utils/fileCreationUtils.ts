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

import { App, TFile, TFolder, Notice, normalizePath } from 'obsidian';
import { strings } from '../i18n';
import { executeCommand } from './typeGuards';
import { TIMEOUTS, OBSIDIAN_COMMANDS } from '../types/obsidian-extended';

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
 * Generates a unique filename with incrementing numbers
 * @param parent - The parent folder
 * @param baseName - The base filename (without extension)
 * @param extension - The file extension
 * @param app - The Obsidian app instance
 * @returns A unique file path
 */
export function generateUniqueFilePath(
    parent: TFolder,
    baseName: string,
    extension: string,
    app: App
): string {
    let fileName = baseName;
    let counter = 1;
    let path = normalizePath(
        parent.path ? `${parent.path}/${fileName}.${extension}` : `${fileName}.${extension}`
    );
    
    // Keep incrementing until we find a unique name
    while (app.vault.getAbstractFileByPath(path)) {
        fileName = strings.fileSystem.defaultNames.untitledNumber.replace('{number}', counter.toString());
        path = normalizePath(
            parent.path ? `${parent.path}/${fileName}.${extension}` : `${fileName}.${extension}`
        );
        counter++;
    }
    
    return path;
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
export async function createFileWithOptions(
    parent: TFolder,
    app: App,
    options: CreateFileOptions
): Promise<TFile | null> {
    const {
        extension,
        content = '',
        openFile = true,
        triggerRename = true,
        errorKey = 'createFile'
    } = options;
    
    try {
        // Generate unique file path
        const path = generateUniqueFilePath(
            parent,
            strings.fileSystem.defaultNames.untitled,
            extension,
            app
        );
        
        // Create the file
        const file = await app.vault.create(path, content);
        
        // Open the file if requested
        if (openFile) {
            const leaf = app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            // Trigger rename mode if requested
            if (triggerRename) {
                // We use setTimeout to push this command to the end of the event queue.
                // This gives Obsidian's workspace time to finish opening the file and rendering the editor,
                // making it more likely that the 'edit-file-title' command will find an active editor title to focus.
                // Note: This is a known workaround for a race condition in Obsidian and may fail on slower systems.
                setTimeout(() => {
                    executeCommand(app, OBSIDIAN_COMMANDS.EDIT_FILE_TITLE);
                }, TIMEOUTS.RENAME_MODE_DELAY);
            }
        }
        
        return file;
    } catch (error) {
        // Type-safe error message lookup
        const errorMessages = strings.fileSystem.errors as Record<string, string>;
        const errorMessage = errorMessages[errorKey]?.replace('{error}', error.message) 
            || `Failed to create file: ${error.message}`;
        new Notice(errorMessage);
        return null;
    }
}

/**
 * Creates initial content for a database (.base) file
 */
export function createDatabaseContent(): string {
    return JSON.stringify({
        "model": {
            "version": 1,
            "kind": "Table",
            "columns": []
        },
        "pluginVersion": "1.0.0"
    }, null, 2);
}

/**
 * Creates initial content for an Excalidraw drawing
 * @param timestamp - ISO timestamp for the drawing
 */
export function createExcalidrawContent(timestamp: string): string {
    return `---

excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==


# Text Elements
# Embedded files
# Drawing
\`\`\`json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.0.0",
  "elements": [],
  "appState": {
    "gridSize": null,
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
\`\`\`
%%`;
}