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
import { TFile, TFolder, TAbstractFile, getAllTags, Platform } from 'obsidian';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useServices } from '../context/ServicesContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { FileItem } from './FileItem';
import { DateUtils } from '../utils/DateUtils';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { getFileFromElement } from '../utils/domUtils';
import { getDateField, getEffectiveSortOption } from '../utils/sortUtils';
import { getFilesForFolder, getFilesForTag, collectPinnedPaths } from '../utils/fileFinder';
import { strings } from '../i18n';
import type { FileListItem } from '../types/virtualization';
import { PaneHeader } from './PaneHeader';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { scrollVirtualItemIntoView } from '../utils/virtualUtils';
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
    const { selectionType, selectedFolder, selectedTag, selectedFile } = selectionState;
    
    
    
    // Track if the file selection is from user click vs auto-selection
    const isUserSelectionRef = useRef(false);
    const [fileVersion, setFileVersion] = useState(0);
    
    const handleFileClick = useCallback((file: TFile, e: React.MouseEvent) => {
        isUserSelectionRef.current = true;  // Mark this as a user selection
        selectionDispatch({ type: 'SET_SELECTED_FILE', file });
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        
        // Focus the container
        const container = document.querySelector('.nn-split-container') as HTMLElement;
        if (container) container.focus();
        
        // Check if CMD (Mac) or Ctrl (Windows/Linux) is pressed
        const openInNewTab = e.metaKey || e.ctrlKey;
        
        // Open file in new tab or current tab based on modifier key
        const leaf = openInNewTab ? app.workspace.getLeaf('tab') : app.workspace.getLeaf(false);
        if (leaf) {
            leaf.openFile(file, { active: false });
        }
        
        // Collapse left sidebar on mobile after opening file
        if (isMobile && app.workspace.leftSplit) {
            // Scroll to top before collapsing to prevent virtualization issues
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
            
            app.workspace.leftSplit.collapse();
        }
    }, [app.workspace, selectionDispatch, uiDispatch, isMobile]);
    
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

        if (selectionType === 'folder' && selectedFolder) {
            allFiles = getFilesForFolder(selectedFolder, settings, app);
        } else if (selectionType === 'tag' && selectedTag) {
            allFiles = getFilesForTag(selectedTag, settings, app);
        }
        
        
        return allFiles;
    }, [selectionType, selectedFolder, selectedTag, settings, app, fileVersion]);
    
    // Auto-open file when it's selected via folder/tag change (not user click)
    useEffect(() => {
        // Check if this is a reveal operation - if so, skip auto-open
        const isRevealOperation = selectionState.isRevealOperation;
        const isFolderChangeWithAutoSelect = selectionState.isFolderChangeWithAutoSelect;
        
        
        // Skip auto-open if this is a reveal operation
        if (isRevealOperation) {
            return;
        }
        
        if (selectedFile && !isUserSelectionRef.current && settings.autoSelectFirstFile && !isMobile) {
            // Check if we're actively navigating the navigator
            const navigatorEl = document.querySelector('.nn-split-container');
            const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);
            
            
            // Open the file if we're not actively using the navigator OR if this is a folder change with auto-select
            if (!hasNavigatorFocus || isFolderChangeWithAutoSelect) {
                // This is an auto-selection from folder/tag change
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    leaf.openFile(selectedFile!, { active: false });
                }
            }
        }
        // Reset the flag after processing
        isUserSelectionRef.current = false;
    }, [selectedFile, app.workspace, settings.autoSelectFirstFile, isMobile, selectionState.isRevealOperation, selectionState.isFolderChangeWithAutoSelect]);
    
    // Auto-select first file when files pane gains focus and no file is selected (desktop only)
    useEffect(() => {
        
    }, [isMobile, uiState.focusedPane, selectedFile, files, selectionDispatch, app.workspace]);
    
    
    const [listItems, setListItems] = useState<FileListItem[]>([]);
    
    useEffect(() => {
        const rebuildListItems = () => {
            const items: FileListItem[] = [];
            
            // Get the appropriate pinned paths based on selection type
            let pinnedPaths: Set<string>;
            
            if (selectionType === 'folder' && selectedFolder) {
                pinnedPaths = collectPinnedPaths(
                    settings.pinnedNotes,
                    selectedFolder,
                    settings.showNotesFromSubfolders
                );
            } else if (selectionType === 'tag') {
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
                    type: 'header', 
                    data: strings.fileList.pinnedSection,
                    key: `header-pinned-${selectedFolder?.path || 'root'}`
                });
                pinnedFiles.forEach(file => {
                    items.push({ 
                        type: 'file', 
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path
                    });
                });
            }
            
            // Determine which sort option to use
            const sortOption = getEffectiveSortOption(settings, selectionType, selectedFolder);
            
            // Add unpinned files with date grouping if enabled
            if (!settings.groupByDate || sortOption.startsWith('title')) {
                // No date grouping
                unpinnedFiles.forEach(file => {
                    items.push({ 
                        type: 'file', 
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
                            type: 'header', 
                            data: groupTitle,
                            key: `header-${selectedFolder?.path || selectedTag || 'root'}-${groupTitle}`
                        });
                    }
                    
                    items.push({ 
                        type: 'file', 
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path
                    });
                });
            }
            
            // Add spacer at the end for better visibility of last item
            items.push({
                type: 'spacer',
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
            if (item.type === 'file') {
                map.set((item.data as TFile).path, index);
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
    
    // Constants for mobile scroll handling
    const VELOCITY_THRESHOLD = 0.1;        // Minimum velocity to consider as momentum scrolling
    const SCROLL_END_DELAY = 150;          // Delay before marking scroll as ended
    const MOMENTUM_DURATION = 500;         // How long to preserve state after touch end
    const VELOCITY_CALC_MAX_DIFF = 100;    // Max time diff (ms) for velocity calculation
    
    // Track previous item count to detect when items are added
    const prevItemCountRef = useRef(listItems.length);
    
    
    // Initialize virtualizer
    const rowVirtualizer = useVirtualizer({
        count: listItems.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => {
            const item = listItems[index];
            if (item.type === 'header') {
                // Date group headers have different heights
                const isFirstHeader = index === 0 || (index > 0 && listItems[index - 1].type !== 'header');
                if (isFirstHeader) {
                    return 35; // First header: less top padding
                }
                return 50; // Subsequent headers: extra top margin + padding
            }
            
            if (item.type === 'spacer') {
                return 20; // Fixed height for spacer
            }

            // For file items
            const { showDate, showFilePreview, showFeatureImage, fileNameRows, previewRows, showSubfolderNamesInList } = settings;
            
            // Check if we're in slim mode (no date, preview, or image)
            const isSlimMode = !showDate && !showFilePreview && !showFeatureImage;
            
            // Base height: padding (var(--size-4-2) * 2 ≈ 16px)
            let estimatedHeight = 16;
            
            // Add height for file name
            const nameLines = fileNameRows || 1;
            estimatedHeight += (20 * nameLines); // ~20px per line with line-height 1.4
            
            if (!isSlimMode) {
                // Check preview layout mode
                if (showFilePreview && previewRows === 1) {
                    // Single line preview: date and preview on same line
                    if (showDate || showFilePreview) {
                        estimatedHeight += 22; // Height for second line with date/preview
                    }
                } else if (showFilePreview && previewRows >= 2) {
                    // Multi-line preview mode
                    estimatedHeight += (19 * previewRows); // Preview lines
                    if (showDate) {
                        estimatedHeight += 20; // Date below preview
                    }
                } else if (showDate && !showFilePreview) {
                    // Just date, no preview
                    estimatedHeight += 20;
                }
            }
            
            // Add height for subfolder indicator if shown
            // This only shows when file is in a subfolder
            if (showSubfolderNamesInList && settings.showNotesFromSubfolders) {
                // We can't know if this specific file is in a subfolder without more context
                // So we add a conservative estimate
                estimatedHeight += 8; // Average across files (some have it, some don't)
            }
            
            // Note: Feature image doesn't add height (it's inline with flex)
            
            return Math.max(estimatedHeight, 32); // Minimum height for touch targets
        },
        overscan: isMobile ? 50 : 5, // Render more items on mobile to ensure selected item is rendered
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0,
        // Custom scroll function that preserves momentum on mobile
        scrollToFn: (offset, options, instance) => {
            if (isMobile && scrollStateRef.current.isScrolling && 
                Math.abs(scrollStateRef.current.scrollVelocity) > VELOCITY_THRESHOLD) {
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
        if (!scrollStateRef.current.isScrolling || (isMobile && uiState.currentMobileView !== 'files')) {
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
        if (selectionType === 'folder' && selectedFolder) {
            return `nn-scroll-${selectedFolder.path}`;
        } else if (selectionType === 'tag' && selectedTag) {
            return `nn-scroll-tag-${selectedTag}`;
        }
        return null;
    }, [selectionType, selectedFolder, selectedTag]);
    
    // Scroll to selected file when it changes - use useLayoutEffect to happen before paint
    useLayoutEffect(() => {
        if (selectedFilePath) {
            const fileIndex = filePathToIndex.get(selectedFilePath);
            if (fileIndex !== undefined && fileIndex !== -1) {
                // Check if there's a header immediately before this file
                // If so, scroll to the header instead to ensure it's visible
                let scrollToIndex = fileIndex;
                if (fileIndex > 0 && listItems[fileIndex - 1]?.type === 'header') {
                    scrollToIndex = fileIndex - 1;
                }
                
                // Get current scroll position before scrolling
                const scrollBefore = scrollContainerRef.current?.scrollTop || 0;
                
                
                // Scroll immediately to prevent flicker
                // Use center alignment on mobile for better visibility, auto on desktop
                rowVirtualizer.scrollToIndex(scrollToIndex, { 
                    align: isMobile ? 'center' : 'auto', 
                    behavior: 'auto' 
                });
                
            }
        }
    }, [selectedFilePath, filePathToIndex, rowVirtualizer, isMobile, listItems]);
    
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
            if (item.type === 'header') {
                currentGroup = item.data as string;
            } else if (item.type === 'file') {
                const file = item.data as TFile;
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
            }, MOMENTUM_DURATION);
        };
        
        const handleScroll = () => {
            const currentScrollTop = scrollContainer.scrollTop;
            const currentTime = performance.now();
            const timeDiff = currentTime - scrollStateRef.current.lastTimestamp;
            
            if (timeDiff > 0 && timeDiff < VELOCITY_CALC_MAX_DIFF) {
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
                        if (Math.abs(scrollStateRef.current.scrollVelocity) < VELOCITY_THRESHOLD) {
                            scrollStateRef.current.isScrolling = false;
                            scrollStateRef.current.scrollVelocity = 0;
                            scrollStateRef.current.scrollEndTimeoutId = 0;
                        }
                    }
                }, SCROLL_END_DELAY);
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
    }, [isMobile]);
    
    // Helper function for safe array access
    const safeGetItem = <T,>(array: T[], index: number): T | undefined => {
        return index >= 0 && index < array.length ? array[index] : undefined;
    };
    
    // Early returns MUST come after all hooks
    if (!selectedFolder && !selectedTag) {
        return (
            <div className="nn-right-pane">
                <PaneHeader type="file" onHeaderClick={handleScrollToTop} />
                <div className="nn-file-list nn-empty-state">
                    <div className="nn-empty-message">{strings.fileList.emptyStateNoSelection}</div>
                </div>
            </div>
        );
    }
    
    if (files.length === 0) {
        return (
            <div className="nn-right-pane">
                <PaneHeader type="file" onHeaderClick={handleScrollToTop} />
                <div className="nn-file-list nn-empty-state">
                    <div className="nn-empty-message">{strings.fileList.emptyStateNoNotes}</div>
                </div>
            </div>
        );
    }
    
    return (
        <ErrorBoundary componentName="FileList">
            <div className="nn-right-pane">
                <PaneHeader type="file" onHeaderClick={handleScrollToTop} />
            <div 
                ref={scrollContainerRef}
                className="nn-file-list"
                data-pane="files"
                role="list"
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
                            const isSelected = item.type === 'file' && 
                                selectedFilePath === (item.data as TFile).path;
                            
                            // Check if this is the last file item
                            const nextItem = safeGetItem(listItems, virtualItem.index + 1);
                            const isLastFile = item.type === 'file' && 
                                (virtualItem.index === listItems.length - 1 || 
                                 (nextItem && nextItem.type === 'header'));
                            
                            // Check if this is the first header
                            const isFirstHeader = item.type === 'header' && virtualItem.index === 0;
                            
                            // Check if next item is selected (for hiding separator)
                            const nextItemSelected = nextItem && 
                                nextItem.type === 'file' && 
                                selectedFilePath === (nextItem.data as TFile).path;
                            
                            // Find current date group for file items
                            let dateGroup: string | null = null;
                            if (item.type === 'file') {
                                // Look backwards to find the most recent header
                                for (let i = virtualItem.index - 1; i >= 0; i--) {
                                    const prevItem = safeGetItem(listItems, i);
                                    if (prevItem && prevItem.type === 'header') {
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
                                    className={`nn-virtual-item ${item.type === 'file' ? 'nn-virtual-file-item' : ''} ${isLastFile ? 'nn-last-file' : ''} ${isSelected ? 'nn-item-selected' : ''} ${nextItemSelected ? 'nn-before-selected' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    {item.type === 'header' ? (
                                        <div className={`nn-date-group-header ${isFirstHeader ? 'nn-first-header' : ''}`}>
                                            {item.data as string}
                                        </div>
                                    ) : item.type === 'spacer' ? (
                                        <div className="nn-file-list-spacer" style={{ height: '20px' }} />
                                    ) : (
                                        <FileItem
                                            key={(item.data as TFile).path}
                                            file={item.data as TFile}
                                            isSelected={isSelected}
                                            onClick={(e) => handleFileClick(item.data as TFile, e)}
                                            dateGroup={dateGroup}
                                            formattedDate={filesWithDates?.get((item.data as TFile).path)}
                                            parentFolder={item.parentFolder}
                                        />
                                    )}
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