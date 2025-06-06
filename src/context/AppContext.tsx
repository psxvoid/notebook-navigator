// src/context/AppContext.tsx
import React, { createContext, useContext, useMemo, useEffect, useReducer } from 'react';
import { App, TFile, TFolder } from 'obsidian';
import NotebookNavigatorPlugin from '../main';
import { isTFolder } from '../utils/typeGuards';

// 1. DEFINE THE SHAPE OF OUR STATE
export interface AppState {
    selectedFolder: TFolder | null;
    selectedFile: TFile | null;
    expandedFolders: Set<string>;
    focusedPane: 'folders' | 'files';
}

// Define action types
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

// 2. DEFINE THE SHAPE OF OUR CONTEXT
interface AppContextType {
    app: App;
    plugin: NotebookNavigatorPlugin;
    appState: AppState;
    dispatch: React.Dispatch<AppAction>;
    refreshCounter: number;
}

// 3. CREATE THE CONTEXT
const AppContext = createContext<AppContextType>(null!);

// LocalStorage keys
const STORAGE_KEYS = {
    expandedFolders: 'notebook-navigator-expanded-folders',
    selectedFolder: 'notebook-navigator-selected-folder',
    selectedFile: 'notebook-navigator-selected-file'
};

// Load state from localStorage
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

// Save specific state to localStorage
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

// Reducer function
function appReducer(state: AppState, action: AppAction, app: App): AppState {
    switch (action.type) {
        case 'SET_SELECTED_FOLDER': {
            const newState = { ...state, selectedFolder: action.folder };
            saveToStorage(STORAGE_KEYS.selectedFolder, action.folder?.path);
            return newState;
        }
        
        case 'SET_SELECTED_FILE': {
            const newState = { ...state, selectedFile: action.file };
            saveToStorage(STORAGE_KEYS.selectedFile, action.file?.path);
            return newState;
        }
        
        case 'SET_EXPANDED_FOLDERS': {
            const newState = { ...state, expandedFolders: action.folders };
            saveToStorage(STORAGE_KEYS.expandedFolders, action.folders);
            return newState;
        }
        
        case 'TOGGLE_FOLDER_EXPANDED': {
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
            return { ...state, focusedPane: action.pane };
        }
        
        case 'EXPAND_FOLDERS': {
            const newExpanded = new Set([...state.expandedFolders, ...action.folderPaths]);
            saveToStorage(STORAGE_KEYS.expandedFolders, newExpanded);
            return { ...state, expandedFolders: newExpanded };
        }
        
        case 'REVEAL_FILE': {
            if (!action.file.parent) return state;
            
            // Get all parent folders up to root
            const foldersToExpand: string[] = [];
            let currentFolder = action.file.parent;
            while (currentFolder && currentFolder.path !== '/') {
                foldersToExpand.unshift(currentFolder.path);
                currentFolder = currentFolder.parent;
            }
            
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
            // This doesn't change state but triggers re-renders
            return { ...state };
        }
        
        default:
            return state;
    }
}

// 4. CREATE THE PROVIDER COMPONENT
export function AppProvider({ children, plugin }: { children: React.ReactNode, plugin: NotebookNavigatorPlugin }) {
    const { app } = plugin;

    // Initialize state with useReducer
    const [appState, baseDispatch] = useReducer(
        (state: AppState, action: AppAction) => appReducer(state, action, app),
        null,
        () => loadStateFromStorage(app)
    );
    
    // Force refresh counter
    const [refreshCounter, setRefreshCounter] = React.useState(0);
    
    // Wrap dispatch to handle FORCE_REFRESH specially
    const dispatch = useMemo(() => {
        return (action: AppAction) => {
            if (action.type === 'FORCE_REFRESH') {
                setRefreshCounter(c => c + 1);
            }
            baseDispatch(action);
        };
    }, []);
    
    // Handle vault events
    useEffect(() => {
        let createTimeout: NodeJS.Timeout;
        let deleteTimeout: NodeJS.Timeout;
        let renameTimeout: NodeJS.Timeout;
        let modifyTimeout: NodeJS.Timeout;
        
        const handleCreate = () => {
            clearTimeout(createTimeout);
            createTimeout = setTimeout(() => {
                setRefreshCounter(c => c + 1);
            }, 50);
        };
        
        const handleDelete = () => {
            clearTimeout(deleteTimeout);
            deleteTimeout = setTimeout(() => {
                dispatch({ type: 'CLEANUP_DELETED_ITEMS' });
                setRefreshCounter(c => c + 1);
            }, 50);
        };
        
        const handleRename = () => {
            clearTimeout(renameTimeout);
            renameTimeout = setTimeout(() => {
                dispatch({ type: 'CLEANUP_DELETED_ITEMS' });
                setRefreshCounter(c => c + 1);
            }, 50);
        };
        
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

// 5. CREATE A CUSTOM HOOK FOR EASY ACCESS
export function useAppContext() {
    return useContext(AppContext);
}

// Helper hooks for common operations
export function useAppDispatch() {
    const { dispatch } = useAppContext();
    return dispatch;
}

export function useAppState() {
    const { appState } = useAppContext();
    return appState;
}