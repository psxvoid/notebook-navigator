import React, { useMemo, useCallback } from 'react';
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
        const leaves = app.workspace.getLeavesOfType('markdown');
        if (leaves.length > 0) {
            leaves[0].openFile(file);
        } else {
            app.workspace.getLeaf().openFile(file);
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
    }, [appState.selectedFolder, plugin.settings, app, refreshCounter]);
    
    // Group files by date if enabled
    const groupedFiles = useMemo(() => {
        if (!plugin.settings.groupByDate) {
            return [{ title: null, files }];
        }
        
        const groups = new Map<string, TFile[]>();
        const today = new Date();
        
        files.forEach(file => {
            const fileDate = new Date(
                plugin.settings.sortOption === 'created' ? file.stat.ctime : file.stat.mtime
            );
            const groupTitle = DateUtils.getDateGroup(fileDate.getTime());
            
            if (!groups.has(groupTitle)) {
                groups.set(groupTitle, []);
            }
            groups.get(groupTitle)!.push(file);
        });
        
        return Array.from(groups.entries()).map(([title, files]) => ({ title, files }));
    }, [files, plugin.settings.groupByDate, plugin.settings.sortOption]);
    
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
                        <div className="nn-file-group-header">{group.title}</div>
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