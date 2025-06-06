import React, { useCallback } from 'react';
import { setIcon } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { useFileSystemOps } from '../context/ServicesContext';
import { isTFolder } from '../utils/typeGuards';

interface PaneHeaderProps {
    type: 'folder' | 'file';
}

export function PaneHeader({ type }: PaneHeaderProps) {
    const { app, appState, dispatch } = useAppContext();
    const fileSystemOps = useFileSystemOps();
    
    const handleExpandCollapseAll = useCallback(() => {
        if (type !== 'folder') return;
        
        // If we have any expanded folders, collapse all
        if (appState.expandedFolders.size > 0) {
            dispatch({ type: 'SET_EXPANDED_FOLDERS', folders: new Set() });
        } else {
            // Otherwise, expand all folders
            const allFolders = new Set<string>();
            
            const collectAllFolders = (folder: any) => {
                folder.children.forEach((child: any) => {
                    if (isTFolder(child)) {
                        allFolders.add(child.path);
                        collectAllFolders(child);
                    }
                });
            };
            
            const rootFolder = app.vault.getRoot();
            collectAllFolders(rootFolder);
            
            dispatch({ type: 'SET_EXPANDED_FOLDERS', folders: allFolders });
        }
    }, [app, appState.expandedFolders.size, dispatch, type]);
    
    const handleNewFolder = useCallback(async () => {
        if (type !== 'folder' || !appState.selectedFolder) return;
        
        try {
            await fileSystemOps.createFolder(appState.selectedFolder);
        } catch (error) {
            console.error('Failed to create folder:', error);
        }
    }, [appState.selectedFolder, fileSystemOps, type]);
    
    const handleNewFile = useCallback(async () => {
        if (type !== 'file' || !appState.selectedFolder) return;
        
        try {
            await fileSystemOps.createNote(appState.selectedFolder);
        } catch (error) {
            console.error('Failed to create file:', error);
        }
    }, [appState.selectedFolder, fileSystemOps, type]);
    
    return (
        <div className="nn-pane-header">
            <span className="nn-pane-title">{type === 'folder' ? 'Folders' : 'Files'}</span>
            <div className="nn-pane-buttons">
                {type === 'folder' ? (
                    <>
                        <button
                            className="nn-header-button"
                            aria-label={appState.expandedFolders.size > 0 ? "Collapse all folders" : "Expand all folders"}
                            onClick={handleExpandCollapseAll}
                            ref={(el) => {
                                if (el) {
                                    setIcon(el, appState.expandedFolders.size > 0 ? 'chevrons-up' : 'chevrons-down');
                                }
                            }}
                        />
                        <button
                            className="nn-header-button"
                            aria-label="New folder"
                            onClick={handleNewFolder}
                            disabled={!appState.selectedFolder}
                            ref={(el) => {
                                if (el) {
                                    setIcon(el, 'folder-plus');
                                }
                            }}
                        />
                    </>
                ) : (
                    <button
                        className="nn-header-button"
                        aria-label="New note"
                        onClick={handleNewFile}
                        disabled={!appState.selectedFolder}
                        ref={(el) => {
                            if (el) {
                                setIcon(el, 'file-plus');
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
}