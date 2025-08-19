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
import { TFile, TFolder, Notice, setIcon } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useTagOperations } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { strings } from '../i18n';
import { getDBInstance } from '../storage/fileOperations';
import { ItemType, UNTAGGED_TAG_ID } from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { getPathFromDataAttribute } from '../utils/domUtils';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';

/**
 * Custom hook that enables drag and drop functionality for files and folders.
 * Handles visual feedback, validation, and file system operations.
 *
 * ## Design Decision: Event Delegation with Data Attributes
 * This hook uses event delegation and data attributes rather than individual React event handlers.
 * While this differs from typical React patterns, it's the optimal choice here because:
 *
 * 1. **Performance**: One set of listeners on the container vs hundreds on individual items
 * 2. **Memory Efficiency**: Scales well with large vaults containing many files/folders
 * 3. **Dynamic Content**: Works seamlessly as items are added/removed from the DOM
 * 4. **Obsidian Consistency**: Follows patterns used throughout Obsidian's codebase
 * 5. **Simplicity**: Avoids prop drilling drag handlers through multiple component levels
 *
 * The alternative React approach would require:
 * - Passing drag handlers as props through FolderTree → FolderItem → each nested level
 * - Managing drag state in React state (causing unnecessary re-renders)
 * - Complex coordination between deeply nested components
 *
 * Data attributes provide a clean, performant way to associate drag data with DOM elements
 * without coupling the drag logic to the component hierarchy.
 *
 * @param containerRef - React ref to the container element that will handle drag events
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * useDragAndDrop(containerRef);
 *
 * return (
 *   <div ref={containerRef}>
 *     <div data-draggable="true" data-drag-path="/path/to/file" data-drag-type="file">
 *       Draggable item
 *     </div>
 *     <div data-drop-zone="folder" data-drop-path="/path/to/folder">
 *       Drop zone
 *     </div>
 *   </div>
 * );
 * ```
 */
