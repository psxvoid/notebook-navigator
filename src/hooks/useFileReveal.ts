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

import { useEffect, useRef, useCallback, RefObject } from 'react';
import { TFile, TFolder, App } from 'obsidian';
import { useSettingsState } from '../context/SettingsContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useAutoReveal } from './useAutoReveal';
import { isTFolder } from '../utils/typeGuards';
import type { NavigationPaneHandle } from '../components/NavigationPane';
import type { FileListHandle } from '../components/FileList';

interface UseFileRevealOptions {
    app: App;
    navigationPaneRef: RefObject<NavigationPaneHandle | null>;
    fileListRef: RefObject<FileListHandle | null>;
}

/**
 * Custom hook that handles all file reveal logic, including:
 * - Manual reveal (via "Reveal file" command)
 * - Auto-reveal (on file open/startup)
 * - Folder expansion behavior
 * - Scroll management
 * 
 * This hook encapsulates the complex reveal logic that was previously
 * in the NotebookNavigatorComponent, making it reusable and testable.
 */
export function useFileReveal({ app, navigationPaneRef, fileListRef }: UseFileRevealOptions) {
    const settings = useSettingsState();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    
    /**
     * Internal implementation for revealing files.
     * 
     * @param file - The file to reveal
     * @param forceNavigateToFolder - If true, always navigates to the file's parent folder.
     *                                 If false, may preserve current folder when appropriate.
     */
    const revealFileInternal = useCallback((file: TFile, forceNavigateToFolder: boolean) => {
        if (!file || !file.parent) return;
        
        // Determine if we should preserve the current folder selection
        let preserveFolder = false;
        if (!forceNavigateToFolder && settings.showNotesFromSubfolders && selectionState.selectedFolder && file.parent) {
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
        const shouldExpandFolders = forceNavigateToFolder || !preserveFolder;
        
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
        
        // In single pane mode, switch to file list view
        if (uiState.singlePane && uiState.currentSinglePaneView === 'list') {
            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
        }
        
        // Only change focus if we're not already in the navigator AND not opening version history
        const navigatorEl = document.querySelector('.nn-split-container');
        const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);
        const isOpeningVersionHistory = window.notebookNavigatorOpeningVersionHistory;
        
        if (!hasNavigatorFocus && !isOpeningVersionHistory) {
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        }
    }, [settings.showNotesFromSubfolders, selectionState.selectedFolder, expansionState.expandedFolders, 
        expansionDispatch, selectionDispatch, uiState, uiDispatch]);
    
    /**
     * Navigates to the file's parent folder and reveals it.
     * Always expands folders to show the file's actual location.
     * Use this when the user explicitly wants to see where a file is located.
     * 
     * @param file - The file to navigate to
     */
    const navigateToFile = useCallback((file: TFile) => {
        revealFileInternal(file, true);
    }, [revealFileInternal]);
    
    /**
     * Reveals a file while trying to preserve the current folder view.
     * If "Show notes from subfolders" is enabled and the file is in a subfolder
     * of the current folder, it will keep the current folder selected.
     * Use this for auto-reveal scenarios to be less disruptive.
     * 
     * @param file - The file to reveal
     */
    const revealFileInCurrentView = useCallback((file: TFile) => {
        revealFileInternal(file, false);
    }, [revealFileInternal]);
    
    /**
     * Navigates to a folder by path, expanding ancestors and selecting it.
     * Used by the "Navigate to folder" command.
     * 
     * @param folderPath - The path of the folder to navigate to
     */
    const navigateToFolder = useCallback((folderPath: string) => {
        const folder = app.vault.getAbstractFileByPath(folderPath);
        if (!folder || !isTFolder(folder)) return;
        
        // Expand all ancestors to make the folder visible
        const foldersToExpand: string[] = [];
        let currentFolder: TFolder | null = folder.parent;
        
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
        
        // Select the folder
        selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });
        
        // In single pane mode, switch to file list view and focus files pane
        if (uiState.singlePane && uiState.currentSinglePaneView === 'list') {
            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
        }
        
        // Focus the folders pane
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
    }, [app, expansionState.expandedFolders, expansionDispatch, selectionDispatch, uiState, uiDispatch]);
    
    // Use auto-reveal hook to detect which file needs revealing
    const { fileToReveal } = useAutoReveal(app, {
        autoRevealActiveFile: settings.autoRevealActiveFile
    });
    
    // Handle revealing the file when detected by the hook
    useEffect(() => {
        if (fileToReveal) {
            revealFileInCurrentView(fileToReveal); // Auto-reveal preserves context
        }
    }, [fileToReveal, revealFileInCurrentView]);
    
    
    
    /**
     * Handle reveal scrolling after selection changes.
     * Folder expansion happens in the reveal functions BEFORE selection changes.
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
    }, [selectionState.isRevealOperation, selectionState.selectedFolder, selectionState.selectedFile, 
        navigationPaneRef, fileListRef]);
    
    return {
        navigateToFile,
        revealFileInCurrentView,
        navigateToFolder
    };
}