import { useCallback, useEffect, useRef } from 'react';
import { TFile, TFolder } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useAppContext } from '../context/AppContext';
import { CombinedLeftPaneItem, FileListItem } from '../types/virtualization';
import { TagTreeNode } from '../utils/tagUtils';
import { isTypingInInput } from '../utils/domUtils';
import { scrollVirtualItemIntoView } from '../utils/virtualUtils';

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
        
        // Check if the navigator exists
        const navigatorContainer = document.querySelector('[data-focus-pane]');
        if (!navigatorContainer) return;
        
        // Use the state directly instead of DOM attribute to avoid timing issues
        if (appState.focusedPane !== focusedPane) return;
        
        // Debounce rapid key presses with a more reasonable threshold
        const now = Date.now();
        if (now - lastKeyPressTime.current < 16) { // ~60fps threshold
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
                        
                        // Check if we should expand instead of switching panes
                        if (item.type === 'folder') {
                            const folder = item.data;
                            const isExpanded = appState.expandedFolders.has(folder.path);
                            const hasChildren = folder.children.length > 0;
                            
                            // Only expand if: has children AND not already expanded
                            if (hasChildren && !isExpanded) {
                                handleExpandCollapse(item, true);
                                return; // Don't switch panes
                            }
                        } else if (item.type === 'tag') {
                            const tag = item.data as TagTreeNode;
                            const isExpanded = appState.expandedTags.has(tag.path);
                            const hasChildren = tag.children.size > 0;
                            
                            // Only expand if: has children AND not already expanded
                            if (hasChildren && !isExpanded) {
                                handleExpandCollapse(item, true);
                                return; // Don't switch panes
                            }
                        }
                        
                        // If we get here, either no children or already expanded, so switch to files pane
                        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        return; // Stop execution here to prevent race condition
                    } else {
                        // No selection, just switch pane
                        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        return; // Stop execution here to prevent race condition
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
                            const parentIndex = items.findIndex(i => {
                                if (i.type === 'folder' && i.data && typeof i.data === 'object') {
                                    const folderData = i.data as TFolder;
                                    return folderData.path === folder.parent!.path;
                                }
                                return false;
                            });
                            if (parentIndex >= 0) {
                                selectItemAtIndex(items[parentIndex]);
                                scrollVirtualItemIntoView(virtualizer, parentIndex);
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
                                    scrollVirtualItemIntoView(virtualizer, parentIndex);
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
            scrollVirtualItemIntoView(virtualizer, targetIndex);
        }
    }, [items, virtualizer, focusedPane, appState, dispatch, plugin, app, isMobile]);
    
    // Helper function to find next selectable item
    const findNextSelectableIndex = (items: VirtualItem[], currentIndex: number, pane: string): number => {
        // If no items, return -1
        if (items.length === 0) return -1;
        
        // If no current selection, find the first selectable item
        if (currentIndex < 0) {
            for (let i = 0; i < items.length; i++) {
                if (isSelectableItem(items[i], pane)) {
                    return i;
                }
            }
            return -1; // No selectable items found
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
        // If no items or invalid index, return -1
        if (items.length === 0 || currentIndex < 0) return -1;
        
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
        
        // Store file reference in case state changes during async operation
        const fileToDelete = appState.selectedFile;
        
        const shouldDelete = await new Promise<boolean>((resolve) => {
            let modal: any = null;
            let resolved = false;
            
            const safeResolve = (value: boolean) => {
                if (!resolved) {
                    resolved = true;
                    resolve(value);
                }
            };
            
            try {
                // Use Obsidian's confirm dialog pattern
                modal = new (plugin.app as any).Modal(plugin.app);
                modal.titleEl.setText(`Delete "${fileToDelete.name}"?`);
                modal.contentEl.setText('This action cannot be undone.');
                
                modal.contentEl.createDiv({ cls: 'modal-button-container' }, (buttonContainer: HTMLDivElement) => {
                    buttonContainer
                        .createEl('button', { text: 'Cancel' })
                        .addEventListener('click', () => {
                            modal.close();
                            safeResolve(false);
                        });
                        
                    buttonContainer
                        .createEl('button', { 
                            cls: 'mod-warning',
                            text: 'Delete' 
                        })
                        .addEventListener('click', () => {
                            modal.close();
                            safeResolve(true);
                        });
                });
                
                // Handle modal close without button click (e.g., ESC key)
                modal.onClose = () => {
                    safeResolve(false);
                };
                
                modal.open();
            } catch (error) {
                // Ensure modal is closed on error
                if (modal) {
                    try {
                        modal.close();
                    } catch {}
                }
                console.error('Error creating delete confirmation modal:', error);
                safeResolve(false);
            }
        });
        
        if (!shouldDelete) return;
        
        try {
            // Delete the file
            await fileSystemOps.delete(fileToDelete);
            
            // Clean up metadata
            metadataService.handleFileDelete(fileToDelete.path);
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    };
    
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}