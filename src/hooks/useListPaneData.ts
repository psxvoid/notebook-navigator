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
 * useListPaneData - Manages file list data for the ListPane component
 *
 * This hook handles:
 * - File collection from folders and tags
 * - Sorting and grouping files by date
 * - Separating pinned and unpinned files
 * - Building list items with headers and spacers
 * - Listening to vault changes and updating the file list
 * - Creating efficient lookup maps for file access
 */

import { useMemo, useState, useEffect } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { OperationType } from '../services/CommandQueueService';
import { useFileCache } from '../context/StorageContext';
import { ListPaneItemType, ItemType, NavigationItemType } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { TIMEOUTS } from '../types/obsidian-extended';
import { DateUtils } from '../utils/dateUtils';
import { getFilesForFolder, getFilesForTag, collectPinnedPaths } from '../utils/fileFinder';
import { leadingEdgeDebounce } from '../utils/leadingEdgeDebounce';
import { getDateField, getEffectiveSortOption } from '../utils/sortUtils';
import { strings } from '../i18n';
import type { NotebookNavigatorSettings } from '../settings';

/**
 * Parameters for the useListPaneData hook
 */
interface UseListPaneDataParams {
    /** The type of selection (folder or tag) */
    selectionType: ItemType | null;
    /** The currently selected folder, if any */
    selectedFolder: TFolder | null;
    /** The currently selected tag, if any */
    selectedTag: string | null;
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Optional search query to filter files */
    searchQuery?: string;
}

/**
 * Return value of the useListPaneData hook
 */
interface UseListPaneDataResult {
    /** List items including headers, files, and spacers for rendering */
    listItems: ListPaneItem[];
    /** Ordered array of files (without headers) for multi-selection */
    orderedFiles: TFile[];
    /** Map from file path to list item index for O(1) lookups */
    filePathToIndex: Map<string, number>;
    /** Map from file path to position in files array for multi-selection */
    fileIndexMap: Map<string, number>;
    /** Raw array of files before grouping */
    files: TFile[];
}

/**
 * Hook that manages file list data for the ListPane component.
 * Handles file collection, sorting, grouping, and vault change monitoring.
 *
 * @param params - Configuration parameters
 * @returns File list data and lookup maps
 */
