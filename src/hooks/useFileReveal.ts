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
import { useUIDispatch } from '../context/UIStateContext';
import { useAutoReveal } from './useAutoReveal';
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
    const uiDispatch = useUIDispatch();
    
    // Track previous showNotesFromSubfolders value
    const prevShowNotesFromSubfoldersRef = useRef(settings.showNotesFromSubfolders);
    
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
    const revealFile = useCallback((file: TFile, isManualReveal?: boolean) => {
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
    }, [settings.showNotesFromSubfolders, selectionState.selectedFolder, expansionState.expandedFolders, 
        expansionDispatch, selectionDispatch, uiDispatch]);
    
    // Use auto-reveal hook to detect which file needs revealing
    const { fileToReveal } = useAutoReveal(app, {
        autoRevealActiveFile: settings.autoRevealActiveFile
    });
    
    // Handle revealing the file when detected by the hook
    useEffect(() => {
        if (fileToReveal) {
            revealFile(fileToReveal, false); // Explicitly pass false for auto-reveal
        }
    }, [fileToReveal, revealFile]);
    
    // Handle revealing files that moved to a different folder
    useEffect(() => {
        if (selectionState.fileMovedToDifferentFolder) {
            revealFile(selectionState.fileMovedToDifferentFolder, true); // true for manual reveal
        }
    }, [selectionState.fileMovedToDifferentFolder, revealFile]);
    
    // Handle auto-reveal when showNotesFromSubfolders is toggled OFF
    useEffect(() => {
        const prevValue = prevShowNotesFromSubfoldersRef.current;
        const currentValue = settings.showNotesFromSubfolders;
        
        // Update ref for next render
        prevShowNotesFromSubfoldersRef.current = currentValue;
        
        // Only reveal when toggling from ON to OFF and auto-reveal is enabled
        if (prevValue && !currentValue && settings.autoRevealActiveFile) {
            const activeFile = app.workspace.getActiveFile();
            if (activeFile && selectionState.selectedFolder) {
                // Check if the active file is in a subfolder of the current selection
                let isInSubfolder = false;
                let currentParent: TFolder | null = activeFile.parent;
                
                while (currentParent) {
                    if (currentParent.path === selectionState.selectedFolder.path) {
                        isInSubfolder = true;
                        break;
                    }
                    currentParent = currentParent.parent;
                }
                
                // Only reveal if the file was in a subfolder (and thus no longer visible)
                if (isInSubfolder && activeFile.parent && activeFile.parent.path !== selectionState.selectedFolder.path) {
                    revealFile(activeFile, false); // false = auto-reveal
                }
            }
        }
    }, [settings.showNotesFromSubfolders, settings.autoRevealActiveFile, app, selectionState.selectedFolder, revealFile]);
    
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
        revealFile
    };
}