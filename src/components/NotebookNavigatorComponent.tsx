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

// src/components/NotebookNavigatorComponent.tsx
import React, { useEffect, useImperativeHandle, forwardRef, useRef, useState, useCallback } from 'react';
import { TFile, TFolder, Notice } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useFileReveal } from '../hooks/useFileReveal';
import { useNavigatorEventHandlers } from '../hooks/useNavigatorEventHandlers';
import { useResizablePane } from '../hooks/useResizablePane';
import { useMobileSwipeNavigation } from '../hooks/useSwipeGesture';
import { useTagNavigation } from '../hooks/useTagNavigation';
import { strings } from '../i18n';
import { FolderSuggestModal } from '../modals/FolderSuggestModal';
import { TagSuggestModal } from '../modals/TagSuggestModal';
import { STORAGE_KEYS, NAVIGATION_PANE_DIMENSIONS, FILE_PANE_DIMENSIONS, ItemType } from '../types';
import { deleteSelectedFiles, deleteSelectedFolder } from '../utils/deleteOperations';
import { getFilesForFolder, getFilesForTag } from '../utils/fileFinder';
import { ListPane } from './ListPane';
import type { ListPaneHandle } from './ListPane';
import { NavigationPane } from './NavigationPane';
import type { NavigationPaneHandle } from './NavigationPane';

export interface NotebookNavigatorHandle {
    navigateToFile: (file: TFile) => void;
    focusFilePane: () => void;
    refresh: () => void;
    deleteActiveFile: () => void;
    createNoteInSelectedFolder: () => Promise<void>;
    moveSelectedFiles: () => Promise<void>;
    navigateToFolder: (folderPath: string) => void;
    navigateToFolderWithModal: () => void;
    navigateToTagWithModal: () => void;
}

/**
 * Main container component for the Notebook Navigator plugin.
 * Provides a two-pane layout with resizable divider, folder tree on the left,
 * and file list on the right. Manages keyboard navigation, drag-and-drop,
 * and auto-reveal functionality for the active file.
 *
 * @param _ - Props (none used)
 * @param ref - Forwarded ref exposing revealFile and focusFilePane methods
 * @returns A split-pane container with folder tree and file list
 */
