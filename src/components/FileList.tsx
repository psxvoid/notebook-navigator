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

import React, { useMemo, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import { TFile, TFolder, TAbstractFile, getAllTags } from 'obsidian';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppContext } from '../context/AppContext';
import { FileItem } from './FileItem';
import { DateUtils } from '../utils/DateUtils';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { getFileFromElement } from '../utils/domUtils';
import { buildTagTree, findTagNode, collectAllTagPaths, TagTreeNode } from '../utils/tagUtils';
import { getEffectiveSortOption, sortFiles, getDateField } from '../utils/sortUtils';
import { UNTAGGED_TAG_ID } from '../types';
import { strings } from '../i18n';
import type { FileListItem } from '../types/virtualization';
import { PaneHeader } from './PaneHeader';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { scrollVirtualItemIntoView } from '../utils/virtualUtils';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Collects all pinned note paths from settings
 * @param pinnedNotes - The pinned notes settings object
 * @param folder - Optional folder to limit collection to (with subfolders if enabled)
 * @param includeSubfolders - Whether to include pinned notes from subfolders
 * @returns A Set of pinned file paths for O(1) lookup performance
 */
function collectPinnedPaths(
    pinnedNotes: Record<string, string[]>, 
    folder?: TFolder, 
    includeSubfolders = false
): Set<string> {
    const allPinnedPaths = new Set<string>();
    
    if (folder) {
        // Collect from specific folder and optionally its subfolders
        const collectFromFolder = (f: TFolder): void => {
            const paths = pinnedNotes[f.path] || [];
            paths.forEach(p => allPinnedPaths.add(p));
            
            if (includeSubfolders) {
                for (const child of f.children) {
                    if (isTFolder(child)) {
                        collectFromFolder(child);
                    }
                }
            }
        };
        
        collectFromFolder(folder);
    } else {
        // Collect from all folders
        for (const folderPath in pinnedNotes) {
            const pinnedInFolder = pinnedNotes[folderPath];
            if (pinnedInFolder && pinnedInFolder.length > 0) {
                pinnedInFolder.forEach(path => allPinnedPaths.add(path));
            }
        }
    }
    
    return allPinnedPaths;
}

/**
 * Separates files into pinned and unpinned arrays based on pinned paths
 * @param files - All files to separate
 * @param pinnedPaths - Set of pinned file paths
 * @returns Concatenated array with pinned files first, then unpinned files
 */
function separatePinnedFiles(files: TFile[], pinnedPaths: Set<string>): TFile[] {
    if (pinnedPaths.size === 0) {
        return files;
    }
    
    const pinnedFiles: TFile[] = [];
    const unpinnedFiles: TFile[] = [];
    
    for (const file of files) {
        if (pinnedPaths.has(file.path)) {
            pinnedFiles.push(file);
        } else {
            unpinnedFiles.push(file);
        }
    }
    
    return [...pinnedFiles, ...unpinnedFiles];
}

/**
 * Collects files from a folder and optionally its subfolders
 * @param folder - The folder to collect files from
 * @param includeSubfolders - Whether to include files from subfolders
 * @returns Array of files
 */
function collectFilesFromFolder(folder: TFolder, includeSubfolders: boolean): TFile[] {
    const files: TFile[] = [];
    
    const collectFiles = (f: TFolder): void => {
        for (const child of f.children) {
            if (isTFile(child)) {
                // Only include supported file types
                if (child.extension === 'md' || child.extension === 'canvas' || 
                    child.extension === 'base' || child.extension === 'pdf') {
                    files.push(child);
                }
            } else if (includeSubfolders && isTFolder(child)) {
                collectFiles(child);
            }
        }
    };
    
    collectFiles(folder);
    return files;
}

/**
 * Renders the file list pane displaying files from the selected folder.
 * Handles file sorting, grouping by date, pinned notes, and auto-selection.
 * Integrates with the app context to manage file selection and navigation.
 * 
 * @returns A scrollable list of files grouped by date (if enabled) with empty state handling
 */
