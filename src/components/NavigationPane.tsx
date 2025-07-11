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

import React, { useMemo, useRef, useEffect, useLayoutEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { debounce } from 'obsidian';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { TFolder, TFile, App, getAllTags, Platform, View } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { flattenFolderTree, flattenTagTree, findFolderIndex } from '../utils/treeFlattener';
import { FolderItem } from './FolderItem';
import { VirtualFolderComponent } from './VirtualFolderItem';
import { TagTreeItem } from './TagTreeItem';
import { useMetadataService } from '../context/ServicesContext';
import { PaneHeader } from './PaneHeader';
import { strings } from '../i18n';
import { isTFolder } from '../utils/typeGuards';
import type { CombinedNavigationItem, VirtualFolderItem } from '../types/virtualization';
import { 
    TagTreeNode, 
    getTotalNoteCount,
    filterTagTree,
    excludeFromTagTree,
    parseTagPatterns
} from '../utils/tagUtils';
import { parseExcludedFolders } from '../utils/fileFilters';
import { getFolderNote } from '../utils/fileFinder';
import { UNTAGGED_TAG_ID, NavigationPaneItemType, ItemType, VirtualFolder, NAVITEM_HEIGHTS } from '../types';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { useVisibilityReveal } from '../hooks/useVisibilityReveal';
import { ErrorBoundary } from './ErrorBoundary';
import { useTagCache } from '../context/TagCacheContext';

export interface NavigationPaneHandle {
    getIndexOfPath: (path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
}

export const NavigationPane = forwardRef<NavigationPaneHandle>((props, ref) => {
    const { app, plugin, isMobile } = useServices();
    const metadataService = useMetadataService();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const settings = useSettingsState();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    // Cache selected folder/tag path to avoid repeated property access
    const selectedPath = selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder 
        ? selectionState.selectedFolder.path 
        : selectionState.selectionType === ItemType.TAG && selectionState.selectedTag 
        ? selectionState.selectedTag 
        : null;
    
    // =================================================================================
    // We use useState to hold stable folder data across re-renders
    // =================================================================================
    const [rootFolders, setRootFolders] = useState<TFolder[]>([]);
    
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
                    .filter((child): child is TFolder => isTFolder(child))
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
            app.vault.on('create', (file) => {
                if (isTFolder(file)) rebuildFolders();
            }),
            app.vault.on('delete', (file) => {
                if (isTFolder(file)) rebuildFolders();
            }),
            app.vault.on('rename', (file) => {
                if (isTFolder(file)) rebuildFolders();
            })
        ];
        
        return () => {
            events.forEach(eventRef => app.vault.offref(eventRef));
        };
    }, [app, settings.showRootFolder]);
    
    // =================================================================================
    // Get tag data from the context
    // =================================================================================
    const { tagData } = useTagCache();
    const tagTree = tagData.tree;
    const untaggedCount = tagData.untagged;
    
    // =================================================================================
    // We use useState to hold flattened items to prevent virtualizer re-initialization
    // =================================================================================
    const [items, setItems] = useState<CombinedNavigationItem[]>([]);
    
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
            const favoritePatterns = parseTagPatterns(settings.favoriteTags);
            const hiddenPatterns = parseTagPatterns(settings.hiddenTags);
            
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
            
            // First, exclude hidden tags from the entire tree
            const visibleTagTree = hiddenPatterns.length > 0 
                ? excludeFromTagTree(tagTree, hiddenPatterns) 
                : tagTree;
            
            // Handle tag organization based on the new settings
            if (favoritePatterns.length > 0) {
                // We have favorite tags configured
                const favoriteTags = filterTagTree(visibleTagTree, favoritePatterns);
                const nonFavoriteTags = excludeFromTagTree(visibleTagTree, favoritePatterns);
                
                if (settings.showFavoriteTagsFolder) {
                    // Show "Favorites" folder
                    addVirtualFolder('favorite-tags-root', strings.tagList.favoriteTags, 'star');
                    addTagItems(favoriteTags, 'favorite-tags-root');
                } else {
                    // Show favorite tags directly without folder
                    const favoriteItems = flattenTagTree(
                        Array.from(favoriteTags.values()),
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
                    addTagItems(nonFavoriteTags, 'all-tags-root');
                } else {
                    // Show non-favorite tags directly without folder
                    const nonFavoriteItems = flattenTagTree(
                        Array.from(nonFavoriteTags.values()),
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
    }, [rootFolders, expansionState.expandedFolders, expansionState.expandedTags, 
        expansionState.expandedVirtualFolders, settings.excludedFolders, settings.showTags, 
        settings.showTagsAboveFolders, settings.showFavoriteTagsFolder, settings.showAllTagsFolder, 
        settings.showUntagged, settings.showUntaggedInFavorites, settings.favoriteTags, settings.hiddenTags, 
        tagTree, untaggedCount, strings.tagList.untaggedLabel]);
    
    // Initialize virtualizer
    const rowVirtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => {
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
        overscan: isMobile ? 50 : 10, // Match FileList's mobile overscan
    });
    
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
    
    // Expose the virtualizer instance, path lookup method, and scroll container via the ref
    useImperativeHandle(ref, () => ({
        getIndexOfPath: (path: string) => pathToIndex.get(path) ?? -1,
        virtualizer: rowVirtualizer,
        scrollContainerRef: scrollContainerRef.current
    }), [pathToIndex, rowVirtualizer]);

    // Determine if navigation pane is visible
    const isVisible = !uiState.singlePane || uiState.currentSinglePaneView === 'navigation';
    
    // Use visibility-based reveal with scroll position preservation
    useVisibilityReveal({
        getSelectionIndex: () => {
            if (selectedPath) {
                return pathToIndex.get(selectedPath) ?? -1;
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
        items: items,
        virtualizer: rowVirtualizer,
        focusedPane: 'navigation',
        containerRef: scrollContainerRef
    });
    
    
    // Handle folder toggle
    const handleFolderToggle = useCallback((path: string) => {
        expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: path });
    }, [expansionDispatch]);
    
    // Handle folder click
    const handleFolderClick = useCallback((folder: TFolder) => {
        // Normal folder selection behavior
        selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });
        
        // Auto-expand if enabled and folder has children
        if (settings.autoExpandFoldersTags && folder.children.some(child => isTFolder(child))) {
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
    }, [selectionDispatch, uiDispatch, uiState.singlePane, settings.autoExpandFoldersTags, expansionState.expandedFolders, expansionDispatch]);
    
    // Handle folder name click (for folder notes)
    const handleFolderNameClick = useCallback((folder: TFolder) => {
        // Check if we should open a folder note instead
        if (settings.enableFolderNotes) {
            const folderNote = getFolderNote(folder, settings, app);
            
            if (folderNote) {
                // Set folder as selected without auto-selecting first file
                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder, autoSelectedFile: null });
                
                // Set a temporary flag to prevent auto-reveal
                window.notebookNavigatorOpeningFolderNote = true;
                
                // Open the folder note
                app.workspace.getLeaf().openFile(folderNote).then(() => {
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
    }, [settings, app, selectionDispatch, handleFolderClick]);
    
    // Handle tag toggle
    const handleTagToggle = useCallback((path: string) => {
        expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: path });
    }, [expansionDispatch]);
    
    // Handle virtual folder toggle
    const handleVirtualFolderToggle = useCallback((folderId: string) => {
        expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId });
    }, [expansionDispatch]);
    
    // Handle tag click
    const handleTagClick = useCallback((tagPath: string) => {
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
    }, [selectionDispatch, uiDispatch, uiState.singlePane, settings.autoExpandFoldersTags, tagTree, expansionState.expandedTags, expansionDispatch]);
    
    // Scroll to top handler for mobile header click
    const handleScrollToTop = useCallback(() => {
        if (isMobile && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isMobile]);
    
    // Render individual item
    const renderItem = useCallback((item: CombinedNavigationItem): React.ReactNode => {
        switch (item.type) {
            case NavigationPaneItemType.FOLDER:
                return (
                    <FolderItem
                        folder={item.data}
                        level={item.level}
                        isExpanded={expansionState.expandedFolders.has(item.data.path)}
                        isSelected={selectionState.selectionType === ItemType.FOLDER && 
                            selectionState.selectedFolder?.path === item.data.path}
                        onToggle={() => handleFolderToggle(item.data.path)}
                        onClick={() => handleFolderClick(item.data)}
                        onNameClick={() => handleFolderNameClick(item.data)}
                        icon={settings.folderIcons?.[item.data.path]}
                    />
                );
                
            case NavigationPaneItemType.VIRTUAL_FOLDER: {
                const virtualFolder = item.data as VirtualFolder;
                const hasChildren = virtualFolder.id === 'tags-root' || 
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
                        isSelected={selectionState.selectionType === ItemType.TAG && 
                            selectionState.selectedTag === tagNode.path}
                        onToggle={() => handleTagToggle(tagNode.path)}
                        onClick={() => handleTagClick(tagNode.path)}
                        fileCount={item.type === NavigationPaneItemType.UNTAGGED ? untaggedCount : getTotalNoteCount(tagNode)}
                        showFileCount={settings.showNoteCount}
                        customIcon={metadataService.getTagIcon(tagNode.path)}
                        customColor={metadataService.getTagColor(tagNode.path)}
                    />
                );
            }
                
            case NavigationPaneItemType.SPACER: {
                const heights = isMobile ? NAVITEM_HEIGHTS.mobile : NAVITEM_HEIGHTS.desktop;
                return <div style={{ height: `${heights.spacer}px` }} />; // Bottom spacer
            }
            
            case NavigationPaneItemType.LIST_SPACER: {
                const heights = isMobile ? NAVITEM_HEIGHTS.mobile : NAVITEM_HEIGHTS.desktop;
                return <div style={{ height: `${heights.listSpacer}px` }} />; // Inter-list spacer
            }
                
            default:
                return null;
        }
    }, [expansionState.expandedFolders, expansionState.expandedTags, expansionState.expandedVirtualFolders, selectionState.selectionType, selectionState.selectedFolder?.path, selectionState.selectedTag, handleFolderToggle, handleFolderClick, handleFolderNameClick, handleTagToggle, handleTagClick, handleVirtualFolderToggle, untaggedCount, settings, settings.folderIcons, metadataService, isMobile]);
    
    return (
        <ErrorBoundary componentName="NavigationPane">
            <>
                <PaneHeader type="navigation" onHeaderClick={handleScrollToTop} />
            <div 
                ref={scrollContainerRef}
                className="nn-navigation-pane-scroller"
                data-pane="navigation"
                role="tree"
                tabIndex={-1}
            >
                <div
                    style={{
                        height: rowVirtualizer ? `${rowVirtualizer.getTotalSize()}px` : '100%',
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer && rowVirtualizer.getVirtualItems().map((virtualItem) => {
                        // Safe array access
                        const item = virtualItem.index >= 0 && virtualItem.index < items.length 
                            ? items[virtualItem.index] 
                            : null;
                        if (!item) return null;
                        
                        return (
                            <div
                                key={virtualItem.key}
                                data-index={virtualItem.index}
                                ref={rowVirtualizer.measureElement}
                                className="nn-virtual-nav-item"
                                style={{
                                    transform: `translateY(${virtualItem.start}px)`,
                                }}
                            >
                                {renderItem(item)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
        </ErrorBoundary>
    );
});