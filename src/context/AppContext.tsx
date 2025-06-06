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

// src/context/AppContext.tsx
import React, { createContext, useContext, useMemo, useEffect, useReducer } from 'react';
import { App, TFile, TFolder } from 'obsidian';
import NotebookNavigatorPlugin from '../main';
import { isTFolder } from '../utils/typeGuards';

/**
 * Global application state interface.
 * Manages the current state of the Notebook Navigator plugin.
 */
export interface AppState {
    /** Currently selected folder in the folder tree */
    selectedFolder: TFolder | null;
    /** Currently selected file in the file list */
    selectedFile: TFile | null;
    /** Set of folder paths that are currently expanded in the tree */
    expandedFolders: Set<string>;
    /** Which pane currently has keyboard focus */
    focusedPane: 'folders' | 'files';
}

/**
 * Discriminated union of all possible actions that can be dispatched
 * to modify the application state.
 */
export type AppAction = 
    | { type: 'SET_SELECTED_FOLDER'; folder: TFolder | null }
    | { type: 'SET_SELECTED_FILE'; file: TFile | null }
    | { type: 'SET_EXPANDED_FOLDERS'; folders: Set<string> }
    | { type: 'TOGGLE_FOLDER_EXPANDED'; folderPath: string }
    | { type: 'SET_FOCUSED_PANE'; pane: 'folders' | 'files' }
    | { type: 'EXPAND_FOLDERS'; folderPaths: string[] }
    | { type: 'REVEAL_FILE'; file: TFile }
    | { type: 'CLEANUP_DELETED_ITEMS' }
    | { type: 'FORCE_REFRESH' };

/**
 * Context value type containing all app-level data and functions
 * available to child components.
 */
interface AppContextType {
    /** Obsidian App instance */
    app: App;
    /** Plugin instance with settings and methods */
    plugin: NotebookNavigatorPlugin;
    /** Current application state */
    appState: AppState;
    /** Dispatch function to update state */
    dispatch: React.Dispatch<AppAction>;
    /** Counter that increments to force component re-renders */
    refreshCounter: number;
}

/**
 * The main application context that provides global state and functions.
 * The null! assertion is safe because we always wrap components with AppProvider.
 */
const AppContext = createContext<AppContextType>(null!);

/**
 * LocalStorage keys for persisting state across sessions.
 * These keys are used to save and restore the plugin state.
 */
const STORAGE_KEYS = {
    /** Key for storing expanded folder paths */
    expandedFolders: 'notebook-navigator-expanded-folders',
    /** Key for storing selected folder path */
    selectedFolder: 'notebook-navigator-selected-folder',
    /** Key for storing selected file path */
    selectedFile: 'notebook-navigator-selected-file'
};

/**
 * Loads the application state from localStorage.
 * Validates that files and folders still exist in the vault.
 * 
 * @param app - The Obsidian App instance
 * @returns The restored AppState with validated references
 */
function loadStateFromStorage(app: App): AppState {
    const expandedFoldersData = localStorage.getItem(STORAGE_KEYS.expandedFolders);
    const selectedFolderPath = localStorage.getItem(STORAGE_KEYS.selectedFolder);
    const selectedFilePath = localStorage.getItem(STORAGE_KEYS.selectedFile);
    
    let expandedFolders = new Set<string>();
    try {
        if (expandedFoldersData) {
            const parsed = JSON.parse(expandedFoldersData);
            if (Array.isArray(parsed)) {
                expandedFolders = new Set(parsed);
            }
        }
    } catch (e) {
        console.error('Failed to parse expanded folders:', e);
    }
    
    let selectedFolder: TFolder | null = null;
    if (selectedFolderPath) {
        const folder = app.vault.getAbstractFileByPath(selectedFolderPath);
        if (isTFolder(folder)) {
            selectedFolder = folder;
        }
    }
    
    let selectedFile: TFile | null = null;
    if (selectedFilePath) {
        const file = app.vault.getAbstractFileByPath(selectedFilePath);
        if (file && 'extension' in file) {
            selectedFile = file as TFile;
        }
    }
    
    return {
        selectedFolder,
        selectedFile,
        expandedFolders,
        focusedPane: 'folders',
    };
}

/**
 * Saves a specific state value to localStorage.
 * Handles serialization for complex types like Sets.
 * 
 * @param key - The localStorage key to save to
 * @param value - The value to save (will be serialized if needed)
 */
function saveToStorage(key: string, value: any) {
    try {
        if (key === STORAGE_KEYS.expandedFolders) {
            localStorage.setItem(key, JSON.stringify(Array.from(value)));
        } else {
            localStorage.setItem(key, value || '');
        }
    } catch (e) {
        console.error(`Failed to save ${key} to localStorage:`, e);
    }
}

