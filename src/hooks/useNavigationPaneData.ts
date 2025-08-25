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
 * useNavigationPaneData - Manages navigation tree data for the NavigationPane component
 *
 * This hook handles:
 * - Building folder tree from vault structure
 * - Building tag tree with virtual folders
 * - Combining and ordering navigation items
 * - Computing folder and tag counts
 * - Creating efficient lookup maps
 * - Listening to vault changes
 * - Managing tag contexts (favorites vs all tags)
 */

import { useMemo, useState, useEffect } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useExpansionState } from '../context/ExpansionContext';
import { useFileCache } from '../context/StorageContext';
import { strings } from '../i18n';
import { UNTAGGED_TAG_ID, NavigationPaneItemType, VirtualFolder } from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { TagTreeNode } from '../types/storage';
import type { CombinedNavigationItem } from '../types/virtualization';
import type { NotebookNavigatorSettings } from '../settings';
import { parseExcludedFolders, parseExcludedProperties, shouldExcludeFile, shouldExcludeFolder } from '../utils/fileFilters';
import { shouldDisplayFile } from '../utils/fileTypeUtils';
import { leadingEdgeDebounce } from '../utils/leadingEdgeDebounce';
import { getTotalNoteCount, excludeFromTagTree } from '../utils/tagTree';
import { flattenFolderTree, flattenTagTree } from '../utils/treeFlattener';

/**
 * Parameters for the useNavigationPaneData hook
 */
interface UseNavigationPaneDataParams {
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Whether the navigation pane is currently visible */
    isVisible: boolean;
}

/**
 * Return value of the useNavigationPaneData hook
 */
interface UseNavigationPaneDataResult {
    /** Combined list of navigation items (folders and tags) */
    items: CombinedNavigationItem[];
    /** Map from item path to index in items array */
    pathToIndex: Map<string, number>;
    /** Map from tag path to file count */
    tagCounts: Map<string, number>;
    /** Map from folder path to file count */
    folderCounts: Map<string, number>;
}

/**
 * Hook that manages navigation tree data for the NavigationPane component.
 * Handles folder and tag tree building, counts, and vault change monitoring.
 *
 * @param params - Configuration parameters
 * @returns Navigation items and lookup maps
 */
