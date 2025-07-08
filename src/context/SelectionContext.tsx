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

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useRef } from 'react';
import { App, TFile, TFolder } from 'obsidian';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { useSettingsState } from './SettingsContext';
import { NotebookNavigatorSettings } from '../settings';
import { NavigationItemType, STORAGE_KEYS } from '../types';
import { NotebookNavigatorPlugin } from '../types/plugin';

// State interface
export interface SelectionState {
    selectionType: NavigationItemType;
    selectedFolder: TFolder | null;
    selectedTag: string | null;
    selectedFiles: Set<string>; // Changed from single file to Set of file paths
    anchorIndex: number | null; // Anchor position for multi-selection
    lastMovementDirection: 'up' | 'down' | null; // Track direction for expand/contract
    isRevealOperation: boolean; // Flag to track if the current selection is from a REVEAL_FILE action
    isFolderChangeWithAutoSelect: boolean; // Flag to track if we just changed folders and auto-selected a file
    isKeyboardNavigation: boolean; // Flag to track if selection is from Tab/Right arrow navigation
    
    // Computed property for backward compatibility
    selectedFile: TFile | null; // First file in selection or null
}

// Action types
export type SelectionAction = 
    | { type: 'SET_SELECTED_FOLDER'; folder: TFolder | null; autoSelectedFile?: TFile | null }
    | { type: 'SET_SELECTED_TAG'; tag: string | null; autoSelectedFile?: TFile | null }
    | { type: 'SET_SELECTED_FILE'; file: TFile | null }
    | { type: 'SET_SELECTION_TYPE'; selectionType: NavigationItemType }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'REVEAL_FILE'; file: TFile; preserveFolder?: boolean }
    | { type: 'CLEANUP_DELETED_FOLDER'; deletedPath: string }
    | { type: 'CLEANUP_DELETED_FILE'; deletedPath: string; nextFileToSelect?: TFile | null }
    // Multi-selection actions
    | { type: 'TOGGLE_FILE_SELECTION'; file: TFile; anchorIndex?: number }
    | { type: 'EXTEND_SELECTION'; toIndex: number; files: TFile[]; allFiles: TFile[] }
    | { type: 'CLEAR_FILE_SELECTION' }
    | { type: 'SET_ANCHOR_INDEX'; index: number | null }
    | { type: 'SET_MOVEMENT_DIRECTION'; direction: 'up' | 'down' | null }
    | { type: 'UPDATE_CURRENT_FILE'; file: TFile } // Update current file without changing selection
    | { type: 'TOGGLE_WITH_CURSOR'; file: TFile; anchorIndex?: number } // Toggle selection and update cursor
    | { type: 'SET_KEYBOARD_NAVIGATION'; isKeyboardNavigation: boolean } // Set keyboard navigation flag
    | { type: 'UPDATE_FILE_PATH'; oldPath: string; newPath: string }; // Update file path after rename

// Dispatch function type
export type SelectionDispatch = React.Dispatch<SelectionAction>;

// Create contexts
const SelectionContext = createContext<SelectionState | null>(null);
const SelectionDispatchContext = createContext<React.Dispatch<SelectionAction> | null>(null);

// Helper function to get first file from selection (for backward compatibility)
function getFirstSelectedFile(selectedFiles: Set<string>, app: App): TFile | null {
    if (selectedFiles.size === 0) return null;
    const firstPath = Array.from(selectedFiles)[0];
    const file = app.vault.getAbstractFileByPath(firstPath);
    return file instanceof TFile ? file : null;
}

/**
 * Selection state reducer - manages all selection-related state transitions.
 * 
 * Key concepts:
 * - selectedFiles: Set of file paths for multi-selection
 * - selectedFile: Current cursor position for keyboard navigation
 * - selectionType: Whether a folder or tag is selected
 * - Flags: isRevealOperation and isFolderChangeWithAutoSelect coordinate complex updates
 * 
 * State transitions:
 * - SET_SELECTED_FOLDER/TAG: Changes navigation context, optionally auto-selects first file
 * - TOGGLE_FILE_SELECTION: Adds/removes files from multi-selection
 * - TOGGLE_WITH_CURSOR: Updates both selection and cursor position
 * - UPDATE_CURRENT_FILE: Moves cursor without changing selection
 * - CLEAR_FILE_SELECTION: Resets to no selection
 * 
 * @param state Current selection state
 * @param action Action to perform
 * @param app Obsidian app instance for file operations
 * @returns New selection state
 */
