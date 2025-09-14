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
import { TFile, TFolder, debounce } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { OperationType } from '../services/CommandQueueService';
import { useFileCache } from '../context/StorageContext';
import { ListPaneItemType, ItemType, NavigationItemType } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { TIMEOUTS } from '../types/obsidian-extended';
import { DateUtils } from '../utils/dateUtils';
import { getFilesForFolder, getFilesForTag, collectPinnedPaths } from '../utils/fileFinder';
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
     * Calculate the base list of files based on current selection without search filtering.
     * Re-runs when selection changes or vault is modified.
     */
    const baseFiles = useMemo(() => {
        let allFiles: TFile[] = [];

        if (selectionType === ItemType.FOLDER && selectedFolder) {
            allFiles = getFilesForFolder(selectedFolder, settings, app);
        } else if (selectionType === ItemType.TAG && selectedTag) {
            allFiles = getFilesForTag(selectedTag, settings, app, tagTreeService);
        }

        return allFiles;
        // NOTE: Excluding getFilesForFolder/getFilesForTag - static imports
        // updateKey triggers re-computation on storage updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectionType, selectedFolder, selectedTag, settings, app, tagTreeService, updateKey]);

    /**
     * Maintain a stateful map of lowercase display names by file path.
     * Rebuild on baseFiles changes; update entries on metadata changes for live name updates.
     */
    const [searchableNames, setSearchableNames] = useState<Map<string, string>>(new Map());

    // Rebuild the entire map when the baseFiles list or name provider changes
    useEffect(() => {
        const map = new Map<string, string>();
        for (const file of baseFiles) {
            const name = getFileDisplayName(file);
            map.set(file.path, name.toLowerCase());
        }
        setSearchableNames(map);
    }, [baseFiles, getFileDisplayName]);

    // Incrementally update names when frontmatter changes for files in the current list
    useEffect(() => {
        const basePaths = new Set(baseFiles.map(f => f.path));
        const offref = app.metadataCache.on('changed', changedFile => {
            if (!changedFile) return;
            const path = changedFile.path;
            if (!basePaths.has(path)) return;
            const lower = getFileDisplayName(changedFile).toLowerCase();
            setSearchableNames(prev => {
                const current = prev.get(path);
                if (current === lower) return prev;
                const next = new Map(prev);
                next.set(path, lower);
                return next;
            });
        });
        return () => {
            app.metadataCache.offref(offref);
        };
    }, [app.metadataCache, baseFiles, getFileDisplayName]);

    /**
     * Apply search filter to the base files using the precomputed name map.
     */
    const files = useMemo(() => {
        if (!searchQuery || !searchQuery.trim()) {
            return baseFiles;
        }

        const query = searchQuery.toLowerCase().trim();
        const searchSegments = query.split(/\s+/).filter(s => s.length > 0);
        const isMultiWordSearch = searchSegments.length > 1;

        const filtered = baseFiles.filter(file => {
            const name = searchableNames.get(file.path) || '';
            if (name.includes(query)) {
                return true;
            }
            if (isMultiWordSearch) {
                return searchSegments.every(segment => name.includes(segment));
            }
            return false;
        });

        return filtered;
    }, [baseFiles, searchQuery, searchableNames]);

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
        // Trailing debounce for vault-driven updates. Schedules a refresh and
        // extends the timer while more events arrive within FILE_OPERATION_DELAY.
        const scheduleRefresh = debounce(
            () => {
                setUpdateKey(k => k + 1);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );

        // Track ongoing batch operations (move/delete) and defer UI refreshes
        const operationActiveRef = { current: false } as { current: boolean };
        const pendingRefreshRef = { current: false } as { current: boolean };

        // Helper to flush pending updates when operations have settled
        const flushPendingWhenIdle = () => {
            if (!pendingRefreshRef.current) return;
            if (!operationActiveRef.current) {
                pendingRefreshRef.current = false;
                // Run any pending scheduled refresh immediately
                scheduleRefresh.run();
            }
        };

        // Subscribe to command queue operation changes (if available)
        let unsubscribeCQ: (() => void) | null = null;
        if (commandQueue) {
            unsubscribeCQ = commandQueue.onOperationChange((type, active) => {
                if (type === OperationType.MOVE_FILE || type === OperationType.DELETE_FILES) {
                    operationActiveRef.current = active;
                    if (!active) flushPendingWhenIdle();
                }
            });
        }

        const vaultEvents = [
            app.vault.on('create', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
            }),
            app.vault.on('delete', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
            }),
            app.vault.on('rename', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
            })
        ];
        const metadataEvent = app.metadataCache.on('changed', file => {
            // Only update if the metadata change is for a file in our current view
            if (selectionType === ItemType.FOLDER && selectedFolder) {
                // Check if file is in the selected folder
                const fileFolder = file.parent;
                if (!fileFolder || fileFolder.path !== selectedFolder.path) {
                    // If not showing descendants, ignore files not in this folder
                    if (!settings.includeDescendantNotes) {
                        return;
                    }
                    // If showing descendants, check if it's a descendant
                    if (!fileFolder?.path.startsWith(`${selectedFolder.path}/`)) {
                        return;
                    }
                }
            } else if (selectionType === ItemType.TAG && selectedTag) {
                // For tag view, schedule a trailing refresh and extend if more changes arrive
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
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
                        scheduleRefresh();
                    }
                }
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
            dbUnsubscribe();
            if (unsubscribeCQ) unsubscribeCQ();
            // Cancel any pending scheduled refresh to avoid stray updates
            scheduleRefresh.cancel();
        };
    }, [app, selectionType, selectedTag, selectedFolder, settings.includeDescendantNotes, getDB, commandQueue]);

    return {
        listItems,
        orderedFiles,
        filePathToIndex,
        fileIndexMap,
        files
    };
}