/**
 * Main reducer function that handles all state updates.
 * Each action type modifies the state and persists changes to localStorage.
 * 
 * @param state - Current application state
 * @param action - The action to process
 * @param app - The Obsidian App instance for vault operations
 * @returns The new state after applying the action
 */
function appReducer(state: AppState, action: AppAction, app: App): AppState {
    switch (action.type) {
        case 'SET_SELECTED_FOLDER': {
            // Update the selected folder and persist to localStorage
            const newState = { ...state, selectedFolder: action.folder };
            saveToStorage(STORAGE_KEYS.selectedFolder, action.folder?.path);
            return newState;
        }
        
        case 'SET_SELECTED_FILE': {
            // Update the selected file and persist to localStorage
            const newState = { ...state, selectedFile: action.file };
            saveToStorage(STORAGE_KEYS.selectedFile, action.file?.path);
            return newState;
        }
        
        case 'SET_EXPANDED_FOLDERS': {
            // Replace all expanded folders (used for bulk operations)
            const newState = { ...state, expandedFolders: action.folders };
            saveToStorage(STORAGE_KEYS.expandedFolders, action.folders);
            return newState;
        }
        
        case 'TOGGLE_FOLDER_EXPANDED': {
            // Toggle a single folder's expanded state
            const newExpanded = new Set(state.expandedFolders);
            if (newExpanded.has(action.folderPath)) {
                newExpanded.delete(action.folderPath);
            } else {
                newExpanded.add(action.folderPath);
            }
            saveToStorage(STORAGE_KEYS.expandedFolders, newExpanded);
            return { ...state, expandedFolders: newExpanded };
        }
        
        case 'SET_FOCUSED_PANE': {
            // Update which pane has keyboard focus (no persistence needed)
            return { ...state, focusedPane: action.pane };
        }
        
        case 'EXPAND_FOLDERS': {
            // Expand multiple folders at once (additive, doesn't collapse others)
            const newExpanded = new Set([...state.expandedFolders, ...action.folderPaths]);
            saveToStorage(STORAGE_KEYS.expandedFolders, newExpanded);
            return { ...state, expandedFolders: newExpanded };
        }
        
        case 'REVEAL_FILE': {
            // Reveal a file in the navigator by expanding all parent folders
            if (!action.file.parent) return state;
            
            // Get all parent folders up to root
            const foldersToExpand: string[] = [];
            let currentFolder = action.file.parent;
            while (currentFolder && currentFolder.path !== '/') {
                foldersToExpand.unshift(currentFolder.path);
                currentFolder = currentFolder.parent;
            }
            
            // Expand all parent folders, select the file and its parent folder
            const newExpanded = new Set([...state.expandedFolders, ...foldersToExpand]);
            saveToStorage(STORAGE_KEYS.expandedFolders, newExpanded);
            saveToStorage(STORAGE_KEYS.selectedFolder, action.file.parent.path);
            saveToStorage(STORAGE_KEYS.selectedFile, action.file.path);
            
            return {
                ...state,
                expandedFolders: newExpanded,
                selectedFolder: action.file.parent,
                selectedFile: action.file,
                focusedPane: 'files'
            };
        }
        
        case 'CLEANUP_DELETED_ITEMS': {
            // Remove references to deleted files/folders from state
            let newState = { ...state };
            let changed = false;
            
            // Check if selected file still exists
            if (state.selectedFile && !app.vault.getAbstractFileByPath(state.selectedFile.path)) {
                newState.selectedFile = null;
                saveToStorage(STORAGE_KEYS.selectedFile, '');
                changed = true;
            }
            
            // Check if selected folder still exists
            if (state.selectedFolder && !app.vault.getAbstractFileByPath(state.selectedFolder.path)) {
                newState.selectedFolder = null;
                saveToStorage(STORAGE_KEYS.selectedFolder, '');
                changed = true;
            }
            
            // Clean up expanded folders that no longer exist
            const validExpandedFolders = new Set<string>();
            state.expandedFolders.forEach(path => {
                if (app.vault.getAbstractFileByPath(path)) {
                    validExpandedFolders.add(path);
                } else {
                    changed = true;
                }
            });
            
            if (changed) {
                newState.expandedFolders = validExpandedFolders;
                saveToStorage(STORAGE_KEYS.expandedFolders, validExpandedFolders);
            }
            
            return changed ? newState : state;
        }
        
        case 'FORCE_REFRESH': {
            // Force a re-render by returning a new state object
            // The actual refresh is triggered by incrementing refreshCounter in the wrapped dispatch
            return { ...state };
        }
        
        default:
            return state;
    }
}

