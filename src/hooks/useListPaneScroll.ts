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
 * useListPaneScroll - Manages scrolling behavior for the ListPane component
 *
 * This hook handles:
 * - Virtual list initialization and management
 * - Scroll position tracking and restoration
 * - Dynamic item height calculation based on content
 * - Sticky header tracking for date groups
 * - Deferred scrolling for async list updates
 * - Mobile-specific scroll behaviors
 * - Scroll-to-file with header visibility
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useServices } from '../context/ServicesContext';
import { useFileCache } from '../context/StorageContext';
import { ListPaneItemType, LISTPANE_MEASUREMENTS, OVERSCAN } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import type { NotebookNavigatorSettings } from '../settings';
import type { SelectionState } from '../context/SelectionContext';

/**
 * Parameters for the useListPaneScroll hook
 */
interface UseListPaneScrollParams {
    /** List items to be rendered in the virtual list */
    listItems: ListPaneItem[];
    /** Map from file paths to their index in listItems */
    filePathToIndex: Map<string, number>;
    /** Currently selected file */
    selectedFile: TFile | null;
    /** Currently selected folder */
    selectedFolder: TFolder | null;
    /** Currently selected tag */
    selectedTag: string | null;
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Effective settings for the current folder */
    folderSettings: {
        titleRows: number;
        previewRows: number;
        showDate: boolean;
        showPreview: boolean;
        showImage: boolean;
    };
    /** Whether the list pane is currently visible */
    isVisible: boolean;
    /** Current selection state */
    selectionState: SelectionState;
    /** Selection state dispatcher */
    selectionDispatch: (action: { type: string; [key: string]: unknown }) => void;
}

/**
 * Return value of the useListPaneScroll hook
 */
interface UseListPaneScrollResult {
    /** TanStack Virtual virtualizer instance */
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Reference to the scroll container element */
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    /** Callback to set the scroll container ref */
    scrollContainerRefCallback: (element: HTMLDivElement | null) => void;
    /** Handler to scroll to top (mobile header tap) */
    handleScrollToTop: () => void;
}

/**
 * Hook that manages scrolling behavior for the ListPane component.
 * Handles virtualization, scroll position, and various scroll scenarios.
 *
 * @param params - Configuration parameters
 * @returns Virtualizer instance and scroll management utilities
 */
