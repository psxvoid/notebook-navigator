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

// src/hooks/useDragAndDrop.ts
import { useCallback, useEffect, useRef } from 'react';
import { TFile, TFolder, Notice, setIcon, normalizePath } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useTagOperations } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { strings } from '../i18n';
import { getDBInstance } from '../storage/fileOperations';
import { ItemType, UNTAGGED_TAG_ID } from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { getPathFromDataAttribute } from '../utils/domUtils';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { generateUniqueFilename } from '../utils/fileCreationUtils';

/**
 * Enables drag and drop for files and folders using event delegation.
 * Adds visual feedback, validates drops, and performs file operations.
 *
 * Usage: call with a container element that contains items with
 * data attributes: `data-draggable`, `data-drag-type`, `data-drag-path`,
 * and drop zones with `data-drop-zone`, `data-drop-path`.
 */
export function useDragAndDrop(containerRef: React.RefObject<HTMLElement | null>) {
    const { app, isMobile, tagTreeService } = useServices();
    const fileSystemOps = useFileSystemOps();
    const tagOperations = useTagOperations();
    const selectionState = useSelectionState();
    const dispatch = useSelectionDispatch();
    const settings = useSettingsState();
    // Uses IndexedDB lazily in drag ghost; falls back to icon
    const dragOverElement = useRef<HTMLElement | null>(null);
    const dragGhostElement = useRef<HTMLElement | null>(null);
    // Track global window listeners to ensure proper cleanup on unmount
    const windowDragEndHandlerRef = useRef<((e: DragEvent) => void) | null>(null);
    const windowDropHandlerRef = useRef<((e: DragEvent) => void) | null>(null);

    /**
     * Type guard to check if an element is an HTMLElement
     */
    const isHTMLElement = (element: EventTarget | null): element is HTMLElement => {
        return element instanceof HTMLElement;
    };

    /**
     * Helper function to get current file list based on selection
     */
    const getCurrentFileList = useCallback((): TFile[] => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            return getFilesForFolder(selectionState.selectedFolder, settings, app);
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return getFilesForTag(selectionState.selectedTag, settings, app, tagTreeService);
        }
        return [];
    }, [selectionState, settings, app, tagTreeService]);

    /**
     * Updates the position of the drag ghost element to follow the mouse cursor
     */
    const updateDragGhostPosition = useCallback((e: MouseEvent | DragEvent) => {
        if (dragGhostElement.current) {
            dragGhostElement.current.style.left = `${e.clientX + 10}px`;
            dragGhostElement.current.style.top = `${e.clientY + 10}px`;
        }
    }, []);

    /**
     * Cleans up the drag ghost element and removes event listeners
     */
    const cleanupDragGhost = useCallback(() => {
        if (dragGhostElement.current) {
            document.removeEventListener('mousemove', updateDragGhostPosition);
            document.removeEventListener('dragover', updateDragGhostPosition);
            dragGhostElement.current.remove();
            dragGhostElement.current = null;
        }
        // Always remove any lingering window-level listeners
        if (windowDragEndHandlerRef.current) {
            window.removeEventListener('dragend', windowDragEndHandlerRef.current);
            windowDragEndHandlerRef.current = null;
        }
        if (windowDropHandlerRef.current) {
            window.removeEventListener('drop', windowDropHandlerRef.current);
            windowDropHandlerRef.current = null;
        }
    }, [updateDragGhostPosition]);

    /**
     * Hides the browser's default drag preview by setting an empty element
     */
    const hideBrowserDragPreview = (e: DragEvent) => {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'nn-drag-empty-placeholder';
        document.body.appendChild(emptyDiv);
        e.dataTransfer?.setDragImage(emptyDiv, 0, 0);
        setTimeout(() => emptyDiv.remove(), 0);
    };

    /**
     * Creates and positions a custom drag ghost element
     */
    const createDragGhost = useCallback(
        (e: DragEvent, type: string | null, path: string, itemCount?: number) => {
            const dragGhost = document.createElement('div');
            dragGhost.className = 'nn-drag-ghost';

            // Set initial position
            dragGhost.style.left = `${e.clientX + 10}px`;
            dragGhost.style.top = `${e.clientY + 10}px`;

            if (itemCount && itemCount > 1) {
                // Multiple items - show count badge
                const dragInfo = document.createElement('div');
                dragInfo.className = 'nn-drag-ghost-badge';
                dragInfo.textContent = `${itemCount}`;
                dragGhost.appendChild(dragInfo);
            } else {
                // Single item - show icon
                const dragIcon = document.createElement('div');
                dragIcon.className = 'nn-drag-ghost-icon';

                if (type === ItemType.FILE) {
                    // Try to use featured image for files (safe if DB not ready)
                    let featureImagePath = '';
                    try {
                        featureImagePath = getDBInstance().getCachedFeatureImageUrl(path);
                    } catch {
                        // Skip image if cache unavailable
                    }
                    let imageLoaded = false;

                    if (featureImagePath) {
                        const imageFile = app.vault.getFileByPath(featureImagePath);
                        if (imageFile) {
                            try {
                                const featureImageUrl = app.vault.getResourcePath(imageFile);
                                dragIcon.className = 'nn-drag-ghost-icon nn-drag-ghost-featured-image';
                                const img = document.createElement('img');
                                img.src = featureImageUrl;
                                dragIcon.appendChild(img);
                                imageLoaded = true;
                            } catch {
                                // Image load failed, will use fallback
                            }
                        }
                    }

                    if (!imageLoaded) {
                        setIcon(dragIcon, 'lucide-file');
                    }
                } else if (type === ItemType.FOLDER) {
                    setIcon(dragIcon, 'lucide-folder-closed');
                }

                dragGhost.appendChild(dragIcon);
            }

            document.body.appendChild(dragGhost);
            dragGhostElement.current = dragGhost;

            // Start tracking mouse position
            document.addEventListener('mousemove', updateDragGhostPosition, { passive: true });
            document.addEventListener('dragover', updateDragGhostPosition);

            // Ensure ghost is cleaned even if drag ends outside container
            const onGlobalEnd = () => cleanupDragGhost();
            // Track handlers so they can be removed on unmount if the drag doesn't end
            windowDragEndHandlerRef.current = onGlobalEnd as (e: DragEvent) => void;
            windowDropHandlerRef.current = onGlobalEnd as (e: DragEvent) => void;
            window.addEventListener('dragend', onGlobalEnd, { once: true });
            window.addEventListener('drop', onGlobalEnd, { once: true });
        },
        [app, updateDragGhostPosition, cleanupDragGhost]
    );

    /**
     * Converts an array of file paths to TFile objects
     */
    const getFilesFromPaths = useCallback(
        (paths: string[]): TFile[] => {
            const files: TFile[] = [];
            for (const path of paths) {
                const file = app.vault.getFileByPath(path);
                if (file) {
                    files.push(file);
                }
            }
            return files;
        },
        [app]
    );

    /**
     * Moves files to a folder with selection context
     */
    const moveFilesWithContext = useCallback(
        async (files: TFile[], targetFolder: TFolder) => {
            const currentFiles = getCurrentFileList();
            await fileSystemOps.moveFilesToFolder({
                files,
                targetFolder,
                selectionContext: {
                    selectedFile: selectionState.selectedFile,
                    dispatch,
                    allFiles: currentFiles
                },
                showNotifications: true
            });
        },
        [fileSystemOps, getCurrentFileList, selectionState.selectedFile, dispatch]
    );

    /**
     * Handles the drag start event.
     * Extracts drag data from data attributes and sets drag effect.
     * Also generates markdown links for dragging into editor panes.
     *
     * @param e - The drag event
     */
    const handleDragStart = useCallback(
        (e: DragEvent) => {
            if (!isHTMLElement(e.target)) return;
            const draggable = e.target.closest('[data-draggable="true"]');
            if (!draggable || !(draggable instanceof HTMLElement)) return;

            const path = getPathFromDataAttribute(draggable, 'data-drag-path');
            const type = draggable.getAttribute('data-drag-type');
            if (!path || !e.dataTransfer) return;

            // Check if dragging a selected file with multiple selections
            if (type === ItemType.FILE && selectionState.selectedFiles.has(path) && selectionState.selectedFiles.size > 1) {
                // Multiple file selection
                const selectedPaths = Array.from(selectionState.selectedFiles);
                e.dataTransfer.setData('obsidian/files', JSON.stringify(selectedPaths));
                e.dataTransfer.effectAllowed = 'copyMove';

                // Generate markdown links for all selected files
                const markdownLinks: string[] = [];
                selectedPaths.forEach(selectedPath => {
                    const file = app.vault.getFileByPath(selectedPath);
                    if (file) {
                        const src = app.workspace.getActiveFile()?.path ?? '';
                        const link = app.fileManager.generateMarkdownLink(file, src);
                        markdownLinks.push(link);
                    }
                });

                if (markdownLinks.length > 0) {
                    e.dataTransfer.setData('text/plain', markdownLinks.join('\n'));
                }

                // Add dragging class to all selected files
                selectedPaths.forEach(selectedPath => {
                    const el = containerRef.current?.querySelector(`[data-drag-path="${selectedPath}"]`);
                    el?.classList.add('nn-dragging');
                });

                hideBrowserDragPreview(e);
                createDragGhost(e, type, path, selectedPaths.length);
            } else {
                // Single item drag
                e.dataTransfer.setData('obsidian/file', path);
                // No custom types needed
                e.dataTransfer.effectAllowed = 'copyMove';

                // Generate markdown link for single file
                if (type === ItemType.FILE) {
                    const file = app.vault.getFileByPath(path);
                    if (file) {
                        const src = app.workspace.getActiveFile()?.path ?? '';
                        const link = app.fileManager.generateMarkdownLink(file, src);
                        e.dataTransfer.setData('text/plain', link);
                    }
                }

                draggable.classList.add('nn-dragging');
                hideBrowserDragPreview(e);
                createDragGhost(e, type, path);
            }
        },
        [selectionState, containerRef, app, createDragGhost]
    );

    /**
     * Handles the drag over event.
     * Provides visual feedback by adding CSS classes to valid drop targets.
     *
     * @param e - The drag event
     */
    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        if (!isHTMLElement(e.target)) return;
        const dropZone = e.target.closest<HTMLElement>('[data-drop-zone="folder"],[data-drop-zone="tag"]');

        if (dragOverElement.current && dragOverElement.current !== dropZone) {
            dragOverElement.current.classList.remove('nn-drag-over');
            dragOverElement.current = null;
        }

        if (dropZone) {
            if (e.dataTransfer) {
                const dropType = dropZone.getAttribute('data-drop-zone');
                const targetPath = dropZone.getAttribute('data-drop-path');

                const typesList = e.dataTransfer.types;
                const hasObsidianData = !!typesList?.includes('obsidian/file') || !!typesList?.includes('obsidian/files');
                const isExternal = !!typesList?.includes('Files') && !hasObsidianData;

                // Folder: move (internal) / copy (external); Tag: untagged = move, tag = copy
                if (dropType === 'folder') {
                    e.dataTransfer.dropEffect = isExternal ? 'copy' : 'move';
                } else if (dropType === 'tag') {
                    e.dataTransfer.dropEffect = targetPath === UNTAGGED_TAG_ID ? 'move' : 'copy';
                }
            }
            dropZone.classList.add('nn-drag-over');
            dragOverElement.current = dropZone;
        }
    }, []);

    /**
     * Handles dropping files on a tag to add that tag to the files
     *
     * @param e - The drag event
     * @param targetTag - The tag to add (or UNTAGGED_TAG_ID to clear all tags)
     */
    const handleTagDrop = useCallback(
        async (e: DragEvent, targetTag: string) => {
            let files: TFile[] = [];

            // Check if dragging multiple files (never folders)
            const multipleFilesData = e.dataTransfer?.getData('obsidian/files');
            if (multipleFilesData) {
                try {
                    const selectedPaths = JSON.parse(multipleFilesData);
                    if (Array.isArray(selectedPaths)) {
                        files = getFilesFromPaths(selectedPaths);
                    }
                } catch (error) {
                    console.error('Error parsing multiple files data:', error);
                    return;
                }
            } else {
                // Check if dragging single item (could be file or folder)
                const singleFileData = e.dataTransfer?.getData('obsidian/file');
                if (singleFileData) {
                    const item = app.vault.getAbstractFileByPath(singleFileData);
                    if (item instanceof TFolder) {
                        new Notice(strings.dragDrop.errors.foldersCannotHaveTags);
                        return;
                    } else if (item instanceof TFile) {
                        files = [item];
                    }
                }
            }

            if (files.length === 0) return;

            // Handle special "untagged" drop zone - clear all tags
            if (targetTag === UNTAGGED_TAG_ID) {
                try {
                    const clearedCount = await tagOperations.clearAllTagsFromFiles(files);
                    if (clearedCount > 0) {
                        const message =
                            clearedCount === 1
                                ? strings.fileSystem.notifications.tagsClearedFromNote
                                : strings.fileSystem.notifications.tagsClearedFromNotes.replace('{count}', clearedCount.toString());
                        new Notice(message);
                    } else {
                        new Notice(strings.dragDrop.notifications.noTagsToClear);
                    }
                } catch (error) {
                    console.error('Error clearing tags:', error);
                    new Notice(strings.dragDrop.errors.failedToClearTags);
                }
            } else {
                // Add tag to files
                try {
                    const { added, skipped } = await tagOperations.addTagToFiles(targetTag, files);

                    if (added > 0) {
                        const message =
                            added === 1
                                ? strings.fileSystem.notifications.tagAddedToNote
                                : strings.fileSystem.notifications.tagAddedToNotes.replace('{count}', added.toString());
                        new Notice(message);
                    }
                    if (skipped > 0) {
                        new Notice(
                            strings.dragDrop.notifications.filesAlreadyHaveTag.replace('{count}', skipped.toString()),
                            TIMEOUTS.NOTICE_ERROR
                        );
                    }
                } catch (error) {
                    console.error('Error adding tag:', error);
                    new Notice(strings.dragDrop.errors.failedToAddTag.replace('{tag}', targetTag));
                }
            }
        },
        [app, tagOperations, getFilesFromPaths]
    );

    /**
     * Handles importing external files dropped from OS file manager
     * @param files - FileList from drag event
     * @param targetFolder - Target folder to import files into
     */
    const handleExternalFileDrop = useCallback(
        async (files: FileList, targetFolder: TFolder) => {
            const importedCount = { success: 0, failed: 0 };
            const errors: string[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    // Extract base name and extension
                    const lastDotIndex = file.name.lastIndexOf('.');
                    let baseName: string;
                    let extension: string;

                    if (lastDotIndex === -1 || lastDotIndex === 0) {
                        // No extension or hidden file starting with dot
                        baseName = file.name;
                        extension = '';
                    } else {
                        baseName = file.name.substring(0, lastDotIndex);
                        extension = file.name.substring(lastDotIndex + 1);
                    }

                    // Generate unique filename if needed
                    const uniqueBaseName = generateUniqueFilename(targetFolder.path, baseName, extension, app);
                    const base = targetFolder.path === '/' ? '' : `${targetFolder.path}/`;
                    const finalPath = extension
                        ? normalizePath(`${base}${uniqueBaseName}.${extension}`)
                        : normalizePath(`${base}${uniqueBaseName}`);

                    // Decide text vs binary import
                    const lowerName = file.name.toLowerCase();
                    const mime = file.type || '';
                    const isLikelyText =
                        extension.toLowerCase() === 'md' ||
                        mime.startsWith('text/') ||
                        mime === 'application/json' ||
                        mime === 'application/xml' ||
                        /\.(canvas|json|csv|txt|xml|html|css|js|ts)$/i.test(lowerName);

                    if (isLikelyText) {
                        const content = await file.text();
                        await app.vault.create(finalPath, content);
                    } else {
                        const arrayBuffer = await file.arrayBuffer();
                        await app.vault.createBinary(finalPath, arrayBuffer);
                    }

                    importedCount.success++;
                } catch (error) {
                    console.error(`Failed to import file ${file.name}:`, error);
                    errors.push(file.name);
                    importedCount.failed++;
                }
            }

            // Show notification
            if (importedCount.success > 0) {
                const message =
                    importedCount.success === 1
                        ? strings.dragDrop.notifications.fileImported
                        : strings.dragDrop.notifications.filesImported.replace('{count}', importedCount.success.toString());
                new Notice(message);
            }

            if (importedCount.failed > 0) {
                const errorMessage = strings.dragDrop.errors.failedToImportFiles.replace('{names}', errors.join(', '));
                new Notice(errorMessage, TIMEOUTS.NOTICE_ERROR);
            }
        },
        [app]
    );

    /**
     * Handles the drop event.
     * Validates the drop and performs the appropriate operation based on drop zone type.
     * - For folders: moves files/folders or imports external files
     * - For tags: adds tag to files
     * - For untagged: clears all tags from files
     *
     * @param e - The drag event
     */
    const handleDrop = useCallback(
        async (e: DragEvent) => {
            e.preventDefault();
            if (dragOverElement.current) {
                dragOverElement.current.classList.remove('nn-drag-over');
            }

            let dropZone = dragOverElement.current;
            if (!dropZone && isHTMLElement(e.target)) {
                const candidate = e.target.closest('[data-drop-zone]');
                dropZone = candidate instanceof HTMLElement ? candidate : null;
            }
            if (!dropZone) return;

            const dropType = dropZone.getAttribute('data-drop-zone');
            const targetPath = getPathFromDataAttribute(dropZone, 'data-drop-path');

            if (!dropType || !targetPath) return;

            // Handle tag drops
            if (dropType === 'tag') {
                // If external drag, show notice and ignore
                const typesList = e.dataTransfer?.types;
                const hasObsidianData = !!typesList?.includes('obsidian/file') || !!typesList?.includes('obsidian/files');
                const isExternal = !!typesList?.includes('Files') && !hasObsidianData;
                if (isExternal) {
                    new Notice(strings.fileSystem.notifications.tagOperationsNotAvailable, TIMEOUTS.NOTICE_ERROR);
                    return;
                }

                await handleTagDrop(e, targetPath);
                return;
            }

            // Handle folder drops
            const targetFolder = app.vault.getFolderByPath(targetPath);
            if (!targetFolder) return;

            // Check for external files from OS
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                // Detect internal vs external via types
                const typesList = e.dataTransfer.types;
                const hasObsidianData = !!typesList?.includes('obsidian/file') || !!typesList?.includes('obsidian/files');
                if (!hasObsidianData) {
                    await handleExternalFileDrop(e.dataTransfer.files, targetFolder);
                    return;
                }
            }

            // Check if dragging multiple files (never folders - folders are always single)
            const multipleFilesData = e.dataTransfer?.getData('obsidian/files');
            if (multipleFilesData) {
                // Multiple items = always files, never folders
                try {
                    const selectedPaths = JSON.parse(multipleFilesData);
                    if (Array.isArray(selectedPaths)) {
                        const filesToMove = getFilesFromPaths(selectedPaths);
                        if (filesToMove.length > 0) {
                            await moveFilesWithContext(filesToMove, targetFolder);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing multiple files data:', error);
                    return;
                }
            } else {
                // Single item - could be file or folder
                const singleItemData = e.dataTransfer?.getData('obsidian/file');
                if (!singleItemData) return;

                const sourceItem = app.vault.getAbstractFileByPath(singleItemData);
                if (!sourceItem) return;

                if (sourceItem instanceof TFile) {
                    await moveFilesWithContext([sourceItem], targetFolder);
                } else if (sourceItem instanceof TFolder) {
                    // Don't allow moving a folder into itself or its descendants
                    if (targetFolder.path === sourceItem.path || targetFolder.path.startsWith(`${sourceItem.path}/`)) {
                        new Notice(strings.dragDrop.errors.cannotMoveIntoSelf);
                        return;
                    }

                    // Check if folder is already in the target location (same parent)
                    if (sourceItem.parent?.path === targetFolder.path) {
                        // Folder is already in this location, no need to move
                        return;
                    }

                    try {
                        const base = targetFolder.path === '/' ? '' : `${targetFolder.path}/`;
                        const newPath = normalizePath(`${base}${sourceItem.name}`);
                        await app.fileManager.renameFile(sourceItem, newPath);
                        new Notice(strings.fileSystem.notifications.folderMoved.replace('{name}', sourceItem.name));
                    } catch (error) {
                        console.error('Error moving folder:', error);
                        new Notice(strings.dragDrop.errors.failedToMoveFolder.replace('{name}', sourceItem.name));
                    }
                }
            }
        },
        [app, handleTagDrop, handleExternalFileDrop, moveFilesWithContext, getFilesFromPaths]
    );

    /**
     * Handles the drag leave event.
     * Removes drag-over styling when leaving a drop zone.
     *
     * @param e - The drag event
     */
    const handleDragLeave = useCallback((e: DragEvent) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        const dropZone = target.closest('[data-drop-zone]');
        if (dropZone instanceof HTMLElement && dropZone === dragOverElement.current) {
            // Only remove if we're actually leaving the drop zone, not just moving to a child
            const relatedTarget = e.relatedTarget;
            if (!(relatedTarget instanceof Node) || !dropZone.contains(relatedTarget)) {
                dropZone.classList.remove('nn-drag-over');
                dragOverElement.current = null;
            }
        }
    }, []);

    /**
     * Handles the drag end event.
     * Cleans up drag-related CSS classes and removes the drag ghost.
     *
     * @param e - The drag event
     */
    const handleDragEnd = useCallback(
        (e: DragEvent) => {
            const target = e.target;
            if (!isHTMLElement(target)) return;
            const draggable = target.closest('[data-draggable="true"]');
            const path = getPathFromDataAttribute(draggable instanceof HTMLElement ? draggable : null, 'data-drag-path');

            // Remove dragging class from all selected files if dragging multiple
            if (path && selectionState.selectedFiles.has(path)) {
                selectionState.selectedFiles.forEach(selectedPath => {
                    const el = containerRef.current?.querySelector(`[data-drag-path="${selectedPath}"]`);
                    el?.classList.remove('nn-dragging');
                });
            } else {
                draggable?.classList.remove('nn-dragging');
            }

            if (dragOverElement.current) {
                dragOverElement.current.classList.remove('nn-drag-over');
                dragOverElement.current = null;
            }

            cleanupDragGhost();
        },
        [selectionState, containerRef, cleanupDragGhost]
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container || isMobile) return;

        // Global handler for escape key to clean up ghost on cancel
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dragGhostElement.current) {
                cleanupDragGhost();
            }
        };

        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', handleDragEnd);
        document.addEventListener('keydown', handleEscape);

        return () => {
            container.removeEventListener('dragstart', handleDragStart);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('dragleave', handleDragLeave);
            container.removeEventListener('drop', handleDrop);
            container.removeEventListener('dragend', handleDragEnd);
            document.removeEventListener('keydown', handleEscape);

            // Clean up any lingering ghost on unmount
            cleanupDragGhost();
        };
    }, [containerRef, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd, isMobile, cleanupDragGhost]);
}
