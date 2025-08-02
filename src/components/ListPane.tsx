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

import React, { useMemo, useCallback, useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { TFile, debounce } from 'obsidian';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useMultiSelection } from '../hooks/useMultiSelection';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { strings } from '../i18n';
import { ListPaneItemType, ItemType, LISTPANE_MEASUREMENTS, OVERSCAN } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { DateUtils } from '../utils/dateUtils';
import { getFilesForFolder, getFilesForTag, collectPinnedPaths } from '../utils/fileFinder';
import { getDateField, getEffectiveSortOption, sortFiles } from '../utils/sortUtils';
import { FileItem } from './FileItem';
import { ListPaneHeader } from './ListPaneHeader';

/**
 * Renders the list pane displaying files from the selected folder.
 * Handles file sorting, grouping by date, pinned notes, and auto-selection.
 * Integrates with the app context to manage file selection and navigation.
 *
 * @returns A scrollable list of files grouped by date (if enabled) with empty state handling
 */
export interface ListPaneHandle {
    getIndexOfPath: (path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
}

interface ListPaneProps {
    /**
     * Reference to the root navigator container (.nn-split-container).
     * This is passed from NotebookNavigatorComponent to ensure keyboard events
     * are captured at the navigator level, not globally. This allows proper
     * keyboard navigation between panes while preventing interference with
     * other Obsidian views.
     */
    rootContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const ListPane = React.memo(
    forwardRef<ListPaneHandle, ListPaneProps>(function ListPane(props, ref) {
        const { app, isMobile, tagTreeService } = useServices();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();
        const { getFileCreatedTime, getFileModifiedTime, getDB } = useFileCache();

        // Track if the file selection is from user click vs auto-selection
        const isUserSelectionRef = useRef(false);

        // Keep track of the last selected file path to maintain visual selection during transitions
        const lastSelectedFilePathRef = useRef<string | null>(null);

        // Track current visible date group for sticky header
        const [currentDateGroup, setCurrentDateGroup] = useState<string | null>(null);

        // State to force updates when vault changes
        const [updateKey, setUpdateKey] = useState(0);

        // Initialize multi-selection hook
        const multiSelection = useMultiSelection();

        const [listItems, setListItems] = useState<ListPaneItem[]>([]);

        // Add ref for scroll container
        const scrollContainerRef = useRef<HTMLDivElement>(null);

        // Callback for when scroll container ref is set
        const scrollContainerRefCallback = useCallback((element: HTMLDivElement | null) => {
            if (element && element !== scrollContainerRef.current) {
                // Intentionally empty - just updating the ref
            }
            scrollContainerRef.current = element as HTMLDivElement;
        }, []);

        // Track render count
        const renderCountRef = useRef(0);

        // Track list state changes and pending scroll operations
        const prevListKeyRef = useRef<string>(''); // Previous folder/tag context to detect navigation
        const prevShowSubfoldersRef = useRef<boolean>(settings.showNotesFromSubfolders); // Previous subfolder setting to detect toggles
        const pendingScrollRef = useRef<{ type: 'file' | 'top'; filePath?: string } | null>(null); // Deferred scroll operations for async list updates
        const [pendingScrollVersion, setPendingScrollVersion] = useState(0); // Track pending scroll changes to trigger effects

        // Track list items order to detect when items are reordered
        const listItemsKeyRef = useRef('');

        // Get sync preview check function
        const { hasPreview, isStorageReady } = useFileCache();

        // Check if we're in slim mode
        const isSlimMode = !settings.showFileDate && !settings.showFilePreview && !settings.showFeatureImage;

        // Initialize virtualizer
        const rowVirtualizer = useVirtualizer({
            count: listItems.length,
            getScrollElement: () => {
                const element = scrollContainerRef.current;
                if (!element) {
                    // No element available yet
                }
                return element;
            },
            estimateSize: index => {
                const item = listItems[index];
                const { heights } = LISTPANE_MEASUREMENTS;

                if (item.type === ListPaneItemType.HEADER) {
                    // Date group headers have fixed heights from CSS
                    const isFirstHeader = index === 0;
                    if (isFirstHeader) {
                        return heights.firstHeader;
                    }
                    return heights.subsequentHeader;
                }

                if (item.type === ListPaneItemType.SPACER) {
                    return heights.spacer;
                }

                // For file items - calculate height including all components
                const { showFileDate, showFilePreview, fileNameRows, previewRows } = settings;

                // Get actual preview status for accurate height calculation
                let hasPreviewText = false;
                if (item.type === ListPaneItemType.FILE && item.data instanceof TFile && showFilePreview && item.data.extension === 'md') {
                    // Use pre-computed metadata instead of cache lookup
                    hasPreviewText = item.metadata?.hasPreview ?? false;
                }

                // Calculate effective preview rows based on actual content
                const effectivePreviewRows = hasPreviewText ? previewRows : 1;

                // Start with base padding
                let textContentHeight = 0;

                if (isSlimMode) {
                    // Slim mode: only shows file name
                    textContentHeight = heights.titleLineHeight * (fileNameRows || 1);
                } else {
                    // Normal mode
                    textContentHeight += heights.titleLineHeight * (fileNameRows || 1); // File name

                    // Single row mode - show date+preview, tags, and parent folder
                    if (previewRows < 2) {
                        // Date and preview share one line
                        if (showFilePreview || showFileDate) {
                            textContentHeight += heights.metadataLineHeight;
                        }

                        // Parent folder gets its own line
                        if (settings.showParentFolderNames && settings.showNotesFromSubfolders) {
                            const isInSubfolder = item.metadata?.isInSubfolder ?? false;
                            if (isInSubfolder) {
                                textContentHeight += heights.metadataLineHeight;
                            }
                        }
                    } else {
                        // Multi-row mode - different layouts based on preview content
                        if (!hasPreviewText) {
                            // Empty preview: show date + parent folder on same line
                            const isInSubfolder = item.metadata?.isInSubfolder ?? false;
                            const showsParentFolder = settings.showParentFolderNames && settings.showNotesFromSubfolders && isInSubfolder;

                            if (showFileDate || showsParentFolder) {
                                textContentHeight += heights.metadataLineHeight;
                            }
                        } else {
                            // Has preview text: show multi-line preview, then date + parent folder
                            if (showFilePreview) {
                                textContentHeight += heights.multiLineLineHeight * effectivePreviewRows;
                            }
                            // Only add metadata line if date is shown OR parent folder is shown
                            const isInSubfolder = item.metadata?.isInSubfolder ?? false;
                            const showsParentFolder = settings.showParentFolderNames && settings.showNotesFromSubfolders && isInSubfolder;

                            if (showFileDate || showsParentFolder) {
                                textContentHeight += heights.metadataLineHeight;
                            }
                        }
                    }
                }

                // Add tag row height if file has tags (in both normal and slim modes when showTags is enabled)
                // Tags are shown for both empty and non-empty preview text
                if (settings.showFileTags && item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
                    // Use pre-computed metadata instead of database lookup
                    const hasTags = item.metadata?.hasTags ?? false;

                    if (hasTags) {
                        textContentHeight += heights.tagRowHeight;
                    }
                }

                // Apply min-height constraint AFTER including all content (but not in slim mode)
                // This ensures text content aligns with feature image height when shown
                if (!isSlimMode && textContentHeight < heights.featureImageHeight) {
                    textContentHeight = heights.featureImageHeight;
                }

                // Use reduced padding for slim mode
                const padding = isSlimMode ? heights.slimPadding : heights.basePadding;
                return padding + textContentHeight;
            },
            overscan: OVERSCAN,
            scrollPaddingStart: 0,
            scrollPaddingEnd: 0
        });

        const handleFileClick = useCallback(
            (file: TFile, e: React.MouseEvent, fileIndex?: number, orderedFiles?: TFile[]) => {
                isUserSelectionRef.current = true; // Mark this as a user selection

                // Check if CMD (Mac) or Ctrl (Windows/Linux) is pressed for multi-select
                const isMultiSelectModifier = e.metaKey || e.ctrlKey;
                const isShiftKey = e.shiftKey;

                // Don't enable multi-select on mobile
                if (!isMobile && isMultiSelectModifier) {
                    multiSelection.handleMultiSelectClick(file, fileIndex, orderedFiles);
                } else if (!isMobile && isShiftKey && fileIndex !== undefined && orderedFiles) {
                    multiSelection.handleRangeSelectClick(file, fileIndex, orderedFiles);
                } else {
                    // Normal click - always clear multi-selection and select only this file
                    multiSelection.clearSelection();
                    selectionDispatch({ type: 'SET_SELECTED_FILE', file });
                }

                // Always ensure list pane has focus when clicking a file
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });

                // Only open file if not multi-selecting
                if (!isMultiSelectModifier && !isShiftKey) {
                    // Open file in current tab
                    const leaf = app.workspace.getLeaf(false);
                    if (leaf) {
                        leaf.openFile(file, { active: false });
                    }
                }

                // Collapse left sidebar on mobile after opening file
                if (isMobile && app.workspace.leftSplit && !isMultiSelectModifier && !isShiftKey) {
                    app.workspace.leftSplit.collapse();
                }
            },
            [app.workspace, selectionDispatch, uiDispatch, isMobile, multiSelection]
        );

        // Scroll to top handler for mobile header click
        const handleScrollToTop = useCallback(() => {
            if (isMobile && scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, [isMobile]);

        const { selectionType, selectedFolder, selectedTag, selectedFile } = selectionState;
        // Cache selected file path to avoid repeated property access
        const selectedFilePath = selectedFile?.path;

        // Calculate files synchronously with useMemo
        const files = useMemo(() => {
            let allFiles: TFile[] = [];

            if (selectionType === ItemType.FOLDER && selectedFolder) {
                allFiles = getFilesForFolder(selectedFolder, settings, app);
            } else if (selectionType === ItemType.TAG && selectedTag) {
                allFiles = getFilesForTag(selectedTag, settings, app, tagTreeService);
            }

            return allFiles;
        }, [selectionType, selectedFolder, selectedTag, settings, app, tagTreeService, updateKey]); // eslint-disable-line react-hooks/exhaustive-deps
        // updateKey is intentionally included to force re-computation when vault files change (create/delete/rename).
        // Without it, the file list wouldn't update when files are modified outside of the plugin.

        // Create a map for O(1) file lookups
        const filePathToIndex = useMemo(() => {
            const map = new Map<string, number>();
            listItems.forEach((item, index) => {
                if (item.type === ListPaneItemType.FILE) {
                    if (item.data instanceof TFile) {
                        map.set(item.data.path, index);
                    }
                }
            });
            return map;
        }, [listItems]);

        // Create a map for O(1) file position lookups in the files array (for multi-selection)
        const fileIndexMap = useMemo(() => {
            const map = new Map<string, number>();
            files.forEach((file, index) => {
                map.set(file.path, index);
            });
            return map;
        }, [files]);

        const getSelectionIndex = useCallback(() => {
            if (selectedFilePath) {
                const fileIndex = filePathToIndex.get(selectedFilePath);

                if (fileIndex !== undefined && fileIndex !== -1) {
                    // Check if there's a header immediately before this file
                    // Only scroll to header if this is the first file in the list
                    if (fileIndex > 0 && listItems[fileIndex - 1]?.type === ListPaneItemType.HEADER) {
                        const isFirstFileInList = fileIndex === 1 || (fileIndex === 2 && listItems[0]?.type === ListPaneItemType.HEADER);
                        if (isFirstFileInList) {
                            return fileIndex - 1;
                        }
                    }
                    return fileIndex;
                }
            }
            return -1;
        }, [selectedFilePath, filePathToIndex, listItems]);

        // Get effective sort option for the current view
        const effectiveSortOption = useMemo(() => {
            return getEffectiveSortOption(settings, selectionType, selectedFolder, selectedTag);
        }, [settings, selectionType, selectedFolder, selectedTag]);

        // Build ordered files list for Shift+Click functionality - MUST be before early returns
        const orderedFiles = useMemo(() => {
            const files: TFile[] = [];
            listItems.forEach(item => {
                if (item.type === ListPaneItemType.FILE) {
                    if (item.data instanceof TFile) {
                        files.push(item.data);
                    }
                }
            });
            return files;
        }, [listItems]);

        // Create a stable onClick handler for FileItem that uses pre-calculated fileIndex
        const handleFileItemClick = useCallback(
            (file: TFile, fileIndex: number | undefined) => (e: React.MouseEvent) => {
                handleFileClick(file, e, fileIndex, orderedFiles);
            },
            [handleFileClick, orderedFiles]
        );

        // Determine if list pane is visible early to optimize
        const isVisible = !uiState.singlePane || uiState.currentSinglePaneView === 'files';

        const currentListItemsKey = listItems
            .map(item => {
                // Include metadata in key for files to detect tag changes
                if (item.type === ListPaneItemType.FILE && item.metadata) {
                    return `${item.key}:${item.metadata.hasTags ? 'tags' : 'notags'}`;
                }
                return item.key;
            })
            .join('|');

        // Helper function for safe array access
        const safeGetItem = <T,>(array: T[], index: number): T | undefined => {
            return index >= 0 && index < array.length ? array[index] : undefined;
        };

        useEffect(() => {
            if (selectedFile) {
                lastSelectedFilePathRef.current = selectedFile.path;
            }
        }, [selectedFile]);

        // This effect now only listens for vault events to trigger a refresh
        useEffect(() => {
            // Debounce updates to prevent rapid re-renders
            const forceUpdate = debounce(() => {
                // Force re-render by incrementing update key
                setUpdateKey(k => k + 1);
            }, 300); // Increased debounce time to reduce render frequency

            const vaultEvents = [
                app.vault.on('create', () => {
                    forceUpdate();
                }),
                app.vault.on('delete', () => {
                    forceUpdate();
                }),
                app.vault.on('rename', () => {
                    forceUpdate();
                })
            ];
            const metadataEvent = app.metadataCache.on('changed', file => {
                // Only update if the metadata change is for a file in our current view
                if (selectionType === ItemType.FOLDER && selectedFolder) {
                    // Check if file is in the selected folder
                    const fileFolder = file.parent;
                    if (!fileFolder || fileFolder.path !== selectedFolder.path) {
                        // If not showing subfolders, ignore files not in this folder
                        if (!settings.showNotesFromSubfolders) {
                            return;
                        }
                        // If showing subfolders, check if it's a descendant
                        if (!fileFolder || !fileFolder.path.startsWith(selectedFolder.path + '/')) {
                            return;
                        }
                    }
                } else if (selectionType === ItemType.TAG && selectedTag) {
                    // For tag view, we DO need to rebuild the list as files might be added/removed
                    forceUpdate();
                    return;
                }

                // For folder view, we don't need to rebuild the list for metadata changes
                // Individual FileItems will update through the database subscription
            });

            // Listen for tag changes from database
            const db = getDB();
            const dbUnsubscribe = db.onContentChange(changes => {
                // Check if any tags changed - we need to rebuild list items to update metadata
                const hasTagChanges = changes.some(change => change.changes.tags !== undefined);
                if (hasTagChanges) {
                    // In tag view, files might be added/removed from the list
                    // In folder view, we need to update the metadata for proper height calculation
                    forceUpdate();
                }
            });

            return () => {
                vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
                app.metadataCache.offref(metadataEvent);
                dbUnsubscribe();
            };
        }, [app, selectionType, selectedTag, selectedFolder, settings.showNotesFromSubfolders, getDB]);

        // Auto-open file when it's selected via folder/tag change (not user click or keyboard navigation)
        useEffect(() => {
            // Check if this is a reveal operation - if so, skip auto-open
            const isRevealOperation = selectionState.isRevealOperation;
            const isFolderChangeWithAutoSelect = selectionState.isFolderChangeWithAutoSelect;
            const isKeyboardNavigation = selectionState.isKeyboardNavigation;

            // Skip auto-open if this is a reveal operation or keyboard navigation
            if (isRevealOperation || isKeyboardNavigation) {
                // Clear the keyboard navigation flag after processing
                if (isKeyboardNavigation) {
                    selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: false });
                }
                return;
            }

            if (selectedFile && !isUserSelectionRef.current && settings.autoSelectFirstFileOnFocusChange && !isMobile) {
                // Check if we're actively navigating the navigator
                const navigatorEl = document.querySelector('.nn-split-container');
                const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);

                // Open the file if we're not actively using the navigator OR if this is a folder change with auto-select
                if (!hasNavigatorFocus || isFolderChangeWithAutoSelect) {
                    const leaf = app.workspace.getLeaf(false);
                    if (leaf) {
                        leaf.openFile(selectedFile, { active: false });
                    }
                }
            }
            // Reset the flag after processing
            isUserSelectionRef.current = false;
        }, [
            selectedFile,
            app.workspace,
            settings.autoSelectFirstFileOnFocusChange,
            isMobile,
            selectionState.isRevealOperation,
            selectionState.isFolderChangeWithAutoSelect,
            selectionState.isKeyboardNavigation,
            selectionDispatch
        ]);