export function useListPaneData({
    selectionType,
    selectedFolder,
    selectedTag,
    settings,
    searchQuery
}: UseListPaneDataParams): UseListPaneDataResult {
    const { app, tagTreeService, commandQueue } = useServices();
    const { getFileCreatedTime, getFileModifiedTime, getDB, getFileDisplayName } = useFileCache();

    // State to force updates when vault changes (incremented on create/delete/rename)
    const [updateKey, setUpdateKey] = useState(0);

    /**
     * Calculate the list of files based on current selection.
     * Re-runs when selection changes or vault is modified.
     */
    const files = useMemo(() => {
        let allFiles: TFile[] = [];

        if (selectionType === ItemType.FOLDER && selectedFolder) {
            allFiles = getFilesForFolder(selectedFolder, settings, app);
        } else if (selectionType === ItemType.TAG && selectedTag) {
            allFiles = getFilesForTag(selectedTag, settings, app, tagTreeService);
        }

        // Apply search filter if query is provided
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();

            // Split query into segments for multi-word search
            const searchSegments = query.split(/\s+/).filter(s => s.length > 0);
            const isMultiWordSearch = searchSegments.length > 1;

            allFiles = allFiles.filter(file => {
                // Use display name for matching so search aligns with UI (frontmatter-aware)
                const name = getFileDisplayName(file).toLowerCase();

                // Exact substring match (e.g., "test" matches "testing.md")
                if (name.includes(query)) {
                    return true;
                }

                // Multi-word search: all segments must be present
                // (e.g., "inst mac" matches "Installation Macbook.md")
                if (isMultiWordSearch) {
                    const allSegmentsPresent = searchSegments.every(segment => name.includes(segment));
                    return allSegmentsPresent;
                }

                return false;
            });
        }

        return allFiles;
        // NOTE TO REVIEWER: Excluding **getFilesForFolder**/**getFilesForTag** - static imports
        // **updateKey** triggers re-computation on storage updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectionType, selectedFolder, selectedTag, settings, app, tagTreeService, updateKey, searchQuery]);

    /**
     * Build the complete list of items for rendering, including:
     * - Pinned section header and pinned files
     * - Date group headers (if grouping is enabled)
     * - Regular files
     * - Bottom spacer for scroll padding
     */
    const listItems = useMemo(() => {
        const items: ListPaneItem[] = [];

        // Add top spacer at the beginning
        items.push({
            type: ListPaneItemType.TOP_SPACER,
            data: '',
            key: 'top-spacer'
        });

        // Determine context filter based on selection type
        // selectionType can be FOLDER, TAG, FILE, or null - we only use FOLDER and TAG for pinned context
        const contextFilter =
            selectionType === ItemType.TAG ? ItemType.TAG : selectionType === ItemType.FOLDER ? ItemType.FOLDER : undefined;
        const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, contextFilter);

        // Separate pinned and unpinned files
        const pinnedFiles = files.filter(f => pinnedPaths.has(f.path));
        const unpinnedFiles = files.filter(f => !pinnedPaths.has(f.path));

        // Determine which sort option to use
        const sortOption = getEffectiveSortOption(settings, selectionType as NavigationItemType, selectedFolder, selectedTag);

        // Files are already sorted in fileFinder; preserve order here

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
                items.push({
                    type: ListPaneItemType.FILE,
                    data: file,
                    parentFolder: selectedFolder?.path,
                    key: file.path,
                    fileIndex: fileIndexCounter++,
                    isPinned: true
                });
            });
        }

        // Add unpinned files with date grouping if enabled
        if (!settings.groupByDate || sortOption.startsWith('title')) {
            // No date grouping
            unpinnedFiles.forEach(file => {
                items.push({
                    type: ListPaneItemType.FILE,
                    data: file,
                    parentFolder: selectedFolder?.path,
                    key: file.path,
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

                items.push({
                    type: ListPaneItemType.FILE,
                    data: file,
                    parentFolder: selectedFolder?.path,
                    key: file.path,
                    fileIndex: fileIndexCounter++
                });
            });
        }

        // Add spacer at the end so jumping to last position works properly with the virtualizer\n        // Without this, scrolling to the last item may not position it correctly
        items.push({
            type: ListPaneItemType.BOTTOM_SPACER,
            data: '',
            key: 'bottom-spacer'
        });

        return items;
    }, [files, settings, selectionType, selectedFolder, selectedTag, getFileCreatedTime, getFileModifiedTime]);

    /**
     * Create a map from file paths to their index in listItems.
     * Used for efficient file lookups during scrolling and selection.
     */
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

    /**
     * Create a map from file paths to their position in the files array.
     * Used for multi-selection operations that need file ordering.
     */
    const fileIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        files.forEach((file, index) => {
            map.set(file.path, index);
        });
        return map;
    }, [files]);

    /**
     * Build an ordered array of files (excluding headers and spacers).
     * Used for Shift+Click range selection functionality.
     */
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

    /**
     * Listen for vault changes and trigger list updates.
     * Handles file creation, deletion, rename, and metadata changes.
     * Uses leading edge debounce for immediate UI feedback.
     */
    useEffect(() => {
        // Use leading edge debounce for immediate UI updates
        const forceUpdate = leadingEdgeDebounce(() => {
            // Force re-render by incrementing update key
            setUpdateKey(k => k + 1);
        }, TIMEOUTS.DEBOUNCE_CONTENT);

        // Track ongoing batch operations (move/delete) and defer UI refreshes
        const operationActiveRef = { current: false } as { current: boolean };
        const pendingRefreshRef = { current: false } as { current: boolean };

        // Helper to flush pending updates when operations have settled
        const flushPendingWhenIdle = () => {
            if (!pendingRefreshRef.current) return;
            const attempt = () => {
                if (operationActiveRef.current) {
                    window.setTimeout(attempt, TIMEOUTS.FILE_OPERATION_DELAY);
                } else {
                    pendingRefreshRef.current = false;
                    forceUpdate();
                }
            };
            window.setTimeout(attempt, TIMEOUTS.FILE_OPERATION_DELAY);
        };

        // Subscribe to command queue operation changes (if available)
        let unsubscribeCQ: (() => void) | null = null;
        if (commandQueue) {
            unsubscribeCQ = commandQueue.onOperationChange((type, active) => {
                if (type === OperationType.MOVE_FILE || type === OperationType.DELETE_FILES) {
                    operationActiveRef.current = active;
                    if (!active) {
                        flushPendingWhenIdle();
                    }
                }
            });
        }

        const vaultEvents = [
            app.vault.on('create', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    forceUpdate();
                }
            }),
            app.vault.on('delete', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    forceUpdate();
                }
            }),
            app.vault.on('rename', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    forceUpdate();
                }
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
                    if (!fileFolder?.path.startsWith(`${selectedFolder.path}/`)) {
                        return;
                    }
                }
            } else if (selectionType === ItemType.TAG && selectedTag) {
                // For tag view, we DO need to rebuild the list as files might be added/removed
                forceUpdate();
                return;
            }

            // When viewing a folder, we don't need to rebuild the entire file list for metadata changes
            // (only tag view needs rebuilding since files might be added/removed based on tag changes)
            // Individual FileItem components will update themselves through the database subscription
        });

        // Listen for tag changes from database
        const db = getDB();
        const dbUnsubscribe = db.onContentChange(changes => {
            // Check if we're in tag view and tags changed
            if (selectionType === ItemType.TAG && selectedTag) {
                const hasTagChanges = changes.some(change => change.changes.tags !== undefined);
                if (hasTagChanges) {
                    if (operationActiveRef.current) {
                        pendingRefreshRef.current = true;
                    } else {
                        forceUpdate();
                    }
                }
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
            dbUnsubscribe();
            if (unsubscribeCQ) unsubscribeCQ();
        };
    }, [app, selectionType, selectedTag, selectedFolder, settings.showNotesFromSubfolders, getDB, commandQueue]);

    return {
        listItems,
        orderedFiles,
        filePathToIndex,
        fileIndexMap,
        files
    };
}
