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

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo, useState, useReducer } from 'react';
import { TFolder, TFile, Platform, Menu } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useCommandQueue, useFileSystemOps, useMetadataService, useTagOperations } from '../context/ServicesContext';
import { useRecentData } from '../context/RecentDataContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useNavigationPaneKeyboard } from '../hooks/useNavigationPaneKeyboard';
import { useNavigationPaneData } from '../hooks/useNavigationPaneData';
import { useNavigationPaneScroll } from '../hooks/useNavigationPaneScroll';
import { useListReorder, type ListReorderHandlers } from '../hooks/useListReorder';
import type { CombinedNavigationItem } from '../types/virtualization';
import { NavigationPaneItemType, ItemType } from '../types';
import { getSelectedPath } from '../utils/selectionUtils';
import { TagTreeNode } from '../types/storage';
import { getFolderNote } from '../utils/folderNotes';
import { findTagNode, getTotalNoteCount } from '../utils/tagTree';
import { shouldExcludeFolder, shouldExcludeFile } from '../utils/fileFilters';
import { shouldDisplayFile, getExtensionSuffix, shouldShowExtensionSuffix } from '../utils/fileTypeUtils';
import { FolderItem } from './FolderItem';
import { NavigationPaneHeader } from './NavigationPaneHeader';
import { NavigationToolbar } from './NavigationToolbar';
import { TagTreeItem } from './TagTreeItem';
import { VirtualFolderComponent } from './VirtualFolderItem';
import { getNavigationIndex, normalizeNavigationPath } from '../utils/navigationIndex';
import { STORAGE_KEYS, SHORTCUTS_VIRTUAL_FOLDER_ID, RECENT_NOTES_VIRTUAL_FOLDER_ID } from '../types';
import { localStorage } from '../utils/localStorage';
import { useShortcuts } from '../context/ShortcutsContext';
import { ShortcutItem } from './ShortcutItem';
import { RootFolderReorderItem } from './RootFolderReorderItem';
import { ShortcutType, SearchShortcut, SHORTCUT_DRAG_MIME } from '../types/shortcuts';
import { strings } from '../i18n';
import { createDragGhostManager, type DragGhostOptions } from '../utils/dragGhost';
import { NavigationBanner } from './NavigationBanner';
import {
    buildFolderMenu,
    buildFileMenu,
    buildTagMenu,
    type MenuServices,
    type MenuState,
    type MenuDispatchers
} from '../utils/contextMenu';

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
    onNavigateToFolder: (folderPath: string) => void;
    onRevealTag: (tagPath: string) => void;
    onRevealFile: (file: TFile) => void;
    onRevealShortcutFile?: (file: TFile) => void;
}

type RootFolderDescriptor = {
    key: string;
    folder: TFolder;
    isVault?: boolean;
};

