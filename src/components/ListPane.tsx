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

/**
 * OPTIMIZATIONS:
 *
 * 1. React.memo with forwardRef - Only re-renders on prop changes
 *
 * 2. Virtualization:
 *    - TanStack Virtual for rendering only visible items
 *    - Dynamic height calculation based on content (preview text, tags, metadata)
 *    - Direct memory cache lookups in estimateSize function
 *    - Virtualizer resets only when list order changes (tracked by key)
 *
 * 3. List building optimization:
 *    - useMemo rebuilds list items only when dependencies change
 *    - File filtering happens once during list build
 *    - Sort operations optimized with pre-computed values
 *    - Pinned files handled separately for efficiency
 *
 * 4. Event handling:
 *    - Debounced vault event handlers via forceUpdate
 *    - Selective updates based on file location (folder/tag context)
 *    - Database content changes trigger selective remeasurement
 *
 * 5. Selection handling:
 *    - Stable file index for onClick handlers
 *    - Multi-selection support without re-render
 *    - Keyboard navigation optimized
 */

import React, { useCallback, useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { TFile, Platform } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useMultiSelection } from '../hooks/useMultiSelection';
import { useListPaneKeyboard } from '../hooks/useListPaneKeyboard';
import { useListPaneData } from '../hooks/useListPaneData';
import { useListPaneScroll } from '../hooks/useListPaneScroll';
import { useListPaneAppearance } from '../hooks/useListPaneAppearance';
import { strings } from '../i18n';
import { ListPaneItemType } from '../types';
import { getEffectiveSortOption } from '../utils/sortUtils';
import { FileItem } from './FileItem';
import { ListPaneHeader } from './ListPaneHeader';
import { ListToolbar } from './ListToolbar';
import { SearchInput } from './SearchInput';

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
    toggleSearch: () => void;
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
    /**
     * Optional resize handle props for dual-pane mode.
     * When provided, renders a resize handle overlay on the left edge of the list pane.
     */
    resizeHandleProps?: {
        onMouseDown: (e: React.MouseEvent) => void;
    };
}

