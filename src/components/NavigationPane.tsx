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
 * OPTIMIZATIONS:
 *
 * 1. React.memo with forwardRef - Only re-renders on prop changes
 *
 * 2. Virtualization:
 *    - TanStack Virtual for rendering only visible items
 *    - Single virtualizer handles both folders and tags
 *    - Dynamic item heights with efficient measurement
 *    - Scroll position preserved during updates
 *
 * 3. Tree building optimization:
 *    - useMemo rebuilds navigation items only when structure changes
 *    - Efficient tree flattening with level tracking
 *    - Virtual folders injected at correct positions
 *    - Tag contexts (favorites/all) handled separately
 *
 * 4. Pre-computed values:
 *    - Folder counts calculated once during tree build
 *    - Tag counts from pre-built tag tree
 *    - Metadata (colors/icons) passed as props to avoid lookups
 *
 * 5. Event handling:
 *    - Vault events trigger selective rebuilds
 *    - Expansion state managed efficiently with Sets
 *    - Keyboard navigation with minimal re-renders
 *
 * 6. Search optimization:
 *    - Search filtering at tree build time
 *    - Automatic expansion of search results
 *    - Minimal impact on non-search performance
 *
 * 7. Stable callbacks:
 *    - All event handlers memoized
 *    - Props passed to child components are stable
 *    - Prevents unnecessary child re-renders
 */

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo, useState } from 'react';
import { TFolder, TFile, Platform, Menu } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useCommandQueue } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useNavigationPaneKeyboard } from '../hooks/useNavigationPaneKeyboard';
import { useNavigationPaneData } from '../hooks/useNavigationPaneData';
import { useNavigationPaneScroll } from '../hooks/useNavigationPaneScroll';
import type { CombinedNavigationItem } from '../types/virtualization';
import { NavigationPaneItemType, ItemType } from '../types';
import { getSelectedPath } from '../utils/selectionUtils';
import { TagTreeNode } from '../types/storage';
import { getFolderNote } from '../utils/folderNotes';
import { findTagNode, getTotalNoteCount } from '../utils/tagTree';
import { shouldExcludeFolder, shouldExcludeFile } from '../utils/fileFilters';
import { shouldDisplayFile } from '../utils/fileTypeUtils';
import { FolderItem } from './FolderItem';
import { NavigationPaneHeader } from './NavigationPaneHeader';
import { NavigationToolbar } from './NavigationToolbar';
import { TagTreeItem } from './TagTreeItem';
import { VirtualFolderComponent } from './VirtualFolderItem';
import { getNavigationIndex, normalizeNavigationPath } from '../utils/navigationIndex';
import { useShortcuts } from '../context/ShortcutsContext';
import { ShortcutItem } from './ShortcutItem';
import { ShortcutType, SearchShortcut } from '../types/shortcuts';
import { ObsidianIcon } from './ObsidianIcon';
import { strings } from '../i18n';

