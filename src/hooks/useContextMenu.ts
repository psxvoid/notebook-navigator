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

// src/hooks/useContextMenu.ts
import { useEffect, useCallback } from 'react';
import { Menu } from 'obsidian';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService, useTagOperations, useCommandQueue } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useUIDispatch } from '../context/UIStateContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { isFileType, isFolderType, isTagType } from '../types';
import { MenuConfig, MenuServices, MenuState, MenuDispatchers, buildFolderMenu, buildTagMenu, buildFileMenu } from '../utils/contextMenu';
import { TFile, TFolder } from 'obsidian';

/**
 * Custom hook that attaches a context menu to an element.
 * Provides right-click context menu functionality for files, folders, and tags.
 *
 * @param elementRef - React ref to the element to attach the context menu to
 * @param config - Configuration object containing menu type and item, or null to disable
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useContextMenu(ref, { type: 'file', item: file });
 *
 * return <div ref={ref}>Right-click me</div>;
 * ```
 */
export function useContextMenu(elementRef: React.RefObject<HTMLElement | null>, config: MenuConfig | null) {
    const { app, plugin, isMobile, tagTreeService } = useServices();
    const settings = useSettingsState();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();
    const { getFavoriteTree, findTagInFavoriteTree } = useFileCache();
    const tagOperations = useTagOperations();
    const commandQueue = useCommandQueue();
    const shortcuts = useShortcuts();
    const selectionState = useSelectionState();
    const { expandedFolders, expandedTags } = useExpansionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionDispatch = useExpansionDispatch();
    const uiDispatch = useUIDispatch();

    /**
     * Handles the context menu event.
     * Shows appropriate menu items based on whether the target is a file, folder, or tag.
     *
     * @param e - The mouse event from right-click
     */
    const handleContextMenu = useCallback(
        (e: MouseEvent) => {
            if (!config || !elementRef.current) return;

            // Check if the click is on this element or its children
            if (!elementRef.current.contains(e.target as Node)) return;

            e.preventDefault();
            e.stopPropagation();

            const menu = new Menu();

            // Add context menu active class to show outline immediately
            elementRef.current.classList.add('nn-context-menu-active');

            // Handle separator hiding for file items in list pane
            if (isFileType(config.type)) {
                // Find the virtual item wrapper that contains this file item
                const virtualItem = elementRef.current.closest('.nn-virtual-file-item');
                if (virtualItem instanceof HTMLElement) {
                    // Hide separator below this item
                    virtualItem.classList.add('nn-hide-separator-context-menu');

                    // Find and hide separator of previous item (shows above this item)
                    const prevVirtualItem = virtualItem.previousElementSibling;
                    if (prevVirtualItem instanceof HTMLElement && prevVirtualItem.classList.contains('nn-virtual-file-item')) {
                        prevVirtualItem.classList.add('nn-hide-separator-context-menu');
                    }
                }
            }

            // Prepare common parameters for all builders
            const services: MenuServices = {
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
            };

            const state: MenuState = {
                selectionState,
                expandedFolders,
                expandedTags
            };

            const dispatchers: MenuDispatchers = {
                selectionDispatch,
                expansionDispatch,
                uiDispatch
            };

            // Call the appropriate builder based on item type
            if (isFolderType(config.type)) {
                if (!(config.item instanceof TFolder)) return;
                buildFolderMenu({
                    folder: config.item,
                    menu,
                    services,
                    settings,
                    state,
                    dispatchers
                });
            } else if (isTagType(config.type)) {
                if (typeof config.item !== 'string') return;
                // Get context from data attribute if available
                const context = elementRef.current.dataset?.tagContext as 'favorites' | 'tags' | undefined;
                buildTagMenu({
                    tagPath: config.item,
                    menu,
                    services,
                    settings,
                    state,
                    dispatchers,
                    context
                });
            } else if (isFileType(config.type)) {
                if (!(config.item instanceof TFile)) return;
                buildFileMenu({
                    file: config.item,
                    menu,
                    services,
                    settings,
                    state,
                    dispatchers
                });
            }

            // Show menu at mouse event first, then attach hide handler.
            // This avoids a race where switching from an existing menu could
            // trigger a premature hide on the newly created menu and remove
            // the outline before the menu is actually shown.
            menu.showAtMouseEvent(e);

            // Remove the class when THIS menu is hidden
            menu.onHide(() => {
                if (elementRef.current) {
                    elementRef.current.classList.remove('nn-context-menu-active');

                    // Remove separator hiding for file items
                    if (isFileType(config.type)) {
                        const virtualItem = elementRef.current.closest('.nn-virtual-file-item');
                        if (virtualItem instanceof HTMLElement) {
                            // Remove separator hiding from this item
                            virtualItem.classList.remove('nn-hide-separator-context-menu');

                            // Remove separator hiding from previous item
                            const prevVirtualItem = virtualItem.previousElementSibling;
                            if (prevVirtualItem instanceof HTMLElement && prevVirtualItem.classList.contains('nn-virtual-file-item')) {
                                prevVirtualItem.classList.remove('nn-hide-separator-context-menu');
                            }
                        }
                    }
                }
            });
        },
        [
            config,
            elementRef,
            app,
            plugin,
            settings,
            fileSystemOps,
            metadataService,
            tagOperations,
            selectionState,
            expandedFolders,
            expandedTags,
            selectionDispatch,
            expansionDispatch,
            uiDispatch,
            isMobile,
            tagTreeService,
            getFavoriteTree,
            findTagInFavoriteTree,
            commandQueue,
            shortcuts
        ]
    );

    useEffect(() => {
        const element = elementRef.current;
        if (!element || !config) return;

        element.addEventListener('contextmenu', handleContextMenu);

        return () => {
            // Remove listener on cleanup, but do not forcibly remove the
            // outline class here. Cleanup can run on re-render, which would
            // otherwise clear the outline before the menu appears when
            // switching targets. The class is reliably cleared via menu.onHide
            // when the context menu actually closes.
            element.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [elementRef, handleContextMenu, config]);
}
