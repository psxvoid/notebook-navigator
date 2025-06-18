import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { TFile, TFolder } from 'obsidian';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { useSettingsState } from './SettingsContext';
import { NotebookNavigatorSettings } from '../settings';

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
}

// Action types
type SelectionAction = 
    | { type: 'SET_SELECTED_FOLDER'; folder: TFolder | null }
    | { type: 'SET_SELECTED_TAG'; tag: string | null }
    | { type: 'SET_SELECTED_FILE'; file: TFile | null }
    | { type: 'SET_SELECTION_TYPE'; selectionType: 'folder' | 'tag' }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'REVEAL_FILE'; file: TFile }
    | { type: 'CLEANUP_DELETED_FOLDER'; deletedPath: string }
    | { type: 'CLEANUP_DELETED_FILE'; deletedPath: string; nextFileToSelect?: TFile | null };

// Create contexts
const SelectionContext = createContext<SelectionState | null>(null);
const SelectionDispatchContext = createContext<React.Dispatch<SelectionAction> | null>(null);

// Pure reducer function that accepts settings as a parameter
function selectionReducer(
    state: SelectionState, 
    action: SelectionAction, 
    settings: NotebookNavigatorSettings, 
    app: any, 
    isMobile: boolean
): SelectionState {
    switch (action.type) {
        case 'SET_SELECTED_FOLDER': {
            const newState: SelectionState = {
                ...state,
                selectedFolder: action.folder,
                selectedTag: null,
                selectionType: 'folder',
                isRevealOperation: false // Clear flag for normal navigation
            };

            // Mobile: Clear selected file when changing folders
            // No auto-selection on mobile
            if (isMobile) {
                newState.selectedFile = null;
            }
            // Desktop: Handle auto-select first file if enabled
            else if (action.folder && settings.autoSelectFirstFile) {
                const filesInFolder = getFilesForFolder(action.folder, settings, app);
                if (filesInFolder.length > 0) {
                    newState.selectedFile = filesInFolder[0];
                } else {
                    newState.selectedFile = null;
                }
            } else if (!action.folder) {
                newState.selectedFile = null;
            }

            return newState;
        }
        
        case 'SET_SELECTED_TAG': {
            const newState: SelectionState = {
                ...state,
                selectedTag: action.tag,
                selectedFolder: null,
                selectionType: 'tag',
                isRevealOperation: false // Clear flag for normal navigation
            };

            // Mobile: Keep the selected file when changing tags
            // The file list will handle scrolling to it if it exists in the new tag
            if (isMobile) {
                // Don't clear selectedFile - keep it as is
            }
            // Desktop: Handle auto-select first file if enabled
            else if (action.tag && settings.autoSelectFirstFile) {
                const filesForTag = getFilesForTag(action.tag, settings, app);
                if (filesForTag.length > 0) {
                    newState.selectedFile = filesForTag[0];
                } else {
                    newState.selectedFile = null;
                }
            } else if (!action.tag) {
                newState.selectedFile = null;
            }

            return newState;
        }
            
        case 'SET_SELECTED_FILE':
            return { ...state, selectedFile: action.file, isRevealOperation: false };
        
        case 'SET_SELECTION_TYPE':
            return { ...state, selectionType: action.selectionType, isRevealOperation: false };
        
        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedFolder: null,
                selectedTag: null,
                selectedFile: null,
                isRevealOperation: false
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
                isRevealOperation: true // Set flag to indicate this is a reveal operation
            };
        }
        
        case 'CLEANUP_DELETED_FOLDER': {
            const newState = { ...state };
            
            // Clear selected folder if it was deleted
            if (state.selectedFolder && state.selectedFolder.path === action.deletedPath) {
                newState.selectedFolder = null;
                newState.selectedFile = null; // Also clear file selection
            }
            
            return newState;
        }
        
        case 'CLEANUP_DELETED_FILE': {
            const newState = { ...state };
            
            // Clear selected file if it was deleted
            if (state.selectedFile && state.selectedFile.path === action.deletedPath) {
                // If a next file to select was provided and we're not on mobile, select it
                if (action.nextFileToSelect !== undefined && !isMobile) {
                    newState.selectedFile = action.nextFileToSelect;
                } else {
                    newState.selectedFile = null;
                }
            }
            
            return newState;
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
        
        // Load saved folder path
        const savedFolderPath = localStorage.getItem(STORAGE_KEYS.SELECTED_FOLDER);
        let selectedFolder: TFolder | null = null;
        if (savedFolderPath) {
            const folder = vault.getAbstractFileByPath(savedFolderPath);
            if (folder instanceof TFolder) {
                selectedFolder = folder;
            }
        }
        
        // Load saved file path
        const savedFilePath = localStorage.getItem(STORAGE_KEYS.SELECTED_FILE);
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
            isRevealOperation: false
        };
    }, [app.vault]);
    
    // Wrap the reducer with useCallback to recreate it when settings change
    const reducer = useCallback((state: SelectionState, action: SelectionAction) => {
        return selectionReducer(state, action, settings, app, isMobile);
    }, [settings, app, isMobile]);
    
    const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
    
    // Persist selected folder to localStorage
    useEffect(() => {
        if (state.selectedFolder) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_FOLDER, state.selectedFolder.path);
        } else {
            localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
        }
    }, [state.selectedFolder]);
    
    // Persist selected file to localStorage
    useEffect(() => {
        if (state.selectedFile) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_FILE, state.selectedFile.path);
        } else {
            localStorage.removeItem(STORAGE_KEYS.SELECTED_FILE);
        }
    }, [state.selectedFile]);
    
    return (
        <SelectionContext.Provider value={state}>
            <SelectionDispatchContext.Provider value={dispatch}>
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