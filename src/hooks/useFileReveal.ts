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
import type { ListPaneHandle } from '../components/ListPane';
import type { NavigationPaneHandle } from '../components/NavigationPane';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useFileCache } from '../context/StorageContext';
import { FileView } from '../types/obsidian-extended';
import { isTFolder } from '../utils/typeGuards';
import { determineTagToReveal } from '../utils/tagUtils';
import { ItemType } from '../types';
import { buildTagTree, findTagNode, parseTagPatterns, matchesTagPattern } from '../utils/tagTree';

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
    const { getDB } = useFileCache();

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
            selectionDispatch({ type: 'REVEAL_FILE', file, preserveFolder: false, isManualReveal: true });

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
     * Reveals a tag in the navigation pane by expanding parent tags if needed.
     *
     * @param tagPath - The tag path to reveal (without # prefix)
     */
    const revealTag = useCallback(
        (tagPath: string) => {
            if (!tagPath) return;

            // Build tag tree to find parent tags
            const { tree: tagTree } = buildTagTree(app.vault.getMarkdownFiles(), app);
            const tagNode = findTagNode(tagTree, tagPath);

            if (!tagNode) return;

            // Expand virtual folders if needed
            const virtualFoldersToExpand: string[] = [];

            // Check if we need to expand virtual folders based on settings
            if (settings.showTags) {
                // Parse favorite patterns to determine which virtual folder contains this tag
                const favoritePatterns = parseTagPatterns(settings.favoriteTags.join(','));
                const isFavorite = favoritePatterns.length > 0 && favoritePatterns.some(pattern => matchesTagPattern(tagPath, pattern));

                if (favoritePatterns.length > 0) {
                    // We have favorites configured
                    if (settings.showFavoriteTagsFolder && isFavorite) {
                        virtualFoldersToExpand.push('favorite-tags-root');
                    } else if (settings.showAllTagsFolder && !isFavorite) {
                        virtualFoldersToExpand.push('all-tags-root');
                    }
                } else {
                    // No favorites, just regular tags folder
                    virtualFoldersToExpand.push('tags-root');
                }
            }

            // Expand virtual folders if needed
            const virtualFoldersNeedExpansion = virtualFoldersToExpand.some(id => !expansionState.expandedVirtualFolders.has(id));
            if (virtualFoldersNeedExpansion) {
                const newExpanded = new Set(expansionState.expandedVirtualFolders);
                virtualFoldersToExpand.forEach(id => newExpanded.add(id));
                expansionDispatch({ type: 'SET_EXPANDED_VIRTUAL_FOLDERS', folders: newExpanded });
            }

            // Expand parent tags if needed
            const tagsToExpand: string[] = [];
            const parts = tagPath.split('/');

            // Build parent paths
            for (let i = 1; i < parts.length; i++) {
                const parentPath = parts.slice(0, i).join('/');
                tagsToExpand.push(parentPath);
            }

            // Expand tags if needed
            const needsExpansion = tagsToExpand.some(path => !expansionState.expandedTags.has(path));
            if (needsExpansion) {
                expansionDispatch({ type: 'EXPAND_TAGS', tagPaths: tagsToExpand });
            }

            // Select the tag
            selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagPath });

            // In single pane mode, ensure we're showing the navigation pane
            if (uiState.singlePane && uiState.currentSinglePaneView === 'files') {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
            }
        },
        [
            app,
            expansionState.expandedTags,
            expansionState.expandedVirtualFolders,
            expansionDispatch,
            selectionDispatch,
            uiState,
            uiDispatch,
            settings
        ]
    );

    /**
     * Reveals a file but preserves current folder if it's an ancestor with showNotesFromSubfolders.
     * Now also handles intelligent tag switching for auto-reveals.
     * Used for: Clicking files in sidebar
     *
     * @param file - The file to reveal in nearest appropriate folder
     */
    const revealFileInNearestFolder = useCallback(
        (file: TFile) => {
            if (!file || !file.parent) return;

            // Check if we're in tag view and should switch tags
            let targetTag: string | null | undefined = undefined;
            if (selectionState.selectionType === 'tag') {
                targetTag = determineTagToReveal(file, selectionState.selectedTag, settings, getDB());

                // If we have a target tag, expand parent tags
                if (targetTag) {
                    const parts = targetTag.split('/');
                    const tagsToExpand: string[] = [];

                    // Build parent paths
                    for (let i = 1; i < parts.length; i++) {
                        const parentPath = parts.slice(0, i).join('/');
                        tagsToExpand.push(parentPath);
                    }

                    // Expand tags if needed
                    const needsExpansion = tagsToExpand.some(path => !expansionState.expandedTags.has(path));
                    if (needsExpansion) {
                        expansionDispatch({ type: 'EXPAND_TAGS', tagPaths: tagsToExpand });
                    }
                }
            }

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

            // Only expand folders if we're not preserving the current folder and not switching to tag view
            if (!preserveFolder && targetTag === null) {
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

            // Trigger the reveal - this is an auto-reveal, not manual
            selectionDispatch({ type: 'REVEAL_FILE', file, preserveFolder, isManualReveal: false, targetTag });

            // In single pane mode, switch to list pane view
            if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation') {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            // Don't change focus - let Obsidian handle focus naturally when opening files
        },
        [
            app,
            settings,
            selectionState.selectedFolder,
            selectionState.selectionType,
            selectionState.selectedTag,
            expansionState.expandedFolders,
            expansionState.expandedTags,
            expansionDispatch,
            selectionDispatch,
            uiState,
            uiDispatch,
            getDB
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
                    // On startup, if we're already in tag view with the correct file selected, skip reveal but expand tags
                    if (
                        selectionState.selectionType === ItemType.TAG &&
                        selectionState.selectedTag &&
                        selectionState.selectedFile?.path === fileToReveal.path
                    ) {
                        revealTag(selectionState.selectedTag);
                        return;
                    }
                    revealFileInActualFolder(fileToReveal); // Use actual folder for startup
                } else {
                    revealFileInNearestFolder(fileToReveal); // Use nearest folder for sidebar clicks
                }
            });
        }
    }, [
        fileToReveal,
        isStartupReveal,
        revealFileInActualFolder,
        revealFileInNearestFolder,
        selectionState.selectionType,
        selectionState.selectedTag,
        revealTag
    ]);

    /**
     * Handle reveal scrolling after selection changes.
     * Folder expansion happens in the reveal functions BEFORE selection changes.
     */
    useEffect(() => {
        // ONLY process if this is a reveal operation, not normal keyboard navigation
        if (selectionState.isRevealOperation && selectionState.selectedFile) {
            const file = selectionState.selectedFile;

            // Scroll to revealed items after animation frame to ensure rendering is complete
            const rafId = requestAnimationFrame(() => {
                // Scroll to folder or tag in navigation pane
                // Don't scroll if navigation pane is hidden in single-pane mode
                const shouldScrollNavigation = !uiState.singlePane || uiState.currentSinglePaneView === 'navigation';

                if (shouldScrollNavigation) {
                    if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                        // Scroll to tag
                        const tagIndex = navigationPaneRef.current?.getIndexOfPath(selectionState.selectedTag);

                        if (tagIndex !== undefined && tagIndex !== -1) {
                            navigationPaneRef.current?.virtualizer?.scrollToIndex(tagIndex, { align: 'center', behavior: 'auto' });
                        }
                    } else if (selectionState.selectedFolder && selectionState.selectedFolder.path === file.parent!.path) {
                        // Scroll to folder - but only if we're not preserving the current folder
                        // When preserveFolder is true (showNotesFromSubfolders), we don't want to jump to the subfolder
                        const folderIndex = navigationPaneRef.current?.getIndexOfPath(file.parent!.path);

                        if (folderIndex !== undefined && folderIndex !== -1) {
                            navigationPaneRef.current?.virtualizer?.scrollToIndex(folderIndex, { align: 'center', behavior: 'auto' });
                        }
                    }
                }

                // ListPane now handles reveal scrolling via pendingScrollRef
                // This ensures proper measurement for large folders before scrolling
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
        navigateToFolder,
        revealTag
    };
}