export function useDragAndDrop(containerRef: React.RefObject<HTMLElement | null>) {
    const { app, isMobile, tagTreeService } = useServices();
    const fileSystemOps = useFileSystemOps();
    const tagOperations = useTagOperations();
    const selectionState = useSelectionState();
    const dispatch = useSelectionDispatch();
    const settings = useSettingsState();
    const db = getDBInstance();
    const dragOverElement = useRef<HTMLElement | null>(null);
    const dragGhostElement = useRef<HTMLElement | null>(null);

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
     * Handles the drag start event.
     * Extracts drag data from data attributes and sets drag effect.
     * Also generates markdown links for dragging into editor panes.
     *
     * @param e - The drag event
     */
    const handleDragStart = useCallback(
        (e: DragEvent) => {
            const target = e.target as HTMLElement;
            const draggable = target.closest('[data-draggable="true"]');
            if (!draggable) return;

            const path = getPathFromDataAttribute(draggable as HTMLElement, 'data-drag-path');
            const type = draggable.getAttribute('data-drag-type');
            if (path && e.dataTransfer) {
                // Check if dragging a selected file with multiple selections
                if (type === ItemType.FILE && selectionState.selectedFiles.has(path) && selectionState.selectedFiles.size > 1) {
                    // Store all selected file paths
                    const selectedPaths = Array.from(selectionState.selectedFiles);
                    e.dataTransfer.setData('obsidian/files', JSON.stringify(selectedPaths));
                    e.dataTransfer.effectAllowed = 'copyMove';

                    // Generate markdown links for all selected files
                    const markdownLinks: string[] = [];
                    selectedPaths.forEach(selectedPath => {
                        const file = app.vault.getFileByPath(selectedPath);
                        if (file) {
                            // Generate markdown link respecting user's wikilink setting
                            const link = app.fileManager.generateMarkdownLink(file, '');
                            markdownLinks.push(link);
                        }
                    });

                    // Set markdown links for dragging into editor
                    if (markdownLinks.length > 0) {
                        e.dataTransfer.setData('text/plain', markdownLinks.join('\n'));
                    }

                    // Add dragging class to all selected files
                    selectedPaths.forEach(selectedPath => {
                        const el = containerRef.current?.querySelector(`[data-drag-path="${selectedPath}"]`);
                        el?.classList.add('nn-dragging');
                    });

                    // Hide browser's default drag preview with empty element
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'nn-drag-empty-placeholder';
                    document.body.appendChild(emptyDiv);
                    e.dataTransfer.setDragImage(emptyDiv, 0, 0);
                    // Clean up the empty div immediately
                    setTimeout(() => emptyDiv.remove(), 0);

                    // Create custom drag ghost that follows cursor
                    const dragGhost = document.createElement('div');
                    dragGhost.className = 'nn-drag-ghost';

                    // Set initial position at cursor
                    dragGhost.style.left = `${e.clientX + 10}px`;
                    dragGhost.style.top = `${e.clientY + 10}px`;

                    // Multiple items - show count badge
                    const dragInfo = document.createElement('div');
                    dragInfo.className = 'nn-drag-ghost-badge';
                    dragInfo.textContent = `${selectedPaths.length}`;
                    dragGhost.appendChild(dragInfo);

                    document.body.appendChild(dragGhost);
                    dragGhostElement.current = dragGhost;

                    // Start tracking mouse position
                    document.addEventListener('mousemove', updateDragGhostPosition);
                    // Also listen to drag events for position updates
                    document.addEventListener('dragover', updateDragGhostPosition);
                } else {
                    // Single item drag
                    e.dataTransfer.setData('obsidian/file', path);
                    e.dataTransfer.effectAllowed = 'copyMove';

                    // Generate markdown link for single file
                    if (type === ItemType.FILE) {
                        const file = app.vault.getFileByPath(path);
                        if (file) {
                            const link = app.fileManager.generateMarkdownLink(file, '');
                            e.dataTransfer.setData('text/plain', link);
                        }
                    }

                    draggable.classList.add('nn-dragging');

                    // Hide browser's default drag preview with empty element
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'nn-drag-empty-placeholder';
                    document.body.appendChild(emptyDiv);
                    e.dataTransfer.setDragImage(emptyDiv, 0, 0);
                    // Clean up the empty div immediately
                    setTimeout(() => emptyDiv.remove(), 0);

                    // Only show custom drag ghost for files, not folders
                    if (type === ItemType.FILE) {
                        // Create custom drag ghost that follows cursor
                        const dragGhost = document.createElement('div');
                        dragGhost.className = 'nn-drag-ghost';

                        // Create drag icon element
                        const dragIcon = document.createElement('div');
                        dragIcon.className = 'nn-drag-ghost-icon';

                        // Try to use featured image if available
                        const featureImagePath = db.getCachedFeatureImageUrl(path);
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

                        // Use file icon as fallback if no image loaded
                        if (!imageLoaded) {
                            setIcon(dragIcon, 'file');
                        }

                        dragGhost.appendChild(dragIcon);

                        // Set initial position at cursor
                        dragGhost.style.left = `${e.clientX + 10}px`;
                        dragGhost.style.top = `${e.clientY + 10}px`;

                        document.body.appendChild(dragGhost);
                        dragGhostElement.current = dragGhost;

                        // Start tracking mouse position
                        document.addEventListener('mousemove', updateDragGhostPosition);
                        // Also listen to drag events for position updates
                        document.addEventListener('dragover', updateDragGhostPosition);
                    }
                }
            }
        },
        [selectionState, containerRef, app, db, updateDragGhostPosition]
    );

    /**
     * Handles the drag over event.
     * Provides visual feedback by adding CSS classes to valid drop targets.
     *
     * @param e - The drag event
     */
    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const dropZone = target.closest<HTMLElement>('[data-drop-zone="folder"],[data-drop-zone="tag"]');

        if (dragOverElement.current && dragOverElement.current !== dropZone) {
            dragOverElement.current.classList.remove('nn-drag-over');
            dragOverElement.current = null;
        }

        if (dropZone) {
            dropZone.classList.add('nn-drag-over');
            dragOverElement.current = dropZone;
            if (e.dataTransfer) {
                const dropType = dropZone.getAttribute('data-drop-zone');
                const targetPath = dropZone.getAttribute('data-drop-path');

                // Use 'move' for folders and untagged, 'copy' for regular tags
                if (dropType === 'folder' || targetPath === UNTAGGED_TAG_ID) {
                    e.dataTransfer.dropEffect = 'move';
                } else {
                    e.dataTransfer.dropEffect = 'copy';
                }
            }
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
            // Get all files being dragged
            const files: TFile[] = [];

            // Check if dragging multiple files
            const multipleFilesData = e.dataTransfer?.getData('obsidian/files');
            if (multipleFilesData) {
                try {
                    const selectedPaths = JSON.parse(multipleFilesData);
                    if (Array.isArray(selectedPaths)) {
                        for (const path of selectedPaths) {
                            const file = app.vault.getFileByPath(path);
                            if (file) {
                                files.push(file);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error parsing multiple files data:', error);
                    return; // Early return on parse error
                }
            } else {
                // Check if dragging single file
                const singleFileData = e.dataTransfer?.getData('obsidian/file');
                if (singleFileData) {
                    const file = app.vault.getFileByPath(singleFileData);
                    if (file) {
                        files.push(file);
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
        [app, tagOperations]
    );

    /**
     * Handles the drop event.
     * Validates the drop and performs the appropriate operation based on drop zone type.
     * - For folders: moves files/folders
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

            const dropZone = dragOverElement.current;
            if (!dropZone) return;

            const dropType = dropZone.getAttribute('data-drop-zone');
            const targetPath = getPathFromDataAttribute(dropZone, 'data-drop-path');

            if (!dropType || !targetPath) return;

            // Handle tag drops
            if (dropType === 'tag') {
                await handleTagDrop(e, targetPath);
                return;
            }

            // Handle folder drops (existing logic)
            const targetFolder = app.vault.getAbstractFileByPath(targetPath);
            if (!(targetFolder instanceof TFolder)) return;

            // Collect files to move
            const filesToMove: TFile[] = [];

            // Check if dragging multiple files
            const multipleFilesData = e.dataTransfer?.getData('obsidian/files');
            if (multipleFilesData) {
                try {
                    const selectedPaths = JSON.parse(multipleFilesData);
                    if (Array.isArray(selectedPaths)) {
                        // Convert paths to TFile objects
                        for (const path of selectedPaths) {
                            const file = app.vault.getFileByPath(path);
                            if (file) {
                                filesToMove.push(file);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error parsing multiple files data:', error);
                    return; // Early return on parse error
                }
            } else {
                // Check if dragging single file
                const singleFileData = e.dataTransfer?.getData('obsidian/file');
                if (!singleFileData) return;

                const sourceItem = app.vault.getFileByPath(singleFileData);
                if (!sourceItem) return;

                filesToMove.push(sourceItem);
            }

            // Process all files at once
            if (filesToMove.length > 0) {
                const currentFiles = getCurrentFileList();
                await fileSystemOps.moveFilesToFolder({
                    files: filesToMove,
                    targetFolder,
                    selectionContext: {
                        selectedFile: selectionState.selectedFile,
                        dispatch,
                        allFiles: currentFiles
                    },
                    showNotifications: true
                });
            }
        },
        [app, fileSystemOps, selectionState, getCurrentFileList, dispatch, handleTagDrop]
    );

    /**
     * Handles the drag leave event.
     * Removes drag-over styling when leaving a drop zone.
     *
     * @param e - The drag event
     */
    const handleDragLeave = useCallback((e: DragEvent) => {
        const target = e.target as HTMLElement;
        const dropZone = target.closest('[data-drop-zone]') as HTMLElement;
        if (dropZone && dropZone === dragOverElement.current) {
            // Only remove if we're actually leaving the drop zone, not just moving to a child
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!dropZone.contains(relatedTarget)) {
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
            const target = e.target as HTMLElement;
            const draggable = target.closest('[data-draggable="true"]');
            const path = getPathFromDataAttribute(draggable as HTMLElement, 'data-drag-path');

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

            // Clean up drag ghost
            if (dragGhostElement.current) {
                document.removeEventListener('mousemove', updateDragGhostPosition);
                document.removeEventListener('dragover', updateDragGhostPosition);
                dragGhostElement.current.remove();
                dragGhostElement.current = null;
            }
        },
        [selectionState, containerRef, updateDragGhostPosition]
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container || isMobile) return;

        // Global handler for escape key to clean up ghost on cancel
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dragGhostElement.current) {
                document.removeEventListener('mousemove', updateDragGhostPosition);
                document.removeEventListener('dragover', updateDragGhostPosition);
                dragGhostElement.current.remove();
                dragGhostElement.current = null;
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
            if (dragGhostElement.current) {
                document.removeEventListener('mousemove', updateDragGhostPosition);
                document.removeEventListener('dragover', updateDragGhostPosition);
                dragGhostElement.current.remove();
                dragGhostElement.current = null;
            }
        };
    }, [containerRef, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd, isMobile, updateDragGhostPosition]);
}
