// src/hooks/useKeyboardNavigation.ts
import { useCallback, useEffect, useRef } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { useFileSystemOps } from '../context/ServicesContext';
import { isTFolder } from '../utils/typeGuards';

export function useKeyboardNavigation(containerRef: React.RefObject<HTMLElement>) {
    const { app, appState, dispatch } = useAppContext();
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
            // Change this line
            newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        } else {
            // Change this line
            newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : currentIndex;
        }
        
        if (newIndex !== currentIndex || currentIndex === -1) { // Add check for initial selection
            const path = elements[newIndex].getAttribute('data-path');
            if (path) {
                const file = app.vault.getAbstractFileByPath(path);
                if (file && 'extension' in file) {
                    dispatch({ type: 'SET_SELECTED_FILE', file: file as TFile });
                    dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    elements[newIndex].scrollIntoView({ block: 'nearest' });
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
                } else if (appState.selectedFolder && appState.expandedFolders.has(appState.selectedFolder.path)) {
                    dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: appState.selectedFolder.path });
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
                }
                break;
                
            case 'Tab':
                e.preventDefault();
                dispatch({ 
                    type: 'SET_FOCUSED_PANE', 
                    pane: appState.focusedPane === 'folders' ? 'files' : 'folders' 
                });
                break;
                
            case 'Enter':
                e.preventDefault();
                if (appState.focusedPane === 'files' && appState.selectedFile) {
                    const leaves = app.workspace.getLeavesOfType('markdown');
                    if (leaves.length > 0) {
                        leaves[0].openFile(appState.selectedFile);
                    } else {
                        app.workspace.getLeaf().openFile(appState.selectedFile);
                    }
                } else if (appState.focusedPane === 'folders' && appState.selectedFolder) {
                    dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: appState.selectedFolder.path });
                }
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
    }, [appState, dispatch, navigateFolders, navigateFiles, app, fileSystemOps]);
    
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        container.addEventListener('keydown', handleKeyDown);
        
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, [containerRef, handleKeyDown]);
}