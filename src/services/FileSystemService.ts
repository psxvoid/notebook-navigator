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

import { App, TFile, TFolder, TAbstractFile, Notice, normalizePath, Platform, MarkdownView } from 'obsidian';
import { InputModal } from '../modals/InputModal';
import { ConfirmModal } from '../modals/ConfirmModal';
import { executeCommand } from '../utils/typeGuards';
import { strings } from '../i18n';

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
        const modal = new InputModal(this.app, strings.modals.fileSystem.newFolderTitle, strings.modals.fileSystem.folderNamePrompt, async (name) => {
            if (name) {
                try {
                    const path = normalizePath(parent.path ? `${parent.path}/${name}` : name);
                    await this.app.vault.createFolder(path);
                    if (onSuccess) {
                        onSuccess(path);
                    }
                } catch (error) {
                    new Notice(strings.fileSystem.errors.createFolder.replace('{error}', error.message));
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
            let fileName = strings.fileSystem.defaultNames.untitled;
            let counter = 1;
            let path = normalizePath(parent.path ? `${parent.path}/${fileName}.md` : `${fileName}.md`);
            
            // Check if file exists and increment counter
            while (this.app.vault.getAbstractFileByPath(path)) {
                fileName = strings.fileSystem.defaultNames.untitledNumber.replace('{number}', counter.toString());
                path = normalizePath(parent.path ? `${parent.path}/${fileName}.md` : `${fileName}.md`);
                counter++;
            }
            
            // Create the file
            const file = await this.app.vault.create(path, '');
            
            // Open the file and trigger rename mode
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            // Trigger rename mode.
            // We use setTimeout to push this command to the end of the event queue.
            // This gives Obsidian's workspace time to finish opening the file and rendering the editor,
            // making it more likely that the 'edit-file-title' command will find an active editor title to focus.
            // Note: This is a known workaround for a race condition in Obsidian and may fail on slower systems.
            setTimeout(() => {
                executeCommand(this.app, 'workspace:edit-file-title');
            }, 0);
            
            return file;
        } catch (error) {
            new Notice(strings.fileSystem.errors.createFile.replace('{error}', error.message));
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
        const modal = new InputModal(this.app, strings.modals.fileSystem.renameFolderTitle, strings.modals.fileSystem.renamePrompt, async (newName) => {
            if (newName && newName !== folder.name) {
                try {
                    const newPath = normalizePath(folder.parent?.path 
                        ? `${folder.parent.path}/${newName}` 
                        : newName);
                    await this.app.fileManager.renameFile(folder, newPath);
                } catch (error) {
                    new Notice(strings.fileSystem.errors.renameFolder.replace('{error}', error.message));
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
        const modal = new InputModal(this.app, strings.modals.fileSystem.renameFileTitle, strings.modals.fileSystem.renamePrompt, async (newName) => {
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
                    new Notice(strings.fileSystem.errors.renameFile.replace('{error}', error.message));
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
                strings.modals.fileSystem.deleteFolderTitle.replace('{name}', folder.name),
                strings.modals.fileSystem.deleteFolderConfirm,
                async () => {
                    try {
                        await this.app.fileManager.trashFile(folder);
                        if (onSuccess) {
                            onSuccess();
                        }
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.deleteFolder.replace('{error}', error.message));
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            try {
                await this.app.fileManager.trashFile(folder);
                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                new Notice(strings.fileSystem.errors.deleteFolder.replace('{error}', error.message));
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
                strings.modals.fileSystem.deleteFileTitle.replace('{name}', file.basename),
                strings.modals.fileSystem.deleteFileConfirm,
                async () => {
                    try {
                        await this.app.fileManager.trashFile(file);
                        if (onSuccess) {
                            onSuccess();
                        }
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.deleteFile.replace('{error}', error.message));
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            try {
                await this.app.fileManager.trashFile(file);
                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                new Notice(strings.fileSystem.errors.deleteFile.replace('{error}', error.message));
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
            new Notice(strings.fileSystem.errors.duplicateNote.replace('{error}', error.message));
        }
    }

    /**
     * Creates a new canvas file in the specified folder
     * @param parent - The parent folder
     */
    async createCanvas(parent: TFolder): Promise<void> {
        try {
            let fileName = strings.fileSystem.defaultNames.untitled;
            let counter = 1;
            let path = normalizePath(parent.path ? `${parent.path}/${fileName}.canvas` : `${fileName}.canvas`);
            
            while (this.app.vault.getAbstractFileByPath(path)) {
                fileName = strings.fileSystem.defaultNames.untitledNumber.replace('{number}', counter.toString());
                path = normalizePath(parent.path ? `${parent.path}/${fileName}.canvas` : `${fileName}.canvas`);
                counter++;
            }
            
            const file = await this.app.vault.create(path, '{}');
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            // Trigger rename mode.
            // We use setTimeout to push this command to the end of the event queue.
            // This gives Obsidian's workspace time to finish opening the file and rendering the editor,
            // making it more likely that the 'edit-file-title' command will find an active editor title to focus.
            // Note: This is a known workaround for a race condition in Obsidian and may fail on slower systems.
            setTimeout(() => {
                executeCommand(this.app, 'workspace:edit-file-title');
            }, 0);
        } catch (error) {
            new Notice(strings.fileSystem.errors.createCanvas.replace('{error}', error.message));
        }
    }

    /**
     * Creates a new database view file in the specified folder
     * @param parent - The parent folder
     */
    async createBase(parent: TFolder): Promise<void> {
        try {
            let fileName = strings.fileSystem.defaultNames.untitled;
            let counter = 1;
            let path = normalizePath(parent.path ? `${parent.path}/${fileName}.base` : `${fileName}.base`);
            
            while (this.app.vault.getAbstractFileByPath(path)) {
                fileName = strings.fileSystem.defaultNames.untitledNumber.replace('{number}', counter.toString());
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
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            // Trigger rename mode.
            // We use setTimeout to push this command to the end of the event queue.
            // This gives Obsidian's workspace time to finish opening the file and rendering the editor,
            // making it more likely that the 'edit-file-title' command will find an active editor title to focus.
            // Note: This is a known workaround for a race condition in Obsidian and may fail on slower systems.
            setTimeout(() => {
                executeCommand(this.app, 'workspace:edit-file-title');
            }, 0);
        } catch (error) {
            new Notice(strings.fileSystem.errors.createDatabase.replace('{error}', error.message));
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
            new Notice(strings.fileSystem.errors.duplicateFolder.replace('{error}', error.message));
        }
    }

    // Alias methods for backward compatibility
    /**
     * Creates a new note in the specified parent folder
     * @deprecated Use createNewFile instead
     * @param parent - The parent folder where the note will be created
     * @returns Promise resolving to the created file or null if creation failed
     */
    async createNote(parent: TFolder): Promise<TFile | null> {
        return this.createNewFile(parent);
    }

    /**
     * Creates a new folder in the specified parent folder
     * @deprecated Use createNewFolder instead
     * @param parent - The parent folder where the new folder will be created
     * @param onSuccess - Optional callback with the new folder path
     * @returns Promise that resolves when the folder is created
     */
    async createFolder(parent: TFolder, onSuccess?: (path: string) => void): Promise<void> {
        return this.createNewFolder(parent, onSuccess);
    }

    /**
     * Deletes a note file from the vault
     * @deprecated Use deleteFile instead
     * @param file - The file to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback to run after successful deletion
     * @returns Promise that resolves when the file is deleted
     */
    async deleteNote(file: TFile, confirmBeforeDelete?: boolean, onSuccess?: () => void): Promise<void> {
        return this.deleteFile(file, confirmBeforeDelete || false, onSuccess);
    }

    /**
     * Renames a note file using a modal dialog
     * @deprecated Use renameFile instead
     * @param file - The file to rename
     * @returns Promise that resolves when the rename is complete
     */
    async renameNote(file: TFile): Promise<void> {
        return this.renameFile(file);
    }

    /**
     * Opens version history for a file using Obsidian Sync.
     * 
     * FOCUS ISSUE FIX:
     * Problem: Version history modal requires editor to have focus to display
     * 
     * When working (e.g., second click):
     * 1. File is already open and editor has focus
     * 2. User right-clicks and selects "Version History"
     * 3. Command executes successfully
     * 4. Modal displays properly
     * 
     * When failing (e.g., first click on non-selected file):
     * 1. User right-clicks non-selected file in navigator
     * 2. Our code opens the file
     * 3. Auto-reveal detects file change and calls revealFile()
     * 4. revealFile() changes focus back to files pane (stealing from editor)
     * 5. Version history command executes but modal can't show (no editor focus)
     * 6. Command returns true but nothing visible happens
     * 
     * Solution: Set a flag to prevent revealFile() from changing focus
     * when we're opening version history
     * 
     * @param file - The file to view version history for
     */
    async openVersionHistory(file: TFile): Promise<void> {
        // Set a flag to prevent focus stealing during reveal
        (window as any).notebookNavigatorOpeningVersionHistory = true;
        
        try {
            // Check if the file is already open in any leaf
            const leaves = this.app.workspace.getLeavesOfType('markdown');
            
            // Find if our file is open in any leaf
            const fileLeaf = leaves.find(leaf => {
                const view = leaf.view as any;
                return view && 'file' in view && view.file?.path === file.path;
            });
            const isAlreadyOpen = !!fileLeaf;
            
            // Check if the file is the active file
            const activeFile = this.app.workspace.getActiveFile();
            const isActiveFile = activeFile?.path === file.path;
            
            if (!isActiveFile) {
                // File needs to be opened or activated
                
                // Create a promise that resolves when the file becomes active
                const waitForFileActive = new Promise<void>((resolve) => {
                    let resolved = false;
                    
                    // Set up a listener for active leaf change
                    const eventRef = this.app.workspace.on('active-leaf-change', () => {
                        const activeFile = this.app.workspace.getActiveFile();
                        if (activeFile?.path === file.path && !resolved) {
                            resolved = true;
                            this.app.workspace.offref(eventRef);
                            resolve();
                        }
                    });
                    
                    // Timeout after 1 second
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            this.app.workspace.offref(eventRef);
                            resolve();
                        }
                    }, 1000);
                });
                
                if (!isAlreadyOpen) {
                    // File is not open at all, open it
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(file);
                } else if (fileLeaf) {
                    // File is open but not active, activate it
                    this.app.workspace.setActiveLeaf(fileLeaf, { focus: true });
                }
                
                // Wait for the file to become active
                await waitForFileActive;
                
            }
            
            // CRITICAL: Focus the editor view, not just activate the file
            const activeLeaf = this.app.workspace.activeLeaf;
            
            if (activeLeaf && activeLeaf.view) {
                activeLeaf.view.containerEl.focus();
                
                // Also try to focus the content element if it exists
                const contentEl = (activeLeaf.view as any).contentEl;
                if (contentEl) {
                    contentEl.focus();
                }
            }
            
            // Try both possible command IDs
            const commandIds = ['sync:show-sync-history', 'sync:view-version-history'];
            let executed = false;
            
            for (const commandId of commandIds) {
                try {
                    const success = executeCommand(this.app, commandId);
                    
                    if (success) {
                        executed = true;
                        break;
                    }
                } catch (error) {
                    // Continue to next command ID
                    continue;
                }
            }
            
            if (!executed) {
                new Notice(strings.fileSystem.errors.versionHistoryNotFound);
            }
            
            // Clear the flag immediately after command execution
            delete (window as any).notebookNavigatorOpeningVersionHistory;
        } catch (error) {
            new Notice(strings.fileSystem.errors.openVersionHistory.replace('{error}', error.message));
            // Clear the flag on error too
            delete (window as any).notebookNavigatorOpeningVersionHistory;
        }
    }

    /**
     * Gets the platform-specific text for the "Reveal in system explorer" menu option
     * @returns The appropriate text based on the current platform
     */
    getRevealInSystemExplorerText(): string {
        if (Platform.isMacOS) {
            return strings.contextMenu.file.revealInFinder;
        } else {
            return strings.contextMenu.file.showInExplorer;
        }
    }

    /**
     * Reveals a file in the system's file explorer
     * @param file - The file to reveal
     */
    async revealInSystemExplorer(file: TFile): Promise<void> {
        try {
            // Use Obsidian's built-in method to reveal the file
            // Note: showInFolder is not in Obsidian's public TypeScript API, but is widely used by plugins
            // showInFolder expects the vault-relative path, not the full system path
            await (this.app as any).showInFolder(file.path);
        } catch (error) {
            new Notice(strings.fileSystem.errors.revealInExplorer.replace('{error}', error.message));
        }
    }

    /**
     * Creates a new Excalidraw drawing in the specified folder
     * Only available when Excalidraw plugin is installed
     * @param parent - The parent folder to create the drawing in
     * @returns The created file or null if creation failed
     */
    async createNewDrawing(parent: TFolder): Promise<TFile | null> {
        try {
            // Generate unique filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `Drawing ${timestamp}.excalidraw.md`;
            const filePath = parent.path ? `${parent.path}/${fileName}` : fileName;
            
            // Minimal Excalidraw file content
            const content = `---

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
            
            // Create the file
            const file = await this.app.vault.create(filePath, content);
            
            // Open the file
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            // The Excalidraw plugin should automatically recognize and open it in drawing mode
            return file;
        } catch (error) {
            if (error.message?.includes('already exists')) {
                new Notice('A drawing with this name already exists');
            } else {
                new Notice('Failed to create drawing');
            }
            return null;
        }
    }
}