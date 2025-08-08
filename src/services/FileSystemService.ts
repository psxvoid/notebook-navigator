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

import { App, TFile, TFolder, TAbstractFile, Notice, normalizePath, Platform } from 'obsidian';
import type { SelectionDispatch } from '../context/SelectionContext';
import { strings } from '../i18n';
import { ConfirmModal } from '../modals/ConfirmModal';
import { FolderSuggestModal } from '../modals/FolderSuggestModal';
import { InputModal } from '../modals/InputModal';
import { NotebookNavigatorSettings } from '../settings';
import { NavigationItemType, ItemType } from '../types';
import { ExtendedApp, TIMEOUTS, OBSIDIAN_COMMANDS } from '../types/obsidian-extended';
import { createFileWithOptions, createDatabaseContent } from '../utils/fileCreationUtils';
import { getFolderNote } from '../utils/fileFinder';
import { updateSelectionAfterFileOperation, findNextFileAfterRemoval } from '../utils/selectionUtils';
import { executeCommand } from '../utils/typeGuards';
import { TagTreeService } from './TagTreeService';
import { CommandQueueService } from './CommandQueueService';

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
 * Options for the moveFilesToFolder method
 */
interface MoveFilesOptions {
    /** Files to move */
    files: TFile[];
    /** Target folder to move files into */
    targetFolder: TFolder;
    /** Current selection context for smart selection updates */
    selectionContext?: {
        selectedFile: TFile | null;
        dispatch: SelectionDispatch;
        allFiles: TFile[];
    };
    /** Whether to show notifications (default: true) */
    showNotifications?: boolean;
}

/**
 * Result of the moveFilesToFolder operation
 */
interface MoveFilesResult {
    /** Number of files successfully moved */
    movedCount: number;
    /** Number of files skipped due to conflicts */
    skippedCount: number;
    /** Files that failed to move with their errors */
    errors: Array<{ file: TFile; error: Error }>;
}

/**
 * Handles all file system operations for Notebook Navigator
 * Provides centralized methods for creating, renaming, and deleting files/folders
 * Manages user input modals and confirmation dialogs
 */
export class FileSystemOperations {
    /**
     * Creates a new FileSystemOperations instance
     * @param app - The Obsidian app instance for vault operations
     * @param getTagTreeService - Function to get the TagTreeService instance
     * @param getCommandQueue - Function to get the CommandQueueService instance
     */
    constructor(
        private app: App,
        private getTagTreeService: () => TagTreeService | null,
        private getCommandQueue: () => CommandQueueService | null
    ) {}

