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
import { parseExcludedProperties, shouldExcludeFile, parseExcludedFolders } from '../utils/fileFilters';
import { getFolderNote } from '../utils/fileFinder';
import { UNTAGGED_TAG_ID, NavigationPaneItemType, ItemType, VirtualFolder } from '../types';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { scrollVirtualItemIntoView } from '../utils/virtualUtils';
import { ErrorBoundary } from './ErrorBoundary';
import { useTagCache } from '../context/TagCacheContext';

// Item height constants for accurate virtualization
const ITEM_HEIGHTS = {
  desktop: {
    folder: 28,      // Fixed height: 5px padding + 18px line-height + 5px padding
    tag: 28,         // Matches folder height
    header: 35,      // Tag section header
    spacer: 20       // Bottom spacer - matches FileList
  },
  mobile: {
    folder: 40,      // Fixed height: 11px padding + 18px line-height + 11px padding
    tag: 40,         // Matches folder height
    header: 38,      // Slightly larger for mobile font sizes
    spacer: 20       // Bottom spacer - matches FileList
  }
};

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
    // Removed: lastScrollPositionRef and savedScrollTopRef - no longer needed with centralized scroll restoration
    const spacerHeight = 20; // Consistent spacer height - matches FileList
    // Removed: lastScrolledPath - no longer needed with predictive scrolling
    
    
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
    // =================================================================================
    
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
                    
                    // Add untagged node if this is the last tag container
                    const isLastContainer = favoritePatterns.length === 0 || folderId === 'all-tags-root';
                    if (isLastContainer) {
                        addUntaggedNode(1);
                    }
                }
            };
            
            // First, exclude hidden tags from the entire tree
            const visibleTagTree = hiddenPatterns.length > 0 
                ? excludeFromTagTree(tagTree, hiddenPatterns) 
                : tagTree;
            
            if (settings.showRootTagFolders) {
                // Use virtual folders to organize tags
                if (favoritePatterns.length > 0) {
                    // With favorites: show "Favorite tags" and "All tags"
                    const favoriteTags = filterTagTree(visibleTagTree, favoritePatterns);
                    const nonFavoriteTags = excludeFromTagTree(visibleTagTree, favoritePatterns);
                    
                    // Add "Favorite tags" folder
                    addVirtualFolder('favorite-tags-root', strings.tagList.favoriteTags, 'star');
                    addTagItems(favoriteTags, 'favorite-tags-root');
                    
                    // Add "All tags" folder
                    addVirtualFolder('all-tags-root', strings.tagList.allTags, 'tags');
                    addTagItems(nonFavoriteTags, 'all-tags-root');
                } else {
                    // No favorites: just show "Tags" folder
                    addVirtualFolder('tags-root', strings.tagList.tags, 'tags');
                    addTagItems(visibleTagTree, 'tags-root');
                }
            } else {
                // Show tags directly without virtual folders
                if (favoritePatterns.length > 0) {
                    // Separate favorites from non-favorites
                    const favoriteTags = filterTagTree(visibleTagTree, favoritePatterns);
                    const nonFavoriteTags = excludeFromTagTree(visibleTagTree, favoritePatterns);
                    
                    // Add favorite tags first
                    const favoriteItems = flattenTagTree(
                        Array.from(favoriteTags.values()),
                        expansionState.expandedTags,
                        0 // Start at level 0 since no virtual folder
                    );
                    tagItems.push(...favoriteItems);
                    
                    // Then add non-favorite tags
                    const nonFavoriteItems = flattenTagTree(
                        Array.from(nonFavoriteTags.values()),
                        expansionState.expandedTags,
                        0 // Start at level 0 since no virtual folder
                    );
                    tagItems.push(...nonFavoriteItems);
                } else {
                    // No favorites, just show all tags
                    const items = flattenTagTree(
                        Array.from(visibleTagTree.values()),
                        expansionState.expandedTags,
                        0 // Start at level 0 since no virtual folder
                    );
                    tagItems.push(...items);
                }
                
                // Add untagged node at the end
                addUntaggedNode(0);
            }
        }
        
        // Combine items in the correct order
        if (settings.showTags && settings.showTagsAboveFolders) {
            // Tags first, then folders
            allItems.push(...tagItems);
            allItems.push({
                type: NavigationPaneItemType.SPACER,
                key: 'tags-folders-spacer'
            });
            allItems.push(...folderItems);
        } else {
            // Folders first, then tags (default)
            allItems.push(...folderItems);
            if (settings.showTags) {
                allItems.push({
                    type: NavigationPaneItemType.SPACER,
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
        settings.showTagsAboveFolders, settings.showRootTagFolders, settings.showUntagged, 
        settings.favoriteTags, settings.hiddenTags, tagTree, untaggedCount, strings.tagList.untaggedLabel]);
    // =================================================================================
    // =================================================================================
    
    // Initialize virtualizer
    const rowVirtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => {
            const item = items[index];
            const heights = isMobile ? ITEM_HEIGHTS.mobile : ITEM_HEIGHTS.desktop;
            
            switch (item.type) {
                case NavigationPaneItemType.SPACER:
                    return heights.spacer;
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

    
    // Add keyboard navigation
    useVirtualKeyboardNavigation({
        items: items,
        virtualizer: rowVirtualizer,
        focusedPane: 'folders',
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
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile
        if (isMobile) {
            uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
            // The scroll trigger in FileList.tsx will handle scrolling to the
            // correct file (which will be the first file on a new folder selection).
            // No explicit scroll dispatch is needed here anymore.
        }
    }, [selectionDispatch, uiDispatch, isMobile]);
    
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
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile
        if (isMobile) {
            uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
            // The scroll trigger in FileList.tsx will handle scrolling to the
            // correct file (which will be the first file on a new tag selection).
            // No explicit scroll dispatch is needed here anymore.
        }
    }, [selectionDispatch, uiDispatch, isMobile, uiState.currentMobileView]);
    
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
                    <FolderItem
                        folder={{
                            path: virtualFolder.id,
                            name: virtualFolder.name,
                            parent: null,
                            children: [],
                            isRoot: () => false
                        } as any} // Virtual folder doesn't match TFolder exactly
                        level={item.level}
                        isExpanded={expansionState.expandedVirtualFolders.has(virtualFolder.id)}
                        isSelected={false} // Virtual folders can't be selected
                        onToggle={() => handleVirtualFolderToggle(virtualFolder.id)}
                        onClick={() => {}} // No-op for virtual folders
                        onNameClick={() => {}} // No-op for virtual folders
                        icon={virtualFolder.icon}
                        isVirtual={true}
                        hasChildren={hasChildren}
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
                
            case NavigationPaneItemType.SPACER:
                return <div style={{ height: `${spacerHeight}px` }} />; // Empty spacer
                
            default:
                return null;
        }
    }, [expansionState.expandedFolders, expansionState.expandedTags, expansionState.expandedVirtualFolders, selectionState.selectionType, selectionState.selectedFolder?.path, selectionState.selectedTag, handleFolderToggle, handleFolderClick, handleFolderNameClick, handleTagToggle, handleTagClick, handleVirtualFolderToggle, untaggedCount, settings, spacerHeight, settings.folderIcons, metadataService]);
    
    return (
        <ErrorBoundary componentName="NavigationPane">
            <>
                <PaneHeader type="folder" onHeaderClick={handleScrollToTop} />
            <div 
                ref={scrollContainerRef}
                className="nn-navigation-pane-scroller"
                data-pane="folders"
                role="tree"
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