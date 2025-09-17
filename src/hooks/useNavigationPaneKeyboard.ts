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
 * useNavigationPaneKeyboard - Keyboard navigation for the navigation pane
 *
 * This hook handles navigation-specific keyboard interactions:
 * - Folder/tag selection with arrow keys
 * - Expand/collapse with left/right arrows
 * - Navigate to parent items
 * - Delete folders
 * - Tab/arrow navigation to switch panes
 * - Page navigation
 */

import { useCallback } from 'react';
import { TFolder } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { NavigationPaneItemType, ItemType } from '../types';
import type { CombinedNavigationItem } from '../types/virtualization';
import { deleteSelectedFolder } from '../utils/deleteOperations';
import { useKeyboardNavigation, KeyboardNavigationHelpers } from './useKeyboardNavigation';
import { getNavigationIndex } from '../utils/navigationIndex';

/**
 * Check if a navigation item is selectable
 */
const isSelectableNavigationItem = (item: CombinedNavigationItem): boolean => {
    return (
        item.type === NavigationPaneItemType.FOLDER ||
        item.type === NavigationPaneItemType.TAG ||
        item.type === NavigationPaneItemType.UNTAGGED
    );
};

interface UseNavigationPaneKeyboardProps {
    /** Navigation items to navigate through */
    items: CombinedNavigationItem[];
    /** Virtualizer instance for scroll management */
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Container element for event attachment */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Combined navigation index map */
    pathToIndex: Map<string, number>;
}

/**
 * Hook for keyboard navigation in the navigation pane.
 * Handles folder/tag-specific keyboard interactions.
 */
