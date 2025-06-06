// src/components/NotebookNavigatorComponent.tsx
import React, { useState, useCallback } from 'react';
import { PaneHeader } from './PaneHeader';
import { FolderTree } from './FolderTree';
import { FileList } from './FileList';
import { useAppContext } from '../context/AppContext';

export function NotebookNavigatorComponent() {
    const { appState } = useAppContext();
    const [leftPaneWidth, setLeftPaneWidth] = useState(300);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        const startX = e.clientX;
        const startWidth = leftPaneWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(150, Math.min(600, startWidth + deltaX));
            setLeftPaneWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // TODO: Save newWidth to settings/localStorage
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