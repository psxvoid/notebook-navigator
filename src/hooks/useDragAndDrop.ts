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
import { TFile, Notice, setIcon } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useTagOperations } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { strings } from '../i18n';
import { getDBInstance } from '../storage/fileOperations';
import { ItemType, UNTAGGED_TAG_ID } from '../types';
import { getPathFromDataAttribute } from '../utils/domUtils';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { isTFolder, isTFile } from '../utils/typeGuards';

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
    const { app, isMobile } = useServices();
    const fileSystemOps = useFileSystemOps();
    const tagOperations = useTagOperations();
    const selectionState = useSelectionState();
    const dispatch = useSelectionDispatch();
    const settings = useSettingsState();
    const db = getDBInstance();
    const dragOverElement = useRef<HTMLElement | null>(null);

    /**
     * Helper function to get current file list based on selection
     */
    const getCurrentFileList = useCallback((): TFile[] => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            return getFilesForFolder(selectionState.selectedFolder, settings, app);
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return getFilesForTag(selectionState.selectedTag, settings, app);
        }
        return [];
    }, [selectionState, settings, app]);

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
                        const file = app.vault.getAbstractFileByPath(selectedPath);
                        if (isTFile(file)) {
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

                    // Always show custom drag image for consistency
                    const dragContainer = document.createElement('div');
                    dragContainer.className = 'nn-drag-image-container';

                    // Multiple items - always show count badge
                    const dragInfo = document.createElement('div');
                    dragInfo.className = 'nn-drag-count-badge';
                    dragInfo.textContent = `${selectedPaths.length}`;
                    dragContainer.appendChild(dragInfo);

                    document.body.appendChild(dragContainer);
                    // Use negative offset to position icon bottom-right of cursor
                    e.dataTransfer.setDragImage(dragContainer, -10, -10);
                    setTimeout(() => document.body.removeChild(dragContainer), 0);
                } else {
                    // Single item drag
                    e.dataTransfer.setData('obsidian/file', path);
                    e.dataTransfer.effectAllowed = 'copyMove';

                    // Generate markdown link for single file
                    if (type === ItemType.FILE) {
                        const file = app.vault.getAbstractFileByPath(path);
                        if (isTFile(file)) {
                            const link = app.fileManager.generateMarkdownLink(file, '');
                            e.dataTransfer.setData('text/plain', link);
                        }
                    }

                    draggable.classList.add('nn-dragging');

                    // Only show custom drag image for files, not folders
                    if (type === ItemType.FILE) {
                        const dragContainer = document.createElement('div');
                        dragContainer.className = 'nn-drag-image-container';

                        // Get featured image from cache
                        const featureImageUrl = db.getDisplayFeatureImageUrl(path);

                        if (featureImageUrl) {
                            // Show featured image in drag badge
                            const dragIcon = document.createElement('div');
                            dragIcon.className = 'nn-drag-icon-badge nn-drag-featured-image';
                            const img = document.createElement('img');
                            img.src = featureImageUrl;
                            dragIcon.appendChild(img);
                            dragContainer.appendChild(dragIcon);
                        } else {
                            // Show file icon as fallback
                            const dragIcon = document.createElement('div');
                            dragIcon.className = 'nn-drag-icon-badge';
                            setIcon(dragIcon, 'file');
                            dragContainer.appendChild(dragIcon);
                        }

                        document.body.appendChild(dragContainer);
                        // Use negative offset to position icon bottom-right of cursor
                        e.dataTransfer.setDragImage(dragContainer, -5, -5);
                        setTimeout(() => document.body.removeChild(dragContainer), 0);
                    }
                }
            }
        },
        [selectionState, containerRef, app]
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
                            const file = app.vault.getAbstractFileByPath(path);
                            if (isTFile(file)) {
                                files.push(file);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error parsing multiple files data:', error);
                }
            } else {
                // Check if dragging single file
                const singleFileData = e.dataTransfer?.getData('obsidian/file');
                if (singleFileData) {
                    const file = app.vault.getAbstractFileByPath(singleFileData);
                    if (isTFile(file)) {
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
                        new Notice(strings.dragDrop.notifications.clearedTags.replace('{count}', clearedCount.toString()));
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
                        new Notice(
                            strings.dragDrop.notifications.addedTag.replace('{tag}', targetTag).replace('{count}', added.toString())
                        );
                    }
                    if (skipped > 0) {
                        new Notice(strings.dragDrop.notifications.filesAlreadyHaveTag.replace('{count}', skipped.toString()), 2000);
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
            if (!isTFolder(targetFolder)) return;

            // Check if dragging multiple files
            const multipleFilesData = e.dataTransfer?.getData('obsidian/files');
            if (multipleFilesData) {
                try {
                    const selectedPaths = JSON.parse(multipleFilesData);
                    if (Array.isArray(selectedPaths)) {
                        // Convert paths to TFile objects
                        const filesToMove: TFile[] = [];
                        for (const path of selectedPaths) {
                            const file = app.vault.getAbstractFileByPath(path);
                            if (isTFile(file)) {
                                filesToMove.push(file);
                            }
                        }

                        if (filesToMove.length > 0) {
                            // Use the shared moveFilesToFolder method
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
                        return;
                    }
                } catch (error) {
                    console.error('Error parsing multiple files data:', error);
                }
            }

            // Check if dragging single file
            const singleFileData = e.dataTransfer?.getData('obsidian/file');
            if (!singleFileData) return;

            const sourceItem = app.vault.getAbstractFileByPath(singleFileData);
            if (!sourceItem || !isTFile(sourceItem)) return;

            // Use the shared moveFilesToFolder method for single files too
            const currentFiles = getCurrentFileList();
            await fileSystemOps.moveFilesToFolder({
                files: [sourceItem],
                targetFolder,
                selectionContext: {
                    selectedFile: selectionState.selectedFile,
                    dispatch,
                    allFiles: currentFiles
                },
                showNotifications: true
            });
        },
        [app, fileSystemOps, tagOperations, selectionState, getCurrentFileList, dispatch]
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
     * Cleans up drag-related CSS classes.
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
        },
        [selectionState, containerRef]
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container || isMobile) return;

        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', handleDragEnd);

        return () => {
            container.removeEventListener('dragstart', handleDragStart);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('dragleave', handleDragLeave);
            container.removeEventListener('drop', handleDrop);
            container.removeEventListener('dragend', handleDragEnd);
        };
    }, [containerRef, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd, isMobile]);
}
