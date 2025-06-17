import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { TFile, TFolder } from 'obsidian';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';

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
}

// Action types
type SelectionAction = 
    | { type: 'SET_SELECTED_FOLDER'; folder: TFolder | null }
    | { type: 'SET_SELECTED_TAG'; tag: string | null }
    | { type: 'SET_SELECTED_FILE'; file: TFile | null }
    | { type: 'SET_SELECTION_TYPE'; selectionType: 'folder' | 'tag' }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'REVEAL_FILE'; file: TFile };

// Create contexts
const SelectionContext = createContext<SelectionState | null>(null);
const SelectionDispatchContext = createContext<React.Dispatch<SelectionAction> | null>(null);

// Helper to create a reducer with dependencies
function createSelectionReducer(plugin: any, app: any, isMobile: boolean) {
    return function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
        switch (action.type) {
            case 'SET_SELECTED_FOLDER': {
                const newState: SelectionState = {
                    ...state,
                    selectedFolder: action.folder,
                    selectedTag: null,
                    selectionType: 'folder'
                };

                // Mobile: Always clear file selection when changing folders
                if (isMobile) {
                    newState.selectedFile = null;
                }
                // Desktop: Handle auto-select first file if enabled
                else if (action.folder && plugin.settings.autoSelectFirstFile) {
                    const filesInFolder = getFilesForFolder(action.folder, plugin.settings, app);
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
                    selectionType: 'tag'
                };

                // Mobile: Always clear file selection when changing tags
                if (isMobile) {
                    newState.selectedFile = null;
                }
                // Desktop: Handle auto-select first file if enabled
                else if (action.tag && plugin.settings.autoSelectFirstFile) {
                    const filesForTag = getFilesForTag(action.tag, plugin.settings, app);
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
                return { ...state, selectedFile: action.file };
            
            case 'SET_SELECTION_TYPE':
                return { ...state, selectionType: action.selectionType };
            
            case 'CLEAR_SELECTION':
                return {
                    ...state,
                    selectedFolder: null,
                    selectedTag: null,
                    selectedFile: null
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
                    selectedFile: action.file
                };
            }
            
            default:
                return state;
        }
    };
}

// Provider component
interface SelectionProviderProps {
    children: ReactNode;
    app: any; // Obsidian App instance
    plugin: any; // Plugin instance for settings
    isMobile: boolean;
}

export function SelectionProvider({ children, app, plugin, isMobile }: SelectionProviderProps) {
    // Load initial state from localStorage and vault
    const loadInitialState = (): SelectionState => {
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
            selectedFile
        };
    };
    
    const reducer = createSelectionReducer(plugin, app, isMobile);
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