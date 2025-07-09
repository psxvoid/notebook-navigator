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

import { useEffect, RefObject } from 'react';
import { App, WorkspaceLeaf } from 'obsidian';
import { useSelectionState } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useSwipeGesture } from './useSwipeGesture';
import { VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT } from '../types';
import type { NavigationPaneHandle } from '../components/NavigationPane';
import type { FileListHandle } from '../components/FileList';

interface UseMobileNavigationOptions {
    app: App;
    isMobile: boolean;
    containerRef: RefObject<HTMLDivElement | null>;
    navigationPaneRef: RefObject<NavigationPaneHandle | null>;
    fileListRef: RefObject<FileListHandle | null>;
}

/**
 * Custom hook that handles all mobile-specific navigation logic, including:
 * - Mobile scroll handling when view changes
 * - Swipe gesture support
 * - Mobile visibility tracking
 * 
 * This hook consolidates all mobile-specific behavior that was previously
 * scattered throughout the NotebookNavigatorComponent.
 */
export function useMobileNavigation({
    app,
    isMobile,
    containerRef,
    navigationPaneRef,
    fileListRef
}: UseMobileNavigationOptions) {
    const selectionState = useSelectionState();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    
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
    }, [isMobile, uiState.currentMobileView, selectionState.selectedFolder, selectionState.selectedFile,
        navigationPaneRef, fileListRef]);
    
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
    
    // Auto-collapse the left sidebar when switching from navigator to editor on mobile
    useEffect(() => {
        if (!isMobile) return;
        
        let hideCount = 0;
        
        const handleVisibilityChange = (leaf: WorkspaceLeaf | null) => {
            if (!leaf) return;
            
            const isNavigatorView = leaf.view?.getViewType() === VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT;
            const leftSplit = app.workspace.leftSplit;
            
            // Check if the new active leaf is in the left sidebar
            const isInLeftSidebar = leaf.getRoot() === leftSplit;
            
            // Only collapse the sidebar when:
            // 1. We're leaving the navigator view (not isNavigatorView)
            // 2. The sidebar is currently open (!leftSplit.collapsed)
            // 3. We're switching to a view OUTSIDE the sidebar (!isInLeftSidebar)
            // This prevents the sidebar from collapsing when clicking within other sidebar views
            if (!isNavigatorView && leftSplit && !leftSplit.collapsed && !isInLeftSidebar) {
                hideCount++;
                
                // Collapse the sidebar to give more space to the editor
                leftSplit.collapse();
            }
        };
        
        // Listen to active leaf changes
        const leafChangeRef = app.workspace.on('active-leaf-change', handleVisibilityChange);
        
        return () => {
            app.workspace.offref(leafChangeRef);
        };
    }, [app.workspace, isMobile]);
    
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
    const handleBecomeActive = () => {
        if (!isMobile) return;
        
        // Do nothing - scroll manipulation doesn't work reliably on mobile
        // when the view becomes active after being hidden
    };
    
    return {
        handleBecomeActive
    };
}