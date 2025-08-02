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

import { useCallback, useEffect, useRef } from 'react';
import { TFile, TFolder, FileView } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { getSupportedLeaves, NavigationPaneItemType, ListPaneItemType, ItemType } from '../types';
import { TagTreeNode } from '../types/storage';
import { CombinedNavigationItem, ListPaneItem } from '../types/virtualization';
import { deleteSelectedFiles, deleteSelectedFolder } from '../utils/deleteOperations';
import { isTypingInInput } from '../utils/domUtils';
import { getFilesInRange } from '../utils/selectionUtils';
import { useMultiSelection } from './useMultiSelection';

type VirtualItem = CombinedNavigationItem | ListPaneItem;

// Helper function for safe array access
const safeGetItem = <T>(array: T[], index: number): T | undefined => {
    return index >= 0 && index < array.length ? array[index] : undefined;
};

// Check if item is selectable (not a header or spacer)
const isSelectableItem = (item: VirtualItem, pane: string): boolean => {
    if (!item || !('type' in item)) return false;

    if (pane === 'files') {
        const fileItem = item as ListPaneItem;
        return fileItem.type === ListPaneItemType.FILE;
    } else {
        const navigationPaneItem = item as CombinedNavigationItem;
        return (
            navigationPaneItem.type === NavigationPaneItemType.FOLDER ||
            navigationPaneItem.type === NavigationPaneItemType.TAG ||
            navigationPaneItem.type === NavigationPaneItemType.UNTAGGED
        );
    }
};

// Helper function to find next selectable item
const findNextSelectableIndex = (items: VirtualItem[], currentIndex: number, pane: string, includeCurrent: boolean = false): number => {
    // If no items, return -1
    if (items.length === 0) return -1;

    // If no current selection, find the first selectable item
    if (currentIndex < 0) {
        for (let i = 0; i < items.length; i++) {
            const item = safeGetItem(items, i);
            if (item && isSelectableItem(item, pane)) {
                return i;
            }
        }
        return -1; // No selectable items found
    }

    const start = includeCurrent ? currentIndex : currentIndex + 1;
    for (let i = start; i < items.length; i++) {
        const item = safeGetItem(items, i);
        if (item && isSelectableItem(item, pane)) {
            return i;
        }
    }

    return currentIndex; // Stay at current if no next item
};

// Helper function to find previous selectable item
const findPreviousSelectableIndex = (items: VirtualItem[], currentIndex: number, pane: string, includeCurrent: boolean = false): number => {
    // If no items or invalid index, return -1
    if (items.length === 0 || currentIndex < 0) return -1;

    const start = includeCurrent ? currentIndex : currentIndex - 1;
    for (let i = start; i >= 0; i--) {
        const item = safeGetItem(items, i);
        if (item && isSelectableItem(item, pane)) {
            return i;
        }
    }

    return currentIndex; // Stay at current if no previous item
};

/**
 * Calculates the number of items that fit in the viewport based on geometry.
 * This is the only reliable way to get a consistent page size.
 *
 * Algorithm:
 * 1. Get all currently rendered virtual items (not all items, just visible ones)
 * 2. Calculate the total height spanned by these rendered items
 * 3. Divide by the number of items to get average item height
 * 4. Divide viewport height by average item height to get items per page
 * 5. Subtract 1 from page size to maintain visual context when paging
 *
 * Edge cases handled:
 * - No items rendered: returns default of 10
 * - Zero height items: returns default of 10
 * - Very small viewport: ensures minimum jump of 1 item
 *
 * @param virtualizer The virtualizer instance.
 * @returns The number of items to jump for a page up/down action.
 */
