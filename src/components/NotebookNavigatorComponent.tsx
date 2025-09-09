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
import { useNavigatorReveal } from '../hooks/useNavigatorReveal';
import { useNavigatorEventHandlers } from '../hooks/useNavigatorEventHandlers';
import { useResizablePane } from '../hooks/useResizablePane';
import { useNavigationActions } from '../hooks/useNavigationActions';
import { useMobileSwipeNavigation } from '../hooks/useSwipeGesture';
import { useTagNavigation } from '../hooks/useTagNavigation';
import { strings } from '../i18n';
import { FolderSuggestModal } from '../modals/FolderSuggestModal';
import { TagSuggestModal } from '../modals/TagSuggestModal';
import { RemoveTagModal } from '../modals/RemoveTagModal';
import { ConfirmModal } from '../modals/ConfirmModal';
import { STORAGE_KEYS, NAVIGATION_PANE_DIMENSIONS, FILE_PANE_DIMENSIONS, ItemType, NAVPANE_MEASUREMENTS } from '../types';
import { getSelectedPath, getFilesForSelection } from '../utils/selectionUtils';
import { deleteSelectedFiles, deleteSelectedFolder } from '../utils/deleteOperations';
import { localStorage } from '../utils/localStorage';
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
    addTagToSelectedFiles: () => Promise<void>;
    removeTagFromSelectedFiles: () => Promise<void>;
    removeAllTagsFromSelectedFiles: () => Promise<void>;
    toggleSearch: () => void;
    triggerCollapse: () => void;
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
        const { app, isMobile, fileSystemOps, plugin, tagTreeService, commandQueue, tagOperations } = useServices();
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

        // Use navigator reveal logic
        const { revealFileInActualFolder, navigateToFolder } = useNavigatorReveal({ app, navigationPaneRef, listPaneRef });

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

                // Only check width on very first startup (when there's no saved pane width)
                const savedWidth = localStorage.get<number>(STORAGE_KEYS.navigationPaneWidthKey);
                const isFirstRun = !savedWidth;

                // Auto-disable dual pane mode on first startup if viewport is too narrow for both panes
                if (node && !isMobile && !hasCheckedInitialVisibility.current && settings.dualPane && isFirstRun) {
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

        // Get navigation actions
        const { handleExpandCollapseAll } = useNavigationActions();

        // Expose methods via ref
        useImperativeHandle(ref, () => {
            // Helper function to get selected files
            const getSelectedFiles = (): TFile[] => {
                // Get selected files
                const selectedFiles = Array.from(selectionState.selectedFiles)
                    .map(path => app.vault.getFileByPath(path))
                    .filter((f): f is TFile => !!f);

                if (selectedFiles.length === 0) {
                    // No files selected, try current file
                    if (selectionState.selectedFile) {
                        selectedFiles.push(selectionState.selectedFile);
                    }
                }

                return selectedFiles;
            };

            return {
                navigateToFile: revealFileInActualFolder,
                focusFilePane: () => {
                    // In single pane mode, switch to file list view
                    if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation') {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    }

                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    // Focus the container to ensure keyboard navigation works
                    // Don't steal focus if we're opening version history or in a new context
                    const isOpeningVersionHistory = commandQueue?.isOpeningVersionHistory() || false;
                    const isOpeningInNewContext = commandQueue?.isOpeningInNewContext() || false;
                    if (!isOpeningVersionHistory && !isOpeningInNewContext) {
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
                            selectionDispatch,
                            tagTreeService
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
                    await fileSystemOps.createNewFile(selectionState.selectedFolder);
                },
                moveSelectedFiles: async () => {
                    // Get selected files
                    const selectedFiles = getSelectedFiles();

                    if (selectedFiles.length === 0) {
                        new Notice(strings.fileSystem.errors.noFileSelected);
                        return;
                    }

                    // Get all files in the current view for smart selection
                    const allFiles = getFilesForSelection(selectionState, settings, app, tagTreeService);

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
                },
                addTagToSelectedFiles: async () => {
                    if (!tagOperations) {
                        new Notice(strings.fileSystem.notifications.tagOperationsNotAvailable);
                        return;
                    }

                    // Get selected files
                    const selectedFiles = getSelectedFiles();
                    if (selectedFiles.length === 0) {
                        new Notice(strings.fileSystem.notifications.noFilesSelected);
                        return;
                    }

                    // Show tag selection modal
                    const modal = new TagSuggestModal(
                        app,
                        plugin,
                        async (tag: string) => {
                            const result = await tagOperations.addTagToFiles(tag, selectedFiles);
                            const message =
                                result.added === 1
                                    ? strings.fileSystem.notifications.tagAddedToNote
                                    : strings.fileSystem.notifications.tagAddedToNotes.replace('{count}', result.added.toString());
                            new Notice(message);
                        },
                        strings.modals.tagSuggest.addPlaceholder,
                        strings.modals.tagSuggest.instructions.add,
                        false // Don't include untagged
                    );
                    modal.open();
                },
                removeTagFromSelectedFiles: async () => {
                    if (!tagOperations) {
                        new Notice(strings.fileSystem.notifications.tagOperationsNotAvailable);
                        return;
                    }

                    // Get selected files
                    const selectedFiles = getSelectedFiles();
                    if (selectedFiles.length === 0) {
                        new Notice(strings.fileSystem.notifications.noFilesSelected);
                        return;
                    }

                    // Get tags from selected files
                    const existingTags = tagOperations.getTagsFromFiles(selectedFiles);
                    if (existingTags.length === 0) {
                        new Notice(strings.fileSystem.notifications.noTagsToRemove);
                        return;
                    }

                    // If only one tag exists, remove it directly without showing modal
                    if (existingTags.length === 1) {
                        const result = await tagOperations.removeTagFromFiles(existingTags[0], selectedFiles);
                        const message =
                            result === 1
                                ? strings.fileSystem.notifications.tagRemovedFromNote
                                : strings.fileSystem.notifications.tagRemovedFromNotes.replace('{count}', result.toString());
                        new Notice(message);
                        return;
                    }

                    // Show modal to select which tag to remove
                    const modal = new RemoveTagModal(app, existingTags, async (tag: string) => {
                        const result = await tagOperations.removeTagFromFiles(tag, selectedFiles);
                        const message =
                            result === 1
                                ? strings.fileSystem.notifications.tagRemovedFromNote
                                : strings.fileSystem.notifications.tagRemovedFromNotes.replace('{count}', result.toString());
                        new Notice(message);
                    });
                    modal.open();
                },
                removeAllTagsFromSelectedFiles: async () => {
                    if (!tagOperations) {
                        new Notice(strings.fileSystem.notifications.tagOperationsNotAvailable);
                        return;
                    }

                    // Get selected files
                    const selectedFiles = getSelectedFiles();
                    if (selectedFiles.length === 0) {
                        new Notice(strings.fileSystem.notifications.noFilesSelected);
                        return;
                    }

                    // Check if files have tags
                    const existingTags = tagOperations.getTagsFromFiles(selectedFiles);
                    if (existingTags.length === 0) {
                        new Notice(strings.fileSystem.notifications.noTagsToRemove);
                        return;
                    }

                    // Show confirmation dialog
                    const confirmModal = new ConfirmModal(
                        app,
                        strings.modals.fileSystem.removeAllTagsTitle,
                        selectedFiles.length === 1
                            ? strings.modals.fileSystem.removeAllTagsFromNote
                            : strings.modals.fileSystem.removeAllTagsFromNotes.replace('{count}', selectedFiles.length.toString()),
                        async () => {
                            const result = await tagOperations.clearAllTagsFromFiles(selectedFiles);
                            const message =
                                result === 1
                                    ? strings.fileSystem.notifications.tagsClearedFromNote
                                    : strings.fileSystem.notifications.tagsClearedFromNotes.replace('{count}', result.toString());
                            new Notice(message);
                        },
                        strings.common.remove
                    );
                    confirmModal.open();
                },
                toggleSearch: () => {
                    listPaneRef.current?.toggleSearch();
                },
                triggerCollapse: () => {
                    handleExpandCollapseAll();
                    // Request scroll to selected item after collapse/expand
                    requestAnimationFrame(() => {
                        const selectedPath = getSelectedPath(selectionState);
                        if (selectedPath && navigationPaneRef.current) {
                            navigationPaneRef.current.requestScroll(selectedPath);
                        }
                    });
                }
            };
        }, [
            revealFileInActualFolder,
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
            plugin,
            tagTreeService,
            commandQueue,
            tagOperations,
            handleExpandCollapseAll,
            navigationPaneRef
        ]);

        // Add platform class
        if (isMobile) {
            containerClasses.push('nn-mobile');
        } else {
            containerClasses.push('nn-desktop');
        }

        // Add layout mode class
        if (uiState.singlePane) {
            containerClasses.push('nn-single-pane');
            containerClasses.push(uiState.currentSinglePaneView === 'navigation' ? 'show-navigation' : 'show-files');
        } else {
            containerClasses.push('nn-dual-pane');
        }
        if (isResizing) {
            containerClasses.push('nn-resizing');
        }

        // Apply dynamic CSS variables for item heights and font size
        useEffect(() => {
            if (containerRef.current) {
                const navItemHeight = settings.navItemHeight;
                const defaultHeight = NAVPANE_MEASUREMENTS.defaultItemHeight;
                const defaultFontSize = NAVPANE_MEASUREMENTS.defaultFontSize;

                // Calculate font sizes based on item height (default 28px)
                // Desktop: default 13px, 12px if height ≤24, 11px if height ≤22
                let fontSize = defaultFontSize;
                if (navItemHeight <= defaultHeight - 6) {
                    // ≤22
                    fontSize = defaultFontSize - 2; // 11px
                } else if (navItemHeight <= defaultHeight - 4) {
                    // ≤24
                    fontSize = defaultFontSize - 1; // 12px
                }

                // Mobile adjustments
                const mobileNavItemHeight = navItemHeight + NAVPANE_MEASUREMENTS.mobileHeightIncrement;
                const mobileFontSize = fontSize + NAVPANE_MEASUREMENTS.mobileFontSizeIncrement;

                // Calculate padding: (total height - line height) / 2
                // Line height is fixed at 18px in CSS (--nn-nav-line-height)
                const desktopPadding = Math.floor((navItemHeight - NAVPANE_MEASUREMENTS.lineHeight) / 2);
                const mobilePadding = Math.floor((mobileNavItemHeight - NAVPANE_MEASUREMENTS.lineHeight) / 2);

                containerRef.current.style.setProperty('--nn-setting-nav-item-height', `${navItemHeight}px`);
                containerRef.current.style.setProperty('--nn-setting-nav-item-height-mobile', `${mobileNavItemHeight}px`);
                containerRef.current.style.setProperty('--nn-setting-nav-padding-vertical', `${desktopPadding}px`);
                containerRef.current.style.setProperty('--nn-setting-nav-padding-vertical-mobile', `${mobilePadding}px`);
                containerRef.current.style.setProperty('--nn-setting-nav-font-size', `${fontSize}px`);
                containerRef.current.style.setProperty('--nn-setting-nav-font-size-mobile', `${mobileFontSize}px`);
                containerRef.current.style.setProperty('--nn-setting-nav-indent', `${settings.navIndent}px`);
            }
        }, [settings.navItemHeight, settings.navIndent]);

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
                <ListPane
                    ref={listPaneRef}
                    rootContainerRef={containerRef}
                    resizeHandleProps={!uiState.singlePane ? resizeHandleProps : undefined}
                />
            </div>
        );
    })
);
