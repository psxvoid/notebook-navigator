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
import { App } from 'obsidian';
import { useSelectionState } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useSwipeGesture } from './useSwipeGesture';
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
    
    // Handle scrolling when single pane view changes or on initial mount
    useEffect(() => {
        if (!uiState.singlePane) return;
        
        // Scroll to the appropriate item based on current view
        if (uiState.currentSinglePaneView === 'list' && selectionState.selectedFolder) {
            const index = navigationPaneRef.current?.getIndexOfPath(selectionState.selectedFolder.path);
            if (index !== undefined && index !== -1) {
                // Only use center alignment on mobile, use auto on desktop
                navigationPaneRef.current?.virtualizer?.scrollToIndex(index, { 
                    align: isMobile ? 'center' : 'auto' 
                });
            }
        } else if (uiState.currentSinglePaneView === 'files' && selectionState.selectedFile) {
            const index = fileListRef.current?.getIndexOfPath(selectionState.selectedFile.path);
            if (index !== undefined && index !== -1) {
                // Only use center alignment on mobile, use auto on desktop
                fileListRef.current?.virtualizer?.scrollToIndex(index, { 
                    align: isMobile ? 'center' : 'auto' 
                });
            }
        }
    }, [uiState.singlePane, uiState.currentSinglePaneView, selectionState.selectedFolder, selectionState.selectedFile,
        navigationPaneRef, fileListRef, isMobile]);
    
    // Enable swipe gestures on mobile
    const isRTL = document.body.classList.contains('mod-rtl');
    useSwipeGesture(containerRef, {
        onSwipeRight: () => {
            if (isMobile && uiState.currentSinglePaneView === 'files') {
                // In RTL mode, swipe right goes forward (to files view)
                // In LTR mode, swipe right goes back (to list view)
                if (!isRTL) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'list' });
                }
            }
        },
        onSwipeLeft: () => {
            if (isMobile && uiState.currentSinglePaneView === 'files') {
                // In RTL mode, swipe left goes back (to list view)
                if (isRTL) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'list' });
                }
            }
        },
        enabled: isMobile
    });
    
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