export interface NavigationPaneHandle {
    getIndexOfPath: (itemType: ItemType, path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
    requestScroll: (path: string, options: { align?: 'auto' | 'center' | 'start' | 'end'; itemType: ItemType }) => void;
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
    onExecuteSearchShortcut?: (shortcutKey: string, searchShortcut: SearchShortcut) => Promise<void> | void;
}

export const NavigationPane = React.memo(
    forwardRef<NavigationPaneHandle, NavigationPaneProps>(function NavigationPane(props, ref) {
        const { app, isMobile } = useServices();
        const { onExecuteSearchShortcut, rootContainerRef } = props;
        const commandQueue = useCommandQueue();
        const expansionState = useExpansionState();
        const expansionDispatch = useExpansionDispatch();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();
        const { shortcutMap, removeShortcut } = useShortcuts();
        const [activeShortcutKey, setActiveShortcut] = useState<string | null>(null);

        // Android uses toolbar at top, iOS at bottom
        const isAndroid = Platform.isAndroidApp;
        // Track previous settings for smart auto-expand
        const prevShowFavoritesFolder = useRef(settings.showFavoriteTagsFolder);
        const prevShowAllTagsFolder = useRef(settings.showAllTagsFolder);
        const prevFavoritesCount = useRef(settings.favoriteTags.length);

        // Determine if navigation pane is visible early for optimization
        const isVisible = uiState.dualPane || uiState.currentSinglePaneView === 'navigation';

        // Get tag data from the context
        const { fileData } = useFileCache();
        const favoriteTree = fileData.favoriteTree;
        const tagTree = fileData.tagTree;

        // Use the new data hook - now returns filtered items and pathToIndex
        const { items, pathToIndex, shortcutIndex, tagCounts, folderCounts } = useNavigationPaneData({
            settings,
            isVisible
        });

        // Use the new scroll hook
        const { rowVirtualizer, scrollContainerRef, requestScroll } = useNavigationPaneScroll({
            items,
            pathToIndex,
            isVisible,
            activeShortcutKey
        });

        // Callback for after expand/collapse operations
        const handleTreeUpdateComplete = useCallback(() => {
            const selectedPath = getSelectedPath(selectionState);
            if (selectedPath) {
                const itemType = selectionState.selectionType === ItemType.TAG ? ItemType.TAG : ItemType.FOLDER;
                const normalizedPath = normalizeNavigationPath(itemType, selectedPath);
                requestScroll(normalizedPath, { align: 'auto', itemType });
            }
        }, [selectionState, requestScroll]);

        // Handle folder toggle
        const handleFolderToggle = useCallback(
            (path: string) => {
                expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: path });
            },
            [expansionDispatch]
        );

        // Handle folder click
        const handleFolderClick = useCallback(
            (folder: TFolder, options?: { fromShortcut?: boolean }) => {
                if (!options?.fromShortcut) {
                    setActiveShortcut(null);
                }

                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

                // Auto-expand/collapse if enabled and folder has children
                if (settings.autoExpandFoldersTags && folder.children.some(child => child instanceof TFolder)) {
                    // Toggle expansion state - expand if collapsed, collapse if expanded
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                }

                // Switch to files view in single pane mode
                if (uiState.singlePane) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                } else {
                    // In dual-pane mode, keep focus on folders for direct interactions
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                }
            },
            [selectionDispatch, uiDispatch, uiState.singlePane, settings.autoExpandFoldersTags, expansionDispatch, setActiveShortcut]
        );

        // Handle folder name click (for folder notes)
        const handleFolderNameClick = useCallback(
            (folder: TFolder) => {
                // Check if we should open a folder note instead
                if (settings.enableFolderNotes) {
                    const folderNote = getFolderNote(folder, settings);

                    if (folderNote) {
                        // Set folder as selected without auto-selecting first file
                        selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder, autoSelectedFile: null });

                        commandQueue.executeOpenFolderNote(folder.path, async () => {
                            await app.workspace.getLeaf().openFile(folderNote);
                        });

                        return;
                    }
                }

