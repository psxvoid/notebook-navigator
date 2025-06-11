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
    
    // Cache for tag tree to avoid rebuilding on every render
    // Clear cache when component unmounts to prevent memory leak
    const tagTreeCacheRef = useRef<{
        tree: Map<string, TagTreeNode>;
        filesHash: string;
    } | null>(null);
    
    useEffect(() => {
        return () => {
            tagTreeCacheRef.current = null;
        };
    }, []);
    
    const handleFileClick = useCallback((file: TFile) => {
        dispatch({ type: 'SET_SELECTED_FILE', file });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        
        // Open file preview without stealing focus
        const leaf = app.workspace.getLeaf(false);
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
            const collectFiles = (folder: TFolder): TFile[] => {
            const files: TFile[] = [];
            
            for (const child of folder.children) {
                if (isTFile(child)) {
                    // Only include supported file types
                    if (child.extension === 'md' || child.extension === 'canvas' || child.extension === 'base' || child.extension === 'pdf') {
                        files.push(child);
                    }
                } else if (plugin.settings.showNotesFromSubfolders && isTFolder(child)) {
                    files.push(...collectFiles(child));
                }
            }
            
            return files;
        };
        
            allFiles = collectFiles(selectedFolder);
            
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
                // Create a simple hash to check if files have changed
                const filesHash = allMarkdownFiles.map(f => f.path).join('|');
                
                // Use cached tag tree if available and files haven't changed
                let tagTree: Map<string, TagTreeNode>;
                if (tagTreeCacheRef.current && tagTreeCacheRef.current.filesHash === filesHash) {
                    tagTree = tagTreeCacheRef.current.tree;
                } else {
                    // Build and cache the tag tree
                    tagTree = buildTagTree(allMarkdownFiles, app);
                    tagTreeCacheRef.current = { tree: tagTree, filesHash };
                }
                
                // Find the selected tag node
                const selectedNode = findTagNode(selectedTag, tagTree);
                
                if (selectedNode) {
                    // Collect all tags to include (selected tag and all children)
                    const tagsToInclude = collectAllTagPaths(selectedNode);
                    
                    // Filter files that have any of the collected tags
                    allFiles = allMarkdownFiles.filter(file => {
                        const cache = app.metadataCache.getFileCache(file);
                        const fileTags = cache ? getAllTags(cache) : null;
                        return fileTags && fileTags.some(tag => tagsToInclude.has(tag));
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
        sortFiles(allFiles, sortOption);
        
        // Handle pinned notes (only for folder selection)
        if (selectionType === 'folder' && selectedFolder) {
            let allPinnedPaths: string[] = [];
            
            if (plugin.settings.showNotesFromSubfolders) {
                // Collect pinned notes from the selected folder and all subfolders
                const collectPinnedPaths = (folder: TFolder): string[] => {
                    let paths: string[] = plugin.settings.pinnedNotes[folder.path] || [];
                    
                    // Recursively collect from subfolders
                    for (const child of folder.children) {
                        if (isTFolder(child)) {
                            paths = paths.concat(collectPinnedPaths(child));
                        }
                    }
                    
                    return paths;
                };
                
                allPinnedPaths = collectPinnedPaths(selectedFolder);
            } else {
                // Only get pinned notes from the selected folder
                allPinnedPaths = plugin.settings.pinnedNotes[selectedFolder.path] || [];
            }
            
            // Filter to only include pinned files that are in our allFiles list
            const pinnedFiles = allFiles.filter(file => allPinnedPaths.includes(file.path));
            const unpinnedFiles = allFiles.filter(file => !allPinnedPaths.includes(file.path));
            
            return [...pinnedFiles, ...unpinnedFiles];
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
    
    // Auto-select first file when folder/tag changes
    useLayoutEffect(() => {
        // Need either a folder or tag selected
        if (!selectedFolder && !selectedTag) return;
        
        // Check if the currently selected file is in the current file list
        const selectedFileInList = appState.selectedFile && files.some(f => f.path === appState.selectedFile.path);
        
        if (selectedFileInList) {
            // Keep the current selection if it's in the list (e.g., from REVEAL_FILE)
            return;
        }
        
        // Use the first file from the files array instead of DOM query
        if (files.length > 0) {
            const firstFile = files[0];
            dispatch({ type: 'SET_SELECTED_FILE', file: firstFile });
            
            // Don't automatically open files when just browsing folders
            // Files will be opened when user explicitly selects them
        } else {
            // Clear selection when folder has no files
            dispatch({ type: 'SET_SELECTED_FILE', file: null });
        }
    }, [selectedFolder?.path, selectedTag, selectionType, dispatch, files, appState.selectedFile]);
    
    // Group files by date if enabled
    const groupedFiles = useMemo(() => {
        // Files are already sorted and pinned files are at the beginning
        // Just need to identify where pinned section ends
        let pinnedCount = 0;
        
        if (selectionType === 'folder' && selectedFolder) {
            // Count pinned files at the beginning of the array
            const pinnedPaths = new Set<string>();
            
            if (plugin.settings.showNotesFromSubfolders) {
                // Collect pinned notes from the selected folder and all subfolders
                const collectPinnedPaths = (folder: TFolder): void => {
                    const paths = plugin.settings.pinnedNotes[folder.path] || [];
                    paths.forEach(p => pinnedPaths.add(p));
                    
                    // Recursively collect from subfolders
                    for (const child of folder.children) {
                        if (isTFolder(child)) {
                            collectPinnedPaths(child);
                        }
                    }
                };
                
                collectPinnedPaths(selectedFolder);
            } else {
                // Only get pinned notes from the selected folder
                const paths = plugin.settings.pinnedNotes[selectedFolder.path] || [];
                paths.forEach(p => pinnedPaths.add(p));
            }
            
            // Count how many files at the start are pinned
            for (const file of files) {
                if (pinnedPaths.has(file.path)) {
                    pinnedCount++;
                } else {
                    break; // Pinned files are at the beginning, so we can stop
                }
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
            const fileDate = new Date(file.stat[dateField]);
            const groupTitle = DateUtils.getDateGroup(fileDate.getTime());
            
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
    
    // Cache selected file path to avoid repeated property access
    const selectedFilePath = appState.selectedFile?.path;
    
    // Pre-calculate date field for all files in the group
    const dateField = useMemo(() => {
        return getDateField(getEffectiveSortOption(plugin.settings, selectionType, selectedFolder));
    }, [plugin.settings, selectionType, selectedFolder]);
    
    // Pre-compute formatted dates for all files to avoid doing it in render
    const filesWithDates = useMemo(() => {
        if (!plugin.settings.showDate) return null;
        
        const dateMap = new Map<string, string>();
        groupedFiles.forEach(group => {
            group.files.forEach(file => {
                const dateToShow = file.stat[dateField];
                const formatted = group.title 
                    ? DateUtils.formatDateForGroup(dateToShow, group.title, plugin.settings.dateFormat, plugin.settings.timeFormat)
                    : DateUtils.formatDate(dateToShow, plugin.settings.dateFormat);
                dateMap.set(file.path, formatted);
            });
        });
        return dateMap;
    }, [groupedFiles, dateField, plugin.settings.showDate, plugin.settings.dateFormat, plugin.settings.timeFormat]);
    
    // Early returns MUST come after all hooks
    if (!selectedFolder && !selectedTag) {
        return (
            <div className="nn-file-list nn-empty-state">
                <div className="nn-empty-message">{strings.fileList.emptyStateNoSelection}</div>
            </div>
        );
    }
    
    if (files.length === 0) {
        return (
            <div className="nn-file-list nn-empty-state">
                <div className="nn-empty-message">{strings.fileList.emptyStateNoNotes}</div>
            </div>
        );
    }
    
    return (
        <div className="nn-file-list">
            {groupedFiles.map((group) => (
                <div key={group.title || 'ungrouped'} className="nn-file-group">
                    {group.title && (
                        <div className="nn-date-group-header">{group.title}</div>
                    )}
                    {group.files.map((file) => (
                        <FileItem
                            key={file.path}
                            file={file}
                            isSelected={selectedFilePath === file.path}
                            onClick={handleFileClick.bind(null, file)}
                            dateGroup={group.title}
                            settingsVersion={refreshCounter}
                            formattedDate={filesWithDates?.get(file.path)}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}