export function useNavigationPaneData({ settings, isVisible }: UseNavigationPaneDataParams): UseNavigationPaneDataResult {
    const { app } = useServices();
    const expansionState = useExpansionState();
    const { fileData } = useFileCache();

    // Stable folder data across re-renders
    const [rootFolders, setRootFolders] = useState<TFolder[]>([]);

    // Get tag data from context
    const favoriteTree = fileData.favoriteTree;
    const tagTree = fileData.tagTree;
    const untaggedCount = fileData.untagged;

    /**
     * Build folder items from vault structure
     */
    const folderItems = useMemo(() => {
        return flattenFolderTree(rootFolders, expansionState.expandedFolders, parseExcludedFolders(settings.excludedFolders));
    }, [rootFolders, expansionState.expandedFolders, settings.excludedFolders]);

    /**
     * Build tag items with virtual folders and organization
     */
    const tagItems = useMemo(() => {
        const items: CombinedNavigationItem[] = [];

        if (!settings.showTags) return items;

        // Parse favorite and hidden tag patterns
        const favoritePatterns = settings.favoriteTags;
        const hiddenPatterns = settings.hiddenTags;

        // Helper function to add untagged node
        const addUntaggedNode = (level: number, context?: 'favorites' | 'tags') => {
            if (settings.showUntagged && untaggedCount > 0) {
                const untaggedNode: TagTreeNode = {
                    path: UNTAGGED_TAG_ID,
                    displayPath: UNTAGGED_TAG_ID,
                    name: strings.tagList.untaggedLabel,
                    children: new Map(),
                    notesWithTag: new Set()
                };

                items.push({
                    type: NavigationPaneItemType.UNTAGGED,
                    data: untaggedNode,
                    key: UNTAGGED_TAG_ID,
                    level,
                    context
                });
            }
        };

        // Helper function to add virtual folder
        const addVirtualFolder = (id: string, name: string, icon?: string) => {
            const folder: VirtualFolder = { id, name, icon };
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: folder,
                level: 0,
                key: id
            });
        };

        // Helper function to add tags to list
        const addTagItems = (tags: Map<string, TagTreeNode>, folderId: string) => {
            if (expansionState.expandedVirtualFolders.has(folderId)) {
                const tagItems = flattenTagTree(
                    Array.from(tags.values()),
                    expansionState.expandedTags,
                    1, // Start at level 1 since they're inside the virtual folder
                    folderId === 'favorite-tags-root' ? 'favorites' : 'tags'
                );
                items.push(...tagItems);

                // Add untagged node to favorites folder if enabled
                if (folderId === 'favorite-tags-root' && settings.showUntaggedInFavorites) {
                    addUntaggedNode(1, 'favorites');
                }

                // Add untagged node if this is the last tag container
                const isLastContainer = favoritePatterns.length === 0 || folderId === 'all-tags-root';
                // If no favorites exist, always show untagged in Tags regardless of showUntaggedInFavorites
                const shouldShowUntagged = favoritePatterns.length === 0 || !settings.showUntaggedInFavorites;
                if (isLastContainer && shouldShowUntagged) {
                    addUntaggedNode(1, 'tags');
                }
            }
        };

        // Apply hidden tag exclusion to both trees
        const visibleFavoriteTree = hiddenPatterns.length > 0 ? excludeFromTagTree(favoriteTree, hiddenPatterns) : favoriteTree;
        const visibleTagTree = hiddenPatterns.length > 0 ? excludeFromTagTree(tagTree, hiddenPatterns) : tagTree;

        // Handle tag organization
        if (favoritePatterns.length > 0) {
            // We already have separate trees from StorageContext

            if (settings.showFavoriteTagsFolder) {
                // Show "Favorites" folder
                addVirtualFolder('favorite-tags-root', strings.tagList.favoriteTags, 'lucide-star');
                addTagItems(visibleFavoriteTree, 'favorite-tags-root');
            } else {
                // Show favorite tags directly without folder
                const favoriteItems = flattenTagTree(
                    Array.from(visibleFavoriteTree.values()),
                    expansionState.expandedTags,
                    0, // Start at level 0 since no virtual folder
                    'favorites'
                );
                items.push(...favoriteItems);

                // Add untagged after favorite tags when folder isn't shown
                if (settings.showUntaggedInFavorites) {
                    addUntaggedNode(0, 'favorites');
                }
            }

            if (settings.showAllTagsFolder) {
                // Show "Tags" folder
                addVirtualFolder('all-tags-root', strings.tagList.allTags, 'lucide-tags');
                addTagItems(visibleTagTree, 'all-tags-root');
            } else {
                // Show non-favorite tags directly without folder
                const nonFavoriteItems = flattenTagTree(
                    Array.from(visibleTagTree.values()),
                    expansionState.expandedTags,
                    0, // Start at level 0 since no virtual folder
                    'tags'
                );
                items.push(...nonFavoriteItems);

                // Add untagged node at the end when not using folder and not in favorites
                if (!settings.showUntaggedInFavorites) {
                    addUntaggedNode(0, 'tags');
                }
            }
        } else {
            // No favorites configured
            if (settings.showAllTagsFolder) {
                // Show "Tags" folder
                addVirtualFolder('tags-root', strings.tagList.tags, 'lucide-tags');
                addTagItems(visibleTagTree, 'tags-root');
            } else {
                // Show all tags directly without folder
                const tagTreeItems = flattenTagTree(
                    Array.from(visibleTagTree.values()),
                    expansionState.expandedTags,
                    0, // Start at level 0 since no virtual folder
                    'tags'
                );
                items.push(...tagTreeItems);

                // Add untagged node at the end
                addUntaggedNode(0, 'tags');
            }
        }

        return items;
    }, [
        settings.showTags,
        settings.favoriteTags,
        settings.hiddenTags,
        settings.showUntagged,
        settings.showUntaggedInFavorites,
        settings.showFavoriteTagsFolder,
        settings.showAllTagsFolder,
        favoriteTree,
        tagTree,
        untaggedCount,
        expansionState.expandedTags,
        expansionState.expandedVirtualFolders
    ]);

    /**
     * Combine folder and tag items based on display order settings
     */
    const items = useMemo(() => {
        const allItems: CombinedNavigationItem[] = [];

        // Add top spacer at the beginning
        allItems.push({
            type: NavigationPaneItemType.TOP_SPACER,
            key: 'top-spacer'
        });

        if (settings.showTags && settings.showTagsAboveFolders) {
            // Tags first, then folders
            allItems.push(...tagItems);
            if (folderItems.length > 0 && tagItems.length > 0) {
                allItems.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: 'tags-folders-spacer'
                });
            }
            allItems.push(...folderItems);
        } else {
            // Folders first, then tags (default)
            allItems.push(...folderItems);
            if (settings.showTags && tagItems.length > 0) {
                allItems.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: 'folders-tags-spacer'
                });
                allItems.push(...tagItems);
            }
        }

        // Add spacer at the end for better visibility
        allItems.push({
            type: NavigationPaneItemType.BOTTOM_SPACER,
            key: 'bottom-spacer'
        });

        return allItems;
    }, [folderItems, tagItems, settings.showTags, settings.showTagsAboveFolders]);

    /**
     * Create a map for O(1) item lookups by path
     */
    const pathToIndex = useMemo(() => {
        const map = new Map<string, number>();
        items.forEach((item, index) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                map.set(item.data.path, index);
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data as TagTreeNode;
                map.set(tagNode.path, index);
            }
        });
        return map;
    }, [items]);

    /**
     * Pre-compute tag counts to avoid expensive calculations during render
     */
    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();

        // Skip computation if pane is not visible or not showing tags
        if (!isVisible || !settings.showTags) return counts;

        // Add untagged count
        if (settings.showUntagged) {
            counts.set(UNTAGGED_TAG_ID, untaggedCount);
        }

        // Compute counts for all tag items
        items.forEach(item => {
            if (item.type === NavigationPaneItemType.TAG) {
                const tagNode = item.data as TagTreeNode;
                counts.set(tagNode.path, getTotalNoteCount(tagNode));
            }
        });

        return counts;
    }, [items, settings.showTags, settings.showUntagged, untaggedCount, isVisible]);

    /**
     * Pre-compute folder file counts to avoid recursive counting during render
     */
    const folderCounts = useMemo(() => {
        const counts = new Map<string, number>();

        // Skip computation if pane is not visible or not showing note counts
        if (!isVisible || !settings.showNoteCount) return counts;

        const excludedProperties = parseExcludedProperties(settings.excludedFiles);
        const excludedFolderPatterns = parseExcludedFolders(settings.excludedFolders);

        const countFiles = (folder: TFolder): number => {
            let count = 0;
            for (const child of folder.children) {
                if (child instanceof TFile) {
                    if (shouldDisplayFile(child, settings.fileVisibility, app)) {
                        if (!shouldExcludeFile(child, excludedProperties, app)) {
                            count++;
                        }
                    }
                } else if (settings.showNotesFromSubfolders && child instanceof TFolder) {
                    // Check if this subfolder should be excluded - pass full path for path-based patterns
                    if (!shouldExcludeFolder(child.name, excludedFolderPatterns, child.path)) {
                        count += countFiles(child);
                    }
                }
            }
            return count;
        };

        // Compute counts for all folder items
        items.forEach(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.data instanceof TFolder) {
                counts.set(item.data.path, countFiles(item.data));
            }
        });

        return counts;
    }, [
        items,
        settings.showNoteCount,
        settings.showNotesFromSubfolders,
        settings.excludedFiles,
        settings.excludedFolders,
        settings.fileVisibility,
        app,
        isVisible
    ]);

    /**
     * Build root folders from vault structure and listen for changes
     */
    useEffect(() => {
        // Function to build folders
        const buildFolders = () => {
            const vault = app.vault;
            const root = vault.getRoot();

            let folders: TFolder[];
            if (settings.showRootFolder) {
                folders = [root];
            } else {
                folders = root.children
                    .filter((child): child is TFolder => child instanceof TFolder)
                    .sort((a, b) => a.name.localeCompare(b.name));
            }

            setRootFolders(folders);
        };

        // Build immediately on mount
        buildFolders();

        // Use leading edge debounce for immediate folder updates
        const rebuildFolders = leadingEdgeDebounce(buildFolders, TIMEOUTS.DEBOUNCE_CONTENT);

        // Listen to vault events for folder changes
        const events = [
            app.vault.on('create', file => {
                if (file instanceof TFolder) rebuildFolders();
            }),
            app.vault.on('delete', file => {
                if (file instanceof TFolder) rebuildFolders();
            }),
            app.vault.on('rename', file => {
                if (file instanceof TFolder) rebuildFolders();
            })
        ];

        return () => {
            events.forEach(eventRef => app.vault.offref(eventRef));
        };
    }, [app, settings.showRootFolder]);

    return {
        items,
        pathToIndex,
        tagCounts,
        folderCounts
    };
}
