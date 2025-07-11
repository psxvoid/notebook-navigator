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

import React, { useMemo, useLayoutEffect, useCallback, useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { TFile } from 'obsidian';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useServices } from '../context/ServicesContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { FileItem } from './FileItem';
import { DateUtils } from '../utils/DateUtils';
import { isTFile } from '../utils/typeGuards';
import { getDateField, getEffectiveSortOption } from '../utils/sortUtils';
import { getFilesForFolder, getFilesForTag, collectPinnedPaths } from '../utils/fileFinder';
import { strings } from '../i18n';
import type { FileListItem } from '../types/virtualization';
import { PaneHeader } from './PaneHeader';
import { FileListItemType, ItemType, FILELIST_MEASUREMENTS } from '../types';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { useVisibilityReveal } from '../hooks/useVisibilityReveal';
import { useMultiSelection } from '../hooks/useMultiSelection';
import { ErrorBoundary } from './ErrorBoundary';


/**
 * Renders the file list pane displaying files from the selected folder.
 * Handles file sorting, grouping by date, pinned notes, and auto-selection.
 * Integrates with the app context to manage file selection and navigation.
 * 
 * @returns A scrollable list of files grouped by date (if enabled) with empty state handling
 */
export interface FileListHandle {
    getIndexOfPath: (path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
}

export const FileList = forwardRef<FileListHandle>((props, ref) => {
    const { app, plugin, isMobile } = useServices();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const settings = useSettingsState();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const { selectionType, selectedFolder, selectedTag, selectedFile, selectedFiles } = selectionState;
    
    
    
    
    // Track if the file selection is from user click vs auto-selection
    const isUserSelectionRef = useRef(false);
    const [fileVersion, setFileVersion] = useState(0);
    
    // Track current visible date group for sticky header
    const [currentDateGroup, setCurrentDateGroup] = useState<string | null>(null);
    
    // Initialize multi-selection hook
    const multiSelection = useMultiSelection();
    
    const handleFileClick = useCallback((file: TFile, e: React.MouseEvent, fileIndex?: number, orderedFiles?: TFile[]) => {
        isUserSelectionRef.current = true;  // Mark this as a user selection
        
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
        
        // Always ensure files pane has focus when clicking a file
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
    }, [app.workspace, selectionDispatch, uiDispatch, isMobile, multiSelection]);
    
    // This effect now only listens for vault events to trigger a refresh
    useEffect(() => {
        const forceUpdate = () => setFileVersion(v => v + 1);

        const vaultEvents = [
            app.vault.on('create', forceUpdate),
            app.vault.on('delete', forceUpdate),
            app.vault.on('rename', forceUpdate)
        ];
        const metadataEvent = app.metadataCache.on('changed', forceUpdate);

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
    }, [selectedFile, app.workspace, settings.autoSelectFirstFileOnFocusChange, isMobile, selectionState.isRevealOperation, selectionState.isFolderChangeWithAutoSelect, selectionState.isKeyboardNavigation, selectionDispatch]);
    
    // Auto-select active file or first file when files pane gains focus
    useEffect(() => {
        // Only run when files pane gains focus (desktop only - mobile doesn't have focus states)
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
    
    // On mobile: check if active file should be shown as selected (but don't auto-focus/scroll)
    useEffect(() => {
        if (!isMobile) return;
        
        // Get the currently active file
        const activeFile = app.workspace.getActiveFile();
        
        // If active file is in current view and not already selected, select it
        if (activeFile && files.includes(activeFile) && selectedFile?.path !== activeFile.path) {
            // Don't trigger auto-open on mobile
            selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
            selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
            isUserSelectionRef.current = false;
        }
    }, [isMobile, files, selectedFile, selectionDispatch, app.workspace]);
    
    
    const [listItems, setListItems] = useState<FileListItem[]>([]);
    
    useEffect(() => {
        const rebuildListItems = () => {
            const items: FileListItem[] = [];
            
            // Get the appropriate pinned paths based on selection type
            let pinnedPaths: Set<string>;
            
            if (selectionType === ItemType.FOLDER && selectedFolder) {
                pinnedPaths = collectPinnedPaths(
                    settings.pinnedNotes,
                    selectedFolder,
                    settings.showNotesFromSubfolders
                );
            } else if (selectionType === ItemType.TAG) {
                pinnedPaths = collectPinnedPaths(settings.pinnedNotes);
            } else {
                pinnedPaths = new Set<string>();
            }
            
            // Separate pinned and unpinned files
            const pinnedFiles = files.filter(f => pinnedPaths.has(f.path));
            const unpinnedFiles = files.filter(f => !pinnedPaths.has(f.path));
            
            // Add pinned files
            if (pinnedFiles.length > 0) {
                items.push({ 
                    type: FileListItemType.HEADER, 
                    data: strings.fileList.pinnedSection,
                    key: `header-pinned-${selectedFolder?.path || 'root'}`
                });
                pinnedFiles.forEach(file => {
                    items.push({ 
                        type: FileListItemType.FILE, 
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path
                    });
                });
            }
            
            // Determine which sort option to use
            const sortOption = getEffectiveSortOption(settings, selectionType, selectedFolder, selectedTag);
            
            // Add unpinned files with date grouping if enabled
            if (!settings.groupByDate || sortOption.startsWith('title')) {
                // No date grouping
                unpinnedFiles.forEach(file => {
                    items.push({ 
                        type: FileListItemType.FILE, 
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
                    const timestamp = DateUtils.getFileTimestamp(
                        file, 
                        dateField === 'ctime' ? 'created' : 'modified',
                        settings,
                        app.metadataCache
                    );
                    const groupTitle = DateUtils.getDateGroup(timestamp);
                    
                    if (groupTitle !== currentGroup) {
                        currentGroup = groupTitle;
                        items.push({ 
                            type: FileListItemType.HEADER, 
                            data: groupTitle,
                            key: `header-${selectedFolder?.path || selectedTag || 'root'}-${groupTitle}`
                        });
                    }
                    
                    items.push({ 
                        type: FileListItemType.FILE, 
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path
                    });
                });
            }
            
            // Add spacer at the end for better visibility of last item
            items.push({
                type: FileListItemType.SPACER,
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
        strings.fileList.pinnedSection
    ]);
    
    // Add ref for scroll container
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    // Cache selected file path to avoid repeated property access
    const selectedFilePath = selectedFile?.path;
    
    // Create a map for O(1) file lookups
    const filePathToIndex = useMemo(() => {
        const map = new Map<string, number>();
        listItems.forEach((item, index) => {
            if (item.type === FileListItemType.FILE) {
                if (isTFile(item.data)) {
                    map.set(item.data.path, index);
                }
            }
        });
        return map;
    }, [listItems]);
    
    /**
     * Mobile scroll momentum preservation system
     * 
     * Problem: On mobile, when items are added to the top of a virtualized list during 
     * momentum scrolling (inertia scrolling), the browser stops the scroll abruptly.
     * This happens because the DOM changes under the user's finger, breaking the native
     * scroll behavior.
     * 
     * Solution: We track scroll state, velocity, and item count changes. When new items
     * are added during scrolling, we calculate their height and adjust the scroll position
     * to maintain visual continuity without interrupting the momentum.
     * 
     * Mobile-specific because:
     * - Desktop uses mouse wheel or scrollbar, which don't have momentum
     * - Mobile touch scrolling has native momentum that we need to preserve
     * - The issue only manifests on mobile devices with touch interfaces
     */
    const scrollStateRef = useRef({
        isScrolling: false,
        lastScrollTop: 0,
        scrollVelocity: 0,
        lastTimestamp: 0,
        animationFrameId: 0,
        scrollEndTimeoutId: 0
    });
    
    // Mobile scroll handling constants
    const { velocityThreshold, scrollEndDelay, momentumDuration, velocityCalcMaxDiff } = FILELIST_MEASUREMENTS.scrollConstants;
    
    // Track previous item count to detect when items are added
    const prevItemCountRef = useRef(listItems.length);
    
    
    // Initialize virtualizer
    const rowVirtualizer = useVirtualizer({
        count: listItems.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => {
            const item = listItems[index];
            const { heights } = FILELIST_MEASUREMENTS;
            
            if (item.type === FileListItemType.HEADER) {
                // Date group headers have fixed heights from CSS
                const isFirstHeader = index === 0 || (index > 0 && listItems[index - 1].type !== FileListItemType.HEADER);
                if (isFirstHeader) {
                    return heights.firstHeader;
                }
                return heights.subsequentHeader;
            }
            
            if (item.type === FileListItemType.SPACER) {
                return heights.spacer;
            }

            // For file items
            const { showDate, showFilePreview, showFeatureImage, fileNameRows, previewRows, showParentFolderNames } = settings;
            
            // Check if we're in slim mode (no date, preview, or image)
            const isSlimMode = !showDate && !showFilePreview && !showFeatureImage;
            
            // Base height: padding
            let estimatedHeight = heights.basePadding;
            
            // Add height for file name
            const nameLines = fileNameRows || 1;
            estimatedHeight += (heights.fileLineHeight * nameLines);
            
            if (!isSlimMode) {
                // Check preview layout mode
                if (showFilePreview && previewRows === 1) {
                    // Single line preview: date and preview on same line
                    if (showDate || showFilePreview) {
                        estimatedHeight += heights.secondLineHeight;
                    }
                } else if (showFilePreview && previewRows >= 2) {
                    // Multi-line preview mode
                    estimatedHeight += (heights.multiLineHeight * previewRows);
                    if (showDate) {
                        estimatedHeight += heights.dateLineHeight;
                    }
                } else if (showDate && !showFilePreview) {
                    // Just date, no preview
                    estimatedHeight += heights.dateLineHeight;
                }
            }
            
            // Add height for subfolder indicator if shown
            // This only shows when file is in a subfolder
            if (showParentFolderNames && settings.showNotesFromSubfolders) {
                // We can't know if this specific file is in a subfolder without more context
                // So we add a conservative estimate
                estimatedHeight += heights.parentFolderLineHeight;
            }
            
            // Note: Feature image doesn't add height (it's inline with flex)
            
            return Math.max(estimatedHeight, heights.minTouchTargetHeight);
        },
        overscan: isMobile ? FILELIST_MEASUREMENTS.overscan.mobile : FILELIST_MEASUREMENTS.overscan.desktop,
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0,
        // Custom scroll function that preserves momentum on mobile
        scrollToFn: (offset, options, instance) => {
            if (isMobile && scrollStateRef.current.isScrolling && 
                Math.abs(scrollStateRef.current.scrollVelocity) > velocityThreshold) {
                // Don't interrupt momentum scrolling on mobile
                return;
            }
            
            // Use default scrolling behavior
            const scrollEl = instance.scrollElement;
            if (scrollEl) {
                scrollEl.scrollTo({
                    top: offset,
                    behavior: options?.behavior || 'auto'
                });
            }
        },
    });
    
    // Expose the virtualizer instance and file lookup method via the ref
    useImperativeHandle(ref, () => ({
        getIndexOfPath: (path: string) => filePathToIndex.get(path) ?? -1,
        virtualizer: rowVirtualizer,
        scrollContainerRef: scrollContainerRef.current
    }), [filePathToIndex, rowVirtualizer]);
    
    // Reset scroll position to top when folder/tag changes
    useEffect(() => {
        // Scroll to top when switching folders or tags
        if (rowVirtualizer && scrollContainerRef.current) {
            rowVirtualizer.scrollToIndex(0, { align: 'start', behavior: 'auto' });
            
        }
        // Reset current date group when changing folders/tags
        setCurrentDateGroup(null);
    }, [selectedFolder, selectedTag, rowVirtualizer]);
    
    // Preserve scroll position when items are added on mobile
    useLayoutEffect(() => {
        if (!isMobile || !scrollContainerRef.current || !rowVirtualizer) return;
        
        const prevCount = prevItemCountRef.current;
        const currentCount = listItems.length;
        
        // Early exit if no change or items were removed
        if (currentCount <= prevCount) {
            prevItemCountRef.current = currentCount;
            return;
        }
        
        // Only preserve position during active scrolling AND when files view is visible
        if (!scrollStateRef.current.isScrolling || (uiState.singlePane && uiState.currentSinglePaneView !== 'files')) {
            prevItemCountRef.current = currentCount;
            return;
        }
        
        const scrollContainer = scrollContainerRef.current;
        const visibleRange = rowVirtualizer.getVirtualItems();
        
        // No visible items, nothing to adjust
        if (visibleRange.length === 0) {
            prevItemCountRef.current = currentCount;
            return;
        }
        
        const firstVisibleIndex = visibleRange[0].index;
        
        // Already at top, no adjustment needed
        if (firstVisibleIndex === 0) {
            prevItemCountRef.current = currentCount;
            return;
        }
        
        // Calculate how many items affect our current position
        const itemsAddedAbove = Math.min(currentCount - prevCount, firstVisibleIndex);
        
        if (itemsAddedAbove > 0) {
            // Store current position
            const currentScrollTop = scrollContainer.scrollTop;
            
            // Calculate total height of items added above current view
            let heightAdjustment = 0;
            for (let i = 0; i < itemsAddedAbove; i++) {
                heightAdjustment += rowVirtualizer.options.estimateSize(i);
            }
            
            if (heightAdjustment > 0) {
                // Apply position adjustment immediately to prevent visual jump
                queueMicrotask(() => {
                    // Check if component is still mounted by verifying scrollContainer exists
                    if (scrollContainer && scrollContainer.isConnected && scrollStateRef.current.isScrolling) {
                        scrollContainer.scrollTop = currentScrollTop + heightAdjustment;
                    }
                });
            }
        }
        
        prevItemCountRef.current = currentCount;
    }, [listItems.length, isMobile, rowVirtualizer]);
    
    
    // Create a unique key for storing scroll state based on current selection
    const scrollStateKey = useMemo(() => {
        if (selectionType === ItemType.FOLDER && selectedFolder) {
            return `nn-scroll-${selectedFolder.path}`;
        } else if (selectionType === ItemType.TAG && selectedTag) {
            return `nn-scroll-tag-${selectedTag}`;
        }
        return null;
    }, [selectionType, selectedFolder, selectedTag]);
    
    // Determine if file list is visible
    const isVisible = !uiState.singlePane || uiState.currentSinglePaneView === 'files';
    
    // Use visibility-based reveal with scroll position preservation
    useVisibilityReveal({
        getSelectionIndex: () => {
            if (selectedFilePath) {
                const fileIndex = filePathToIndex.get(selectedFilePath);
                if (fileIndex !== undefined && fileIndex !== -1) {
                    // Check if there's a header immediately before this file
                    // Only scroll to header if this is the first file in the list
                    if (fileIndex > 0 && listItems[fileIndex - 1]?.type === FileListItemType.HEADER) {
                        const isFirstFileInList = fileIndex === 1 || (fileIndex === 2 && listItems[0]?.type === FileListItemType.HEADER);
                        if (isFirstFileInList) {
                            return fileIndex - 1;
                        }
                    }
                    return fileIndex;
                }
            }
            return -1;
        },
        virtualizer: rowVirtualizer,
        isVisible,
        isMobile,
        isRevealOperation: selectionState.isRevealOperation,
        preserveScrollOnHide: true,  // Enable scroll position preservation
        scrollContainerRef  // Pass the ref directly
    });
    
    // Add keyboard navigation
    useVirtualKeyboardNavigation({
        items: listItems,
        virtualizer: rowVirtualizer,
        focusedPane: 'files',
        containerRef: scrollContainerRef
    });
    
    
    // Pre-calculate date field for all files in the group
    const dateField = useMemo(() => {
        return getDateField(settings.defaultFolderSort);
    }, [settings.defaultFolderSort]);
    
    // Pre-compute formatted dates for all files to avoid doing it in render
    const filesWithDates = useMemo(() => {
        if (!settings.showDate) return null;
        
        const dateMap = new Map<string, string>();
        let currentGroup: string | null = null;
        
        listItems.forEach(item => {
            if (item.type === FileListItemType.HEADER) {
                currentGroup = item.data as string;
            } else if (item.type === FileListItemType.FILE) {
                const file = item.data;
                if (!isTFile(file)) return;
                const timestamp = DateUtils.getFileTimestamp(
                    file,
                    dateField === 'ctime' ? 'created' : 'modified',
                    settings,
                    app.metadataCache
                );
                const formatted = currentGroup && currentGroup !== strings.fileList.pinnedSection
                    ? DateUtils.formatDateForGroup(timestamp, currentGroup, settings.dateFormat, settings.timeFormat)
                    : DateUtils.formatDate(timestamp, settings.dateFormat);
                dateMap.set(file.path, formatted);
            }
        });
        return dateMap;
    }, [listItems, dateField, settings.showDate, settings.dateFormat, settings.timeFormat, settings.useFrontmatterDates, settings.frontmatterCreatedField, settings.frontmatterModifiedField, settings.frontmatterDateFormat, strings.fileList.pinnedSection]);
    
    // Track scroll events and calculate velocity on mobile
    useEffect(() => {
        if (!isMobile || !scrollContainerRef.current) return;
        
        const scrollContainer = scrollContainerRef.current;
        
        // Reset scroll state when effect runs (e.g., switching to mobile)
        scrollStateRef.current = {
            isScrolling: false,
            lastScrollTop: 0,
            scrollVelocity: 0,
            lastTimestamp: 0,
            animationFrameId: 0,
            scrollEndTimeoutId: 0
        };
        
        const handleTouchStart = () => {
            scrollStateRef.current.isScrolling = true;
            // Clear any pending scroll end timeout
            if (scrollStateRef.current.scrollEndTimeoutId) {
                clearTimeout(scrollStateRef.current.scrollEndTimeoutId);
                scrollStateRef.current.scrollEndTimeoutId = 0;
            }
        };
        
        const handleTouchEnd = () => {
            // Keep scrolling state active for momentum duration
            scrollStateRef.current.scrollEndTimeoutId = window.setTimeout(() => {
                // Check if component is still mounted by verifying ref exists
                if (scrollContainerRef.current) {
                    scrollStateRef.current.isScrolling = false;
                    scrollStateRef.current.scrollVelocity = 0;
                    scrollStateRef.current.scrollEndTimeoutId = 0;
                }
            }, momentumDuration);
        };
        
        const handleScroll = () => {
            const currentScrollTop = scrollContainer.scrollTop;
            const currentTime = performance.now();
            const timeDiff = currentTime - scrollStateRef.current.lastTimestamp;
            
            if (timeDiff > 0 && timeDiff < velocityCalcMaxDiff) {
                scrollStateRef.current.scrollVelocity = 
                    (currentScrollTop - scrollStateRef.current.lastScrollTop) / timeDiff;
            }
            
            scrollStateRef.current.lastScrollTop = currentScrollTop;
            scrollStateRef.current.lastTimestamp = currentTime;
            scrollStateRef.current.isScrolling = true;
            
            // Clear existing timeouts
            if (scrollStateRef.current.animationFrameId) {
                cancelAnimationFrame(scrollStateRef.current.animationFrameId);
            }
            if (scrollStateRef.current.scrollEndTimeoutId) {
                clearTimeout(scrollStateRef.current.scrollEndTimeoutId);
                scrollStateRef.current.scrollEndTimeoutId = 0;
            }
            
            // Set new timeout for scroll end detection
            scrollStateRef.current.animationFrameId = requestAnimationFrame(() => {
                scrollStateRef.current.scrollEndTimeoutId = window.setTimeout(() => {
                    // Check if component is still mounted
                    if (scrollContainerRef.current) {
                        // Only stop if velocity is low
                        if (Math.abs(scrollStateRef.current.scrollVelocity) < velocityThreshold) {
                            scrollStateRef.current.isScrolling = false;
                            scrollStateRef.current.scrollVelocity = 0;
                            scrollStateRef.current.scrollEndTimeoutId = 0;
                        }
                    }
                }, scrollEndDelay);
            });
        };
        
        scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            // Use current ref value in cleanup to ensure we remove from correct element
            const container = scrollContainerRef.current;
            if (container) {
                container.removeEventListener('touchstart', handleTouchStart);
                container.removeEventListener('touchend', handleTouchEnd);
                container.removeEventListener('scroll', handleScroll);
            }
            if (scrollStateRef.current.animationFrameId) {
                cancelAnimationFrame(scrollStateRef.current.animationFrameId);
            }
            if (scrollStateRef.current.scrollEndTimeoutId) {
                clearTimeout(scrollStateRef.current.scrollEndTimeoutId);
            }
        };
    }, [isMobile, velocityThreshold, scrollEndDelay, momentumDuration, velocityCalcMaxDiff]);
    
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
                if (!item || item.type !== FileListItemType.HEADER) continue;
                
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
            if (item.type === FileListItemType.FILE) {
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
            <div className="nn-file-pane">
                <PaneHeader type="files" onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
                <div className="nn-file-list nn-empty-state">
                    <div className="nn-empty-message">{strings.fileList.emptyStateNoSelection}</div>
                </div>
            </div>
        );
    }
    
    if (files.length === 0) {
        return (
            <div className="nn-file-pane">
                <PaneHeader type="files" onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
                <div className="nn-file-list nn-empty-state">
                    <div className="nn-empty-message">{strings.fileList.emptyStateNoNotes}</div>
                </div>
            </div>
        );
    }
    
    return (
        <ErrorBoundary componentName="FileList">
            <div className="nn-file-pane">
                <PaneHeader type="files" onHeaderClick={handleScrollToTop} currentDateGroup={currentDateGroup} />
            <div 
                ref={scrollContainerRef}
                className="nn-file-list"
                data-pane="files"
                role="list"
                tabIndex={-1}
            >
                {/* Virtual list */}
                {listItems.length > 0 && (
                    <div
                        key={`${files.length}-${selectedFolder?.path || selectedTag || 'root'}`}
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                            const item = safeGetItem(listItems, virtualItem.index);
                            if (!item) return null;
                            const isSelected = item.type === FileListItemType.FILE && 
                                isTFile(item.data) && multiSelection.isFileSelected(item.data);
                            
                            // Check if this is the last file item
                            const nextItem = safeGetItem(listItems, virtualItem.index + 1);
                            const isLastFile = item.type === FileListItemType.FILE && 
                                (virtualItem.index === listItems.length - 1 || 
                                 (nextItem && nextItem.type === FileListItemType.HEADER));
                            
                            // Check if adjacent items are selected (for styling purposes)
                            const prevItem = safeGetItem(listItems, virtualItem.index - 1);
                            const hasSelectedAbove = item.type === FileListItemType.FILE && prevItem?.type === FileListItemType.FILE && 
                                isTFile(prevItem.data) && multiSelection.isFileSelected(prevItem.data);
                            const hasSelectedBelow = item.type === FileListItemType.FILE && nextItem?.type === FileListItemType.FILE && 
                                isTFile(nextItem.data) && multiSelection.isFileSelected(nextItem.data);
                            
                            // Check if this is the first header
                            const isFirstHeader = item.type === FileListItemType.HEADER && virtualItem.index === 0;
                            
                            
                            
                            // Find current date group for file items
                            let dateGroup: string | null = null;
                            if (item.type === FileListItemType.FILE) {
                                // Look backwards to find the most recent header
                                for (let i = virtualItem.index - 1; i >= 0; i--) {
                                    const prevItem = safeGetItem(listItems, i);
                                    if (prevItem && prevItem.type === FileListItemType.HEADER) {
                                        dateGroup = prevItem.data as string;
                                        break;
                                    }
                                }
                            }
                            
                            return (
                                <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    ref={rowVirtualizer.measureElement}
                                    className={`nn-virtual-item ${item.type === FileListItemType.FILE ? 'nn-virtual-file-item' : ''} ${isLastFile ? 'nn-last-file' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    {item.type === FileListItemType.HEADER ? (
                                        <div className={`nn-date-group-header ${isFirstHeader ? 'nn-first-header' : ''}`}>
                                            {typeof item.data === 'string' ? item.data : ''}
                                        </div>
                                    ) : item.type === FileListItemType.SPACER ? (
                                        <div className="nn-file-list-spacer" />
                                    ) : item.type === FileListItemType.FILE && isTFile(item.data) ? (
                                        <FileItem
                                            key={item.key}
                                            file={item.data}
                                            isSelected={isSelected}
                                            hasSelectedAbove={hasSelectedAbove}
                                            hasSelectedBelow={hasSelectedBelow}
                                            onClick={(e) => {
                                                // Find the actual index of this file in the display order
                                                // Count only file items, not headers or spacers
                                                let fileIndex = 0;
                                                for (let i = 0; i < virtualItem.index; i++) {
                                                    if (listItems[i]?.type === FileListItemType.FILE) {
                                                        fileIndex++;
                                                    }
                                                }
                                                if (isTFile(item.data)) {
                                                    handleFileClick(item.data, e, fileIndex, orderedFiles);
                                                }
                                            }}
                                            dateGroup={dateGroup}
                                            formattedDate={isTFile(item.data) ? filesWithDates?.get(item.data.path) : undefined}
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
        </ErrorBoundary>
    );
});