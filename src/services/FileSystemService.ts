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
import { ExtendedApp, TIMEOUTS, OBSIDIAN_COMMANDS } from '../types/obsidian-extended';
import { InputModal } from '../modals/InputModal';
import { ConfirmModal } from '../modals/ConfirmModal';
import { executeCommand } from '../utils/typeGuards';
import { strings } from '../i18n';
import { getFolderNote } from '../utils/fileFinder';
import { NotebookNavigatorSettings } from '../settings';
import { NavigationItemType, getSupportedLeaves, ItemType } from '../types';
import type { SelectionDispatch } from '../context/SelectionContext';
import { updateSelectionAfterFileOperation, findNextFileAfterRemoval } from '../utils/selectionUtils';
import { createFileWithOptions, createDatabaseContent } from '../utils/fileCreationUtils';

/**
 * Selection context for file operations
 * Contains the current selection state needed for smart deletion
 */
interface SelectionContext {
    selectionType: NavigationItemType;
    selectedFolder?: TFolder;
    selectedTag?: string;
}

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
        return createFileWithOptions(parent, this.app, {
            extension: 'md',
            content: '',
            errorKey: 'createFile'
        });
    }

    /**
     * Renames a folder with user-provided name
     * Shows input modal pre-filled with current name
     * Validates that new name is different from current
     * Also renames associated folder note if it exists
     * @param folder - The folder to rename
     * @param settings - The plugin settings (optional)
     */
    async renameFolder(folder: TFolder, settings?: NotebookNavigatorSettings): Promise<void> {
        const modal = new InputModal(this.app, strings.modals.fileSystem.renameFolderTitle, strings.modals.fileSystem.renamePrompt, async (newName) => {
            if (newName && newName !== folder.name) {
                try {
                    // Check for folder note before renaming
                    let folderNote: TFile | null = null;
                    if (settings?.enableFolderNotes) {
                        folderNote = getFolderNote(folder, settings, this.app);
                    }
                    
                    // Rename the folder
                    const newPath = normalizePath(folder.parent?.path 
                        ? `${folder.parent.path}/${newName}` 
                        : newName);
                    await this.app.fileManager.renameFile(folder, newPath);
                    
                    // Rename the folder note if it exists and uses the same name as folder
                    if (folderNote && settings && !settings.folderNoteName) {
                        // Only rename if folderNoteName is empty (meaning it uses folder name)
                        try {
                            const newNoteName = `${newName}.${folderNote.extension}`;
                            const newNotePath = normalizePath(`${newPath}/${newNoteName}`);
                            await this.app.fileManager.renameFile(folderNote, newNotePath);
                        } catch (error) {
                            // Silently fail folder note rename - the main folder rename succeeded
                            console.error('Failed to rename folder note:', error);
                        }
                    }
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
     * @param preDeleteAction - Optional action to run BEFORE the file is deleted (e.g., to select next file)
     */
    async deleteFile(
        file: TFile, 
        confirmBeforeDelete: boolean, 
        onSuccess?: () => void,
        preDeleteAction?: () => Promise<void>
    ): Promise<void> {
        const performDelete = async () => {
            try {
                // Run pre-delete action if provided
                if (preDeleteAction) {
                    await preDeleteAction();
                }
                
                await this.app.fileManager.trashFile(file);
                
                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                new Notice(strings.fileSystem.errors.deleteFile.replace('{error}', error.message));
            }
        };
        
        if (confirmBeforeDelete) {
            const confirmModal = new ConfirmModal(
                this.app,
                strings.modals.fileSystem.deleteFileTitle.replace('{name}', file.basename),
                strings.modals.fileSystem.deleteFileConfirm,
                performDelete
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            await performDelete();
        }
    }

    /**
     * Smart delete handler for the currently selected file in the Navigator
     * Automatically selects the next file in the same folder before deletion
     * Used by both keyboard shortcuts and context menu
     * 
     * @param file - The file to delete
     * @param settings - Plugin settings
     * @param selectionContext - Current selection context (type, folder, tag)
     * @param selectionDispatch - Selection dispatch function
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     */
    async deleteSelectedFile(
        file: TFile,
        settings: NotebookNavigatorSettings,
        selectionContext: SelectionContext,
        selectionDispatch: SelectionDispatch,
        confirmBeforeDelete: boolean
    ): Promise<void> {
        // Get the file list based on selection type
        let currentFiles: TFile[] = [];
        if (selectionContext.selectionType === ItemType.FOLDER && selectionContext.selectedFolder) {
            const { getFilesForFolder } = await import('../utils/fileFinder');
            currentFiles = getFilesForFolder(selectionContext.selectedFolder, settings, this.app);
        } else if (selectionContext.selectionType === ItemType.TAG && selectionContext.selectedTag) {
            const { getFilesForTag } = await import('../utils/fileFinder');
            currentFiles = getFilesForTag(selectionContext.selectedTag, settings, this.app);
        }
        
        // Find next file to select
        let nextFileToSelect: TFile | null = null;
        const currentIndex = currentFiles.findIndex(f => f.path === file.path);
        
        if (currentIndex !== -1 && currentFiles.length > 1) {
            // Try next file first
            if (currentIndex < currentFiles.length - 1) {
                nextFileToSelect = currentFiles[currentIndex + 1];
            } else if (currentIndex > 0) {
                // No next file, use previous
                nextFileToSelect = currentFiles[currentIndex - 1];
            }
        }
        
        // Perform the delete with pre-selection
        await this.deleteFile(
            file,
            confirmBeforeDelete,
            undefined,
            async () => {
                // Pre-delete action: select next file or close editor
                if (nextFileToSelect) {
                    // Verify the next file still exists (in case of concurrent deletions)
                    const stillExists = this.app.vault.getAbstractFileByPath(nextFileToSelect.path);
                    if (stillExists && stillExists instanceof TFile) {
                        // Update selection and open the file
                        await updateSelectionAfterFileOperation(nextFileToSelect, selectionDispatch, this.app);
                    } else {
                        // Next file was deleted, clear selection
                        await updateSelectionAfterFileOperation(null, selectionDispatch, this.app);
                    }
                } else {
                    // No other files in folder, close the editor if it's showing the deleted file
                    // Get all leaves with supported file types
                    const allLeaves = getSupportedLeaves(this.app);
                    
                    // Find any leaf showing the file being deleted
                    const currentLeaf = allLeaves.find(leaf => {
                        const view = leaf.view;
                        return view && 'file' in view && view.file && view.file.path === file.path;
                    });
                    if (currentLeaf) {
                        currentLeaf.detach();
                    }
                    selectionDispatch({ type: 'SET_SELECTED_FILE', file: null });
                }
                
                // Try to maintain focus on file list using a more reliable method
                setTimeout(() => {
                    const fileListEl = document.querySelector('.nn-file-list-virtualizer') as HTMLElement;
                    if (fileListEl) {
                        fileListEl.focus();
                    }
                }, TIMEOUTS.FOCUS_RESTORE_DELAY);
            }
        );
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
        await createFileWithOptions(parent, this.app, {
            extension: 'canvas',
            content: '{}',
            errorKey: 'createCanvas'
        });
    }

    /**
     * Creates a new database view file in the specified folder
     * @param parent - The parent folder
     */
    async createBase(parent: TFolder): Promise<void> {
        await createFileWithOptions(parent, this.app, {
            extension: 'base',
            content: createDatabaseContent(),
            errorKey: 'createDatabase'
        });
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

    /**
     * Deletes multiple files with confirmation
     * @param files - Array of files to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback to run after successful deletion
     */
    async deleteMultipleFiles(
        files: TFile[], 
        confirmBeforeDelete = true,
        onSuccess?: () => void
    ): Promise<void> {
        if (files.length === 0) return;
        
        const performDelete = async () => {
            // Delete all files
            for (const file of files) {
                try {
                    await this.app.fileManager.trashFile(file);
                } catch (error) {
                    console.error('Error deleting file:', file.path, error);
                    new Notice(strings.fileSystem.errors.failedToDeleteFile.replace('{name}', file.name).replace('{error}', error.message));
                }
            }
            new Notice(strings.fileSystem.notifications.deletedMultipleFiles.replace('{count}', files.length.toString()));
            
            if (onSuccess) {
                onSuccess();
            }
        };
        
        if (confirmBeforeDelete) {
            // Import dynamically to avoid circular dependencies
            const { ConfirmModal } = await import('../modals/ConfirmModal');
            
            const modal = new ConfirmModal(
                this.app,
                strings.fileSystem.confirmations.deleteMultipleFiles
                    .replace('{count}', files.length.toString()),
                strings.fileSystem.confirmations.deleteConfirmation,
                performDelete
            );
            modal.open();
        } else {
            await performDelete();
        }
    }

    /**
     * Deletes selected files with smart selection of next file
     * Centralizes the delete logic used by both keyboard shortcuts and context menu
     * @param selectedFiles - Set of selected file paths
     * @param allFiles - All files in the current view (for finding next file)
     * @param settings - Plugin settings
     * @param selectionContext - Current selection context
     * @param selectionDispatch - Selection dispatch function
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     */
    async deleteFilesWithSmartSelection(
        selectedFiles: Set<string>,
        allFiles: TFile[],
        settings: NotebookNavigatorSettings,
        selectionContext: SelectionContext,
        selectionDispatch: SelectionDispatch,
        confirmBeforeDelete: boolean
    ): Promise<void> {
        // Convert selected paths to files
        const filesToDelete = Array.from(selectedFiles)
            .map(path => this.app.vault.getAbstractFileByPath(path))
            .filter((f): f is TFile => f instanceof TFile);
        
        if (filesToDelete.length === 0) return;
        
        // Find next file to select using utility
        const nextFileToSelect = findNextFileAfterRemoval(allFiles, selectedFiles);
        
        // Delete the files with callback to update selection
        await this.deleteMultipleFiles(
            filesToDelete,
            confirmBeforeDelete,
            async () => {
                // Clear multi-selection first
                selectionDispatch({ type: 'CLEAR_FILE_SELECTION' });
                // Update selection after deletion (don't open in editor for bulk operations)
                if (nextFileToSelect) {
                    await updateSelectionAfterFileOperation(
                        nextFileToSelect, 
                        selectionDispatch, 
                        this.app,
                        { openInEditor: false }
                    );
                }
            }
        );
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
     * The version history modal requires the editor to have focus when the command executes.
     * The Notebook Navigator's aggressive focus management can interfere with this.
     * 
     * Solution:
     * 1. Set a flag to prevent the navigator from stealing focus
     * 2. Always use openLinkText to open/re-open the file (ensures proper editor focus)
     * 3. Wait briefly for the editor to be ready
     * 4. Execute the version history command
     * 5. Clear the flag after a delay
     * 
     * @param file - The file to view version history for
     */
    async openVersionHistory(file: TFile): Promise<void> {
        // Set a flag to prevent the navigator from stealing focus back
        window.notebookNavigatorOpeningVersionHistory = true;
        
        try {
            // Always open/re-open the file to ensure proper focus
            // This works for non-selected files, so let's use it for all files
            await this.app.workspace.openLinkText(file.path, '', false);
            
            // Small delay to ensure the editor is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Execute the version history command
            if (!executeCommand(this.app, OBSIDIAN_COMMANDS.VERSION_HISTORY)) {
                new Notice(strings.fileSystem.errors.versionHistoryNotFound);
            }
        } catch (error) {
            new Notice(strings.fileSystem.errors.openVersionHistory.replace('{error}', error.message));
        } finally {
            // Clear the flag after a delay to ensure the modal has time to open
            setTimeout(() => {
                delete window.notebookNavigatorOpeningVersionHistory;
            }, TIMEOUTS.VERSION_HISTORY_DELAY);
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
            const extendedApp = this.app as ExtendedApp;
            await extendedApp.showInFolder(file.path);
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
                new Notice(strings.fileSystem.errors.drawingAlreadyExists);
            } else {
                new Notice(strings.fileSystem.errors.failedToCreateDrawing);
            }
            return null;
        }
    }
}