import React, { useCallback, useMemo } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { FolderItem } from './FolderItem';
import { isTFile, isTFolder } from '../utils/typeGuards';

export function FolderTree() {
    const { app, appState, dispatch, plugin, refreshCounter } = useAppContext();
    
    const rootFolder = app.vault.getRoot();
    
    // Filter out ignored folders
    const ignoredFolders = useMemo(() => {
        return new Set(
            plugin.settings.ignoreFolders
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0)
        );
    }, [plugin.settings.ignoreFolders]);
    
    const handleFolderClick = useCallback((folder: TFolder) => {
        dispatch({ type: 'SET_SELECTED_FOLDER', folder });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });

        // Add this logic to select the first file
        const files = folder.children
            .filter(isTFile)
            .sort((a, b) => b.stat.mtime - a.stat.mtime); // Ensure default sort to find the "first" file

        if (files.length > 0) {
            dispatch({ type: 'SET_SELECTED_FILE', file: files[0] as TFile });
        } else {
            dispatch({ type: 'SET_SELECTED_FILE', file: null }); // Clear selection if folder is empty
        }
    }, [dispatch]);
    
    const handleToggleExpanded = useCallback((folderPath: string) => {
        dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath });
    }, [dispatch]);
    
    const renderFolder = (folder: TFolder, level: number = 0): React.ReactNode => {
        // Skip ignored folders
        if (ignoredFolders.has(folder.name)) {
            return null;
        }
        
        const isExpanded = appState.expandedFolders.has(folder.path);
        const isSelected = appState.selectedFolder?.path === folder.path;
        
        // Get child folders, sorted alphabetically
        const childFolders = folder.children
            .filter(isTFolder)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        return (
            <React.Fragment key={folder.path}>
                <FolderItem
                    folder={folder}
                    level={level}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    onToggle={() => handleToggleExpanded(folder.path)}
                    onClick={() => handleFolderClick(folder)}
                />
                {isExpanded && childFolders.map(childFolder => 
                    renderFolder(childFolder, level + 1)
                )}
            </React.Fragment>
        );
    };
    
    // Get root level folders
    const rootFolders = useMemo(() => {
        return rootFolder.children
            .filter(isTFolder)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rootFolder, refreshCounter]); // Include refreshCounter to update on vault changes
    
    return (
        <div className="nn-folder-tree">
            {rootFolders.map(folder => renderFolder(folder))}
        </div>
    );
}