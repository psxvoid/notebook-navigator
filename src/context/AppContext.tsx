// src/context/AppContext.tsx
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { App, TFile, TFolder } from 'obsidian';
import NotebookNavigatorPlugin from '../main';
import { FileSystemOperations } from '../services/FileSystemService';
import { isTFolder } from '../utils/typeGuards';

// 1. DEFINE THE SHAPE OF OUR STATE
export interface AppState {
    selectedFolder: TFolder | null;
    selectedFile: TFile | null;
    expandedFolders: Set<string>;
    focusedPane: 'folders' | 'files';
}

// 2. DEFINE THE SHAPE OF OUR CONTEXT
interface AppContextType {
    app: App;
    plugin: NotebookNavigatorPlugin;
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    fileSystemOps: FileSystemOperations;
    refreshCounter: number;
}

// 3. CREATE THE CONTEXT
const AppContext = createContext<AppContextType>(null!);

// LocalStorage keys
const STORAGE_KEYS = {
    expandedFolders: 'notebook-navigator-expanded-folders',
    selectedFolder: 'notebook-navigator-selected-folder',
    selectedFile: 'notebook-navigator-selected-file',
    leftPaneWidth: 'notebook-navigator-left-pane-width'
};

// 4. CREATE THE PROVIDER COMPONENT
export function AppProvider({ children, plugin }: { children: React.ReactNode, plugin: NotebookNavigatorPlugin }) {
    const { app } = plugin;

    // Load initial state from localStorage
    const loadInitialState = (): AppState => {
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
    };

    const [appState, setAppState] = useState<AppState>(loadInitialState);
    
    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.expandedFolders, JSON.stringify(Array.from(appState.expandedFolders)));
        localStorage.setItem(STORAGE_KEYS.selectedFolder, appState.selectedFolder?.path || '');
        localStorage.setItem(STORAGE_KEYS.selectedFile, appState.selectedFile?.path || '');
    }, [appState]);
    
    // Instantiate services. useMemo ensures they are only created once per app instance.
    const fileSystemOps = useMemo(() => new FileSystemOperations(app), [app]);
    
    // Force refresh counter to trigger re-renders
    const [refreshCounter, setRefreshCounter] = useState(0);
    
    // Handle vault events
    useEffect(() => {
        const handleVaultChange = () => {
            // Increment counter to force component re-renders
            setRefreshCounter(c => c + 1);
            
            // Check if selected file/folder still exists
            setAppState(currentState => {
                let newState = { ...currentState };
                
                if (currentState.selectedFile && !app.vault.getAbstractFileByPath(currentState.selectedFile.path)) {
                    newState.selectedFile = null;
                }
                
                if (currentState.selectedFolder && !app.vault.getAbstractFileByPath(currentState.selectedFolder.path)) {
                    newState.selectedFolder = null;
                }
                
                // Clean up expanded folders that no longer exist
                const validExpandedFolders = new Set<string>();
                currentState.expandedFolders.forEach(path => {
                    if (app.vault.getAbstractFileByPath(path)) {
                        validExpandedFolders.add(path);
                    }
                });
                newState.expandedFolders = validExpandedFolders;
                
                return newState;
            });
        };
        
        // Debounce vault changes
        let timeout: NodeJS.Timeout;
        const debouncedHandleVaultChange = () => {
            clearTimeout(timeout);
            timeout = setTimeout(handleVaultChange, 100);
        };
        
        // Register event handlers
        app.vault.on('create', debouncedHandleVaultChange);
        app.vault.on('delete', debouncedHandleVaultChange);
        app.vault.on('rename', debouncedHandleVaultChange);
        app.vault.on('modify', debouncedHandleVaultChange);
        
        // Cleanup
        return () => {
            clearTimeout(timeout);
            app.vault.off('create', debouncedHandleVaultChange);
            app.vault.off('delete', debouncedHandleVaultChange);
            app.vault.off('rename', debouncedHandleVaultChange);
            app.vault.off('modify', debouncedHandleVaultChange);
        };
    }, [app, setAppState]);

    const contextValue = useMemo(() => ({
        app,
        plugin,
        appState,
        setAppState,
        fileSystemOps,
        refreshCounter, // Include this to force re-renders
    }), [app, plugin, appState, fileSystemOps, refreshCounter]);

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