function selectionReducer(state: SelectionState, action: SelectionAction, app?: App): SelectionState {
    switch (action.type) {
        case 'SET_SELECTED_FOLDER': {
            const newSelectedFiles = new Set<string>();
            if (action.autoSelectedFile) {
                newSelectedFiles.add(action.autoSelectedFile.path);
            }
            return {
                ...state,
                selectedFolder: action.folder,
                selectedTag: null,
                selectionType: 'folder',
                selectedFiles: newSelectedFiles,
                selectedFile: action.autoSelectedFile || null,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false
            };
        }
        
        case 'SET_SELECTED_TAG': {
            const newSelectedFiles = new Set<string>();
            if (action.autoSelectedFile) {
                newSelectedFiles.add(action.autoSelectedFile.path);
            }
            return {
                ...state,
                selectedTag: action.tag,
                selectedFolder: null,
                selectionType: 'tag',
                selectedFiles: newSelectedFiles,
                selectedFile: action.autoSelectedFile || null,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false
            };
        }
            
        case 'SET_SELECTED_FILE': {
            // Always clear selection and select only this file
            const newSelectedFiles = new Set<string>();
            if (action.file) {
                newSelectedFiles.add(action.file.path);
            }
            return { 
                ...state, 
                selectedFiles: newSelectedFiles,
                selectedFile: action.file,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false, 
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false 
            };
        }
        
        case 'SET_SELECTION_TYPE':
            return { ...state, selectionType: action.selectionType, isRevealOperation: false, isFolderChangeWithAutoSelect: false, isKeyboardNavigation: false };
        
        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedFolder: null,
                selectedTag: null,
                selectedFiles: new Set<string>(),
                selectedFile: null,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false
            };
        
        case 'REVEAL_FILE': {
            if (!action.file.parent) {
                return state;
            }
            
            // If preserveFolder is true and we have a selected folder, keep it
            const newFolder = action.preserveFolder && state.selectedFolder 
                ? state.selectedFolder 
                : action.file.parent;
            
            const newSelectedFiles = new Set<string>();
            newSelectedFiles.add(action.file.path);
            
            return {
                ...state,
                selectionType: 'folder',
                selectedFolder: newFolder,
                selectedTag: null,
                selectedFiles: newSelectedFiles,
                selectedFile: action.file,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: true,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false
            };
        }
        
        case 'CLEANUP_DELETED_FOLDER': {
            if (state.selectedFolder && state.selectedFolder.path === action.deletedPath) {
                return {
                    ...state,
                    selectedFolder: null,
                    selectedFiles: new Set<string>(),
                    selectedFile: null,
                    anchorIndex: null,
                    lastMovementDirection: null,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false
                };
            }
            return state;
        }
        
        case 'CLEANUP_DELETED_FILE': {
            const newSelectedFiles = new Set(state.selectedFiles);
            newSelectedFiles.delete(action.deletedPath);
            
            // If we deleted files from multi-selection, update anchor
            let newAnchorIndex = state.anchorIndex;
            if (state.anchorIndex !== null && newSelectedFiles.size === 0) {
                newAnchorIndex = null;
            }
            
            if (action.nextFileToSelect) {
                newSelectedFiles.add(action.nextFileToSelect.path);
            }
            
            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: action.nextFileToSelect || (app ? getFirstSelectedFile(newSelectedFiles, app) : null),
                anchorIndex: newAnchorIndex,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false
            };
        }
        
        // Multi-selection actions
        case 'TOGGLE_FILE_SELECTION': {
            const newSelectedFiles = new Set(state.selectedFiles);
            if (newSelectedFiles.has(action.file.path)) {
                newSelectedFiles.delete(action.file.path);
            } else {
                newSelectedFiles.add(action.file.path);
            }
            
            
            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: state.selectedFile, // Don't change cursor position when toggling
                anchorIndex: action.anchorIndex !== undefined ? action.anchorIndex : state.anchorIndex,
                lastMovementDirection: null
            };
        }
        
        case 'EXTEND_SELECTION': {
            const { toIndex, files, allFiles } = action;
            if (state.anchorIndex === null) return state;
            
            // This action should only select from anchor to current, not replace everything
            // For now, just select the range from anchor to toIndex
            const minIndex = Math.min(state.anchorIndex, toIndex);
            const maxIndex = Math.max(state.anchorIndex, toIndex);
            
            // Create new selection with files in range
            const newSelectedFiles = new Set<string>();
            for (let i = minIndex; i <= maxIndex && i < allFiles.length; i++) {
                if (allFiles[i]) {
                    newSelectedFiles.add(allFiles[i].path);
                }
            }
            
            
            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: allFiles[toIndex] || null,
                lastMovementDirection: null
            };
        }
        
        case 'CLEAR_FILE_SELECTION': {
            return {
                ...state,
                selectedFiles: new Set<string>(),
                selectedFile: null,
                anchorIndex: null,
                lastMovementDirection: null
            };
        }
        
        case 'SET_ANCHOR_INDEX': {
            return {
                ...state,
                anchorIndex: action.index
            };
        }
        
        case 'SET_MOVEMENT_DIRECTION': {
            return {
                ...state,
                lastMovementDirection: action.direction
            };
        }
        
        case 'UPDATE_CURRENT_FILE': {
            return {
                ...state,
                selectedFile: action.file
            };
        }
        
        case 'TOGGLE_WITH_CURSOR': {
            const newSelectedFiles = new Set(state.selectedFiles);
            if (newSelectedFiles.has(action.file.path)) {
                newSelectedFiles.delete(action.file.path);
            } else {
                newSelectedFiles.add(action.file.path);
            }
            
            
            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: action.file, // Always update cursor to the clicked file
                anchorIndex: action.anchorIndex !== undefined ? action.anchorIndex : state.anchorIndex,
                lastMovementDirection: null
            };
        }
        
        case 'SET_KEYBOARD_NAVIGATION': {
            return {
                ...state,
                isKeyboardNavigation: action.isKeyboardNavigation
            };
        }
        
        case 'UPDATE_FILE_PATH': {
            // Update the file path in selectedFiles set
            const newSelectedFiles = new Set(state.selectedFiles);
            if (newSelectedFiles.has(action.oldPath)) {
                newSelectedFiles.delete(action.oldPath);
                newSelectedFiles.add(action.newPath);
            }
            
            // Update selectedFile if it matches the renamed file
            let newSelectedFile = state.selectedFile;
            if (state.selectedFile && state.selectedFile.path === action.oldPath && app) {
                // Get the updated file reference from the vault
                const updatedFile = app.vault.getAbstractFileByPath(action.newPath);
                if (updatedFile && updatedFile instanceof TFile) {
                    newSelectedFile = updatedFile;
                }
            }
            
            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: newSelectedFile
            };
        }
        
        default:
            return state;
    }
}