const getVisiblePageSize = (virtualizer: Virtualizer<HTMLDivElement, Element>): number => {
    const virtualItems = virtualizer.getVirtualItems();
    // If the virtualizer or its scroll element isn't ready, return a sensible default.
    if (virtualItems.length === 0 || !virtualizer.scrollElement) {
        return 10;
    }

    // Get the height of the visible scroll area.
    const viewportHeight = virtualizer.scrollElement.offsetHeight;

    // To find the average item height, we measure the total height of all *rendered*
    // items and divide by the number of rendered items.
    if (virtualItems.length === 0) {
        return 10;
    }
    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];
    const totalMeasuredHeight = lastItem.start + lastItem.size - firstItem.start;

    // Avoid division by zero if height is somehow 0.
    if (totalMeasuredHeight <= 0) {
        return 10;
    }

    const averageItemHeight = totalMeasuredHeight / virtualItems.length;

    if (averageItemHeight <= 0) {
        return 10;
    }

    // The true page size is how many average-sized items fit in the viewport.
    const pageSize = Math.floor(viewportHeight / averageItemHeight);

    // Jump by a full page minus one item for visual context, ensuring we jump at least 1.
    return Math.max(1, pageSize > 1 ? pageSize - 1 : 1);
};

interface UseVirtualKeyboardNavigationProps<T extends VirtualItem> {
    items: T[];
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    focusedPane: 'navigation' | 'files';
    /**
     * Reference to the container element where keyboard events should be captured.
     * This is typically the root navigator container (.nn-split-container).
     *
     * IMPORTANT: By attaching keyboard listeners to the navigator container instead
     * of the document, we ensure that keyboard events are only captured when the
     * user is interacting with the navigator. This prevents conflicts with other
     * Obsidian views like the canvas editor, where Delete key has different functionality.
     */
    containerRef: React.RefObject<HTMLDivElement | null>;
    pathToIndex: Map<string, number>; // O(1) lookup for item positions
    files: TFile[]; // Array of files for multi-selection optimization
    fileIndexMap: Map<string, number>; // O(1) lookup for file positions in files array
}

/**
 * Custom hook for keyboard navigation in virtualized lists.
 * Works with flattened data arrays instead of DOM queries.
 * Returns a keyboard event handler that should be attached to the container element.
 */
