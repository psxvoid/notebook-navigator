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
    
    // Track previous folder/tag selection to detect changes
    const previousSelectionRef = useRef<{
        folderPath: string | null;
        tag: string | null;
    }>({
        folderPath: selectedFolder?.path || null,
        tag: selectedTag
    });
    
    const handleFileClick = useCallback((file: TFile, e: React.MouseEvent) => {
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
    
    // Auto-select first file when folder/tag changes (desktop only)
    useEffect(() => {
        // Need either a folder or tag selected
        if (!selectedFolder && !selectedTag) return;
        
        // Check if folder/tag has changed
        const currentFolderPath = selectedFolder?.path || null;
        const hasSelectionChanged = 
            previousSelectionRef.current.folderPath !== currentFolderPath ||
            previousSelectionRef.current.tag !== selectedTag;
        
        // Update the ref
        previousSelectionRef.current = {
            folderPath: currentFolderPath,
            tag: selectedTag
        };
        
        // On mobile, don't auto-select files when changing folders/tags
        if (isMobile && hasSelectionChanged) {
            // Keep the current file selection on mobile
            return;
        }
        
        // If the selection hasn't changed, check if we should keep the current file
        if (!hasSelectionChanged) {
            // Check if the currently selected file is in the current file list
            const selectedFileInList = appState.selectedFile && files.some(f => f.path === appState.selectedFile?.path);
            
            if (selectedFileInList) {
                // Keep the current selection if it's in the list (e.g., from REVEAL_FILE)
                return;
            }
            
            // Check if a file was recently created (within last 2 seconds)
            // This prevents auto-selection from interfering with newly created files
            const activeFile = app.workspace.getActiveFile();
            if (activeFile && activeFile.stat?.ctime) {
                const fileAge = Date.now() - activeFile.stat.ctime;
                if (fileAge >= 0 && fileAge < 2000) {
                    return;
                }
            }
        }
        
        // Use a small delay to avoid race conditions with file list updates
        const timeoutId = setTimeout(() => {
            // Selection has changed or current file is not in list - select first file (desktop only)
            if (files.length > 0 && plugin.settings.autoSelectFirstFile) {
                const firstFile = files[0];
                
                // Select and open the file
                dispatch({ type: 'SET_SELECTED_FILE', file: firstFile });
                
                // Auto-open the first file when switching folders
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    leaf.openFile(firstFile, { active: false });
                }
            } else if (!plugin.settings.autoSelectFirstFile || files.length === 0) {
                // Clear selection when auto-select is disabled or folder has no files
                dispatch({ type: 'SET_SELECTED_FILE', file: null });
            }
        }, 0);
        
        return () => clearTimeout(timeoutId);
    }, [selectedFolder?.path, selectedTag, selectionType, dispatch, files, appState.selectedFile, app.workspace, isMobile, plugin.settings.autoSelectFirstFile]);
    
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
                key: 'header-pinned'
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
                        key: `header-${groupTitle}`
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
    
    // Group files by date if enabled (kept for date formatting)
    const groupedFiles = useMemo(() => {
        // Files are already sorted and pinned files are at the beginning
        // Just need to identify where pinned section ends
        let pinnedCount = 0;
        
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
        
        // Count how many files at the start are pinned
        for (const file of files) {
            if (pinnedPaths.has(file.path)) {
                pinnedCount++;
            } else {
                break; // Pinned files are at the beginning, so we can stop
            }
        }
        
        const pinnedFiles = pinnedCount > 0 ? files.slice(0, pinnedCount) : [];
        const unpinnedFiles = files.slice(pinnedCount);

        const groups: { title: string | null; files: TFile[] }[] = [];

        // Add Pinned group if it exists
        if (pinnedFiles.length > 0) {
            groups.push({ title: strings.fileList.pinnedSection, files: pinnedFiles });
        }

        // Determine which sort option to use
        const sortOption = getEffectiveSortOption(plugin.settings, selectionType, selectedFolder);
        
        // Group remaining files
        if (!plugin.settings.groupByDate || sortOption.startsWith('title')) {
            if (unpinnedFiles.length > 0) {
                groups.push({ title: null, files: unpinnedFiles });
            }
            return groups;
        }
        
        const dateGroups = new Map<string, TFile[]>();
        unpinnedFiles.forEach(file => {
            const dateField = getDateField(sortOption);
            const timestamp = DateUtils.getFileTimestamp(
                file, 
                dateField === 'ctime' ? 'created' : 'modified',
                plugin.settings,
                app.metadataCache
            );
            const groupTitle = DateUtils.getDateGroup(timestamp);
            
            if (!dateGroups.has(groupTitle)) {
                dateGroups.set(groupTitle, []);
            }
            dateGroups.get(groupTitle)!.push(file);
        });
        
        // Add date groups to the main groups array
        dateGroups.forEach((filesInGroup, title) => {
            groups.push({ title, files: filesInGroup });
        });

        return groups;
    }, [
        files, 
        plugin.settings.groupByDate,
        plugin.settings.defaultFolderSort,
        plugin.settings.folderSortOverrides,
        plugin.settings.pinnedNotes,
        plugin.settings.showNotesFromSubfolders,
        selectionType,
        selectedFolder
    ]);
    
    // Add ref for scroll container
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
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
    });
    
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
                const cleanup = scrollVirtualItemIntoView(rowVirtualizer, fileIndex);
                return cleanup;
            }
        }
    }, [selectedFilePath, filePathToIndex, rowVirtualizer]);
    
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
    }, [listItems, dateField, plugin.settings.showDate, plugin.settings.dateFormat, plugin.settings.timeFormat, plugin.settings.useFrontmatterDates, plugin.settings.frontmatterCreatedField, plugin.settings.frontmatterModifiedField, plugin.settings.frontmatterDateFormat, strings.fileList.pinnedSection, app.metadataCache]);
    
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
                            const item = listItems[virtualItem.index];
                            const isSelected = item.type === 'file' && 
                                selectedFilePath === (item.data as TFile).path;
                            
                            // Find current date group for file items
                            let dateGroup: string | null = null;
                            if (item.type === 'file') {
                                // Look backwards to find the most recent header
                                for (let i = virtualItem.index - 1; i >= 0; i--) {
                                    if (listItems[i].type === 'header') {
                                        dateGroup = listItems[i].data as string;
                                        break;
                                    }
                                }
                            }
                            
                            return (
                                <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    ref={rowVirtualizer.measureElement}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    {item.type === 'header' ? (
                                        <div className="nn-date-group-header">
                                            {item.data as string}
                                        </div>
                                    ) : (
                                        <FileItem
                                            file={item.data as TFile}
                                            isSelected={isSelected}
                                            onClick={(e) => handleFileClick(item.data as TFile, e)}
                                            dateGroup={dateGroup}
                                            settingsVersion={refreshCounter}
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
    );
}