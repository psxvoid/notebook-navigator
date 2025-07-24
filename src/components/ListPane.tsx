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
import { useServices } from '../context/ServicesContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { FileItem } from './FileItem';
import { DateUtils } from '../utils/dateUtils';
import { isTFile } from '../utils/typeGuards';
import { getDateField, getEffectiveSortOption, sortFiles } from '../utils/sortUtils';
import { getFilesForFolder, getFilesForTag, collectPinnedPaths } from '../utils/fileFinder';
import { MobileLogger } from '../utils/mobileLogger';
import { strings } from '../i18n';
import type { ListPaneItem } from '../types/virtualization';
import { PaneHeader } from './PaneHeader';
import { ListPaneItemType, ItemType, LISTPANE_MEASUREMENTS, OVERSCAN } from '../types';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { useMultiSelection } from '../hooks/useMultiSelection';

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

const ListPaneComponent = forwardRef<ListPaneHandle, ListPaneProps>((props, ref) => {
    const { app, isMobile } = useServices();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const settings = useSettingsState();
    const uiState = useUIState();
    const mobileLogger = MobileLogger.getInstance(app);
    const uiDispatch = useUIDispatch();
    const { getFileCreatedTime, getFileModifiedTime, getDB } = useFileCache();
    const { selectionType, selectedFolder, selectedTag, selectedFile } = selectionState;

    // Track if the file selection is from user click vs auto-selection
    const isUserSelectionRef = useRef(false);
    const [fileVersion, setFileVersion] = useState(0);

    // Track current visible date group for sticky header
    const [currentDateGroup, setCurrentDateGroup] = useState<string | null>(null);

    // Initialize multi-selection hook
    const multiSelection = useMultiSelection();

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

    // This effect now only listens for vault events to trigger a refresh
    useEffect(() => {
        // Debounce updates to prevent rapid re-renders
        const forceUpdate = debounce(() => {
            setFileVersion(v => v + 1);
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
                // For tags, we need to check if the file's tags changed
                // This is harder to optimize, so we'll still update for now
                // but less frequently
            }

            forceUpdate();
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
        };
    }, [app]);

    // Scroll to top handler for mobile header click
    const handleScrollToTop = useCallback(() => {
        if (isMobile && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isMobile]);

    // Determine if list pane is visible early to optimize
    const isVisible = !uiState.singlePane || uiState.currentSinglePaneView === 'files';

    // Calculate files synchronously with useMemo
    const files = useMemo(() => {
        let allFiles: TFile[] = [];

        if (selectionType === ItemType.FOLDER && selectedFolder) {
            allFiles = getFilesForFolder(selectedFolder, settings, app);
        } else if (selectionType === ItemType.TAG && selectedTag) {
            allFiles = getFilesForTag(selectedTag, settings, app);
        }

        return allFiles;
    }, [selectionType, selectedFolder, selectedTag, settings, app, fileVersion]);

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
                    leaf.openFile(selectedFile!, { active: false });
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

    // Auto-select active file or first file when list pane gains focus (DESKTOP ONLY)
    useEffect(() => {
        // Only run when list pane gains focus (desktop only - mobile doesn't have focus states)
        if (uiState.focusedPane !== 'files' || isMobile) return;

        // Check if we already have a file selected
        if (selectedFile) return;

        // This is keyboard navigation (Tab/Right), don't auto-open files
        isUserSelectionRef.current = false;

        // Try to select the currently active file in the workspace
        const activeFile = app.workspace.getActiveFile();
        if (activeFile && files.includes(activeFile)) {
            // The active file is in the current folder/tag view - select it
            selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
            selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
        } else if (files.length > 0) {
            // No active file in current view, select AND open the first file
            // (regardless of autoSelectFirstFile setting when navigating with keyboard)
            selectionDispatch({ type: 'SET_SELECTED_FILE', file: files[0] });
            const leaf = app.workspace.getLeaf(false);
            if (leaf) {
                leaf.openFile(files[0], { active: false });
            }
        }
    }, [isMobile, uiState.focusedPane, selectedFile, files, selectionDispatch, app.workspace]);

    const [listItems, setListItems] = useState<ListPaneItem[]>([]);

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

            // Sort will happen below after determining the sort option

            // Add pinned files
            if (pinnedFiles.length > 0) {
                items.push({
                    type: ListPaneItemType.HEADER,
                    data: strings.listPane.pinnedSection,
                    key: `header-pinned`
                });
                pinnedFiles.forEach(file => {
                    items.push({
                        type: ListPaneItemType.FILE,
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path
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
                    items.push({
                        type: ListPaneItemType.FILE,
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path
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

                    items.push({
                        type: ListPaneItemType.FILE,
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path
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
    }, [
        files,
        settings.groupByDate,
        settings.defaultFolderSort,
        settings.folderSortOverrides,
        settings.pinnedNotes,
        settings.showNotesFromSubfolders,
        selectionType,
        selectedFolder,
        selectedTag,
        strings.listPane.pinnedSection,
        settings.useFrontmatterMetadata // Rebuild when frontmatter settings change
    ]);

    // Add ref for scroll container
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Track render count
    const renderCountRef = useRef(0);
    renderCountRef.current++;

    // Cache selected file path to avoid repeated property access
    const selectedFilePath = selectedFile?.path;

    // Create a map for O(1) file lookups
    const filePathToIndex = useMemo(() => {
        const map = new Map<string, number>();
        listItems.forEach((item, index) => {
            if (item.type === ListPaneItemType.FILE) {
                if (isTFile(item.data)) {
                    map.set(item.data.path, index);
                }
            }
        });
        return map;
    }, [listItems]);

    // Track the last list state to detect when we need to scroll to top
    const prevListKeyRef = useRef<string>('');
    const prevShowSubfoldersRef = useRef<boolean>(settings.showNotesFromSubfolders);
    const pendingScrollRef = useRef<{ type: 'file' | 'top'; filePath?: string } | null>(null);

    // Track list items order to detect when items are reordered
    const listItemsKeyRef = useRef('');
    const currentListItemsKey = listItems.map(item => item.key).join('|');

    // Get sync preview check function
    const { hasPreview, isStorageReady } = useFileCache();

    // Initialize virtualizer
    const rowVirtualizer = useVirtualizer({
        count: listItems.length,
        getScrollElement: () => scrollContainerRef.current,
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
            const { showDate, showFilePreview, showFeatureImage, fileNameRows, previewRows } = settings;

            // Check if we're in slim mode (no date, preview, or image)
            const isSlimMode = !showDate && !showFilePreview && !showFeatureImage;

            // Get actual preview status for accurate height calculation
            let hasPreviewText = false;
            if (item.type === ListPaneItemType.FILE && isTFile(item.data) && showFilePreview && item.data.extension === 'md') {
                // Use synchronous check from cache
                hasPreviewText = hasPreview(item.data.path);
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

                // Add second line height for date/preview
                if (showFilePreview || showDate) {
                    if (effectivePreviewRows === 1) {
                        // Single line mode: date and preview share one line
                        textContentHeight += heights.metadataLineHeight;
                    } else {
                        // Multi-line mode: preview takes full configured rows
                        if (showFilePreview) {
                            textContentHeight += heights.multiLineLineHeight * effectivePreviewRows;
                        }
                        // Date only adds height when preview is 2+ rows
                        if (showDate) {
                            textContentHeight += heights.metadataLineHeight;
                        }
                    }
                }
            }

            // Add parent folder height if applicable (but not in slim mode)
            if (!isSlimMode && settings.showParentFolderNames && settings.showNotesFromSubfolders) {
                const file = isTFile(item.data) ? item.data : null;
                const isInSubfolder = file && item.parentFolder && file.parent && file.parent.path !== item.parentFolder;

                if (isInSubfolder) {
                    textContentHeight += heights.metadataLineHeight;
                }
            }

            // Apply min-height constraint AFTER including all content (but not in slim mode)
            // This ensures text content aligns with feature image height (42px) when shown
            if (!isSlimMode && textContentHeight < 42) {
                textContentHeight = 42;
            }

            return heights.basePadding + textContentHeight;
        },
        overscan: OVERSCAN,
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0
    });

    // Reset virtualizer when list items are reordered
    useEffect(() => {
        if (listItemsKeyRef.current && listItemsKeyRef.current !== currentListItemsKey) {
            // List items have been reordered, reset virtualizer measurements
            rowVirtualizer.measure();
        }
        listItemsKeyRef.current = currentListItemsKey;
    }, [currentListItemsKey, rowVirtualizer]);

    // Process pending scrolls after virtualizer updates or visibility changes
    useEffect(() => {
        if (!rowVirtualizer || !pendingScrollRef.current || !isVisible) {
            return;
        }

        const pending = pendingScrollRef.current;
        pendingScrollRef.current = null;

        // Ensure virtualizer has updated measurements
        rowVirtualizer.measure();

        if (pending.type === 'file' && pending.filePath) {
            const index = filePathToIndex.get(pending.filePath);
            if (index !== undefined && index >= 0) {
                mobileLogger.log('ListPane executing pending scroll to file:', {
                    filePath: pending.filePath,
                    index
                });
                rowVirtualizer.scrollToIndex(index, {
                    align: 'center',
                    behavior: 'auto'
                });
            }
        } else if (pending.type === 'top') {
            mobileLogger.log('ListPane executing pending scroll to top');
            rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });
        }
    }, [rowVirtualizer, filePathToIndex, rowVirtualizer.getTotalSize(), isVisible]);

    // Subscribe to database content changes to re-measure virtualizer
    useEffect(() => {
        if (!rowVirtualizer) return;

        const db = getDB();
        const unsubscribe = db.onContentChange(() => {
            // Content has been generated, re-measure to update heights
            rowVirtualizer.measure();
        });

        return () => {
            unsubscribe();
        };
    }, [rowVirtualizer, getDB]);

    // Listen for mobile drawer visibility
    useEffect(() => {
        if (!isMobile) return;

        const handleVisible = () => {
            if (!selectedFile || !rowVirtualizer) return;

            const index = filePathToIndex.get(selectedFile.path);

            if (index !== undefined && index >= 0) {
                // Use requestAnimationFrame to ensure DOM is ready
                requestAnimationFrame(() => {
                    rowVirtualizer.scrollToIndex(index, {
                        align: 'auto',
                        behavior: 'auto'
                    });
                });
            }
        };

        window.addEventListener('notebook-navigator-visible', handleVisible);
        return () => window.removeEventListener('notebook-navigator-visible', handleVisible);
    }, [isMobile, selectedFile, filePathToIndex, rowVirtualizer]);

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

    // Re-measure all items when height-affecting settings change
    useEffect(() => {
        if (!rowVirtualizer) return;

        rowVirtualizer.measure();
    }, [
        settings.showDate,
        settings.showFilePreview,
        settings.showFeatureImage,
        settings.fileNameRows,
        settings.previewRows,
        settings.showParentFolderNames,
        rowVirtualizer
    ]);

    // Re-measure when storage becomes ready (for cold boot)
    useEffect(() => {
        if (isStorageReady && rowVirtualizer) {
            rowVirtualizer.measure();
        }
    }, [isStorageReady, rowVirtualizer]);

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

    // Handle scrolling when show subfolders setting changes
    useEffect(() => {
        if (!rowVirtualizer || !isVisible || !selectedFile) {
            return;
        }

        const showSubfoldersChanged = prevShowSubfoldersRef.current !== settings.showNotesFromSubfolders;

        if (!showSubfoldersChanged) {
            return;
        }

        // Check if we have the right list items for the current setting
        const hasSubfolderFiles = listItems.some(item => {
            if (item.type === ListPaneItemType.FILE && isTFile(item.data)) {
                return item.data.parent?.path !== selectedFolder?.path;
            }
            return false;
        });

        const listMatchesSetting = settings.showNotesFromSubfolders ? listItems.length > 6 || hasSubfolderFiles : !hasSubfolderFiles;

        if (!listMatchesSetting) {
            // List hasn't updated yet, wait for next render
            return;
        }

        mobileLogger.log('ListPane subfolders setting changed, scrolling:', {
            showSubfolders: settings.showNotesFromSubfolders,
            listItemsCount: listItems.length,
            selectedFile: selectedFile.path
        });

        // List has updated, now scroll
        const index = getSelectionIndex();
        if (index >= 0) {
            rowVirtualizer.scrollToIndex(index, {
                align: 'center',
                behavior: 'auto'
            });
        } else if (!settings.showNotesFromSubfolders) {
            // File disappeared, scroll to top
            rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });
        }

        prevShowSubfoldersRef.current = settings.showNotesFromSubfolders;
    }, [isVisible, rowVirtualizer, selectedFile, selectedFolder, settings.showNotesFromSubfolders, listItems, getSelectionIndex]);

    // Scroll to selected file on folder/tag navigation
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

        mobileLogger.log('ListPane folder/tag navigation scroll:', {
            currentListKey,
            prevListKey: prevListKeyRef.current,
            listChanged,
            isFolderNavigation,
            selectedFile: selectedFile?.path,
            listItemsCount: listItems.length,
            isVisible
        });

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

            if (selectedFile) {
                mobileLogger.log('ListPane setting pending scroll for hidden pane:', {
                    selectedFile: selectedFile.path
                });
                pendingScrollRef.current = { type: 'file', filePath: selectedFile.path };
            } else {
                pendingScrollRef.current = { type: 'top' };
            }
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

            if (selectedFile) {
                mobileLogger.log('ListPane folder nav setting pending scroll to file:', {
                    selectedFile: selectedFile.path
                });
                pendingScrollRef.current = { type: 'file', filePath: selectedFile.path };
            } else {
                mobileLogger.log('ListPane folder nav setting pending scroll to top');
                pendingScrollRef.current = { type: 'top' };
            }
        } else {
            // For other cases (initial load), use RAF
            const rafId = requestAnimationFrame(() => {
                mobileLogger.log('ListPane inside folder navigation RAF', {
                    selectedFile: selectedFile?.path,
                    listItemsCount: listItems.length
                });

                // Update the ref AFTER we're in the animation frame to ensure it happens after scroll
                if (listChanged) {
                    prevListKeyRef.current = currentListKey;
                }

                if (selectedFile) {
                    // Try to scroll to selected file
                    const index = getSelectionIndex();
                    mobileLogger.log('ListPane folder nav scrolling to file:', {
                        selectedFile: selectedFile.path,
                        index,
                        found: index >= 0
                    });
                    if (index >= 0) {
                        rowVirtualizer.scrollToIndex(index, {
                            align: 'center',
                            behavior: 'auto'
                        });
                    } else {
                        // List changed but file not found - scroll to top
                        rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });
                    }
                } else {
                    // List changed with no file selected - scroll to top
                    mobileLogger.log('ListPane folder nav no file, scrolling to top');
                    rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });
                }
            });

            return () => {
                mobileLogger.log('ListPane folder nav RAF cancelled');
                cancelAnimationFrame(rafId);
            };
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

    // Add keyboard navigation
    // Note: We pass the root container ref, not the scroll container ref.
    // This ensures keyboard events work across the entire navigator, allowing
    // users to navigate between panes (navigation <-> files) with Tab/Arrow keys.
    useVirtualKeyboardNavigation({
        items: listItems,
        virtualizer: rowVirtualizer,
        focusedPane: 'files',
        containerRef: props.rootContainerRef
    });

    // Pre-calculate date field for all files in the group
    const dateField = useMemo(() => {
        return getDateField(settings.defaultFolderSort);
    }, [settings.defaultFolderSort]);

    // Pre-compute formatted dates for all files
    const filesWithDates = useMemo(() => {
        const dataMap = new Map<
            string,
            {
                display: string;
                created: string;
                modified: string;
            }
        >();

        // Get all files from list items
        const allFiles: TFile[] = [];
        listItems.forEach(item => {
            if (item.type === ListPaneItemType.FILE && isTFile(item.data)) {
                allFiles.push(item.data);
            }
        });

        // Always compute dates for tooltips even if display is disabled
        const dateTimeFormat = settings.timeFormat ? `${settings.dateFormat} ${settings.timeFormat}` : settings.dateFormat;
        let currentGroup: string | null = null;

        listItems.forEach(item => {
            if (item.type === ListPaneItemType.HEADER) {
                currentGroup = item.data as string;
            } else if (item.type === ListPaneItemType.FILE) {
                const file = item.data;
                if (!isTFile(file)) return;

                // Compute display date based on current sort
                const timestamp = dateField === 'ctime' ? getFileCreatedTime(file) : getFileModifiedTime(file);
                const display =
                    settings.showDate && currentGroup && currentGroup !== strings.listPane.pinnedSection
                        ? DateUtils.formatDateForGroup(timestamp, currentGroup, settings.dateFormat, settings.timeFormat)
                        : settings.showDate
                          ? DateUtils.formatDate(timestamp, settings.dateFormat)
                          : '';

                // Always compute both created and modified for tooltips
                const createdTimestamp = getFileCreatedTime(file);
                const modifiedTimestamp = getFileModifiedTime(file);
                const created = DateUtils.formatDate(createdTimestamp, dateTimeFormat);
                const modified = DateUtils.formatDate(modifiedTimestamp, dateTimeFormat);

                dataMap.set(file.path, { display, created, modified });
            }
        });

        return dataMap;
    }, [
        listItems,
        dateField,
        settings.showDate,
        settings.dateFormat,
        settings.timeFormat,
        settings.useFrontmatterMetadata,
        strings.listPane.pinnedSection
    ]);

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

    // Helper function for safe array access
    const safeGetItem = <T,>(array: T[], index: number): T | undefined => {
        return index >= 0 && index < array.length ? array[index] : undefined;
    };

    // Build ordered files list for Shift+Click functionality - MUST be before early returns
    const orderedFiles = useMemo(() => {
        const files: TFile[] = [];
        listItems.forEach(item => {
            if (item.type === ListPaneItemType.FILE) {
                if (isTFile(item.data)) {
                    files.push(item.data);
                }
            }
        });
        return files;
    }, [listItems]);

    // Early returns MUST come after all hooks
    if (!selectedFolder && !selectedTag) {
        return (
            <div className="nn-list-pane">
                <PaneHeader type="files" onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
                <div className="nn-list-pane-scroller nn-empty-state">
                    <div className="nn-empty-message">{strings.listPane.emptyStateNoSelection}</div>
                </div>
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="nn-list-pane">
                <PaneHeader type="files" onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
                <div className="nn-list-pane-scroller nn-empty-state">
                    <div className="nn-empty-message">{strings.listPane.emptyStateNoNotes}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="nn-list-pane">
            <PaneHeader type="files" onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
            <div ref={scrollContainerRef} className="nn-list-pane-scroller" data-pane="files" role="list" tabIndex={-1}>
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
                            const isSelected =
                                item.type === ListPaneItemType.FILE && isTFile(item.data) && multiSelection.isFileSelected(item.data);

                            // Check if this is the last file item
                            const nextItem = safeGetItem(listItems, virtualItem.index + 1);
                            const isLastFile =
                                item.type === ListPaneItemType.FILE &&
                                (virtualItem.index === listItems.length - 1 || (nextItem && nextItem.type === ListPaneItemType.HEADER));

                            // Check if adjacent items are selected (for styling purposes)
                            const prevItem = safeGetItem(listItems, virtualItem.index - 1);
                            const hasSelectedAbove =
                                item.type === ListPaneItemType.FILE &&
                                prevItem?.type === ListPaneItemType.FILE &&
                                isTFile(prevItem.data) &&
                                multiSelection.isFileSelected(prevItem.data);
                            const hasSelectedBelow =
                                item.type === ListPaneItemType.FILE &&
                                nextItem?.type === ListPaneItemType.FILE &&
                                isTFile(nextItem.data) &&
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
                                >
                                    {item.type === ListPaneItemType.HEADER ? (
                                        <div className={`nn-date-group-header ${isFirstHeader ? 'nn-first-header' : ''}`}>
                                            {typeof item.data === 'string' ? item.data : ''}
                                        </div>
                                    ) : item.type === ListPaneItemType.SPACER ? (
                                        <div className="nn-list-pane-spacer" />
                                    ) : item.type === ListPaneItemType.FILE && isTFile(item.data) ? (
                                        <FileItem
                                            file={item.data}
                                            isSelected={isSelected}
                                            hasSelectedAbove={hasSelectedAbove}
                                            hasSelectedBelow={hasSelectedBelow}
                                            onClick={e => {
                                                // Find the actual index of this file in the display order
                                                // Count only file items, not headers or spacers
                                                let fileIndex = 0;
                                                for (let i = 0; i < virtualItem.index; i++) {
                                                    if (listItems[i]?.type === ListPaneItemType.FILE) {
                                                        fileIndex++;
                                                    }
                                                }
                                                if (isTFile(item.data)) {
                                                    handleFileClick(item.data, e, fileIndex, orderedFiles);
                                                }
                                            }}
                                            dateGroup={dateGroup}
                                            formattedDates={isTFile(item.data) ? filesWithDates?.get(item.data.path) : undefined}
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
});

ListPaneComponent.displayName = 'ListPane';

export const ListPane = React.memo(ListPaneComponent);