/**
 * Context provider component that wraps the entire plugin UI.
 * Manages global state, handles vault events, and provides context to all child components.
 * 
 * @param props - Component props
 * @param props.children - Child components to render
 * @param props.plugin - The NotebookNavigatorPlugin instance
 */
export function AppProvider({ children, plugin }: { children: React.ReactNode, plugin: NotebookNavigatorPlugin }) {
    const { app } = plugin;

    /**
     * Initialize state with useReducer, loading initial state from localStorage.
     * The reducer is wrapped to include the app instance for vault operations.
     */
    const [appState, baseDispatch] = useReducer(
        (state: AppState, action: AppAction) => appReducer(state, action, app),
        null,
        () => loadStateFromStorage(app)
    );
    
    /**
     * Counter that forces re-renders when incremented.
     * Used to refresh the UI after vault changes.
     */
    const [refreshCounter, setRefreshCounter] = React.useState(0);
    
    /**
     * Wrapped dispatch function that handles FORCE_REFRESH actions specially.
     * FORCE_REFRESH increments the refresh counter to trigger re-renders.
     */
    const dispatch = useMemo(() => {
        return (action: AppAction) => {
            if (action.type === 'FORCE_REFRESH') {
                setRefreshCounter(c => c + 1);
            }
            baseDispatch(action);
        };
    }, []);
    
    /**
     * Effect that subscribes to vault events and triggers UI updates.
     * Events are debounced to prevent excessive re-renders.
     */
    useEffect(() => {
        let createTimeout: NodeJS.Timeout;
        let deleteTimeout: NodeJS.Timeout;
        let renameTimeout: NodeJS.Timeout;
        let modifyTimeout: NodeJS.Timeout;
        
        /**
         * Handle file/folder creation events.
         * Debounced to avoid excessive re-renders during bulk operations.
         */
        const handleCreate = () => {
            clearTimeout(createTimeout);
            createTimeout = setTimeout(() => {
                setRefreshCounter(c => c + 1);
            }, 50);
        };
        
        /**
         * Handle file/folder deletion events.
         * Cleans up state references and triggers UI refresh.
         */
        const handleDelete = () => {
            clearTimeout(deleteTimeout);
            deleteTimeout = setTimeout(() => {
                dispatch({ type: 'CLEANUP_DELETED_ITEMS' });
                setRefreshCounter(c => c + 1);
            }, 50);
        };
        
        /**
         * Handle file/folder rename events.
         * Treats renames as delete + create, so cleanup is needed.
         */
        const handleRename = () => {
            clearTimeout(renameTimeout);
            renameTimeout = setTimeout(() => {
                dispatch({ type: 'CLEANUP_DELETED_ITEMS' });
                setRefreshCounter(c => c + 1);
            }, 50);
        };
        
        /**
         * Handle file modification events.
         * Uses longer debounce since modifications happen frequently.
         */
        const handleModify = () => {
            clearTimeout(modifyTimeout);
            modifyTimeout = setTimeout(() => {
                setRefreshCounter(c => c + 1);
            }, 200); // Longer debounce for modifications
        };
        
        // Register event handlers
        app.vault.on('create', handleCreate);
        app.vault.on('delete', handleDelete);
        app.vault.on('rename', handleRename);
        app.vault.on('modify', handleModify);
        
        // Cleanup
        return () => {
            clearTimeout(createTimeout);
            clearTimeout(deleteTimeout);
            clearTimeout(renameTimeout);
            clearTimeout(modifyTimeout);
            app.vault.off('create', handleCreate);
            app.vault.off('delete', handleDelete);
            app.vault.off('rename', handleRename);
            app.vault.off('modify', handleModify);
        };
    }, [app, dispatch]);

    const contextValue = useMemo(() => ({
        app,
        plugin,
        appState,
        dispatch,
        refreshCounter,
    }), [app, plugin, appState, dispatch, refreshCounter]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

/**
 * Custom hook to access the app context.
 * Must be used within an AppProvider.
 * 
 * @returns The complete AppContext value
 * @throws If used outside of AppProvider
 */
export function useAppContext() {
    return useContext(AppContext);
}

/**
 * Convenience hook to access just the dispatch function.
 * Use this when you only need to dispatch actions.
 * 
 * @returns The dispatch function for updating state
 */
export function useAppDispatch() {
    const { dispatch } = useAppContext();
    return dispatch;
}

/**
 * Convenience hook to access just the app state.
 * Use this when you only need to read state without dispatching.
 * 
 * @returns The current application state
 */
export function useAppState() {
    const { appState } = useAppContext();
    return appState;
}