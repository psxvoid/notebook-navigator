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

import React, { useMemo, useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { debounce } from 'obsidian';
import { TFolder, TFile } from 'obsidian';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices } from '../context/ServicesContext';
import { useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { strings } from '../i18n';
import { UNTAGGED_TAG_ID, NavigationPaneItemType, ItemType, VirtualFolder, NAVITEM_HEIGHTS, OVERSCAN } from '../types';
import { TagTreeNode } from '../types/storage';
import type { CombinedNavigationItem } from '../types/virtualization';
import { parseExcludedFolders, parseExcludedProperties, shouldExcludeFile, matchesFolderPattern } from '../utils/fileFilters';
import { getFolderNote } from '../utils/fileFinder';
import { shouldDisplayFile } from '../utils/fileTypeUtils';
import { getTotalNoteCount, excludeFromTagTree } from '../utils/tagTree';
import { flattenFolderTree, flattenTagTree } from '../utils/treeFlattener';
import { FolderItem } from './FolderItem';
import { PaneHeader } from './PaneHeader';
import { TagTreeItem } from './TagTreeItem';
import { VirtualFolderComponent } from './VirtualFolderItem';

export interface NavigationPaneHandle {
    getIndexOfPath: (path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
    requestScroll: (path: string) => void;
}

interface NavigationPaneProps {
    style?: React.CSSProperties;
    /**
     * Reference to the root navigator container (.nn-split-container).
     * This is passed from NotebookNavigatorComponent to ensure keyboard events
     * are captured at the navigator level, not globally. This allows proper
     * keyboard navigation between panes while preventing interference with
     * other Obsidian views.
     */
    rootContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const NavigationPane = React.memo(
    forwardRef<NavigationPaneHandle, NavigationPaneProps>(function NavigationPane(props, ref) {
        const { app, isMobile } = useServices();
        const metadataService = useMetadataService();
        const expansionState = useExpansionState();
        const expansionDispatch = useExpansionDispatch();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();
        const scrollContainerRef = useRef<HTMLDivElement>(null);

        // =================================================================================
        // We use useState to hold stable folder data across re-renders
        // =================================================================================
        const [rootFolders, setRootFolders] = useState<TFolder[]>([]);

        // =================================================================================
        // Get tag data from the context
        // =================================================================================
        const { fileData } = useFileCache();
        const favoriteTree = fileData.favoriteTree;
        const tagTree = fileData.tagTree;
        const untaggedCount = fileData.untagged;

        // Track previous settings for smart auto-expand
        const prevShowFavoritesFolder = useRef(settings.showFavoriteTagsFolder);
        const prevShowAllTagsFolder = useRef(settings.showAllTagsFolder);
        const prevFavoritesCount = useRef(settings.favoriteTags.length);

        // =================================================================================
        // We use useState to hold flattened items to prevent virtualizer re-initialization
        // =================================================================================
        const [items, setItems] = useState<CombinedNavigationItem[]>([]);

        // Pending scroll state for handling reveal operations
        const pendingScrollRef = useRef<string | null>(null);
        const [pendingScrollVersion, setPendingScrollVersion] = useState(0);

        // Initialize virtualizer
        const rowVirtualizer = useVirtualizer({
            count: items.length,
            getScrollElement: () => scrollContainerRef.current,
            estimateSize: index => {
                const item = items[index];
                const heights = isMobile ? NAVITEM_HEIGHTS.mobile : NAVITEM_HEIGHTS.desktop;

                switch (item.type) {
                    case NavigationPaneItemType.SPACER:
                        return heights.spacer;
                    case NavigationPaneItemType.LIST_SPACER:
                        return heights.listSpacer;
                    case NavigationPaneItemType.FOLDER:
                    case NavigationPaneItemType.VIRTUAL_FOLDER:
                        return heights.folder;
                    case NavigationPaneItemType.TAG:
                    case NavigationPaneItemType.UNTAGGED:
                        return heights.tag;
                    default:
                        return heights.folder; // fallback
                }
            },
            overscan: OVERSCAN
        });

        // Track previous selected path to detect actual selection changes
        const prevSelectedPathRef = useRef<string | null>(null);
        const prevVisibleRef = useRef<boolean>(false);
        const prevFocusedPaneRef = useRef<string | null>(null);

        // Create a map for O(1) item lookups
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

        // Handle folder toggle
        const handleFolderToggle = useCallback(
            (path: string) => {
                expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: path });
            },
            [expansionDispatch]
        );

        // Handle folder click
        const handleFolderClick = useCallback(
            (folder: TFolder) => {
                // Normal folder selection behavior
                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

                // Auto-expand if enabled and folder has children
                if (settings.autoExpandFoldersTags && folder.children.some(child => child instanceof TFolder)) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedFolders.has(folder.path)) {
                        expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                    }
                }

                // Switch to files view in single pane mode
                if (uiState.singlePane) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    // Set focus to files pane when switching
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                } else {
                    // In dual-pane mode, keep focus on folders
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                }
            },
            [
                selectionDispatch,
                uiDispatch,
                uiState.singlePane,
                settings.autoExpandFoldersTags,
                expansionState.expandedFolders,
                expansionDispatch
            ]
        );

        // Handle folder name click (for folder notes)
        const handleFolderNameClick = useCallback(
            (folder: TFolder) => {
                // Check if we should open a folder note instead
                if (settings.enableFolderNotes) {
                    const folderNote = getFolderNote(folder, settings, app);

                    if (folderNote) {
                        // Set folder as selected without auto-selecting first file
                        selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder, autoSelectedFile: null });

                        // Set a temporary flag to prevent auto-reveal
                        window.notebookNavigatorOpeningFolderNote = true;

                        // Open the folder note
                        app.workspace
                            .getLeaf()
                            .openFile(folderNote)
                            .then(() => {
                                // Clear the flag after a short delay
                                setTimeout(() => {
                                    delete window.notebookNavigatorOpeningFolderNote;
                                }, 100);
                            });

                        return;
                    }
                }

                // If no folder note, fall back to normal folder click behavior
                handleFolderClick(folder);
            },
            [settings, app, selectionDispatch, handleFolderClick]
        );

        // Handle tag toggle
        const handleTagToggle = useCallback(
            (path: string) => {
                expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: path });
            },
            [expansionDispatch]
        );

        // Handle virtual folder toggle
        const handleVirtualFolderToggle = useCallback(
            (folderId: string) => {
                expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId });
            },
            [expansionDispatch]
        );

        // Handle tag click
        const handleTagClick = useCallback(
            (tagPath: string) => {
                // Check if clicking the same tag
                const isSameTag =
                    selectionState.selectionType === 'tag' && selectionState.selectedTag && selectionState.selectedTag === tagPath;

                // If clicking the same tag, just handle view switching
                if (isSameTag) {
                    if (uiState.singlePane) {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    } else {
                        // In dual-pane mode, still need to set focus
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    }
                    return;
                }

                selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagPath });

                // Auto-expand if enabled and tag has children
                if (settings.autoExpandFoldersTags) {
                    // Find the tag node to check if it has children
                    const tagNode = Array.from(tagTree.values()).find(node => node.path === tagPath);
                    if (tagNode && tagNode.children.size > 0) {
                        // Only expand if not already expanded
                        if (!expansionState.expandedTags.has(tagPath)) {
                            expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath });
                        }
                    }
                }

                // Switch to files view in single pane mode
                if (uiState.singlePane) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    // Set focus to files pane when switching
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                } else {
                    // In dual-pane mode, keep focus on folders
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                }
            },
            [
                selectionDispatch,
                uiDispatch,
                uiState.singlePane,
                settings.autoExpandFoldersTags,
                tagTree,
                expansionState.expandedTags,
                expansionDispatch,
                selectionState.selectedTag,
                selectionState.selectionType
            ]
        );

        // Pre-compute tag counts to avoid expensive calculations during render
        const tagCounts = useMemo(() => {
            const counts = new Map<string, number>();

            // Only compute if we're showing tags
            if (!settings.showTags) return counts;

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
        }, [items, settings.showTags, settings.showUntagged, untaggedCount]);

        // Pre-compute folder file counts to avoid recursive counting during render
        const folderCounts = useMemo(() => {
            const counts = new Map<string, number>();

            // Only compute if we're showing note counts
            if (!settings.showNoteCount) return counts;

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
                        // Check if this subfolder should be excluded
                        const isExcluded = excludedFolderPatterns.some(pattern => matchesFolderPattern(child.name, pattern));

                        if (!isExcluded) {
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
            app
        ]);

        // Scroll to top handler for mobile header click
        const handleScrollToTop = useCallback(() => {
            if (isMobile && scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, [isMobile]);

        // Render individual item
        const renderItem = useCallback(
            (item: CombinedNavigationItem): React.ReactNode => {
                switch (item.type) {
                    case NavigationPaneItemType.FOLDER:
                        return (
                            <FolderItem
                                folder={item.data}
                                level={item.level}
                                isExpanded={expansionState.expandedFolders.has(item.data.path)}
                                isSelected={
                                    selectionState.selectionType === ItemType.FOLDER &&
                                    selectionState.selectedFolder?.path === item.data.path
                                }
                                onToggle={() => handleFolderToggle(item.data.path)}
                                onClick={() => handleFolderClick(item.data)}
                                onNameClick={() => handleFolderNameClick(item.data)}
                                icon={metadataService.getFolderIcon(item.data.path)}
                                fileCount={folderCounts.get(item.data.path)}
                            />
                        );

                    case NavigationPaneItemType.VIRTUAL_FOLDER: {
                        const virtualFolder = item.data as VirtualFolder;
                        const hasChildren =
                            virtualFolder.id === 'tags-root' ||
                            virtualFolder.id === 'all-tags-root' ||
                            virtualFolder.id === 'favorite-tags-root';

                        return (
                            <VirtualFolderComponent
                                virtualFolder={virtualFolder}
                                level={item.level}
                                isExpanded={expansionState.expandedVirtualFolders.has(virtualFolder.id)}
                                hasChildren={hasChildren}
                                onToggle={() => handleVirtualFolderToggle(virtualFolder.id)}
                            />
                        );
                    }

                    case NavigationPaneItemType.TAG:
                    case NavigationPaneItemType.UNTAGGED: {
                        const tagNode = item.data as TagTreeNode;
                        return (
                            <TagTreeItem
                                tagNode={tagNode}
                                level={item.level ?? 0}
                                isExpanded={expansionState.expandedTags.has(tagNode.path)}
                                isSelected={selectionState.selectionType === ItemType.TAG && selectionState.selectedTag === tagNode.path}
                                onToggle={() => handleTagToggle(tagNode.path)}
                                onClick={() => handleTagClick(tagNode.path)}
                                fileCount={tagCounts.get(tagNode.path) || 0}
                                showFileCount={settings.showNoteCount}
                            />
                        );
                    }

                    case NavigationPaneItemType.SPACER: {
                        const heights = isMobile ? NAVITEM_HEIGHTS.mobile : NAVITEM_HEIGHTS.desktop;
                        return (
                            <div className="nn-nav-spacer" style={{ height: `${heights.spacer}px`, minHeight: `${heights.spacer}px` }} />
                        ); // Bottom spacer
                    }

                    case NavigationPaneItemType.LIST_SPACER: {
                        const heights = isMobile ? NAVITEM_HEIGHTS.mobile : NAVITEM_HEIGHTS.desktop;
                        return (
                            <div
                                className="nn-nav-list-spacer"
                                style={{ height: `${heights.listSpacer}px`, minHeight: `${heights.listSpacer}px` }}
                            />
                        ); // Inter-list spacer
                    }

                    default:
                        return null;
                }
            },
            [
                expansionState.expandedFolders,
                expansionState.expandedTags,
                expansionState.expandedVirtualFolders,
                selectionState.selectionType,
                selectionState.selectedFolder?.path,
                selectionState.selectedTag,
                handleFolderToggle,
                handleFolderClick,
                handleFolderNameClick,
                handleTagToggle,
                handleTagClick,
                handleVirtualFolderToggle,
                settings,
                isMobile,
                tagCounts,
                folderCounts,
                metadataService
            ]
        );

        // Cache selected folder/tag path to avoid repeated property access
        const selectedPath =
            selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder
                ? selectionState.selectedFolder.path
                : selectionState.selectionType === ItemType.TAG && selectionState.selectedTag
                  ? selectionState.selectedTag.startsWith('#')
                      ? selectionState.selectedTag.slice(1)
                      : selectionState.selectedTag
                  : null;

        // Determine if navigation pane is visible early for optimization
        const isVisible = uiState.dualPane || uiState.currentSinglePaneView === 'navigation';

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

            // Create debounced version for vault events
            const rebuildFolders = debounce(buildFolders, 300);

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

        useEffect(() => {
            const rebuildItems = () => {
                const allItems: CombinedNavigationItem[] = [];

                // Build folders
                const folderItems = flattenFolderTree(
                    rootFolders,
                    expansionState.expandedFolders,
                    parseExcludedFolders(settings.excludedFolders)
                );

                // Build tag section if enabled
                const tagItems: CombinedNavigationItem[] = [];
                if (settings.showTags) {
                    // Parse favorite and hidden tag patterns
                    // Note: We pass arrays directly now, not comma-separated strings
                    const favoritePatterns = settings.favoriteTags;
                    const hiddenPatterns = settings.hiddenTags;

                    // Helper function to add untagged node
                    const addUntaggedNode = (level: number) => {
                        if (settings.showUntagged && untaggedCount > 0) {
                            const untaggedNode: TagTreeNode = {
                                path: UNTAGGED_TAG_ID,
                                name: strings.tagList.untaggedLabel,
                                children: new Map(),
                                notesWithTag: new Set()
                            };

                            tagItems.push({
                                type: NavigationPaneItemType.UNTAGGED,
                                data: untaggedNode,
                                key: UNTAGGED_TAG_ID,
                                level
                            });
                        }
                    };

                    // Helper function to add virtual folder
                    const addVirtualFolder = (id: string, name: string, icon?: string) => {
                        const folder: VirtualFolder = { id, name, icon };
                        tagItems.push({
                            type: NavigationPaneItemType.VIRTUAL_FOLDER,
                            data: folder,
                            level: 0,
                            key: id
                        });
                    };

                    // Helper function to add tags to list
                    const addTagItems = (tags: Map<string, TagTreeNode>, folderId: string) => {
                        if (expansionState.expandedVirtualFolders.has(folderId)) {
                            const items = flattenTagTree(
                                Array.from(tags.values()),
                                expansionState.expandedTags,
                                1 // Start at level 1 since they're inside the virtual folder
                            );
                            tagItems.push(...items);

                            // Add untagged node to favorites folder if enabled
                            if (folderId === 'favorite-tags-root' && settings.showUntaggedInFavorites) {
                                addUntaggedNode(1);
                            }

                            // Add untagged node if this is the last tag container
                            const isLastContainer = favoritePatterns.length === 0 || folderId === 'all-tags-root';
                            // If no favorites exist, always show untagged in Tags regardless of showUntaggedInFavorites
                            const shouldShowUntagged = favoritePatterns.length === 0 || !settings.showUntaggedInFavorites;
                            if (isLastContainer && shouldShowUntagged) {
                                addUntaggedNode(1);
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
                            addVirtualFolder('favorite-tags-root', strings.tagList.favoriteTags, 'star');
                            addTagItems(visibleFavoriteTree, 'favorite-tags-root');
                        } else {
                            // Show favorite tags directly without folder
                            const favoriteItems = flattenTagTree(
                                Array.from(visibleFavoriteTree.values()),
                                expansionState.expandedTags,
                                0 // Start at level 0 since no virtual folder
                            );
                            tagItems.push(...favoriteItems);

                            // Add untagged after favorite tags when folder isn't shown
                            if (settings.showUntaggedInFavorites) {
                                addUntaggedNode(0);
                            }
                        }

                        if (settings.showAllTagsFolder) {
                            // Show "Tags" folder
                            addVirtualFolder('all-tags-root', strings.tagList.allTags, 'tags');
                            addTagItems(visibleTagTree, 'all-tags-root');
                        } else {
                            // Show non-favorite tags directly without folder
                            const nonFavoriteItems = flattenTagTree(
                                Array.from(visibleTagTree.values()),
                                expansionState.expandedTags,
                                0 // Start at level 0 since no virtual folder
                            );
                            tagItems.push(...nonFavoriteItems);

                            // Add untagged node at the end when not using folder and not in favorites
                            if (!settings.showUntaggedInFavorites) {
                                addUntaggedNode(0);
                            }
                        }
                    } else {
                        // No favorites configured
                        if (settings.showAllTagsFolder) {
                            // Show "Tags" folder
                            addVirtualFolder('tags-root', strings.tagList.tags, 'tags');
                            addTagItems(visibleTagTree, 'tags-root');
                        } else {
                            // Show all tags directly without folder
                            const items = flattenTagTree(
                                Array.from(visibleTagTree.values()),
                                expansionState.expandedTags,
                                0 // Start at level 0 since no virtual folder
                            );
                            tagItems.push(...items);

                            // Add untagged node at the end
                            addUntaggedNode(0);
                        }
                    }
                }

                // Combine items in the correct order
                if (settings.showTags && settings.showTagsAboveFolders) {
                    // Tags first, then folders
                    allItems.push(...tagItems);
                    allItems.push({
                        type: NavigationPaneItemType.LIST_SPACER,
                        key: 'tags-folders-spacer'
                    });
                    allItems.push(...folderItems);
                } else {
                    // Folders first, then tags (default)
                    allItems.push(...folderItems);
                    if (settings.showTags) {
                        allItems.push({
                            type: NavigationPaneItemType.LIST_SPACER,
                            key: 'folders-tags-spacer'
                        });
                        allItems.push(...tagItems);
                    }
                }

                // Add spacer at the end for better visibility
                allItems.push({
                    type: NavigationPaneItemType.SPACER,
                    key: 'bottom-spacer'
                });

                setItems(allItems);
            };

            rebuildItems();
        }, [
            rootFolders,
            expansionState.expandedFolders,
            expansionState.expandedTags,
            expansionState.expandedVirtualFolders,
            settings.excludedFolders,
            settings.showTags,
            settings.showTagsAboveFolders,
            settings.showFavoriteTagsFolder,
            settings.showAllTagsFolder,
            settings.showUntagged,
            settings.showUntaggedInFavorites,
            settings.favoriteTags,
            settings.hiddenTags,
            favoriteTree,
            tagTree,
            untaggedCount,
            isVisible,
            uiState.singlePane,
            expansionDispatch
        ]);

        // Smart auto-expand: Only expand virtual folders on specific setting transitions
        useEffect(() => {
            // Auto-expand favorites folder when:
            // 1. Setting changes from false to true
            // 2. First favorite tag is added (0 -> 1+)
            if (settings.showFavoriteTagsFolder) {
                const shouldAutoExpandFavorites =
                    (!prevShowFavoritesFolder.current && settings.showFavoriteTagsFolder) || // Setting enabled
                    (prevFavoritesCount.current === 0 && settings.favoriteTags.length > 0); // First favorite added

                if (shouldAutoExpandFavorites && !expansionState.expandedVirtualFolders.has('favorite-tags-root')) {
                    expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId: 'favorite-tags-root' });
                }
            }

            // Auto-expand all tags folder when setting changes from false to true
            if (settings.showAllTagsFolder) {
                const shouldAutoExpandAllTags = !prevShowAllTagsFolder.current && settings.showAllTagsFolder;

                if (shouldAutoExpandAllTags && !expansionState.expandedVirtualFolders.has('all-tags-root')) {
                    expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId: 'all-tags-root' });
                }
            }

            // Update refs for next comparison
            prevShowFavoritesFolder.current = settings.showFavoriteTagsFolder;
            prevShowAllTagsFolder.current = settings.showAllTagsFolder;
            prevFavoritesCount.current = settings.favoriteTags.length;
        }, [
            settings.showFavoriteTagsFolder,
            settings.showAllTagsFolder,
            settings.favoriteTags.length,
            expansionState.expandedVirtualFolders,
            expansionDispatch
        ]);

        // Scroll to selected folder/tag when needed
        // Only scroll when:
        // 1. Selection actually changes (not just tree structure changes)
        // 2. Pane becomes visible or gains focus
        // 3. During reveal operations (handled separately in useFileReveal)
        useEffect(() => {
            if (!selectedPath || !rowVirtualizer || !isVisible) return;

            // Check if this is an actual selection change vs just a tree structure update
            const isSelectionChange = prevSelectedPathRef.current !== selectedPath;

            // Check if pane just became visible or gained focus
            const justBecameVisible = !prevVisibleRef.current && isVisible;
            const justGainedFocus = prevFocusedPaneRef.current !== 'navigation' && uiState.focusedPane === 'navigation';

            // Update the refs for next comparison
            prevSelectedPathRef.current = selectedPath;
            prevVisibleRef.current = isVisible;
            prevFocusedPaneRef.current = uiState.focusedPane;

            // Only scroll on actual selection changes or visibility/focus changes
            if (!isSelectionChange && !justBecameVisible && !justGainedFocus) return;

            const index = pathToIndex.get(selectedPath);

            if (index !== undefined && index >= 0) {
                rowVirtualizer.scrollToIndex(index, {
                    align: 'auto',
                    behavior: 'auto'
                });
            }
        }, [selectedPath, rowVirtualizer, isVisible, pathToIndex, uiState.focusedPane]);

        // Special handling for startup tag scrolling
        // Tags load after folders, so we need a separate effect to catch when they become available
        useEffect(() => {
            if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag && rowVirtualizer && isVisible) {
                const tagIndex = pathToIndex.get(selectionState.selectedTag);

                if (tagIndex !== undefined && tagIndex >= 0) {
                    rowVirtualizer.scrollToIndex(tagIndex, {
                        align: 'auto',
                        behavior: 'auto'
                    });
                }
            }
        }, [pathToIndex, selectionState.selectionType, selectionState.selectedTag, rowVirtualizer, isVisible]);

        // Listen for mobile drawer visibility
        useEffect(() => {
            if (!isMobile) return;

            const handleVisible = () => {
                // If we have a selected folder or tag, scroll to it
                if (selectedPath && rowVirtualizer) {
                    const index = pathToIndex.get(selectedPath);
                    if (index !== undefined && index >= 0) {
                        rowVirtualizer.scrollToIndex(index, {
                            align: 'auto',
                            behavior: 'auto'
                        });
                    }
                }
            };

            window.addEventListener('notebook-navigator-visible', handleVisible);
            return () => window.removeEventListener('notebook-navigator-visible', handleVisible);
        }, [isMobile, selectedPath, rowVirtualizer, pathToIndex]);

        // Expose the virtualizer instance, path lookup method, and scroll container via the ref
        useImperativeHandle(
            ref,
            () => ({
                getIndexOfPath: (path: string) => pathToIndex.get(path) ?? -1,
                virtualizer: rowVirtualizer,
                scrollContainerRef: scrollContainerRef.current,
                requestScroll: (path: string) => {
                    pendingScrollRef.current = path;
                    setPendingScrollVersion(v => v + 1);
                }
            }),
            [pathToIndex, rowVirtualizer]
        );

        // Process pending scrolls when pathToIndex is ready
        useEffect(() => {
            if (!rowVirtualizer || !pendingScrollRef.current || !isVisible) {
                return;
            }

            const pathToScroll = pendingScrollRef.current;
            const index = pathToIndex.get(pathToScroll);

            if (index !== undefined && index !== -1) {
                rowVirtualizer.scrollToIndex(index, { align: 'center', behavior: 'auto' });
                pendingScrollRef.current = null;
            }
            // If index not found, keep the pending scroll for next rebuild
        }, [rowVirtualizer, pathToIndex, isVisible, pendingScrollVersion]);

        // Add keyboard navigation
        // Note: We pass the root container ref, not the scroll container ref.
        // This ensures keyboard events work across the entire navigator, allowing
        // users to navigate between panes (navigation <-> files) with Tab/Arrow keys.
        useVirtualKeyboardNavigation({
            items: items,
            virtualizer: rowVirtualizer,
            focusedPane: 'navigation',
            containerRef: props.rootContainerRef,
            pathToIndex: pathToIndex,
            files: [], // Not used in navigation pane
            fileIndexMap: new Map() // Not used in navigation pane
        });

        return (
            <div className="nn-navigation-pane" style={props.style}>
                <PaneHeader type="navigation" onHeaderClick={handleScrollToTop} />
                <div ref={scrollContainerRef} className="nn-navigation-pane-scroller" data-pane="navigation" role="tree" tabIndex={-1}>
                    {items.length > 0 && (
                        <div
                            className="nn-virtual-container"
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map(virtualItem => {
                                // Safe array access
                                const item = virtualItem.index >= 0 && virtualItem.index < items.length ? items[virtualItem.index] : null;
                                if (!item) return null;

                                return (
                                    <div
                                        key={virtualItem.key}
                                        data-index={virtualItem.index}
                                        className="nn-virtual-nav-item"
                                        style={{
                                            transform: `translateY(${virtualItem.start}px)`
                                        }}
                                    >
                                        {renderItem(item)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    })
);