export const NotebookNavigatorComponent = React.memo(
    forwardRef<NotebookNavigatorHandle>(function NotebookNavigatorComponent(_, ref) {
        const { app, isMobile, fileSystemOps, plugin } = useServices();
        const settings = useSettingsState();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();

        // Root container reference for the entire navigator
        // This ref is passed to both NavigationPane and ListPane to ensure
        // keyboard events are captured at the navigator level, not globally.
        // This prevents interference with other Obsidian views (e.g., canvas editor).
        const containerRef = useRef<HTMLDivElement>(null);

        const [isNavigatorFocused, setIsNavigatorFocused] = useState(false);
        const navigationPaneRef = useRef<NavigationPaneHandle>(null);
        const listPaneRef = useRef<ListPaneHandle>(null);

        // Enable resizable pane
        const { paneWidth, isResizing, resizeHandleProps } = useResizablePane({
            initialWidth: NAVIGATION_PANE_DIMENSIONS.defaultWidth,
            min: NAVIGATION_PANE_DIMENSIONS.minWidth,
            storageKey: STORAGE_KEYS.navigationPaneWidthKey
        });

        // Use file reveal logic
        const { navigateToFile, navigateToFolder } = useFileReveal({ app, navigationPaneRef, listPaneRef });

        // Use tag navigation logic
        const { navigateToTag } = useTagNavigation();

        // Get updateSettings from SettingsContext for refresh
        const updateSettings = useSettingsUpdate();

        // Track if initial visibility check has been performed
        const hasCheckedInitialVisibility = useRef(false);

        // Container ref callback that checks if file list is visible on first mount
        const containerCallbackRef = useCallback(
            (node: HTMLDivElement | null) => {
                containerRef.current = node;

                // Auto-disable dual pane mode on startup if viewport is too narrow for both panes
                if (node && !isMobile && !hasCheckedInitialVisibility.current && settings.dualPane) {
                    hasCheckedInitialVisibility.current = true;

                    const containerWidth = node.getBoundingClientRect().width;
                    // Check if container is too narrow to show both panes
                    if (containerWidth < paneWidth + FILE_PANE_DIMENSIONS.minWidth) {
                        updateSettings(settings => {
                            settings.dualPane = false;
                        });
                    }
                }
            },
            [isMobile, paneWidth, settings.dualPane, updateSettings]
        );

        // Determine CSS classes
        const containerClasses = ['nn-split-container'];

        // Handle side effects when dualPane setting changes
        useEffect(() => {
            if (!isMobile && !settings.dualPane) {
                // When disabling dual pane mode, switch to files view and focus it
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            }
        }, [settings.dualPane, isMobile, uiDispatch]);

        // Enable drag and drop only on desktop
        useDragAndDrop(containerRef);

        // Enable mobile swipe gestures
        useMobileSwipeNavigation(containerRef, isMobile);

        // Use event handlers
        useNavigatorEventHandlers({
            app,
            containerRef,
            setIsNavigatorFocused
        });

        // Expose methods via ref
        useImperativeHandle(
            ref,
            () => ({
                navigateToFile,
                focusFilePane: () => {
                    // In single pane mode, switch to file list view
                    if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation') {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    }

                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    // Focus the container to ensure keyboard navigation works
                    // Don't steal focus if we're opening version history
                    const isOpeningVersionHistory = window.notebookNavigatorOpeningVersionHistory;
                    if (!isOpeningVersionHistory) {
                        containerRef.current?.focus();
                    }
                },
                refresh: () => {
                    // A no-op update will increment the version and force a re-render
                    updateSettings(() => {});
                },
                deleteActiveFile: () => {
                    // Determine which delete operation to perform based on focus
                    if (uiState.focusedPane === 'files' && (selectionState.selectedFile || selectionState.selectedFiles.size > 0)) {
                        deleteSelectedFiles({
                            app,
                            fileSystemOps,
                            settings,
                            selectionState,
                            selectionDispatch
                        });
                    } else if (
                        uiState.focusedPane === 'navigation' &&
                        selectionState.selectionType === ItemType.FOLDER &&
                        selectionState.selectedFolder
                    ) {
                        deleteSelectedFolder({
                            app,
                            fileSystemOps,
                            settings,
                            selectionState,
                            selectionDispatch
                        });
                    }
                },
                createNoteInSelectedFolder: async () => {
                    if (!selectionState.selectedFolder) {
                        new Notice(strings.fileSystem.errors.noFolderSelected);
                        return;
                    }

                    // Use the same logic as the context menu
                    const file = await fileSystemOps.createNewFile(selectionState.selectedFolder);
                    if (file) {
                        uiDispatch({ type: 'SET_NEWLY_CREATED_PATH', path: file.path });
                    }
                },
                moveSelectedFiles: async () => {
                    // Get selected files
                    const selectedFiles = Array.from(selectionState.selectedFiles)
                        .map(path => app.vault.getAbstractFileByPath(path))
                        .filter((f): f is TFile => f instanceof TFile);

                    if (selectedFiles.length === 0) {
                        // No files selected, try current file
                        if (selectionState.selectedFile) {
                            selectedFiles.push(selectionState.selectedFile);
                        } else {
                            new Notice(strings.fileSystem.errors.noFileSelected);
                            return;
                        }
                    }

                    // Get all files in the current view for smart selection
                    let allFiles: TFile[] = [];
                    if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                        allFiles = getFilesForFolder(selectionState.selectedFolder, settings, app);
                    } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                        allFiles = getFilesForTag(selectionState.selectedTag, settings, app);
                    }

                    // Move files with modal
                    await fileSystemOps.moveFilesWithModal(selectedFiles, {
                        selectedFile: selectionState.selectedFile,
                        dispatch: selectionDispatch,
                        allFiles
                    });
                },
                navigateToFolder,
                navigateToFolderWithModal: () => {
                    // Show the folder selection modal for navigation
                    const modal = new FolderSuggestModal(
                        app,
                        (targetFolder: TFolder) => {
                            // Navigate to the selected folder
                            navigateToFolder(targetFolder.path);
                        },
                        strings.modals.folderSuggest.navigatePlaceholder,
                        strings.modals.folderSuggest.instructions.select,
                        undefined // No folders to exclude
                    );
                    modal.open();
                },
                navigateToTagWithModal: () => {
                    // Show the tag selection modal for navigation
                    const modal = new TagSuggestModal(
                        app,
                        plugin,
                        (tagPath: string) => {
                            // Use the shared tag navigation logic
                            navigateToTag(tagPath);
                        },
                        strings.modals.tagSuggest.navigatePlaceholder,
                        strings.modals.tagSuggest.instructions.select,
                        true // Include untagged option
                    );
                    modal.open();
                }
            }),
            [
                navigateToFile,
                uiDispatch,
                updateSettings,
                selectionState,
                fileSystemOps,
                selectionDispatch,
                navigateToFolder,
                navigateToTag,
                uiState.singlePane,
                uiState.currentSinglePaneView,
                uiState.focusedPane,
                app,
                settings,
                plugin
            ]
        );

        if (isMobile && uiState.singlePane) {
            // Mobile uses sliding animations with show-list/show-files classes
            containerClasses.push(uiState.currentSinglePaneView === 'navigation' ? 'show-navigation' : 'show-files');
        } else if (uiState.singlePane) {
            // Desktop single-pane mode
            containerClasses.push('nn-desktop-single-pane');
            containerClasses.push(uiState.currentSinglePaneView === 'navigation' ? 'show-navigation' : 'show-files');
        } else {
            // Desktop dual-pane mode
            containerClasses.push('nn-desktop');
        }
        if (isResizing) {
            containerClasses.push('nn-resizing');
        }

        return (
            <div
                ref={containerCallbackRef}
                className={containerClasses.join(' ')}
                data-focus-pane={
                    uiState.singlePane ? (uiState.currentSinglePaneView === 'navigation' ? 'navigation' : 'files') : uiState.focusedPane
                }
                data-navigator-focused={isMobile ? 'true' : isNavigatorFocused}
                tabIndex={-1}
                onKeyDown={() => {
                    // Allow keyboard events to bubble up from child components
                    // The actual keyboard handling is done in NavigationPane and ListPane
                }}
            >
                {/* KEYBOARD EVENT FLOW:
                1. Both NavigationPane and ListPane receive the same containerRef
                2. Each pane sets up keyboard listeners on this shared container
                3. The listeners check which pane has focus before handling events
                4. This allows Tab/Arrow navigation between panes while keeping
                   all keyboard events scoped to the navigator container only
            */}
                <NavigationPane
                    ref={navigationPaneRef}
                    style={{ width: uiState.singlePane ? '100%' : `${paneWidth}px` }}
                    rootContainerRef={containerRef}
                />
                {!uiState.singlePane && <div className="nn-resize-handle" {...resizeHandleProps} />}
                <ListPane ref={listPaneRef} rootContainerRef={containerRef} />
            </div>
        );
    })
);
