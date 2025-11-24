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
 *    - Tag virtualization and hidden-tag handling
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
import { useUXPreferences } from '../context/UXPreferencesContext';
import { showNotice } from '../utils/noticeUtils';
import { useFileCache } from '../context/StorageContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useNavigationPaneKeyboard } from '../hooks/useNavigationPaneKeyboard';
import { useNavigationPaneData } from '../hooks/useNavigationPaneData';
import { useNavigationPaneScroll } from '../hooks/useNavigationPaneScroll';
import { useNavigationRootReorder } from '../hooks/useNavigationRootReorder';
import { useListReorder, type ListReorderHandlers } from '../hooks/useListReorder';
import type { CombinedNavigationItem } from '../types/virtualization';
import { NavigationPaneItemType, ItemType, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';
import { getSelectedPath } from '../utils/selectionUtils';
import { TagTreeNode } from '../types/storage';
import { getFolderNote, type FolderNoteDetectionSettings } from '../utils/folderNotes';
import { findTagNode, getTotalNoteCount } from '../utils/tagTree';
import { getExtensionSuffix, shouldShowExtensionSuffix } from '../utils/fileTypeUtils';
import { getTagSearchModifierOperator, resolveCanonicalTagPath } from '../utils/tagUtils';
import { FolderItem } from './FolderItem';
import { NavigationPaneHeader } from './NavigationPaneHeader';
import { NavigationToolbar } from './NavigationToolbar';
import { TagTreeItem } from './TagTreeItem';
import { VirtualFolderComponent } from './VirtualFolderItem';
import { getNavigationIndex, normalizeNavigationPath } from '../utils/navigationIndex';
import { STORAGE_KEYS, SHORTCUTS_VIRTUAL_FOLDER_ID, RECENT_NOTES_VIRTUAL_FOLDER_ID, NavigationSectionId } from '../types';
import { localStorage } from '../utils/localStorage';
import { runAsyncAction } from '../utils/async';
import { extractFilePathsFromDataTransfer, parseTagDragPayload } from '../utils/dragData';
import { openFileInContext } from '../utils/openFileInContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { ShortcutItem } from './ShortcutItem';
import {
    ShortcutEntry,
    ShortcutType,
    SearchShortcut,
    SHORTCUT_DRAG_MIME,
    isFolderShortcut,
    isNoteShortcut,
    isTagShortcut
} from '../types/shortcuts';
import { strings } from '../i18n';
import { createDragGhostManager, type DragGhostOptions } from '../utils/dragGhost';
import { showReorderMenu, createMenuReorderHandleConfig } from '../utils/reorderMenu';
import { NavigationBanner } from './NavigationBanner';
import { NavigationRootReorderPanel } from './NavigationRootReorderPanel';
import type { DragHandleConfig } from './NavigationListRow';
import {
    buildFolderMenu,
    buildFileMenu,
    buildTagMenu,
    type MenuServices,
    type MenuState,
    type MenuDispatchers
} from '../utils/contextMenu';
import type { NoteCountInfo } from '../types/noteCounts';
import type { SearchTagFilterState } from '../types/search';
import type { InclusionOperator } from '../utils/filterSearch';
import { calculateFolderNoteCounts } from '../utils/noteCountUtils';
import { getActiveHiddenFolders } from '../utils/vaultProfiles';
import { getEffectiveFrontmatterExclusions } from '../utils/exclusionUtils';
import { normalizeNavigationSectionOrderInput } from '../utils/navigationSections';
import { getPathBaseName } from '../utils/pathUtils';
import type { NavigateToFolderOptions, RevealTagOptions } from '../hooks/useNavigatorReveal';
import { isVirtualTagCollectionId } from '../utils/virtualTagCollections';
import { compositeWithBase } from '../utils/colorUtils';
import { useSurfaceColorVariables } from '../hooks/useSurfaceColorVariables';
import { NAVIGATION_PANE_SURFACE_COLOR_MAPPINGS } from '../constants/surfaceColorMappings';
import { TAG_DRAG_MIME } from '../types/obsidian-extended';

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
    searchTagFilters?: SearchTagFilterState;
    onExecuteSearchShortcut?: (shortcutKey: string, searchShortcut: SearchShortcut) => Promise<void> | void;
    onNavigateToFolder: (folderPath: string, options?: NavigateToFolderOptions) => void;
    onRevealTag: (tagPath: string, options?: RevealTagOptions) => void;
    onRevealFile: (file: TFile) => void;
    onRevealShortcutFile?: (file: TFile) => void;
    onModifySearchWithTag: (tag: string, operator: InclusionOperator) => void;
}

// Default note count object used when counts are disabled or unavailable
const ZERO_NOTE_COUNT: NoteCountInfo = { current: 0, descendants: 0, total: 0 };
const EMPTY_TAG_TOKENS: string[] = [];

