import { useCallback, useEffect, useRef } from 'react';
import { TFile, TFolder } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { CombinedLeftPaneItem, FileListItem } from '../types/virtualization';
import { TagTreeNode } from '../utils/tagUtils';
import { isTypingInInput } from '../utils/domUtils';
import { isTFolder } from '../utils/typeGuards';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';

type VirtualItem = CombinedLeftPaneItem | FileListItem;

interface UseVirtualKeyboardNavigationProps<T extends VirtualItem> {
    items: T[];
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    focusedPane: 'folders' | 'files';
    containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Custom hook for keyboard navigation in virtualized lists.
 * Works with flattened data arrays instead of DOM queries.
 */
export function useVirtualKeyboardNavigation<T extends VirtualItem>({
    items,
    virtualizer,
    focusedPane,
    containerRef
}: UseVirtualKeyboardNavigationProps<T>) {
    const { app, plugin, isMobile } = useServices();
    const fileSystemOps = useFileSystemOps();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const lastKeyPressTime = useRef(0);
    
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
        
        // Check if the navigator exists
        const navigatorContainer = document.querySelector('[data-focus-pane]');
        if (!navigatorContainer) return;
        
        // Use the state directly instead of DOM attribute to avoid timing issues
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
                if ('type' in item && item.type === 'file') {
                    const fileItem = item as FileListItem;
                    return (fileItem.data as TFile).path === selectionState.selectedFile?.path;
                }
                return false;
            });
        } else {
            currentIndex = items.findIndex(item => {
                if ('type' in item) {
                    const leftPaneItem = item as CombinedLeftPaneItem;
                    if (leftPaneItem.type === 'folder' && selectionState.selectionType === 'folder') {
                        return leftPaneItem.data.path === selectionState.selectedFolder?.path;
                    } else if ((leftPaneItem.type === 'tag' || leftPaneItem.type === 'untagged') && 
                               selectionState.selectionType === 'tag') {
                        const tagNode = leftPaneItem.data as TagTreeNode;
                        return tagNode.path === selectionState.selectedTag;
                    }
                }
                return false;
            });
        }
        
        // Swap left/right arrow behavior for RTL layouts
        const effectiveKey = isRTL ? (
            e.key === 'ArrowLeft' ? 'ArrowRight' : 
            e.key === 'ArrowRight' ? 'ArrowLeft' : 
            e.key
        ) : e.key;
        
        switch (effectiveKey) {
            case 'ArrowDown':
                e.preventDefault();
                targetIndex = findNextSelectableIndex(items, currentIndex, focusedPane);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                // If nothing is selected, select the first item
                if (currentIndex === -1) {
                    targetIndex = findNextSelectableIndex(items, -1, focusedPane);
                } else {
                    targetIndex = findPreviousSelectableIndex(items, currentIndex, focusedPane);
                }
                break;
                
            case 'PageDown': {
                e.preventDefault();
                // This is the fix: Use the new geometry-based page size calculation.
                const pageSize = getVisiblePageSize(virtualizer);

                // If nothing is selected, start from the first item.
                const startIndex = currentIndex === -1 ? 0 : currentIndex;

                const newIndex = Math.min(startIndex + pageSize, items.length - 1);
                
                // Find the next selectable item at or after our jump point.
                targetIndex = findNextSelectableIndex(items, newIndex - 1, focusedPane);
                break;
            }

            case 'PageUp': {
                e.preventDefault();
                const pageSize = getVisiblePageSize(virtualizer);

                if (currentIndex === -1) break; // Do nothing if at top with no selection.

                const newIndex = Math.max(0, currentIndex - pageSize);
                
                // Find the previous selectable item at or before our jump point.
                targetIndex = findPreviousSelectableIndex(items, newIndex + 1, focusedPane);
                break;
            }
                
            case 'ArrowRight':
                e.preventDefault();
                if (focusedPane === 'folders') {
                    if (currentIndex >= 0) {
                        const item = safeGetItem(items, currentIndex) as CombinedLeftPaneItem | undefined;
                        if (!item) {
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            return;
                        }
                        
                        // Check if we should expand instead of switching panes
                        if (item.type === 'folder') {
                            const folder = item.data;
                            const isExpanded = expansionState.expandedFolders.has(folder.path);
                            const hasChildren = folder.children.some(child => isTFolder(child));
                            
                            // Only expand if: has children AND not already expanded
                            if (hasChildren && !isExpanded) {
                                handleExpandCollapse(item, true);
                                return; // Don't switch panes
                            }
                        } else if (item.type === 'tag') {
                            const tag = item.data as TagTreeNode;
                            const isExpanded = expansionState.expandedTags.has(tag.path);
                            const hasChildren = tag.children.size > 0;
                            
                            // Only expand if: has children AND not already expanded
                            if (hasChildren && !isExpanded) {
                                handleExpandCollapse(item, true);
                                return; // Don't switch panes
                            }
                        }
                        
                        // If we get here, either no children or already expanded, so switch to files pane
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        return; // Stop execution here to prevent race condition
                    } else {
                        // No selection, just switch pane
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        return; // Stop execution here to prevent race condition
                    }
                } else if (focusedPane === 'files' && selectionState.selectedFile) {
                    // Move focus to edit view showing the selected file
                    const leaves = app.workspace.getLeavesOfType('markdown')
                        .concat(app.workspace.getLeavesOfType('canvas'))
                        .concat(app.workspace.getLeavesOfType('pdf'));
                    
                    // Find leaf showing our file
                    const targetLeaf = leaves.find(leaf => (leaf.view as any).file?.path === selectionState.selectedFile?.path);
                    if (targetLeaf) {
                        app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                    }
                }
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                if (focusedPane === 'files') {
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                } else if (focusedPane === 'folders' && currentIndex >= 0) {
                    const item = safeGetItem(items, currentIndex) as CombinedLeftPaneItem | undefined;
                    if (!item) return;
                    
                    if (item.type === 'folder') {
                        const folder = item.data;
                        const isExpanded = expansionState.expandedFolders.has(folder.path);
                        if (isExpanded) {
                            // Collapse the folder
                            handleExpandCollapse(item, false);
                        } else if (folder.parent && (!plugin.settings.showRootFolder || folder.path !== '/')) {
                            // Navigate to parent folder
                            const parentIndex = items.findIndex(i => {
                                if (i.type === 'folder' && i.data && typeof i.data === 'object') {
                                    const folderData = i.data as TFolder;
                                    return folderData.path === folder.parent!.path;
                                }
                                return false;
                            });
                            if (parentIndex >= 0) {
                                const parentItem = safeGetItem(items, parentIndex);
                                if (parentItem) {
                                    selectItemAtIndex(parentItem);
                                    uiDispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: parentIndex });
                                }
                            }
                        }
                    } else if (item.type === 'tag') {
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
                                    i.type === 'tag' && (i.data as TagTreeNode).path === parentPath
                                );
                                if (parentIndex >= 0) {
                                    const parentItem = safeGetItem(items, parentIndex);
                                    if (parentItem) {
                                        selectItemAtIndex(parentItem);
                                        uiDispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: parentIndex });
                                    }
                                }
                            }
                        }
                    }
                }
                break;
                
            case 'Tab':
                e.preventDefault();
                // Switch focus between panes
                uiDispatch({ 
                    type: 'SET_FOCUSED_PANE', 
                    pane: focusedPane === 'folders' ? 'files' : 'folders' 
                });
                break;
                
            case 'Enter':
                if (currentIndex >= 0) {
                    e.preventDefault();
                    const item = safeGetItem(items, currentIndex);
                    if (item) {
                        handleEnter(item);
                    }
                }
                break;
                
            case 'Delete':
            case 'Backspace':
                if (!isTypingInInput(e) && selectionState.selectedFile) {
                    e.preventDefault();
                    handleDelete();
                }
                break;
        }
        
        // Scroll to and select new item
        if (targetIndex >= 0 && targetIndex < items.length) {
            const item = safeGetItem(items, targetIndex);
            if (item) {
                selectItemAtIndex(item);
            }
            
            // Dispatch state-driven scroll action
            if (focusedPane === 'folders') {
                uiDispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: targetIndex });
            } else {
                uiDispatch({ type: 'SCROLL_TO_FILE_INDEX', index: targetIndex });
            }
        }
    }, [items, virtualizer, focusedPane, selectionState, expansionState, selectionDispatch, expansionDispatch, uiDispatch, plugin, app, isMobile]);
    
    // Helper function to find next selectable item
    const findNextSelectableIndex = (items: VirtualItem[], currentIndex: number, pane: string): number => {
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
        
        for (let i = currentIndex + 1; i < items.length; i++) {
            const item = safeGetItem(items, i);
            if (item && isSelectableItem(item, pane)) {
                return i;
            }
        }
        
        return currentIndex; // Stay at current if no next item
    };
    
    // Helper function to find previous selectable item
    const findPreviousSelectableIndex = (items: VirtualItem[], currentIndex: number, pane: string): number => {
        // If no items or invalid index, return -1
        if (items.length === 0 || currentIndex < 0) return -1;
        
        for (let i = currentIndex - 1; i >= 0; i--) {
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
            return fileItem.type === 'file';
        } else {
            const leftPaneItem = item as CombinedLeftPaneItem;
            return leftPaneItem.type === 'folder' || 
                   leftPaneItem.type === 'tag' || 
                   leftPaneItem.type === 'untagged';
        }
    };
    
    /**
     * Calculates the number of items that fit in the viewport based on geometry.
     * This is the only reliable way to get a consistent page size.
     * @param virtualizer The virtualizer instance.
     * @returns The number of items to jump for a page up/down action.
     */
    const getVisiblePageSize = (virtualizer: Virtualizer<any, any>): number => {
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
            if (fileItem.type === 'file') {
                const file = fileItem.data as TFile;
                selectionDispatch({ type: 'SET_SELECTED_FILE', file });
                
                // Open the file in the editor but keep focus in file list
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    leaf.openFile(file, { active: false });
                }
            }
        } else {
            const leftPaneItem = item as CombinedLeftPaneItem;
            if (leftPaneItem.type === 'folder') {
                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: leftPaneItem.data });
            } else if (leftPaneItem.type === 'tag' || leftPaneItem.type === 'untagged') {
                const tagNode = leftPaneItem.data as TagTreeNode;
                selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagNode.path });
            }
        }
    };
    
    // Handle expand/collapse for folders and tags
    const handleExpandCollapse = (item: VirtualItem, expand: boolean) => {
        if (!item || !('type' in item)) return;
        
        const leftPaneItem = item as CombinedLeftPaneItem;
        if (leftPaneItem.type === 'folder') {
            const folder = leftPaneItem.data;
            const isExpanded = expansionState.expandedFolders.has(folder.path);
            if (expand && !isExpanded && folder.children.length > 0) {
                expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
            } else if (!expand && isExpanded) {
                expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
            }
        } else if (leftPaneItem.type === 'tag') {
            const tag = leftPaneItem.data as TagTreeNode;
            const isExpanded = expansionState.expandedTags.has(tag.path);
            if (expand && !isExpanded && tag.children.size > 0) {
                expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
            } else if (!expand && isExpanded) {
                expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
            }
        }
    };
    
    // Handle Enter key
    const handleEnter = (item: VirtualItem) => {
        if (!item || !('type' in item)) return;
        
        if (focusedPane === 'files') {
            const fileItem = item as FileListItem;
            if (fileItem.type === 'file') {
                const file = fileItem.data as TFile;
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    leaf.openFile(file);
                }
                
                // Collapse left sidebar on mobile
                if (isMobile && app.workspace.leftSplit) {
                    app.workspace.leftSplit.collapse();
                }
            }
        } else {
            // Toggle expand/collapse on Enter for folders/tags
            const leftPaneItem = item as CombinedLeftPaneItem;
            if (leftPaneItem.type === 'folder' || leftPaneItem.type === 'tag') {
                handleExpandCollapse(item, true);
            }
        }
    };
    
    // Handle Delete key
    const handleDelete = async () => {
        if (!selectionState.selectedFile) return;
        
        // Use the centralized file deletion service
        await fileSystemOps.deleteFile(
            selectionState.selectedFile,
            plugin.settings.confirmBeforeDelete
        );
    };
    
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}