export const NavigationPane = React.memo(
    forwardRef<NavigationPaneHandle, NavigationPaneProps>(function NavigationPane(props, ref) {
        const { app, isMobile, plugin, tagTreeService } = useServices();
        const { recentNotes } = useRecentData();
        const { onExecuteSearchShortcut, rootContainerRef, onNavigateToFolder, onRevealTag, onRevealFile, onRevealShortcutFile } = props;
        const commandQueue = useCommandQueue();
        const fileSystemOps = useFileSystemOps();
        const metadataService = useMetadataService();
        const tagOperations = useTagOperations();
        const expansionState = useExpansionState();
        const expansionDispatch = useExpansionDispatch();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const updateSettings = useSettingsUpdate();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();
        const shortcuts = useShortcuts();
        const { shortcutMap, removeShortcut, hydratedShortcuts, reorderShortcuts, addFolderShortcut, addNoteShortcut } = shortcuts;
        const { fileData, getFileDisplayName, getFavoriteTree, findTagInFavoriteTree } = useFileCache();
        const dragGhostManager = useMemo(() => createDragGhostManager(app), [app]);

        const menuServices = useMemo<MenuServices>(
            () => ({
                app,
                plugin,
                isMobile,
                fileSystemOps,
                metadataService,
                tagOperations,
                tagTreeService,
                commandQueue,
                getFavoriteTree,
                findTagInFavoriteTree,
                shortcuts
            }),
            [
                app,
                plugin,
                isMobile,
                fileSystemOps,
                metadataService,
                tagOperations,
                tagTreeService,
                commandQueue,
                getFavoriteTree,
                findTagInFavoriteTree,
                shortcuts
            ]
        );

        useEffect(() => {
            return () => {
                dragGhostManager.hideGhost();
            };
        }, [dragGhostManager]);
        // Track which shortcut is currently active/selected
        const [activeShortcutKey, setActiveShortcut] = useState<string | null>(null);
        // Track expansion state of shortcuts virtual folder
        const [shortcutsExpanded, setShortcutsExpanded] = useState<boolean>(() => {
            const stored = localStorage.get<string>(STORAGE_KEYS.shortcutsExpandedKey);
            return stored !== '0';
        });
        // Track expansion state of recent notes virtual folder
        const [recentNotesExpanded, setRecentNotesExpanded] = useState<boolean>(() => {
            const stored = localStorage.get<string>(STORAGE_KEYS.recentNotesExpandedKey);
            if (stored === '1') {
                return true;
            }
            if (stored === '0') {
                return false;
            }
            return false;
        });
        // Tracks the measured height of the navigation banner for virtualization
        const [bannerHeight, setBannerHeight] = useState<number>(0);
        // Trigger for forcing a re-render when shortcut note metadata changes in frontmatter
        const [, forceMetadataRefresh] = useReducer((value: number) => value + 1, 0);
        const [isRootReorderMode, setRootReorderMode] = useState(false);
        const [externalShortcutDropIndex, setExternalShortcutDropIndex] = useState<number | null>(null);
        const draggedShortcutKeyRef = useRef<string | null>(null);
        const draggedShortcutDropCompletedRef = useRef(false);

        // Subscribe to metadata cache changes for shortcut notes when using frontmatter metadata
        // This ensures shortcut note display names update when frontmatter changes
        useEffect(() => {
            if (!settings.useFrontmatterMetadata) {
                return;
            }

            const metadataCache = app.metadataCache;
            // Build set of paths for all notes in shortcuts
            const relevantNotePaths = new Set(
                hydratedShortcuts.map(entry => entry.note?.path).filter((path): path is string => Boolean(path))
            );

            if (relevantNotePaths.size === 0) {
                return;
            }

            // Trigger refresh when metadata cache is fully resolved
            const handleResolved = () => {
                forceMetadataRefresh();
            };

            // Trigger refresh when a shortcut note's metadata changes
            const handleChanged = (file: TFile) => {
                if (relevantNotePaths.has(file.path)) {
                    forceMetadataRefresh();
                }
            };

            const resolvedRef = metadataCache.on('resolved', handleResolved);
            const changedRef = metadataCache.on('changed', file => {
                if (file instanceof TFile) {
                    handleChanged(file);
                }
            });

            return () => {
                metadataCache.offref(resolvedRef);
                metadataCache.offref(changedRef);
            };
        }, [app.metadataCache, hydratedShortcuts, settings.useFrontmatterMetadata, forceMetadataRefresh]);

        // Reset banner height when banner is disabled in settings
        useEffect(() => {
            if (!settings.navigationBanner) {
                setBannerHeight(0);
            }
        }, [settings.navigationBanner]);

        // Determine if drag and drop should be enabled for shortcuts
        const shortcutCount = hydratedShortcuts.length;
        const isShortcutDnDEnabled = shortcutsExpanded && shortcutCount > 1 && settings.showShortcuts;

        const showShortcutDragHandles = isMobile && isShortcutDnDEnabled;

        const shortcutDragHandleConfig = useMemo(() => {
            if (!showShortcutDragHandles) {
                return undefined;
            }
            return {
                label: strings.navigationPane.dragHandleLabel,
                visible: true,
                only: true
            } as const;
        }, [showShortcutDragHandles]);

        // Map shortcut keys to their position in the list
        const shortcutPositionMap = useMemo(() => {
            const map = new Map<string, number>();
            hydratedShortcuts.forEach((entry, index) => {
                map.set(entry.key, index);
            });
            return map;
        }, [hydratedShortcuts]);

        const { getDragHandlers, dropIndex, draggingKey } = useListReorder({
            items: hydratedShortcuts,
            isEnabled: isShortcutDnDEnabled,
            reorderItems: reorderShortcuts
        });

        /**
         * Wraps drag handlers to add custom ghost visualization during drag operations
         */
        const withDragGhost = useCallback(
            (handlers: ListReorderHandlers, options: DragGhostOptions): ListReorderHandlers => {
                if (!handlers.draggable) {
                    return handlers;
                }

                const { onDragStart, onDragEnd } = handlers;

                return {
                    ...handlers,
                    onDragStart: event => {
                        const nativeEvent = event.nativeEvent;
                        dragGhostManager.hideNativePreview(nativeEvent);
                        dragGhostManager.showGhost(nativeEvent, options);
                        onDragStart(event);
                    },
                    onDragEnd: event => {
                        dragGhostManager.hideGhost();
                        onDragEnd(event);
                    }
                };
            },
            [dragGhostManager]
        );

        useEffect(() => {
            if (!shortcutsExpanded) {
                setExternalShortcutDropIndex(null);
            }
        }, [shortcutsExpanded]);

        const computeShortcutInsertIndex = useCallback(
            (event: React.DragEvent<HTMLElement>, key: string) => {
                const shortcutIndex = shortcutPositionMap.get(key);
                if (shortcutIndex === undefined) {
                    return hydratedShortcuts.length;
                }

                const element = event.currentTarget;
                if (!(element instanceof HTMLElement)) {
                    return shortcutIndex;
                }

                const bounds = element.getBoundingClientRect();
                const offset = event.clientY - bounds.top;
                const shouldInsertBefore = offset < bounds.height / 2;
                return shouldInsertBefore ? shortcutIndex : shortcutIndex + 1;
            },
            [hydratedShortcuts.length, shortcutPositionMap]
        );

        const handleShortcutDragOver = useCallback(
            (event: React.DragEvent<HTMLElement>, key: string) => {
                const { dataTransfer } = event;
                if (!dataTransfer) {
                    return false;
                }

                if (!shortcutsExpanded || !settings.showShortcuts) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                const types = Array.from(dataTransfer.types ?? []);
                if (types.includes(SHORTCUT_DRAG_MIME)) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                const hasObsidianFiles = types.includes('obsidian/file') || types.includes('obsidian/files');
                if (!hasObsidianFiles) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                event.preventDefault();
                dataTransfer.dropEffect = 'copy';
                const insertIndex = computeShortcutInsertIndex(event, key);
                setExternalShortcutDropIndex(current => (current === insertIndex ? current : insertIndex));
                return true;
            },
            [computeShortcutInsertIndex, shortcutsExpanded, settings.showShortcuts]
        );

        const handleShortcutDrop = useCallback(
            (event: React.DragEvent<HTMLElement>, key: string) => {
                const { dataTransfer } = event;
                if (!dataTransfer) {
                    return false;
                }

                if (!shortcutsExpanded || !settings.showShortcuts) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                const types = Array.from(dataTransfer.types ?? []);
                if (types.includes(SHORTCUT_DRAG_MIME)) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                const rawPaths: string[] = [];
                const multiple = dataTransfer.getData('obsidian/files');
                if (multiple) {
                    try {
                        const parsed = JSON.parse(multiple);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(path => {
                                if (typeof path === 'string' && path.length > 0) {
                                    rawPaths.push(path);
                                }
                            });
                        }
                    } catch (error) {
                        console.error('Failed to parse obsidian/files payload', error);
                        setExternalShortcutDropIndex(null);
                        return false;
                    }
                }

                const single = dataTransfer.getData('obsidian/file');
                if (single) {
                    rawPaths.push(single);
                }

                if (rawPaths.length === 0) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                const seen = new Set<string>();
                const orderedPaths = rawPaths.filter(path => {
                    if (seen.has(path)) {
                        return false;
                    }
                    seen.add(path);
                    return true;
                });

                if (orderedPaths.length === 0) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                const additions: { type: 'folder' | 'note'; path: string }[] = [];
                orderedPaths.forEach(path => {
                    const target = app.vault.getAbstractFileByPath(path);
                    if (target instanceof TFolder) {
                        if (target.path !== '/') {
                            additions.push({ type: 'folder', path: target.path });
                        }
                    } else if (target instanceof TFile) {
                        additions.push({ type: 'note', path: target.path });
                    }
                });

                if (additions.length === 0) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                event.preventDefault();
                event.stopPropagation();

                const baseInsertIndex = computeShortcutInsertIndex(event, key);

                void (async () => {
                    let offset = 0;
                    for (const addition of additions) {
                        const targetIndex = Math.max(0, baseInsertIndex + offset);
                        let success = false;
                        if (addition.type === 'folder') {
                            success = await addFolderShortcut(addition.path, { index: targetIndex });
                        } else {
                            success = await addNoteShortcut(addition.path, { index: targetIndex });
                        }

                        if (success) {
                            offset += 1;
                        }
                    }
                })();

                setExternalShortcutDropIndex(null);
                return true;
            },
            [addFolderShortcut, addNoteShortcut, app.vault, computeShortcutInsertIndex, shortcutsExpanded, settings.showShortcuts]
        );

        const handleShortcutDragLeave = useCallback(() => {
            setExternalShortcutDropIndex(null);
        }, []);

        /**
         * Creates drag handlers for a shortcut with custom ghost visualization
         */
        const buildShortcutDragHandlers = useCallback(
            (key: string, options: DragGhostOptions): ListReorderHandlers => {
                const handlers = getDragHandlers(key);
                const handlersWithGhost = withDragGhost(handlers, options);

                return {
                    ...handlersWithGhost,
                    onDragStart: event => {
                        draggedShortcutKeyRef.current = key;
                        draggedShortcutDropCompletedRef.current = false;
                        setExternalShortcutDropIndex(null);
                        handlersWithGhost.onDragStart(event);
                    },
                    onDragOver: event => {
                        if (handleShortcutDragOver(event, key)) {
                            return;
                        }
                        handlersWithGhost.onDragOver(event);
                    },
                    onDrop: event => {
                        if (handleShortcutDrop(event, key)) {
                            draggedShortcutDropCompletedRef.current = true;
                            return;
                        }
                        handlersWithGhost.onDrop(event);
                        draggedShortcutDropCompletedRef.current = true;
                    },
                    onDragLeave: event => {
                        handleShortcutDragLeave();
                        handlersWithGhost.onDragLeave(event);
                    },
                    onDragEnd: event => {
                        handlersWithGhost.onDragEnd(event);
                        const draggedKey = draggedShortcutKeyRef.current;
                        draggedShortcutKeyRef.current = null;
                        setExternalShortcutDropIndex(null);

                        if (!draggedShortcutDropCompletedRef.current && draggedKey === key) {
                            void removeShortcut(key);
                        }
                        draggedShortcutDropCompletedRef.current = false;
                    }
                };
            },
            [getDragHandlers, removeShortcut, handleShortcutDragLeave, handleShortcutDragOver, handleShortcutDrop, withDragGhost]
        );

        /**
         * Gets visual state for a shortcut item (drag state, drop indicators)
         */
        const getShortcutVisualState = useCallback(
            (key: string) => {
                const shortcutIndex = shortcutPositionMap.get(key);
                const isDragSource = draggingKey === key;

                if (shortcutIndex === undefined) {
                    return { showBefore: false, showAfter: false, isDragSource };
                }

                const activeDropIndex = draggingKey ? dropIndex : externalShortcutDropIndex;
                const isFirstShortcut = shortcutIndex === 0;
                const showBefore = isFirstShortcut && activeDropIndex !== null && activeDropIndex === 0 && draggingKey !== key;
                const showAfter = activeDropIndex !== null && activeDropIndex === shortcutIndex + 1 && draggingKey !== key;

                return { showBefore, showAfter, isDragSource };
            },
            [draggingKey, dropIndex, externalShortcutDropIndex, shortcutPositionMap]
        );

        // Android uses toolbar at top, iOS at bottom
        const isAndroid = Platform.isAndroidApp;
        // Track previous settings for smart auto-expand
        const prevShowFavoritesFolder = useRef(settings.showFavoriteTagsFolder);
        const prevShowAllTagsFolder = useRef(settings.showAllTagsFolder);
        const prevFavoritesCount = useRef(settings.favoriteTags.length);

        // Determine if navigation pane is visible early for optimization
        const isVisible = uiState.dualPane || uiState.currentSinglePaneView === 'navigation';

        const favoriteTree = fileData.favoriteTree;
        const tagTree = fileData.tagTree;

        // Use the new data hook - now returns filtered items and pathToIndex
        // Determine if shortcuts should be pinned based on UI state and settings
        const shouldPinShortcuts = uiState.pinShortcuts && settings.showShortcuts;

        const { items, shortcutItems, pathToIndex, shortcutIndex, tagCounts, folderCounts, rootLevelFolders } = useNavigationPaneData({
            settings,
            isVisible,
            shortcutsExpanded,
            recentNotesExpanded,
            pinShortcuts: shouldPinShortcuts
        });

        // Extract shortcut items to display in pinned area when pinning is enabled
        const pinnedShortcutItems = shouldPinShortcuts ? shortcutItems : [];

        const vaultRootFolder = useMemo(() => app.vault.getRoot(), [app]);

        const rootFolderDescriptors = useMemo<RootFolderDescriptor[]>(() => {
            const descriptors: RootFolderDescriptor[] = [];
            if (settings.showRootFolder) {
                descriptors.push({ key: vaultRootFolder.path, folder: vaultRootFolder, isVault: true });
            }
            rootLevelFolders.forEach(folder => {
                descriptors.push({ key: folder.path, folder });
            });
            return descriptors;
        }, [rootLevelFolders, settings.showRootFolder, vaultRootFolder]);

        const reorderableRootFolders = useMemo<RootFolderDescriptor[]>(() => {
            return rootFolderDescriptors.filter(entry => !entry.isVault);
        }, [rootFolderDescriptors]);

        const rootFolderPositionMap = useMemo(() => {
            const map = new Map<string, number>();
            reorderableRootFolders.forEach((entry, index) => {
                map.set(entry.key, index);
            });
            return map;
        }, [reorderableRootFolders]);

        const canReorderRootFolders = reorderableRootFolders.length > 1;

        const rootFolderIconMap = useMemo(() => {
            const map = new Map<string, string | undefined>();
            items.forEach(item => {
                if (item.type === NavigationPaneItemType.FOLDER) {
                    map.set(item.data.path, item.icon);
                }
            });
            return map;
        }, [items]);

        const rootFolderColorMap = useMemo(() => {
            const map = new Map<string, string | undefined>();
            items.forEach(item => {
                if (item.type === NavigationPaneItemType.FOLDER) {
                    map.set(item.data.path, item.color);
                }
            });
            return map;
        }, [items]);

        const isRootReorderDnDEnabled = isRootReorderMode && canReorderRootFolders;

        useEffect(() => {
            if (isRootReorderMode && !canReorderRootFolders) {
                setRootReorderMode(false);
            }
        }, [isRootReorderMode, canReorderRootFolders]);

        const arePathArraysEqual = useCallback((first: string[], second: string[]) => {
            if (first.length !== second.length) {
                return false;
            }
            for (let index = 0; index < first.length; index += 1) {
                if (first[index] !== second[index]) {
                    return false;
                }
            }
            return true;
        }, []);

        const handleRootOrderChange = useCallback(
            async (orderedPaths: string[]) => {
                const normalizedOrder = orderedPaths.slice();
                if (arePathArraysEqual(normalizedOrder, settings.rootFolderOrder)) {
                    return;
                }
                await updateSettings(current => {
                    current.rootFolderOrder = normalizedOrder;
                });
            },
            [arePathArraysEqual, settings.rootFolderOrder, updateSettings]
        );

        const {
            getDragHandlers: getRootDragHandlers,
            dropIndex: rootReorderDropIndex,
            draggingKey: rootReorderDraggingKey
        } = useListReorder({
            items: reorderableRootFolders,
            isEnabled: isRootReorderDnDEnabled,
            reorderItems: async orderedKeys => {
                await handleRootOrderChange(orderedKeys);
                return true;
            }
        });

        const getRootReorderVisualState = useCallback(
            (descriptor: RootFolderDescriptor) => {
                const key = descriptor.key;
                const index = rootFolderPositionMap.get(key);

                if (index === undefined) {
                    return {
                        dragHandlers: undefined,
                        showBefore: false,
                        showAfter: false,
                        isDragSource: false
                    };
                }

                const baseHandlers = getRootDragHandlers(key);
                const iconName = rootFolderIconMap.get(key) ?? (descriptor.isVault ? 'vault' : 'lucide-folder');
                const iconColor = rootFolderColorMap.get(key);
                const dragHandlers = withDragGhost(baseHandlers, {
                    itemType: ItemType.FOLDER,
                    path: descriptor.folder.path,
                    icon: iconName,
                    iconColor
                });
                const isDragSource = rootReorderDraggingKey === key;
                const isFirst = index === 0;
                const showBefore = isFirst && rootReorderDropIndex !== null && rootReorderDropIndex === 0 && rootReorderDraggingKey !== key;
                const showAfter = rootReorderDropIndex !== null && rootReorderDropIndex === index + 1 && rootReorderDraggingKey !== key;

                return {
                    dragHandlers,
                    showBefore,
                    showAfter,
                    isDragSource
                };
            },
            [
                getRootDragHandlers,
                rootFolderIconMap,
                rootFolderColorMap,
                rootFolderPositionMap,
                rootReorderDropIndex,
                rootReorderDraggingKey,
                withDragGhost
            ]
        );

        const handleToggleRootReorder = useCallback(() => {
            if (!canReorderRootFolders) {
                return;
            }
            setRootReorderMode(prev => !prev);
        }, [canReorderRootFolders]);

        // Use the new scroll hook
        const { rowVirtualizer, scrollContainerRef, requestScroll } = useNavigationPaneScroll({
            items,
            pathToIndex,
            isVisible,
            activeShortcutKey,
            bannerHeight
        });

        useEffect(() => {
            if (!isRootReorderMode) {
                return;
            }

            rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });

            const scroller = scrollContainerRef.current;
            if (scroller) {
                scroller.scrollTo({ top: 0, behavior: 'auto' });
            }
        }, [isRootReorderMode, rowVirtualizer, scrollContainerRef]);

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
                if (folderId === SHORTCUTS_VIRTUAL_FOLDER_ID) {
                    setShortcutsExpanded(prev => {
                        const next = !prev;
                        localStorage.set(STORAGE_KEYS.shortcutsExpandedKey, next ? '1' : '0');
                        return next;
                    });
                    return;
                }
                if (folderId === RECENT_NOTES_VIRTUAL_FOLDER_ID) {
                    setRecentNotesExpanded(prev => {
                        const next = !prev;
                        localStorage.set(STORAGE_KEYS.recentNotesExpandedKey, next ? '1' : '0');
                        return next;
                    });
                    return;
                }
                expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId });
            },
            [expansionDispatch, setRecentNotesExpanded, setShortcutsExpanded]
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

        // Toggles the pinned shortcuts state between pinned and unpinned
        const handleShortcutSplitToggle = useCallback(() => {
            uiDispatch({ type: 'SET_PIN_SHORTCUTS', value: !uiState.pinShortcuts });
        }, [uiDispatch, uiState.pinShortcuts]);

        // Scrolls a shortcut into view when activated

        const scrollShortcutIntoView = useCallback(
            (shortcutKey: string) => {
                // When shortcuts are pinned, scroll to top to show pinned area
                if (shouldPinShortcuts) {
                    const container = scrollContainerRef.current;
                    if (container) {
                        container.scrollTo({ top: 0, behavior: 'auto' });
                    }
                    return;
                }
                const index = shortcutIndex.get(shortcutKey);
                if (index !== undefined) {
                    rowVirtualizer.scrollToIndex(index, { align: 'auto' });
                }
            },
            [shortcutIndex, rowVirtualizer, shouldPinShortcuts, scrollContainerRef]
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
                onNavigateToFolder(folder.path);
                scheduleShortcutRelease();
                const container = rootContainerRef.current;
                if (container && !uiState.singlePane) {
                    container.focus();
                }
            },
            [setActiveShortcut, onNavigateToFolder, scheduleShortcutRelease, rootContainerRef, uiState.singlePane]
        );

        // Handles note shortcut activation - reveals file in list pane
        const handleShortcutNoteActivate = useCallback(
            (note: TFile, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                if (selectionState.selectionType === ItemType.TAG && onRevealShortcutFile) {
                    onRevealShortcutFile(note);
                } else {
                    onRevealFile(note);
                }

                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    void leaf.openFile(note, { active: false });
                }
                if (isMobile && app.workspace.leftSplit) {
                    app.workspace.leftSplit.collapse();
                }

                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                scheduleShortcutRelease();
            },
            [
                selectionState.selectionType,
                setActiveShortcut,
                onRevealFile,
                onRevealShortcutFile,
                scheduleShortcutRelease,
                app.workspace,
                isMobile,
                uiDispatch
            ]
        );

        const handleRecentNoteActivate = useCallback(
            (note: TFile) => {
                if (selectionState.selectionType === ItemType.TAG && onRevealShortcutFile) {
                    onRevealShortcutFile(note);
                } else {
                    onRevealFile(note);
                }

                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    void leaf.openFile(note, { active: false });
                }
                if (isMobile && app.workspace.leftSplit) {
                    app.workspace.leftSplit.collapse();
                }

                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            },
            [selectionState.selectionType, onRevealFile, onRevealShortcutFile, app.workspace, isMobile, uiDispatch]
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
            (tagPath: string, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                onRevealTag(tagPath);

                if (!uiState.singlePane) {
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    const container = rootContainerRef.current;
                    if (container) {
                        container.focus();
                    }
                }

                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });

                scheduleShortcutRelease();
            },
            [setActiveShortcut, onRevealTag, uiState.singlePane, uiDispatch, rootContainerRef, selectionDispatch, scheduleShortcutRelease]
        );

        type ShortcutContextMenuTarget =
            | { type: 'folder'; key: string; folder: TFolder }
            | { type: 'note'; key: string; file: TFile }
            | { type: 'tag'; key: string; tagPath: string }
            | { type: 'search'; key: string };

        const handleShortcutContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, target: ShortcutContextMenuTarget) => {
                if (!settings.showShortcuts) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                const menu = new Menu();

                if (target.type === 'search') {
                    menu.addItem(item => {
                        item.setTitle(strings.shortcuts.remove)
                            .setIcon('lucide-bookmark-x')
                            .onClick(() => {
                                void removeShortcut(target.key);
                            });
                    });
                    menu.showAtMouseEvent(event.nativeEvent);
                    return;
                }

                const state: MenuState = {
                    selectionState,
                    expandedFolders: expansionState.expandedFolders,
                    expandedTags: expansionState.expandedTags
                };

                const dispatchers: MenuDispatchers = {
                    selectionDispatch,
                    expansionDispatch,
                    uiDispatch
                };

                if (target.type === 'folder') {
                    buildFolderMenu({
                        folder: target.folder,
                        menu,
                        services: menuServices,
                        settings,
                        state,
                        dispatchers
                    });
                } else if (target.type === 'note') {
                    buildFileMenu({
                        file: target.file,
                        menu,
                        services: menuServices,
                        settings,
                        state,
                        dispatchers
                    });

                    if (target.file.extension !== 'md') {
                        menu.addSeparator();
                        menu.addItem(item => {
                            item.setTitle(strings.shortcuts.remove)
                                .setIcon('lucide-bookmark-x')
                                .onClick(() => {
                                    void removeShortcut(target.key);
                                });
                        });
                    }
                } else if (target.type === 'tag') {
                    buildTagMenu({
                        tagPath: target.tagPath,
                        menu,
                        services: menuServices,
                        settings,
                        state,
                        dispatchers,
                        context: 'tags'
                    });
                }

                menu.showAtMouseEvent(event.nativeEvent);
            },
            [
                settings,
                menuServices,
                selectionState,
                expansionState.expandedFolders,
                expansionState.expandedTags,
                selectionDispatch,
                expansionDispatch,
                uiDispatch,
                removeShortcut
            ]
        );

        const handleRecentFileContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, file: TFile) => {
                event.preventDefault();
                event.stopPropagation();

                const menu = new Menu();

                const state: MenuState = {
                    selectionState,
                    expandedFolders: expansionState.expandedFolders,
                    expandedTags: expansionState.expandedTags
                };

                const dispatchers: MenuDispatchers = {
                    selectionDispatch,
                    expansionDispatch,
                    uiDispatch
                };

                buildFileMenu({
                    file,
                    menu,
                    services: menuServices,
                    settings,
                    state,
                    dispatchers
                });

                menu.showAtMouseEvent(event.nativeEvent);
            },
            [
                menuServices,
                settings,
                selectionState,
                expansionState.expandedFolders,
                expansionState.expandedTags,
                selectionDispatch,
                expansionDispatch,
                uiDispatch
            ]
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

        // Updates banner height when it changes, with threshold to prevent excessive updates
        const handleBannerHeightChange = useCallback((height: number) => {
            setBannerHeight(previous => {
                if (Math.abs(previous - height) < 0.5) {
                    return previous;
                }
                return height;
            });
        }, []);

        // Renders individual navigation items based on their type
        const renderItem = useCallback(
            (item: CombinedNavigationItem): React.ReactNode => {
                switch (item.type) {
                    case NavigationPaneItemType.SHORTCUT_FOLDER: {
                        const folder = item.folder;
                        if (!folder) {
                            return null;
                        }

                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = buildShortcutDragHandlers(item.key, {
                            itemType: ItemType.FOLDER,
                            path: folder.path,
                            icon: item.icon ?? 'lucide-folder',
                            iconColor: item.color
                        });
                        const folderCount = getFolderShortcutCount(folder);

                        return (
                            <ShortcutItem
                                icon={item.icon ?? 'lucide-folder'}
                                color={item.color}
                                label={folder.name}
                                level={item.level}
                                type="folder"
                                count={folderCount}
                                isExcluded={item.isExcluded}
                                onClick={() => handleShortcutFolderActivate(folder, item.key)}
                                onContextMenu={event =>
                                    handleShortcutContextMenu(event, {
                                        type: 'folder',
                                        key: item.key,
                                        folder
                                    })
                                }
                                dragHandlers={dragHandlers}
                                showDropIndicatorBefore={showBefore}
                                showDropIndicatorAfter={showAfter}
                                isDragSource={isDragSource}
                                dragHandleConfig={shortcutDragHandleConfig}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_NOTE: {
                        const note = item.note;
                        if (!note) {
                            return null;
                        }

                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = buildShortcutDragHandlers(item.key, {
                            itemType: ItemType.FILE,
                            path: note.path,
                            icon: item.icon ?? 'lucide-file',
                            iconColor: item.color
                        });

                        // Get display name from frontmatter metadata or file basename
                        const displayName = getFileDisplayName(note);
                        // Add extension suffix for non-markdown files if configured
                        const extensionSuffix = shouldShowExtensionSuffix(note) ? getExtensionSuffix(note) : '';
                        const label = extensionSuffix ? `${displayName}${extensionSuffix}` : displayName;

                        return (
                            <ShortcutItem
                                icon={item.icon ?? 'lucide-file-text'}
                                color={item.color}
                                label={label}
                                level={item.level}
                                type="note"
                                onClick={() => handleShortcutNoteActivate(note, item.key)}
                                onMouseDown={event => handleShortcutNoteMouseDown(event, note)}
                                onContextMenu={event =>
                                    handleShortcutContextMenu(event, {
                                        type: 'note',
                                        key: item.key,
                                        file: note
                                    })
                                }
                                dragHandlers={dragHandlers}
                                showDropIndicatorBefore={showBefore}
                                showDropIndicatorAfter={showAfter}
                                isDragSource={isDragSource}
                                dragHandleConfig={shortcutDragHandleConfig}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_SEARCH: {
                        const searchShortcut = item.searchShortcut;

                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = buildShortcutDragHandlers(item.key, {
                            itemType: 'search',
                            icon: item.icon ?? 'lucide-search',
                            iconColor: item.color
                        });

                        return (
                            <ShortcutItem
                                icon="lucide-search"
                                color={item.color}
                                label={searchShortcut.name}
                                level={item.level}
                                type="search"
                                onClick={() => handleShortcutSearchActivate(item.key, searchShortcut)}
                                onContextMenu={event =>
                                    handleShortcutContextMenu(event, {
                                        type: 'search',
                                        key: item.key
                                    })
                                }
                                dragHandlers={dragHandlers}
                                showDropIndicatorBefore={showBefore}
                                showDropIndicatorAfter={showAfter}
                                isDragSource={isDragSource}
                                dragHandleConfig={shortcutDragHandleConfig}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_TAG: {
                        const tagCount = getTagShortcutCount(item.tagPath);
                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = buildShortcutDragHandlers(item.key, {
                            itemType: ItemType.TAG,
                            path: item.tagPath,
                            icon: item.icon ?? 'lucide-tags',
                            iconColor: item.color
                        });
                        return (
                            <ShortcutItem
                                icon={item.icon ?? 'lucide-tags'}
                                color={item.color}
                                label={item.displayName}
                                level={item.level}
                                type="tag"
                                count={tagCount}
                                onClick={() => handleShortcutTagActivate(item.tagPath, item.key)}
                                onContextMenu={event =>
                                    handleShortcutContextMenu(event, {
                                        type: 'tag',
                                        key: item.key,
                                        tagPath: item.tagPath
                                    })
                                }
                                dragHandlers={dragHandlers}
                                showDropIndicatorBefore={showBefore}
                                showDropIndicatorAfter={showAfter}
                                isDragSource={isDragSource}
                                dragHandleConfig={shortcutDragHandleConfig}
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
                        const isShortcutsGroup = virtualFolder.id === SHORTCUTS_VIRTUAL_FOLDER_ID;
                        const isRecentNotesGroup = virtualFolder.id === RECENT_NOTES_VIRTUAL_FOLDER_ID;
                        const hasChildren = isShortcutsGroup
                            ? hydratedShortcuts.length > 0
                            : isRecentNotesGroup
                              ? recentNotes.length > 0
                              : virtualFolder.id === 'tags-root' ||
                                virtualFolder.id === 'all-tags-root' ||
                                virtualFolder.id === 'favorite-tags-root';

                        const isExpanded = isShortcutsGroup
                            ? shortcutsExpanded
                            : isRecentNotesGroup
                              ? recentNotesExpanded
                              : expansionState.expandedVirtualFolders.has(virtualFolder.id);

                        return (
                            <VirtualFolderComponent
                                virtualFolder={virtualFolder}
                                level={item.level}
                                isExpanded={isExpanded}
                                hasChildren={hasChildren}
                                onToggle={() => handleVirtualFolderToggle(virtualFolder.id)}
                            />
                        );
                    }

                    case NavigationPaneItemType.RECENT_NOTE: {
                        const note = item.note;
                        const displayName = getFileDisplayName(note);
                        const extensionSuffix = shouldShowExtensionSuffix(note) ? getExtensionSuffix(note) : '';
                        const label = extensionSuffix ? `${displayName}${extensionSuffix}` : displayName;
                        return (
                            <ShortcutItem
                                icon={item.icon ?? 'lucide-file-text'}
                                color={item.color}
                                label={label}
                                level={item.level}
                                type="note"
                                onClick={() => handleRecentNoteActivate(note)}
                                onMouseDown={event => handleShortcutNoteMouseDown(event, note)}
                                onContextMenu={event => handleRecentFileContextMenu(event, note)}
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

                    case NavigationPaneItemType.BANNER: {
                        return <NavigationBanner path={item.path} onHeightChange={handleBannerHeightChange} />;
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
                recentNotes.length,
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
                handleShortcutNoteMouseDown,
                handleShortcutSearchActivate,
                handleShortcutTagActivate,
                handleRecentNoteActivate,
                handleRecentFileContextMenu,
                handleShortcutContextMenu,
                getShortcutVisualState,
                buildShortcutDragHandlers,
                hydratedShortcuts,
                shortcutsExpanded,
                recentNotesExpanded,
                getFileDisplayName,
                shortcutDragHandleConfig,
                handleBannerHeightChange
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
        const keyboardItems = isRootReorderMode ? [] : items;
        const keyboardPathToIndex = isRootReorderMode ? new Map<string, number>() : pathToIndex;

        useNavigationPaneKeyboard({
            items: keyboardItems,
            virtualizer: rowVirtualizer,
            containerRef: props.rootContainerRef,
            pathToIndex: keyboardPathToIndex
        });

        return (
            <div className="nn-navigation-pane" style={props.style}>
                <NavigationPaneHeader
                    onTreeUpdateComplete={handleTreeUpdateComplete}
                    onTogglePinnedShortcuts={settings.showShortcuts ? handleShortcutSplitToggle : undefined}
                    onToggleRootFolderReorder={handleToggleRootReorder}
                    rootReorderActive={isRootReorderMode}
                    rootReorderDisabled={!canReorderRootFolders}
                />
                {/* Android - toolbar at top */}
                {isMobile && isAndroid && (
                    <NavigationToolbar
                        onTreeUpdateComplete={handleTreeUpdateComplete}
                        onTogglePinnedShortcuts={settings.showShortcuts ? handleShortcutSplitToggle : undefined}
                        onToggleRootFolderReorder={handleToggleRootReorder}
                        rootReorderActive={isRootReorderMode}
                        rootReorderDisabled={!canReorderRootFolders}
                    />
                )}
                <div className="nn-navigation-pane-body">
                    {pinnedShortcutItems.length > 0 && !isRootReorderMode ? (
                        <div className="nn-shortcut-pinned" role="presentation">
                            <div className="nn-shortcut-pinned-inner">
                                {pinnedShortcutItems.map(shortcutItem => (
                                    <React.Fragment key={shortcutItem.key}>{renderItem(shortcutItem)}</React.Fragment>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    <div
                        ref={scrollContainerRef}
                        className="nn-navigation-pane-scroller"
                        data-pane="navigation"
                        role={isRootReorderMode ? 'list' : 'tree'}
                        tabIndex={-1}
                    >
                        {isRootReorderMode ? (
                            <div className="nn-root-reorder-panel">
                                <div className="nn-root-reorder-header">
                                    <span className="nn-root-reorder-title">{strings.navigationPane.reorderRootFoldersTitle}</span>
                                    <span className="nn-root-reorder-hint">{strings.navigationPane.reorderRootFoldersHint}</span>
                                </div>
                                <div className="nn-root-reorder-list" role="presentation">
                                    {rootFolderDescriptors.map(entry => {
                                        const { dragHandlers, showBefore, showAfter, isDragSource } = getRootReorderVisualState(entry);
                                        const iconName = rootFolderIconMap.get(entry.key);
                                        const displayLabel = entry.isVault
                                            ? settings.customVaultName || app.vault.getName()
                                            : entry.folder.name;
                                        const displayIcon = entry.isVault ? (iconName ?? 'open-vault') : (iconName ?? 'lucide-folder');
                                        const chevronIcon = entry.isVault ? 'lucide-chevron-down' : undefined;

                                        return (
                                            <RootFolderReorderItem
                                                key={`root-reorder-${entry.key}`}
                                                icon={displayIcon}
                                                label={displayLabel}
                                                level={entry.isVault ? 0 : 1}
                                                dragHandlers={entry.isVault ? undefined : dragHandlers}
                                                showDropIndicatorBefore={showBefore}
                                                showDropIndicatorAfter={showAfter}
                                                isDragSource={entry.isVault ? false : isDragSource}
                                                dragHandleLabel={strings.navigationPane.dragHandleLabel}
                                                chevronIcon={chevronIcon}
                                            />
                                        );
                                    })}
                                    {settings.rootFolderOrder.length > 0 ? (
                                        // Display reset button when custom folder ordering is active
                                        <div className="nn-root-reorder-actions">
                                            <button
                                                type="button"
                                                className="nn-root-reorder-reset nn-support-button"
                                                onClick={event => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    // Clear custom folder order to restore alphabetical sorting
                                                    void updateSettings(current => {
                                                        current.rootFolderOrder = [];
                                                    });
                                                }}
                                            >
                                                <span className="nn-root-reorder-reset-icon" aria-hidden="true">
                                                    Aa
                                                </span>
                                                <span>{strings.navigationPane.resetRootFolderOrder}</span>
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            items.length > 0 && (
                                <div
                                    className="nn-virtual-container"
                                    style={{
                                        height: `${rowVirtualizer.getTotalSize()}px`
                                    }}
                                >
                                    {rowVirtualizer.getVirtualItems().map(virtualItem => {
                                        // Safe array access
                                        const item =
                                            virtualItem.index >= 0 && virtualItem.index < items.length ? items[virtualItem.index] : null;
                                        if (!item) return null;

                                        // Callback to measure dynamic-height items for virtualization
                                        const measureRef = (element: HTMLDivElement | null) => {
                                            if (!element) {
                                                return;
                                            }
                                            if (item.type === NavigationPaneItemType.BANNER) {
                                                rowVirtualizer.measureElement(element);
                                            }
                                        };

                                        return (
                                            <div
                                                key={virtualItem.key}
                                                data-index={virtualItem.index}
                                                className="nn-virtual-nav-item"
                                                ref={measureRef}
                                                style={{
                                                    transform: `translateY(${virtualItem.start}px)`
                                                }}
                                            >
                                                {renderItem(item)}
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>
                </div>
                {/* iOS - toolbar at bottom */}
                {isMobile && !isAndroid && (
                    <NavigationToolbar
                        onTreeUpdateComplete={handleTreeUpdateComplete}
                        onTogglePinnedShortcuts={settings.showShortcuts ? handleShortcutSplitToggle : undefined}
                        onToggleRootFolderReorder={handleToggleRootReorder}
                        rootReorderActive={isRootReorderMode}
                        rootReorderDisabled={!canReorderRootFolders}
                    />
                )}
            </div>
        );
    })
);
