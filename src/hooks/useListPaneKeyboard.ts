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

/**
 * useListPaneKeyboard - Keyboard navigation for the list pane
 *
 * This hook handles list-specific keyboard interactions:
 * - File selection and navigation
 * - Multi-selection support (Shift+arrows, Cmd/Ctrl+A)
 * - Range selection (Shift+Home/End)
 * - File opening and deletion
 * - Tab/arrow navigation to editor or back to navigation pane
 * - Page navigation
 */

import { useCallback } from 'react';
import { TFile, FileView } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { getSupportedLeaves, ListPaneItemType } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { deleteSelectedFiles } from '../utils/deleteOperations';
import { getFilesInRange } from '../utils/selectionUtils';
import { useKeyboardNavigation, KeyboardNavigationHelpers } from './useKeyboardNavigation';
import { useMultiSelection } from './useMultiSelection';

/**
 * Check if a list item is selectable (file, not header or spacer)
 */
const isSelectableListItem = (item: ListPaneItem): boolean => {
    return item.type === ListPaneItemType.FILE;
};

interface UseListPaneKeyboardProps {
    /** List items to navigate through */
    items: ListPaneItem[];
    /** Virtualizer instance for scroll management */
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Container element for event attachment */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Map from file paths to their index in items */
    pathToIndex: Map<string, number>;
    /** Array of files for multi-selection optimization */
    files: TFile[];
    /** Map from file paths to their position in files array */
    fileIndexMap: Map<string, number>;
}

/**
 * Hook for keyboard navigation in the list pane.
 * Handles file-specific keyboard interactions and multi-selection.
 */