export function useListPaneScroll({
    listItems,
    filePathToIndex,
    selectedFile,
    selectedFolder,
    selectedTag,
    settings,
    folderSettings,
    isVisible,
    selectionState,
    selectionDispatch
}: UseListPaneScrollParams): UseListPaneScrollResult {
    const { isMobile } = useServices();
    const { hasPreview, getDB, isStorageReady } = useFileCache();

    // Reference to the scroll container DOM element
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    // Track list state changes and pending scroll operations
    const prevListKeyRef = useRef<string>(''); // Previous folder/tag context to detect navigation
    const prevShowSubfoldersRef = useRef<boolean>(settings.showNotesFromSubfolders); // Previous subfolder setting to detect toggles
    const pendingScrollRef = useRef<{ type: 'file' | 'top'; filePath?: string } | null>(null); // Deferred scroll operations for async list updates
    const [pendingScrollVersion, setPendingScrollVersion] = useState(0); // Version counter to trigger scroll effect execution

    // Track list items order to detect when items are reordered (for virtualizer reset)
    const listItemsKeyRef = useRef('');
    const currentListItemsKey = listItems.map(item => item.key).join('|');

    // Check if we're in slim mode
    const isSlimMode = !folderSettings.showDate && !folderSettings.showPreview && !folderSettings.showImage;

    /**
     * Initialize TanStack Virtual virtualizer with dynamic height calculation.
     * Handles different item types (headers, files, spacers) with appropriate heights.
     */
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
                // Index 1 because TOP_SPACER is at index 0
                const isFirstHeader = index === 1;
                if (isFirstHeader) {
                    return heights.firstHeader;
                }
                return heights.subsequentHeader;
            }

            if (item.type === ListPaneItemType.TOP_SPACER) {
                return heights.topSpacer;
            }
            if (item.type === ListPaneItemType.BOTTOM_SPACER) {
                return heights.bottomSpacer;
            }

            // For file items - calculate height including all components

            // Get actual preview status for accurate height calculation
            let hasPreviewText = false;
            if (
                item.type === ListPaneItemType.FILE &&
                item.data instanceof TFile &&
                folderSettings.showPreview &&
                item.data.extension === 'md'
            ) {
                // Use synchronous check from cache
                hasPreviewText = hasPreview(item.data.path);
            }

            // Calculate effective preview rows based on actual content
            // For pinned items, limit to 1 row max
            const effectivePreviewRows = item.isPinned ? 1 : hasPreviewText ? folderSettings.previewRows : 1;

            // Start with base padding
            let textContentHeight = 0;

            if (isSlimMode) {
                // Slim mode: only shows file name
                textContentHeight = heights.titleLineHeight * (folderSettings.titleRows || 1);
            } else {
                // Normal mode
                textContentHeight += heights.titleLineHeight * (folderSettings.titleRows || 1); // File name

                // Single row mode - show date+preview, tags, and parent folder
                // Pinned items are always treated as single row mode
                if (item.isPinned || folderSettings.previewRows < 2) {
                    // Date and preview share one line
                    if (folderSettings.showPreview || folderSettings.showDate) {
                        textContentHeight += heights.metadataLineHeight;
                    }

                    // Parent folder gets its own line (not shown for pinned items)
                    if (!item.isPinned && settings.showParentFolderNames && settings.showNotesFromSubfolders) {
                        const file = item.data instanceof TFile ? item.data : null;
                        const isInSubfolder = file && item.parentFolder && file.parent && file.parent.path !== item.parentFolder;
                        if (isInSubfolder) {
                            textContentHeight += heights.metadataLineHeight;
                        }
                    }
                } else {
                    // Multi-row mode - different layouts based on preview content
                    if (!hasPreviewText) {
                        // Empty preview: show date + parent folder on same line
                        const file = item.data instanceof TFile ? item.data : null;
                        const isInSubfolder = file && item.parentFolder && file.parent && file.parent.path !== item.parentFolder;
                        const showParentFolder = settings.showParentFolderNames && settings.showNotesFromSubfolders && isInSubfolder;

                        if (folderSettings.showDate || showParentFolder) {
                            textContentHeight += heights.metadataLineHeight;
                        }
                    } else {
                        // Has preview text: show multi-line preview, then date + parent folder
                        if (folderSettings.showPreview) {
                            textContentHeight += heights.multiLineLineHeight * effectivePreviewRows;
                        }
                        // Only add metadata line if date is shown OR parent folder is shown
                        const file = item.data instanceof TFile ? item.data : null;
                        const isInSubfolder = file && item.parentFolder && file.parent && file.parent.path !== item.parentFolder;
                        const showParentFolder = settings.showParentFolderNames && settings.showNotesFromSubfolders && isInSubfolder;

                        if (folderSettings.showDate || showParentFolder) {
                            textContentHeight += heights.metadataLineHeight;
                        }
                    }
                }
            }

            // Add tag row height if file has tags (in both normal and slim modes when showTags is enabled)
            if (settings.showFileTags && item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
                // Check if file has tags using the database
                const db = getDB();
                const tags = db.getCachedTags(item.data.path);
                const hasTags = tags.length > 0;

                if (hasTags) {
                    textContentHeight += heights.tagRowHeight;
                }
            }

            // Apply min-height constraint AFTER including all content (but not in slim mode)
            // This ensures text content aligns with feature image height when shown
            if (!isSlimMode && textContentHeight < heights.featureImageHeight) {
                textContentHeight = heights.featureImageHeight;
            }

            // Use reduced padding for slim mode (with mobile-specific padding)
            const padding = isSlimMode ? (isMobile ? heights.slimPaddingMobile : heights.slimPadding) : heights.basePadding;
            return padding + textContentHeight;
        },
        overscan: OVERSCAN,
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0
    });

    /**
     * Callback for when scroll container ref is set.
     * Used as a ref callback to capture the DOM element.
     */
    const scrollContainerRefCallback = useCallback((element: HTMLDivElement | null) => {
        if (element && element !== scrollContainerRef.current) {
            // Intentionally empty - just updating the ref
        }
        scrollContainerRef.current = element as HTMLDivElement;
    }, []);

    /**
     * Scroll to top handler for mobile header tap.
     * Uses smooth scrolling for better UX on mobile.
     */
    const handleScrollToTop = useCallback(() => {
        if (isMobile && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isMobile]);

    // Get scroll index for a file, adjusting to show top group header when navigating folders
    // This ensures the top group header (pinned or date) is visible when changing folders/tags
    const getSelectionIndex = useCallback(
        (filePath: string) => {
            const fileIndex = filePathToIndex.get(filePath);

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
            return -1;
        },
        [filePathToIndex, listItems]
    );

    /**
     * Reset virtualizer measurements when list items are reordered.
     * This ensures correct scroll positions after sort changes.
     */
    useEffect(() => {
        if (listItemsKeyRef.current && listItemsKeyRef.current !== currentListItemsKey) {
            // List items have been reordered, reset virtualizer measurements
            rowVirtualizer.measure();
        }
        listItemsKeyRef.current = currentListItemsKey;
    }, [currentListItemsKey, rowVirtualizer]);

    /**
     * Process pending scroll operations.
     * Handles deferred scrolling for single-pane mode and ensures proper timing
     * after list updates or visibility changes.
     */
    useEffect(() => {
        if (!rowVirtualizer || !pendingScrollRef.current || !isVisible) {
            return;
        }

        const pending = pendingScrollRef.current;
        let shouldClearPending = false;

        if (pending.type === 'file' && pending.filePath) {
            const index = getSelectionIndex(pending.filePath);
            if (index >= 0) {
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
    }, [rowVirtualizer, filePathToIndex, isVisible, pendingScrollVersion, getSelectionIndex]);

    /**
     * Subscribe to database content changes and re-measure virtualizer when needed.
     * Handles preview text, feature images, tags, and metadata changes.
     */
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

                // For tag changes, always remeasure to handle height changes
                // When tags are added/removed, the height of the item changes
                if (change.changes.tags !== undefined) {
                    return true;
                }

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

    /**
     * Listen for mobile drawer visibility events.
     * Ensures selected file is visible when drawer opens.
     */
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

    /**
     * Re-measure all items when height-affecting settings change.
     * Includes date display, preview settings, feature images, etc.
     */
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
        folderSettings.showDate,
        folderSettings.showPreview,
        folderSettings.showImage,
        folderSettings.titleRows,
        folderSettings.previewRows,
        rowVirtualizer
    ]);

    /**
     * Re-measure when storage becomes ready after cold boot.
     * Ensures heights are correct once preview data is available.
     */
    useEffect(() => {
        if (isStorageReady && rowVirtualizer) {
            rowVirtualizer.measure();
        }
    }, [isStorageReady, rowVirtualizer]);

    /**
     * Handle scrolling when subfolder visibility setting changes.
     * Maintains scroll position on the selected file or scrolls to top.
     */
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

    /**
     * Handle scrolling when navigating between folders/tags.
     * Supports both visible and hidden panes (for single-pane mode).
     * Manages folder navigation flags and list context changes.
     */
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
        selectionState.isFolderNavigation,
        selectionDispatch,
        listItems.length
    ]);

    /**
     * Handle reveal operations (e.g., reveal active file command).
     * Uses pending scroll for proper timing and measurement.
     */
    useEffect(() => {
        if (selectionState.isRevealOperation && selectedFile && isVisible) {
            // Always use pending scroll for reveal operations
            // This ensures proper timing and measurement before scrolling
            pendingScrollRef.current = { type: 'file', filePath: selectedFile.path };
            setPendingScrollVersion(v => v + 1);
        }
    }, [selectionState.isRevealOperation, selectedFile, isVisible, selectionDispatch, filePathToIndex]);

    return {
        rowVirtualizer,
        scrollContainerRef,
        scrollContainerRefCallback,
        handleScrollToTop
    };
}
