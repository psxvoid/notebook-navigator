// src/context/AppContext.tsx
import React, { createContext, useContext, useState, useMemo } from 'react';
import { App, TFile, TFolder } from 'obsidian';
import NotebookNavigatorPlugin from '../main';
import { FileSystemOperations } from '../services/FileSystemService';

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
}

// 3. CREATE THE CONTEXT
const AppContext = createContext<AppContextType>(null!);

// 4. CREATE THE PROVIDER COMPONENT
export function AppProvider({ children, plugin }: { children: React.ReactNode, plugin: NotebookNavigatorPlugin }) {
    const { app } = plugin;

    const [appState, setAppState] = useState<AppState>({
        selectedFolder: null,
        selectedFile: null,
        expandedFolders: new Set(),
        focusedPane: 'folders',
    });
    
    // Instantiate services. useMemo ensures they are only created once per app instance.
    const fileSystemOps = useMemo(() => new FileSystemOperations(app), [app]);

    // TODO: useEffect hooks for loading/saving state and handling vault events.

    const contextValue = useMemo(() => ({
        app,
        plugin,
        appState,
        setAppState,
        fileSystemOps,
    }), [app, plugin, appState, fileSystemOps]);

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