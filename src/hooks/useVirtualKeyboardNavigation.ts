import { useCallback, useEffect, useRef } from 'react';
import { TFile, TFolder } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useAppContext } from '../context/AppContext';
import { CombinedLeftPaneItem, FileListItem } from '../types/virtualization';
import { TagTreeNode } from '../utils/tagUtils';
import { isTypingInInput } from '../utils/domUtils';

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
    const { app, appState, dispatch, plugin, isMobile } = useAppContext();
    const lastKeyPressTime = useRef(0);
    
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Skip if typing in input
        if (isTypingInInput(e)) return;
        
        // Check if the navigator exists and which pane is focused
        const navigatorContainer = document.querySelector('[data-focus-pane]');
        if (!navigatorContainer) return;
        
        // Check if this is the correct pane
        const currentFocusedPane = navigatorContainer.getAttribute('data-focus-pane');
        if (currentFocusedPane !== focusedPane) return;
        
        // Debounce rapid key presses
        const now = Date.now();
        if (now - lastKeyPressTime.current < 30) {
            return;
        }
        lastKeyPressTime.current = now;
        
        let currentIndex = -1;
        let targetIndex = -1;
        
        // Find current selection index
        if (focusedPane === 'files') {
            currentIndex = items.findIndex(item => {
                if ('type' in item && item.type === 'file') {
                    const fileItem = item as FileListItem;
                    return (fileItem.data as TFile).path === appState.selectedFile?.path;
                }
                return false;
            });
        } else {
            currentIndex = items.findIndex(item => {
                if ('type' in item) {
                    const leftPaneItem = item as CombinedLeftPaneItem;
                    if (leftPaneItem.type === 'folder' && appState.selectionType === 'folder') {
                        return leftPaneItem.data.path === appState.selectedFolder?.path;
                    } else if ((leftPaneItem.type === 'tag' || leftPaneItem.type === 'untagged') && 
                               appState.selectionType === 'tag') {
                        const tagNode = leftPaneItem.data as TagTreeNode;
                        return tagNode.path === appState.selectedTag;
                    }
                }
                return false;
            });
        }
        
        switch (e.key) {
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
                
            case 'ArrowRight':
                e.preventDefault();
                if (focusedPane === 'folders') {
                    if (currentIndex >= 0) {
                        const item = items[currentIndex] as CombinedLeftPaneItem;
                        let shouldSwitchPane = true;
                        
                        // Check if we should expand instead of switching panes
                        if (item.type === 'folder') {
                            const folder = item.data;
                            const isExpanded = appState.expandedFolders.has(folder.path);
                            if (!isExpanded && folder.children.length > 0) {
                                handleExpandCollapse(item, true);
                                shouldSwitchPane = false;
                            }
                        } else if (item.type === 'tag') {
                            const tag = item.data as TagTreeNode;
                            const isExpanded = appState.expandedTags.has(tag.path);
                            if (!isExpanded && tag.children.size > 0) {
                                handleExpandCollapse(item, true);
                                shouldSwitchPane = false;
                            }
                        }
                        
                        if (shouldSwitchPane) {
                            dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        }
                    } else {
                        // No selection, just switch pane
                        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    }
                } else if (focusedPane === 'files' && appState.selectedFile) {
                    // Move focus to edit view showing the selected file
                    const leaves = app.workspace.getLeavesOfType('markdown')
                        .concat(app.workspace.getLeavesOfType('canvas'))
                        .concat(app.workspace.getLeavesOfType('pdf'));
                    
                    // Find leaf showing our file
                    const targetLeaf = leaves.find(leaf => (leaf.view as any).file?.path === appState.selectedFile?.path);
                    if (targetLeaf) {
                        app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                    }
                }
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                if (focusedPane === 'files') {
                    dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                } else if (focusedPane === 'folders' && currentIndex >= 0) {
                    const item = items[currentIndex] as CombinedLeftPaneItem;
                    
                    if (item.type === 'folder') {
                        const folder = item.data;
                        const isExpanded = appState.expandedFolders.has(folder.path);
                        if (isExpanded) {
                            // Collapse the folder
                            handleExpandCollapse(item, false);
                        } else if (folder.parent && (!plugin.settings.showRootFolder || folder.path !== '/')) {
                            // Navigate to parent folder
                            const parentIndex = items.findIndex(i => 
                                i.type === 'folder' && i.data.path === folder.parent!.path
                            );
                            if (parentIndex >= 0) {
                                selectItemAtIndex(items[parentIndex]);
                                virtualizer.scrollToIndex(parentIndex, {
                                    align: 'center',
                                    behavior: 'auto'
                                });
                            }
                        }
                    } else if (item.type === 'tag') {
                        const tag = item.data as TagTreeNode;
                        const isExpanded = appState.expandedTags.has(tag.path);
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
                                    selectItemAtIndex(items[parentIndex]);
                                    virtualizer.scrollToIndex(parentIndex, {
                                        align: 'center',
                                        behavior: 'smooth'
                                    });
                                }
                            }
                        }
                    }
                }
                break;
                
            case 'Tab':
                e.preventDefault();
                // Switch focus between panes
                dispatch({ 
                    type: 'SET_FOCUSED_PANE', 
                    pane: focusedPane === 'folders' ? 'files' : 'folders' 
                });
                break;
                
            case 'Enter':
                if (currentIndex >= 0) {
                    e.preventDefault();
                    handleEnter(items[currentIndex]);
                }
                break;
                
            case 'Delete':
            case 'Backspace':
                if (!isTypingInInput(e) && appState.selectedFile) {
                    e.preventDefault();
                    handleDelete();
                }
                break;
        }
        
        // Scroll to and select new item
        if (targetIndex >= 0 && targetIndex < items.length) {
            selectItemAtIndex(items[targetIndex]);
            virtualizer.scrollToIndex(targetIndex, {
                align: 'center',
                behavior: 'auto'
            });
        }
    }, [items, virtualizer, focusedPane, appState, dispatch, plugin, app, isMobile]);
    
    // Helper function to find next selectable item
    const findNextSelectableIndex = (items: VirtualItem[], currentIndex: number, pane: string): number => {
        // If no current selection, find the first selectable item
        if (currentIndex < 0) {
            for (let i = 0; i < items.length; i++) {
                if (isSelectableItem(items[i], pane)) {
                    return i;
                }
            }
            return 0;
        }
        
        for (let i = currentIndex + 1; i < items.length; i++) {
            if (isSelectableItem(items[i], pane)) {
                return i;
            }
        }
        
        return currentIndex; // Stay at current if no next item
    };
    
    // Helper function to find previous selectable item
    const findPreviousSelectableIndex = (items: VirtualItem[], currentIndex: number, pane: string): number => {
        if (currentIndex <= 0) return 0;
        
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (isSelectableItem(items[i], pane)) {
                return i;
            }
        }
        
        return currentIndex; // Stay at current if no previous item
    };
    
    // Check if item is selectable (not a header)
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
    
    // Select item at given index
    const selectItemAtIndex = (item: VirtualItem) => {
        if (!item || !('type' in item)) return;
        
        if (focusedPane === 'files') {
            const fileItem = item as FileListItem;
            if (fileItem.type === 'file') {
                const file = fileItem.data as TFile;
                dispatch({ type: 'SET_SELECTED_FILE', file });
                
                // Open the file in the editor but keep focus in file list
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    leaf.openFile(file, { active: false });
                }
            }
        } else {
            const leftPaneItem = item as CombinedLeftPaneItem;
            if (leftPaneItem.type === 'folder') {
                dispatch({ type: 'SET_SELECTED_FOLDER', folder: leftPaneItem.data });
            } else if (leftPaneItem.type === 'tag' || leftPaneItem.type === 'untagged') {
                const tagNode = leftPaneItem.data as TagTreeNode;
                dispatch({ type: 'SET_SELECTED_TAG', tag: tagNode.path });
            }
        }
    };
    
    // Handle expand/collapse for folders and tags
    const handleExpandCollapse = (item: VirtualItem, expand: boolean) => {
        if (!item || !('type' in item)) return;
        
        const leftPaneItem = item as CombinedLeftPaneItem;
        if (leftPaneItem.type === 'folder') {
            const folder = leftPaneItem.data;
            const isExpanded = appState.expandedFolders.has(folder.path);
            if (expand && !isExpanded && folder.children.length > 0) {
                dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
            } else if (!expand && isExpanded) {
                dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
            }
        } else if (leftPaneItem.type === 'tag') {
            const tag = leftPaneItem.data as TagTreeNode;
            const isExpanded = appState.expandedTags.has(tag.path);
            if (expand && !isExpanded && tag.children.size > 0) {
                dispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
            } else if (!expand && isExpanded) {
                dispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
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
        if (!appState.selectedFile) return;
        
        const fileSystemOps = plugin.app.vault;
        const metadataService = plugin.metadataService;
        
        // Always confirm deletion
        const shouldDelete = await new Promise<boolean>((resolve) => {
            const modal = new (plugin.app as any).ConfirmModal(
                plugin.app,
                `Delete "${appState.selectedFile!.name}"?`,
                'This action cannot be undone.',
                'Delete',
                'Cancel',
                resolve
            );
            modal.open();
        });
        
        if (!shouldDelete) return;
        
        // Delete the file
        await fileSystemOps.delete(appState.selectedFile);
        
        // Clean up metadata
        metadataService.handleFileDelete(appState.selectedFile.path);
    };
    
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}