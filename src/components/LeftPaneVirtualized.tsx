import React, { useMemo, useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TFolder, TFile, App, getAllTags, Platform, View } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { flattenFolderTree, flattenTagTree, findFolderIndex } from '../utils/treeFlattener';
import { FolderItem } from './FolderItem';
import { TagTreeItem } from './TagTreeItem';
import { PaneHeader } from './PaneHeader';
import { strings } from '../i18n';
import { isTFolder } from '../utils/typeGuards';
import type { CombinedLeftPaneItem } from '../types/virtualization';
import { buildTagTree, TagTreeNode, getTotalNoteCount } from '../utils/tagUtils';
import { parseExcludedProperties, shouldExcludeFile, parseExcludedFolders } from '../utils/fileFilters';
import { UNTAGGED_TAG_ID } from '../types';
import { useVirtualKeyboardNavigation } from '../hooks/useVirtualKeyboardNavigation';
import { scrollVirtualItemIntoView } from '../utils/virtualUtils';
import { ErrorBoundary } from './ErrorBoundary';
import { debugLog } from '../utils/debugLog';

export const LeftPaneVirtualized: React.FC = () => {
    const { app, plugin, isMobile } = useServices();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const spacerHeight = isMobile ? 40 : 25; // More space on mobile
    // Removed: lastScrolledPath - no longer needed with predictive scrolling
    
    // Track expanded folders size to detect expand/collapse actions on mobile
    // This is a critical mobile-specific optimization that solves a UX problem:
    // 
    // Problem: On mobile, we want to scroll to the selected folder when returning
    // from the file editor, but NOT when the user is just expanding/collapsing folders.
    // Both actions trigger the same currentMobileView === 'list' condition.
    // 
    // Solution: Track the size of expandedFolders. If it changes, we know the user
    // expanded/collapsed a folder and we should skip scrolling. If it stays the same,
    // we're returning from the editor and should scroll to show the selected item.
    // 
    // Desktop doesn't need this because it scrolls on selection change, not view appearance.
    const prevExpandedFoldersSize = useRef(isMobile ? expansionState.expandedFolders.size : 0);
    
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
    }, [app.vault, plugin.settings.showRootFolder]);
    
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
        plugin.settings.excludedFiles]);
    
    // Flatten all visible items
    const items = useMemo((): CombinedLeftPaneItem[] => {
        const allItems: CombinedLeftPaneItem[] = [];
        
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
        
        return allItems;
    }, [rootFolders, expansionState.expandedFolders, expansionState.expandedTags, 
        plugin.settings.ignoreFolders, plugin.settings.showTags, 
        plugin.settings.showUntagged, tagTree, untaggedCount, strings.tagList.untaggedLabel]);
    
    // Initialize virtualizer
    const rowVirtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => {
            const item = items[index];
            if (item.type === 'tag-header') return 35; // Header height
            if (item.type === 'spacer') return spacerHeight; // Bottom spacer height
            // Mobile has larger touch targets with min-height: 40px
            // Desktop uses smaller heights for denser display
            return isMobile ? 40 : 28;
        },
        overscan: 10,
    });
    
    // THIS IS THE ONLY SCROLL EFFECT - Predictive state-driven scrolling
    useLayoutEffect(() => {
        // If the state has a valid index...
        if (uiState.scrollToFolderIndex !== null && uiState.scrollToFolderIndex >= 0 && rowVirtualizer) {
            // ...then scroll to it immediately.
            rowVirtualizer.scrollToIndex(uiState.scrollToFolderIndex, {
                align: 'center',
                behavior: 'auto' // 'auto' is crucial for instant, pre-paint scrolling
            });

            // And immediately dispatch an action to reset the index in the state.
            // This prevents re-scrolling on subsequent renders.
            uiDispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: null });
        }
    }, [uiState.scrollToFolderIndex, rowVirtualizer, uiDispatch]); // This effect ONLY runs when the scroll target changes.
    
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

    // REMOVED: Complex mobile scroll logic
    // Mobile scrolling is now handled through predictive SCROLL_TO_FOLDER_INDEX actions
    
    // REMOVED: Old desktop scroll effect  
    // Desktop scrolling is now handled through predictive SCROLL_TO_FOLDER_INDEX actions
    
    // Add keyboard navigation
    const { handleKeyDown } = useVirtualKeyboardNavigation({
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
        debugLog.debug('LeftPaneVirtualized: Folder clicked', {
            folder: folder.path,
            isMobile,
            currentMobileView: uiState.currentMobileView
        });
        selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile with predictive scroll to first file
        if (isMobile) {
            uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
            // Scroll to the first file (index 0) when switching to files view
            uiDispatch({ type: 'SCROLL_TO_FILE_INDEX', index: 0 });
        }
    }, [selectionDispatch, uiDispatch, isMobile, uiState.currentMobileView]);
    
    // Handle tag toggle
    const handleTagToggle = useCallback((path: string) => {
        expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: path });
    }, [expansionDispatch]);
    
    // Handle tag click
    const handleTagClick = useCallback((tagPath: string) => {
        if (Platform.isMobile && plugin.settings.debugMobile) {
            debugLog.debug('LeftPaneVirtualized: Tag clicked', {
                tag: tagPath,
                isMobile,
                currentMobileView: uiState.currentMobileView
            });
        }
        selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagPath });
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile with predictive scroll to first file
        if (isMobile) {
            uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
            // Scroll to the first file (index 0) when switching to files view
            uiDispatch({ type: 'SCROLL_TO_FILE_INDEX', index: 0 });
        }
    }, [selectionDispatch, uiDispatch, isMobile, uiState.currentMobileView, plugin.settings.debugMobile]);
    
    // Render individual item
    const renderItem = useCallback((item: CombinedLeftPaneItem): React.ReactNode => {
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
                        showFileCount={plugin.settings.showFolderFileCount}
                    />
                );
            }
                
            case 'spacer':
                return <div style={{ height: `${spacerHeight}px` }} />; // Empty spacer
                
            default:
                return null;
        }
    }, [expansionState.expandedFolders, expansionState.expandedTags, selectionState.selectionType, selectionState.selectedFolder?.path, selectionState.selectedTag, handleFolderToggle, handleFolderClick, handleTagToggle, handleTagClick, untaggedCount, plugin.settings.showFolderFileCount, spacerHeight]);
    
    return (
        <ErrorBoundary componentName="LeftPaneVirtualized">
            <>
                <PaneHeader type="folder" />
            <div 
                ref={scrollContainerRef}
                className="nn-left-pane-scroller"
                data-pane="folders"
                role="tree"
                aria-label="Folder and tag navigation"
                onKeyDown={handleKeyDown as any}
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
};