export function useListPaneKeyboard({ items, virtualizer, containerRef, pathToIndex, files, fileIndexMap }: UseListPaneKeyboardProps) {
    const { app, isMobile, tagTreeService } = useServices();
    const fileSystemOps = useFileSystemOps();
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const multiSelection = useMultiSelection();

    /**
     * Get current selection index
     */
    const getCurrentIndex = useCallback(() => {
        if (selectionState.selectedFile?.path) {
            return pathToIndex.get(selectionState.selectedFile.path) ?? -1;
        }
        return -1;
    }, [selectionState.selectedFile, pathToIndex]);

    /**
     * Select item at given index
     */
    const selectItemAtIndex = useCallback(
        (item: ListPaneItem) => {
            if (item.type === ListPaneItemType.FILE) {
                const file = item.data instanceof TFile ? item.data : null;
                if (!file) return;

                // Normal navigation clears multi-selection
                selectionDispatch({ type: 'SET_SELECTED_FILE', file });

                // Open the file in the editor but keep focus in file list
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    leaf.openFile(file, { active: false });
                }
            }
        },
        [selectionDispatch, app.workspace]
    );

    /**
     * Handle range selection with Home/End
     */
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
            virtualizer.scrollToIndex(targetIndex, { align: 'auto' });
        },
        [files, selectionState.selectedFiles, selectionDispatch, app.workspace, virtualizer]
    );

    /**
     * List pane-specific keyboard handler
     */
    const handleKeyDown = useCallback(
        (e: KeyboardEvent, helpers: KeyboardNavigationHelpers<ListPaneItem>) => {
            const currentIndex = getCurrentIndex();
            let targetIndex = -1;

            // Swap left/right arrow behavior for RTL layouts
            let effectiveKey = e.key;
            if (helpers.isRTL()) {
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
                    if (e.shiftKey && !isMobile && selectionState.selectedFile?.path) {
                        // Multi-selection with Shift+Down
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            const finalFileIndex = multiSelection.handleShiftArrowSelection('down', currentFileIndex, files);
                            if (finalFileIndex >= 0) {
                                // Convert file index to items index and scroll
                                const finalFile = files[finalFileIndex];
                                const itemIndex = pathToIndex.get(finalFile.path);
                                if (itemIndex !== undefined) {
                                    helpers.scrollToIndex(itemIndex);
                                }
                            }
                        }
                        return; // Don't process normal navigation
                    }

                    targetIndex = helpers.findNextIndex(currentIndex);

                    // Don't clear selection if we're at the bottom boundary
                    if (targetIndex === currentIndex && currentIndex >= 0) {
                        return; // Do nothing, stay at current position with selection intact
                    }
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    if (e.shiftKey && !isMobile && currentIndex !== -1 && selectionState.selectedFile?.path) {
                        // Multi-selection with Shift+Up
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            const finalFileIndex = multiSelection.handleShiftArrowSelection('up', currentFileIndex, files);
                            if (finalFileIndex >= 0) {
                                // Convert file index to items index and scroll
                                const finalFile = files[finalFileIndex];
                                const itemIndex = pathToIndex.get(finalFile.path);
                                if (itemIndex !== undefined) {
                                    helpers.scrollToIndex(itemIndex);
                                }
                            }
                        }
                        return; // Don't process normal navigation
                    }

                    // If nothing is selected, select the first item
                    if (currentIndex === -1) {
                        targetIndex = helpers.findNextIndex(-1);
                    } else {
                        targetIndex = helpers.findPreviousIndex(currentIndex);

                        // Don't clear selection if we're at the top boundary
                        if (targetIndex === currentIndex && currentIndex >= 0) {
                            return; // Do nothing, stay at current position with selection intact
                        }
                    }
                    break;

                case 'PageDown': {
                    e.preventDefault();
                    if (currentIndex === -1) break;

                    const pageSize = helpers.getPageSize();
                    const newIndex = Math.min(currentIndex + pageSize, items.length - 1);

                    // Find the next selectable item starting from the new position
                    let newTargetIndex = helpers.findNextIndex(newIndex - 1);

                    // If we didn't move, ensure we go to the very last selectable item
                    if (newTargetIndex === currentIndex && currentIndex !== items.length - 1) {
                        // Find the last selectable item
                        for (let i = items.length - 1; i >= 0; i--) {
                            const item = helpers.getItemAt(i);
                            if (item && isSelectableListItem(item)) {
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
                    if (currentIndex === -1) break;

                    const pageSize = helpers.getPageSize();
                    const newIndex = Math.max(0, currentIndex - pageSize);

                    // Find the previous selectable item starting from the new position
                    let newTargetIndex = helpers.findPreviousIndex(newIndex + 1);

                    // If we didn't move, ensure we go to the very first selectable item
                    if (newTargetIndex === currentIndex && currentIndex !== 0) {
                        newTargetIndex = helpers.findNextIndex(-1);
                    }

                    targetIndex = newTargetIndex;
                    break;
                }

                case 'ArrowRight':
                case 'Tab':
                    if (effectiveKey === 'Tab' && e.shiftKey) {
                        // Shift+Tab: Move focus back to navigation pane
                        e.preventDefault();
                        if (uiState.singlePane && !isMobile) {
                            // In single-pane mode, switch to navigation view
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                        } else if (!uiState.singlePane) {
                            // In dual-pane mode, switch focus to folders pane
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                        }
                    } else if (selectionState.selectedFile) {
                        // Tab or RIGHT arrow: focus the editor
                        e.preventDefault();
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
                    if (uiState.singlePane && !isMobile) {
                        // In single-pane mode, switch to navigation view
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    } else if (!uiState.singlePane) {
                        // In dual-pane mode, switch focus to folders pane
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    }
                    break;

                case 'Delete':
                case 'Backspace':
                    if (selectionState.selectedFile || selectionState.selectedFiles.size > 0) {
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
                    }
                    break;

                case 'a':
                case 'A':
                    // Cmd+A (Mac) or Ctrl+A (Windows/Linux) for Select All
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();

                        // Get all files in the current view
                        const allFiles = items
                            .filter(item => item.type === ListPaneItemType.FILE)
                            .map(item => {
                                const fileItem = item;
                                return fileItem.data instanceof TFile ? fileItem.data : null;
                            })
                            .filter((file): file is TFile => file !== null);

                        multiSelection.selectAll(allFiles);
                    }
                    break;

                case 'Home':
                    e.preventDefault();
                    if (e.shiftKey && !isMobile && selectionState.selectedFile?.path) {
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            handleRangeSelection('home', currentFileIndex);
                        }
                        return;
                    }
                    // Find the first selectable item
                    targetIndex = helpers.findNextIndex(-1);
                    break;

                case 'End':
                    e.preventDefault();
                    if (e.shiftKey && !isMobile && selectionState.selectedFile?.path) {
                        const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                        if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                            handleRangeSelection('end', currentFileIndex);
                        }
                        return;
                    }
                    // Find the last selectable item
                    for (let i = items.length - 1; i >= 0; i--) {
                        const item = helpers.getItemAt(i);
                        if (item && isSelectableListItem(item)) {
                            targetIndex = i;
                            break;
                        }
                    }
                    break;
            }

            // Scroll to and select new item
            if (targetIndex >= 0 && targetIndex < items.length) {
                const item = helpers.getItemAt(targetIndex);
                if (item) {
                    selectItemAtIndex(item);
                    helpers.scrollToIndex(targetIndex);
                }
            }
        },
        [
            getCurrentIndex,
            isMobile,
            selectionState,
            fileIndexMap,
            multiSelection,
            files,
            uiState.singlePane,
            uiDispatch,
            app,
            fileSystemOps,
            settings,
            tagTreeService,
            selectionDispatch,
            selectItemAtIndex,
            handleRangeSelection,
            items,
            pathToIndex
        ]
    );

    // Use the base keyboard navigation hook
    useKeyboardNavigation({
        items,
        virtualizer,
        focusedPane: 'files',
        containerRef,
        isSelectable: isSelectableListItem,
        _getCurrentIndex: getCurrentIndex,
        onKeyDown: handleKeyDown
    });
}