                // If no folder note, fall back to normal folder click behavior
                handleFolderClick(folder);
            },
            [settings, app, selectionDispatch, handleFolderClick, commandQueue]
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

        // Get all descendant folders recursively
        const getAllDescendantFolders = useCallback((folder: TFolder): string[] => {
            const descendants: string[] = [];

            const collectDescendants = (currentFolder: TFolder) => {
                currentFolder.children.forEach(child => {
                    if (child instanceof TFolder) {
                        descendants.push(child.path);
                        collectDescendants(child);
                    }
                });
            };

            collectDescendants(folder);
            return descendants;
        }, []);

        // Get all descendant tags recursively
        const getAllDescendantTags = useCallback(
            (tagPath: string, context?: 'favorites' | 'tags'): string[] => {
                const descendants: string[] = [];
                // Use the appropriate tree based on context
                const searchTree = context === 'favorites' ? favoriteTree : tagTree;
                const tagNode = searchTree.get(tagPath);

                if (!tagNode) return descendants;

                const collectDescendants = (node: TagTreeNode) => {
                    node.children.forEach(child => {
                        descendants.push(child.path);
                        collectDescendants(child);
                    });
                };

                collectDescendants(tagNode);
                return descendants;
            },
            [tagTree, favoriteTree]
        );

        // Handle tag click
        const handleTagClick = useCallback(
            (tagPath: string, context?: 'favorites' | 'tags', options?: { fromShortcut?: boolean }) => {
                // Check if clicking the same tag with same context
                const isSameTag =
                    selectionState.selectionType === 'tag' &&
                    selectionState.selectedTag === tagPath &&
                    selectionState.selectedTagContext === context;

                // If clicking the same tag, just handle view switching
                if (isSameTag) {
                    if (uiState.singlePane) {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    } else if (options?.fromShortcut) {
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    } else {
                        // In dual-pane mode, still need to set focus
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    }

                    if (options?.fromShortcut) {
                        selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                    }
                    return;
                }

                if (!options?.fromShortcut) {
                    setActiveShortcut(null);
                }

                selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagPath, context });

                // Auto-expand/collapse if enabled and tag has children
                if (settings.autoExpandFoldersTags) {
                    // Find the tag node to check if it has children
                    const tagNode = Array.from(tagTree.values()).find(node => node.path === tagPath);
                    if (tagNode && tagNode.children.size > 0) {
                        // Toggle expansion state - expand if collapsed, collapse if expanded
                        expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath });
                    }
                }

                // Switch to files view in single pane mode
                if (uiState.singlePane) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    // Set focus to files pane when switching
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                } else if (options?.fromShortcut) {
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                } else {
                    // In dual-pane mode, keep focus on folders
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                }

                if (options?.fromShortcut) {
                    selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                }
            },
            [
                selectionDispatch,
                uiDispatch,
                uiState.singlePane,
                settings.autoExpandFoldersTags,
                tagTree,
                expansionDispatch,
                selectionState.selectedTag,
                selectionState.selectedTagContext,
                selectionState.selectionType,
                setActiveShortcut
            ]
        );

        // Scrolls a shortcut into view when activated
        const scrollShortcutIntoView = useCallback(
            (shortcutKey: string) => {
                const index = shortcutIndex.get(shortcutKey);
                if (index !== undefined) {
                    rowVirtualizer.scrollToIndex(index, { align: 'auto' });
                }
            },
            [shortcutIndex, rowVirtualizer]
        );

        // Clears active shortcut after two animation frames to allow visual feedback
        const scheduleShortcutRelease = useCallback(() => {
            const release = () => setActiveShortcut(null);

            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    requestAnimationFrame(release);
                });
                return;
            }

            setTimeout(release, 0);
        }, [setActiveShortcut]);

        // Handles folder shortcut activation - navigates to folder and provides visual feedback
        const handleShortcutFolderActivate = useCallback(
            (folder: TFolder, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                handleFolderClick(folder, { fromShortcut: true });
                scrollShortcutIntoView(shortcutKey);
                scheduleShortcutRelease();
                const container = rootContainerRef.current;
                if (container && !uiState.singlePane) {
                    container.focus();
                }
            },
            [setActiveShortcut, handleFolderClick, scrollShortcutIntoView, scheduleShortcutRelease, rootContainerRef, uiState.singlePane]
        );

        // Handles note shortcut activation - reveals file in list pane
        const handleShortcutNoteActivate = useCallback(
            (note: TFile, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                selectionDispatch({ type: 'REVEAL_FILE', file: note, isManualReveal: true, source: 'shortcut' });
                scrollShortcutIntoView(shortcutKey);
                scheduleShortcutRelease();
                if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation') {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                }
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    void leaf.openFile(note, { active: false });
                }
                if (isMobile && app.workspace.leftSplit) {
                    app.workspace.leftSplit.collapse();
                }
            },
            [
                setActiveShortcut,
                selectionDispatch,
                scrollShortcutIntoView,
                scheduleShortcutRelease,
                uiDispatch,
                uiState.singlePane,
                uiState.currentSinglePaneView,
                app.workspace,
                isMobile
            ]
        );

        // Handles search shortcut activation - executes saved search query
        const handleShortcutSearchActivate = useCallback(
            (shortcutKey: string, searchShortcut: SearchShortcut) => {
                setActiveShortcut(shortcutKey);
                scrollShortcutIntoView(shortcutKey);
                if (onExecuteSearchShortcut) {
                    void onExecuteSearchShortcut(shortcutKey, searchShortcut);
                }
                scheduleShortcutRelease();
            },
            [setActiveShortcut, scrollShortcutIntoView, onExecuteSearchShortcut, scheduleShortcutRelease]
        );

        // Handles tag shortcut activation - navigates to tag and shows its files
        const handleShortcutTagActivate = useCallback(
            (tagPath: string, shortcutKey: string, context?: 'favorites' | 'tags') => {
                setActiveShortcut(shortcutKey);
                handleTagClick(tagPath, context, { fromShortcut: true });
                scrollShortcutIntoView(shortcutKey);
                scheduleShortcutRelease();
            },
            [setActiveShortcut, handleTagClick, scrollShortcutIntoView, scheduleShortcutRelease]
        );

        const handleShortcutContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, shortcutKey: string) => {
                event.preventDefault();
                event.stopPropagation();

                const menu = new Menu();
                menu.addItem(item => {
                    item.setTitle(strings.shortcuts.remove)
                        .setIcon('lucide-star-off')
                        .onClick(() => {
                            void removeShortcut(shortcutKey);
                        });
                });
                menu.showAtMouseEvent(event.nativeEvent);
            },
            [removeShortcut]
        );

        const getFolderShortcutCount = useCallback(
            (folder: TFolder): number => {
                if (!settings.showNoteCount) {
                    return 0;
                }

                const precomputed = folderCounts.get(folder.path);
                if (typeof precomputed === 'number') {
                    return precomputed;
                }

                const countFiles = (currentFolder: TFolder): number => {
                    let total = 0;
                    for (const child of currentFolder.children) {
                        if (child instanceof TFile) {
                            if (shouldDisplayFile(child, settings.fileVisibility, app)) {
                                if (!shouldExcludeFile(child, settings.excludedFiles, app)) {
                                    total++;
                                }
                            }
                        } else if (child instanceof TFolder) {
                            if (!settings.includeDescendantNotes) {
                                continue;
                            }
                            if (settings.showHiddenItems || !shouldExcludeFolder(child.name, settings.excludedFolders, child.path)) {
                                total += countFiles(child);
                            }
                        }
                    }
                    return total;
                };

                return countFiles(folder);
            },
            [
                app,
                folderCounts,
                settings.showNoteCount,
                settings.fileVisibility,
                settings.excludedFiles,
                settings.includeDescendantNotes,
                settings.showHiddenItems,
                settings.excludedFolders
            ]
        );

        const getTagShortcutCount = useCallback(
            (tagPath: string): number => {
                if (!settings.showNoteCount) {
                    return 0;
                }

                const precomputed = tagCounts.get(tagPath);
                if (typeof precomputed === 'number') {
                    return precomputed;
                }

                const tagNode = favoriteTree.get(tagPath) ?? tagTree.get(tagPath);
                if (!tagNode) {
                    return 0;
                }

                return settings.includeDescendantNotes ? getTotalNoteCount(tagNode) : tagNode.notesWithTag.size;
            },
            [settings.showNoteCount, settings.includeDescendantNotes, tagCounts, favoriteTree, tagTree]
        );

        useEffect(() => {
            if (!activeShortcutKey) {
                return;
            }

            const shortcut = shortcutMap.get(activeShortcutKey);
            if (!shortcut) {
                setActiveShortcut(null);
                return;
            }

            if (shortcut.type === ShortcutType.FOLDER) {
                const selectedPath = selectionState.selectedFolder?.path;
                if (!selectedPath || selectedPath !== shortcut.path) {
                    setActiveShortcut(null);
                }
                return;
            }

            if (shortcut.type === ShortcutType.NOTE) {
                const selectedPath = selectionState.selectedFile?.path;
                if (!selectedPath || selectedPath !== shortcut.path) {
                    setActiveShortcut(null);
                }
                return;
            }

            if (shortcut.type === ShortcutType.TAG) {
                const selectedTag = selectionState.selectedTag;
                if (!selectedTag || selectedTag !== shortcut.tagPath) {
                    setActiveShortcut(null);
                }
            }
        }, [
            activeShortcutKey,
            shortcutMap,
            selectionState.selectedFolder,
            selectionState.selectedFile,
            selectionState.selectedTag,
            setActiveShortcut
        ]);

        // Render individual item
        const renderItem = useCallback(
            (item: CombinedNavigationItem): React.ReactNode => {
                switch (item.type) {
                    case NavigationPaneItemType.SHORTCUT_HEADER:
                        return (
                            <div
                                className="nn-navitem nn-shortcut-header-item"
                                style={{ '--level': item.level } as React.CSSProperties}
                                data-level={item.level}
                                role="treeitem"
                                tabIndex={-1}
                                aria-level={item.level + 1}
                            >
                                <div className="nn-navitem-content">
                                    <span className="nn-navitem-icon">
                                        <ObsidianIcon name="lucide-star" />
                                    </span>
                                    <span className="nn-navitem-name">{strings.navigationPane.shortcutsHeader}</span>
                                    <span className="nn-navitem-spacer" />
                                </div>
                            </div>
                        );

                    case NavigationPaneItemType.SHORTCUT_FOLDER: {
                        const folder = item.folder;
                        if (!folder) {
                            return null;
                        }

                        const folderCount = getFolderShortcutCount(folder);

                        return (
                            <ShortcutItem
                                icon={item.icon ?? 'lucide-folder'}
                                label={folder.name}
                                level={item.level}
                                type="folder"
                                count={folderCount}
                                isExcluded={item.isExcluded}
                                onClick={() => handleShortcutFolderActivate(folder, item.key)}
                                onContextMenu={event => handleShortcutContextMenu(event, item.key)}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_NOTE: {
                        const note = item.note;
                        if (!note) {
                            return null;
                        }

                        return (
                            <ShortcutItem
                                icon="lucide-file-text"
                                label={note.basename}
                                level={item.level}
                                type="note"
                                onClick={() => handleShortcutNoteActivate(note, item.key)}
                                onContextMenu={event => handleShortcutContextMenu(event, item.key)}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_SEARCH: {
                        const searchShortcut = item.searchShortcut;

                        return (
                            <ShortcutItem
                                icon="lucide-search"
                                label={searchShortcut.name}
                                level={item.level}
                                type="search"
                                onClick={() => handleShortcutSearchActivate(item.key, searchShortcut)}
                                onContextMenu={event => handleShortcutContextMenu(event, item.key)}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_TAG: {
                        const tagCount = getTagShortcutCount(item.tagPath);
                        return (
                            <ShortcutItem
                                icon={item.icon ?? 'lucide-tags'}
                                label={item.displayName}
                                level={item.level}
                                type="tag"
                                count={tagCount}
                                onClick={() => handleShortcutTagActivate(item.tagPath, item.key, item.context)}
                                onContextMenu={event => handleShortcutContextMenu(event, item.key)}
                            />
                        );
                    }

                    case NavigationPaneItemType.FOLDER: {
                        const folderPath = item.data.path;

                        return (
                            <FolderItem
                                folder={item.data}
                                level={item.level}
                                isExpanded={expansionState.expandedFolders.has(item.data.path)}
                                isSelected={
                                    selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder?.path === folderPath
                                }
                                isExcluded={item.isExcluded}
                                onToggle={() => handleFolderToggle(item.data.path)}
                                onClick={() => handleFolderClick(item.data)}
                                onNameClick={() => handleFolderNameClick(item.data)}
                                onToggleAllSiblings={() => {
                                    const isCurrentlyExpanded = expansionState.expandedFolders.has(item.data.path);

                                    if (isCurrentlyExpanded) {
                                        // If expanded, collapse everything (parent and all descendants)
                                        handleFolderToggle(item.data.path);
                                        const descendantPaths = getAllDescendantFolders(item.data);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_FOLDERS', descendantPaths, expand: false });
                                        }
                                    } else {
                                        // If collapsed, expand parent and all descendants
                                        handleFolderToggle(item.data.path);
                                        const descendantPaths = getAllDescendantFolders(item.data);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_FOLDERS', descendantPaths, expand: true });
                                        }
                                    }
                                }}
                                icon={item.icon}
                                color={item.color}
                                backgroundColor={item.backgroundColor}
                                fileCount={folderCounts.get(item.data.path)}
                                excludedFolders={item.parsedExcludedFolders || []}
                            />
                        );
                    }

                    case NavigationPaneItemType.VIRTUAL_FOLDER: {
                        const virtualFolder = item.data;
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
                        const tagNode = item.data;
                        return (
                            <TagTreeItem
                                tagNode={tagNode}
                                level={item.level ?? 0}
                                isExpanded={expansionState.expandedTags.has(tagNode.path)}
                                isSelected={
                                    selectionState.selectionType === ItemType.TAG &&
                                    selectionState.selectedTag === tagNode.path &&
                                    selectionState.selectedTagContext === item.context
                                }
                                isHidden={'isHidden' in item ? item.isHidden : false}
                                onToggle={() => handleTagToggle(tagNode.path)}
                                onClick={() => handleTagClick(tagNode.path, item.context)}
                                context={'context' in item ? item.context : undefined}
                                color={item.color}
                                backgroundColor={item.backgroundColor}
                                icon={item.icon}
                                onToggleAllSiblings={() => {
                                    const isCurrentlyExpanded = expansionState.expandedTags.has(tagNode.path);

                                    if (isCurrentlyExpanded) {
                                        // If expanded, collapse everything (parent and all descendants)
                                        handleTagToggle(tagNode.path);
                                        const descendantPaths = getAllDescendantTags(tagNode.path, item.context);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_TAGS', descendantPaths, expand: false });
                                        }
                                    } else {
                                        // If collapsed, expand parent and all descendants
                                        handleTagToggle(tagNode.path);
                                        const descendantPaths = getAllDescendantTags(tagNode.path, item.context);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_TAGS', descendantPaths, expand: true });
                                        }
                                    }
                                }}
                                fileCount={tagCounts.get(tagNode.path) || 0}
                                showFileCount={settings.showNoteCount}
                            />
                        );
                    }

                    case NavigationPaneItemType.TOP_SPACER: {
                        return <div className="nn-nav-top-spacer" />;
                    }

                    case NavigationPaneItemType.BOTTOM_SPACER: {
                        return <div className="nn-nav-bottom-spacer" />;
                    }

                    case NavigationPaneItemType.LIST_SPACER: {
                        return <div className="nn-nav-list-spacer" />;
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
                selectionState.selectedTagContext,
                handleFolderToggle,
                handleFolderClick,
                handleFolderNameClick,
                handleTagToggle,
                handleTagClick,
                handleVirtualFolderToggle,
                getAllDescendantFolders,
                getAllDescendantTags,
                expansionDispatch,
                settings,
                folderCounts,
                tagCounts,
                getFolderShortcutCount,
                getTagShortcutCount,
                handleShortcutFolderActivate,
                handleShortcutNoteActivate,
                handleShortcutSearchActivate,
                handleShortcutTagActivate,
                handleShortcutContextMenu
            ]
        );

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

        // Update tag context when favorite tags change
        // Memoize the expected context to avoid redundant calculations
        const expectedTagContext = useMemo(() => {
            if (selectionState.selectionType !== 'tag' || !selectionState.selectedTag) {
                return null;
            }

            // Check if tag exists in favorites
            const tagInFavorites = findTagNode(favoriteTree, selectionState.selectedTag) !== null;
            return tagInFavorites ? 'favorites' : 'tags';
        }, [selectionState.selectionType, selectionState.selectedTag, favoriteTree]);

        useEffect(() => {
            // Only update if there's a mismatch
            if (expectedTagContext && selectionState.selectedTagContext !== expectedTagContext && selectionState.selectedTag) {
                selectionDispatch({
                    type: 'SET_SELECTED_TAG',
                    tag: selectionState.selectedTag,
                    context: expectedTagContext,
                    autoSelectedFile: selectionState.selectedFile
                });
            }
        }, [
            expectedTagContext,
            selectionState.selectedTagContext,
            selectionState.selectedTag,
            selectionState.selectedFile,
            selectionDispatch
        ]);

        // Expose the virtualizer instance, path lookup method, and scroll container via the ref
        useImperativeHandle(
            ref,
            () => ({
                getIndexOfPath: (itemType: ItemType, path: string) => {
                    const index = getNavigationIndex(pathToIndex, itemType, path);
                    return index ?? -1;
                },
                virtualizer: rowVirtualizer,
                scrollContainerRef: scrollContainerRef.current,
                requestScroll
            }),
            [pathToIndex, rowVirtualizer, requestScroll, scrollContainerRef]
        );

        // Add keyboard navigation
        // Note: We pass the root container ref, not the scroll container ref.
        // This ensures keyboard events work across the entire navigator, allowing
        // users to navigate between panes (navigation <-> files) with Tab/Arrow keys.
        useNavigationPaneKeyboard({
            items,
            virtualizer: rowVirtualizer,
            containerRef: props.rootContainerRef,
            pathToIndex
        });

        return (
            <div className="nn-navigation-pane" style={props.style}>
                <NavigationPaneHeader onTreeUpdateComplete={handleTreeUpdateComplete} />
                {/* Android - toolbar at top */}
                {isMobile && isAndroid && <NavigationToolbar onTreeUpdateComplete={handleTreeUpdateComplete} />}
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
                {/* iOS - toolbar at bottom */}
                {isMobile && !isAndroid && <NavigationToolbar onTreeUpdateComplete={handleTreeUpdateComplete} />}
            </div>
        );
    })
);
