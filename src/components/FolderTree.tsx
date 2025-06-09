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

import React, { useMemo } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { FolderItem } from './FolderItem';
import { isTFile, isTFolder } from '../utils/typeGuards';


/**
 * Renders the hierarchical folder tree structure for the vault.
 * Manages folder expansion state, selection, and filtering of ignored folders.
 * Recursively renders nested folders with proper indentation.
 * 
 * @returns A tree view of folders with expand/collapse functionality
 */
export function FolderTree() {
    const { app, appState, dispatch, plugin, refreshCounter, isMobile } = useAppContext();
    
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
    
    const handleFolderClick = (folder: TFolder) => {
        dispatch({ type: 'SET_SELECTED_FOLDER', folder });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // On mobile, switch to files view when a folder is selected
        if (isMobile) {
            dispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
        }
    };
    
    const handleToggleExpanded = (folderPath: string) => {
        dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath });
    };
    
    /**
     * Recursively renders a folder and its children.
     * 
     * @param folder - The folder to render
     * @param level - The nesting level for indentation
     * @returns React nodes for the folder and its expanded children
     */
    const renderFolder = (folder: TFolder, level: number = 0): React.ReactNode => {
        // Skip ignored folders
        if (ignoredFolders.has(folder.name)) {
            return null;
        }
        
        // Root folder should be expanded by default when shown
        let isExpanded = appState.expandedFolders.has(folder.path);
        
        // If this is the root folder and showRootFolder is true, 
        // default to expanded if it's not explicitly in the set
        if (folder.path === '/' && plugin.settings.showRootFolder && !appState.expandedFolders.has('/')) {
            isExpanded = true;
        }
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
                <div className={`nn-folder-children ${isExpanded ? 'nn-expanded' : ''}`}>
                    <div className="nn-folder-children-inner">
                        {childFolders.map(childFolder => 
                            renderFolder(childFolder, level + 1)
                        )}
                    </div>
                </div>
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
            {plugin.settings.showRootFolder ? (
                // When showing root folder, render it as the top level with its children
                renderFolder(rootFolder)
            ) : (
                // Otherwise just render the root level folders
                rootFolders.map(folder => renderFolder(folder))
            )}
        </div>
    );
}