export function useVirtualKeyboardNavigation<T extends VirtualItem>({
    items,
    virtualizer,
    focusedPane,
    containerRef,
    pathToIndex,
    files,
    fileIndexMap
}: UseVirtualKeyboardNavigationProps<T>) {
    const { app, isMobile, tagTreeService } = useServices();
    const settings = useSettingsState();
    const fileSystemOps = useFileSystemOps();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const lastKeyPressTime = useRef(0);
    const multiSelection = useMultiSelection(virtualizer);

    // Select item at given index
    const selectItemAtIndex = useCallback(
        (item: VirtualItem) => {
            if (!item || !('type' in item)) return;

            if (focusedPane === 'files') {
                const fileItem = item as ListPaneItem;
                if (fileItem.type === ListPaneItemType.FILE) {
                    const file = fileItem.data instanceof TFile ? fileItem.data : null;
                    if (!file) return;
                    // Normal navigation clears multi-selection
                    selectionDispatch({ type: 'SET_SELECTED_FILE', file });

                    // Open the file in the editor but keep focus in file list
                    const leaf = app.workspace.getLeaf(false);
                    if (leaf) {
                        leaf.openFile(file, { active: false });
                    }
                }
            } else {
                const navigationPaneItem = item as CombinedNavigationItem;
                if (navigationPaneItem.type === NavigationPaneItemType.FOLDER) {
                    const folder = navigationPaneItem.data;
                    selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

                    // Auto-expand if enabled and folder has children
                    if (settings.autoExpandFoldersTags && folder.children.some(child => child instanceof TFolder)) {
                        // Only expand if not already expanded
                        if (!expansionState.expandedFolders.has(folder.path)) {
                            expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                        }
                    }
                } else if (
                    navigationPaneItem.type === NavigationPaneItemType.TAG ||
                    navigationPaneItem.type === NavigationPaneItemType.UNTAGGED
                ) {
                    const tagNode = navigationPaneItem.data as TagTreeNode;
                    const context = 'context' in navigationPaneItem ? navigationPaneItem.context : undefined;
                    selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagNode.path, context });

                    // Auto-expand if enabled and tag has children
                    if (settings.autoExpandFoldersTags && tagNode.children.size > 0) {
                        // Only expand if not already expanded
                        if (!expansionState.expandedTags.has(tagNode.path)) {
                            expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tagNode.path });
                        }
                    }
                }
            }
        },
        [focusedPane, selectionDispatch, app, settings, expansionState, expansionDispatch]
    );

    // Handle expand/collapse for folders and tags
    const handleExpandCollapse = useCallback(
        (item: VirtualItem, expand: boolean) => {
            if (!item || !('type' in item)) return;

            const navigationPaneItem = item as CombinedNavigationItem;
            if (navigationPaneItem.type === NavigationPaneItemType.FOLDER) {
                const folder = navigationPaneItem.data;
                const isExpanded = expansionState.expandedFolders.has(folder.path);
                if (expand && !isExpanded && folder.children.length > 0) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                }
            } else if (navigationPaneItem.type === NavigationPaneItemType.TAG) {
                const tag = navigationPaneItem.data as TagTreeNode;
                const isExpanded = expansionState.expandedTags.has(tag.path);
                if (expand && !isExpanded && tag.children.size > 0) {
                    expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
                }
            }
        },
        [expansionState, expansionDispatch]
    );

    // Helper function to handle range selection with Home/End
    const handleRangeSelection = useCallback(
        (direction: 'home' | 'end', currentFileIndex: number) => {
            const targetIndex = direction === 'home' ? 0 : files.length - 1;
            const targetFile = files[targetIndex];
            if (!targetFile) return;

            // Get files in range
            const filesInRange = getFilesInRange(
                files,
                direction === 'home' ? 0 : currentFileIndex,
                direction === 'home' ? currentFileIndex : files.length - 1
            );

            // Select all files in range that aren't already selected
            filesInRange.forEach(f => {
                if (!selectionState.selectedFiles.has(f.path)) {
                    selectionDispatch({ type: 'TOGGLE_FILE_SELECTION', file: f });
                }
            });

            // Move cursor to target position
            selectionDispatch({ type: 'UPDATE_CURRENT_FILE', file: targetFile });

            // Open the file without changing focus
            const leaf = app.workspace.getLeaf(false);
            if (leaf) {
                leaf.openFile(targetFile, { active: false });
            }

            // Scroll to target position
            virtualizer.scrollToIndex(targetIndex, {
                align: 'auto',
                behavior: 'auto'
            });
        },
        [files, selectionState.selectedFiles, selectionDispatch, app.workspace, virtualizer]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // KEYBOARD EVENT FILTERING:
            // This handler only receives events from within the navigator container,
            // preventing interference with other Obsidian views (canvas, markdown editor, etc.)

            // 1. Check if the navigator is focused
            // This is important for all keys to ensure we don't process events
            // when the user is interacting with other views
            const navigatorContainer = containerRef.current;
            const navigatorFocused = navigatorContainer?.getAttribute('data-navigator-focused');
            if (navigatorFocused !== 'true') return;

            // 2. Skip if user is typing in an input field
            if (isTypingInInput(e)) return;

            // 3. Skip if a modal is open
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && activeElement.closest('.modal-container')) {
                return;
            }

            // 4. Only handle events for the currently focused pane
            // (navigation pane or files pane, but not both)
            if (uiState.focusedPane !== focusedPane) return;

            // Debounce rapid key presses with a more reasonable threshold
            const now = Date.now();
            if (now - lastKeyPressTime.current < 16) {
                // ~60fps threshold
                return;
            }
            lastKeyPressTime.current = now;

            // Check if RTL mode is active
            const isRTL = document.body.classList.contains('mod-rtl');

            let currentIndex = -1;
            let targetIndex = -1;

            // Find current selection index using O(1) lookup
            if (focusedPane === 'files' && selectionState.selectedFile?.path) {
                currentIndex = pathToIndex.get(selectionState.selectedFile.path) ?? -1;
            } else if (focusedPane === 'navigation') {
                if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder?.path) {
                    currentIndex = pathToIndex.get(selectionState.selectedFolder.path) ?? -1;
                } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                    currentIndex = pathToIndex.get(selectionState.selectedTag) ?? -1;
                }
            }

            // Swap left/right arrow behavior for RTL layouts
            let effectiveKey = e.key;
            if (isRTL) {
                switch (e.key) {
                    case 'ArrowLeft':
                        effectiveKey = 'ArrowRight';
                        break;
                    case 'ArrowRight':
                        effectiveKey = 'ArrowLeft';
                        break;
                }
            }

            switch (effectiveKey) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (e.shiftKey && focusedPane === 'files' && !isMobile && selectionState.selectedFile?.path) {
                        // Multi-selection with Shift+Down
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            multiSelection.handleShiftArrowSelection('down', currentFileIndex, files);
                        }
                        return; // Don't process normal navigation
                    }

                    targetIndex = findNextSelectableIndex(items, currentIndex, focusedPane);

                    // Don't clear selection if we're at the bottom boundary
                    if (targetIndex === currentIndex && currentIndex >= 0) {
                        return; // Do nothing, stay at current position with selection intact
                    }
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    if (e.shiftKey && focusedPane === 'files' && !isMobile && currentIndex !== -1 && selectionState.selectedFile?.path) {
                        // Multi-selection with Shift+Up
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            multiSelection.handleShiftArrowSelection('up', currentFileIndex, files);
                        }
                        return; // Don't process normal navigation
                    }

                    // If nothing is selected, select the first item
                    if (currentIndex === -1) {
                        targetIndex = findNextSelectableIndex(items, -1, focusedPane);
                    } else {
                        targetIndex = findPreviousSelectableIndex(items, currentIndex, focusedPane);

                        // Don't clear selection if we're at the top boundary
                        if (targetIndex === currentIndex && currentIndex >= 0) {
                            return; // Do nothing, stay at current position with selection intact
                        }
                    }
                    break;

                case 'PageDown': {
                    e.preventDefault();
                    if (currentIndex === -1) break; // Cannot PageDown if nothing is selected.

                    const pageSize = getVisiblePageSize(virtualizer);
                    const newIndex = Math.min(currentIndex + pageSize, items.length - 1);

                    // Find the next selectable item starting from the new position.
                    let newTargetIndex = findNextSelectableIndex(items, newIndex - 1, focusedPane);

                    // FIX: If we didn't move, it means we are near the bottom.
                    // In this case, ensure we go to the very last selectable item.
                    if (newTargetIndex === currentIndex && currentIndex !== items.length - 1) {
                        // Find the last selectable item
                        for (let i = items.length - 1; i >= 0; i--) {
                            const item = safeGetItem(items, i);
                            if (item && isSelectableItem(item, focusedPane)) {
                                newTargetIndex = i;
                                break;
                            }
                        }
                    }

                    targetIndex = newTargetIndex;
                    break;
                }

                case 'PageUp': {
                    e.preventDefault();
                    if (currentIndex === -1) break; // Cannot PageUp if nothing is selected.

                    const pageSize = getVisiblePageSize(virtualizer);
                    const newIndex = Math.max(0, currentIndex - pageSize);

                    // Find the previous selectable item starting from the new position.
                    let newTargetIndex = findPreviousSelectableIndex(items, newIndex + 1, focusedPane);

                    // FIX: If we didn't move, it means we are near the top.
                    // In this case, ensure we go to the very first selectable item.
                    if (newTargetIndex === currentIndex && currentIndex !== 0) {
                        newTargetIndex = findNextSelectableIndex(items, -1, focusedPane);
                    }

                    targetIndex = newTargetIndex;
                    break;
                }

                case 'ArrowRight':
                    e.preventDefault();
                    if (focusedPane === 'navigation' && currentIndex >= 0) {
                        const item = safeGetItem(items, currentIndex) as CombinedNavigationItem | undefined;
                        if (!item) break;

                        let shouldSwitchPane = false;
                        if (item.type === NavigationPaneItemType.FOLDER) {
                            const folder = item.data;
                            const isExpanded = expansionState.expandedFolders.has(folder.path);
                            const hasChildren = folder.children.some(child => child instanceof TFolder);

                            if (hasChildren && !isExpanded) {
                                // If it has children and is collapsed, expand it.
                                handleExpandCollapse(item, true);
                            } else {
                                // If it has no children, or is already expanded, switch to the file pane.
                                shouldSwitchPane = true;
                            }
                        } else if (item.type === NavigationPaneItemType.TAG) {
                            // Similarly for tags
                            const tag = item.data as TagTreeNode;
                            const isExpanded = expansionState.expandedTags.has(tag.path);
                            const hasChildren = tag.children.size > 0;

                            if (hasChildren && !isExpanded) {
                                handleExpandCollapse(item, true);
                            } else {
                                shouldSwitchPane = true;
                            }
                        } else {
                            // For items with no children like 'untagged', just switch.
                            shouldSwitchPane = true;
                        }

                        if (shouldSwitchPane) {
                            if (uiState.singlePane && !isMobile) {
                                // In single-pane mode, switch to files view
                                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            } else {
                                // In dual-pane mode, just switch focus
                                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            }
                        }
                    } else if (focusedPane === 'files' && selectionState.selectedFile) {
                        // RIGHT arrow from files pane should focus the editor (same as TAB)
                        const leaves = getSupportedLeaves(app);
                        const targetLeaf = leaves.find(leaf => {
                            const view = leaf.view;
                            return view instanceof FileView && view.file?.path === selectionState.selectedFile?.path;
                        });
                        if (targetLeaf) {
                            app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                        }
                    }
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    if (focusedPane === 'files') {
                        if (uiState.singlePane && !isMobile) {
                            // In single-pane mode, switch to navigation view
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                        } else if (!uiState.singlePane) {
                            // In dual-pane mode, switch focus to folders pane
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                        }
                    } else if (focusedPane === 'navigation' && currentIndex >= 0) {
                        const item = safeGetItem(items, currentIndex) as CombinedNavigationItem | undefined;
                        if (!item) return;

                        if (item.type === NavigationPaneItemType.FOLDER) {
                            const folder = item.data;
                            const isExpanded = expansionState.expandedFolders.has(folder.path);
                            if (isExpanded) {
                                // Collapse the folder
                                handleExpandCollapse(item, false);
                            } else if (folder.parent && (!settings.showRootFolder || folder.path !== '/')) {
                                // Navigate to parent folder
                                const parentPath = folder.parent.path;
                                const parentIndex = pathToIndex.get(parentPath) ?? -1;
                                if (parentIndex >= 0) {
                                    const parentItem = safeGetItem(items, parentIndex);
                                    if (parentItem) {
                                        selectItemAtIndex(parentItem);
                                        // Scrolling now handled by virtualizer.scrollToIndex
                                    }
                                }
                            }
                        } else if (item.type === NavigationPaneItemType.TAG) {
                            const tag = item.data as TagTreeNode;
                            const isExpanded = expansionState.expandedTags.has(tag.path);
                            if (isExpanded) {
                                // Collapse the tag
                                handleExpandCollapse(item, false);
                            } else {
                                // Navigate to parent tag
                                const lastSlashIndex = tag.path.lastIndexOf('/');
                                if (lastSlashIndex > 0) {
                                    const parentPath = tag.path.substring(0, lastSlashIndex);
                                    const parentIndex = pathToIndex.get(parentPath) ?? -1;
                                    if (parentIndex >= 0) {
                                        const parentItem = safeGetItem(items, parentIndex);
                                        if (parentItem) {
                                            selectItemAtIndex(parentItem);
                                            // Scrolling now handled by virtualizer.scrollToIndex
                                        }
                                    }
                                }
                            }
                        }
                    }
                    break;

                case 'Tab': {
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Shift+Tab: Move focus backwards (Editor -> Files -> Folders)
                        if (focusedPane === 'files') {
                            if (uiState.singlePane && !isMobile) {
                                // In single-pane mode, switch to navigation view
                                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                            } else if (!uiState.singlePane) {
                                // In dual-pane mode, switch focus to folders pane
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                            }
                        }
                        // Note: There is no logic here to go from Editor -> Files,
                        // as that is outside the scope of this hook. Obsidian handles that.
                    } else {
                        // Tab: Move focus forwards (Folders -> Files -> Editor)
                        if (focusedPane === 'navigation') {
                            if (uiState.singlePane && !isMobile) {
                                // In single-pane mode, switch to files view
                                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            } else {
                                // In dual-pane mode, just switch focus
                                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            }
                        } else if (focusedPane === 'files' && selectionState.selectedFile) {
                            // This is the logic moved from ArrowRight to focus the editor
                            const leaves = getSupportedLeaves(app);
                            const targetLeaf = leaves.find(leaf => {
                                const view = leaf.view;
                                return view instanceof FileView && view.file?.path === selectionState.selectedFile?.path;
                            });
                            if (targetLeaf) {
                                app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                            }
                        }
                    }
                    break;
                }

                case 'Delete':
                case 'Backspace':
                    if (focusedPane === 'files' && (selectionState.selectedFile || selectionState.selectedFiles.size > 0)) {
                        e.preventDefault();
                        // Use shared delete function
                        deleteSelectedFiles({
                            app,
                            fileSystemOps,
                            settings,
                            selectionState,
                            selectionDispatch,
                            tagTreeService
                        });
                    } else if (
                        focusedPane === 'navigation' &&
                        selectionState.selectionType === ItemType.FOLDER &&
                        selectionState.selectedFolder
                    ) {
                        e.preventDefault();
                        // Use shared delete function
                        deleteSelectedFolder({
                            app,
                            fileSystemOps,
                            settings,
                            selectionState,
                            selectionDispatch
                        });
                    }
                    break;

                case 'a':
                case 'A':
                    // Cmd+A (Mac) or Ctrl+A (Windows/Linux) for Select All
                    if ((e.metaKey || e.ctrlKey) && focusedPane === 'files') {
                        e.preventDefault();

                        // Get all files in the current view
                        const allFiles = items
                            .filter(item => item.type === ListPaneItemType.FILE)
                            .map(item => {
                                const fileItem = item as ListPaneItem;
                                return fileItem.data instanceof TFile ? fileItem.data : null;
                            })
                            .filter((file): file is TFile => file !== null);

                        multiSelection.selectAll(allFiles);
                    }
                    break;

                case 'Home':
                    e.preventDefault();
                    if (e.shiftKey && focusedPane === 'files' && !isMobile && selectionState.selectedFile?.path) {
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            handleRangeSelection('home', currentFileIndex);
                        }
                        return;
                    }
                    // Find the first selectable item
                    targetIndex = findNextSelectableIndex(items, -1, focusedPane);
                    break;

                case 'End':
                    e.preventDefault();
                    if (e.shiftKey && focusedPane === 'files' && !isMobile && selectionState.selectedFile?.path) {
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            handleRangeSelection('end', currentFileIndex);
                        }
                        return;
                    }
                    // Find the last selectable item
                    for (let i = items.length - 1; i >= 0; i--) {
                        const item = safeGetItem(items, i);
                        if (item && isSelectableItem(item, focusedPane)) {
                            targetIndex = i;
                            break;
                        }
                    }
                    break;
            }

            // Scroll to and select new item
            if (targetIndex >= 0 && targetIndex < items.length) {
                const item = safeGetItem(items, targetIndex);
                if (item) {
                    selectItemAtIndex(item);
                }

                // Scroll directly using virtualizer
                virtualizer.scrollToIndex(targetIndex, {
                    align: 'auto',
                    behavior: 'auto'
                });
            }
        },
        [
            items,
            virtualizer,
            focusedPane,
            selectionState,
            expansionState,
            selectionDispatch,
            uiState,
            uiDispatch,
            app,
            isMobile,
            settings,
            fileSystemOps,
            multiSelection,
            containerRef,
            selectItemAtIndex,
            handleExpandCollapse,
            tagTreeService,
            pathToIndex,
            files,
            fileIndexMap,
            handleRangeSelection
        ]
    );

    // Add event listener to the navigator container
    useEffect(() => {
        // Attach keyboard listener to the navigator root container
        // This ensures:
        // - Events are naturally scoped to the navigator
        // - No interference with other Obsidian views
        // - Navigation works between panes within the navigator
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('keydown', handleKeyDown);
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown, containerRef]);
}
