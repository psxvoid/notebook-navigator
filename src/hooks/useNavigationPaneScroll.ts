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
 * useNavigationPaneScroll - Orchestrates scrolling for the NavigationPane component
 *
 * ## Problem this solves:
 * When the tree structure changes (e.g., toggling "show hidden items"), the indices
 * of items shift. Without proper synchronization, scrolling to a "remembered" index
 * would land on the wrong item because the tree has changed underneath.
 *
 * ## Solution:
 * Version-based synchronization with intent-driven scrolling. Each tree rebuild
 * increments an indexVersion, and scrolls are gated to only execute when the
 * version meets requirements.
 *
 * ## Key concepts:
 * - **Index versioning**: Increments when pathToIndex changes (tree rebuild)
 * - **Pending scrolls**: Path-based requests that execute when conditions are met
 * - **Intent types**: Different scroll reasons (selection, visibilityToggle, etc.)
 * - **Version gating**: Scrolls wait for minIndexVersion before executing
 * - **Late resolution**: Index is resolved from path at execution time, not storage time
 *
 * ## Handles:
 * - Virtual list initialization with TanStack Virtual
 * - Selection changes (folder/tag selection)
 * - Visibility toggles (show/hide hidden items)
 * - Mobile drawer visibility
 * - External scroll requests (reveal operations)
 * - Settings changes (line height, indentation)
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useServices } from '../context/ServicesContext';
import { useSelectionState } from '../context/SelectionContext';
import { useUIState } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { NavigationPaneItemType, ItemType, NAVPANE_MEASUREMENTS, OVERSCAN } from '../types';
import { Align, NavScrollIntent, getNavAlign } from '../types/scroll';
import type { CombinedNavigationItem } from '../types/virtualization';
import { getNavigationIndex, normalizeNavigationPath } from '../utils/navigationIndex';

/**
 * Parameters for the useNavigationPaneScroll hook
 */
interface UseNavigationPaneScrollParams {
    /** Navigation items to be rendered */
    items: CombinedNavigationItem[];
    /** Map from paths to their index in items */
    pathToIndex: Map<string, number>;
    /** Whether the navigation pane is currently visible */
    isVisible: boolean;
    /** Currently active shortcut id (if any) */
    activeShortcutKey: string | null;
    /** Measured height of the navigation banner (if configured) */
    bannerHeight: number;
}

/**
 * Return value of the useNavigationPaneScroll hook
 */
interface UseNavigationPaneScrollResult {
    /** TanStack Virtual virtualizer instance */
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Reference to the scroll container element */
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    /** Handler to scroll to top (mobile header tap) */
    handleScrollToTop: () => void;
    /** Request a scroll to a specific path */
    requestScroll: (path: string, options: { align?: Align; itemType: ItemType }) => void;
    /** Version counter for pending scrolls */
    pendingScrollVersion: number;
}

/**
 * Hook that manages scrolling behavior for the NavigationPane component.
 * Handles virtualization, scroll position, and various scroll scenarios.
 *
 * @param params - Configuration parameters
 * @returns Virtualizer instance and scroll management utilities
 */