export function FileList() {
    const { app, appState, dispatch, plugin, refreshCounter, isMobile } = useAppContext();
    const { selectionType, selectedFolder, selectedTag } = appState;
    
    // Track if the file selection is from user click vs auto-selection
    const isUserSelectionRef = useRef(false);
    
    const handleFileClick = useCallback((file: TFile, e: React.MouseEvent) => {
        isUserSelectionRef.current = true;  // Mark this as a user selection
        dispatch({ type: 'SET_SELECTED_FILE', file });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        
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
            app.workspace.leftSplit.collapse();
        }
    }, [app.workspace, dispatch, isMobile]);
    
    // Get files from selected folder or tag
    const files = useMemo(() => {
        let allFiles: TFile[] = [];
        const excludedProperties = parseExcludedProperties(plugin.settings.excludedFiles);

        if (selectionType === 'folder' && selectedFolder) {
            allFiles = collectFilesFromFolder(selectedFolder, plugin.settings.showNotesFromSubfolders);
            
        } else if (selectionType === 'tag' && selectedTag) {
            // Get all markdown files that aren't excluded
            const allMarkdownFiles = app.vault.getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            
            // Special case for untagged files
            if (selectedTag === UNTAGGED_TAG_ID) {
                allFiles = allMarkdownFiles.filter(file => {
                    const cache = app.metadataCache.getFileCache(file);
                    const fileTags = cache ? getAllTags(cache) : null;
                    return !fileTags || fileTags.length === 0;
                });
            } else {
                // Build the tag tree (memoization happens at the component level)
                const tagTree = buildTagTree(allMarkdownFiles, app);
                
                // Find the selected tag node
                const selectedNode = findTagNode(selectedTag, tagTree);
                
                if (selectedNode) {
                    // Collect all tags to include (selected tag and all children)
                    const tagsToInclude = collectAllTagPaths(selectedNode);
                    
                    // Create a lowercase set for case-insensitive comparison
                    const tagsToIncludeLower = new Set(
                        Array.from(tagsToInclude).map(tag => tag.toLowerCase())
                    );
                    
                    // Filter files that have any of the collected tags (case-insensitive)
                    allFiles = allMarkdownFiles.filter(file => {
                        const cache = app.metadataCache.getFileCache(file);
                        const fileTags = cache ? getAllTags(cache) : null;
                        return fileTags && fileTags.some(tag => tagsToIncludeLower.has(tag.toLowerCase()));
                    });
                } else {
                    // Fallback to empty if tag not found
                    allFiles = [];
                }
            }
        }
        
        // Filter out excluded files based on frontmatter properties
        if (excludedProperties.length > 0) {
            allFiles = allFiles.filter(file => !shouldExcludeFile(file, excludedProperties, app));
        }
        
        // Determine which sort option to use and apply it
        const sortOption = getEffectiveSortOption(plugin.settings, selectionType, selectedFolder);
        sortFiles(allFiles, sortOption, plugin.settings, app.metadataCache);
        
        // Handle pinned notes
        if (selectionType === 'folder' && selectedFolder) {
            // Folder view: collect pinned notes from the selected folder (and subfolders if enabled)
            const pinnedPaths = collectPinnedPaths(
                plugin.settings.pinnedNotes, 
                selectedFolder, 
                plugin.settings.showNotesFromSubfolders
            );
            return separatePinnedFiles(allFiles, pinnedPaths);
        } else if (selectionType === 'tag') {
            // Tag view: collect ALL pinned notes from all folders
            const pinnedPaths = collectPinnedPaths(plugin.settings.pinnedNotes);
            return separatePinnedFiles(allFiles, pinnedPaths);
        }
        
        return allFiles;
    }, [
        selectionType,
        selectedFolder,
        selectedTag,
        plugin.settings.defaultFolderSort,
        plugin.settings.folderSortOverrides,
        plugin.settings.showNotesFromSubfolders,
        plugin.settings.pinnedNotes,
        plugin.settings.excludedFiles,
        app, 
        refreshCounter
    ]);
    
    // Auto-open file when it's selected via folder/tag change (not user click)
    useEffect(() => {
        if (appState.selectedFile && !isUserSelectionRef.current && plugin.settings.autoSelectFirstFile && !isMobile) {
            // This is an auto-selection from folder/tag change
            const leaf = app.workspace.getLeaf(false);
            if (leaf) {
                leaf.openFile(appState.selectedFile, { active: false });
            }
        }
        // Reset the flag after processing
        isUserSelectionRef.current = false;
    }, [appState.selectedFile, app.workspace, plugin.settings.autoSelectFirstFile, isMobile]);
    
    // Auto-select first file when files pane gains focus and no file is selected
    useEffect(() => {
        if (appState.focusedPane === 'files' && !appState.selectedFile && files.length > 0) {
            const firstFile = files[0];
            // Select the first file when focus switches to files pane
            dispatch({ type: 'SET_SELECTED_FILE', file: firstFile });
            
            // Open the file in the editor but keep focus in file list
            const leaf = app.workspace.getLeaf(false);
            if (leaf) {
                leaf.openFile(firstFile, { active: false });
            }
        }
    }, [appState.focusedPane, appState.selectedFile, files, dispatch, app.workspace]);
    
    // Create flattened list items for virtualization
    const listItems = useMemo((): FileListItem[] => {
        const items: FileListItem[] = [];
        
        // Get the appropriate pinned paths based on selection type
        let pinnedPaths: Set<string>;
        
        if (selectionType === 'folder' && selectedFolder) {
            pinnedPaths = collectPinnedPaths(
                plugin.settings.pinnedNotes,
                selectedFolder,
                plugin.settings.showNotesFromSubfolders
            );
        } else if (selectionType === 'tag') {
            pinnedPaths = collectPinnedPaths(plugin.settings.pinnedNotes);
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
        const sortOption = getEffectiveSortOption(plugin.settings, selectionType, selectedFolder);
        
        // Add unpinned files with date grouping if enabled
        if (!plugin.settings.groupByDate || sortOption.startsWith('title')) {
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
                    plugin.settings,
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
        
        return items;
    }, [
        files, 
        plugin.settings.groupByDate,
        plugin.settings.defaultFolderSort,
        plugin.settings.folderSortOverrides,
        plugin.settings.pinnedNotes,
        plugin.settings.showNotesFromSubfolders,
        selectionType,
        selectedFolder,
        strings.fileList.pinnedSection,
        app.metadataCache
    ]);
    
    // Add ref for scroll container
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    /**
     * Mobile scroll momentum preservation system
     * 
     * Problem: On mobile, when items are added to the top of a virtualized list during 
     * momentum scrolling (inertia scrolling), the browser stops the scroll abruptly.
     * 
     * Solution: We track scroll state, velocity, and item count changes. When new items
     * are added during scrolling, we calculate their height and adjust the scroll position
     * to maintain visual continuity without interrupting the momentum.
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
                return 35; // Keep this for date headers
            }

            // Base height for padding and margins
            let estimatedHeight = 12; // Vertical padding/margin
            
            // Add height for file name (can be multi-line)
            const fileNameLines = plugin.settings.fileNameRows || 1;
            estimatedHeight += (18 * fileNameLines); // ~18px per line of text
            
            // Add height for the feature image if shown
            if (plugin.settings.showFeatureImage) {
                estimatedHeight += 20; // Approximate additional height for image
            }

            // Add height for the file preview if shown
            if (plugin.settings.showFilePreview) {
                // Add space for each potential line of the preview
                estimatedHeight += (16 * plugin.settings.previewRows);
            }
            
            // Add height for subfolder indicator if shown
            if (plugin.settings.showSubfolderNamesInList) {
                estimatedHeight += 16; // Additional line for subfolder name
            }
            
            return estimatedHeight;
        },
        overscan: 5, // Render 5 items above/below viewport
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
        if (!scrollStateRef.current.isScrolling || (isMobile && appState.currentMobileView !== 'files')) {
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
                    if (scrollContainer && scrollStateRef.current.isScrolling) {
                        scrollContainer.scrollTop = currentScrollTop + heightAdjustment;
                    }
                });
            }
        }
        
        prevItemCountRef.current = currentCount;
    }, [listItems.length, isMobile, rowVirtualizer]);
    
    // Cache selected file path to avoid repeated property access
    const selectedFilePath = appState.selectedFile?.path;
    
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
    
    // Use IntersectionObserver to scroll to selected file when pane becomes visible on mobile
    useEffect(() => {
        if (!isMobile || !scrollContainerRef.current || !rowVirtualizer) return;

        const scrollContainer = scrollContainerRef.current;

        const observerCallback = (entries: IntersectionObserverEntry[]) => {
            const [entry] = entries;
            if (!entry.isIntersecting) return;

            if (selectedFilePath) {
                const fileIndex = filePathToIndex.get(selectedFilePath);
                if (fileIndex !== undefined && fileIndex >= 0) {
                    scrollVirtualItemIntoView(rowVirtualizer, fileIndex, 'auto');
                }
            }
        };

        const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 });
        observer.observe(scrollContainer);

        return () => {
            observer.disconnect();
        };
    }, [isMobile, rowVirtualizer, filePathToIndex, selectedFilePath]);
    
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
                scrollStateRef.current.isScrolling = false;
                scrollStateRef.current.scrollVelocity = 0;
                scrollStateRef.current.scrollEndTimeoutId = 0;
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
                    // Only stop if velocity is low
                    if (Math.abs(scrollStateRef.current.scrollVelocity) < VELOCITY_THRESHOLD) {
                        scrollStateRef.current.isScrolling = false;
                        scrollStateRef.current.scrollVelocity = 0;
                        scrollStateRef.current.scrollEndTimeoutId = 0;
                    }
                }, SCROLL_END_DELAY);
            });
        };
        
        scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            scrollContainer.removeEventListener('touchstart', handleTouchStart);
            scrollContainer.removeEventListener('touchend', handleTouchEnd);
            scrollContainer.removeEventListener('scroll', handleScroll);
            if (scrollStateRef.current.animationFrameId) {
                cancelAnimationFrame(scrollStateRef.current.animationFrameId);
            }
            if (scrollStateRef.current.scrollEndTimeoutId) {
                clearTimeout(scrollStateRef.current.scrollEndTimeoutId);
            }
        };
    }, [isMobile, VELOCITY_THRESHOLD, SCROLL_END_DELAY, MOMENTUM_DURATION, VELOCITY_CALC_MAX_DIFF]);
    
    // Handle programmatic scrolling
    useEffect(() => {
        if (appState.scrollToFileIndex !== null && scrollContainerRef.current && rowVirtualizer) {
            const cleanup = scrollVirtualItemIntoView(rowVirtualizer, appState.scrollToFileIndex);
            // Clear the scroll request
            dispatch({ type: 'SCROLL_TO_FILE_INDEX', index: null });
            return cleanup;
        }
    }, [appState.scrollToFileIndex, rowVirtualizer, dispatch]);
    
    // Scroll to selected file when it changes
    useEffect(() => {
        if (selectedFilePath && scrollContainerRef.current && rowVirtualizer) {
            const fileIndex = filePathToIndex.get(selectedFilePath);
            
            if (fileIndex !== undefined && fileIndex >= 0) {
                // Only scroll to header when it's the first file (auto-selection)
                // Don't do it during normal navigation to avoid jumping
                const firstItem = listItems[0];
                const isFirstFile = fileIndex === 0 || (fileIndex === 1 && firstItem && firstItem.type === 'header');
                const isFirstInGroup = isFirstFile && fileIndex > 0 && listItems[fileIndex - 1]?.type === 'header';
                
                const cleanup = scrollVirtualItemIntoView(
                    rowVirtualizer, 
                    fileIndex,
                    'auto',
                    3,
                    isFirstInGroup
                );
                return cleanup;
            }
        }
    }, [selectedFilePath, filePathToIndex, rowVirtualizer, listItems]);
    
    // Add keyboard navigation
    useVirtualKeyboardNavigation({
        items: listItems,
        virtualizer: rowVirtualizer,
        focusedPane: 'files',
        containerRef: scrollContainerRef
    });
    
    // Pre-calculate date field for all files in the group
    const dateField = useMemo(() => {
        return getDateField(plugin.settings.defaultFolderSort);
    }, [plugin.settings.defaultFolderSort]);
    
    // Pre-compute formatted dates for all files to avoid doing it in render
    const filesWithDates = useMemo(() => {
        if (!plugin.settings.showDate) return null;
        
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
                    plugin.settings,
                    app.metadataCache
                );
                const formatted = currentGroup && currentGroup !== strings.fileList.pinnedSection
                    ? DateUtils.formatDateForGroup(timestamp, currentGroup, plugin.settings.dateFormat, plugin.settings.timeFormat)
                    : DateUtils.formatDate(timestamp, plugin.settings.dateFormat);
                dateMap.set(file.path, formatted);
            }
        });
        return dateMap;
    }, [listItems, dateField, plugin.settings.showDate, plugin.settings.dateFormat, plugin.settings.timeFormat, plugin.settings.useFrontmatterDates, plugin.settings.frontmatterCreatedField, plugin.settings.frontmatterModifiedField, plugin.settings.frontmatterDateFormat, strings.fileList.pinnedSection, app.metadataCache, refreshCounter]);
    
    // Helper function for safe array access
    const safeGetItem = <T,>(array: T[], index: number): T | undefined => {
        return index >= 0 && index < array.length ? array[index] : undefined;
    };
    
    // Early returns MUST come after all hooks
    if (!selectedFolder && !selectedTag) {
        return (
            <div className="nn-right-pane">
                <PaneHeader type="file" />
                <div className="nn-file-list nn-empty-state">
                    <div className="nn-empty-message">{strings.fileList.emptyStateNoSelection}</div>
                </div>
            </div>
        );
    }
    
    if (files.length === 0) {
        return (
            <div className="nn-right-pane">
                <PaneHeader type="file" />
                <div className="nn-file-list nn-empty-state">
                    <div className="nn-empty-message">{strings.fileList.emptyStateNoNotes}</div>
                </div>
            </div>
        );
    }
    
    return (
        <ErrorBoundary componentName="FileList">
            <div className="nn-right-pane">
                <PaneHeader type="file" />
            <div 
                ref={scrollContainerRef}
                className="nn-file-list"
                data-pane="files"
                role="list"
                aria-label="File list"
            >
                {/* Virtual list */}
                {listItems.length > 0 && (
                    <div
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
                                    ) : (
                                        <FileItem
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
}