export const ListPane = React.memo(
    forwardRef<ListPaneHandle, ListPaneProps>(function ListPane(props, ref) {
        const { app, isMobile, plugin } = useServices();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const appearanceSettings = useListPaneAppearance();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();

        // Search state - use directly from settings for sync across devices
        const isSearchActive = settings.searchActive;
        const [searchQuery, setSearchQuery] = useState('');
        const [shouldFocusSearch, setShouldFocusSearch] = useState(false);

        // Clear search query when search is deactivated externally
        useEffect(() => {
            if (!isSearchActive && searchQuery) {
                setSearchQuery('');
            }
        }, [isSearchActive, searchQuery]);

        // Helper to toggle search state
        const setIsSearchActive = useCallback(
            async (active: boolean) => {
                if (plugin.settings.searchActive !== active) {
                    plugin.settings.searchActive = active;
                    await plugin.saveSettingsAndUpdate();
                }
            },
            [plugin]
        );

        // Android uses toolbar at top, iOS at bottom
        const isAndroid = Platform.isAndroidApp;

        // Track if the file selection is from user click vs auto-selection
        const isUserSelectionRef = useRef(false);

        // Keep track of the last selected file path to maintain visual selection during transitions
        const lastSelectedFilePathRef = useRef<string | null>(null);

        // Initialize multi-selection hook
        const multiSelection = useMultiSelection();

        // Track render count
        const renderCountRef = useRef(0);

        const { selectionType, selectedFolder, selectedTag, selectedFile } = selectionState;

        // Determine if list pane is visible early to optimize
        const isVisible = !uiState.singlePane || uiState.currentSinglePaneView === 'files';

        // Use the new data hook
        const { listItems, orderedFiles, filePathToIndex, fileIndexMap, files } = useListPaneData({
            selectionType,
            selectedFolder,
            selectedTag,
            settings,
            searchQuery: isSearchActive ? searchQuery : undefined
        });

        // Use the new scroll hook
        const { rowVirtualizer, scrollContainerRef, scrollContainerRefCallback, handleScrollToTop } = useListPaneScroll({
            listItems,
            filePathToIndex,
            selectedFile,
            selectedFolder,
            selectedTag,
            settings,
            folderSettings: appearanceSettings,
            isVisible,
            selectionState,
            selectionDispatch,
            searchQuery: isSearchActive ? searchQuery : undefined
        });

        // Check if we're in slim mode
        const isSlimMode = !appearanceSettings.showDate && !appearanceSettings.showPreview && !appearanceSettings.showImage;

        // Ensure the list has a valid selection for the current filter
        const ensureSelectionForCurrentFilter = useCallback(
            (options?: { openInEditor?: boolean; clearIfEmpty?: boolean }) => {
                const openInEditor = options?.openInEditor ?? false;
                const clearIfEmpty = options?.clearIfEmpty ?? false;
                const hasNoSelection = !selectedFile;
                const selectedFileInList = selectedFile ? filePathToIndex.has(selectedFile.path) : false;
                const needsSelection = hasNoSelection || !selectedFileInList;

                if (needsSelection) {
                    if (orderedFiles.length > 0) {
                        const firstFile = orderedFiles[0];
                        selectionDispatch({ type: 'SET_SELECTED_FILE', file: firstFile });
                        if (openInEditor) {
                            const leaf = app.workspace.getLeaf(false);
                            if (leaf) {
                                leaf.openFile(firstFile, { active: false });
                            }
                        }
                    } else if (clearIfEmpty) {
                        selectionDispatch({ type: 'SET_SELECTED_FILE', file: null });
                    }
                }
            },
            [selectedFile, orderedFiles, filePathToIndex, selectionDispatch, app.workspace]
        );

        const handleFileClick = useCallback(
            (file: TFile, e: React.MouseEvent, fileIndex?: number, orderedFiles?: TFile[]) => {
                // Ignore middle mouse button clicks - they're handled by onMouseDown
                if (e.button === 1) {
                    return;
                }

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
        // Get effective sort option for the current view
        const effectiveSortOption = getEffectiveSortOption(settings, selectionType, selectedFolder, selectedTag);

        // Create a stable onClick handler for FileItem that uses pre-calculated fileIndex
        const handleFileItemClick = useCallback(
            (file: TFile, fileIndex: number | undefined) => (e: React.MouseEvent) => {
                handleFileClick(file, e, fileIndex, orderedFiles);
            },
            [handleFileClick, orderedFiles]
        );

        // Helper function for safe array access
        const safeGetItem = <T,>(array: T[], index: number): T | undefined => {
            return index >= 0 && index < array.length ? array[index] : undefined;
        };

        useEffect(() => {
            if (selectedFile) {
                lastSelectedFilePathRef.current = selectedFile.path;
            }
        }, [selectedFile]);

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

            // If search is active and auto-select is enabled, we need to select the first filtered file
            if (isSearchActive && settings.autoSelectFirstFileOnFocusChange && !isMobile && isFolderChangeWithAutoSelect) {
                // Ensure selection respects current filter and optionally clear selection if none
                ensureSelectionForCurrentFilter({ openInEditor: true, clearIfEmpty: true });
                isUserSelectionRef.current = false;
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
            selectionDispatch,
            isSearchActive,
            files,
            ensureSelectionForCurrentFilter
        ]);

        // Auto-select first file when navigating to files pane with keyboard in dual-pane mode
        useEffect(() => {
            // Only run in dual-pane mode on desktop when using keyboard navigation
            if (uiState.singlePane || isMobile) return;

            // Check if we just gained focus AND it's from keyboard navigation
            if (uiState.focusedPane === 'files' && selectionState.isKeyboardNavigation) {
                // Clear the keyboard navigation flag
                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: false });

                // Determine if we need to select a file
                const hasNoSelection = !selectedFile;
                const selectedFileNotInFilteredList = selectedFile && !files.some(f => f.path === selectedFile.path);
                const needsSelection = hasNoSelection || selectedFileNotInFilteredList;

                if (needsSelection && files.length > 0) {
                    // Prefer currently active editor file if visible, otherwise ensure selection using helper
                    const activeFile = app.workspace.getActiveFile();
                    const activeFileInFilteredList = activeFile && files.some(f => f.path === activeFile.path);

                    if (activeFileInFilteredList) {
                        selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
                    } else {
                        ensureSelectionForCurrentFilter({ openInEditor: true });
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
            app.workspace,
            ensureSelectionForCurrentFilter
        ]);

        renderCountRef.current++;

        // Expose the virtualizer instance and file lookup method via the ref
        useImperativeHandle(
            ref,
            () => ({
                getIndexOfPath: (path: string) => filePathToIndex.get(path) ?? -1,
                virtualizer: rowVirtualizer,
                scrollContainerRef: scrollContainerRef.current,
                toggleSearch: () => {
                    if (isSearchActive) {
                        // Search is already open - just focus the search input
                        setTimeout(() => {
                            const scope = props.rootContainerRef.current ?? document;
                            const searchInput = scope.querySelector('.nn-search-input') as HTMLInputElement;
                            if (searchInput) {
                                searchInput.focus();
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                            }
                        }, 0);
                    } else {
                        // Opening search - activate with focus
                        setShouldFocusSearch(true);
                        setIsSearchActive(true);
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                    }
                }
            }),
            [filePathToIndex, rowVirtualizer, scrollContainerRef, isSearchActive, uiDispatch, setIsSearchActive, props.rootContainerRef]
        );

        // Add keyboard navigation
        // Note: We pass the root container ref, not the scroll container ref.
        // This ensures keyboard events work across the entire navigator, allowing
        // users to navigate between panes (navigation <-> files) with Tab/Arrow keys.
        useListPaneKeyboard({
            items: listItems,
            virtualizer: rowVirtualizer,
            containerRef: props.rootContainerRef,
            pathToIndex: filePathToIndex,
            files,
            fileIndexMap
        });

        // Determine if we're showing empty state
        const isEmptySelection = !selectedFolder && !selectedTag;
        const hasNoFiles = files.length === 0;

        // Single return with conditional content
        return (
            <div className={`nn-list-pane ${isSearchActive ? 'nn-search-active' : ''}`}>
                {props.resizeHandleProps && <div className="nn-resize-handle" {...props.resizeHandleProps} />}
                <ListPaneHeader
                    onHeaderClick={handleScrollToTop}
                    isSearchActive={isSearchActive}
                    onSearchToggle={() => {
                        if (!isSearchActive) {
                            // Opening search - activate with focus
                            setShouldFocusSearch(true);
                            setIsSearchActive(true);
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                        } else {
                            // Closing search
                            setIsSearchActive(false);
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        }
                    }}
                />
                {/* Search bar - collapsible */}
                <div className={`nn-search-bar-container ${isSearchActive ? 'nn-search-bar-visible' : ''}`}>
                    {isSearchActive && (
                        <SearchInput
                            searchQuery={searchQuery}
                            onSearchQueryChange={setSearchQuery}
                            shouldFocus={shouldFocusSearch}
                            onFocusComplete={() => setShouldFocusSearch(false)}
                            onClose={() => {
                                setIsSearchActive(false);
                            }}
                            onFocusFiles={() => {
                                // Ensure selection exists when focusing list from search (no editor open)
                                ensureSelectionForCurrentFilter({ openInEditor: false });
                            }}
                            containerRef={props.rootContainerRef}
                        />
                    )}
                </div>
                {/* Android - toolbar at top */}
                {isMobile && isAndroid && (
                    <ListToolbar
                        isSearchActive={isSearchActive}
                        onSearchToggle={() => {
                            if (!isSearchActive) {
                                // Opening search - activate with focus
                                setShouldFocusSearch(true);
                                setIsSearchActive(true);
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                            } else {
                                setIsSearchActive(false);
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            }
                        }}
                    />
                )}

                {/* Conditional content rendering */}
                {isEmptySelection ? (
                    <div className="nn-list-pane-scroller nn-empty-state">
                        <div className="nn-empty-message">{strings.listPane.emptyStateNoSelection}</div>
                    </div>
                ) : hasNoFiles ? (
                    <div className="nn-list-pane-scroller nn-empty-state">
                        <div className="nn-empty-message">{strings.listPane.emptyStateNoNotes}</div>
                    </div>
                ) : (
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
                                                (nextItem.type === ListPaneItemType.HEADER ||
                                                    nextItem.type === ListPaneItemType.TOP_SPACER ||
                                                    nextItem.type === ListPaneItemType.BOTTOM_SPACER)));

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
                                    // Index 1 because TOP_SPACER is at index 0
                                    const isFirstHeader = item.type === ListPaneItemType.HEADER && virtualItem.index === 1;

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

                                    // Compute separator visibility (class-based, not relational selectors)
                                    // - Hide the current row's separator when this row is the last in a contiguous
                                    //   selected block (selected && !hasSelectedBelow)
                                    // - Also hide the current row's separator when the next row starts a selected block
                                    //   (!selected && next is selected) to remove the line just before a selection.
                                    const hideSeparator =
                                        item.type === ListPaneItemType.FILE &&
                                        ((isSelected && !hasSelectedBelow) ||
                                            (!isSelected &&
                                                nextItem?.type === ListPaneItemType.FILE &&
                                                nextItem.data instanceof TFile &&
                                                multiSelection.isFileSelected(nextItem.data)));

                                    return (
                                        <div
                                            key={virtualItem.key}
                                            // Apply a lightweight class to control separator visibility
                                            className={`nn-virtual-item ${
                                                item.type === ListPaneItemType.FILE ? 'nn-virtual-file-item' : ''
                                            } ${isLastFile ? 'nn-last-file' : ''} ${hideSeparator ? 'nn-hide-separator-selection' : ''}`}
                                            style={
                                                {
                                                    transform: `translateY(${virtualItem.start}px)`,
                                                    '--item-height': `${virtualItem.size}px`
                                                } as React.CSSProperties
                                            }
                                            data-index={virtualItem.index}
                                        >
                                            {item.type === ListPaneItemType.HEADER ? (
                                                <div className={`nn-date-group-header ${isFirstHeader ? 'nn-first-header' : ''}`}>
                                                    {typeof item.data === 'string' ? item.data : ''}
                                                </div>
                                            ) : item.type === ListPaneItemType.TOP_SPACER ? (
                                                <div className="nn-list-top-spacer" />
                                            ) : item.type === ListPaneItemType.BOTTOM_SPACER ? (
                                                <div className="nn-list-bottom-spacer" />
                                            ) : item.type === ListPaneItemType.FILE && item.data instanceof TFile ? (
                                                <FileItem
                                                    key={item.key} // Ensures each file gets a fresh component instance, preventing stale data from previous files
                                                    file={item.data}
                                                    isSelected={isSelected}
                                                    hasSelectedAbove={hasSelectedAbove}
                                                    hasSelectedBelow={hasSelectedBelow}
                                                    onClick={handleFileItemClick(item.data, item.fileIndex)}
                                                    selectionType={selectionType}
                                                    dateGroup={dateGroup}
                                                    sortOption={effectiveSortOption}
                                                    parentFolder={item.parentFolder}
                                                    isPinned={item.isPinned}
                                                    searchQuery={isSearchActive ? searchQuery : undefined}
                                                />
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* iOS - toolbar at bottom */}
                {isMobile && !isAndroid && (
                    <ListToolbar
                        isSearchActive={isSearchActive}
                        onSearchToggle={() => {
                            if (!isSearchActive) {
                                // Opening search - activate with focus
                                setShouldFocusSearch(true);
                                setIsSearchActive(true);
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                            } else {
                                setIsSearchActive(false);
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            }
                        }}
                    />
                )}
            </div>
        );
    })
);
