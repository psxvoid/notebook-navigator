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

import { App, TFile, TFolder, TAbstractFile, Notice, normalizePath } from 'obsidian';
import { InputModal } from '../modals/InputModal';
import { ConfirmModal } from '../modals/ConfirmModal';

/**
 * Handles all file system operations for the Notebook Navigator
 * Provides centralized methods for creating, renaming, and deleting files/folders
 * Manages user input modals and confirmation dialogs
 */
export class FileSystemOperations {
    /**
     * Creates a new FileSystemOperations instance
     * @param app - The Obsidian app instance for vault operations
     */
    constructor(private app: App) {}

    /**
     * Creates a new folder with user-provided name
     * Shows input modal for folder name and handles creation
     * @param parent - The parent folder to create the new folder in
     * @param onSuccess - Optional callback with the new folder path on successful creation
     */
    async createNewFolder(parent: TFolder, onSuccess?: (path: string) => void): Promise<void> {
        const modal = new InputModal(this.app, 'New folder', 'Enter folder name:', async (name) => {
            if (name) {
                try {
                    const path = normalizePath(parent.path ? `${parent.path}/${name}` : name);
                    await this.app.vault.createFolder(path);
                    if (onSuccess) {
                        onSuccess(path);
                    }
                } catch (error) {
                    new Notice(`Failed to create folder: ${error.message}`);
                }
            }
        });
        modal.open();
    }

    /**
     * Creates a new markdown file with auto-generated "Untitled" name
     * Automatically increments name if "Untitled" already exists
     * Opens the file and triggers rename mode for immediate naming
     * @param parent - The parent folder to create the file in
     * @returns The created file or null if creation failed
     */
    async createNewFile(parent: TFolder): Promise<TFile | null> {
        try {
            // Generate unique "Untitled" name
            let fileName = "Untitled";
            let counter = 1;
            let path = normalizePath(parent.path ? `${parent.path}/${fileName}.md` : `${fileName}.md`);
            
            // Check if file exists and increment counter
            while (this.app.vault.getAbstractFileByPath(path)) {
                fileName = `Untitled ${counter}`;
                path = normalizePath(parent.path ? `${parent.path}/${fileName}.md` : `${fileName}.md`);
                counter++;
            }
            
            // Create the file
            const file = await this.app.vault.create(path, '');
            
            // Open the file
            this.app.workspace.getLeaf(false).openFile(file);
            
            return file;
        } catch (error) {
            new Notice(`Failed to create file: ${error.message}`);
            return null;
        }
    }

    /**
     * Renames a folder with user-provided name
     * Shows input modal pre-filled with current name
     * Validates that new name is different from current
     * @param folder - The folder to rename
     */
    async renameFolder(folder: TFolder): Promise<void> {
        const modal = new InputModal(this.app, 'Rename folder', 'Enter new name:', async (newName) => {
            if (newName && newName !== folder.name) {
                try {
                    const newPath = normalizePath(folder.parent?.path 
                        ? `${folder.parent.path}/${newName}` 
                        : newName);
                    await this.app.fileManager.renameFile(folder, newPath);
                } catch (error) {
                    new Notice(`Failed to rename folder: ${error.message}`);
                }
            }
        }, folder.name);
        modal.open();
    }

    /**
     * Renames a file with user-provided name
     * Shows input modal pre-filled with current basename
     * Preserves original file extension if not provided in new name
     * @param file - The file to rename
     */
    async renameFile(file: TFile): Promise<void> {
        const modal = new InputModal(this.app, 'Rename file', 'Enter new name:', async (newName) => {
            if (newName && newName !== file.basename) {
                try {
                    // Preserve original extension if not provided
                    if (!newName.includes('.')) {
                        newName += `.${file.extension}`;
                    }
                    const newPath = normalizePath(file.parent?.path 
                        ? `${file.parent.path}/${newName}` 
                        : newName);
                    await this.app.fileManager.renameFile(file, newPath);
                } catch (error) {
                    new Notice(`Failed to rename file: ${error.message}`);
                }
            }
        }, file.basename);
        modal.open();
    }

