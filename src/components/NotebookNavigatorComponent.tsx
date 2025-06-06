// src/components/NotebookNavigatorComponent.tsx
import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { TFile, WorkspaceLeaf } from 'obsidian';
import { PaneHeader } from './PaneHeader';
import { FolderTree } from './FolderTree';
import { FileList } from './FileList';
import { useAppContext } from '../context/AppContext';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { isTFolder } from '../utils/typeGuards';

export interface NotebookNavigatorHandle {
    revealFile: (file: TFile) => void;
    refresh: () => void;
}

export const NotebookNavigatorComponent = forwardRef<NotebookNavigatorHandle>((_, ref) => {
    const { app, appState, dispatch, plugin, refreshCounter } = useAppContext();
    const [forceRefresh, setForceRefresh] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Enable keyboard navigation
    useKeyboardNavigation(containerRef);
    
    // Load initial width from localStorage
    const [leftPaneWidth, setLeftPaneWidth] = useState(() => {
        const saved = localStorage.getItem('notebook-navigator-left-pane-width');
        return saved ? parseInt(saved, 10) : 300;
    });
    
    // Save leftPaneWidth to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('notebook-navigator-left-pane-width', leftPaneWidth.toString());
    }, [leftPaneWidth]);
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        revealFile: (file: TFile) => {
            dispatch({ type: 'REVEAL_FILE', file });
        },
        refresh: () => {
            setForceRefresh(c => c + 1);
        }
    }), [dispatch]);

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
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [leftPaneWidth]);

    // Add this useEffect to handle active leaf changes
    useEffect(() => {
        if (!plugin.settings.autoRevealActiveFile) return;

        const handleActiveLeafChange = (leaf: WorkspaceLeaf | null) => {
            const file = leaf?.view.file;
            if (file && file instanceof TFile) {
                // Don't reveal if it's already selected
                if (appState.selectedFile?.path !== file.path) {
                    dispatch({ type: 'REVEAL_FILE', file });
                }
            }
        };

        const eventRef = app.workspace.on('active-leaf-change', handleActiveLeafChange);

        return () => {
            app.workspace.offref(eventRef);
        };
    }, [app.workspace, dispatch, plugin.settings.autoRevealActiveFile, appState.selectedFile]);

    return (
        <div 
            ref={containerRef}
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
});

NotebookNavigatorComponent.displayName = 'NotebookNavigatorComponent';