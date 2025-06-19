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
import { PaneHeader } from './PaneHeader';
import { strings } from '../i18n';
import { isTFolder } from '../utils/typeGuards';
import type { CombinedNavigationItem } from '../types/virtualization';
import { buildTagTree, TagTreeNode, getTotalNoteCount, clearNoteCountCache } from '../utils/tagUtils';
import { parseExcludedProperties, shouldExcludeFile, parseExcludedFolders } from '../utils/fileFilters';
import { UNTAGGED_TAG_ID } from '../types';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { scrollVirtualItemIntoView } from '../utils/virtualUtils';
import { ErrorBoundary } from './ErrorBoundary';
import { debugLog } from '../utils/debugLog';

// Item height constants for accurate virtualization
const ITEM_HEIGHTS = {
  desktop: {
    folder: 32,      // Accounts for padding + line-height 1.4
    tag: 32,         // Matches folder height
    header: 35,      // Tag section header
    spacer: 25       // Bottom spacer
  },
  mobile: {
    folder: 44,      // Accounts for larger padding + min-height 40px
    tag: 44,         // Matches folder height
    header: 38,      // Slightly larger for mobile font sizes
    spacer: 40       // Larger touch target
  }
};

export interface NavigationPaneHandle {
    getIndexOfPath: (path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
}

export const NavigationPane = forwardRef<NavigationPaneHandle>((props, ref) => {
    const { app, plugin, isMobile } = useServices();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const settings = useSettingsState();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // Removed: lastScrollPositionRef and savedScrollTopRef - no longer needed with centralized scroll restoration
    const spacerHeight = isMobile ? 40 : 25; // More space on mobile
    // Removed: lastScrolledPath - no longer needed with predictive scrolling
    
    
    // Cache selected folder/tag path to avoid repeated property access
    const selectedPath = selectionState.selectionType === 'folder' && selectionState.selectedFolder 
        ? selectionState.selectedFolder.path 
        : selectionState.selectionType === 'tag' && selectionState.selectedTag 
        ? selectionState.selectedTag 
        : null;
    
    
    // Log component mount/unmount only if debug is enabled
    useEffect(() => {
        if (Platform.isMobile && plugin.settings.debugMobile) {
            debugLog.info('LeftPaneVirtualized: Mounted', {
                isMobile,
                selectedFolder: selectionState.selectedFolder?.path,
                selectedTag: selectionState.selectedTag,
                expandedFoldersCount: expansionState.expandedFolders.size,
                expandedTagsCount: expansionState.expandedTags.size
            });
            return () => {
                debugLog.info('LeftPaneVirtualized: Unmounted');
            };
        }
    }, [plugin.settings.debugMobile]);
    
    
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
            if (plugin.settings.showRootFolder) {
                folders = [root];
            } else {
                folders = root.children
                    .filter(child => isTFolder(child))
                    .sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];
            }
            
            setRootFolders(folders);
            if (plugin.settings.debugMobile) {
                debugLog.info("LeftPaneVirtualized: Root folders rebuilt.");
            }
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
    }, [app, plugin.settings.showRootFolder]);
    // =================================================================================
    // =================================================================================
    
    // =================================================================================
    // We use useState to hold the tag tree data. This makes it stable across re-renders.
    // =================================================================================
    const [tagData, setTagData] = useState<{ tree: Map<string, TagTreeNode>, untagged: number }>({ tree: new Map(), untagged: 0 });

    useEffect(() => {
        // Function to build tag tree
        const buildTags = () => {
            if (!plugin.settings.showTags) {
                setTagData({ tree: new Map(), untagged: 0 });
                return;
            }

            const excludedProperties = parseExcludedProperties(plugin.settings.excludedFiles);
            const allFiles = app.vault.getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            
            // Clear the cache before rebuilding to prevent memory accumulation
            clearNoteCountCache();
            
            const newTree = buildTagTree(allFiles, app);
            
            let newUntagged = 0;
            if (plugin.settings.showUntagged) {
                newUntagged = allFiles.filter(file => {
                    const cache = app.metadataCache.getFileCache(file);
                    return !cache || !getAllTags(cache)?.length;
                }).length;
            }
            
            setTagData({ tree: newTree, untagged: newUntagged });
            if (plugin.settings.debugMobile) {
                debugLog.info("LeftPaneVirtualized: Tag tree rebuilt.");
            }
        };

        // Build immediately on mount
        buildTags();
        
        // Create debounced version for events
        const rebuildTagTree = debounce(buildTags, 300);

        // Listen to specific vault and metadata events
        const vaultEvents = [
            app.vault.on('create', rebuildTagTree),
            app.vault.on('delete', rebuildTagTree),
            app.vault.on('rename', rebuildTagTree)
        ];
        
        // Always rebuild on metadata changes - tags might have been added OR removed
        const metadataEvent = app.metadataCache.on('changed', (file) => {
            if (file && file.extension === 'md') {
                rebuildTagTree();
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
        };
    }, [app, plugin.settings.showTags, plugin.settings.showUntagged, plugin.settings.excludedFiles]);
    // =================================================================================
    // =================================================================================
    
    const tagTree = tagData.tree;
    const untaggedCount = tagData.untagged;
    
    // =================================================================================
    // We use useState to hold flattened items to prevent virtualizer re-initialization
    // =================================================================================
    const [items, setItems] = useState<CombinedNavigationItem[]>([]);
    
    useEffect(() => {
        const rebuildItems = () => {
        const allItems: CombinedNavigationItem[] = [];
        
        // Add folders
        const folderItems = flattenFolderTree(
            rootFolders,
            expansionState.expandedFolders,
            parseExcludedFolders(plugin.settings.ignoreFolders || '')
        );
        allItems.push(...folderItems);
        
        // Add tag section if enabled
        if (plugin.settings.showTags) {
            // Add header
            allItems.push({ 
                type: 'tag-header', 
                key: 'tag-header' 
            });
            
            // Add tags
            const tagItems = flattenTagTree(
                Array.from(tagTree.values()),
                expansionState.expandedTags
            );
            allItems.push(...tagItems);
            
            // Add untagged if enabled
            if (plugin.settings.showUntagged && untaggedCount > 0) {
                // Create untagged node
                const untaggedNode: TagTreeNode = {
                    path: UNTAGGED_TAG_ID,
                    name: strings.tagList.untaggedLabel,
                    children: new Map(),
                    notesWithTag: new Set()
                };
                
                allItems.push({
                    type: 'untagged',
                    data: untaggedNode,
                    key: UNTAGGED_TAG_ID
                });
            }
        }
        
        // Add spacer at the end for better visibility
        allItems.push({
            type: 'spacer',
            key: 'bottom-spacer'
        });
        
            setItems(allItems);
            if (plugin.settings.debugMobile) {
                debugLog.info("NavigationPane: Items list rebuilt.", { count: allItems.length });
            }
        };
        
        rebuildItems();
    }, [rootFolders, expansionState.expandedFolders, expansionState.expandedTags, 
        plugin.settings.ignoreFolders, plugin.settings.showTags, 
        plugin.settings.showUntagged, tagTree, untaggedCount, strings.tagList.untaggedLabel]);
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
                case 'tag-header':
                    return heights.header;
                case 'spacer':
                    return heights.spacer;
                case 'folder':
                    return heights.folder;
                case 'tag':
                case 'untagged':
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
            if (item.type === 'folder') {
                map.set(item.data.path, index);
            } else if (item.type === 'tag' || item.type === 'untagged') {
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
        debugLog.debug('[NavigationPane] Folder clicked:', {
            folder: folder.path,
            isMobile,
            currentMobileView: uiState.currentMobileView,
            currentFocusedPane: uiState.focusedPane
        });
        debugLog.debug('NavigationPane: Folder clicked', {
            folder: folder.path,
            isMobile,
            currentMobileView: uiState.currentMobileView
        });
        selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile
        if (isMobile) {
            uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
            // The scroll trigger in FileList.tsx will handle scrolling to the
            // correct file (which will be the first file on a new folder selection).
            // No explicit scroll dispatch is needed here anymore.
        }
    }, [selectionDispatch, uiDispatch, isMobile, uiState.currentMobileView, uiState.focusedPane]);
    
    // Handle tag toggle
    const handleTagToggle = useCallback((path: string) => {
        expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: path });
    }, [expansionDispatch]);
    
    // Handle tag click
    const handleTagClick = useCallback((tagPath: string) => {
        if (Platform.isMobile && plugin.settings.debugMobile) {
            debugLog.debug('NavigationPane: Tag clicked', {
                tag: tagPath,
                isMobile,
                currentMobileView: uiState.currentMobileView
            });
        }
        selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagPath });
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile
        if (isMobile) {
            uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
            // The scroll trigger in FileList.tsx will handle scrolling to the
            // correct file (which will be the first file on a new tag selection).
            // No explicit scroll dispatch is needed here anymore.
        }
    }, [selectionDispatch, uiDispatch, isMobile, uiState.currentMobileView, plugin.settings.debugMobile]);
    
    // Scroll to top handler for mobile header click
    const handleScrollToTop = useCallback(() => {
        if (isMobile && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isMobile]);
    
    // Render individual item
    const renderItem = useCallback((item: CombinedNavigationItem): React.ReactNode => {
        switch (item.type) {
            case 'folder':
                return (
                    <FolderItem
                        folder={item.data}
                        level={item.level}
                        isExpanded={expansionState.expandedFolders.has(item.data.path)}
                        isSelected={selectionState.selectionType === 'folder' && 
                            selectionState.selectedFolder?.path === item.data.path}
                        onToggle={() => handleFolderToggle(item.data.path)}
                        onClick={() => handleFolderClick(item.data)}
                        icon={settings.folderIcons?.[item.data.path]}
                    />
                );
                
            case 'tag-header':
                return (
                    <div className="nn-section-header nn-tags-header">
                        {strings.tagList.sectionHeader}
                    </div>
                );
                
            case 'tag':
            case 'untagged': {
                const tagNode = item.data as TagTreeNode;
                return (
                    <TagTreeItem
                        tagNode={tagNode}
                        level={item.type === 'untagged' ? 0 : item.level}
                        isExpanded={expansionState.expandedTags.has(tagNode.path)}
                        isSelected={selectionState.selectionType === 'tag' && 
                            selectionState.selectedTag === tagNode.path}
                        onToggle={() => handleTagToggle(tagNode.path)}
                        onClick={() => handleTagClick(tagNode.path)}
                        fileCount={item.type === 'untagged' ? untaggedCount : getTotalNoteCount(tagNode)}
                        showFileCount={settings.showFolderFileCount}
                    />
                );
            }
                
            case 'spacer':
                return <div style={{ height: `${spacerHeight}px` }} />; // Empty spacer
                
            default:
                return null;
        }
    }, [expansionState.expandedFolders, expansionState.expandedTags, selectionState.selectionType, selectionState.selectedFolder?.path, selectionState.selectedTag, handleFolderToggle, handleFolderClick, handleTagToggle, handleTagClick, untaggedCount, settings, spacerHeight, settings.folderIcons]);
    
    return (
        <ErrorBoundary componentName="LeftPaneVirtualized">
            <>
                <PaneHeader type="folder" onHeaderClick={handleScrollToTop} />
            <div 
                ref={scrollContainerRef}
                className="nn-left-pane-scroller"
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
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
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