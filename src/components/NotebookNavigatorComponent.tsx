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
import { TFile, TFolder, TAbstractFile, WorkspaceLeaf, debounce, Platform } from 'obsidian';
import { LeftPaneVirtualized } from './LeftPaneVirtualized';
import { FileList } from './FileList';
import { ErrorBoundary } from './ErrorBoundary';
import { useServices } from '../context/ServicesContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useResizablePane } from '../hooks/useResizablePane';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { isTFolder } from '../utils/typeGuards';
import { STORAGE_KEYS, PANE_DIMENSIONS, VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT } from '../types';
import { debugLog } from '../utils/debugLog';
import { flattenFolderTree, findFolderIndex } from '../utils/treeFlattener';
import { parseExcludedFolders } from '../utils/fileFilters';

export interface NotebookNavigatorHandle {
    revealFile: (file: TFile) => void;
    focusFilePane: () => void;
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
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNavigatorFocused, setIsNavigatorFocused] = useState(false);
    
    // Only set up logging effects if debug is enabled
    useEffect(() => {
        if (Platform.isMobile && plugin.settings.debugMobile) {
            debugLog.info('NotebookNavigatorComponent: Mounted', { 
                isMobile,
                initialView: uiState.currentMobileView,
                selectedFolder: selectionState.selectedFolder?.path,
                selectedFile: selectionState.selectedFile?.path
            });
            return () => {
                debugLog.info('NotebookNavigatorComponent: Unmounted');
            };
        }
    }, [plugin.settings.debugMobile]);
    
    
    // Enable drag and drop only on desktop
    useDragAndDrop(containerRef);
    
    // Enable resizable pane
    const { paneWidth, resizeHandleProps } = useResizablePane({
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
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        revealFile: (file: TFile) => {
            if (Platform.isMobile && plugin.settings.debugMobile) {
                debugLog.debug('NotebookNavigatorComponent: revealFile called', { file: file.path });
            }
            // Simply dispatch the reveal action - effects will handle the rest
            selectionDispatch({ type: 'REVEAL_FILE', file });
        },
        focusFilePane: () => {
            if (Platform.isMobile && plugin.settings.debugMobile) {
                debugLog.debug('NotebookNavigatorComponent: focusFilePane called');
            }
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            // Focus the container to ensure keyboard navigation works
            containerRef.current?.focus();
        }
    }), [selectionDispatch, uiDispatch, plugin.settings.debugMobile]);

    // Handle file reveal - expand folders and scroll when a file is revealed
    useEffect(() => {
        // This effect runs when selectedFolder changes due to REVEAL_FILE
        if (selectionState.selectedFolder && selectionState.selectedFile) {
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
            
            // Focus the files pane
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            
            // Calculate and dispatch scroll to folder
            const vault = app.vault;
            const root = vault.getRoot();
            const rootFolders = plugin.settings.showRootFolder 
                ? [root]
                : root.children.filter(child => isTFolder(child)).sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];
            
            // Use the current expansion state (will include newly expanded folders)
            const flattened = flattenFolderTree(
                rootFolders,
                expansionState.expandedFolders,
                parseExcludedFolders(plugin.settings.ignoreFolders || '')
            );
            
            const folderIndex = findFolderIndex(flattened, selectionState.selectedFolder.path);
            if (folderIndex !== -1) {
                uiDispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: folderIndex });
            }
        }
    }, [selectionState.selectedFolder, selectionState.selectedFile, expansionState.expandedFolders, 
        expansionDispatch, uiDispatch, app.vault, plugin.settings.showRootFolder, 
        plugin.settings.ignoreFolders]);

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

    // Track navigator interaction time for smarter auto-reveal
    const navigatorInteractionRef = useRef(0);
    
    // Add this useEffect to handle active leaf changes and file-open events
    useEffect(() => {
        if (!plugin.settings.autoRevealActiveFile) return;

        const handleFileChange = (file: TFile | null) => {
            if (!file) return;
            
            // Skip auto-reveal if navigator was recently interacted with (within 300ms)
            if (Date.now() - navigatorInteractionRef.current < 300) {
                return;
            }
            
            // On mobile, skip auto-reveal when the navigator is visible
            if (isMobile && !app.workspace.leftSplit?.collapsed) {
                return;
            }
            
            // Always update selected file if it's different
            if (selectionState.selectedFile?.path !== file.path) {
                selectionDispatch({ type: 'SET_SELECTED_FILE', file });
                
                // Check if we need to reveal the file in the folder tree
                let needsReveal = true;
                
                if (selectionState.selectedFolder && file.parent) {
                    // Check if file is in the selected folder
                    if (selectionState.selectedFolder.path === file.parent.path) {
                        needsReveal = false;
                    }
                    
                    // If showing notes from subfolders, check if file is in a subfolder
                    if (plugin.settings.showNotesFromSubfolders) {
                        // Check if the file's parent is a descendant of the currently selected folder
                        if (file.parent.path.startsWith(selectionState.selectedFolder.path + '/') || 
                            file.parent.path === selectionState.selectedFolder.path) {
                            // The file is visible in the current view. Do nothing else.
                            needsReveal = false;
                        }
                    }
                }
                
                // Only reveal if the file is not already visible in the current view
                if (needsReveal && file.parent) {
                    const foldersToExpand: string[] = [];
                    let currentFolder: TFolder | null = file.parent;
                    while (currentFolder) {
                        foldersToExpand.unshift(currentFolder.path);
                        if (currentFolder.path === '/') break;
                        currentFolder = currentFolder.parent;
                    }
                    expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
                    selectionDispatch({ type: 'REVEAL_FILE', file });
                }
            }
        };

        const handleActiveLeafChange = (leaf: WorkspaceLeaf | null) => {
            // Only process leaves in the main editor area
            if (!leaf || leaf.getRoot() !== app.workspace.rootSplit) {
                return;
            }
            
            // Get the file from the active view
            const view = leaf.view as any;
            if (view && view.file && view.file instanceof TFile) {
                handleFileChange(view.file);
            }
        };

        const handleFileOpen = (file: TFile | null) => {
            if (file instanceof TFile) {
                // Only process if the file is opened in the main editor area
                const activeLeaf = app.workspace.activeLeaf;
                if (activeLeaf && activeLeaf.getRoot() === app.workspace.rootSplit) {
                    handleFileChange(file);
                }
            }
        };

        const activeLeafEventRef = app.workspace.on('active-leaf-change', handleActiveLeafChange);
        const fileOpenEventRef = app.workspace.on('file-open', handleFileOpen);
        
        // No longer needed - FileList handles scrolling when mobile view changes

        return () => {
            app.workspace.offref(activeLeafEventRef);
            app.workspace.offref(fileOpenEventRef);
        };
    }, [app.workspace, selectionDispatch, expansionDispatch, plugin.settings.autoRevealActiveFile, plugin.settings.showNotesFromSubfolders, selectionState.selectedFile, selectionState.selectedFolder, isMobile]);
    
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
                selectionDispatch({ type: 'CLEANUP_DELETED_FILE', deletedPath: file.path });
            }
        };
        
        const deleteEventRef = app.vault.on('delete', handleDelete);
        
        return () => {
            app.vault.offref(deleteEventRef);
        };
    }, [app.vault, expansionDispatch, selectionDispatch]);

    // Determine CSS classes for mobile view state
    const containerClasses = ['nn-split-container'];
    if (isMobile) {
        containerClasses.push(uiState.currentMobileView === 'list' ? 'show-list' : 'show-files');
    } else {
        containerClasses.push('nn-desktop');
    }
    
    return (
        <div 
            ref={containerRef}
            className={containerClasses.join(' ')} 
            data-focus-pane={isMobile ? (uiState.currentMobileView === 'list' ? 'folders' : 'files') : uiState.focusedPane}
            data-navigator-focused={isMobile ? 'true' : isNavigatorFocused}
            tabIndex={-1}
            onMouseDown={() => navigatorInteractionRef.current = Date.now()}
            onKeyDown={(e) => {
                navigatorInteractionRef.current = Date.now();
                // Allow keyboard events to bubble up from child components
                // The actual keyboard handling is done in LeftPaneVirtualized and FileList
            }}
        >
            <div className="nn-left-pane" style={{ width: isMobile ? '100%' : `${paneWidth}px` }}>
                <LeftPaneVirtualized />
            </div>
            {!isMobile && <div className="nn-resize-handle" {...resizeHandleProps} />}
            <ErrorBoundary componentName="FileList">
                <FileList />
            </ErrorBoundary>
        </div>
    );
});

NotebookNavigatorComponent.displayName = 'NotebookNavigatorComponent';