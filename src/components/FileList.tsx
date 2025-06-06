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

import React, { useMemo, useCallback, useLayoutEffect } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { FileItem } from './FileItem';
import { DateUtils } from '../utils/DateUtils';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { getFileFromElement } from '../utils/domUtils';

/**
 * Renders the file list pane displaying files from the selected folder.
 * Handles file sorting, grouping by date, pinned notes, and auto-selection.
 * Integrates with the app context to manage file selection and navigation.
 * 
 * @returns A scrollable list of files grouped by date (if enabled) with empty state handling
 */
export function FileList() {
    const { app, appState, dispatch, plugin, refreshCounter } = useAppContext();
    
    const handleFileClick = useCallback((file: TFile) => {
        dispatch({ type: 'SET_SELECTED_FILE', file });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        
        // Open file preview
        const leaf = app.workspace.getMostRecentLeaf();
        if (leaf) {
            leaf.openFile(file);
        }
    }, [app, dispatch]);
    
    // Get files from selected folder
    const files = useMemo(() => {
        if (!appState.selectedFolder) return [];
        
        const collectFiles = (folder: TFolder): TFile[] => {
            const files: TFile[] = [];
            
            for (const child of folder.children) {
                if (isTFile(child)) {
                    // Only include supported file types
                    if (child.extension === 'md' || child.extension === 'canvas' || child.extension === 'base') {
                        files.push(child);
                    }
                } else if (plugin.settings.showNotesFromSubfolders && isTFolder(child)) {
                    files.push(...collectFiles(child));
                }
            }
            
            return files;
        };
        
        let allFiles = collectFiles(appState.selectedFolder);
        
        // Filter out excluded files based on frontmatter properties
        const excludedProperties = parseExcludedProperties(plugin.settings.excludedFiles);
        
        if (excludedProperties.length > 0) {
            allFiles = allFiles.filter(file => !shouldExcludeFile(file, excludedProperties, app));
        }
        
        // Sort files based on settings
        switch (plugin.settings.sortOption) {
            case 'modified':
                allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
                break;
            case 'created':
                allFiles.sort((a, b) => b.stat.ctime - a.stat.ctime);
                break;
            case 'title':
                allFiles.sort((a, b) => a.basename.localeCompare(b.basename));
                break;
        }
        
        // Handle pinned notes
        const pinnedPaths = plugin.settings.pinnedNotes[appState.selectedFolder.path] || [];
        const pinnedFiles = pinnedPaths
            .map(path => app.vault.getAbstractFileByPath(path))
            .filter(isTFile);
        
        const unpinnedFiles = allFiles.filter(file => !pinnedPaths.includes(file.path));
        
        return [...pinnedFiles, ...unpinnedFiles];
    }, [
        appState.selectedFolder, 
        plugin.settings.sortOption,
        plugin.settings.showNotesFromSubfolders,
        plugin.settings.pinnedNotes,
        plugin.settings.excludedFiles,
        app, 
        refreshCounter
    ]);
    
    // Auto-select and open first file when folder changes
    useLayoutEffect(() => {
        if (!appState.selectedFolder) return;
        
        const firstFileElement = document.querySelector('.nn-file-item');
        if (firstFileElement) {
            const file = getFileFromElement(firstFileElement as HTMLElement, app);
            if (file) {
                dispatch({ type: 'SET_SELECTED_FILE', file });
                
                // Open the file
                const leaf = app.workspace.getMostRecentLeaf();
                if (leaf) {
                    leaf.openFile(file);
                }
            }
        }
    }, [appState.selectedFolder?.path, app, dispatch]); // Only run when folder changes
    
    // Group files by date if enabled
    const groupedFiles = useMemo(() => {
        // Separate pinned files first
        const pinnedPaths = plugin.settings.pinnedNotes[appState.selectedFolder?.path || ''] || [];
        const pinnedFiles = files.filter(file => pinnedPaths.includes(file.path));
        const unpinnedFiles = files.filter(file => !pinnedPaths.includes(file.path));

        const groups: { title: string | null; files: TFile[] }[] = [];

        // Add Pinned group if it exists
        if (pinnedFiles.length > 0) {
            groups.push({ title: '📌 Pinned', files: pinnedFiles });
        }

        // Group remaining files
        if (!plugin.settings.groupByDate || plugin.settings.sortOption === 'title') {
            if (unpinnedFiles.length > 0) {
                groups.push({ title: null, files: unpinnedFiles });
            }
            return groups;
        }
        
        const dateGroups = new Map<string, TFile[]>();
        unpinnedFiles.forEach(file => {
            const fileDate = new Date(
                plugin.settings.sortOption === 'created' ? file.stat.ctime : file.stat.mtime
            );
            const groupTitle = DateUtils.getDateGroup(fileDate.getTime());
            
            if (!dateGroups.has(groupTitle)) {
                dateGroups.set(groupTitle, []);
            }
            dateGroups.get(groupTitle)!.push(file);
        });
        
        // Add date groups to the main groups array
        dateGroups.forEach((filesInGroup, title) => {
            groups.push({ title, files: filesInGroup });
        });

        return groups;
    }, [
        files, 
        plugin.settings.groupByDate,
        plugin.settings.sortOption,
        plugin.settings.pinnedNotes,
        appState.selectedFolder
    ]);
    
    if (!appState.selectedFolder) {
        return (
            <div className="nn-file-list nn-empty-state">
                <div className="nn-empty-message">Select a folder to view files</div>
            </div>
        );
    }
    
    if (files.length === 0) {
        return (
            <div className="nn-file-list nn-empty-state">
                <div className="nn-empty-message">No files</div>
            </div>
        );
    }
    
    return (
        <div className="nn-file-list">
            {groupedFiles.map((group, groupIndex) => (
                <div key={groupIndex} className="nn-file-group">
                    {group.title && (
                        <div className="nn-date-group-header">{group.title}</div>
                    )}
                    {group.files.map((file) => (
                        <FileItem
                            key={file.path}
                            file={file}
                            isSelected={appState.selectedFile?.path === file.path}
                            onClick={() => handleFileClick(file)}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}