export function useNavigationPaneScroll({
    items,
    pathToIndex,
    isVisible,
    activeShortcutKey,
    bannerHeight
}: UseNavigationPaneScrollParams): UseNavigationPaneScrollResult {
    const { isMobile } = useServices();
    const selectionState = useSelectionState();
    const uiState = useUIState();
    const settings = useSettingsState();

    // Reference to the scroll container DOM element
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Resolves a path to its index in the navigation items array
    const resolveIndex = useCallback(
        (path: string | null | undefined, itemType?: ItemType) => {
            if (!path) {
                return undefined;
            }

            if (itemType) {
                return getNavigationIndex(pathToIndex, itemType, path);
            }

            // Try folder first, then tag if not found
            const folderIndex = getNavigationIndex(pathToIndex, ItemType.FOLDER, path);
            if (folderIndex !== undefined) {
                return folderIndex;
            }

            return getNavigationIndex(pathToIndex, ItemType.TAG, path);
        },
        [pathToIndex]
    );

    // ========== Scroll Orchestration ==========
    // Intent types determine scroll priority and behavior
    type ScrollIntent = NavScrollIntent;

    // Pending scroll stores the request until conditions are met
    type PendingScroll = {
        path: string; // Target path to scroll to (resolved to index at execution)
        align?: Align;
        intent?: ScrollIntent; // Why this scroll was requested
        minIndexVersion?: number; // Don't execute until indexVersion >= this value
        itemType: ItemType; // Item type for resolving correct index map
    };
    const pendingScrollRef = useRef<PendingScroll | null>(null);
    const [pendingScrollVersion, setPendingScrollVersion] = useState(0); // Triggers effect re-run

    // ========== Index Version Tracking ==========
    // Increments each time the tree rebuilds to ensure scrolls execute with correct indices
    const indexVersionRef = useRef<number>(0);
    const prevPathToIndexObjRef = useRef<Map<string, number> | null>(null);

    // Track previous values to detect actual changes
    const prevSelectedPathRef = useRef<string | null>(null);
    const prevVisibleRef = useRef<boolean>(false);
    const prevFocusedPaneRef = useRef<string | null>(null);
    const prevSelectedTagRef = useRef<string | null>(null);
    const prevNavSettingsKeyRef = useRef<string>('');
    const prevShowHiddenItemsRef = useRef<boolean>(settings.showHiddenItems);
    const prevPathToIndexSizeRef = useRef<number>(pathToIndex.size);

    /**
     * Increment indexVersion when tree structure changes.
     * This is critical for version gating - ensures pending scrolls wait for
     * the new tree structure before executing.
     */
    useEffect(() => {
        const sizeChanged = prevPathToIndexSizeRef.current !== pathToIndex.size;
        const identityChanged = prevPathToIndexObjRef.current !== pathToIndex;

        if (sizeChanged || identityChanged) {
            const prevVersion = indexVersionRef.current;
            indexVersionRef.current = prevVersion + 1;
            prevPathToIndexSizeRef.current = pathToIndex.size;
            prevPathToIndexObjRef.current = pathToIndex;
        }
    }, [pathToIndex, pathToIndex.size]);

    /**
     * Initialize TanStack Virtual virtualizer with dynamic heights for navigation items
     */
    const rowVirtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: index => {
            const item = items[index];

            // Use dynamic line height settings for folder and tag items
            const itemHeight = isMobile ? settings.navItemHeight + NAVPANE_MEASUREMENTS.mobileHeightIncrement : settings.navItemHeight;

            switch (item.type) {
                case NavigationPaneItemType.TOP_SPACER:
                    return NAVPANE_MEASUREMENTS.topSpacer;
                case NavigationPaneItemType.BOTTOM_SPACER:
                    return NAVPANE_MEASUREMENTS.bottomSpacer;
                case NavigationPaneItemType.LIST_SPACER:
                    return NAVPANE_MEASUREMENTS.listSpacer;
                case NavigationPaneItemType.BANNER:
                    // Fall back to a small spacer height until ResizeObserver reports the real banner height
                    return bannerHeight > 0 ? bannerHeight : NAVPANE_MEASUREMENTS.topSpacer;
                case NavigationPaneItemType.FOLDER:
                case NavigationPaneItemType.VIRTUAL_FOLDER:
                    return itemHeight;
                case NavigationPaneItemType.TAG:
                case NavigationPaneItemType.UNTAGGED:
                    return itemHeight;
                default:
                    return itemHeight; // fallback
            }
        },
        overscan: OVERSCAN
    });

    /**
     * Scroll to top handler for mobile header tap
     */
    const handleScrollToTop = useCallback(() => {
        if (isMobile && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isMobile]);

    /**
     * Request a scroll to a specific path
     * Used by external components like useNavigatorReveal
     */
    const requestScroll = useCallback((path: string, options: { align?: Align; itemType: ItemType }) => {
        const normalizedPath = normalizeNavigationPath(options.itemType, path);
        pendingScrollRef.current = {
            path: normalizedPath,
            align: options.align,
            intent: 'external',
            minIndexVersion: indexVersionRef.current,
            itemType: options.itemType
        };
        setPendingScrollVersion(v => v + 1);
    }, []);

    // Extract and normalize the currently selected path from selection state
    const selectedPath =
        selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder
            ? normalizeNavigationPath(ItemType.FOLDER, selectionState.selectedFolder.path)
            : selectionState.selectionType === ItemType.TAG && selectionState.selectedTag
              ? normalizeNavigationPath(ItemType.TAG, selectionState.selectedTag)
              : null;

    /**
     * Scroll to selected folder/tag when needed
     * Only scrolls when:
     * 1. Selection actually changes (not just tree structure changes)
     * 2. Pane becomes visible or gains focus
     * 3. During reveal operations (handled separately)
     * NAV_SCROLL_SELECTION: Auto-scrolls to selected folder/tag
     */
    useEffect(() => {
        if (!selectedPath || !rowVirtualizer || !isVisible) return;

        const currentSelectionType = selectionState.selectionType === ItemType.TAG ? ItemType.TAG : ItemType.FOLDER;

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

        // Skip scroll when a shortcut is active (prevents interference)
        if (activeShortcutKey) {
            return;
        }

        // CRITICAL: Guard against race condition during visibility toggle
        // When showHiddenItems changes, the tree will rebuild with different indices.
        // We must defer this scroll until AFTER the rebuild completes.
        if (prevShowHiddenItemsRef.current !== settings.showHiddenItems) {
            pendingScrollRef.current = {
                path: selectedPath,
                align: 'auto',
                intent: 'visibilityToggle',
                minIndexVersion: indexVersionRef.current + 1, // Wait for next version
                itemType: currentSelectionType
            };
            setPendingScrollVersion(v => v + 1);
            return;
        }

        const index = resolveIndex(selectedPath, currentSelectionType);

        if (index !== undefined && index >= 0) {
            rowVirtualizer.scrollToIndex(index, { align: getNavAlign('selection') });
        }
    }, [
        selectedPath,
        rowVirtualizer,
        isVisible,
        uiState.focusedPane,
        settings.showHiddenItems,
        selectionState.selectionType,
        resolveIndex,
        activeShortcutKey
    ]);

    /**
     * Special handling for startup tag scrolling
     * Tags load after folders, so we need a separate effect to catch when they become available
     * NAV_SCROLL_STARTUP_TAG: Scrolls to selected tag after tags load
     */
    useEffect(() => {
        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag && rowVirtualizer && isVisible) {
            // Skip tag scrolling when a shortcut is active
            if (activeShortcutKey) {
                prevSelectedTagRef.current = selectionState.selectedTag;
                return;
            }
            // Check if this is an actual tag selection change
            const isTagSelectionChange = prevSelectedTagRef.current !== selectionState.selectedTag;

            // Update the ref for next comparison
            prevSelectedTagRef.current = selectionState.selectedTag;

            // Only scroll on actual tag selection changes
            if (!isTagSelectionChange) return;

            // During a hidden-items toggle, defer immediate tag scroll and queue a toggle-intent pending
            if (prevShowHiddenItemsRef.current !== settings.showHiddenItems) {
                if (selectedPath) {
                    pendingScrollRef.current = {
                        path: selectedPath,
                        align: 'auto',
                        intent: 'visibilityToggle',
                        minIndexVersion: indexVersionRef.current + 1,
                        itemType: ItemType.TAG
                    };
                    setPendingScrollVersion(v => v + 1);
                }
                return;
            }

            const tagIndex = resolveIndex(selectionState.selectedTag, ItemType.TAG);

            if (tagIndex !== undefined && tagIndex >= 0) {
                rowVirtualizer.scrollToIndex(tagIndex, { align: getNavAlign('selection') });
            }
        }
    }, [
        pathToIndex,
        selectionState.selectionType,
        selectionState.selectedTag,
        rowVirtualizer,
        isVisible,
        settings.showHiddenItems,
        selectedPath,
        resolveIndex,
        activeShortcutKey
    ]);

    /**
     * Process pending scrolls when conditions are met.
     * This is the heart of the scroll orchestration system.
     *
     * Execution requirements:
     * 1. Pane must be visible
     * 2. Virtualizer must be ready
     * 3. indexVersion must meet minimum requirement
     * 4. During visibility toggles, only visibilityToggle intents execute
     */
    useEffect(() => {
        if (!rowVirtualizer || !pendingScrollRef.current || !isVisible) return;

        const { path, align, intent, minIndexVersion, itemType } = pendingScrollRef.current;

        // Priority check: During visibility toggle, only process toggle-intent scrolls
        // This prevents stale selection scrolls from executing with wrong indices
        if (prevShowHiddenItemsRef.current !== settings.showHiddenItems && intent !== 'visibilityToggle') {
            return;
        }

        // Version gate: Wait for tree rebuild if required
        // This is what prevents scrolling to wrong indices after tree changes
        const effectiveMin = minIndexVersion ?? indexVersionRef.current;
        if (indexVersionRef.current < effectiveMin) return;

        const index = resolveIndex(path, itemType);

        if (index !== undefined && index !== -1) {
            const finalAlign: Align = align ?? getNavAlign(intent);
            rowVirtualizer.scrollToIndex(index, { align: finalAlign });
            pendingScrollRef.current = null;

            // Stabilization mechanism: Handle rare double rebuilds
            // Some operations trigger multiple rapid tree rebuilds. After executing
            // a visibilityToggle scroll, we check if the index changed again and
            // queue a follow-up scroll if needed.
            if (intent === 'visibilityToggle') {
                const usedIndex = index;
                const usedPath = path;
                requestAnimationFrame(() => {
                    const newIndex = resolveIndex(usedPath, itemType);
                    if (newIndex !== undefined && newIndex !== usedIndex) {
                        pendingScrollRef.current = {
                            path: usedPath,
                            align: 'auto',
                            intent: 'visibilityToggle',
                            minIndexVersion: indexVersionRef.current + 1,
                            itemType
                        };
                        setPendingScrollVersion(v => v + 1);
                    }
                });
            }
        }
        // If index not found, keep the pending scroll for next rebuild
    }, [rowVirtualizer, isVisible, pendingScrollVersion, settings.showHiddenItems, resolveIndex]);

    /**
     * Listen for mobile drawer visibility events
     * NAV_SCROLL_MOBILE_VISIBILITY: Auto-scrolls when drawer becomes visible
     */
    useEffect(() => {
        if (!isMobile) return;

        const handleVisible = () => {
            // Skip mobile visibility scroll when a shortcut is active
            if (activeShortcutKey) {
                return;
            }
            // If we have a selected folder or tag, scroll to it
            if (selectedPath && rowVirtualizer) {
                const index = resolveIndex(selectedPath, selectionState.selectionType === ItemType.TAG ? ItemType.TAG : ItemType.FOLDER);
                if (index !== undefined && index >= 0) {
                    rowVirtualizer.scrollToIndex(index, { align: 'auto' });
                }
            }
        };

        window.addEventListener('notebook-navigator-visible', handleVisible);
        return () => window.removeEventListener('notebook-navigator-visible', handleVisible);
    }, [isMobile, selectedPath, rowVirtualizer, selectionState.selectionType, resolveIndex, activeShortcutKey]);

    /**
     * Re-measure all items when line height settings change
     * This ensures the virtualizer immediately updates when settings are adjusted
     */
    useEffect(() => {
        if (!rowVirtualizer) return;

        // Re-measure all items with new heights
        rowVirtualizer.measure();
    }, [settings.navItemHeight, settings.navIndent, rowVirtualizer]);

    /**
     * Scroll to maintain position only when settings actually change
     * Uses a settings key to detect real changes
     */
    useEffect(() => {
        const settingsKey = `${settings.navItemHeight}-${settings.navIndent}`;
        const settingsChanged = prevNavSettingsKeyRef.current && prevNavSettingsKeyRef.current !== settingsKey;

        // Skip settings-triggered scroll when a shortcut is active
        if (activeShortcutKey) {
            prevNavSettingsKeyRef.current = settingsKey;
            return;
        }

        if (settingsChanged) {
            if (selectedPath && isVisible && rowVirtualizer) {
                const index = resolveIndex(selectedPath, selectionState.selectionType === ItemType.TAG ? ItemType.TAG : ItemType.FOLDER);
                if (index !== undefined && index >= 0) {
                    // Use requestAnimationFrame to ensure measurements are complete
                    requestAnimationFrame(() => {
                        rowVirtualizer.scrollToIndex(index, { align: 'auto' });
                    });
                }
            }
        }

        prevNavSettingsKeyRef.current = settingsKey;
    }, [
        settings.navItemHeight,
        settings.navIndent,
        selectedPath,
        isVisible,
        rowVirtualizer,
        resolveIndex,
        selectionState.selectionType,
        activeShortcutKey
    ]);

    /**
     * Track showHiddenItems setting changes specifically
     * This is what triggers the tag tree rebuild issue
     */
    useEffect(() => {
        if (prevShowHiddenItemsRef.current !== settings.showHiddenItems) {
            // When showHiddenItems changes and we have a selected tag, defer scrolling until the tree rebuilds
            if (selectedPath && selectionState.selectionType === ItemType.TAG && isVisible && rowVirtualizer) {
                // Set a pending scroll to be processed after the next index rebuild
                pendingScrollRef.current = {
                    path: selectedPath,
                    align: 'auto',
                    intent: 'visibilityToggle',
                    minIndexVersion: indexVersionRef.current + 1,
                    itemType: ItemType.TAG
                };
                setPendingScrollVersion(v => v + 1);
            }

            prevShowHiddenItemsRef.current = settings.showHiddenItems;
        }
    }, [settings.showHiddenItems, selectedPath, isVisible, rowVirtualizer, selectionState.selectionType, selectionState.selectedTag]);

    return {
        rowVirtualizer,
        scrollContainerRef,
        handleScrollToTop,
        requestScroll,
        pendingScrollVersion
    };
}
