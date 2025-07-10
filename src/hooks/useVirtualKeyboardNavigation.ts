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
import { TFile, TFolder } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { CombinedNavigationItem, FileListItem } from '../types/virtualization';
import { TagTreeNode } from '../utils/tagUtils';
import { isTypingInInput } from '../utils/domUtils';
import { isTFolder, isTFile } from '../utils/typeGuards';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { FileView } from '../types/obsidian-extended';
import { getSupportedLeaves, NavigationPaneItemType, FileListItemType, ItemType } from '../types';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { useMultiSelection } from './useMultiSelection';

type VirtualItem = CombinedNavigationItem | FileListItem;

interface UseVirtualKeyboardNavigationProps<T extends VirtualItem> {
    items: T[];
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    focusedPane: 'folders' | 'files';
    containerRef: React.RefObject<HTMLDivElement | null>;
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
    containerRef
}: UseVirtualKeyboardNavigationProps<T>) {
    const { app, plugin, isMobile } = useServices();
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
    
    
    // Helper function for safe array access
    const safeGetItem = <T,>(array: T[], index: number): T | undefined => {
        return index >= 0 && index < array.length ? array[index] : undefined;
    };
    
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Skip if typing in input
        if (isTypingInInput(e)) return;
        
        // Skip if the focused element is inside a modal
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.closest('.modal-container')) {
            return;
        }
        
        // Use the state directly to check if this pane should handle the event
        if (uiState.focusedPane !== focusedPane) return;
        
        // Debounce rapid key presses with a more reasonable threshold
        const now = Date.now();
        if (now - lastKeyPressTime.current < 16) { // ~60fps threshold
            return;
        }
        lastKeyPressTime.current = now;
        
        // Check if RTL mode is active
        const isRTL = document.body.classList.contains('mod-rtl');
        
        let currentIndex = -1;
        let targetIndex = -1;
        
        // Find current selection index
        if (focusedPane === 'files') {
            currentIndex = items.findIndex(item => {
                if ('type' in item && item.type === FileListItemType.FILE) {
                    const fileItem = item as FileListItem;
                    return isTFile(fileItem.data) && fileItem.data.path === selectionState.selectedFile?.path;
                }
                return false;
            });
        } else {
            currentIndex = items.findIndex(item => {
                if ('type' in item) {
                    const navigationPaneItem = item as CombinedNavigationItem;
                    if (navigationPaneItem.type === NavigationPaneItemType.FOLDER && selectionState.selectionType === ItemType.FOLDER) {
                        return navigationPaneItem.data.path === selectionState.selectedFolder?.path;
                    } else if ((navigationPaneItem.type === NavigationPaneItemType.TAG || navigationPaneItem.type === NavigationPaneItemType.UNTAGGED) && 
                               selectionState.selectionType === ItemType.TAG) {
                        const tagNode = navigationPaneItem.data as TagTreeNode;
                        return tagNode.path === selectionState.selectedTag;
                    }
                }
                return false;
            });
        }
        
        // Swap left/right arrow behavior for RTL layouts
        let effectiveKey = e.key;
        if (isRTL) {
            switch(e.key) {
                case 'ArrowLeft': effectiveKey = 'ArrowRight'; break;
                case 'ArrowRight': effectiveKey = 'ArrowLeft'; break;
            }
        }
        
        switch (effectiveKey) {
            case 'ArrowDown':
                e.preventDefault();
                if (e.shiftKey && focusedPane === 'files' && !isMobile) {
                    // Multi-selection with Shift+Down
                    // Extract only file items from the items array
                    const fileItems = items
                        .filter(item => item.type === FileListItemType.FILE)
                        .map(item => {
                        const fileItem = item as FileListItem;
                        return isTFile(fileItem.data) ? fileItem.data : null;
                    })
                    .filter((file): file is TFile => file !== null);
                    
                    const currentFileIndex = fileItems.findIndex(f => 
                        f.path === selectionState.selectedFile?.path
                    );
                    
                    if (currentFileIndex !== -1) {
                        multiSelection.handleShiftArrowSelection('down', currentFileIndex, fileItems);
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
                if (e.shiftKey && focusedPane === 'files' && !isMobile && currentIndex !== -1) {
                    // Multi-selection with Shift+Up
                    // Extract only file items from the items array
                    const fileItems = items
                        .filter(item => item.type === FileListItemType.FILE)
                        .map(item => {
                        const fileItem = item as FileListItem;
                        return isTFile(fileItem.data) ? fileItem.data : null;
                    })
                    .filter((file): file is TFile => file !== null);
                    
                    const currentFileIndex = fileItems.findIndex(f => 
                        f.path === selectionState.selectedFile?.path
                    );
                    
                    if (currentFileIndex !== -1) {
                        multiSelection.handleShiftArrowSelection('up', currentFileIndex, fileItems);
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
                if (focusedPane === 'folders' && currentIndex >= 0) {
                    const item = safeGetItem(items, currentIndex) as CombinedNavigationItem | undefined;
                    if (!item) break;

                    let shouldSwitchPane = false;
                    if (item.type === NavigationPaneItemType.FOLDER) {
                        const folder = item.data;
                        const isExpanded = expansionState.expandedFolders.has(folder.path);
                        const hasChildren = folder.children.some((child) => isTFolder(child));
                        
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
                    const targetLeaf = leaves.find(leaf => (leaf.view as FileView).file?.path === selectionState.selectedFile?.path);
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
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'list' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                    } else if (!uiState.navigationPaneCollapsed) {
                        // In dual-pane mode, switch focus to folders pane
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                    }
                } else if (focusedPane === 'folders' && currentIndex >= 0) {
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
                            const parentIndex = items.findIndex(i => {
                                if (i.type === NavigationPaneItemType.FOLDER && i.data && typeof i.data === 'object') {
                                    const folderData = isTFolder(i.data) ? i.data : null;
                if (!folderData) return;
                                    return folderData.path === folder.parent!.path;
                                }
                                return false;
                            });
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
                                const parentIndex = items.findIndex(i => 
                                    i.type === NavigationPaneItemType.TAG && (i.data as TagTreeNode).path === parentPath
                                );
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
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'list' });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                        } else if (!uiState.navigationPaneCollapsed) {
                            // In dual-pane mode, switch focus to folders pane
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                        }
                    }
                    // Note: There is no logic here to go from Editor -> Files,
                    // as that is outside the scope of this hook. Obsidian handles that.
                } else {
                    // Tab: Move focus forwards (Folders -> Files -> Editor)
                    if (focusedPane === 'folders') {
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
                        const targetLeaf = leaves.find(leaf => (leaf.view as FileView).file?.path === selectionState.selectedFile?.path);
                        if (targetLeaf) {
                            app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                        }
                    }
                }
                break;
            }
                
            case 'Delete':
            case 'Backspace':
                if (!isTypingInInput(e)) {
                    if (focusedPane === 'files' && (selectionState.selectedFile || selectionState.selectedFiles.size > 0)) {
                        e.preventDefault();
                        handleDelete();
                    } else if (focusedPane === 'folders' && selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                        e.preventDefault();
                        handleDeleteFolder();
                    }
                }
                break;
                
            case 'a':
            case 'A':
                // Cmd+A (Mac) or Ctrl+A (Windows/Linux) for Select All
                if ((e.metaKey || e.ctrlKey) && focusedPane === 'files') {
                    e.preventDefault();
                    
                    // Get all files in the current view
                    const allFiles = items
                        .filter(item => item.type === FileListItemType.FILE)
                        .map(item => {
                        const fileItem = item as FileListItem;
                        return isTFile(fileItem.data) ? fileItem.data : null;
                    })
                    .filter((file): file is TFile => file !== null);
                    
                    multiSelection.selectAll(allFiles);
                }
                break;
                
            case 'Home':
                e.preventDefault();
                // Find the first selectable item
                targetIndex = findNextSelectableIndex(items, -1, focusedPane);
                break;
                
            case 'End':
                e.preventDefault();
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
    }, [items, virtualizer, focusedPane, selectionState, expansionState, selectionDispatch, expansionDispatch, uiState, uiDispatch, plugin, app, isMobile, settings, fileSystemOps, multiSelection]);
    
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
    
    // Check if item is selectable (not a header or spacer)
    const isSelectableItem = (item: VirtualItem, pane: string): boolean => {
        if (!item || !('type' in item)) return false;
        
        if (pane === 'files') {
            const fileItem = item as FileListItem;
            return fileItem.type === FileListItemType.FILE;
        } else {
            const navigationPaneItem = item as CombinedNavigationItem;
            return navigationPaneItem.type === NavigationPaneItemType.FOLDER || 
                   navigationPaneItem.type === NavigationPaneItemType.TAG || 
                   navigationPaneItem.type === NavigationPaneItemType.UNTAGGED;
        }
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
        const totalMeasuredHeight = (lastItem.start + lastItem.size) - firstItem.start;
        
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
    
    // Select item at given index
    const selectItemAtIndex = (item: VirtualItem) => {
        if (!item || !('type' in item)) return;
        
        if (focusedPane === 'files') {
            const fileItem = item as FileListItem;
            if (fileItem.type === FileListItemType.FILE) {
                const file = isTFile(fileItem.data) ? fileItem.data : null;
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
                if (settings.autoExpandFoldersTags && folder.children.some(child => isTFolder(child))) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedFolders.has(folder.path)) {
                        expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                    }
                }
            } else if (navigationPaneItem.type === NavigationPaneItemType.TAG || navigationPaneItem.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = navigationPaneItem.data as TagTreeNode;
                selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagNode.path });
                
                // Auto-expand if enabled and tag has children
                if (settings.autoExpandFoldersTags && tagNode.children.size > 0) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedTags.has(tagNode.path)) {
                        expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tagNode.path });
                    }
                }
            }
        }
    };
    
    // Handle expand/collapse for folders and tags
    const handleExpandCollapse = (item: VirtualItem, expand: boolean) => {
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
    };
    
    // Handle Delete key for files
    const handleDelete = async () => {
        if (focusedPane !== 'files') return;
        
        // Check if multiple files are selected
        if (selectionState.selectedFiles.size > 1) {
            // Get all files in the current view for smart selection
            let allFiles: TFile[] = [];
            if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                allFiles = getFilesForFolder(selectionState.selectedFolder, settings, app);
            } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                allFiles = getFilesForTag(selectionState.selectedTag, settings, app);
            }
            
            // Use centralized delete method with smart selection
            await fileSystemOps.deleteFilesWithSmartSelection(
                selectionState.selectedFiles,
                allFiles,
                settings,
                {
                    selectionType: selectionState.selectionType,
                    selectedFolder: selectionState.selectedFolder || undefined,
                    selectedTag: selectionState.selectedTag || undefined
                },
                selectionDispatch,
                settings.confirmBeforeDelete
            );
        } else if (selectionState.selectedFile) {
            // Use the centralized delete handler for single file
            await fileSystemOps.deleteSelectedFile(
                selectionState.selectedFile,
                settings,
                {
                    selectionType: selectionState.selectionType,
                    selectedFolder: selectionState.selectedFolder || undefined,
                    selectedTag: selectionState.selectedTag || undefined
                },
                selectionDispatch,
                settings.confirmBeforeDelete
            );
        }
    };
    
    // Handle Delete key for folders
    const handleDeleteFolder = async () => {
        if (!selectionState.selectedFolder || focusedPane !== 'folders') return;
        
        const folderToDelete = selectionState.selectedFolder;
        
        // Don't allow deleting the root folder
        if (folderToDelete.path === '/') {
            return;
        }
        
        // Find the next folder to select before deletion
        let nextFolderToSelect: TFolder | null = null;
        
        // Try to find next sibling folder
        const parentFolder = folderToDelete.parent;
        if (parentFolder && isTFolder(parentFolder)) {
            const siblings = parentFolder.children
                .filter((child): child is TFolder => isTFolder(child))
                .sort((a, b) => a.name.localeCompare(b.name));
            
            const currentIndex = siblings.findIndex(f => f.path === folderToDelete.path);
            
            if (currentIndex !== -1) {
                // Try next sibling
                if (currentIndex < siblings.length - 1) {
                    nextFolderToSelect = siblings[currentIndex + 1];
                } else if (currentIndex > 0) {
                    // No next sibling, try previous
                    nextFolderToSelect = siblings[currentIndex - 1];
                } else {
                    // No siblings, select parent
                    nextFolderToSelect = parentFolder;
                }
            }
        } else {
            // No parent folder (root level folder)
            // Try to find any other root folder
            const rootFolder = app.vault.getRoot();
            const rootFolders = rootFolder.children
                .filter((child): child is TFolder => isTFolder(child) && child.path !== folderToDelete.path)
                .sort((a, b) => a.name.localeCompare(b.name));
            
            if (rootFolders.length > 0) {
                nextFolderToSelect = rootFolders[0];
            }
        }
        
        // Delete the folder
        await fileSystemOps.deleteFolder(
            folderToDelete,
            settings.confirmBeforeDelete,
            () => {
                // After deletion, select the next folder
                if (nextFolderToSelect) {
                    selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: nextFolderToSelect });
                }
            }
        );
    };
    
    // Add global event listener
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
}