export const NavigationPane = React.memo(
    forwardRef<NavigationPaneHandle, NavigationPaneProps>(function NavigationPane(props, ref) {
        const { app, isMobile, plugin, tagTreeService } = useServices();
        const { recentNotes } = useRecentData();
        const {
            onExecuteSearchShortcut,
            rootContainerRef,
            searchTagFilters,
            onNavigateToFolder,
            onRevealTag,
            onRevealFile,
            onRevealShortcutFile,
            onModifySearchWithTag
        } = props;
        const commandQueue = useCommandQueue();
        const fileSystemOps = useFileSystemOps();
        const metadataService = useMetadataService();
        const tagOperations = useTagOperations();
        const expansionState = useExpansionState();
        const expansionDispatch = useExpansionDispatch();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const uxPreferences = useUXPreferences();
        const includeDescendantNotes = uxPreferences.includeDescendantNotes;
        const showHiddenItems = uxPreferences.showHiddenItems;
        // Retrieves the list of folders to hide based on the active vault profile
        const hiddenFolders = useMemo(() => getActiveHiddenFolders(settings), [settings]);
        // Resolves frontmatter exclusions, returns empty array when hidden items are shown
        const effectiveFrontmatterExclusions = getEffectiveFrontmatterExclusions(settings, showHiddenItems);
        const updateSettings = useSettingsUpdate();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();
        const shortcuts = useShortcuts();
        const {
            shortcutMap,
            removeShortcut,
            hydratedShortcuts,
            reorderShortcuts,
            addTagShortcut,
            addShortcutsBatch,
            hasFolderShortcut,
            hasNoteShortcut
        } = shortcuts;
        const { fileData, getFileDisplayName } = useFileCache();
        const dragGhostManager = useMemo(() => createDragGhostManager(app), [app]);
        // Detect Android platform for mobile-specific UI behavior
        const isAndroid = Platform.isAndroidApp;
        // Use menu-based reordering on Android mobile instead of drag-and-drop
        const useMobileReorderMenu = isMobile && isAndroid;
        const navigationPaneRef = useRef<HTMLDivElement>(null);
        const shortcutHandleConfigCacheRef = useRef<Map<string, DragHandleConfig>>(new Map());
        /** Maps semi-transparent theme color variables to their pre-composited solid equivalents (see constants/surfaceColorMappings). */
        const { color: navSurfaceColor, version: navSurfaceVersion } = useSurfaceColorVariables(navigationPaneRef, {
            app,
            rootContainerRef,
            variables: NAVIGATION_PANE_SURFACE_COLOR_MAPPINGS
        });
        const solidBackgroundCacheRef = useRef<Map<string, string | undefined>>(new Map());
        // Invalidates the solid background cache when surface color changes
        useEffect(() => {
            solidBackgroundCacheRef.current.clear();
        }, [navSurfaceColor, navSurfaceVersion]);

        // Extract included tag tokens from search filters for highlighting
        const searchIncludeTokens = useMemo(() => {
            if (!searchTagFilters || searchTagFilters.include.length === 0) {
                return EMPTY_TAG_TOKENS;
            }
            return searchTagFilters.include;
        }, [searchTagFilters]);

        // Extract excluded tag tokens from search filters for highlighting
        const searchExcludeTokens = useMemo(() => {
            if (!searchTagFilters || searchTagFilters.exclude.length === 0) {
                return EMPTY_TAG_TOKENS;
            }
            return searchTagFilters.exclude;
        }, [searchTagFilters]);

        // Flags indicating if untagged or tagged filters are active in search
        const highlightRequireTagged = searchTagFilters?.requireTagged ?? false;
        const highlightExcludeTagged = searchTagFilters?.excludeTagged ?? false;
        const highlightIncludeUntagged = searchTagFilters?.includeUntagged ?? false;

        // Convert tag filter arrays to sets for faster membership checks while rendering
        const searchIncludeTokenSet = useMemo(() => {
            if (searchIncludeTokens.length === 0) {
                return null;
            }
            return new Set(searchIncludeTokens);
        }, [searchIncludeTokens]);

        const searchExcludeTokenSet = useMemo(() => {
            if (searchExcludeTokens.length === 0) {
                return null;
            }
            return new Set(searchExcludeTokens);
        }, [searchExcludeTokens]);

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
                shortcuts,
                visibility: { includeDescendantNotes, showHiddenItems }
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
                shortcuts,
                includeDescendantNotes,
                showHiddenItems
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
        // Manages the display order of navigation sections (folders vs tags)
        const [sectionOrder, setSectionOrder] = useState<NavigationSectionId[]>(() => {
            const stored = localStorage.get<unknown>(STORAGE_KEYS.navigationSectionOrderKey);
            return normalizeNavigationSectionOrderInput(stored);
        });
        // Tracks whether the folders section is expanded or collapsed
        const [foldersSectionExpanded, setFoldersSectionExpanded] = useState(true);
        // Tracks whether the tags section is expanded or collapsed
        const [tagsSectionExpanded, setTagsSectionExpanded] = useState(true);
        // Toggles the expanded state of the folders section
        const handleToggleFoldersSection = useCallback(() => {
            setFoldersSectionExpanded(prev => !prev);
        }, []);

        // Toggles the expanded state of the tags section
        const handleToggleTagsSection = useCallback(() => {
            setTagsSectionExpanded(prev => !prev);
        }, []);
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

        // Determine if drag and drop should be enabled for shortcuts
        const shortcutCount = hydratedShortcuts.length;
        const isShortcutDnDEnabled = shortcutsExpanded && shortcutCount > 0 && settings.showShortcuts;

        // Show drag handles on mobile when drag and drop is enabled, excluding Android which uses menu-based reordering
        const showShortcutDragHandles = isMobile && isShortcutDnDEnabled && !useMobileReorderMenu;

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

        // Map shortcut keys to their position in the list for efficient lookups
        const shortcutPositionMap = useMemo(() => {
            const map = new Map<string, number>();
            hydratedShortcuts.forEach((entry, index) => {
                map.set(entry.key, index);
            });
            return map;
        }, [hydratedShortcuts]);

        // Extract reorder state and helpers, including moveItem and canMoveItem for menu-based reordering
        const {
            getDragHandlers,
            dropIndex,
            draggingKey,
            moveItem: moveShortcutItem,
            canMoveItem: canMoveShortcutItem
        } = useListReorder({
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

        // Reset external drop indicator when shortcuts are collapsed
        useEffect(() => {
            if (!shortcutsExpanded) {
                setExternalShortcutDropIndex(null);
            }
        }, [shortcutsExpanded]);

        // Calculates the insertion index for dropped shortcuts based on drop position
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

        // Unique key for the root shortcuts virtual folder to enable drop on empty shortcuts list
        const shortcutRootDropKey = '__shortcuts-root__';

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
                const hasTagPayload = types.includes(TAG_DRAG_MIME);
                if (!hasObsidianFiles && !hasTagPayload) {
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

                const tagPayloadRaw = dataTransfer.getData(TAG_DRAG_MIME);
                if (tagPayloadRaw) {
                    const droppedTagPath = parseTagDragPayload(tagPayloadRaw);
                    if (droppedTagPath) {
                        event.preventDefault();
                        event.stopPropagation();

                        const baseInsertIndex = computeShortcutInsertIndex(event, key);
                        runAsyncAction(async () => {
                            await addTagShortcut(droppedTagPath, { index: Math.max(0, baseInsertIndex) });
                        });

                        setExternalShortcutDropIndex(null);
                        return true;
                    }
                }

                const rawPaths = extractFilePathsFromDataTransfer(dataTransfer);
                if (!rawPaths) {
                    setExternalShortcutDropIndex(null);
                    return false;
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

                // Track valid additions and count duplicates
                const additions: ShortcutEntry[] = [];
                let duplicateFolderCount = 0;
                let duplicateNoteCount = 0;
                orderedPaths.forEach(path => {
                    const target = app.vault.getAbstractFileByPath(path);
                    if (target instanceof TFolder) {
                        // Skip root folder
                        if (target.path === '/') {
                            return;
                        }
                        if (hasFolderShortcut(target.path)) {
                            duplicateFolderCount += 1;
                            return;
                        }
                        additions.push({ type: ShortcutType.FOLDER, path: target.path });
                    } else if (target instanceof TFile) {
                        if (hasNoteShortcut(target.path)) {
                            duplicateNoteCount += 1;
                            return;
                        }
                        additions.push({ type: ShortcutType.NOTE, path: target.path });
                    }
                });

                // Notify user of duplicate shortcuts
                if (duplicateFolderCount > 0) {
                    showNotice(strings.shortcuts.folderExists, { variant: 'warning' });
                }
                if (duplicateNoteCount > 0) {
                    showNotice(strings.shortcuts.noteExists, { variant: 'warning' });
                }

                if (additions.length === 0) {
                    setExternalShortcutDropIndex(null);
                    return false;
                }

                event.preventDefault();
                event.stopPropagation();

                const baseInsertIndex = computeShortcutInsertIndex(event, key);

                runAsyncAction(async () => {
                    await addShortcutsBatch(additions, { index: Math.max(0, baseInsertIndex) });
                });

                setExternalShortcutDropIndex(null);
                return true;
            },
            [
                addShortcutsBatch,
                addTagShortcut,
                app.vault,
                computeShortcutInsertIndex,
                shortcutsExpanded,
                settings.showShortcuts,
                hasFolderShortcut,
                hasNoteShortcut
            ]
        );

        const handleShortcutDragLeave = useCallback(() => {
            setExternalShortcutDropIndex(null);
        }, []);

        // Allow dragging files/folders onto empty shortcuts list when shortcuts are shown and expanded
        const allowEmptyShortcutDrop = shortcutsExpanded && settings.showShortcuts && hydratedShortcuts.length === 0;

        // Handles drag over events on the shortcuts virtual folder root when the list is empty
        const handleShortcutRootDragOver = useCallback(
            (event: React.DragEvent<HTMLElement>) => {
                if (!allowEmptyShortcutDrop) {
                    return;
                }
                handleShortcutDragOver(event, shortcutRootDropKey);
            },
            [allowEmptyShortcutDrop, handleShortcutDragOver, shortcutRootDropKey]
        );

        // Handles drop events on the shortcuts virtual folder root when the list is empty
        const handleShortcutRootDrop = useCallback(
            (event: React.DragEvent<HTMLElement>) => {
                if (!allowEmptyShortcutDrop) {
                    return;
                }
                handleShortcutDrop(event, shortcutRootDropKey);
            },
            [allowEmptyShortcutDrop, handleShortcutDrop, shortcutRootDropKey]
        );

        // Handles drag leave events on the shortcuts virtual folder root when the list is empty
        const handleShortcutRootDragLeave = useCallback(() => {
            if (!allowEmptyShortcutDrop) {
                return;
            }
            handleShortcutDragLeave();
        }, [allowEmptyShortcutDrop, handleShortcutDragLeave]);

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
                        draggedShortcutKeyRef.current = null;
                        setExternalShortcutDropIndex(null);

                        draggedShortcutDropCompletedRef.current = false;
                    }
                };
            },
            [getDragHandlers, handleShortcutDragLeave, handleShortcutDragOver, handleShortcutDrop, withDragGhost]
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

        // Enable menu-based reordering when on mobile with Android and there are multiple shortcuts
        const canUseShortcutReorderMenu = useMobileReorderMenu && isShortcutDnDEnabled && hydratedShortcuts.length > 1;

        // Opens the reorder menu for a shortcut, showing move up/down options based on current position
        const openShortcutReorderMenu = useCallback(
            (key: string, anchor: HTMLElement, mouseEvent?: MouseEvent) => {
                if (!canUseShortcutReorderMenu) {
                    return false;
                }

                const allowMoveUp = canMoveShortcutItem(key, -1);
                const allowMoveDown = canMoveShortcutItem(key, 1);

                return showReorderMenu({
                    anchor,
                    mouseEvent,
                    allowMoveUp,
                    allowMoveDown,
                    moveUpLabel: strings.shortcuts.moveUp,
                    moveDownLabel: strings.shortcuts.moveDown,
                    onMoveUp: () => {
                        runAsyncAction(() => moveShortcutItem(key, -1));
                    },
                    onMoveDown: () => {
                        runAsyncAction(() => moveShortcutItem(key, 1));
                    }
                });
            },
            [canUseShortcutReorderMenu, canMoveShortcutItem, moveShortcutItem]
        );

        // Handles click events on shortcut drag handle to open reorder menu
        const handleShortcutHandleClick = useCallback(
            (key: string, event: React.MouseEvent<HTMLSpanElement>) => {
                if (!canUseShortcutReorderMenu) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                openShortcutReorderMenu(key, event.currentTarget);
            },
            [canUseShortcutReorderMenu, openShortcutReorderMenu]
        );

        // Handles context menu events on shortcut drag handle to open reorder menu at cursor position
        const handleShortcutHandleContextMenu = useCallback(
            (key: string, event: React.MouseEvent<HTMLSpanElement>) => {
                if (!canUseShortcutReorderMenu) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();

                const nativeEvent = event.nativeEvent;
                const mouseEvent = nativeEvent instanceof MouseEvent ? nativeEvent : undefined;
                openShortcutReorderMenu(key, event.currentTarget, mouseEvent);
            },
            [canUseShortcutReorderMenu, openShortcutReorderMenu]
        );

        // Builds event handlers for shortcut drag handle click and context menu
        const getShortcutHandleEvents = useCallback(
            (key: string) => ({
                onClick: (event: React.MouseEvent<HTMLSpanElement>) => handleShortcutHandleClick(key, event),
                onContextMenu: (event: React.MouseEvent<HTMLSpanElement>) => handleShortcutHandleContextMenu(key, event)
            }),
            [handleShortcutHandleClick, handleShortcutHandleContextMenu]
        );

        const getMobileShortcutHandleConfig = useCallback(
            (key: string): DragHandleConfig | undefined => {
                if (!canUseShortcutReorderMenu) {
                    return undefined;
                }
                const cache = shortcutHandleConfigCacheRef.current;
                const cachedConfig = cache.get(key);
                if (cachedConfig) {
                    return cachedConfig;
                }
                const config = createMenuReorderHandleConfig({
                    label: strings.navigationPane.dragHandleLabel,
                    events: getShortcutHandleEvents(key)
                });
                cache.set(key, config);
                return config;
            },
            [canUseShortcutReorderMenu, getShortcutHandleEvents]
        );

        useEffect(() => {
            const cache = shortcutHandleConfigCacheRef.current;
            if (!canUseShortcutReorderMenu) {
                cache.clear();
                return;
            }
            const validKeys = new Set(hydratedShortcuts.map(entry => entry.key));
            for (const key of Array.from(cache.keys())) {
                if (!validKeys.has(key)) {
                    cache.delete(key);
                }
            }
        }, [canUseShortcutReorderMenu, hydratedShortcuts]);

        useEffect(() => {
            shortcutHandleConfigCacheRef.current.clear();
        }, [canUseShortcutReorderMenu, getShortcutHandleEvents]);

        // Android uses toolbar at top, iOS at bottom
        // Track previous settings for smart auto-expand
        const prevShowAllTagsFolder = useRef(settings.showAllTagsFolder);

        // Determine if navigation pane is visible early for optimization
        const isVisible = uiState.dualPane || uiState.currentSinglePaneView === 'navigation';

        // Get tag tree from file data cache
        const tagTree = fileData.tagTree;

        // Use the new data hook - now returns filtered items and pathToIndex
        // Determine if shortcuts should be pinned based on UI state and settings
        const shouldPinShortcuts = uiState.pinShortcuts && settings.showShortcuts;

        const {
            items,
            firstSectionId,
            firstInlineFolderPath,
            shortcutItems,
            tagsVirtualFolderHasChildren,
            pathToIndex,
            shortcutIndex,
            tagCounts,
            folderCounts,
            rootLevelFolders,
            missingRootFolderPaths,
            resolvedRootTagKeys,
            rootOrderingTagTree,
            missingRootTagPaths,
            vaultChangeVersion,
            navigationBannerPath
        } = useNavigationPaneData({
            settings,
            isVisible,
            shortcutsExpanded,
            recentNotesExpanded,
            pinShortcuts: shouldPinShortcuts,
            sectionOrder
        });

        // Reset banner height when banner is disabled in settings
        useEffect(() => {
            if (!navigationBannerPath) {
                setBannerHeight(0);
            }
        }, [navigationBannerPath]);

        // Extract shortcut items to display in pinned area when pinning is enabled
        const pinnedShortcutItems = shouldPinShortcuts ? shortcutItems : [];
        // Banner should be shown in pinned area only when shortcuts are pinned and banner is configured
        const shouldShowPinnedBanner = Boolean(navigationBannerPath && pinnedShortcutItems.length > 0);

        // We only reserve gutter space when a banner exists because Windows scrollbars
        // change container width by ~7px when they appear. That width change used to
        // feed back into the virtualizer via ResizeObserver and trigger infinite reflows.
        const hasNavigationBannerConfigured = Boolean(navigationBannerPath);

        const {
            reorderableRootFolders,
            reorderableRootTags,
            sectionReorderItems,
            folderReorderItems,
            tagReorderItems,
            canReorderRootItems,
            showRootFolderSection,
            showRootTagSection,
            resetRootTagOrderLabel,
            handleResetRootFolderOrder,
            handleResetRootTagOrder
        } = useNavigationRootReorder({
            app,
            items,
            settings,
            updateSettings,
            sectionOrder,
            setSectionOrder,
            rootLevelFolders,
            missingRootFolderPaths,
            resolvedRootTagKeys,
            rootOrderingTagTree,
            missingRootTagPaths,
            metadataService,
            withDragGhost,
            isRootReorderMode,
            foldersSectionExpanded,
            tagsSectionExpanded,
            handleToggleFoldersSection,
            handleToggleTagsSection,
            useReorderMenu: useMobileReorderMenu
        });

        useEffect(() => {
            if (isRootReorderMode && !canReorderRootItems) {
                setRootReorderMode(false);
            }
        }, [isRootReorderMode, canReorderRootItems]);

        // Toggle root folder reorder mode on/off
        const handleToggleRootReorder = useCallback(() => {
            if (!canReorderRootItems) {
                return;
            }
            setRootReorderMode(prev => !prev);
        }, [canReorderRootItems]);

        const { rowVirtualizer, scrollContainerRef, scrollContainerRefCallback, requestScroll } = useNavigationPaneScroll({
            items,
            pathToIndex,
            isVisible,
            activeShortcutKey,
            bannerHeight
        });

        /** Converts a potentially transparent background color into a solid color by compositing with the pane surface. */
        const getSolidBackground = useCallback(
            (color?: string | null) => {
                if (!color) {
                    return undefined;
                }
                const trimmed = color.trim();
                if (!trimmed) {
                    return undefined;
                }
                const cache = solidBackgroundCacheRef.current;
                if (cache.has(trimmed)) {
                    return cache.get(trimmed);
                }
                const pane = navigationPaneRef.current;
                const solidColor = compositeWithBase(navSurfaceColor, trimmed, { container: pane ?? null });
                cache.set(trimmed, solidColor);
                return solidColor;
            },
            [navSurfaceColor]
        );

        useEffect(() => {
            if (isRootReorderMode) {
                return;
            }
            rowVirtualizer.measure();
        }, [isRootReorderMode, rowVirtualizer, sectionOrder, reorderableRootFolders, reorderableRootTags]);

        // Scroll to top when entering root reorder mode for better UX
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

                // Auto-expand behavior in single-pane mode:
                // When autoExpandFoldersTags is enabled:
                //   1. First click on a collapsed folder with children → Expands it, stays in navigation pane
                //   2. Second click (now expanded) or click on folder without children → Shows files pane
                // When autoExpandFoldersTags is disabled:
                //   - Click always shows files pane immediately
                const hasChildFolders = folder.children.some(child => child instanceof TFolder);
                const isExpanded = expansionState.expandedFolders.has(folder.path);
                const shouldExpandOnly = uiState.singlePane && settings.autoExpandFoldersTags && hasChildFolders && !isExpanded;

                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

                // Expand collapsed folder when auto-expand is enabled
                if (settings.autoExpandFoldersTags && hasChildFolders && !isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                }

                // In single-pane mode: either expand-only or show files
                if (uiState.singlePane) {
                    if (shouldExpandOnly) {
                        // First click on collapsed folder: expand and stay in navigation pane
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    } else {
                        // Second click or folder without children: show files pane
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    }
                } else {
                    // In dual-pane mode: always stay focused on navigation
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                }
            },
            [
                selectionDispatch,
                uiDispatch,
                uiState.singlePane,
                settings.autoExpandFoldersTags,
                expansionDispatch,
                setActiveShortcut,
                expansionState.expandedFolders
            ]
        );

        const openNavigationFolderNote = useCallback(
            async ({ folder, folderNote, openInNewTab }: { folder: TFolder; folderNote: TFile; openInNewTab: boolean }) => {
                const openFile = async () => {
                    if (openInNewTab) {
                        await openFileInContext({ app, commandQueue, file: folderNote, context: 'tab' });
                        return;
                    }

                    const leaf = app.workspace.getLeaf();
                    await leaf.openFile(folderNote);
                };

                if (commandQueue) {
                    await commandQueue.executeOpenFolderNote(folder.path, openFile);
                    return;
                }

                await openFile();
            },
            [app, commandQueue]
        );

        // Handle folder name click (for folder notes)
        const handleFolderNameClick = useCallback(
            (folder: TFolder, event?: React.MouseEvent<HTMLSpanElement>) => {
                if (!settings.enableFolderNotes) {
                    handleFolderClick(folder);
                    return;
                }

                const folderNote = getFolderNote(folder, settings);
                if (!folderNote) {
                    handleFolderClick(folder);
                    return;
                }

                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder, autoSelectedFile: null });

                const isCmdCtrlClick = Boolean(event && (event.metaKey || event.ctrlKey));
                const shouldOpenInNewTab = !isMobile && settings.multiSelectModifier === 'optionAlt' && isCmdCtrlClick;

                runAsyncAction(() => openNavigationFolderNote({ folder, folderNote, openInNewTab: shouldOpenInNewTab }));
            },
            [settings, handleFolderClick, selectionDispatch, isMobile, openNavigationFolderNote]
        );

        const handleFolderNameMouseDown = useCallback(
            (folder: TFolder, event: React.MouseEvent<HTMLSpanElement>) => {
                if (event.button !== 1 || !settings.enableFolderNotes) {
                    return;
                }

                const folderNote = getFolderNote(folder, settings);
                if (!folderNote) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder, autoSelectedFile: null });

                runAsyncAction(() => openNavigationFolderNote({ folder, folderNote, openInNewTab: true }));
            },
            [settings, selectionDispatch, openNavigationFolderNote]
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

        // Recursively collects all descendant folder paths from a given folder
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

        // Recursively collects all descendant tag paths from a given tag
        const getAllDescendantTags = useCallback(
            (tagPath: string): string[] => {
                const descendants: string[] = [];
                const tagNode = findTagNode(tagTree, tagPath);

                if (!tagNode) {
                    return descendants;
                }

                const collectDescendants = (node: TagTreeNode) => {
                    node.children.forEach(child => {
                        descendants.push(child.path);
                        collectDescendants(child);
                    });
                };

                collectDescendants(tagNode);
                return descendants;
            },
            [tagTree]
        );

        // Handle tag click
        const handleTagClick = useCallback(
            (tagPath: string, event?: React.MouseEvent, options?: { fromShortcut?: boolean }) => {
                const tagNode = findTagNode(tagTree, tagPath);
                const canonicalPath = resolveCanonicalTagPath(tagPath, tagTree);
                // Check if tag is currently expanded (used for auto-expand logic below)
                const isExpanded = tagNode ? expansionState.expandedTags.has(tagNode.path) : false;
                if (!canonicalPath) {
                    return;
                }

                const isVirtualCollection = isVirtualTagCollectionId(canonicalPath);
                const operator = getTagSearchModifierOperator(event ?? null, settings.multiSelectModifier, isMobile);
                if (operator && !isVirtualCollection && canonicalPath !== UNTAGGED_TAG_ID) {
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    onModifySearchWithTag(canonicalPath, operator);
                    return;
                }

                const isSameTag = selectionState.selectionType === 'tag' && selectionState.selectedTag === canonicalPath;

                if (isSameTag) {
                    if (uiState.singlePane) {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    } else if (options?.fromShortcut) {
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    } else {
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

                selectionDispatch({ type: 'SET_SELECTED_TAG', tag: canonicalPath });

                // Auto-expand behavior in single-pane mode (same logic as folders):
                // When autoExpandFoldersTags is enabled:
                //   1. First click on a collapsed tag with children → Expands it, stays in navigation pane
                //   2. Second click (now expanded) or click on tag without children → Shows files pane
                // When autoExpandFoldersTags is disabled:
                //   - Click always shows files pane immediately
                const hasChildren = Boolean(tagNode && tagNode.children.size > 0);
                const shouldExpandOnly = uiState.singlePane && settings.autoExpandFoldersTags && hasChildren && !isExpanded;

                // Expand collapsed tag when auto-expand is enabled
                if (settings.autoExpandFoldersTags && hasChildren && !isExpanded && tagNode) {
                    expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tagNode.path });
                }

                // In single-pane mode: either expand-only or show files
                if (uiState.singlePane) {
                    if (shouldExpandOnly) {
                        // First click on collapsed tag: expand and stay in navigation pane
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    } else {
                        // Second click or tag without children: show files pane
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    }
                } else if (options?.fromShortcut) {
                    // In dual-pane mode with shortcut: focus files pane
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                } else {
                    // In dual-pane mode: stay focused on navigation
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
                expansionState.expandedTags,
                selectionState.selectedTag,
                selectionState.selectionType,
                setActiveShortcut,
                onModifySearchWithTag,
                isMobile,
                settings.multiSelectModifier
            ]
        );

        // Forward tag collection clicks to the main tag click handler
        const handleTagCollectionClick = useCallback(
            (tagCollectionId: string, event: React.MouseEvent<HTMLDivElement>) => {
                handleTagClick(tagCollectionId, event);
            },
            [handleTagClick]
        );

        // Toggles shortcuts between pinned (always visible) and inline (in main list) display
        const handleShortcutSplitToggle = useCallback(() => {
            uiDispatch({ type: 'SET_PIN_SHORTCUTS', value: !uiState.pinShortcuts });
        }, [uiDispatch, uiState.pinShortcuts]);

        // Scrolls shortcut into view - scrolls to top for pinned shortcuts or to item index for inline
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
                onNavigateToFolder(folder.path, { skipScroll: settings.skipAutoScroll, source: 'shortcut' });
                scheduleShortcutRelease();
                const container = rootContainerRef.current;
                if (container && !uiState.singlePane) {
                    container.focus();
                }
            },
            [setActiveShortcut, onNavigateToFolder, scheduleShortcutRelease, rootContainerRef, uiState.singlePane, settings.skipAutoScroll]
        );

        // Opens folder note when clicking on a shortcut label with an associated folder note
        const handleShortcutFolderNoteClick = useCallback(
            (folder: TFolder, shortcutKey: string, event: React.MouseEvent<HTMLSpanElement>) => {
                setActiveShortcut(shortcutKey);
                handleFolderNameClick(folder, event);
                scheduleShortcutRelease();
            },
            [handleFolderNameClick, scheduleShortcutRelease, setActiveShortcut]
        );

        const handleShortcutFolderNoteMouseDown = useCallback(
            (folder: TFolder, event: React.MouseEvent<HTMLSpanElement>) => {
                handleFolderNameMouseDown(folder, event);
            },
            [handleFolderNameMouseDown]
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

                // Open file in background leaf without activating it
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    runAsyncAction(() => leaf.openFile(note, { active: false }));
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
                app,
                isMobile,
                uiDispatch
            ]
        );

        // Handle middle-click on note items to open in a new tab
        const handleShortcutNoteMouseDown = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, note: TFile) => {
                // Check if middle mouse button (button 1) was clicked
                if (event.button !== 1) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                runAsyncAction(() => openFileInContext({ app, commandQueue, file: note, context: 'tab' }));
            },
            [app, commandQueue]
        );

        const handleRecentNoteActivate = useCallback(
            (note: TFile) => {
                if (selectionState.selectionType === ItemType.TAG && onRevealShortcutFile) {
                    onRevealShortcutFile(note);
                } else {
                    onRevealFile(note);
                }

                // Open file in background leaf without activating it
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    runAsyncAction(() => leaf.openFile(note, { active: false }));
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
                    runAsyncAction(() => onExecuteSearchShortcut(shortcutKey, searchShortcut));
                }
                scheduleShortcutRelease();
            },
            [setActiveShortcut, scrollShortcutIntoView, onExecuteSearchShortcut, scheduleShortcutRelease]
        );

        // Handles tag shortcut activation - navigates to tag and shows its files
        const handleShortcutTagActivate = useCallback(
            (tagPath: string, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                const canonicalPath = resolveCanonicalTagPath(tagPath, tagTree);
                if (!canonicalPath) {
                    scheduleShortcutRelease();
                    return;
                }
                onRevealTag(canonicalPath, { skipScroll: settings.skipAutoScroll, source: 'shortcut' });

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
            [
                setActiveShortcut,
                onRevealTag,
                uiState.singlePane,
                uiDispatch,
                rootContainerRef,
                selectionDispatch,
                scheduleShortcutRelease,
                tagTree,
                settings.skipAutoScroll
            ]
        );

        type ShortcutContextMenuTarget =
            | { type: 'folder'; key: string; folder: TFolder }
            | { type: 'note'; key: string; file: TFile }
            | { type: 'tag'; key: string; tagPath: string }
            | { type: 'search'; key: string }
            | { type: 'missing'; key: string; kind: 'folder' | 'note' | 'tag' };

        const handleShortcutContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, target: ShortcutContextMenuTarget) => {
                if (!settings.showShortcuts) {
                    return;
                }

                // Prevent context menu on drag handle elements
                const targetElement = event.target;
                if (targetElement instanceof HTMLElement && targetElement.closest('.nn-drag-handle')) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                const menu = new Menu();

                if (target.type === 'missing') {
                    menu.addItem(item => {
                        item.setTitle(strings.shortcuts.remove)
                            .setIcon('lucide-bookmark-x')
                            .onClick(() => {
                                runAsyncAction(() => removeShortcut(target.key));
                            });
                    });
                    menu.showAtMouseEvent(event.nativeEvent);
                    return;
                }

                if (target.type === 'search') {
                    menu.addItem(item => {
                        item.setTitle(strings.shortcuts.remove)
                            .setIcon('lucide-bookmark-x')
                            .onClick(() => {
                                runAsyncAction(() => removeShortcut(target.key));
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
                                    runAsyncAction(() => removeShortcut(target.key));
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
                        dispatchers
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

        const handleSectionContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, sectionId: NavigationSectionId) => {
                event.preventDefault();
                event.stopPropagation();

                const target = { type: 'section', id: sectionId } as const;
                const hasSeparator = metadataService.hasNavigationSeparator(target);
                const menu = new Menu();

                menu.addItem(item => {
                    item.setTitle(
                        hasSeparator ? strings.contextMenu.navigation.removeSeparator : strings.contextMenu.navigation.addSeparator
                    )
                        .setIcon('lucide-separator-horizontal')
                        .onClick(() => {
                            runAsyncAction(async () => {
                                if (hasSeparator) {
                                    await metadataService.removeNavigationSeparator(target);
                                    return;
                                }
                                await metadataService.addNavigationSeparator(target);
                            });
                        });
                });

                menu.showAtMouseEvent(event.nativeEvent);
            },
            [metadataService]
        );

        // Calculates the note count for a folder shortcut, using cache when available
        const getFolderShortcutCount = useCallback(
            (folder: TFolder): NoteCountInfo => {
                if (!settings.showNoteCount) {
                    return ZERO_NOTE_COUNT;
                }

                const precomputed = folderCounts.get(folder.path);
                if (precomputed) {
                    return precomputed;
                }

                // Extract folder note settings for the note count calculation
                const folderNoteSettings: FolderNoteDetectionSettings = {
                    enableFolderNotes: settings.enableFolderNotes,
                    folderNoteName: settings.folderNoteName
                };

                return calculateFolderNoteCounts(folder, {
                    app,
                    fileVisibility: settings.fileVisibility,
                    excludedFiles: effectiveFrontmatterExclusions,
                    excludedFolders: hiddenFolders,
                    includeDescendants: includeDescendantNotes,
                    showHiddenFolders: showHiddenItems,
                    hideFolderNoteInList: settings.hideFolderNoteInList,
                    folderNoteSettings
                });
            },
            [
                app,
                folderCounts,
                settings.showNoteCount,
                settings.fileVisibility,
                effectiveFrontmatterExclusions,
                hiddenFolders,
                includeDescendantNotes,
                showHiddenItems,
                settings.hideFolderNoteInList,
                settings.enableFolderNotes,
                settings.folderNoteName
            ]
        );

        // Calculates the note count for a tag shortcut, using cache when available
        const getTagShortcutCount = useCallback(
            (tagPath: string): NoteCountInfo => {
                const canonicalPath = resolveCanonicalTagPath(tagPath, tagTree);
                if (!canonicalPath) {
                    return ZERO_NOTE_COUNT;
                }
                if (!settings.showNoteCount) {
                    return ZERO_NOTE_COUNT;
                }

                const precomputed = tagCounts.get(canonicalPath);
                if (precomputed) {
                    return precomputed;
                }

                const tagNode = findTagNode(tagTree, canonicalPath);
                if (!tagNode) {
                    return ZERO_NOTE_COUNT;
                }

                // Calculate note counts for the tag and its descendants
                const current = tagNode.notesWithTag.size;
                if (!includeDescendantNotes) {
                    // Return only current tag's note count when descendants are disabled
                    return {
                        current,
                        descendants: 0,
                        total: current
                    };
                }

                // Calculate total notes including all descendant tags
                const total = getTotalNoteCount(tagNode);
                // Descendant count is the difference between total and current
                const descendants = Math.max(total - current, 0);
                return {
                    current,
                    descendants,
                    total
                };
            },
            [settings.showNoteCount, includeDescendantNotes, tagCounts, tagTree]
        );

        // Generates display label for missing note shortcuts, stripping .md extension
        const getMissingNoteLabel = useCallback((path: string): string => {
            const baseName = getPathBaseName(path);
            if (!baseName) {
                return '';
            }
            const dotIndex = baseName.lastIndexOf('.');
            if (dotIndex <= 0) {
                return baseName;
            }
            const namePart = baseName.substring(0, dotIndex);
            const extension = baseName.substring(dotIndex + 1);
            if (extension.toLowerCase() === 'md') {
                return namePart;
            }
            return baseName;
        }, []);

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

        // Updates banner height with threshold to prevent micro-adjustments
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
                        const isMissing = Boolean(item.isMissing);
                        const canInteract = Boolean(folder) && !isMissing;
                        if (!canInteract && !isMissing) {
                            return null;
                        }

                        const folderPath = isFolderShortcut(item.shortcut) ? item.shortcut.path : '';
                        const isRootShortcut = folderPath === '/';
                        const folderName = (() => {
                            if (isRootShortcut) {
                                return settings.customVaultName || app.vault.getName();
                            }
                            if (canInteract && folder) {
                                return folder.name;
                            }
                            return getPathBaseName(folderPath);
                        })();
                        const folderCountInfo = canInteract && folder ? getFolderShortcutCount(folder) : ZERO_NOTE_COUNT;
                        const folderNote = canInteract && folder && settings.enableFolderNotes ? getFolderNote(folder, settings) : null;

                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = !useMobileReorderMenu
                            ? buildShortcutDragHandlers(item.key, {
                                  itemType: ItemType.FOLDER,
                                  path: folder?.path ?? folderPath,
                                  icon: item.icon ?? 'lucide-folder',
                                  iconColor: item.color
                              })
                            : undefined;
                        const dragHandleConfig = useMobileReorderMenu ? getMobileShortcutHandleConfig(item.key) : shortcutDragHandleConfig;

                        const contextTarget: ShortcutContextMenuTarget =
                            canInteract && folder
                                ? { type: 'folder', key: item.key, folder }
                                : { type: 'missing', key: item.key, kind: 'folder' };
                        const shortcutBackground = isMissing ? undefined : getSolidBackground(item.backgroundColor);

                        return (
                            <ShortcutItem
                                icon={isMissing ? 'lucide-alert-triangle' : (item.icon ?? 'lucide-folder')}
                                color={isMissing ? undefined : item.color}
                                backgroundColor={shortcutBackground}
                                label={folderName}
                                description={undefined}
                                level={item.level}
                                type="folder"
                                countInfo={!isMissing ? folderCountInfo : undefined}
                                isExcluded={!isMissing ? item.isExcluded : undefined}
                                isDisabled={isMissing}
                                isMissing={isMissing}
                                onClick={() => {
                                    if (!folder) {
                                        return;
                                    }
                                    handleShortcutFolderActivate(folder, item.key);
                                }}
                                onContextMenu={event => handleShortcutContextMenu(event, contextTarget)}
                                dragHandlers={dragHandlers}
                                showDropIndicatorBefore={!useMobileReorderMenu && showBefore}
                                showDropIndicatorAfter={!useMobileReorderMenu && showAfter}
                                isDragSource={!useMobileReorderMenu && isDragSource}
                                dragHandleConfig={dragHandleConfig}
                                hasFolderNote={!isMissing && Boolean(folderNote)}
                                onLabelClick={
                                    folder && folderNote
                                        ? event => {
                                              handleShortcutFolderNoteClick(folder, item.key, event);
                                          }
                                        : undefined
                                }
                                onLabelMouseDown={
                                    folder && folderNote ? event => handleShortcutFolderNoteMouseDown(folder, event) : undefined
                                }
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_NOTE: {
                        const note = item.note;
                        const isMissing = Boolean(item.isMissing);
                        const canInteract = Boolean(note) && !isMissing;
                        const notePath = isNoteShortcut(item.shortcut) ? item.shortcut.path : '';

                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = !useMobileReorderMenu
                            ? buildShortcutDragHandlers(item.key, {
                                  itemType: ItemType.FILE,
                                  path: note?.path ?? notePath,
                                  icon: item.icon ?? 'lucide-file',
                                  iconColor: item.color
                              })
                            : undefined;
                        const dragHandleConfig = useMobileReorderMenu ? getMobileShortcutHandleConfig(item.key) : shortcutDragHandleConfig;

                        const label = (() => {
                            if (!note || !canInteract) {
                                return getMissingNoteLabel(notePath);
                            }
                            const displayName = getFileDisplayName(note);
                            const extensionSuffix = shouldShowExtensionSuffix(note) ? getExtensionSuffix(note) : '';
                            return extensionSuffix ? `${displayName}${extensionSuffix}` : displayName;
                        })();

                        const contextTarget: ShortcutContextMenuTarget =
                            canInteract && note
                                ? { type: 'note', key: item.key, file: note }
                                : { type: 'missing', key: item.key, kind: 'note' };

                        return (
                            <ShortcutItem
                                icon={isMissing ? 'lucide-alert-triangle' : (item.icon ?? 'lucide-file-text')}
                                color={isMissing ? undefined : item.color}
                                label={label}
                                description={undefined}
                                level={item.level}
                                type="note"
                                isDisabled={isMissing}
                                isMissing={isMissing}
                                onClick={() => {
                                    if (!note) {
                                        return;
                                    }
                                    handleShortcutNoteActivate(note, item.key);
                                }}
                                onMouseDown={event => {
                                    if (!note || !canInteract) {
                                        return;
                                    }
                                    handleShortcutNoteMouseDown(event, note);
                                }}
                                onContextMenu={event => handleShortcutContextMenu(event, contextTarget)}
                                dragHandlers={dragHandlers}
                                showDropIndicatorBefore={!useMobileReorderMenu && showBefore}
                                showDropIndicatorAfter={!useMobileReorderMenu && showAfter}
                                isDragSource={!useMobileReorderMenu && isDragSource}
                                dragHandleConfig={dragHandleConfig}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_SEARCH: {
                        const searchShortcut = item.searchShortcut;

                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = !useMobileReorderMenu
                            ? buildShortcutDragHandlers(item.key, {
                                  itemType: 'search',
                                  icon: item.icon ?? 'lucide-search',
                                  iconColor: item.color
                              })
                            : undefined;
                        const dragHandleConfig = useMobileReorderMenu ? getMobileShortcutHandleConfig(item.key) : shortcutDragHandleConfig;

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
                                showDropIndicatorBefore={!useMobileReorderMenu && showBefore}
                                showDropIndicatorAfter={!useMobileReorderMenu && showAfter}
                                isDragSource={!useMobileReorderMenu && isDragSource}
                                dragHandleConfig={dragHandleConfig}
                            />
                        );
                    }

                    case NavigationPaneItemType.SHORTCUT_TAG: {
                        const isMissing = Boolean(item.isMissing);
                        const tagPath = isTagShortcut(item.shortcut) ? item.shortcut.tagPath : item.tagPath;
                        const tagCountInfo = !isMissing ? getTagShortcutCount(tagPath) : ZERO_NOTE_COUNT;

                        const { showBefore, showAfter, isDragSource } = getShortcutVisualState(item.key);
                        const dragHandlers = !useMobileReorderMenu
                            ? buildShortcutDragHandlers(item.key, {
                                  itemType: ItemType.TAG,
                                  path: tagPath,
                                  icon: item.icon ?? 'lucide-tags',
                                  iconColor: item.color
                              })
                            : undefined;
                        const dragHandleConfig = useMobileReorderMenu ? getMobileShortcutHandleConfig(item.key) : shortcutDragHandleConfig;

                        const contextTarget: ShortcutContextMenuTarget = !isMissing
                            ? { type: 'tag', key: item.key, tagPath }
                            : { type: 'missing', key: item.key, kind: 'tag' };
                        const shortcutBackground = isMissing ? undefined : getSolidBackground(item.backgroundColor);

                        return (
                            <ShortcutItem
                                icon={isMissing ? 'lucide-alert-triangle' : (item.icon ?? 'lucide-tags')}
                                color={isMissing ? undefined : item.color}
                                backgroundColor={shortcutBackground}
                                label={item.displayName}
                                description={undefined}
                                level={item.level}
                                type="tag"
                                countInfo={!isMissing ? tagCountInfo : undefined}
                                isDisabled={isMissing}
                                isMissing={isMissing}
                                onClick={() => {
                                    if (isMissing) {
                                        return;
                                    }
                                    handleShortcutTagActivate(tagPath, item.key);
                                }}
                                onContextMenu={event => handleShortcutContextMenu(event, contextTarget)}
                                dragHandlers={dragHandlers}
                                showDropIndicatorBefore={!useMobileReorderMenu && showBefore}
                                showDropIndicatorAfter={!useMobileReorderMenu && showAfter}
                                isDragSource={!useMobileReorderMenu && isDragSource}
                                dragHandleConfig={dragHandleConfig}
                            />
                        );
                    }

                    case NavigationPaneItemType.FOLDER: {
                        const folderPath = item.data.path;
                        const countInfo = folderCounts.get(folderPath);
                        // Hide separator actions for the first inline folder when shortcuts are pinned
                        // This prevents users from adding/removing separators on the first item after pinned shortcuts
                        const shouldHideFolderSeparatorActions =
                            shouldPinShortcuts && firstInlineFolderPath !== null && folderPath === firstInlineFolderPath;

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
                                onNameClick={event => handleFolderNameClick(item.data, event)}
                                onNameMouseDown={event => handleFolderNameMouseDown(item.data, event)}
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
                                backgroundColor={getSolidBackground(item.backgroundColor)}
                                countInfo={countInfo}
                                excludedFolders={item.parsedExcludedFolders || []}
                                vaultChangeVersion={vaultChangeVersion}
                                disableNavigationSeparatorActions={shouldHideFolderSeparatorActions}
                            />
                        );
                    }

                    case NavigationPaneItemType.VIRTUAL_FOLDER: {
                        const virtualFolder = item.data;
                        const isShortcutsGroup = virtualFolder.id === SHORTCUTS_VIRTUAL_FOLDER_ID;
                        const isRecentNotesGroup = virtualFolder.id === RECENT_NOTES_VIRTUAL_FOLDER_ID;
                        let hasChildren = true;
                        if (isShortcutsGroup) {
                            hasChildren = hydratedShortcuts.length > 0;
                        } else if (isRecentNotesGroup) {
                            hasChildren = recentNotes.length > 0;
                        } else if (virtualFolder.id === 'tags-root') {
                            hasChildren = tagsVirtualFolderHasChildren;
                        }

                        const isExpanded = isShortcutsGroup
                            ? shortcutsExpanded
                            : isRecentNotesGroup
                              ? recentNotesExpanded
                              : expansionState.expandedVirtualFolders.has(virtualFolder.id);

                        const tagCollectionId = item.tagCollectionId ?? null;
                        const isTagCollection = Boolean(tagCollectionId);
                        const isSelected =
                            isTagCollection &&
                            selectionState.selectionType === ItemType.TAG &&
                            selectionState.selectedTag === tagCollectionId;
                        const collectionCountInfo = item.noteCount ?? (tagCollectionId ? tagCounts.get(tagCollectionId) : undefined);
                        const showFileCount = item.showFileCount ?? false;
                        let collectionSearchMatch: 'include' | 'exclude' | undefined;
                        if (tagCollectionId === TAGGED_TAG_ID) {
                            if (highlightExcludeTagged) {
                                collectionSearchMatch = 'exclude';
                            } else if (highlightRequireTagged) {
                                collectionSearchMatch = 'include';
                            }
                        }

                        const dropConfig =
                            virtualFolder.id === 'tags-root'
                                ? {
                                      zone: 'tag-root',
                                      path: '__nn-tag-root__',
                                      allowExternalDrop: false
                                  }
                                : undefined;

                        const sectionId = isShortcutsGroup
                            ? NavigationSectionId.SHORTCUTS
                            : isRecentNotesGroup
                              ? NavigationSectionId.RECENT
                              : virtualFolder.id === 'tags-root'
                                ? NavigationSectionId.TAGS
                                : null;

                        const shouldDisableShortcutMenu = isShortcutsGroup && shouldPinShortcuts;
                        const shouldDisableFirstSectionMenu =
                            shouldPinShortcuts && sectionId !== null && firstSectionId !== null && sectionId === firstSectionId;
                        // When shortcuts are pinned they render in their own panel, so the section header hides context menus by design.
                        // Shortcuts have to be unpinned to edit the first inline section separator
                        const sectionContextMenu =
                            sectionId !== null && !shouldDisableShortcutMenu && !shouldDisableFirstSectionMenu
                                ? (event: React.MouseEvent<HTMLDivElement>) => handleSectionContextMenu(event, sectionId)
                                : undefined;

                        return (
                            <VirtualFolderComponent
                                virtualFolder={virtualFolder}
                                level={item.level}
                                isExpanded={isExpanded}
                                hasChildren={hasChildren}
                                isSelected={Boolean(isSelected)}
                                showFileCount={showFileCount}
                                countInfo={collectionCountInfo}
                                searchMatch={collectionSearchMatch}
                                onSelect={
                                    isTagCollection && tagCollectionId
                                        ? event => handleTagCollectionClick(tagCollectionId, event)
                                        : undefined
                                }
                                onToggle={() => handleVirtualFolderToggle(virtualFolder.id)}
                                onDragOver={isShortcutsGroup && allowEmptyShortcutDrop ? handleShortcutRootDragOver : undefined}
                                onDrop={isShortcutsGroup && allowEmptyShortcutDrop ? handleShortcutRootDrop : undefined}
                                onDragLeave={isShortcutsGroup && allowEmptyShortcutDrop ? handleShortcutRootDragLeave : undefined}
                                dropConfig={dropConfig}
                                onContextMenu={sectionContextMenu}
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
                        let searchMatch: 'include' | 'exclude' | undefined;
                        if (tagNode.path === UNTAGGED_TAG_ID) {
                            if (highlightIncludeUntagged) {
                                searchMatch = 'include';
                            } else if (highlightExcludeTagged) {
                                searchMatch = 'exclude';
                            }
                        } else if (searchExcludeTokenSet?.has(tagNode.path)) {
                            searchMatch = 'exclude';
                        } else if (searchIncludeTokenSet?.has(tagNode.path)) {
                            searchMatch = 'include';
                        }
                        return (
                            <TagTreeItem
                                tagNode={tagNode}
                                level={item.level ?? 0}
                                isExpanded={expansionState.expandedTags.has(tagNode.path)}
                                isSelected={selectionState.selectionType === ItemType.TAG && selectionState.selectedTag === tagNode.path}
                                isHidden={'isHidden' in item ? item.isHidden : false}
                                onToggle={() => handleTagToggle(tagNode.path)}
                                onClick={event => handleTagClick(tagNode.path, event)}
                                color={item.color}
                                backgroundColor={getSolidBackground(item.backgroundColor)}
                                icon={item.icon}
                                searchMatch={searchMatch}
                                isDraggable={!isMobile && tagNode.path !== UNTAGGED_TAG_ID && tagNode.path !== TAGGED_TAG_ID}
                                onToggleAllSiblings={() => {
                                    const isCurrentlyExpanded = expansionState.expandedTags.has(tagNode.path);

                                    if (isCurrentlyExpanded) {
                                        // If expanded, collapse everything (parent and all descendants)
                                        handleTagToggle(tagNode.path);
                                        const descendantPaths = getAllDescendantTags(tagNode.path);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_TAGS', descendantPaths, expand: false });
                                        }
                                    } else {
                                        // If collapsed, expand parent and all descendants
                                        handleTagToggle(tagNode.path);
                                        const descendantPaths = getAllDescendantTags(tagNode.path);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_TAGS', descendantPaths, expand: true });
                                        }
                                    }
                                }}
                                countInfo={tagCounts.get(tagNode.path)}
                                showFileCount={settings.showNoteCount}
                            />
                        );
                    }

                    case NavigationPaneItemType.BANNER: {
                        return <NavigationBanner path={item.path} onHeightChange={handleBannerHeightChange} />;
                    }

                    case NavigationPaneItemType.TOP_SPACER: {
                        const spacerClass = item.hasSeparator ? 'nn-nav-top-spacer nn-nav-spacer--with-separator' : 'nn-nav-top-spacer';
                        return <div className={spacerClass} />;
                    }

                    case NavigationPaneItemType.BOTTOM_SPACER: {
                        return <div className="nn-nav-bottom-spacer" />;
                    }

                    case NavigationPaneItemType.LIST_SPACER: {
                        const spacerClass = item.hasSeparator ? 'nn-nav-list-spacer nn-nav-spacer--with-separator' : 'nn-nav-list-spacer';
                        return <div className={spacerClass} />;
                    }

                    case NavigationPaneItemType.ROOT_SPACER: {
                        return <div className="nn-nav-root-spacer" style={{ height: `${item.spacing}px` }} aria-hidden="true" />;
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
                handleFolderNameMouseDown,
                handleTagToggle,
                handleTagClick,
                handleTagCollectionClick,
                handleSectionContextMenu,
                firstSectionId,
                firstInlineFolderPath,
                handleVirtualFolderToggle,
                recentNotes.length,
                getAllDescendantFolders,
                getAllDescendantTags,
                expansionDispatch,
                app.vault,
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
                getMobileShortcutHandleConfig,
                buildShortcutDragHandlers,
                hydratedShortcuts,
                shortcutsExpanded,
                shouldPinShortcuts,
                recentNotesExpanded,
                getFileDisplayName,
                shortcutDragHandleConfig,
                handleBannerHeightChange,
                handleShortcutRootDragOver,
                handleShortcutRootDrop,
                handleShortcutRootDragLeave,
                allowEmptyShortcutDrop,
                getMissingNoteLabel,
                handleShortcutFolderNoteClick,
                handleShortcutFolderNoteMouseDown,
                isMobile,
                useMobileReorderMenu,
                tagsVirtualFolderHasChildren,
                searchIncludeTokenSet,
                searchExcludeTokenSet,
                highlightRequireTagged,
                highlightExcludeTagged,
                highlightIncludeUntagged,
                getSolidBackground,
                vaultChangeVersion
            ]
        );

        useEffect(() => {
            if (settings.showAllTagsFolder) {
                const shouldAutoExpandTags = !prevShowAllTagsFolder.current && settings.showAllTagsFolder;

                if (shouldAutoExpandTags && !expansionState.expandedVirtualFolders.has('tags-root')) {
                    expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId: 'tags-root' });
                }
            }

            prevShowAllTagsFolder.current = settings.showAllTagsFolder;
        }, [settings.showAllTagsFolder, expansionState.expandedVirtualFolders, expansionDispatch]);

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
            <div ref={navigationPaneRef} className="nn-navigation-pane" style={props.style}>
                <NavigationPaneHeader
                    onTreeUpdateComplete={handleTreeUpdateComplete}
                    onTogglePinnedShortcuts={settings.showShortcuts ? handleShortcutSplitToggle : undefined}
                    onToggleRootFolderReorder={handleToggleRootReorder}
                    rootReorderActive={isRootReorderMode}
                    rootReorderDisabled={!canReorderRootItems}
                />
                {/* Android - toolbar at top */}
                {isMobile && isAndroid && (
                    <NavigationToolbar
                        onTreeUpdateComplete={handleTreeUpdateComplete}
                        onTogglePinnedShortcuts={settings.showShortcuts ? handleShortcutSplitToggle : undefined}
                        onToggleRootFolderReorder={handleToggleRootReorder}
                        rootReorderActive={isRootReorderMode}
                        rootReorderDisabled={!canReorderRootItems}
                    />
                )}
                {pinnedShortcutItems.length > 0 && !isRootReorderMode ? (
                    <div
                        className="nn-shortcut-pinned"
                        role="presentation"
                        data-has-banner={shouldShowPinnedBanner ? 'true' : undefined}
                        onDragOver={allowEmptyShortcutDrop ? handleShortcutRootDragOver : undefined}
                        onDrop={allowEmptyShortcutDrop ? handleShortcutRootDrop : undefined}
                        onDragLeave={allowEmptyShortcutDrop ? handleShortcutRootDragLeave : undefined}
                    >
                        {shouldShowPinnedBanner && navigationBannerPath ? (
                            <NavigationBanner path={navigationBannerPath} onHeightChange={handleBannerHeightChange} />
                        ) : null}
                        <div className="nn-shortcut-pinned-inner">
                            {pinnedShortcutItems.map(shortcutItem => (
                                <React.Fragment key={shortcutItem.key}>{renderItem(shortcutItem)}</React.Fragment>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div
                    ref={scrollContainerRefCallback}
                    className="nn-navigation-pane-scroller"
                    // Reserve permanent gutter width when a banner is visible so the scrollbar
                    // never changes clientWidth mid-resize (prevents RO feedback loops).
                    data-banner={hasNavigationBannerConfigured ? 'true' : undefined}
                    data-pane="navigation"
                    role={isRootReorderMode ? 'list' : 'tree'}
                    tabIndex={-1}
                >
                    {isRootReorderMode ? (
                        <NavigationRootReorderPanel
                            sectionItems={sectionReorderItems}
                            folderItems={folderReorderItems}
                            tagItems={tagReorderItems}
                            showRootFolderSection={showRootFolderSection}
                            showRootTagSection={showRootTagSection}
                            foldersSectionExpanded={foldersSectionExpanded}
                            tagsSectionExpanded={tagsSectionExpanded}
                            showRootFolderReset={settings.rootFolderOrder.length > 0}
                            showRootTagReset={settings.rootTagOrder.length > 0}
                            resetRootTagOrderLabel={resetRootTagOrderLabel}
                            onResetRootFolderOrder={handleResetRootFolderOrder}
                            onResetRootTagOrder={handleResetRootTagOrder}
                        />
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
                {/* iOS - toolbar at bottom */}
                {isMobile && !isAndroid && (
                    <NavigationToolbar
                        onTreeUpdateComplete={handleTreeUpdateComplete}
                        onTogglePinnedShortcuts={settings.showShortcuts ? handleShortcutSplitToggle : undefined}
                        onToggleRootFolderReorder={handleToggleRootReorder}
                        rootReorderActive={isRootReorderMode}
                        rootReorderDisabled={!canReorderRootItems}
                    />
                )}
            </div>
        );
    })
);
