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
import React, { useEffect, useImperativeHandle, forwardRef, useRef, useState, useCallback } from 'react';
import { TFile, TFolder, TAbstractFile, WorkspaceLeaf, debounce, Platform, ItemView, Notice } from 'obsidian';
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
import { STORAGE_KEYS, NAVIGATION_PANE_DIMENSIONS, FILE_PANE_DIMENSIONS, VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT } from '../types';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { flattenFolderTree, findFolderIndex } from '../utils/treeFlattener';
import { parseExcludedFolders } from '../utils/fileFilters';
import { Virtualizer } from '@tanstack/react-virtual';
import { useAutoReveal } from '../hooks/useAutoReveal';
import { strings } from '../i18n';

export interface NotebookNavigatorHandle {
    revealFile: (file: TFile, isManualReveal?: boolean) => void;
    focusFilePane: () => void;
    refresh: () => void;
    handleBecomeActive: () => void;
    toggleNavigationPane: () => void;
    deleteActiveFile: () => void;
    createNoteInSelectedFolder: () => Promise<void>;
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
    const { app, plugin, isMobile, fileSystemOps } = useServices();
    const settings = useSettingsState();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNavigatorFocused, setIsNavigatorFocused] = useState(false);
    const navigationPaneRef = useRef<NavigationPaneHandle>(null);
    const fileListRef = useRef<FileListHandle>(null);
    
    

    // Handle scrolling when mobile view changes or on initial mount
    useEffect(() => {
        if (!isMobile) return;
        
        // Scroll to the appropriate item based on current view
        if (uiState.currentMobileView === 'list' && selectionState.selectedFolder) {
            const index = navigationPaneRef.current?.getIndexOfPath(selectionState.selectedFolder.path);
            if (index !== undefined && index !== -1) {
                navigationPaneRef.current?.virtualizer?.scrollToIndex(index, { align: 'center' });
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
        initialWidth: NAVIGATION_PANE_DIMENSIONS.defaultWidth,
        min: NAVIGATION_PANE_DIMENSIONS.minWidth,
        max: NAVIGATION_PANE_DIMENSIONS.maxWidth,
        storageKey: STORAGE_KEYS.navigationPaneWidthKey
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
    
    /**
     * Reveals a file in the navigator by expanding necessary folders and selecting it.
     * 
     * FOLDER EXPANSION BEHAVIOR:
     * Expansion depends on the reveal type and settings:
     * 
     * Example: Revealing "Tech/2025/Notes/file.md"
     * 
     * Manual Reveal (always expands):
     * - Will expand: "Tech" and "2025" 
     * - Will NOT expand: "Notes" (immediate parent - preserves user's choice)
     * 
     * Auto Reveal with "Show notes from subfolders" OFF:
     * - Same as manual reveal
     * 
     * Auto Reveal with "Show notes from subfolders" ON:
     * - If current folder is "Tech" and file is in subfolder: NO expansion
     * - Otherwise: Same as manual reveal
     * 
     * REVEAL TYPES:
     * 1. Manual Reveal (via "Reveal file" command):
     *    - Always expands folders to show file location
     *    - Always changes selected folder to the file's parent
     *    - Used when user explicitly wants to see the file's location
     * 
     * 2. Auto Reveal (on file open/startup):
     *    - Only expands folders if NOT preserving current folder selection
     *    - When "Show notes from subfolders" is on and file is in subfolder:
     *      - Does NOT expand any folders (maintains current view)
     *      - Preserves current folder selection
     *    - Less disruptive to user's current navigation context
     * 
     * @param file - The file to reveal
     * @param isManualReveal - True when triggered by "Reveal file" command
     */
    const revealFile = (file: TFile, isManualReveal?: boolean) => {
        if (!file || !file.parent) return;
        
        // Check if we should preserve the current folder selection
        // Only for auto-reveal: If showNotesFromSubfolders is on and file is in a subfolder
        // of the current folder, preserve the selection
        let preserveFolder = false;
        if (!isManualReveal && settings.showNotesFromSubfolders && selectionState.selectedFolder && file.parent) {
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
        
        // Determine if we should expand folders
        // For manual reveal: Always expand to show file location
        // For auto-reveal: Only expand if NOT preserving folder (respects "Show notes from subfolders")
        const shouldExpandFolders = isManualReveal || !preserveFolder;
        
        if (shouldExpandFolders) {
            // We need to expand folders BEFORE changing selection
            // This ensures the folder hierarchy is visible when the selection changes
            const foldersToExpand: string[] = [];
            let currentFolder: TFolder | null = file.parent;
            
            // Expand all ancestors except the immediate parent
            // This preserves the user's choice of whether the parent is expanded/collapsed
            if (currentFolder && currentFolder.parent) {
                currentFolder = currentFolder.parent; // Skip immediate parent
                while (currentFolder) {
                    foldersToExpand.unshift(currentFolder.path);
                    if (currentFolder.path === '/') break;
                    currentFolder = currentFolder.parent;
                }
            }
            
            // Expand folders if needed
            const needsExpansion = foldersToExpand.some(path => !expansionState.expandedFolders.has(path));
            if (needsExpansion) {
                expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
            }
        }
        
        // Trigger the reveal - scrolling will happen via the effect that watches isRevealOperation
        selectionDispatch({ type: 'REVEAL_FILE', file, preserveFolder });
        
        // Only change focus if we're not already in the navigator AND not opening version history
        const navigatorEl = document.querySelector('.nn-split-container');
        const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);
        const isOpeningVersionHistory = window.notebookNavigatorOpeningVersionHistory;
        
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
            revealFile(fileToReveal, false); // Explicitly pass false for auto-reveal
        }
    }, [fileToReveal]); // Remove revealFile from deps to prevent infinite loop
    
    // Handle revealing files that moved to a different folder
    useEffect(() => {
        if (selectionState.fileMovedToDifferentFolder) {
            revealFile(selectionState.fileMovedToDifferentFolder, true); // true for manual reveal
        }
    }, [selectionState.fileMovedToDifferentFolder]); // Remove revealFile from deps to prevent infinite loop
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        revealFile,
        focusFilePane: () => {
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            // Focus the container to ensure keyboard navigation works
            // Don't steal focus if we're opening version history
            const isOpeningVersionHistory = window.notebookNavigatorOpeningVersionHistory;
            if (!isOpeningVersionHistory) {
                containerRef.current?.focus();
            }
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
        },
        toggleNavigationPane: () => {
            uiDispatch({ type: 'TOGGLE_NAVIGATION_PANE' });
        },
        deleteActiveFile: () => {
            // First ensure the file pane is focused so the keyboard handler will process the event
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            
            // Then dispatch a Delete key event to trigger the existing keyboard handler
            const deleteEvent = new KeyboardEvent('keydown', {
                key: 'Delete',
                bubbles: true,
                cancelable: true
            });
            
            // Small delay to ensure focus state is updated
            setTimeout(() => {
                document.dispatchEvent(deleteEvent);
            }, 0);
        },
        createNoteInSelectedFolder: async () => {
            if (!selectionState.selectedFolder) {
                new Notice(strings.fileSystem.errors.noFolderSelected);
                return;
            }
            
            // Use the same logic as the context menu
            const file = await fileSystemOps.createNewFile(selectionState.selectedFolder);
            if (file) {
                uiDispatch({ type: 'SET_NEWLY_CREATED_PATH', path: file.path });
            }
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
        revealFile,
        fileSystemOps
    ]);

    /**
     * Handle reveal scrolling after selection changes.
     * Folder expansion now happens in revealFile() BEFORE selection changes.
     */
    useEffect(() => {
        // ONLY process if this is a reveal operation, not normal keyboard navigation
        if (selectionState.isRevealOperation && selectionState.selectedFile) {
            const file = selectionState.selectedFile;
            
            // Scroll to revealed items after a brief delay to ensure rendering is complete
            // This replaces the imperative setTimeout approach with a declarative effect
            const scrollTimer = setTimeout(() => {
                // Scroll to folder in navigation pane - but only if we're not preserving the current folder
                // When preserveFolder is true (showNotesFromSubfolders), we don't want to jump to the subfolder
                const shouldScrollToFolder = selectionState.selectedFolder && 
                                            selectionState.selectedFolder.path === file.parent!.path;
                
                if (shouldScrollToFolder) {
                    const folderIndex = navigationPaneRef.current?.getIndexOfPath(file.parent!.path);
                    
                    if (folderIndex !== undefined && folderIndex !== -1) {
                        navigationPaneRef.current?.virtualizer?.scrollToIndex(folderIndex, { align: 'center', behavior: 'auto' });
                    }
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
    }, [selectionState.isRevealOperation, selectionState.selectedFolder, selectionState.selectedFile]);
    

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

    // Ensure the container has focus when the focused pane changes
    useEffect(() => {
        // Don't steal focus if we're opening version history
        const isOpeningVersionHistory = window.notebookNavigatorOpeningVersionHistory;
        if (uiState.focusedPane && !isOpeningVersionHistory) {
            containerRef.current?.focus();
        }
    }, [uiState.focusedPane]);
    
    // Track if initial visibility check has been performed
    const hasCheckedInitialVisibility = useRef(false);
    
    // Container ref callback that checks if file list is visible on first mount
    const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node;
        
        // Auto-collapse navigation pane on startup if viewport is too narrow for both panes
        if (node && !isMobile && !hasCheckedInitialVisibility.current && !uiState.navigationPaneCollapsed) {
            hasCheckedInitialVisibility.current = true;
            
            const containerWidth = node.getBoundingClientRect().width;
            // Check if container is too narrow to show both panes
            if (containerWidth < paneWidth + FILE_PANE_DIMENSIONS.minWidth) {
                uiDispatch({ type: 'TOGGLE_NAVIGATION_PANE' });
            }
        }
    }, [isMobile, paneWidth, uiDispatch]);
    
    // Track when the navigator is being hidden to ensure consistent state
    useEffect(() => {
        if (!isMobile) return;
        
        let hideCount = 0;
        
        const handleVisibilityChange = (leaf: WorkspaceLeaf | null) => {
            if (!leaf) return;
            
            const isNavigatorView = leaf.view?.getViewType() === VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT;
            const leftSplit = app.workspace.leftSplit;
            
            // Check if the new active leaf is in the left sidebar
            const isInLeftSidebar = leaf.getRoot() === leftSplit;
            
            // Only collapse if we're switching away from navigator to a view outside the sidebar
            // This prevents collapsing when switching between sidebar views (e.g., to file explorer)
            if (!isNavigatorView && leftSplit && !leftSplit.collapsed && !isInLeftSidebar) {
                hideCount++;
                
                // Call collapse to ensure consistent state when switching to editor
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
        if (uiState.navigationPaneCollapsed) {
            containerClasses.push('nn-navigation-pane-collapsed');
        }
    }
    if (isResizing) {
        containerClasses.push('nn-resizing');
    }
    
    return (
        <div 
            ref={containerCallbackRef}
            className={containerClasses.join(' ')} 
            data-focus-pane={isMobile ? (uiState.currentMobileView === 'list' ? 'folders' : 'files') : uiState.focusedPane}
            data-navigator-focused={isMobile ? 'true' : isNavigatorFocused}
            tabIndex={-1}
            onKeyDown={(e) => {
                // Allow keyboard events to bubble up from child components
                // The actual keyboard handling is done in NavigationPane and FileList
            }}
        >
            {(!isMobile && !uiState.navigationPaneCollapsed) && (
                <>
                    <div className="nn-navigation-pane" style={{ width: `${paneWidth}px` }}>
                        <NavigationPane ref={navigationPaneRef} />
                    </div>
                    <div className="nn-resize-handle" {...resizeHandleProps} />
                </>
            )}
            {isMobile && (
                <div className="nn-navigation-pane" style={{ width: '100%' }}>
                    <NavigationPane ref={navigationPaneRef} />
                </div>
            )}
            <ErrorBoundary componentName="FileList">
                <FileList ref={fileListRef} />
            </ErrorBoundary>
        </div>
    );
});

NotebookNavigatorComponent.displayName = 'NotebookNavigatorComponent';