        // Auto-select first file when navigating to files pane with keyboard in dual-pane mode
        useEffect(() => {
            // Only run in dual-pane mode on desktop when using keyboard navigation
            if (uiState.singlePane || isMobile) return;

            // Check if we just gained focus AND it's from keyboard navigation
            if (uiState.focusedPane === 'files' && selectionState.isKeyboardNavigation) {
                // Clear the keyboard navigation flag
                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: false });

                // If no file is selected and we have files
                if (!selectedFile && files.length > 0) {
                    // Check if the active file is in the current view
                    const activeFile = app.workspace.getActiveFile();
                    if (activeFile && files.some(f => f.path === activeFile.path)) {
                        // Select the active file
                        selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
                    } else {
                        // Select the first file
                        selectionDispatch({ type: 'SET_SELECTED_FILE', file: files[0] });
                        // Open it in the editor without focus
                        const leaf = app.workspace.getLeaf(false);
                        if (leaf) {
                            leaf.openFile(files[0], { active: false });
                        }
                    }
                }
            }
        }, [
            uiState.focusedPane,
            uiState.singlePane,
            isMobile,
            selectionState.isKeyboardNavigation,
            selectedFile,
            files,
            selectionDispatch,
            app.workspace
        ]);

        useEffect(() => {
            const rebuildListItems = () => {
                const items: ListPaneItem[] = [];

                // Get the appropriate pinned paths based on selection type
                let pinnedPaths: Set<string>;

                if (selectionType === ItemType.FOLDER && selectedFolder) {
                    pinnedPaths = collectPinnedPaths(settings.pinnedNotes, selectedFolder, settings.showNotesFromSubfolders);
                } else if (selectionType === ItemType.TAG) {
                    pinnedPaths = collectPinnedPaths(settings.pinnedNotes);
                } else {
                    pinnedPaths = new Set<string>();
                }

                // Separate pinned and unpinned files
                const pinnedFiles = files.filter(f => pinnedPaths.has(f.path));
                const unpinnedFiles = files.filter(f => !pinnedPaths.has(f.path));

                // Pre-compute metadata for all files to avoid database lookups during render
                const db = getDB();
                const fileMetadataCache = new Map<string, { hasTags: boolean; hasPreview: boolean; isInSubfolder: boolean }>();

                [...pinnedFiles, ...unpinnedFiles].forEach(file => {
                    const tags = db.getDisplayTags(file.path);
                    const isInSubfolder = selectedFolder && file.parent && file.parent.path !== selectedFolder.path;

                    fileMetadataCache.set(file.path, {
                        hasTags: tags.length > 0,
                        hasPreview: file.extension === 'md' ? hasPreview(file.path) : false,
                        isInSubfolder: !!isInSubfolder
                    });
                });

                // Sort will happen below after determining the sort option

                // Track file index for stable onClick handlers
                let fileIndexCounter = 0;

                // Add pinned files
                if (pinnedFiles.length > 0) {
                    items.push({
                        type: ListPaneItemType.HEADER,
                        data: strings.listPane.pinnedSection,
                        key: `header-pinned`
                    });
                    pinnedFiles.forEach(file => {
                        const metadata = fileMetadataCache.get(file.path);
                        items.push({
                            type: ListPaneItemType.FILE,
                            data: file,
                            parentFolder: selectedFolder?.path,
                            key: file.path,
                            metadata,
                            fileIndex: fileIndexCounter++
                        });
                    });
                }

                // Determine which sort option to use
                const sortOption = getEffectiveSortOption(settings, selectionType, selectedFolder, selectedTag);

                // Sort pinned and unpinned files separately
                sortFiles(pinnedFiles, sortOption, getFileCreatedTime, getFileModifiedTime);
                sortFiles(unpinnedFiles, sortOption, getFileCreatedTime, getFileModifiedTime);

                // Add unpinned files with date grouping if enabled
                if (!settings.groupByDate || sortOption.startsWith('title')) {
                    // No date grouping
                    unpinnedFiles.forEach(file => {
                        const metadata = fileMetadataCache.get(file.path);
                        items.push({
                            type: ListPaneItemType.FILE,
                            data: file,
                            parentFolder: selectedFolder?.path,
                            key: file.path,
                            metadata,
                            fileIndex: fileIndexCounter++
                        });
                    });
                } else {
                    // Group by date
                    let currentGroup: string | null = null;
                    unpinnedFiles.forEach(file => {
                        const dateField = getDateField(sortOption);
                        // Get timestamp based on sort field (created or modified)
                        const timestamp = dateField === 'ctime' ? getFileCreatedTime(file) : getFileModifiedTime(file);
                        const groupTitle = DateUtils.getDateGroup(timestamp);

                        if (groupTitle !== currentGroup) {
                            currentGroup = groupTitle;
                            items.push({
                                type: ListPaneItemType.HEADER,
                                data: groupTitle,
                                key: `header-${groupTitle}`
                            });
                        }

                        const metadata = fileMetadataCache.get(file.path);
                        items.push({
                            type: ListPaneItemType.FILE,
                            data: file,
                            parentFolder: selectedFolder?.path,
                            key: file.path,
                            metadata,
                            fileIndex: fileIndexCounter++
                        });
                    });
                }

                // Add spacer at the end for better visibility of last item
                items.push({
                    type: ListPaneItemType.SPACER,
                    data: '',
                    key: 'bottom-spacer'
                });

                setListItems(items);
            };

            // Rebuild list items when files or relevant settings change
            rebuildListItems();
        }, [files, settings, selectionType, selectedFolder, selectedTag, getFileCreatedTime, getFileModifiedTime, getDB, hasPreview]);

        // Reset virtualizer when list items are reordered
        useEffect(() => {
            if (listItemsKeyRef.current && listItemsKeyRef.current !== currentListItemsKey) {
                // List items have been reordered, reset virtualizer measurements
                rowVirtualizer.measure();
            }
            listItemsKeyRef.current = currentListItemsKey;
        }, [currentListItemsKey, rowVirtualizer]);

        // Process pending scrolls after virtualizer updates or visibility changes
        // This handles deferred scrolling for single-pane mode and ensures proper timing
        useEffect(() => {
            if (!rowVirtualizer || !pendingScrollRef.current || !isVisible) {
                return;
            }

            const pending = pendingScrollRef.current;
            let shouldClearPending = false;

            if (pending.type === 'file' && pending.filePath) {
                const index = filePathToIndex.get(pending.filePath);
                if (index !== undefined && index >= 0) {
                    // Use 'auto' alignment on mobile and desktop
                    rowVirtualizer.scrollToIndex(index, {
                        align: 'auto',
                        behavior: 'auto'
                    });

                    // Ensure scroll completes before clearing pending
                    requestAnimationFrame(() => {
                        // Scroll completed
                    });

                    shouldClearPending = true;
                } else {
                    // File not found in index yet - keep the pending scroll
                    // This can happen when toggling showNotesFromSubfolders and the list hasn't updated yet
                    shouldClearPending = false;
                }
            } else if (pending.type === 'top') {
                rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });
                shouldClearPending = true;
            }

            // Only clear the pending scroll if we successfully executed it or if it's a top scroll
            if (shouldClearPending) {
                pendingScrollRef.current = null;
            }
        }, [rowVirtualizer, filePathToIndex, isVisible, pendingScrollVersion]);

        // Subscribe to database content changes to re-measure virtualizer
        useEffect(() => {
            if (!rowVirtualizer) return;

            const db = getDB();
            const unsubscribe = db.onContentChange(changes => {
                // Check if any changes affect item height
                const needsRemeasure = changes.some(change => {
                    // Content changes always need remeasure
                    if (
                        change.changes.preview !== undefined ||
                        change.changes.featureImage !== undefined ||
                        change.changes.metadata !== undefined
                    ) {
                        return true;
                    }

                    // Tag changes are handled by list rebuild, not here
                    // The forceUpdate() will rebuild list items with correct metadata

                    return false;
                });

                if (needsRemeasure) {
                    rowVirtualizer.measure();
                }
            });

            return () => {
                unsubscribe();
            };
        }, [rowVirtualizer, getDB]);

        // Listen for mobile drawer visibility
        useEffect(() => {
            if (!isMobile) return;

            const handleVisible = () => {
                // If we have a selected file, set a pending scroll
                // This works regardless of whether auto-reveal has run yet
                if (selectedFile && rowVirtualizer) {
                    pendingScrollRef.current = { type: 'file', filePath: selectedFile.path };
                    setPendingScrollVersion(v => v + 1);
                }
            };

            window.addEventListener('notebook-navigator-visible', handleVisible);
            return () => window.removeEventListener('notebook-navigator-visible', handleVisible);
        }, [isMobile, selectedFile, rowVirtualizer, filePathToIndex]);

        // Re-measure all items when height-affecting settings change
        useEffect(() => {
            if (!rowVirtualizer) return;

            rowVirtualizer.measure();
        }, [
            settings.showFileDate,
            settings.showFilePreview,
            settings.showFeatureImage,
            settings.fileNameRows,
            settings.previewRows,
            settings.showParentFolderNames,
            settings.showFileTags,
            rowVirtualizer
        ]);

        // Re-measure when storage becomes ready (for cold boot)
        useEffect(() => {
            if (isStorageReady && rowVirtualizer) {
                rowVirtualizer.measure();
            }
        }, [isStorageReady, rowVirtualizer]);

        // Handle scrolling when show subfolders setting changes
        // This ensures the list scrolls to the selected file when toggling subfolder visibility
        useEffect(() => {
            if (!rowVirtualizer || !isVisible) {
                return;
            }

            const showSubfoldersChanged = prevShowSubfoldersRef.current !== settings.showNotesFromSubfolders;

            if (!showSubfoldersChanged) {
                return;
            }

            // Update the ref to mark this change as processed
            prevShowSubfoldersRef.current = settings.showNotesFromSubfolders;

            // Set a pending scroll that will be executed after list updates
            if (selectedFile) {
                pendingScrollRef.current = { type: 'file', filePath: selectedFile.path };
                setPendingScrollVersion(v => v + 1);
            } else if (!settings.showNotesFromSubfolders) {
                // When disabling subfolders and no file selected, scroll to top
                pendingScrollRef.current = { type: 'top' };
                setPendingScrollVersion(v => v + 1);
            }
        }, [isVisible, rowVirtualizer, selectedFile, settings.showNotesFromSubfolders]);

        // Handle scrolling when navigating between folders/tags
        // Supports both visible and hidden panes (for single-pane mode)
        useEffect(() => {
            if (!rowVirtualizer) {
                return;
            }

            // Create a key representing the current list context
            const currentListKey = `${selectedFolder?.path || ''}_${selectedTag || ''}`;
            const listChanged = prevListKeyRef.current !== currentListKey;

            // Check if this is a folder navigation where we need to scroll to maintain the selected file
            const isFolderNavigation = selectionState.isFolderNavigation;

            // Determine if we should scroll
            // We scroll in these cases:
            // 1. User navigated to a different folder/tag (isFolderNavigation = true)
            // 2. List context changed (folder/tag change)
            const shouldScroll = isFolderNavigation || listChanged;

            if (!shouldScroll) {
                return;
            }

            // On initial load, wait for list to be populated
            if (listChanged && listItems.length === 0) {
                return;
            }

            // For single-pane mode, always set pending scroll even if not visible
            // It will be processed when the pane becomes visible
            if (!isVisible && (isFolderNavigation || listChanged)) {
                // Update the ref
                if (listChanged) {
                    prevListKeyRef.current = currentListKey;
                }

                // Clear the folder navigation flag
                if (isFolderNavigation) {
                    selectionDispatch({ type: 'SET_FOLDER_NAVIGATION', isFolderNavigation: false });
                }

                pendingScrollRef.current = selectedFile ? { type: 'file', filePath: selectedFile.path } : { type: 'top' };
                setPendingScrollVersion(v => v + 1);
                return;
            }

            // For folder navigation when visible, perform scroll immediately without RAF
            // RAF was causing issues with component re-renders cancelling the scroll
            if (isFolderNavigation && listItems.length > 0 && isVisible) {
                // Update the ref
                if (listChanged) {
                    prevListKeyRef.current = currentListKey;
                }

                // Clear the folder navigation flag
                selectionDispatch({ type: 'SET_FOLDER_NAVIGATION', isFolderNavigation: false });

                pendingScrollRef.current = selectedFile ? { type: 'file', filePath: selectedFile.path } : { type: 'top' };
                setPendingScrollVersion(v => v + 1);
            } else {
                // For other cases (initial load), use pending scroll for consistency
                // RAF was getting canceled due to rapid re-renders

                // Update the ref
                if (listChanged) {
                    prevListKeyRef.current = currentListKey;
                }

                pendingScrollRef.current = selectedFile ? { type: 'file', filePath: selectedFile.path } : { type: 'top' };
                setPendingScrollVersion(v => v + 1);
            }
        }, [
            isVisible,
            rowVirtualizer,
            selectedFolder?.path,
            selectedTag,
            selectedFile,
            getSelectionIndex,
            selectionState.isFolderNavigation,
            selectionDispatch,
            listItems.length
        ]);

        // Handle reveal operations to use pending scroll
        useEffect(() => {
            if (selectionState.isRevealOperation && selectedFile && isVisible) {
                // Always use pending scroll for reveal operations
                // This ensures proper timing and measurement before scrolling
                pendingScrollRef.current = { type: 'file', filePath: selectedFile.path };
                setPendingScrollVersion(v => v + 1);
            }
        }, [selectionState.isRevealOperation, selectedFile, isVisible, selectionDispatch, filePathToIndex]);

        // Track current visible date group for sticky header
        useEffect(() => {
            if (!scrollContainerRef.current || !rowVirtualizer || !settings.groupByDate) {
                setCurrentDateGroup(null);
                return;
            }

            const scrollContainer = scrollContainerRef.current;

            // Helper to get item position
            const getItemBottom = (index: number): number | null => {
                // First check if we have cached measurements
                const measurement = rowVirtualizer.measurementsCache?.[index];
                if (measurement) {
                    return measurement.start + measurement.size;
                }

                // Check virtual items
                const virtualItems = rowVirtualizer.getVirtualItems();
                const virtualItem = virtualItems.find(vi => vi.index === index);
                if (virtualItem) {
                    return virtualItem.start + virtualItem.size;
                }

                // Estimate position as fallback
                let estimatedStart = 0;
                for (let j = 0; j < index; j++) {
                    estimatedStart += rowVirtualizer.options.estimateSize(j);
                }
                return estimatedStart + rowVirtualizer.options.estimateSize(index);
            };

            const updateCurrentGroup = () => {
                const scrollTop = scrollContainer.scrollTop;

                // Find the current date group based on headers that have scrolled past
                let currentGroup: string | null = null;

                // Look through all items to find headers
                for (let i = 0; i < listItems.length; i++) {
                    const item = safeGetItem(listItems, i);
                    if (!item || item.type !== ListPaneItemType.HEADER) continue;

                    const headerText = item.data as string;
                    const headerBottom = getItemBottom(i);

                    // Skip headers that haven't been measured yet (position 0 when scrollTop is also 0)
                    // This prevents picking up unmeasured headers on initial render
                    if (headerBottom === 0 && scrollTop === 0) {
                        continue;
                    }

                    if (headerBottom !== null && headerBottom <= scrollTop) {
                        // This header is completely above the viewport, so it's our current group
                        currentGroup = headerText;
                    } else {
                        // This header is still visible or coming up, so we stop here
                        break;
                    }
                }

                setCurrentDateGroup(currentGroup);
            };

            // Initial update
            updateCurrentGroup();

            // Update on scroll
            const handleScroll = () => {
                requestAnimationFrame(updateCurrentGroup);
            };

            scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

            return () => {
                const container = scrollContainerRef.current;
                if (container) {
                    container.removeEventListener('scroll', handleScroll);
                }
            };
        }, [rowVirtualizer, listItems, settings.groupByDate]);

        renderCountRef.current++;

        // Expose the virtualizer instance and file lookup method via the ref
        useImperativeHandle(
            ref,
            () => ({
                getIndexOfPath: (path: string) => filePathToIndex.get(path) ?? -1,
                virtualizer: rowVirtualizer,
                scrollContainerRef: scrollContainerRef.current
            }),
            [filePathToIndex, rowVirtualizer]
        );

        // Add keyboard navigation
        // Note: We pass the root container ref, not the scroll container ref.
        // This ensures keyboard events work across the entire navigator, allowing
        // users to navigate between panes (navigation <-> files) with Tab/Arrow keys.
        useVirtualKeyboardNavigation({
            items: listItems,
            virtualizer: rowVirtualizer,
            focusedPane: 'files',
            containerRef: props.rootContainerRef,
            pathToIndex: filePathToIndex,
            files: files,
            fileIndexMap: fileIndexMap
        });

        // Early returns MUST come after all hooks
        if (!selectedFolder && !selectedTag) {
            return (
                <div className="nn-list-pane">
                    <ListPaneHeader onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
                    <div className="nn-list-pane-scroller nn-empty-state">
                        <div className="nn-empty-message">{strings.listPane.emptyStateNoSelection}</div>
                    </div>
                </div>
            );
        }

        if (files.length === 0) {
            return (
                <div className="nn-list-pane">
                    <ListPaneHeader onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
                    <div className="nn-list-pane-scroller nn-empty-state">
                        <div className="nn-empty-message">{strings.listPane.emptyStateNoNotes}</div>
                    </div>
                </div>
            );
        }

        return (
            <div className="nn-list-pane">
                <ListPaneHeader onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
                <div
                    ref={scrollContainerRefCallback}
                    className={`nn-list-pane-scroller ${isSlimMode ? 'nn-slim-mode' : ''}`}
                    data-pane="files"
                    role="list"
                    tabIndex={-1}
                >
                    {/* Virtual list */}
                    {listItems.length > 0 && (
                        <div
                            className="nn-virtual-container"
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map(virtualItem => {
                                const item = safeGetItem(listItems, virtualItem.index);
                                if (!item) return null;
                                // Check if file is selected
                                let isSelected = false;
                                if (item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
                                    isSelected = multiSelection.isFileSelected(item.data);

                                    // During folder navigation transitions, if nothing is selected in the current list,
                                    // maintain the last selected file's visual selection to prevent flicker
                                    if (!isSelected && selectionState.isFolderNavigation && lastSelectedFilePathRef.current) {
                                        isSelected = item.data.path === lastSelectedFilePathRef.current;
                                    }
                                }

                                // Check if this is the last file item
                                const nextItem = safeGetItem(listItems, virtualItem.index + 1);
                                const isLastFile =
                                    item.type === ListPaneItemType.FILE &&
                                    (virtualItem.index === listItems.length - 1 ||
                                        (nextItem &&
                                            (nextItem.type === ListPaneItemType.HEADER || nextItem.type === ListPaneItemType.SPACER)));

                                // Check if adjacent items are selected (for styling purposes)
                                const prevItem = safeGetItem(listItems, virtualItem.index - 1);
                                const hasSelectedAbove =
                                    item.type === ListPaneItemType.FILE &&
                                    prevItem?.type === ListPaneItemType.FILE &&
                                    prevItem.data instanceof TFile &&
                                    multiSelection.isFileSelected(prevItem.data);
                                const hasSelectedBelow =
                                    item.type === ListPaneItemType.FILE &&
                                    nextItem?.type === ListPaneItemType.FILE &&
                                    nextItem.data instanceof TFile &&
                                    multiSelection.isFileSelected(nextItem.data);

                                // Check if this is the first header (same logic as in estimateSize)
                                const isFirstHeader = item.type === ListPaneItemType.HEADER && virtualItem.index === 0;

                                // Find current date group for file items
                                let dateGroup: string | null = null;
                                if (item.type === ListPaneItemType.FILE) {
                                    // Look backwards to find the most recent header
                                    for (let i = virtualItem.index - 1; i >= 0; i--) {
                                        const prevItem = safeGetItem(listItems, i);
                                        if (prevItem && prevItem.type === ListPaneItemType.HEADER) {
                                            dateGroup = prevItem.data as string;
                                            break;
                                        }
                                    }
                                }

                                return (
                                    <div
                                        key={virtualItem.key}
                                        className={`nn-virtual-item ${item.type === ListPaneItemType.FILE ? 'nn-virtual-file-item' : ''} ${isLastFile ? 'nn-last-file' : ''}`}
                                        style={{
                                            transform: `translateY(${virtualItem.start}px)`
                                        }}
                                        data-index={virtualItem.index}
                                    >
                                        {item.type === ListPaneItemType.HEADER ? (
                                            <div className={`nn-date-group-header ${isFirstHeader ? 'nn-first-header' : ''}`}>
                                                {typeof item.data === 'string' ? item.data : ''}
                                            </div>
                                        ) : item.type === ListPaneItemType.SPACER ? (
                                            <div className="nn-list-pane-spacer" />
                                        ) : item.type === ListPaneItemType.FILE && item.data instanceof TFile ? (
                                            <FileItem
                                                file={item.data}
                                                isSelected={isSelected}
                                                hasSelectedAbove={hasSelectedAbove}
                                                hasSelectedBelow={hasSelectedBelow}
                                                onClick={handleFileItemClick(item.data, item.fileIndex)}
                                                dateGroup={dateGroup}
                                                sortOption={effectiveSortOption}
                                                parentFolder={item.parentFolder}
                                            />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    })
);
