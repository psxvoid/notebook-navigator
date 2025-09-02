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
 * useNavigationPaneScroll - Manages scrolling behavior for the NavigationPane component
 *
 * This hook handles:
 * - Virtual list initialization with TanStack Virtual
 * - Scroll to selected item (folder/tag)
 * - Pending scroll operations for deferred scrolling
 * - Mobile-specific scroll behaviors
 * - Focus and visibility-based scrolling
 * - Requested scrolls from external components
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useServices } from '../context/ServicesContext';
import { useSelectionState } from '../context/SelectionContext';
import { useUIState } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { NavigationPaneItemType, ItemType, NAVPANE_MEASUREMENTS, OVERSCAN } from '../types';
import type { CombinedNavigationItem } from '../types/virtualization';

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
    requestScroll: (path: string) => void;
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
export function useNavigationPaneScroll({ items, pathToIndex, isVisible }: UseNavigationPaneScrollParams): UseNavigationPaneScrollResult {
    const { isMobile } = useServices();
    const selectionState = useSelectionState();
    const uiState = useUIState();
    const settings = useSettingsState();

    // Reference to the scroll container DOM element
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Pending scroll state for handling reveal operations
    const pendingScrollRef = useRef<string | null>(null);
    const [pendingScrollVersion, setPendingScrollVersion] = useState(0);

    // Track previous values to detect actual changes
    const prevSelectedPathRef = useRef<string | null>(null);
    const prevVisibleRef = useRef<boolean>(false);
    const prevFocusedPaneRef = useRef<string | null>(null);
    const prevSelectedTagRef = useRef<string | null>(null);

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
    const requestScroll = useCallback((path: string) => {
        pendingScrollRef.current = path;
        setPendingScrollVersion(v => v + 1);
    }, []);

    /**
     * Get the current selected path based on selection type
     */
    const selectedPath =
        selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder
            ? selectionState.selectedFolder.path
            : selectionState.selectionType === ItemType.TAG && selectionState.selectedTag
              ? selectionState.selectedTag.startsWith('#')
                  ? selectionState.selectedTag.slice(1)
                  : selectionState.selectedTag
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

        const index = pathToIndex.get(selectedPath);

        if (index !== undefined && index >= 0) {
            rowVirtualizer.scrollToIndex(index, {
                align: 'auto',
                behavior: 'auto'
            });
        }
    }, [selectedPath, rowVirtualizer, isVisible, pathToIndex, uiState.focusedPane]);

    /**
     * Special handling for startup tag scrolling
     * Tags load after folders, so we need a separate effect to catch when they become available
     * NAV_SCROLL_STARTUP_TAG: Scrolls to selected tag after tags load
     */
    useEffect(() => {
        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag && rowVirtualizer && isVisible) {
            // Check if this is an actual tag selection change
            const isTagSelectionChange = prevSelectedTagRef.current !== selectionState.selectedTag;

            // Update the ref for next comparison
            prevSelectedTagRef.current = selectionState.selectedTag;

            // Only scroll on actual tag selection changes
            if (!isTagSelectionChange) return;

            const tagIndex = pathToIndex.get(selectionState.selectedTag);

            if (tagIndex !== undefined && tagIndex >= 0) {
                rowVirtualizer.scrollToIndex(tagIndex, {
                    align: 'auto',
                    behavior: 'auto'
                });
            }
        }
    }, [pathToIndex, selectionState.selectionType, selectionState.selectedTag, rowVirtualizer, isVisible]);

    /**
     * Process pending scrolls when pathToIndex is ready
     * NAV_SCROLL_PENDING: Centers requested items from external components
     */
    useEffect(() => {
        if (!rowVirtualizer || !pendingScrollRef.current || !isVisible) {
            return;
        }

        const pathToScroll = pendingScrollRef.current;
        const index = pathToIndex.get(pathToScroll);

        if (index !== undefined && index !== -1) {
            rowVirtualizer.scrollToIndex(index, { align: 'center', behavior: 'auto' });
            pendingScrollRef.current = null;
        }
        // If index not found, keep the pending scroll for next rebuild
    }, [rowVirtualizer, pathToIndex, isVisible, pendingScrollVersion]);

    /**
     * Listen for mobile drawer visibility events
     * NAV_SCROLL_MOBILE_VISIBILITY: Auto-scrolls when drawer becomes visible
     */
    useEffect(() => {
        if (!isMobile) return;

        const handleVisible = () => {
            // If we have a selected folder or tag, scroll to it
            if (selectedPath && rowVirtualizer) {
                const index = pathToIndex.get(selectedPath);
                if (index !== undefined && index >= 0) {
                    rowVirtualizer.scrollToIndex(index, {
                        align: 'auto',
                        behavior: 'auto'
                    });
                }
            }
        };

        window.addEventListener('notebook-navigator-visible', handleVisible);
        return () => window.removeEventListener('notebook-navigator-visible', handleVisible);
    }, [isMobile, selectedPath, rowVirtualizer, pathToIndex]);

    /**
     * Re-measure all items when line height settings change
     * This ensures the virtualizer immediately updates when settings are adjusted
     * Also scroll to selected item to maintain position
     */
    useEffect(() => {
        if (!rowVirtualizer) return;

        // Re-measure all items with new heights
        rowVirtualizer.measure();

        // Scroll to selected item to maintain position after settings change
        if (selectedPath && isVisible) {
            const index = pathToIndex.get(selectedPath);
            if (index !== undefined && index >= 0) {
                // Use requestAnimationFrame to ensure measurements are complete
                requestAnimationFrame(() => {
                    rowVirtualizer.scrollToIndex(index, {
                        align: 'auto',
                        behavior: 'auto'
                    });
                });
            }
        }
    }, [settings.navItemHeight, settings.navIndent, rowVirtualizer, selectedPath, pathToIndex, isVisible]);

    return {
        rowVirtualizer,
        scrollContainerRef,
        handleScrollToTop,
        requestScroll,
        pendingScrollVersion
    };
}