export function useNavigationPaneKeyboard({ items, virtualizer, containerRef, pathToIndex }: UseNavigationPaneKeyboardProps) {
    const { app, isMobile } = useServices();
    const fileSystemOps = useFileSystemOps();
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

    const resolveIndex = useCallback(
        (path: string | null | undefined, type: ItemType | null) => {
            if (!path) {
                return -1;
            }

            if (type) {
                const exactMatch = getNavigationIndex(pathToIndex, type, path);
                if (exactMatch !== undefined) {
                    return exactMatch;
                }
            }

            const folderIndex = getNavigationIndex(pathToIndex, ItemType.FOLDER, path);
            if (folderIndex !== undefined) {
                return folderIndex;
            }

            const tagIndex = getNavigationIndex(pathToIndex, ItemType.TAG, path);
            if (tagIndex !== undefined) {
                return tagIndex;
            }

            return -1;
        },
        [pathToIndex]
    );

    /**
     * Get current selection index
     */
    const getCurrentIndex = useCallback(() => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder?.path) {
            return resolveIndex(selectionState.selectedFolder.path, ItemType.FOLDER);
        }

        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return resolveIndex(selectionState.selectedTag, ItemType.TAG);
        }

        return -1;
    }, [selectionState, resolveIndex]);

    /**
     * Select item at given index
     */
    const selectItemAtIndex = useCallback(
        (item: CombinedNavigationItem) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                if (!(item.data instanceof TFolder)) return;
                const folder = item.data;
                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

                // Auto-expand if enabled and folder has children
                if (settings.autoExpandFoldersTags && folder.children.some(child => child instanceof TFolder)) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedFolders.has(folder.path)) {
                        expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                    }
                }
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                const context = 'context' in item ? item.context : undefined;
                selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagNode.path, context });

                // Auto-expand if enabled and tag has children
                if (settings.autoExpandFoldersTags && tagNode.children.size > 0) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedTags.has(tagNode.path)) {
                        expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tagNode.path });
                    }
                }
            }
        },
        [selectionDispatch, settings, expansionState, expansionDispatch]
    );

    /**
     * Handle expand/collapse for folders and tags
     */
    const handleExpandCollapse = useCallback(
        (item: CombinedNavigationItem, expand: boolean) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                if (!(item.data instanceof TFolder)) return;
                const folder = item.data;
                const isExpanded = expansionState.expandedFolders.has(folder.path);
                if (expand && !isExpanded && folder.children.length > 0) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                }
            } else if (item.type === NavigationPaneItemType.TAG) {
                const tag = item.data;
                const isExpanded = expansionState.expandedTags.has(tag.path);
                if (expand && !isExpanded && tag.children.size > 0) {
                    expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
                }
            }
        },
        [expansionState, expansionDispatch]
    );

    /**
     * Navigation pane-specific keyboard handler
     */
    const handleKeyDown = useCallback(
        (e: KeyboardEvent, helpers: KeyboardNavigationHelpers<CombinedNavigationItem>) => {
            const currentIndex = getCurrentIndex();
            let targetIndex = -1;

            // Swap left/right arrow behavior for RTL layouts
            let effectiveKey = e.key;
            if (helpers.isRTL()) {
                switch (e.key) {
                    case 'ArrowLeft':
                        effectiveKey = 'ArrowRight';
                        break;
                    case 'ArrowRight':
                        effectiveKey = 'ArrowLeft';
                        break;
                }
            }

            switch (effectiveKey) {
                case 'ArrowDown':
                    e.preventDefault();
                    targetIndex = helpers.findNextIndex(currentIndex);

                    // Don't clear selection if we're at the bottom boundary
                    if (targetIndex === currentIndex && currentIndex >= 0) {
                        return; // Do nothing, stay at current position with selection intact
                    }
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    // If nothing is selected, select the first item
                    if (currentIndex === -1) {
                        targetIndex = helpers.findNextIndex(-1);
                    } else {
                        targetIndex = helpers.findPreviousIndex(currentIndex);

                        // Don't clear selection if we're at the top boundary
                        if (targetIndex === currentIndex && currentIndex >= 0) {
                            return; // Do nothing, stay at current position with selection intact
                        }
                    }
                    break;

                case 'PageDown': {
                    e.preventDefault();
                    if (currentIndex === -1) break;

                    const pageSize = helpers.getPageSize();
                    const newIndex = Math.min(currentIndex + pageSize, items.length - 1);

                    // Find the next selectable item starting from the new position
                    let newTargetIndex = helpers.findNextIndex(newIndex - 1);

                    // If we didn't move, ensure we go to the very last selectable item
                    if (newTargetIndex === currentIndex && currentIndex !== items.length - 1) {
                        // Find the last selectable item
                        for (let i = items.length - 1; i >= 0; i--) {
                            const item = helpers.getItemAt(i);
                            if (item && isSelectableNavigationItem(item)) {
                                newTargetIndex = i;
                                break;
                            }
                        }
                    }

                    targetIndex = newTargetIndex;
                    break;
                }

                case 'PageUp': {
                    e.preventDefault();
                    if (currentIndex === -1) break;

                    const pageSize = helpers.getPageSize();
                    const newIndex = Math.max(0, currentIndex - pageSize);

                    // Find the previous selectable item starting from the new position
                    let newTargetIndex = helpers.findPreviousIndex(newIndex + 1);

                    // If we didn't move, ensure we go to the very first selectable item
                    if (newTargetIndex === currentIndex && currentIndex !== 0) {
                        newTargetIndex = helpers.findNextIndex(-1);
                    }

                    targetIndex = newTargetIndex;
                    break;
                }

                case 'ArrowRight': {
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        const item = helpers.getItemAt(currentIndex);
                        if (!item) break;

                        let shouldSwitchPane = false;
                        if (item.type === NavigationPaneItemType.FOLDER) {
                            if (!(item.data instanceof TFolder)) break;
                            const folder = item.data;
                            const isExpanded = expansionState.expandedFolders.has(folder.path);
                            const hasChildren = folder.children.some(child => child instanceof TFolder);

                            if (hasChildren && !isExpanded) {
                                // If it has children and is collapsed, expand it
                                handleExpandCollapse(item, true);
                            } else {
                                // If it has no children, or is already expanded, switch to the file pane
                                shouldSwitchPane = true;
                            }
                        } else if (item.type === NavigationPaneItemType.TAG) {
                            // Similarly for tags
                            const tag = item.data;
                            const isExpanded = expansionState.expandedTags.has(tag.path);
                            const hasChildren = tag.children.size > 0;

                            if (hasChildren && !isExpanded) {
                                handleExpandCollapse(item, true);
                            } else {
                                shouldSwitchPane = true;
                            }
                        } else {
                            // For items with no children like 'untagged', just switch
                            shouldSwitchPane = true;
                        }

                        if (shouldSwitchPane) {
                            if (uiState.singlePane && !isMobile) {
                                // In single-pane mode, switch to files view
                                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            } else {
                                // In dual-pane mode, just switch focus
                                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                            }
                        }
                    }
                    break;
                }

                case 'ArrowLeft': {
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        const item = helpers.getItemAt(currentIndex);
                        if (!item) return;

                        if (item.type === NavigationPaneItemType.FOLDER) {
                            if (!(item.data instanceof TFolder)) break;
                            const folder = item.data;
                            const isExpanded = expansionState.expandedFolders.has(folder.path);
                            if (isExpanded) {
                                // Collapse the folder
                                handleExpandCollapse(item, false);
                            } else if (folder.parent && (!settings.showRootFolder || folder.path !== '/')) {
                                // Navigate to parent folder
                                const parentPath = folder.parent.path;
                                const parentIndex = resolveIndex(parentPath, ItemType.FOLDER);
                                if (parentIndex >= 0) {
                                    const parentItem = helpers.getItemAt(parentIndex);
                                    if (parentItem) {
                                        selectItemAtIndex(parentItem);
                                        helpers.scrollToIndex(parentIndex);
                                    }
                                }
                            }
                        } else if (item.type === NavigationPaneItemType.TAG) {
                            const tag = item.data;
                            const isExpanded = expansionState.expandedTags.has(tag.path);
                            if (isExpanded) {
                                // Collapse the tag
                                handleExpandCollapse(item, false);
                            } else {
                                // Navigate to parent tag
                                const lastSlashIndex = tag.path.lastIndexOf('/');
                                if (lastSlashIndex > 0) {
                                    const parentPath = tag.path.substring(0, lastSlashIndex);
                                    const parentIndex = resolveIndex(parentPath, ItemType.TAG);
                                    if (parentIndex >= 0) {
                                        const parentItem = helpers.getItemAt(parentIndex);
                                        if (parentItem) {
                                            selectItemAtIndex(parentItem);
                                            helpers.scrollToIndex(parentIndex);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    break;
                }

                case 'Tab': {
                    e.preventDefault();
                    if (!e.shiftKey) {
                        // Tab: Move focus to files pane
                        if (uiState.singlePane && !isMobile) {
                            // In single-pane mode, switch to files view
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        } else {
                            // In dual-pane mode, just switch focus
                            selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        }
                    }
                    // Note: Shift+Tab is not handled here as there's nowhere to go back
                    break;
                }

                case 'Delete':
                case 'Backspace':
                    if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                        e.preventDefault();
                        // Use shared delete function
                        deleteSelectedFolder({
                            app,
                            fileSystemOps,
                            settings,
                            selectionState,
                            selectionDispatch
                        });
                    }
                    break;

                case 'Home':
                    e.preventDefault();
                    // Find the first selectable item
                    targetIndex = helpers.findNextIndex(-1);
                    break;

                case 'End':
                    e.preventDefault();
                    // Find the last selectable item
                    for (let i = items.length - 1; i >= 0; i--) {
                        const item = helpers.getItemAt(i);
                        if (item && isSelectableNavigationItem(item)) {
                            targetIndex = i;
                            break;
                        }
                    }
                    break;
            }

            // Scroll to and select new item
            if (targetIndex >= 0 && targetIndex < items.length) {
                const item = helpers.getItemAt(targetIndex);
                if (item) {
                    selectItemAtIndex(item);
                    helpers.scrollToIndex(targetIndex);
                }
            }
        },
        [
            getCurrentIndex,
            expansionState,
            handleExpandCollapse,
            uiState.singlePane,
            isMobile,
            uiDispatch,
            selectionDispatch,
            settings,
            resolveIndex,
            selectItemAtIndex,
            selectionState,
            app,
            fileSystemOps,
            items.length
        ]
    );

    // Use the base keyboard navigation hook
    useKeyboardNavigation({
        items,
        virtualizer,
        focusedPane: 'navigation',
        containerRef,
        isSelectable: isSelectableNavigationItem,
        _getCurrentIndex: getCurrentIndex,
        onKeyDown: handleKeyDown
    });
}
