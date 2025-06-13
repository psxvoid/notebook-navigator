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
import { TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { PaneHeader } from './PaneHeader';
import { FolderTree } from './FolderTree';
import { TagList } from './TagList';
import { FileList } from './FileList';
import { useAppContext } from '../context/AppContext';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useResizablePane } from '../hooks/useResizablePane';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { isTFolder } from '../utils/typeGuards';
import { STORAGE_KEYS } from '../types';

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
    const { app, appState, dispatch, plugin, refreshCounter, isMobile } = useAppContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNavigatorFocused, setIsNavigatorFocused] = useState(false);
    
    // Enable keyboard navigation
    useKeyboardNavigation(containerRef);
    
    // Enable drag and drop only on desktop
    useDragAndDrop(containerRef);
    
    // Enable resizable pane
    const { paneWidth, resizeHandleProps } = useResizablePane({
        initialWidth: 300,
        min: 150,
        max: 600,
        storageKey: STORAGE_KEYS.leftPaneWidthKey
    });
    
    // Enable swipe gestures on mobile
    const isRTL = document.body.classList.contains('mod-rtl');
    useSwipeGesture(containerRef, {
        onSwipeRight: () => {
            if (isMobile && appState.currentMobileView === 'files') {
                // In RTL mode, swipe right goes forward (to files view)
                // In LTR mode, swipe right goes back (to list view)
                if (!isRTL) {
                    dispatch({ type: 'SET_MOBILE_VIEW', view: 'list' });
                }
            }
        },
        onSwipeLeft: () => {
            if (isMobile && appState.currentMobileView === 'files') {
                // In RTL mode, swipe left goes back (to list view)
                if (isRTL) {
                    dispatch({ type: 'SET_MOBILE_VIEW', view: 'list' });
                }
            }
        },
        enabled: isMobile
    });
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        revealFile: (file: TFile) => {
            dispatch({ type: 'REVEAL_FILE', file });
        },
        refresh: () => {
            dispatch({ type: 'FORCE_REFRESH' });
        },
        focusFilePane: () => {
            dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            // Focus the container to ensure keyboard navigation works
            containerRef.current?.focus();
        }
    }), [dispatch]);

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
            
            // Always update selected file if it's different
            if (appState.selectedFile?.path !== file.path) {
                dispatch({ type: 'SET_SELECTED_FILE', file });
                
                // Check if we need to reveal the file in the folder tree
                let needsReveal = true;
                
                if (appState.selectedFolder && file.parent) {
                    // Check if file is in the selected folder
                    if (appState.selectedFolder.path === file.parent.path) {
                        needsReveal = false;
                    }
                    
                    // If showing notes from subfolders, check if file is in a subfolder
                    if (plugin.settings.showNotesFromSubfolders) {
                        let parent: TFolder | null = file.parent;
                        while (parent) {
                            if (parent.path === appState.selectedFolder.path) {
                                // File is in a subfolder of the selected folder
                                // Update folder selection to file's immediate parent for clarity
                                if (file.parent.path !== appState.selectedFolder.path) {
                                    dispatch({ type: 'SET_SELECTED_FOLDER', folder: file.parent });
                                }
                                needsReveal = false;
                                break;
                            }
                            parent = parent.parent;
                        }
                    }
                }
                
                // Only reveal if the file is not already visible in the current view
                if (needsReveal) {
                    dispatch({ type: 'REVEAL_FILE', file });
                }
            }
        };

        const handleActiveLeafChange = (leaf: WorkspaceLeaf | null) => {
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

        const activeLeafEventRef = app.workspace.on('active-leaf-change', handleActiveLeafChange);
        const fileOpenEventRef = app.workspace.on('file-open', handleFileOpen);

        return () => {
            app.workspace.offref(activeLeafEventRef);
            app.workspace.offref(fileOpenEventRef);
        };
    }, [app.workspace, dispatch, plugin.settings.autoRevealActiveFile, plugin.settings.showNotesFromSubfolders, appState.selectedFile, appState.selectedFolder]);

    // Determine CSS classes for mobile view state
    const containerClasses = ['nn-split-container'];
    if (isMobile) {
        containerClasses.push(appState.currentMobileView === 'list' ? 'show-list' : 'show-files');
    } else {
        containerClasses.push('nn-desktop');
    }
    
    return (
        <div 
            ref={containerRef}
            className={containerClasses.join(' ')} 
            data-focus-pane={isMobile ? (appState.currentMobileView === 'list' ? 'folders' : 'files') : appState.focusedPane}
            data-navigator-focused={isMobile ? 'true' : isNavigatorFocused}
            tabIndex={-1}
            onMouseDown={() => navigatorInteractionRef.current = Date.now()}
            onKeyDown={() => navigatorInteractionRef.current = Date.now()}
        >
            <div className="nn-left-pane" style={{ width: isMobile ? '100%' : `${paneWidth}px` }}>
                <PaneHeader type="folder" />
                <div className="nn-left-pane-scroller">
                    <FolderTree />
                    <TagList />
                </div>
            </div>
            {!isMobile && <div className="nn-resize-handle" {...resizeHandleProps} />}
            <div className="nn-right-pane">
                <PaneHeader type="file" />
                <FileList />
            </div>
        </div>
    );
});

NotebookNavigatorComponent.displayName = 'NotebookNavigatorComponent';