    /**
     * Deletes a folder and all its contents
     * Shows confirmation dialog if confirmBeforeDelete is true
     * Recursively deletes all files and subfolders
     * @param folder - The folder to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback on successful deletion
     */
    async deleteFolder(folder: TFolder, confirmBeforeDelete: boolean, onSuccess?: () => void): Promise<void> {
        if (confirmBeforeDelete) {
            const confirmModal = new ConfirmModal(
                this.app,
                `Delete "${folder.name}"?`,
                `Are you sure you want to delete this folder and all its contents?`,
                async () => {
                    try {
                        await this.app.vault.delete(folder, true);
                        if (onSuccess) {
                            onSuccess();
                        }
                    } catch (error) {
                        new Notice(`Failed to delete folder: ${error.message}`);
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            try {
                await this.app.vault.delete(folder, true);
                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                new Notice(`Failed to delete folder: ${error.message}`);
            }
        }
    }

    /**
     * Deletes a file from the vault
     * Shows confirmation dialog if confirmBeforeDelete is true
     * @param file - The file to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback on successful deletion
     */
    async deleteFile(file: TFile, confirmBeforeDelete: boolean, onSuccess?: () => void): Promise<void> {
        if (confirmBeforeDelete) {
            const confirmModal = new ConfirmModal(
                this.app,
                `Delete "${file.basename}"?`,
                `Are you sure you want to delete this file?`,
                async () => {
                    try {
                        await this.app.vault.delete(file);
                        if (onSuccess) {
                            onSuccess();
                        }
                    } catch (error) {
                        new Notice(`Failed to delete file: ${error.message}`);
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            try {
                await this.app.vault.delete(file);
                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                new Notice(`Failed to delete file: ${error.message}`);
            }
        }
    }

    /**
     * Checks if one file/folder is a descendant of another
     * Used to prevent invalid drag-and-drop operations
     * Prevents moving a folder into its own subfolder
     * @param parent - The potential parent file/folder
     * @param child - The potential descendant file/folder
     * @returns True if child is a descendant of parent
     */
    isDescendant(parent: TAbstractFile, child: TAbstractFile): boolean {
        let current = child.parent;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    /**
     * Duplicates a file with an incremented name
     * @param file - The file to duplicate
     */
    async duplicateNote(file: TFile): Promise<void> {
        try {
            const baseName = file.basename;
            const extension = file.extension;
            let counter = 1;
            let newName = `${baseName} ${counter}`;
            let newPath = normalizePath(file.parent ? `${file.parent.path}/${newName}.${extension}` : `${newName}.${extension}`);
            
            while (this.app.vault.getAbstractFileByPath(newPath)) {
                counter++;
                newName = `${baseName} ${counter}`;
                newPath = normalizePath(file.parent ? `${file.parent.path}/${newName}.${extension}` : `${newName}.${extension}`);
            }
            
            const content = await this.app.vault.read(file);
            const newFile = await this.app.vault.create(newPath, content);
            
            this.app.workspace.getLeaf(false).openFile(newFile);
        } catch (error) {
            new Notice(`Failed to duplicate note: ${error.message}`);
        }
    }

    /**
     * Creates a new canvas file in the specified folder
     * @param parent - The parent folder
     */
    async createCanvas(parent: TFolder): Promise<void> {
        try {
            let fileName = "Untitled";
            let counter = 1;
            let path = normalizePath(parent.path ? `${parent.path}/${fileName}.canvas` : `${fileName}.canvas`);
            
            while (this.app.vault.getAbstractFileByPath(path)) {
                fileName = `Untitled ${counter}`;
                path = normalizePath(parent.path ? `${parent.path}/${fileName}.canvas` : `${fileName}.canvas`);
                counter++;
            }
            
            const file = await this.app.vault.create(path, '{}');
            this.app.workspace.getLeaf(false).openFile(file);
        } catch (error) {
            new Notice(`Failed to create canvas: ${error.message}`);
        }
    }

    /**
     * Creates a new database view file in the specified folder
     * @param parent - The parent folder
     */
    async createBase(parent: TFolder): Promise<void> {
        try {
            let fileName = "Untitled";
            let counter = 1;
            let path = normalizePath(parent.path ? `${parent.path}/${fileName}.base` : `${fileName}.base`);
            
            while (this.app.vault.getAbstractFileByPath(path)) {
                fileName = `Untitled ${counter}`;
                path = normalizePath(parent.path ? `${parent.path}/${fileName}.base` : `${fileName}.base`);
                counter++;
            }
            
            const content = JSON.stringify({
                "model": {
                    "version": 1,
                    "kind": "Table",
                    "columns": []
                },
                "pluginVersion": "1.0.0"
            }, null, 2);
            
            const file = await this.app.vault.create(path, content);
            this.app.workspace.getLeaf(false).openFile(file);
        } catch (error) {
            new Notice(`Failed to create database: ${error.message}`);
        }
    }

    /**
     * Duplicates a folder and all its contents
     * @param folder - The folder to duplicate
     */
    async duplicateFolder(folder: TFolder): Promise<void> {
        try {
            const baseName = folder.name;
            let counter = 1;
            let newName = `${baseName} ${counter}`;
            let newPath = normalizePath(folder.parent ? `${folder.parent.path}/${newName}` : newName);
            
            while (this.app.vault.getAbstractFileByPath(newPath)) {
                counter++;
                newName = `${baseName} ${counter}`;
                newPath = normalizePath(folder.parent ? `${folder.parent.path}/${newName}` : newName);
            }
            
            await this.app.vault.createFolder(newPath);
            
            // Copy all contents recursively
            const copyContents = async (sourceFolder: TFolder, destPath: string) => {
                for (const child of sourceFolder.children) {
                    if (child instanceof TFile) {
                        const content = await this.app.vault.read(child);
                        const childPath = normalizePath(`${destPath}/${child.name}`);
                        await this.app.vault.create(childPath, content);
                    } else if (child instanceof TFolder) {
                        const childPath = normalizePath(`${destPath}/${child.name}`);
                        await this.app.vault.createFolder(childPath);
                        await copyContents(child, childPath);
                    }
                }
            };
            
            await copyContents(folder, newPath);
        } catch (error) {
            new Notice(`Failed to duplicate folder: ${error.message}`);
        }
    }

    // Alias methods for backward compatibility
    async createNote(parent: TFolder): Promise<TFile | null> {
        return this.createNewFile(parent);
    }

    async createFolder(parent: TFolder, onSuccess?: (path: string) => void): Promise<void> {
        return this.createNewFolder(parent, onSuccess);
    }

    async deleteNote(file: TFile, confirmBeforeDelete?: boolean, onSuccess?: () => void): Promise<void> {
        return this.deleteFile(file, confirmBeforeDelete || false, onSuccess);
    }

    async renameNote(file: TFile): Promise<void> {
        return this.renameFile(file);
    }
}