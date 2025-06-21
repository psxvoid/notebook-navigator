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

// src/components/NotebookNavigatorComponent.tsx
import React, { useEffect, useImperativeHandle, forwardRef, useRef, useState } from 'react';
import { TFile, TFolder, TAbstractFile, WorkspaceLeaf, debounce, Platform, ItemView } from 'obsidian';
import { NavigationPane } from './NavigationPane';
import { FileList } from './FileList';
import type { NavigationPaneHandle } from './NavigationPane';
import type { FileListHandle } from './FileList';
import { ErrorBoundary } from './ErrorBoundary';
import { useServices } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useResizablePane } from '../hooks/useResizablePane';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { STORAGE_KEYS, PANE_DIMENSIONS, VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT } from '../types';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { flattenFolderTree, findFolderIndex } from '../utils/treeFlattener';
import { parseExcludedFolders } from '../utils/fileFilters';
import { Virtualizer } from '@tanstack/react-virtual';
import { useAutoReveal } from '../hooks/useAutoReveal';

export interface NotebookNavigatorHandle {
    revealFile: (file: TFile) => void;
    focusFilePane: () => void;
    refresh: () => void;
    handleBecomeActive: () => void;
}

/**
 * Main container component for the Notebook Navigator plugin.
 * Provides a two-pane layout with resizable divider, folder tree on the left,
 * and file list on the right. Manages keyboard navigation, drag-and-drop,
 * and auto-reveal functionality for the active file.
 * 
 * @param _ - Props (none used)
 * @param ref - Forwarded ref exposing revealFile and focusFilePane methods
 * @returns A split-pane container with folder tree and file list
 */
