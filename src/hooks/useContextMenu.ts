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
import { useServices, useFileSystemOps, useMetadataService, useTagOperations } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useUIDispatch } from '../context/UIStateContext';
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

            // Add context menu active class to show outline
            elementRef.current.classList.add('nn-context-menu-active');

            // Remove the class when menu is hidden
            menu.onHide(() => {
                if (elementRef.current) {
                    elementRef.current.classList.remove('nn-context-menu-active');
                }
            });

            // Prepare common parameters for all builders
            const services: MenuServices = {
                app,
                plugin,
                isMobile,
                fileSystemOps,
                metadataService,
                tagOperations,
                tagTreeService,
                getFavoriteTree,
                findTagInFavoriteTree
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
                const context = (elementRef.current as HTMLElement).dataset?.tagContext as 'favorites' | 'tags' | undefined;
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

            menu.showAtMouseEvent(e);
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
            findTagInFavoriteTree
        ]
    );

    useEffect(() => {
        const element = elementRef.current;
        if (!element || !config) return;

        element.addEventListener('contextmenu', handleContextMenu);

        return () => {
            element.removeEventListener('contextmenu', handleContextMenu);
            // Clean up any lingering context menu active class
            element.classList.remove('nn-context-menu-active');
        };
    }, [elementRef, handleContextMenu, config]);
}
