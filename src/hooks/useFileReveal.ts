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

import { useEffect, useRef, useCallback, RefObject, useState } from 'react';
import { TFile, TFolder, App, WorkspaceLeaf } from 'obsidian';
import { useSettingsState } from '../context/SettingsContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { isTFolder } from '../utils/typeGuards';
import type { NavigationPaneHandle } from '../components/NavigationPane';
import type { ListPaneHandle } from '../components/ListPane';
import { FileView } from '../types/obsidian-extended';

interface UseFileRevealOptions {
    app: App;
    navigationPaneRef: RefObject<NavigationPaneHandle | null>;
    listPaneRef: RefObject<ListPaneHandle | null>;
}

/**
 * Custom hook that handles all file reveal logic, including:
 * - Manual reveal (via "Reveal file" command)
 * - Auto-reveal (on file open/startup)
 * - Folder expansion behavior
 * - Scroll management
 *
 * This hook encapsulates the complex reveal logic that was previously
 * in the NotebookNavigatorComponent, making it reusable and testable.
 */
export function useFileReveal({ app, navigationPaneRef, listPaneRef }: UseFileRevealOptions) {
    const settings = useSettingsState();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

    // Auto-reveal state
    const [fileToReveal, setFileToReveal] = useState<TFile | null>(null);
    const [isStartupReveal, setIsStartupReveal] = useState<boolean>(false);
    const lastRevealedFileRef = useRef<string | null>(null);
    const hasInitializedRef = useRef<boolean>(false);

    /**
     * Reveals a file in its actual parent folder.
     * Always navigates to the file's parent folder and expands ancestors.
     * Used for: App startup, "Reveal file" command
     *
     * @param file - The file to reveal in its actual folder
     */
    const revealFileInActualFolder = useCallback(
        (file: TFile) => {
            if (!file || !file.parent) return;

            // Always expand folders for actual folder reveal
            const foldersToExpand: string[] = [];
            let currentFolder: TFolder | null = file.parent;

            // Expand all ancestors except the immediate parent
            // This preserves the user's choice of whether the parent is expanded/collapsed
            if (currentFolder && currentFolder.parent) {
                currentFolder = currentFolder.parent; // Skip immediate parent
                while (currentFolder) {
                    foldersToExpand.unshift(currentFolder.path);
                    if (currentFolder.path === '/') break;
                    currentFolder = currentFolder.parent;
                }
            }

            // Expand folders if needed
            const needsExpansion = foldersToExpand.some(path => !expansionState.expandedFolders.has(path));
            if (needsExpansion) {
                expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
            }

            // Trigger the reveal - never preserve folder for actual folder reveals
            selectionDispatch({ type: 'REVEAL_FILE', file, preserveFolder: false });

            // In single pane mode, switch to list pane view
            if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation') {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            // Always shift focus to list pane
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        },
        [selectionState.selectedFolder, expansionState.expandedFolders, expansionDispatch, selectionDispatch, uiState, uiDispatch]
    );

    /**
     * Reveals a file but preserves current folder if it's an ancestor with showNotesFromSubfolders.
     * Used for: Clicking files in sidebar
     *
     * @param file - The file to reveal in nearest appropriate folder
     */
    const revealFileInNearestFolder = useCallback(
        (file: TFile) => {
            if (!file || !file.parent) return;

            // Determine if we should preserve the current folder selection
            let preserveFolder = false;
            if (settings.showNotesFromSubfolders && selectionState.selectedFolder && file.parent) {
                // Check if the file's parent is a descendant of the currently selected folder
                let currentParent: TFolder | null = file.parent;
                while (currentParent) {
                    if (currentParent.path === selectionState.selectedFolder.path) {
                        preserveFolder = true;
                        break;
                    }
                    currentParent = currentParent.parent;
                }
            }

            // Only expand folders if we're not preserving the current folder
            if (!preserveFolder) {
                const foldersToExpand: string[] = [];
                let currentFolder: TFolder | null = file.parent;

                // Expand all ancestors except the immediate parent
                if (currentFolder && currentFolder.parent) {
                    currentFolder = currentFolder.parent; // Skip immediate parent
                    while (currentFolder) {
                        foldersToExpand.unshift(currentFolder.path);
                        if (currentFolder.path === '/') break;
                        currentFolder = currentFolder.parent;
                    }
                }

                // Expand folders if needed
                const needsExpansion = foldersToExpand.some(path => !expansionState.expandedFolders.has(path));
                if (needsExpansion) {
                    expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
                }
            }

            // Trigger the reveal
            selectionDispatch({ type: 'REVEAL_FILE', file, preserveFolder });

            // In single pane mode, switch to list pane view
            if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation') {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            // Don't change focus - let Obsidian handle focus naturally when opening files
        },
        [
            settings.showNotesFromSubfolders,
            selectionState.selectedFolder,
            expansionState.expandedFolders,
            expansionDispatch,
            selectionDispatch,
            uiState,
            uiDispatch
        ]
    );

    /**
     * Navigates to the file's parent folder and reveals it.
     * Always expands folders to show the file's actual location.
     * Use this when the user explicitly wants to see where a file is located.
     *
     * @param file - The file to navigate to
     */
    const navigateToFile = useCallback(
        (file: TFile) => {
            revealFileInActualFolder(file);
        },
        [revealFileInActualFolder]
    );

    /**
     * Navigates to a folder by path, expanding ancestors and selecting it.
     * Used by the "Navigate to folder" command.
     *
     * @param folderPath - The path of the folder to navigate to
     */
    const navigateToFolder = useCallback(
        (folderPath: string) => {
            const folder = app.vault.getAbstractFileByPath(folderPath);
            if (!folder || !isTFolder(folder)) return;

            // Expand all ancestors to make the folder visible
            const foldersToExpand: string[] = [];
            let currentFolder: TFolder | null = folder.parent;

            while (currentFolder) {
                foldersToExpand.unshift(currentFolder.path);
                if (currentFolder.path === '/') break;
                currentFolder = currentFolder.parent;
            }

            // Expand folders if needed
            const needsExpansion = foldersToExpand.some(path => !expansionState.expandedFolders.has(path));
            if (needsExpansion) {
                expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
            }

            // Select the folder
            selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

            // In single pane mode, switch to list pane view and focus list pane
            if (uiState.singlePane) {
                if (uiState.currentSinglePaneView === 'navigation') {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                }
                // Set focus to list pane when in single pane mode
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            } else {
                // In dual-pane mode, focus the folders pane
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
            }
        },
        [app, expansionState.expandedFolders, expansionDispatch, selectionDispatch, uiState, uiDispatch]
    );

    // Auto-reveal effect: Reset fileToReveal after it's been consumed
    useEffect(() => {
        if (fileToReveal) {
            // Clear after a short delay to ensure the consumer has processed it
            const timer = setTimeout(() => {
                setFileToReveal(null);
                setIsStartupReveal(false);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [fileToReveal]);

    // Auto-reveal effect: Detect which file needs revealing
    useEffect(() => {
        if (!settings.autoRevealActiveFile) return;

        const handleFileChange = (file: TFile | null) => {
            if (!file) return;

            // Check if this is a file we just created via the plugin
            const isNewlyCreatedFile = uiState.newlyCreatedPath && file.path === uiState.newlyCreatedPath;

            // Check if this is a newly created file (any file created within last 200ms)
            const isRecentlyCreated = file.stat.ctime === file.stat.mtime && Date.now() - file.stat.ctime < 200;

            // Always reveal newly created files
            if (isNewlyCreatedFile || isRecentlyCreated) {
                setFileToReveal(file);
                lastRevealedFileRef.current = file.path;
                // Clear the newly created path after consuming it
                if (isNewlyCreatedFile) {
                    uiDispatch({ type: 'SET_NEWLY_CREATED_PATH', path: null });
                }
                return;
            }

            // Simple rule: Don't reveal if navigator has focus
            const navigatorEl = document.querySelector('.nn-split-container');
            const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);

            if (hasNavigatorFocus) {
                return;
            }

            // Don't reveal if we're opening a folder note
            if (window.notebookNavigatorOpeningFolderNote) {
                return;
            }

            // Don't reveal the same file twice in a row
            if (lastRevealedFileRef.current === file.path) {
                return;
            }

            // Reveal the file
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
            const view = leaf.view as FileView;
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
                } else {
                }
            }
        };

        const activeLeafEventRef = app.workspace.on('active-leaf-change', handleActiveLeafChange);
        const fileOpenEventRef = app.workspace.on('file-open', handleFileOpen);

        // Check for currently active file on mount
        const activeFile = app.workspace.getActiveFile();
        if (activeFile && !hasInitializedRef.current) {
            setIsStartupReveal(true);
            handleFileChange(activeFile);
            hasInitializedRef.current = true;
        }

        return () => {
            app.workspace.offref(activeLeafEventRef);
            app.workspace.offref(fileOpenEventRef);
        };
    }, [app.workspace, settings.autoRevealActiveFile, uiState.newlyCreatedPath, uiDispatch]);

    // Handle revealing the file when detected
    useEffect(() => {
        if (fileToReveal) {
            // Use requestAnimationFrame to ensure state updates are processed
            requestAnimationFrame(() => {
                if (isStartupReveal) {
                    revealFileInActualFolder(fileToReveal); // Use actual folder for startup
                } else {
                    revealFileInNearestFolder(fileToReveal); // Use nearest folder for sidebar clicks
                }
            });
        }
    }, [fileToReveal, isStartupReveal, revealFileInActualFolder, revealFileInNearestFolder]);

    /**
     * Handle reveal scrolling after selection changes.
     * Folder expansion happens in the reveal functions BEFORE selection changes.
     */
    useEffect(() => {
        // ONLY process if this is a reveal operation, not normal keyboard navigation
        if (selectionState.isRevealOperation && selectionState.selectedFile) {
            const file = selectionState.selectedFile;

            // Scroll to revealed items after animation frame to ensure rendering is complete
            // This replaces the imperative setTimeout approach with a declarative effect
            const rafId = requestAnimationFrame(() => {
                // Scroll to folder in navigation pane - but only if we're not preserving the current folder
                // When preserveFolder is true (showNotesFromSubfolders), we don't want to jump to the subfolder
                // Also, don't scroll if navigation pane is hidden in single-pane mode
                const shouldScrollToFolder =
                    selectionState.selectedFolder &&
                    selectionState.selectedFolder.path === file.parent!.path &&
                    (!uiState.singlePane || uiState.currentSinglePaneView === 'navigation');

                if (shouldScrollToFolder) {
                    const folderIndex = navigationPaneRef.current?.getIndexOfPath(file.parent!.path);

                    if (folderIndex !== undefined && folderIndex !== -1) {
                        navigationPaneRef.current?.virtualizer?.scrollToIndex(folderIndex, { align: 'center', behavior: 'auto' });
                    }
                }

                // Scroll to file in list pane
                const fileIndex = listPaneRef.current?.getIndexOfPath(file.path);

                if (fileIndex !== undefined && fileIndex !== -1 && listPaneRef.current?.virtualizer) {
                    const virtualizer = listPaneRef.current.virtualizer;
                    const scrollElement = listPaneRef.current.scrollContainerRef;

                    if (scrollElement) {
                        // Check if the file is already visible
                        const virtualItems = virtualizer.getVirtualItems();
                        const virtualItem = virtualItems.find(item => item.index === fileIndex);

                        if (virtualItem) {
                            // Check if the item is fully visible in the viewport
                            const containerHeight = scrollElement.offsetHeight;
                            const scrollTop = scrollElement.scrollTop;
                            const itemTop = virtualItem.start;
                            const itemBottom = virtualItem.end;

                            const isFullyVisible = itemTop >= scrollTop && itemBottom <= scrollTop + containerHeight;

                            // Only scroll if the item is not fully visible
                            if (!isFullyVisible) {
                                virtualizer.scrollToIndex(fileIndex, { align: 'center', behavior: 'auto' });
                            } else {
                            }
                        } else {
                            // Item is not in virtual items, so it's definitely not visible
                            virtualizer.scrollToIndex(fileIndex, { align: 'center', behavior: 'auto' });
                        }
                    }
                }
            });

            return () => cancelAnimationFrame(rafId);
        }
    }, [
        selectionState.isRevealOperation,
        selectionState.selectedFolder,
        selectionState.selectedFile,
        navigationPaneRef,
        listPaneRef,
        uiState.singlePane,
        uiState.currentSinglePaneView
    ]);

    return {
        navigateToFile,
        navigateToFolder
    };
}
