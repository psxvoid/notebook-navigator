// src/components/NotebookNavigatorComponent.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { TFile } from 'obsidian';
import { PaneHeader } from './PaneHeader';
import { FolderTree } from './FolderTree';
import { FileList } from './FileList';
import { useAppContext } from '../context/AppContext';
import { setRevealFileCallback, setRefreshCallback } from '../view/NotebookNavigatorView';
import { isTFolder } from '../utils/typeGuards';

export function NotebookNavigatorComponent() {
    const { app, appState, setAppState, refreshCounter } = useAppContext();
    const [forceRefresh, setForceRefresh] = useState(0);
    
    // Load initial width from localStorage
    const [leftPaneWidth, setLeftPaneWidth] = useState(() => {
        const saved = localStorage.getItem('notebook-navigator-left-pane-width');
        return saved ? parseInt(saved, 10) : 300;
    });
    
    // Set up reveal file callback
    useEffect(() => {
        const handleRevealFile = (file: TFile) => {
            if (!file.parent) return;
            
            // Get all parent folders up to root
            const foldersToExpand: string[] = [];
            let currentFolder = file.parent;
            while (currentFolder && currentFolder.path !== '/') {
                foldersToExpand.unshift(currentFolder.path);
                currentFolder = currentFolder.parent;
            }
            
            // Update state to expand folders and select file
            setAppState(currentState => ({
                ...currentState,
                expandedFolders: new Set([...currentState.expandedFolders, ...foldersToExpand]),
                selectedFolder: file.parent,
                selectedFile: file,
                focusedPane: 'files'
            }));
        };
        
        const handleRefresh = () => {
            setForceRefresh(c => c + 1);
        };
        
        setRevealFileCallback(handleRevealFile);
        setRefreshCallback(handleRefresh);
        
        return () => {
            setRevealFileCallback(null as any);
            setRefreshCallback(null as any);
        };
    }, [app, setAppState]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        const startX = e.clientX;
        const startWidth = leftPaneWidth;
        let currentWidth = startWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            currentWidth = Math.max(150, Math.min(600, startWidth + deltaX));
            setLeftPaneWidth(currentWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // Save final width to localStorage
            localStorage.setItem('notebook-navigator-left-pane-width', currentWidth.toString());
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [leftPaneWidth]);

    return (
        <div 
            className="notebook-navigator" 
            data-focus-pane={appState.focusedPane}
            tabIndex={-1}
        >
            <div className="nn-split-container">
                <div className="nn-left-pane" style={{ width: `${leftPaneWidth}px` }}>
                    <PaneHeader type="folder" />
                    <FolderTree />
                </div>
                <div className="nn-resize-handle" onMouseDown={handleResizeMouseDown} />
                <div className="nn-right-pane">
                    <PaneHeader type="file" />
                    <FileList />
                </div>
            </div>
        </div>
    );
}