    /**
     * Creates a new folder with user-provided name
     * Shows input modal for folder name and handles creation
     * @param parent - The parent folder to create the new folder in
     * @param onSuccess - Optional callback with the new folder path on successful creation
     */
    async createNewFolder(parent: TFolder, onSuccess?: (path: string) => void): Promise<void> {
        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.newFolderTitle,
            strings.modals.fileSystem.folderNamePrompt,
            async name => {
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
            }
        );
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
        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.renameFolderTitle,
            strings.modals.fileSystem.renamePrompt,
            async newName => {
                if (newName && newName !== folder.name) {
                    try {
                        // Check for folder note before renaming
                        let folderNote: TFile | null = null;
                        if (settings?.enableFolderNotes) {
                            folderNote = getFolderNote(folder, settings, this.app);
                        }

                        const newPath = normalizePath(folder.parent?.path ? `${folder.parent.path}/${newName}` : newName);

                        // Rename the folder note FIRST if it exists and uses the same name as folder
                        if (folderNote && settings && !settings.folderNoteName) {
                            // Only rename if folderNoteName is empty (meaning it uses folder name)
                            try {
                                const newNoteName = `${newName}.${folderNote.extension}`;
                                // Use the current folder path since folder hasn't been renamed yet
                                const newNotePath = normalizePath(`${folder.path}/${newNoteName}`);
                                await this.app.fileManager.renameFile(folderNote, newNotePath);
                            } catch (error) {
                                // Log error but continue with folder rename
                                console.error('Failed to rename folder note:', error);
                            }
                        }

                        // Now rename the folder - this will move the already-renamed folder note with it
                        await this.app.fileManager.renameFile(folder, newPath);
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.renameFolder.replace('{error}', error.message));
                    }
                }
            },
            folder.name
        );
        modal.open();
    }

    /**
     * Renames a file with user-provided name
     * Shows input modal pre-filled with current basename
     * Preserves original file extension if not provided in new name
     * @param file - The file to rename
     */
    async renameFile(file: TFile): Promise<void> {
        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.renameFileTitle,
            strings.modals.fileSystem.renamePrompt,
            async newName => {
                if (newName && newName !== file.basename) {
                    try {
                        // Preserve original extension if not provided
                        if (!newName.includes('.')) {
                            newName += `.${file.extension}`;
                        }
                        const newPath = normalizePath(file.parent?.path ? `${file.parent.path}/${newName}` : newName);
                        await this.app.fileManager.renameFile(file, newPath);
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.renameFile.replace('{error}', error.message));
                    }
                }
            },
            file.basename
        );
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
            currentFiles = getFilesForTag(selectionContext.selectedTag, settings, this.app, this.getTagTreeService());
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
        await this.deleteFile(file, confirmBeforeDelete, undefined, async () => {
            // Pre-delete action: select next file or close editor
            if (nextFileToSelect) {
                // Verify the next file still exists (in case of concurrent deletions)
                const stillExists = this.app.vault.getFileByPath(nextFileToSelect.path);
                if (stillExists) {
                    // Update selection and open the file
                    await updateSelectionAfterFileOperation(nextFileToSelect, selectionDispatch, this.app);
                } else {
                    // Next file was deleted, clear selection
                    await updateSelectionAfterFileOperation(null, selectionDispatch, this.app);
                }
            } else {
                // No other files in folder
                // Don't detach the leaf - let Obsidian handle it naturally after deletion
                // Just clear the selection
                selectionDispatch({ type: 'SET_SELECTED_FILE', file: null });
            }

            // Try to maintain focus on file list using a more reliable method
            window.setTimeout(() => {
                const fileListEl = document.querySelector('.nn-file-list-virtualizer') as HTMLElement;
                if (fileListEl) {
                    fileListEl.focus();
                }
            }, TIMEOUTS.FILE_OPERATION_DELAY);
        });
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
     * Moves multiple files to a target folder with validation and smart selection
     * Extracted from useDragAndDrop to enable reuse across drag-drop and context menu
     *
     * @param options - Move operation options
     * @returns Result object with moved count, skipped count, and errors
     */
    async moveFilesToFolder(options: MoveFilesOptions): Promise<MoveFilesResult> {
        const { files, targetFolder, selectionContext, showNotifications = true } = options;
        const result: MoveFilesResult = { movedCount: 0, skippedCount: 0, errors: [] };

        if (files.length === 0) return result;

        // For single file moves, check if it's a folder being moved into itself
        if (files.length === 1) {
            const sourceItem = files[0];
            if (sourceItem instanceof TFolder && this.isDescendant(sourceItem, targetFolder)) {
                if (showNotifications) {
                    new Notice(strings.dragDrop.errors.cannotMoveIntoSelf, TIMEOUTS.NOTICE_ERROR);
                }
                result.errors.push({
                    file: sourceItem,
                    error: new Error('Cannot move folder into itself')
                });
                return result;
            }
        }

        // Determine if we need to handle selection updates
        const pathsToMove = new Set(files.map(f => f.path));
        const isMovingSelectedFile = selectionContext?.selectedFile && pathsToMove.has(selectionContext.selectedFile.path);

        // Only find next file if we're moving the selected file
        let nextFileToSelect: TFile | null = null;
        if (isMovingSelectedFile && selectionContext) {
            nextFileToSelect = findNextFileAfterRemoval(selectionContext.allFiles, pathsToMove);
        }

        const commandQueue = this.getCommandQueue();
        if (commandQueue) {
            const moveResult = await commandQueue.executeMoveFiles(files, targetFolder);
            if (moveResult.success && moveResult.data) {
                result.movedCount = moveResult.data.movedCount;
                result.skippedCount = moveResult.data.skippedCount;
            } else if (moveResult.error) {
                console.error('Error during move operation:', moveResult.error);
                throw moveResult.error;
            }
        }

        // Handle selection updates if needed
        if (result.movedCount > 0 && isMovingSelectedFile && selectionContext) {
            await updateSelectionAfterFileOperation(nextFileToSelect, selectionContext.dispatch, this.app);
        }

        // Show notifications if enabled
        if (showNotifications) {
            if (result.skippedCount > 0) {
                const message =
                    files.length === 1
                        ? strings.dragDrop.errors.itemAlreadyExists.replace('{name}', files[0].name)
                        : strings.dragDrop.notifications.filesAlreadyExist.replace('{count}', result.skippedCount.toString());
                new Notice(message, TIMEOUTS.NOTICE_ERROR);
            }

            if (result.errors.length > 0 && files.length === 1) {
                new Notice(strings.dragDrop.errors.failedToMove.replace('{error}', result.errors[0].error.message));
            }
        }

        return result;
    }

    /**
     * Shows a folder selection modal and moves files to the selected folder
     * Used by context menu and keyboard shortcuts for interactive file moving
     *
     * @param files - Files to move
     * @param selectionContext - Optional selection context for smart selection updates
     */
    async moveFilesWithModal(
        files: TFile[],
        selectionContext?: {
            selectedFile: TFile | null;
            dispatch: SelectionDispatch;
            allFiles: TFile[];
        }
    ): Promise<void> {
        if (files.length === 0) return;

        // Create a set of paths to exclude (source folders and their parents)
        const excludePaths = new Set<string>();

        // For single file moves, exclude the parent folder
        if (files.length === 1 && files[0].parent) {
            excludePaths.add(files[0].parent.path);
        }

        // Check if any files are actually folders (shouldn't happen, but check anyway)
        for (const file of files) {
            if (file instanceof TFolder) {
                // This shouldn't happen as files should be TFile[], but handle it
                excludePaths.add(file.path);
                // Add all descendants
                const addDescendants = (parent: TFolder) => {
                    for (const child of parent.children) {
                        if (child instanceof TFolder) {
                            excludePaths.add(child.path);
                            addDescendants(child);
                        }
                    }
                };
                addDescendants(file);
            }
        }

        // Show the folder selection modal
        const modal = new FolderSuggestModal(
            this.app,
            async (targetFolder: TFolder) => {
                // Move the files to the selected folder
                const result = await this.moveFilesToFolder({
                    files,
                    targetFolder,
                    selectionContext,
                    showNotifications: true
                });

                // Show summary notification for multiple files
                if (files.length > 1 && result.movedCount > 0) {
                    new Notice(
                        strings.fileSystem.notifications.movedMultipleFiles
                            .replace('{count}', result.movedCount.toString())
                            .replace('{folder}', targetFolder.name)
                    );
                }
            },
            strings.modals.folderSuggest.placeholder,
            strings.modals.folderSuggest.instructions.move,
            excludePaths
        );

        modal.open();
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

            // Copy all contents recursively with batching
            const copyContents = async (sourceFolder: TFolder, destPath: string) => {
                // Collect all operations first
                const filesToCopy: Array<{ source: TFile; destPath: string }> = [];
                const foldersToCreate: string[] = [];

                const collectOperations = (folder: TFolder, currentDestPath: string) => {
                    for (const child of folder.children) {
                        if (child instanceof TFile) {
                            const childPath = normalizePath(`${currentDestPath}/${child.name}`);
                            filesToCopy.push({ source: child, destPath: childPath });
                        } else if (child instanceof TFolder) {
                            const childPath = normalizePath(`${currentDestPath}/${child.name}`);
                            foldersToCreate.push(childPath);
                            collectOperations(child, childPath);
                        }
                    }
                };

                collectOperations(sourceFolder, destPath);

                // Create all folders first
                for (const folderPath of foldersToCreate) {
                    await this.app.vault.createFolder(folderPath);
                }

                // Copy files in batches of 10 to avoid overwhelming the system
                const BATCH_SIZE = 10;
                for (let i = 0; i < filesToCopy.length; i += BATCH_SIZE) {
                    const batch = filesToCopy.slice(i, i + BATCH_SIZE);
                    await Promise.all(
                        batch.map(async ({ source, destPath }) => {
                            const content = await this.app.vault.read(source);
                            await this.app.vault.create(destPath, content);
                        })
                    );
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
    async deleteMultipleFiles(files: TFile[], confirmBeforeDelete = true, onSuccess?: () => void): Promise<void> {
        if (files.length === 0) return;

        const performDelete = async () => {
            // Delete files in batches to improve performance
            const BATCH_SIZE = 10;
            const errors: Array<{ file: TFile; error: unknown }> = [];
            let deletedCount = 0;

            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                const results = await Promise.allSettled(batch.map(file => this.app.fileManager.trashFile(file)));

                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        deletedCount++;
                    } else {
                        const file = batch[index];
                        errors.push({ file, error: result.reason });
                        console.error('Error deleting file:', file.path, result.reason);
                    }
                });
            }

            // Show appropriate notifications
            if (deletedCount > 0) {
                new Notice(strings.fileSystem.notifications.deletedMultipleFiles.replace('{count}', deletedCount.toString()));
            }

            if (errors.length > 0) {
                const errorMsg =
                    errors.length === 1
                        ? strings.fileSystem.errors.failedToDeleteFile
                              .replace('{name}', errors[0].file.name)
                              .replace('{error}', String(errors[0].error))
                        : strings.fileSystem.errors.failedToDeleteMultipleFiles.replace('{count}', errors.length.toString());
                new Notice(errorMsg);
            }

            if (onSuccess && deletedCount > 0) {
                onSuccess();
            }
        };

        if (confirmBeforeDelete) {
            // Import dynamically to avoid circular dependencies
            const { ConfirmModal } = await import('../modals/ConfirmModal');

            const modal = new ConfirmModal(
                this.app,
                strings.fileSystem.confirmations.deleteMultipleFiles.replace('{count}', files.length.toString()),
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
        _settings: NotebookNavigatorSettings,
        _selectionContext: SelectionContext,
        selectionDispatch: SelectionDispatch,
        confirmBeforeDelete: boolean
    ): Promise<void> {
        // Convert selected paths to files
        const filesToDelete = Array.from(selectedFiles)
            .map(path => this.app.vault.getFileByPath(path))
            .filter((f): f is TFile => f !== null);

        if (filesToDelete.length === 0) return;

        // Find next file to select using utility
        const nextFileToSelect = findNextFileAfterRemoval(allFiles, selectedFiles);

        // Delete the files with callback to update selection
        await this.deleteMultipleFiles(filesToDelete, confirmBeforeDelete, async () => {
            // Clear multi-selection first
            selectionDispatch({ type: 'CLEAR_FILE_SELECTION' });
            // Update selection after deletion (don't open in editor for bulk operations)
            if (nextFileToSelect) {
                await updateSelectionAfterFileOperation(nextFileToSelect, selectionDispatch, this.app, { openInEditor: false });
            }
        });
    }

    /**
     * Opens version history for a file using Obsidian Sync.
     *
     * The version history modal requires the editor to have focus when the command executes.
     * The Notebook Navigator's aggressive focus management can interfere with this.
     *
     * Solution:
     * 1. Track the operation to prevent the navigator from stealing focus
     * 2. Always use openLinkText to open/re-open the file (ensures proper editor focus)
     * 3. Wait briefly for the editor to be ready
     * 4. Execute the version history command
     *
     * @param file - The file to view version history for
     */
    async openVersionHistory(file: TFile): Promise<void> {
        const commandQueue = this.getCommandQueue();
        if (!commandQueue) {
            new Notice(strings.fileSystem.errors.versionHistoryNotAvailable);
            return;
        }

        const result = await commandQueue.executeOpenVersionHistory(file, async () => {
            // Always open/re-open the file to ensure proper focus
            await this.app.workspace.openLinkText(file.path, '', false);

            // Small delay to ensure the editor is ready
            await new Promise(resolve => window.setTimeout(resolve, TIMEOUTS.FILE_OPERATION_DELAY));

            // Execute the version history command
            if (!executeCommand(this.app, OBSIDIAN_COMMANDS.VERSION_HISTORY)) {
                new Notice(strings.fileSystem.errors.versionHistoryNotFound);
            }
        });

        if (!result.success && result.error) {
            new Notice(strings.fileSystem.errors.openVersionHistory.replace('{error}', result.error.message));
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
     * Reveals a file or folder in the system's file explorer
     * @param file - The file or folder to reveal
     */
    async revealInSystemExplorer(file: TFile | TFolder): Promise<void> {
        try {
            // Use Obsidian's built-in method to reveal the file or folder
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
