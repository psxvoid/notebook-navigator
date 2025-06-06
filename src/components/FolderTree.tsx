import React, { useCallback, useMemo } from 'react';
import { TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { FolderItem } from './FolderItem';
import { isTFolder } from '../utils/typeGuards';

export function FolderTree() {
    const { app, appState, setAppState, plugin, refreshCounter } = useAppContext();
    
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
        setAppState(currentState => ({
            ...currentState,
            selectedFolder: folder,
            focusedPane: 'folders',
        }));
    }, [setAppState]);
    
    const handleToggleExpanded = useCallback((folderPath: string) => {
        setAppState(currentState => {
            const newExpanded = new Set(currentState.expandedFolders);
            if (newExpanded.has(folderPath)) {
                newExpanded.delete(folderPath);
            } else {
                newExpanded.add(folderPath);
            }
            return {
                ...currentState,
                expandedFolders: newExpanded,
            };
        });
    }, [setAppState]);
    
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