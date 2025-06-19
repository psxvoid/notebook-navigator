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

import { useEffect, useReducer } from 'react';
import { TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useUIDispatch } from '../context/UIStateContext';
import { autoRevealReducer, initialAutoRevealState, shouldAutoReveal } from '../reducers/autoRevealReducer';
import { isTFolder } from '../utils/typeGuards';

/**
 * Custom hook that manages the auto-reveal functionality for the active file.
 * This hook listens to workspace events and automatically reveals the active file
 * in the navigator, expanding folders and scrolling as needed.
 * 
 * @param settings - Plugin settings containing autoRevealActiveFile and showNotesFromSubfolders flags
 * @returns The auto-reveal dispatch function for manual control
 */
export function useAutoReveal(settings: { autoRevealActiveFile: boolean; showNotesFromSubfolders: boolean }) {
    const { app } = useServices();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const uiDispatch = useUIDispatch();
    const [autoRevealState, autoRevealDispatch] = useReducer(autoRevealReducer, initialAutoRevealState);

    // Effect for handling active file changes
    useEffect(() => {
        if (!settings.autoRevealActiveFile) return;

        const handleFileChange = (file: TFile | null) => {
            if (!file) return;
            
            // Check if this is a file we just created via the plugin
            const creatingFilePath = (app.workspace as any).notebookNavigatorCreatingFile;
            const isNewlyCreatedFile = creatingFilePath && file.path === creatingFilePath;
            
            // Check if auto-reveal should proceed
            if (!shouldAutoReveal(autoRevealState, isNewlyCreatedFile)) {
                return;
            }
            
            // For newly created files, handle them specially
            if (isNewlyCreatedFile && file.parent) {
                // Check if we've already revealed this file
                if (!autoRevealState.revealedFiles.has(file.path)) {
                    autoRevealDispatch({ type: 'REVEAL_FILE_START', file });
                    
                    // Always reveal newly created files
                    selectionDispatch({ type: 'REVEAL_FILE', file });
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    
                    // Cleanup tracking after creation flag timeout
                    setTimeout(() => {
                        autoRevealDispatch({ type: 'CLEAR_REVEALED_FILE', filePath: file.path });
                    }, 1000);
                    
                    autoRevealDispatch({ type: 'REVEAL_FILE_END', filePath: file.path });
                }
                return; // Don't process normal reveal logic for new files
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
                    if (settings.showNotesFromSubfolders) {
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
                    
                    // Trigger the reveal - scrolling will happen via the reveal effect
                    selectionDispatch({ type: 'REVEAL_FILE', file });
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                }
            }
        };

        const handleActiveLeafChange = (leaf: WorkspaceLeaf | null) => {
            if (!leaf) return;
            
            // Only process leaves in the main editor area
            if (leaf.getRoot() !== app.workspace.rootSplit) {
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
        
        // Check for currently active file on mount
        const activeFile = app.workspace.getActiveFile();
        if (activeFile) {
            handleFileChange(activeFile);
        }

        return () => {
            app.workspace.offref(activeLeafEventRef);
            app.workspace.offref(fileOpenEventRef);
        };
    }, [
        app.workspace,
        selectionDispatch,
        expansionDispatch,
        uiDispatch,
        settings.autoRevealActiveFile,
        settings.showNotesFromSubfolders,
        selectionState,
        expansionState.expandedFolders,
        autoRevealState
    ]);

    return autoRevealDispatch;
}