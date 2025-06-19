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
import { TFile, TFolder } from 'obsidian';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { useSettingsState } from './SettingsContext';
import { NotebookNavigatorSettings } from '../settings';
import { debugLog } from '../utils/debugLog';

// Storage keys
const STORAGE_KEYS = {
    SELECTED_FOLDER: 'notebook-navigator-selected-folder',
    SELECTED_FILE: 'notebook-navigator-selected-file'
};

// State interface
interface SelectionState {
    selectionType: 'folder' | 'tag';
    selectedFolder: TFolder | null;
    selectedTag: string | null;
    selectedFile: TFile | null;
    isRevealOperation: boolean; // Flag to track if the current selection is from a REVEAL_FILE action
    isFolderChangeWithAutoSelect: boolean; // Flag to track if we just changed folders and auto-selected a file
}

// Action types
type SelectionAction = 
    | { type: 'SET_SELECTED_FOLDER'; folder: TFolder | null; autoSelectedFile?: TFile | null }
    | { type: 'SET_SELECTED_TAG'; tag: string | null; autoSelectedFile?: TFile | null }
    | { type: 'SET_SELECTED_FILE'; file: TFile | null }
    | { type: 'SET_SELECTION_TYPE'; selectionType: 'folder' | 'tag' }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'REVEAL_FILE'; file: TFile }
    | { type: 'CLEANUP_DELETED_FOLDER'; deletedPath: string }
    | { type: 'CLEANUP_DELETED_FILE'; deletedPath: string; nextFileToSelect?: TFile | null };

// Create contexts
const SelectionContext = createContext<SelectionState | null>(null);
const SelectionDispatchContext = createContext<React.Dispatch<SelectionAction> | null>(null);

// Pure reducer function - no side effects or external dependencies
function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
    switch (action.type) {
        case 'SET_SELECTED_FOLDER': {
            return {
                ...state,
                selectedFolder: action.folder,
                selectedTag: null,
                selectionType: 'folder',
                selectedFile: action.autoSelectedFile !== undefined ? action.autoSelectedFile : state.selectedFile,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null
            };
        }
        
        case 'SET_SELECTED_TAG': {
            return {
                ...state,
                selectedTag: action.tag,
                selectedFolder: null,
                selectionType: 'tag',
                selectedFile: action.autoSelectedFile !== undefined ? action.autoSelectedFile : state.selectedFile,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null
            };
        }
            
        case 'SET_SELECTED_FILE':
            return { ...state, selectedFile: action.file, isRevealOperation: false, isFolderChangeWithAutoSelect: false };
        
        case 'SET_SELECTION_TYPE':
            return { ...state, selectionType: action.selectionType, isRevealOperation: false, isFolderChangeWithAutoSelect: false };
        
        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedFolder: null,
                selectedTag: null,
                selectedFile: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: false
            };
        
        case 'REVEAL_FILE': {
            if (!action.file.parent) {
                return state;
            }
            
            return {
                ...state,
                selectionType: 'folder',
                selectedFolder: action.file.parent,
                selectedTag: null,
                selectedFile: action.file,
                isRevealOperation: true,
                isFolderChangeWithAutoSelect: false
            };
        }
        
        case 'CLEANUP_DELETED_FOLDER': {
            if (state.selectedFolder && state.selectedFolder.path === action.deletedPath) {
                return {
                    ...state,
                    selectedFolder: null,
                    selectedFile: null,
                    isFolderChangeWithAutoSelect: false
                };
            }
            return state;
        }
        
        case 'CLEANUP_DELETED_FILE': {
            if (state.selectedFile && state.selectedFile.path === action.deletedPath) {
                return {
                    ...state,
                    selectedFile: action.nextFileToSelect !== undefined ? action.nextFileToSelect : null,
                    isFolderChangeWithAutoSelect: false
                };
            }
            return state;
        }
        
        default:
            return state;
    }
}

// Provider component
interface SelectionProviderProps {
    children: ReactNode;
    app: any; // Obsidian App instance
    plugin: any; // Plugin instance for settings
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
            savedFolderPath = localStorage.getItem(STORAGE_KEYS.SELECTED_FOLDER);
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
            savedFilePath = localStorage.getItem(STORAGE_KEYS.SELECTED_FILE);
        } catch (error) {
            console.error('Failed to load selected file from localStorage:', error);
        }
        
        let selectedFile: TFile | null = null;
        if (savedFilePath) {
            const file = vault.getAbstractFileByPath(savedFilePath);
            if (file instanceof TFile) {
                selectedFile = file;
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
            selectedFile,
            isRevealOperation: false,
            isFolderChangeWithAutoSelect: false
        };
    }, [app.vault]);
    
    const [state, dispatch] = useReducer(selectionReducer, undefined, loadInitialState);
    
    // Create an enhanced dispatch that handles side effects
    const enhancedDispatch = useCallback((action: SelectionAction) => {
        debugLog.debug('[SelectionContext] Action dispatched:', {
            type: action.type,
            folder: (action as any).folder?.path,
            tag: (action as any).tag,
            file: (action as any).file?.path,
            autoSelectFirstFile: settings.autoSelectFirstFile,
            isMobile
        });
        
        // Handle auto-select logic for folder selection
        if (action.type === 'SET_SELECTED_FOLDER' && !isMobile && action.autoSelectedFile === undefined) {
            if (action.folder && settings.autoSelectFirstFile) {
                const filesInFolder = getFilesForFolder(action.folder, settings, app);
                const autoSelectedFile = filesInFolder.length > 0 ? filesInFolder[0] : null;
                debugLog.debug('[SelectionContext] Auto-selecting file for folder:', {
                    folder: action.folder.path,
                    autoSelectedFile: autoSelectedFile?.path,
                    filesCount: filesInFolder.length
                });
                dispatch({ ...action, autoSelectedFile });
            } else {
                dispatch({ ...action, autoSelectedFile: null });
            }
        }
        // Handle auto-select logic for tag selection
        else if (action.type === 'SET_SELECTED_TAG' && !isMobile && action.autoSelectedFile === undefined) {
            if (action.tag && settings.autoSelectFirstFile) {
                const filesForTag = getFilesForTag(action.tag, settings, app);
                const autoSelectedFile = filesForTag.length > 0 ? filesForTag[0] : null;
                dispatch({ ...action, autoSelectedFile });
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
                localStorage.setItem(STORAGE_KEYS.SELECTED_FOLDER, state.selectedFolder.path);
            } else {
                localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
            }
        } catch (error) {
            console.error('Failed to save selected folder to localStorage:', error);
        }
    }, [state.selectedFolder]);
    
    // Persist selected file to localStorage with error handling
    useEffect(() => {
        try {
            if (state.selectedFile) {
                localStorage.setItem(STORAGE_KEYS.SELECTED_FILE, state.selectedFile.path);
            } else {
                localStorage.removeItem(STORAGE_KEYS.SELECTED_FILE);
            }
        } catch (error) {
            console.error('Failed to save selected file to localStorage:', error);
        }
    }, [state.selectedFile]);
    
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