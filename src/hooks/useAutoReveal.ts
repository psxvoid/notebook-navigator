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

import { useEffect, useState, useRef } from 'react';
import { TFile, WorkspaceLeaf, App } from 'obsidian';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { debugLog } from '../utils/debugLog';

interface UseAutoRevealSettings {
    autoRevealActiveFile: boolean;
}

/**
 * Custom hook that detects which file should be revealed in the navigator.
 * This hook listens to workspace events and returns the file that needs
 * to be revealed, without handling any of the reveal logic itself.
 * 
 * @param app - The Obsidian app instance
 * @param settings - Plugin settings containing autoRevealActiveFile flag
 * @returns Object containing the file to reveal (null if none)
 */
export function useAutoReveal(
    app: App,
    settings: UseAutoRevealSettings
): { fileToReveal: TFile | null } {
    const [fileToReveal, setFileToReveal] = useState<TFile | null>(null);
    const lastRevealedFileRef = useRef<string | null>(null);
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

    // Reset fileToReveal after it's been consumed
    useEffect(() => {
        if (fileToReveal) {
            // Clear after a short delay to ensure the consumer has processed it
            const timer = setTimeout(() => {
                setFileToReveal(null);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [fileToReveal]);
    
    // Log focus/defocus events for debugging
    useEffect(() => {
        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            const navigatorEl = document.querySelector('.nn-split-container');
            if (navigatorEl && navigatorEl.contains(target)) {
                debugLog.debug('[AutoReveal] Navigator gained focus', {
                    element: target.tagName,
                    className: target.className,
                    id: target.id
                });
            }
        };
        
        const handleFocusOut = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            const navigatorEl = document.querySelector('.nn-split-container');
            if (navigatorEl && navigatorEl.contains(target)) {
                debugLog.debug('[AutoReveal] Navigator lost focus', {
                    element: target.tagName,
                    className: target.className,
                    id: target.id
                });
            }
        };
        
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        
        return () => {
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, []);


    // Main effect for detecting which file to reveal
    useEffect(() => {
        if (!settings.autoRevealActiveFile) return;

        const handleFileChange = (file: TFile | null) => {
            if (!file) return;
            
            // Simple rule: Don't reveal if navigator has focus
            const navigatorEl = document.querySelector('.nn-split-container');
            const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);
            
            debugLog.debug('[AutoReveal] File change detected:', {
                file: file.path,
                hasNavigatorFocus,
                lastRevealed: lastRevealedFileRef.current,
                isNewlyCreated: uiState.newlyCreatedPath === file.path
            });
            
            // Check if this is a file we just created via the plugin
            const isNewlyCreatedFile = uiState.newlyCreatedPath && file.path === uiState.newlyCreatedPath;
            
            // Always reveal newly created files
            if (isNewlyCreatedFile) {
                debugLog.debug('[AutoReveal] Revealing newly created file:', file.path);
                setFileToReveal(file);
                lastRevealedFileRef.current = file.path;
                // Clear the newly created path after consuming it
                uiDispatch({ type: 'SET_NEWLY_CREATED_PATH', path: null });
                return;
            }
            
            // Don't reveal if navigator has focus (user is actively using it)
            if (hasNavigatorFocus) {
                debugLog.debug('[AutoReveal] Skipping - navigator has focus');
                return;
            }
            
            // Don't reveal the same file twice in a row
            if (lastRevealedFileRef.current === file.path) {
                debugLog.debug('[AutoReveal] Skipping - same file as last reveal');
                return;
            }
            
            // Reveal the file
            debugLog.debug('[AutoReveal] Setting file to reveal:', file.path);
            setFileToReveal(file);
            lastRevealedFileRef.current = file.path;
        };

        const handleActiveLeafChange = (leaf: WorkspaceLeaf | null) => {
            if (!leaf) return;
            
            // Only process leaves in the main editor area
            if (leaf.getRoot() !== app.workspace.rootSplit) {
                return;
            }
            
            // Get the file from the active view
            const view = leaf.view as any;
            if (view && view.file && view.file instanceof TFile) {
                handleFileChange(view.file);
            }
        };

        const handleFileOpen = (file: TFile | null) => {
            if (file instanceof TFile) {
                // Only process if the file is opened in the main editor area
                const activeLeaf = app.workspace.activeLeaf;
                if (activeLeaf && activeLeaf.getRoot() === app.workspace.rootSplit) {
                    handleFileChange(file);
                }
            }
        };

        const activeLeafEventRef = app.workspace.on('active-leaf-change', handleActiveLeafChange);
        const fileOpenEventRef = app.workspace.on('file-open', handleFileOpen);
        
        // Check for currently active file on mount
        const activeFile = app.workspace.getActiveFile();
        if (activeFile) {
            handleFileChange(activeFile);
        }

        return () => {
            app.workspace.offref(activeLeafEventRef);
            app.workspace.offref(fileOpenEventRef);
        };
    }, [app.workspace, settings.autoRevealActiveFile, uiState.newlyCreatedPath, uiDispatch]);

    return { fileToReveal };
}