// Provider component
interface SelectionProviderProps {
    children: ReactNode;
    app: App; // Obsidian App instance
    plugin: NotebookNavigatorPlugin; // Plugin instance for settings
    isMobile: boolean;
}

export function SelectionProvider({ children, app, plugin, isMobile }: SelectionProviderProps) {
    // Get current settings from SettingsContext
    const settings = useSettingsState();
    
    // Load initial state from localStorage and vault
    const loadInitialState = useCallback((): SelectionState => {
        const vault = app.vault;
        
        // Load saved folder path with error handling
        let savedFolderPath: string | null = null;
        try {
            savedFolderPath = localStorage.getItem(STORAGE_KEYS.selectedFolderKey);
        } catch (error) {
            console.error('Failed to load selected folder from localStorage:', error);
        }
        
        let selectedFolder: TFolder | null = null;
        if (savedFolderPath) {
            const folder = vault.getAbstractFileByPath(savedFolderPath);
            if (folder instanceof TFolder) {
                selectedFolder = folder;
            }
        }
        
        // Load saved file path with error handling
        let savedFilePath: string | null = null;
        try {
            savedFilePath = localStorage.getItem(STORAGE_KEYS.selectedFileKey);
        } catch (error) {
            console.error('Failed to load selected file from localStorage:', error);
        }
        
        let selectedFile: TFile | null = null;
        const selectedFiles = new Set<string>();
        if (savedFilePath) {
            const file = vault.getAbstractFileByPath(savedFilePath);
            if (file instanceof TFile) {
                selectedFile = file;
                selectedFiles.add(file.path);
            }
        }
        
        // Default to root folder if no selection
        if (!selectedFolder) {
            selectedFolder = vault.getRoot();
        }
        
        return {
            selectionType: 'folder',
            selectedFolder,
            selectedTag: null,
            selectedFiles,
            selectedFile,
            anchorIndex: null,
            lastMovementDirection: null,
            isRevealOperation: false,
            isFolderChangeWithAutoSelect: false,
            isKeyboardNavigation: false
        };
    }, [app.vault]);
    
    const [state, dispatch] = useReducer(
        (state: SelectionState, action: SelectionAction) => selectionReducer(state, action, app),
        undefined,
        loadInitialState
    );
    
    // Create an enhanced dispatch that handles side effects
    const enhancedDispatch = useCallback((action: SelectionAction) => {
        // Handle auto-select logic for folder selection
        if (action.type === 'SET_SELECTED_FOLDER' && action.autoSelectedFile === undefined) {
            // Clear multi-selection when changing folders
            dispatch({ type: 'CLEAR_FILE_SELECTION' });
            
            if (action.folder) {
                const filesInFolder = getFilesForFolder(action.folder, settings, app);
                
                // Desktop with autoSelectFirstFile enabled: ALWAYS select first file
                if (!isMobile && settings.autoSelectFirstFileOnFocusChange && filesInFolder.length > 0) {
                    dispatch({ ...action, autoSelectedFile: filesInFolder[0] });
                } else {
                    // Otherwise, check for active file
                    const activeFile = app.workspace.getActiveFile();
                    const activeFileInFolder = activeFile && filesInFolder.some(f => f.path === activeFile.path);
                    
                    if (activeFileInFolder) {
                        // Select the active file if it's in the folder (mobile always, desktop when autoSelect is off)
                        dispatch({ ...action, autoSelectedFile: activeFile });
                    } else {
                        // No auto-selection
                        dispatch({ ...action, autoSelectedFile: null });
                    }
                }
            } else {
                dispatch({ ...action, autoSelectedFile: null });
            }
        }
        // Handle auto-select logic for tag selection
        else if (action.type === 'SET_SELECTED_TAG' && action.autoSelectedFile === undefined) {
            // Clear multi-selection when changing tags
            dispatch({ type: 'CLEAR_FILE_SELECTION' });
            
            if (action.tag) {
                const filesForTag = getFilesForTag(action.tag, settings, app);
                
                // Desktop with autoSelectFirstFile enabled: ALWAYS select first file
                if (!isMobile && settings.autoSelectFirstFileOnFocusChange && filesForTag.length > 0) {
                    dispatch({ ...action, autoSelectedFile: filesForTag[0] });
                } else {
                    // Otherwise, check for active file
                    const activeFile = app.workspace.getActiveFile();
                    const activeFileInTag = activeFile && filesForTag.some(f => f.path === activeFile.path);
                    
                    if (activeFileInTag) {
                        // Select the active file if it's in the tag view (mobile always, desktop when autoSelect is off)
                        dispatch({ ...action, autoSelectedFile: activeFile });
                    } else {
                        // No auto-selection
                        dispatch({ ...action, autoSelectedFile: null });
                    }
                }
            } else {
                dispatch({ ...action, autoSelectedFile: null });
            }
        }
        // Handle cleanup for deleted files on mobile
        else if (action.type === 'CLEANUP_DELETED_FILE' && isMobile) {
            // On mobile, never auto-select next file
            dispatch({ ...action, nextFileToSelect: null });
        }
        // For all other actions, dispatch as-is
        else {
            dispatch(action);
        }
    }, [app, settings, isMobile, dispatch]);
    
    // Persist selected folder to localStorage with error handling
    useEffect(() => {
        try {
            if (state.selectedFolder) {
                localStorage.setItem(STORAGE_KEYS.selectedFolderKey, state.selectedFolder.path);
            } else {
                localStorage.removeItem(STORAGE_KEYS.selectedFolderKey);
            }
        } catch (error) {
            console.error('Failed to save selected folder to localStorage:', error);
        }
    }, [state.selectedFolder]);
    
    // Persist selected file to localStorage with error handling
    useEffect(() => {
        try {
            // Save the first selected file for backward compatibility
            const firstFile = state.selectedFile || getFirstSelectedFile(state.selectedFiles, app);
            if (firstFile) {
                localStorage.setItem(STORAGE_KEYS.selectedFileKey, firstFile.path);
            } else {
                localStorage.removeItem(STORAGE_KEYS.selectedFileKey);
            }
        } catch (error) {
            console.error('Failed to save selected file to localStorage:', error);
        }
    }, [state.selectedFile, state.selectedFiles, app]);
    
    // Register file rename listener
    useEffect(() => {
        const listenerId = 'selection-context-' + Math.random().toString(36).substr(2, 9);
        
        const handleFileRename = (oldPath: string, newPath: string) => {
            dispatch({ type: 'UPDATE_FILE_PATH', oldPath, newPath });
        };
        
        plugin.registerFileRenameListener(listenerId, handleFileRename);
        
        return () => {
            plugin.unregisterFileRenameListener(listenerId);
        };
    }, [plugin, dispatch]);
    
    return (
        <SelectionContext.Provider value={state}>
            <SelectionDispatchContext.Provider value={enhancedDispatch}>
                {children}
            </SelectionDispatchContext.Provider>
        </SelectionContext.Provider>
    );
}

// Custom hooks
export function useSelectionState() {
    const context = useContext(SelectionContext);
    if (!context) {
        throw new Error('useSelectionState must be used within SelectionProvider');
    }
    return context;
}

export function useSelectionDispatch() {
    const context = useContext(SelectionDispatchContext);
    if (!context) {
        throw new Error('useSelectionDispatch must be used within SelectionProvider');
    }
    return context;
}