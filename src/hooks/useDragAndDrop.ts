// src/hooks/useDragAndDrop.ts
import { useCallback, useEffect, useRef } from 'react';
import { TFolder, TFile, Notice } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { useFileSystemOps } from '../context/ServicesContext';
import { isTFolder } from '../utils/typeGuards';

export function useDragAndDrop(containerRef: React.RefObject<HTMLElement>) {
    const { app, dispatch } = useAppContext();
    const fileSystemOps = useFileSystemOps();
    const dragOverElement = useRef<HTMLElement | null>(null);

    const handleDragStart = useCallback((e: DragEvent) => {
        const target = e.target as HTMLElement;
        const draggable = target.closest('[data-draggable="true"]');
        if (!draggable) return;

        const path = draggable.getAttribute('data-drag-path');
        const type = draggable.getAttribute('data-drag-type');
        if (path && e.dataTransfer) {
            e.dataTransfer.setData('text/plain', path);
            e.dataTransfer.effectAllowed = 'move';
            draggable.classList.add('nn-dragging');
        }
    }, []);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const dropZone = target.closest<HTMLElement>('[data-drop-zone="folder"]');

        if (dragOverElement.current && dragOverElement.current !== dropZone) {
            dragOverElement.current.classList.remove('nn-drag-over');
            dragOverElement.current = null;
        }

        if (dropZone) {
            dropZone.classList.add('nn-drag-over');
            dragOverElement.current = dropZone;
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        }
    }, []);

    const handleDrop = useCallback(async (e: DragEvent) => {
        e.preventDefault();
        if (dragOverElement.current) {
            dragOverElement.current.classList.remove('nn-drag-over');
        }

        const targetPath = dragOverElement.current?.getAttribute('data-drop-path');
        const sourcePath = e.dataTransfer?.getData('text/plain');

        if (!sourcePath || !targetPath) return;

        const sourceItem = app.vault.getAbstractFileByPath(sourcePath);
        const targetFolder = app.vault.getAbstractFileByPath(targetPath);

        if (!sourceItem || !isTFolder(targetFolder)) return;

        // Prevent dropping a folder into itself or its own children
        if (sourceItem.path === targetFolder.path || (sourceItem instanceof TFolder && fileSystemOps.isDescendant(sourceItem, targetFolder))) {
            new Notice("Cannot move a folder into itself or a subfolder.", 2000);
            return;
        }
        
        const newPath = `${targetFolder.path}/${sourceItem.name}`;
        if (app.vault.getAbstractFileByPath(newPath)) {
            new Notice(`An item named "${sourceItem.name}" already exists in this location.`, 2000);
            return;
        }

        try {
            await app.fileManager.renameFile(sourceItem, newPath);
            // Force refresh to update folder counts
            dispatch({ type: 'FORCE_REFRESH' });
        } catch (error) {
            new Notice(`Failed to move: ${error.message}`);
        }
    }, [app, fileSystemOps, dispatch]);
    
    const handleDragEnd = useCallback((e: DragEvent) => {
        const target = e.target as HTMLElement;
        const draggable = target.closest('[data-draggable="true"]');
        draggable?.classList.remove('nn-dragging');
        if (dragOverElement.current) {
            dragOverElement.current.classList.remove('nn-drag-over');
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', handleDragEnd);

        return () => {
            container.removeEventListener('dragstart', handleDragStart);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('drop', handleDrop);
            container.removeEventListener('dragend', handleDragEnd);
        };
    }, [containerRef, handleDragStart, handleDragOver, handleDrop, handleDragEnd]);
}