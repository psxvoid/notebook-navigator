import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TFolder, TFile, App, getAllTags } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { flattenFolderTree, flattenTagTree, findFolderIndex } from '../utils/treeFlattener';
import { FolderItem } from './FolderItem';
import { TagTreeItem } from './TagTreeItem';
import { PaneHeader } from './PaneHeader';
import { strings } from '../i18n';
import { isTFolder } from '../utils/typeGuards';
import type { CombinedLeftPaneItem } from '../types/virtualization';
import { buildTagTree, TagTreeNode, getTotalNoteCount } from '../utils/tagUtils';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { UNTAGGED_TAG_ID } from '../types';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';

export const LeftPaneVirtualized: React.FC = () => {
    const { app, plugin, appState, dispatch, refreshCounter, isMobile } = useAppContext();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    // Get root folders to display
    const rootFolders = useMemo(() => {
        const vault = app.vault;
        const root = vault.getRoot();
        
        // If showing root folder, return it as single item
        if (plugin.settings.showRootFolder) {
            return [root];
        }
        
        // Otherwise return children folders
        return root.children
            .filter(child => isTFolder(child))
            .sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];
    }, [app.vault, plugin.settings.showRootFolder, refreshCounter]);
    
    // Build tag tree if tags are enabled
    const { tagTree, untaggedCount } = useMemo(() => {
        if (!plugin.settings.showTags) {
            return { tagTree: new Map<string, TagTreeNode>(), untaggedCount: 0 };
        }
        
        const excludedProperties = parseExcludedProperties(plugin.settings.excludedFiles);
        const allFiles = app.vault.getMarkdownFiles()
            .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
        
        // Build tag tree from all files
        const tree = buildTagTree(allFiles, app);
        
        // Count untagged files if needed
        let untagged = 0;
        if (plugin.settings.showUntagged) {
            untagged = allFiles.filter(file => {
                const cache = app.metadataCache.getFileCache(file);
                const fileTags = cache ? getAllTags(cache) : null;
                return !fileTags || fileTags.length === 0;
            }).length;
        }
        
        return { tagTree: tree, untaggedCount: untagged };
    }, [app, plugin.settings.showTags, plugin.settings.showUntagged, 
        plugin.settings.excludedFiles, refreshCounter]);
    
    // Flatten all visible items
    const items = useMemo((): CombinedLeftPaneItem[] => {
        const allItems: CombinedLeftPaneItem[] = [];
        
        // Add folders
        const folderItems = flattenFolderTree(
            rootFolders,
            appState.expandedFolders,
            plugin.settings.ignoreFolders ? plugin.settings.ignoreFolders.split('\n').filter((p: string) => p.trim()) : []
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
                appState.expandedTags
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
        
        return allItems;
    }, [rootFolders, appState.expandedFolders, appState.expandedTags, 
        plugin.settings.ignoreFolders, plugin.settings.showTags, 
        plugin.settings.showUntagged, tagTree, untaggedCount, strings.tagList.untaggedLabel]);
    
    // Initialize virtualizer
    const rowVirtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => {
            const item = items[index];
            if (item.type === 'tag-header') return 35; // Header height
            return 32; // Folder/tag item height
        },
        overscan: 10,
    });
    
    // Handle reveal file scrolling
    useEffect(() => {
        if (appState.scrollToFolderIndex !== null) {
            rowVirtualizer.scrollToIndex(appState.scrollToFolderIndex, {
                align: 'center',
                behavior: 'auto'
            });
            dispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: null });
        }
    }, [appState.scrollToFolderIndex, rowVirtualizer, dispatch]);
    
    // Handle scroll to folder trigger
    useEffect(() => {
        if (appState.scrollToFolderTrigger > 0 && appState.selectedFolder) {
            const index = findFolderIndex(
                items.filter(item => item.type === 'folder') as any[],
                appState.selectedFolder.path
            );
            if (index >= 0) {
                // Find the actual index in the combined items array
                const actualIndex = items.findIndex(item => 
                    item.type === 'folder' && item.data.path === appState.selectedFolder?.path
                );
                if (actualIndex >= 0) {
                    rowVirtualizer.scrollToIndex(actualIndex, {
                        align: 'center',
                        behavior: 'auto'
                    });
                }
            }
        }
    }, [appState.scrollToFolderTrigger, appState.selectedFolder, items, rowVirtualizer]);
    
    // Add keyboard navigation
    useVirtualKeyboardNavigation({
        items: items,
        virtualizer: rowVirtualizer,
        focusedPane: 'folders',
        containerRef: scrollContainerRef
    });
    
    // Handle folder toggle
    const handleFolderToggle = useCallback((path: string) => {
        dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: path });
    }, [dispatch]);
    
    // Handle folder click
    const handleFolderClick = useCallback((folder: TFolder) => {
        dispatch({ type: 'SET_SELECTED_FOLDER', folder });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Focus the container
        const container = document.querySelector('.nn-split-container') as HTMLElement;
        if (container) container.focus();
        
        // Switch to files view on mobile
        if (isMobile) {
            dispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
        }
    }, [dispatch, isMobile]);
    
    // Handle tag toggle
    const handleTagToggle = useCallback((path: string) => {
        dispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: path });
    }, [dispatch]);
    
    // Handle tag click
    const handleTagClick = useCallback((tagPath: string) => {
        dispatch({ type: 'SET_SELECTED_TAG', tag: tagPath });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Focus the container
        const container = document.querySelector('.nn-split-container') as HTMLElement;
        if (container) container.focus();
        
        // Switch to files view on mobile
        if (isMobile) {
            dispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
        }
    }, [dispatch, isMobile]);
    
    // Render individual item
    const renderItem = useCallback((item: CombinedLeftPaneItem): React.ReactNode => {
        switch (item.type) {
            case 'folder':
                return (
                    <FolderItem
                        folder={item.data}
                        level={item.level}
                        isExpanded={appState.expandedFolders.has(item.data.path)}
                        isSelected={appState.selectionType === 'folder' && 
                            appState.selectedFolder?.path === item.data.path}
                        onToggle={() => handleFolderToggle(item.data.path)}
                        onClick={() => handleFolderClick(item.data)}
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
                        isExpanded={appState.expandedTags.has(tagNode.path)}
                        isSelected={appState.selectionType === 'tag' && 
                            appState.selectedTag === tagNode.path}
                        onToggle={() => handleTagToggle(tagNode.path)}
                        onClick={() => handleTagClick(tagNode.path)}
                        fileCount={item.type === 'untagged' ? untaggedCount : getTotalNoteCount(tagNode)}
                        showFileCount={plugin.settings.showFolderFileCount}
                    />
                );
            }
                
            default:
                return null;
        }
    }, [appState, handleFolderToggle, handleFolderClick, handleTagToggle, handleTagClick]);
    
    return (
        <>
            <PaneHeader type="folder" />
            <div 
                ref={scrollContainerRef}
                className="nn-left-pane-scroller"
                data-pane="folders"
            >
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                        const item = items[virtualItem.index];
                        
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
    );
};