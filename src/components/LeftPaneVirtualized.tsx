import React, { useMemo, useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TFolder, TFile, App, getAllTags, Platform } from 'obsidian';
import { useAppContext } from '../context/AppContext';
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
    const { app, plugin, appState, dispatch, refreshCounter, isMobile } = useAppContext();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const spacerHeight = isMobile ? 40 : 25; // More space on mobile
    const lastScrolledPath = useRef<string | null>(null);
    
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
    const prevExpandedFoldersSize = useRef(isMobile ? appState.expandedFolders.size : 0);
    
    // Log component mount/unmount only if debug is enabled
    useEffect(() => {
        if (Platform.isMobile && plugin.settings.debugMobile) {
            debugLog.info('LeftPaneVirtualized: Mounted', {
                isMobile,
                selectedFolder: appState.selectedFolder?.path,
                selectedTag: appState.selectedTag,
                expandedFoldersCount: appState.expandedFolders.size,
                expandedTagsCount: appState.expandedTags.size
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
        
        // Add spacer at the end for better visibility
        allItems.push({
            type: 'spacer',
            key: 'bottom-spacer'
        });
        
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
            if (item.type === 'spacer') return spacerHeight; // Bottom spacer height
            // Mobile has larger touch targets with min-height: 40px
            // Desktop uses smaller heights for denser display
            return isMobile ? 40 : 28;
        },
        overscan: 10,
    });
    
    // Handle reveal file scrolling
    useEffect(() => {
        if (appState.scrollToFolderIndex !== null && rowVirtualizer) {
            const cleanup = scrollVirtualItemIntoView(
                rowVirtualizer, 
                appState.scrollToFolderIndex,
                'auto',
                3,
                false,
                isMobile ? 'center' : 'auto'
            );
            // Delay clearing the index to ensure scroll completes
            const timeoutId = setTimeout(() => {
                dispatch({ type: 'SCROLL_TO_FOLDER_INDEX', index: null });
            }, 50);
            return () => {
                cleanup();
                clearTimeout(timeoutId);
            };
        }
    }, [appState.scrollToFolderIndex, rowVirtualizer, dispatch, isMobile]);
    
    
    // Mobile: Initial scroll position
    // This effect runs once when virtualizer is ready to ensure correct initial position
    // 
    // Mobile needs this separate initial scroll because:
    // - The virtualizer might not be ready when the component first mounts
    // - We need to ensure the selected item is visible immediately when opening the app
    // - This only runs once on mount (dependency on just rowVirtualizer)
    // 
    // Desktop handles this differently through selection change effects
    useLayoutEffect(() => {
        if (!isMobile || !rowVirtualizer || !scrollContainerRef.current) {
            return;
        }
        
        // Only scroll on mount when list view is active
        if (appState.currentMobileView !== 'list') {
            return;
        }
        
        let actualIndex = -1;
        
        if (appState.selectionType === 'folder' && appState.selectedFolder) {
            actualIndex = items.findIndex(item => 
                item.type === 'folder' && item.data.path === appState.selectedFolder?.path
            );
        } else if (appState.selectionType === 'tag' && appState.selectedTag) {
            actualIndex = items.findIndex(item => {
                if (item.type === 'tag' || item.type === 'untagged') {
                    const tagNode = item.data as TagTreeNode;
                    return tagNode.path === appState.selectedTag;
                }
                return false;
            });
        }
        
        if (actualIndex >= 0) {
            if (Platform.isMobile && plugin.settings.debugMobile) {
                debugLog.info('LeftPaneVirtualized: Initial scroll on mount', {
                    index: actualIndex,
                    path: appState.selectedFolder?.path || appState.selectedTag
                });
            }
            // Use queueMicrotask to ensure this runs before any paint
            queueMicrotask(() => {
                if (rowVirtualizer && scrollContainerRef.current) {
                    rowVirtualizer.scrollToIndex(actualIndex, {
                        align: 'center',
                        behavior: 'auto'
                    });
                }
            });
        }
    }, [rowVirtualizer, isMobile, plugin.settings.debugMobile]); // Only depend on virtualizer being ready
    
    // Mobile: Scroll when returning to list view
    // This is the main mobile scroll handler that ensures the selected folder/tag
    // is visible when the user returns from viewing files or editing a note.
    // 
    // The key challenge: We need to scroll when returning from the editor, but NOT
    // when the user is just browsing (expanding/collapsing folders). Both scenarios
    // have currentMobileView === 'list', so we use the expandedFolders size trick.
    useLayoutEffect(() => {
        if (!isMobile || appState.currentMobileView !== 'list') {
            return;
        }
        
        // Skip scroll if we're just expanding/collapsing folders (mobile only)
        // This is the heart of the mobile scroll logic:
        // 1. User expands folder → expandedFolders.size changes → skip scroll
        // 2. User returns from editor → expandedFolders.size unchanged → scroll to selected
        // 
        // This creates the ideal UX where:
        // - Expanding folders doesn't jump around
        // - Returning from editor shows your current location
        if (isMobile) {
            const expandedSizeChanged = prevExpandedFoldersSize.current !== appState.expandedFolders.size;
            prevExpandedFoldersSize.current = appState.expandedFolders.size;
            
            if (expandedSizeChanged) {
                // User just expanded/collapsed a folder - don't scroll
                return;
            }
            // Size didn't change - we're returning from edit view, proceed with scroll
        }
        
        if (!scrollContainerRef.current || !rowVirtualizer) {
            return;
        }
        
        let actualIndex = -1;
        
        if (appState.selectionType === 'folder' && appState.selectedFolder) {
            actualIndex = items.findIndex(item => 
                item.type === 'folder' && item.data.path === appState.selectedFolder?.path
            );
        } else if (appState.selectionType === 'tag' && appState.selectedTag) {
            actualIndex = items.findIndex(item => {
                if (item.type === 'tag' || item.type === 'untagged') {
                    const tagNode = item.data as TagTreeNode;
                    return tagNode.path === appState.selectedTag;
                }
                return false;
            });
        }
        
        if (actualIndex >= 0) {
            // Scroll immediately
            rowVirtualizer.scrollToIndex(actualIndex, {
                align: 'center',
                behavior: 'auto'
            });
        }
    }, [isMobile, appState.currentMobileView, appState.selectedFolder?.path, appState.selectedTag, appState.selectionType, rowVirtualizer, items]);
    
    // Desktop: Scroll when selection changes
    // Desktop has a simpler model than mobile:
    // - Scroll whenever the selected folder/tag changes
    // - Use lastScrolledPath to prevent duplicate scrolls
    // - No need to worry about view states or expand/collapse
    // 
    // This creates the desktop experience where:
    // - Clicking a folder scrolls it into view if needed
    // - The scroll is immediate and direct
    // - No complex state tracking required
    useEffect(() => {
        if (isMobile || !scrollContainerRef.current || !rowVirtualizer) {
            return;
        }
        
        let actualIndex = -1;
        let currentPath: string | null = null;
        
        if (appState.selectionType === 'folder' && appState.selectedFolder) {
            currentPath = appState.selectedFolder.path;
            
            // Only scroll if path changed
            if (lastScrolledPath.current !== currentPath) {
                actualIndex = items.findIndex(item => 
                    item.type === 'folder' && item.data.path === appState.selectedFolder?.path
                );
            }
        } else if (appState.selectionType === 'tag' && appState.selectedTag) {
            currentPath = appState.selectedTag;
            
            // Only scroll if path changed
            if (lastScrolledPath.current !== currentPath) {
                actualIndex = items.findIndex(item => {
                    if (item.type === 'tag' || item.type === 'untagged') {
                        const tagNode = item.data as TagTreeNode;
                        return tagNode.path === appState.selectedTag;
                    }
                    return false;
                });
            }
        }
        
        if (actualIndex >= 0 && currentPath) {
            lastScrolledPath.current = currentPath;
            
            // Scroll immediately for desktop
            rowVirtualizer.scrollToIndex(actualIndex, {
                align: 'auto',
                behavior: 'auto'
            });
        }
    }, [isMobile, appState.selectedFolder?.path, appState.selectedTag, appState.selectionType, rowVirtualizer, items]);
    
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
        debugLog.debug('LeftPaneVirtualized: Folder clicked', {
            folder: folder.path,
            isMobile,
            currentMobileView: appState.currentMobileView
        });
        dispatch({ type: 'SET_SELECTED_FOLDER', folder });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile
        if (isMobile) {
            dispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
        }
    }, [dispatch, isMobile, appState.currentMobileView]);
    
    // Handle tag toggle
    const handleTagToggle = useCallback((path: string) => {
        dispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: path });
    }, [dispatch]);
    
    // Handle tag click
    const handleTagClick = useCallback((tagPath: string) => {
        if (Platform.isMobile && plugin.settings.debugMobile) {
            debugLog.debug('LeftPaneVirtualized: Tag clicked', {
                tag: tagPath,
                isMobile,
                currentMobileView: appState.currentMobileView
            });
        }
        dispatch({ type: 'SET_SELECTED_TAG', tag: tagPath });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
        
        // Switch to files view on mobile
        if (isMobile) {
            dispatch({ type: 'SET_MOBILE_VIEW', view: 'files' });
        }
    }, [dispatch, isMobile, appState.currentMobileView]);
    
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
                
            case 'spacer':
                return <div style={{ height: `${spacerHeight}px` }} />; // Empty spacer
                
            default:
                return null;
        }
    }, [appState.expandedFolders, appState.expandedTags, appState.selectionType, appState.selectedFolder?.path, appState.selectedTag, handleFolderToggle, handleFolderClick, handleTagToggle, handleTagClick, untaggedCount, plugin.settings.showFolderFileCount, spacerHeight]);
    
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