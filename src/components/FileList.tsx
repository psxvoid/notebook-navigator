import React, { useMemo, useCallback, useLayoutEffect } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { FileItem } from './FileItem';
import { DateUtils } from '../utils/DateUtils';
import { isTFile, isTFolder } from '../utils/typeGuards';

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
        app, 
        refreshCounter
    ]);
    
    // Auto-select and open first file when folder changes
    useLayoutEffect(() => {
        if (!appState.selectedFolder) return;
        
        const firstFileElement = document.querySelector('.nn-file-item');
        if (firstFileElement) {
            const path = firstFileElement.getAttribute('data-path');
            if (path) {
                const file = app.vault.getAbstractFileByPath(path);
                if (file && 'extension' in file) {
                    const tfile = file as TFile;
                    dispatch({ type: 'SET_SELECTED_FILE', file: tfile });
                    
                    // Open the file
                    const leaf = app.workspace.getMostRecentLeaf();
                    if (leaf) {
                        leaf.openFile(tfile);
                    }
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
                <div className="nn-empty-message">No files in this folder</div>
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