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
import { TFile, TFolder, WorkspaceLeaf, debounce, Platform } from 'obsidian';
import { LeftPaneVirtualized } from './LeftPaneVirtualized';
import { FileList } from './FileList';
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
    refresh: () => void;
    focusFilePane: () => void;
}

/**
 * Main container component for the Notebook Navigator plugin.
 * Provides a two-pane layout with resizable divider, folder tree on the left,
 * and file list on the right. Manages keyboard navigation, drag-and-drop,
 * and auto-reveal functionality for the active file.
 * 
 * @param _ - Props (none used)
 * @param ref - Forwarded ref exposing revealFile and refresh methods
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
            // For REVEAL_FILE, we need to expand folders and update selection
            if (file.parent) {
                const foldersToExpand: string[] = [];
                let currentFolder: TFolder | null = file.parent;
                while (currentFolder) {
                    foldersToExpand.unshift(currentFolder.path);
                    if (currentFolder.path === '/') break;
                    currentFolder = currentFolder.parent;
                }
                
                // First expand folders
                expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
                selectionDispatch({ type: 'REVEAL_FILE', file });
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                
                // Calculate the folder index for predictive scrolling
                // We need to build the flattened tree with the new expansion state
                const newExpandedFolders = new Set(expansionState.expandedFolders);
                foldersToExpand.forEach(path => newExpandedFolders.add(path));
                
                // Get root folders
                const vault = app.vault;
                const root = vault.getRoot();
                const rootFolders = plugin.settings.showRootFolder 
                    ? [root]
                    : root.children.filter(child => isTFolder(child)).sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];
                
                // Flatten the tree with the new expansion state
                const flattened = flattenFolderTree(
                    rootFolders,
                    newExpandedFolders,
                    parseExcludedFolders(plugin.settings.ignoreFolders || '')
                );
                
                // Find the index of the target folder
                const folderIndex = findFolderIndex(flattened, file.parent.path);
                if (folderIndex !== -1) {
                    // Dispatch scroll to folder index
                    uiDispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: folderIndex });
                }
            }
        },
        refresh: () => {
            if (Platform.isMobile && plugin.settings.debugMobile) {
                debugLog.debug('NotebookNavigatorComponent: refresh called');
            }
            // TODO: Remove this method entirely. Components should re-render based on state changes,
            // not manual refresh triggers. For now, this is a no-op.
            // The vault events should trigger state updates that cause natural re-renders.
        },
        focusFilePane: () => {
            if (Platform.isMobile && plugin.settings.debugMobile) {
                debugLog.debug('NotebookNavigatorComponent: focusFilePane called');
            }
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            // Focus the container to ensure keyboard navigation works
            containerRef.current?.focus();
        }
    }), [app, selectionDispatch, expansionDispatch, uiDispatch, plugin.settings.debugMobile]);

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
    
    // Track last processed file to prevent duplicates on mobile
    const lastProcessedFileRef = useRef<string | null>(null);
    const lastProcessedTimeRef = useRef<number>(0);
    
    // Track sidebar state to filter out toggle events
    const sidebarStateRef = useRef<boolean>(false);
    
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
                        let parent: TFolder | null = file.parent;
                        while (parent) {
                            if (parent.path === selectionState.selectedFolder.path) {
                                // File is in a subfolder of the selected folder
                                // Update folder selection to file's immediate parent for clarity
                                if (file.parent.path !== selectionState.selectedFolder.path) {
                                    selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: file.parent });
                                }
                                needsReveal = false;
                                break;
                            }
                            parent = parent.parent;
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
            // Mobile-specific optimizations
            if (Platform.isMobile) {
                // Early exit for sidebar events
                if (leaf && leaf.getRoot() !== app.workspace.rootSplit) {
                    if (plugin.settings.debugMobile) {
                        debugLog.debug('NotebookNavigatorComponent: Ignoring sidebar leaf change');
                    }
                    return;
                }
                
                // Get current file from the leaf
                const view = leaf?.view as any;
                const currentFile = view?.file;
                
                // Check for duplicate events within 100ms window
                if (currentFile instanceof TFile) {
                    const now = Date.now();
                    if (lastProcessedFileRef.current === currentFile.path && 
                        (now - lastProcessedTimeRef.current) < 100) {
                        if (plugin.settings.debugMobile) {
                            debugLog.debug('NotebookNavigatorComponent: Skipping duplicate active-leaf event', {
                                file: currentFile.path,
                                timeDiff: now - lastProcessedTimeRef.current
                            });
                        }
                        return;
                    }
                    lastProcessedFileRef.current = currentFile.path;
                    lastProcessedTimeRef.current = now;
                }
                
                // Log the event if debug is enabled
                if (plugin.settings.debugMobile && leaf) {
                    const viewType = leaf.view?.getViewType();
                    const isNavigator = viewType === VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT;
                    const isEditor = viewType === 'markdown' || viewType === 'canvas';
                    
                    debugLog.info('NotebookNavigatorComponent: Active leaf changed', {
                        viewType,
                        isNavigator,
                        isEditor,
                        leafLocation: 'main',
                        currentFile: currentFile?.path
                    });
                    
                    if (isEditor) {
                        debugLog.info('NotebookNavigatorComponent: Switched to editor view');
                    }
                }
            } else {
                // Desktop behavior - log all transitions
                if (plugin.settings.debugMobile && leaf) {
                    const viewType = leaf.view?.getViewType();
                    const isNavigator = viewType === VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT;
                    const isEditor = viewType === 'markdown' || viewType === 'canvas';
                    const leafLocation = leaf.getRoot() === app.workspace.rootSplit ? 'main' : 'sidebar';
                    
                    debugLog.info('NotebookNavigatorComponent: Active leaf changed', {
                        viewType,
                        isNavigator,
                        isEditor,
                        leafLocation,
                        currentFile: (leaf.view as any)?.file?.path
                    });
                    
                    if (isNavigator && leafLocation === 'sidebar') {
                        debugLog.info('NotebookNavigatorComponent: Returned to file navigator');
                    } else if (isEditor && leafLocation === 'main') {
                        debugLog.info('NotebookNavigatorComponent: Switched to editor view');
                    }
                }
            }
            
            // Only trigger for leaves in the main editor area
            if (!leaf || leaf.getRoot() !== app.workspace.rootSplit) {
                return;
            }
            
            // Note: Accessing view.file via 'any' as it's not in Obsidian's public TypeScript API
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

        // Create debounced version for mobile to prevent duplicate events
        const debouncedHandleActiveLeafChange = Platform.isMobile ? 
            debounce(handleActiveLeafChange, 50, true) : 
            handleActiveLeafChange;
        
        const activeLeafEventRef = app.workspace.on('active-leaf-change', debouncedHandleActiveLeafChange);
        // Remove file-open listener on mobile - it's redundant with active-leaf-change
        const fileOpenEventRef = Platform.isMobile ? null : app.workspace.on('file-open', handleFileOpen);
        
        // Add layout change listener for mobile sidebar collapse/expand
        const layoutChangeEventRef = app.workspace.on('layout-change', () => {
            if (Platform.isMobile) {
                const leftSplit = app.workspace.leftSplit;
                const isCollapsed = leftSplit?.collapsed ?? false;
                
                // Track sidebar state
                sidebarStateRef.current = !isCollapsed;
                
                if (plugin.settings.debugMobile) {
                    debugLog.info('NotebookNavigatorComponent: Layout changed', {
                        leftSidebarCollapsed: isCollapsed,
                        activeView: app.workspace.activeLeaf?.view?.getViewType()
                    });
                    
                    if (!isCollapsed) {
                        debugLog.info('NotebookNavigatorComponent: Sidebar expanded (returning to navigator)');
                    }
                }
                
                // When returning to navigator (sidebar expanded), FileList will handle
                // dispatching the appropriate SCROLL_TO_FILE_INDEX action
            }
        });

        return () => {
            // Cancel any pending debounced calls
            if (Platform.isMobile && typeof (debouncedHandleActiveLeafChange as any).cancel === 'function') {
                (debouncedHandleActiveLeafChange as any).cancel();
            }
            
            app.workspace.offref(activeLeafEventRef);
            if (fileOpenEventRef) {
                app.workspace.offref(fileOpenEventRef);
            }
            app.workspace.offref(layoutChangeEventRef);
        };
    }, [app.workspace, selectionDispatch, expansionDispatch, plugin.settings.autoRevealActiveFile, plugin.settings.showNotesFromSubfolders, selectionState.selectedFile, selectionState.selectedFolder, isMobile]);

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
            onKeyDown={() => navigatorInteractionRef.current = Date.now()}
        >
            <div className="nn-left-pane" style={{ width: isMobile ? '100%' : `${paneWidth}px` }}>
                <LeftPaneVirtualized />
            </div>
            {!isMobile && <div className="nn-resize-handle" {...resizeHandleProps} />}
            <FileList />
        </div>
    );
});

NotebookNavigatorComponent.displayName = 'NotebookNavigatorComponent';