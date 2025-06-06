// src/hooks/useKeyboardNavigation.ts
import { useCallback, useEffect, useRef } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { useFileSystemOps } from '../context/ServicesContext';
import { isTFolder } from '../utils/typeGuards';

export function useKeyboardNavigation(containerRef: React.RefObject<HTMLElement>) {
    const { app, appState, dispatch, plugin } = useAppContext();
    const fileSystemOps = useFileSystemOps();
    const lastActionTime = useRef(0);
    
    const getFolderElements = useCallback(() => {
        if (!containerRef.current) return [];
        return Array.from(containerRef.current.querySelectorAll('.nn-folder-item'));
    }, [containerRef]);
    
    const getFileElements = useCallback(() => {
        if (!containerRef.current) return [];
        return Array.from(containerRef.current.querySelectorAll('.nn-file-item'));
    }, [containerRef]);
    
    const getSelectedIndex = useCallback((elements: Element[], selectedPath: string | null) => {
        if (!selectedPath) return -1;
        return elements.findIndex(el => el.getAttribute('data-path') === selectedPath);
    }, []);
    
    const navigateFolders = useCallback((direction: 'up' | 'down') => {
        const elements = getFolderElements();
        if (elements.length === 0) return;
        
        const currentIndex = getSelectedIndex(elements, appState.selectedFolder?.path || null);
        let newIndex = currentIndex;
        
        if (direction === 'up') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        } else {
            newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : elements.length - 1;
        }
        
        if (newIndex !== currentIndex) {
            const path = elements[newIndex].getAttribute('data-path');
            if (path) {
                const folder = app.vault.getAbstractFileByPath(path);
                if (isTFolder(folder)) {
                    dispatch({ type: 'SET_SELECTED_FOLDER', folder });
                    dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                    elements[newIndex].scrollIntoView({ block: 'nearest' });
                }
            }
        }
    }, [getFolderElements, getSelectedIndex, appState.selectedFolder, app, dispatch]);
    
    const navigateFiles = useCallback((direction: 'up' | 'down') => {
        const elements = getFileElements();
        if (elements.length === 0) return;
        
        const currentIndex = getSelectedIndex(elements, appState.selectedFile?.path || null);
        let newIndex = currentIndex;
        
        if (direction === 'up') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        } else {
            newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : currentIndex;
        }
        
        if (newIndex !== currentIndex || currentIndex === -1) {
            const path = elements[newIndex].getAttribute('data-path');
            if (path) {
                const file = app.vault.getAbstractFileByPath(path);
                if (file && 'extension' in file) {
                    const tFile = file as TFile;
                    dispatch({ type: 'SET_SELECTED_FILE', file: tFile });
                    dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    elements[newIndex].scrollIntoView({ block: 'nearest' });
                    
                    // Open file in edit view (same as clicking)
                    // Use getMostRecentLeaf to avoid creating new panes or stealing focus
                    const leaf = app.workspace.getMostRecentLeaf();
                    if (leaf) {
                        leaf.openFile(tFile);
                    }
                }
            }
        }
    }, [getFileElements, getSelectedIndex, appState.selectedFile, app, dispatch]);
    
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Debounce rapid key presses
        const now = Date.now();
        if (now - lastActionTime.current < 50) return;
        lastActionTime.current = now;
        
        // Don't handle if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }
        
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (appState.focusedPane === 'folders') {
                    navigateFolders('up');
                } else {
                    navigateFiles('up');
                }
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                if (appState.focusedPane === 'folders') {
                    navigateFolders('down');
                } else {
                    navigateFiles('down');
                }
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                if (appState.focusedPane === 'files') {
                    dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                } else if (appState.selectedFolder) {
                    // If folder is expanded, collapse it
                    if (appState.expandedFolders.has(appState.selectedFolder.path)) {
                        dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: appState.selectedFolder.path });
                    } else {
                        // If folder is collapsed or has no children, navigate to parent
                        const parentPath = appState.selectedFolder.parent?.path;
                        
                        // Don't navigate to root if showRootFolder is false and we're at root level
                        const isAtRootLevel = !parentPath || parentPath === '' || parentPath === '/';
                        if (parentPath && !(isAtRootLevel && !plugin.settings.showRootFolder)) {
                            const parentFolder = app.vault.getAbstractFileByPath(parentPath);
                            if (parentFolder && isTFolder(parentFolder)) {
                                dispatch({ type: 'SET_SELECTED_FOLDER', folder: parentFolder });
                                
                                // Ensure parent is visible by scrolling to it
                                const folderElements = getFolderElements();
                                const parentElement = folderElements.find(el => el.getAttribute('data-path') === parentPath);
                                if (parentElement) {
                                    parentElement.scrollIntoView({ block: 'nearest' });
                                }
                            }
                        }
                    }
                }
                break;
                
            case 'ArrowRight':
                e.preventDefault();
                if (appState.focusedPane === 'folders') {
                    if (appState.selectedFolder) {
                        if (!appState.expandedFolders.has(appState.selectedFolder.path)) {
                            const hasSubfolders = appState.selectedFolder.children.some(isTFolder);
                            if (hasSubfolders) {
                                dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: appState.selectedFolder.path });
                            } else {
                                dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            }
                        } else {
                            dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        }
                    }
                } else if (appState.focusedPane === 'files' && appState.selectedFile) {
                    // Move focus to edit view showing the selected file
                    const leaves = app.workspace.getLeavesOfType('markdown')
                        .concat(app.workspace.getLeavesOfType('canvas'))
                        .concat(app.workspace.getLeavesOfType('database'));
                    
                    // Find leaf showing our file
                    const targetLeaf = leaves.find(leaf => leaf.view.file?.path === appState.selectedFile.path);
                    if (targetLeaf) {
                        app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                    }
                }
                break;
                
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+Tab always moves left (to folders if in files)
                    if (appState.focusedPane === 'files') {
                        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
                    }
                } else {
                    // Tab moves right or to editor
                    if (appState.focusedPane === 'folders') {
                        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    } else if (appState.focusedPane === 'files' && appState.selectedFile) {
                        // Move focus to edit view showing the selected file
                        const leaves = app.workspace.getLeavesOfType('markdown')
                            .concat(app.workspace.getLeavesOfType('canvas'))
                            .concat(app.workspace.getLeavesOfType('database'));
                        
                        // Find leaf showing our file
                        const targetLeaf = leaves.find(leaf => leaf.view.file?.path === appState.selectedFile.path);
                        if (targetLeaf) {
                            app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                        }
                    }
                }
                break;
                
            case 'Enter':
            case 'Escape':
            case ' ': // Space key
                e.preventDefault();
                // Do nothing
                break;
                
            case 'Delete':
            case 'Backspace':
                if (e.shiftKey || e.metaKey || e.ctrlKey) return; // Skip if modifier keys
                e.preventDefault();
                
                if (appState.focusedPane === 'files' && appState.selectedFile) {
                    fileSystemOps.deleteFile(appState.selectedFile, true);
                } else if (appState.focusedPane === 'folders' && appState.selectedFolder) {
                    fileSystemOps.deleteFolder(appState.selectedFolder, true);
                }
                break;
        }
    }, [appState, dispatch, navigateFolders, navigateFiles, app, fileSystemOps, getFolderElements, plugin]);
    
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        container.addEventListener('keydown', handleKeyDown);
        
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, [containerRef, handleKeyDown]);
}