export const NotebookNavigatorComponent = forwardRef<NotebookNavigatorHandle>((_, ref) => {
    const { app, plugin, isMobile } = useServices();
    const settings = useSettingsState();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNavigatorFocused, setIsNavigatorFocused] = useState(false);
    const leftPaneRef = useRef<NavigationPaneHandle>(null);
    const fileListRef = useRef<FileListHandle>(null);
    
    

    // Handle scrolling when mobile view changes or on initial mount
    useEffect(() => {
        if (!isMobile) return;
        
        // Scroll to the appropriate item based on current view
        if (uiState.currentMobileView === 'list' && selectionState.selectedFolder) {
            const index = leftPaneRef.current?.getIndexOfPath(selectionState.selectedFolder.path);
            if (index !== undefined && index !== -1) {
                leftPaneRef.current?.virtualizer?.scrollToIndex(index, { align: 'center' });
            }
        } else if (uiState.currentMobileView === 'files' && selectionState.selectedFile) {
            const index = fileListRef.current?.getIndexOfPath(selectionState.selectedFile.path);
            if (index !== undefined && index !== -1) {
                fileListRef.current?.virtualizer?.scrollToIndex(index, { align: 'center' });
            }
        }
    }, [isMobile, uiState.currentMobileView]); // Trigger when mobile view changes
    
    
    // Enable drag and drop only on desktop
    useDragAndDrop(containerRef);
    
    // Enable resizable pane
    const { paneWidth, isResizing, resizeHandleProps } = useResizablePane({
        initialWidth: PANE_DIMENSIONS.defaultWidth,
        min: PANE_DIMENSIONS.minWidth,
        max: PANE_DIMENSIONS.maxWidth,
        storageKey: STORAGE_KEYS.leftPaneWidthKey
    });
    
    // Enable swipe gestures on mobile
    const isRTL = document.body.classList.contains('mod-rtl');
    useSwipeGesture(containerRef, {
        onSwipeRight: () => {
            if (isMobile && uiState.currentMobileView === 'files') {
                // In RTL mode, swipe right goes forward (to files view)
                // In LTR mode, swipe right goes back (to list view)
                if (!isRTL) {
                    uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'list' });
                }
            }
        },
        onSwipeLeft: () => {
            if (isMobile && uiState.currentMobileView === 'files') {
                // In RTL mode, swipe left goes back (to list view)
                if (isRTL) {
                    uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'list' });
                }
            }
        },
        enabled: isMobile
    });
    
    // Get updateSettings from SettingsContext for refresh
    const updateSettings = useSettingsUpdate();
    
    // Define revealFile function that can be used both internally and via ref
    const revealFile = (file: TFile) => {
        if (!file || !file.parent) return;
        
        // Build the folder path hierarchy to expand
        const foldersToExpand: string[] = [];
        let currentFolder: TFolder | null = file.parent;
        while (currentFolder) {
            foldersToExpand.unshift(currentFolder.path);
            if (currentFolder.path === '/') break;
            currentFolder = currentFolder.parent;
        }
        
        // Expand folders if needed
        const needsExpansion = foldersToExpand.some(path => !expansionState.expandedFolders.has(path));
        if (needsExpansion) {
            expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
        }
        
        // Check if we should preserve the current folder selection
        // If showNotesFromSubfoldersEnabled is true and the file is in a subfolder of the current folder,
        // don't change the folder selection
        let preserveFolder = false;
        if (settings.showNotesFromSubfolders && selectionState.selectedFolder && file.parent) {
            // Check if the file's parent is a descendant of the currently selected folder
            let currentParent: TFolder | null = file.parent;
            while (currentParent) {
                if (currentParent.path === selectionState.selectedFolder.path) {
                    preserveFolder = true;
                    break;
                }
                currentParent = currentParent.parent;
            }
        }
        
        // Trigger the reveal - scrolling will happen via the effect that watches isRevealOperation
        selectionDispatch({ type: 'REVEAL_FILE', file, preserveFolder });
        
        // Only change focus if we're not already in the navigator AND not opening version history
        const navigatorEl = document.querySelector('.nn-split-container');
        const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);
        const isOpeningVersionHistory = (window as any).notebookNavigatorOpeningVersionHistory;
        
        if (!hasNavigatorFocus && !isOpeningVersionHistory) {
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        }
    };
    
    // Use auto-reveal hook to detect which file needs revealing
    const { fileToReveal } = useAutoReveal(app, {
        autoRevealActiveFile: settings.autoRevealActiveFile
    });
    
    // Handle revealing the file when detected by the hook
    useEffect(() => {
        if (fileToReveal) {
            revealFile(fileToReveal);
        }
    }, [fileToReveal]); // Remove revealFile from deps to prevent infinite loop
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        revealFile,
        focusFilePane: () => {
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            // Focus the container to ensure keyboard navigation works
            containerRef.current?.focus();
        },
        refresh: () => {
            // A no-op update will increment the version and force a re-render
            updateSettings(settings => {});
        },
        /**
         * Handles when the navigator view becomes active on mobile.
         * 
         * Due to Obsidian limitations, we cannot reliably control scroll position
         * when the view becomes active after being hidden. The view loses its
         * dimensions and scroll state, and attempts to restore or set scroll
         * position do not work without user interaction.
         * 
         * This method is kept for potential future use but currently does nothing.
         */
        handleBecomeActive: () => {
            if (!isMobile) return;
            
            
            // Do nothing - scroll manipulation doesn't work reliably on mobile
            // when the view becomes active after being hidden
        }
    }), [
        selectionDispatch, 
        uiDispatch, 
        updateSettings, 
        isMobile,
        uiState.currentMobileView,
        selectionState.selectedFolder,
        selectionState.selectedFile,
        expansionState.expandedFolders,
        expansionDispatch,
        revealFile
    ]);

    /**
     * Handle file reveal - expand folders and scroll when a file is revealed.
     * 
     * DEPENDENCY FIX:
     * - Removed expansionState.expandedFolders from dependencies
     * - This prevents the effect from re-running when folders are collapsed/expanded
     * - Previously caused auto-reveal to fire after expand/collapse operations
     * - Now only runs when there's an actual reveal operation or selection change
     */
    useEffect(() => {
        // ONLY process if this is a reveal operation, not normal keyboard navigation
        if (selectionState.isRevealOperation && selectionState.selectedFolder && selectionState.selectedFile) {
            const file = selectionState.selectedFile;
            
            // Build folder path to expand
            const foldersToExpand: string[] = [];
            let currentFolder: TFolder | null = file.parent;
            while (currentFolder) {
                foldersToExpand.unshift(currentFolder.path);
                if (currentFolder.path === '/') break;
                currentFolder = currentFolder.parent;
            }
            
            // Expand folders if needed
            const needsExpansion = foldersToExpand.some(path => !expansionState.expandedFolders.has(path));
            if (needsExpansion) {
                expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
            }
            
            // Scroll to revealed items after a brief delay to ensure rendering is complete
            // This replaces the imperative setTimeout approach with a declarative effect
            const scrollTimer = setTimeout(() => {
                // Scroll to folder in left pane
                const folderIndex = leftPaneRef.current?.getIndexOfPath(file.parent!.path);
                
                if (folderIndex !== undefined && folderIndex !== -1) {
                    leftPaneRef.current?.virtualizer?.scrollToIndex(folderIndex, { align: 'center', behavior: 'auto' });
                }
                
                // Scroll to file in file list
                const fileIndex = fileListRef.current?.getIndexOfPath(file.path);
                if (fileIndex !== undefined && fileIndex !== -1 && fileListRef.current?.virtualizer) {
                    const virtualizer = fileListRef.current.virtualizer;
                    const scrollElement = fileListRef.current.scrollContainerRef;
                    
                    if (scrollElement) {
                        // Check if the file is already visible
                        const virtualItems = virtualizer.getVirtualItems();
                        const virtualItem = virtualItems.find(item => item.index === fileIndex);
                        
                        if (virtualItem) {
                            // Check if the item is fully visible in the viewport
                            const containerHeight = scrollElement.offsetHeight;
                            const scrollTop = scrollElement.scrollTop;
                            const itemTop = virtualItem.start;
                            const itemBottom = virtualItem.end;
                            
                            const isFullyVisible = itemTop >= scrollTop && itemBottom <= (scrollTop + containerHeight);
                            
                            
                            // Only scroll if the item is not fully visible
                            if (!isFullyVisible) {
                                virtualizer.scrollToIndex(fileIndex, { align: 'center', behavior: 'auto' });
                            } else {
                            }
                        } else {
                            // Item is not in virtual items, so it's definitely not visible
                            virtualizer.scrollToIndex(fileIndex, { align: 'center', behavior: 'auto' });
                        }
                    }
                }
            }, 50); // Small delay to ensure DOM updates are complete
            
            return () => clearTimeout(scrollTimer);
        }
    }, [selectionState.isRevealOperation, selectionState.selectedFolder, selectionState.selectedFile, expansionDispatch]);
    

    // Handle focus/blur events to track when navigator has focus
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleFocus = () => {
            setIsNavigatorFocused(true);
        };

        const handleBlur = (e: FocusEvent) => {
            // Check if focus is moving within the navigator
            if (e.relatedTarget && container.contains(e.relatedTarget as Node)) {
                return;
            }
            setIsNavigatorFocused(false);
        };

        container.addEventListener('focusin', handleFocus);
        container.addEventListener('focusout', handleBlur);
        
        // Focus the container initially
        container.focus();

        return () => {
            container.removeEventListener('focusin', handleFocus);
            container.removeEventListener('focusout', handleBlur);
        };
    }, []);

    // ADD THIS NEW EFFECT
    // When the focused pane changes programmatically via the state,
    // we must ensure the main container element has DOM focus so it can
    // receive and correctly delegate keyboard events.
    useEffect(() => {
        if (uiState.focusedPane) {
            containerRef.current?.focus();
        }
    }, [uiState.focusedPane]);
    
    // Track when the navigator is being hidden to ensure consistent state
    useEffect(() => {
        if (!isMobile) return;
        
        let hideCount = 0;
        
        const handleVisibilityChange = (leaf: WorkspaceLeaf | null) => {
            if (!leaf) return;
            
            const isNavigatorView = leaf.view?.getViewType() === VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT;
            const leftSplit = app.workspace.leftSplit;
            
            
            // If we're switching away from navigator and sidebar is not collapsed
            if (!isNavigatorView && leftSplit && !leftSplit.collapsed) {
                hideCount++;
                
                // Call collapse to ensure consistent state
                leftSplit.collapse();
            }
        };
        
        // Listen to active leaf changes
        const leafChangeRef = app.workspace.on('active-leaf-change', handleVisibilityChange);
        
        return () => {
            app.workspace.offref(leafChangeRef);
        };
    }, [app.workspace, isMobile]);
    
    
    // Handle delete events to clean up stale state
    useEffect(() => {
        const handleDelete = (file: TAbstractFile) => {
            if (isTFolder(file)) {
                // Cleanup expanded folders
                const existingPaths = new Set<string>();
                const collectAllFolderPaths = (folder: TFolder) => {
                    existingPaths.add(folder.path);
                    folder.children.forEach(child => {
                        if (isTFolder(child)) {
                            collectAllFolderPaths(child);
                        }
                    });
                };
                collectAllFolderPaths(app.vault.getRoot());
                
                expansionDispatch({ type: 'CLEANUP_DELETED_FOLDERS', existingPaths });
                selectionDispatch({ type: 'CLEANUP_DELETED_FOLDER', deletedPath: file.path });
            } else if (file instanceof TFile) {
                
                // Just cleanup the deleted file
                selectionDispatch({ 
                    type: 'CLEANUP_DELETED_FILE', 
                    deletedPath: file.path,
                    nextFileToSelect: null
                });
                
                // Let auto-reveal handle the selection of the new active file
            }
        };
        
        const deleteEventRef = app.vault.on('delete', handleDelete);
        
        return () => {
            app.vault.offref(deleteEventRef);
        };
    }, [app.vault, expansionDispatch, selectionDispatch, selectionState, settings, isMobile]);

    // Determine CSS classes for mobile view state
    const containerClasses = ['nn-split-container'];
    if (isMobile) {
        containerClasses.push(uiState.currentMobileView === 'list' ? 'show-list' : 'show-files');
    } else {
        containerClasses.push('nn-desktop');
    }
    if (isResizing) {
        containerClasses.push('nn-resizing');
    }
    
    return (
        <div 
            ref={containerRef}
            className={containerClasses.join(' ')} 
            data-focus-pane={isMobile ? (uiState.currentMobileView === 'list' ? 'folders' : 'files') : uiState.focusedPane}
            data-navigator-focused={isMobile ? 'true' : isNavigatorFocused}
            tabIndex={-1}
            onKeyDown={(e) => {
                // Allow keyboard events to bubble up from child components
                // The actual keyboard handling is done in LeftPaneVirtualized and FileList
            }}
        >
            <div className="nn-left-pane" style={{ width: isMobile ? '100%' : `${paneWidth}px` }}>
                <NavigationPane ref={leftPaneRef} />
            </div>
            {!isMobile && <div className="nn-resize-handle" {...resizeHandleProps} />}
            <ErrorBoundary componentName="FileList">
                <FileList ref={fileListRef} />
            </ErrorBoundary>
        </div>
    );
});

NotebookNavigatorComponent.displayName = 'NotebookNavigatorComponent';