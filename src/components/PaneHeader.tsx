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

import React, { useCallback } from 'react';
import { Menu } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useFileSystemOps } from '../context/ServicesContext';
import { isTFolder } from '../utils/typeGuards';
import { ObsidianIcon } from './ObsidianIcon';
import { strings } from '../i18n';
import { UNTAGGED_TAG_ID } from '../types';
import { getEffectiveSortOption, getSortIcon as getSortIconName, SORT_OPTIONS } from '../utils/sortUtils';
import type { SortOption } from '../settings';

interface PaneHeaderProps {
    type: 'folder' | 'file';
}

/**
 * Renders the header bar for either the folder or file pane.
 * Provides action buttons based on pane type - expand/collapse all and new folder
 * for the folder pane, new file for the file pane.
 * 
 * @param props - The component props
 * @param props.type - Whether this is the header for the 'folder' or 'file' pane
 * @returns A header element with context-appropriate action buttons
 */
export function PaneHeader({ type }: PaneHeaderProps) {
    const { app, isMobile, plugin } = useServices();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const fileSystemOps = useFileSystemOps();
    
    const handleExpandCollapseAll = useCallback(() => {
        if (type !== 'folder') return;
        
        // If we have any expanded folders, collapse all
        if (expansionState.expandedFolders.size > 0) {
            expansionDispatch({ type: 'SET_EXPANDED_FOLDERS', folders: new Set() });
        } else {
            // Otherwise, expand all folders
            const allFolders = new Set<string>();
            
            const collectAllFolders = (folder: any) => {
                folder.children.forEach((child: any) => {
                    if (isTFolder(child)) {
                        allFolders.add(child.path);
                        collectAllFolders(child);
                    }
                });
            };
            
            const rootFolder = app.vault.getRoot();
            
            // Add root folder itself if it's shown
            if (plugin.settings.showRootFolder) {
                allFolders.add(rootFolder.path);
            }
            
            collectAllFolders(rootFolder);
            
            expansionDispatch({ type: 'SET_EXPANDED_FOLDERS', folders: allFolders });
        }
    }, [app, expansionState.expandedFolders.size, expansionDispatch, type, plugin.settings.showRootFolder]);
    
    const handleNewFolder = useCallback(async () => {
        if (type !== 'folder' || !selectionState.selectedFolder) return;
        
        try {
            await fileSystemOps.createNewFolder(selectionState.selectedFolder, () => {
                // Expand the parent folder to show the newly created folder
                if (selectionState.selectedFolder && !expansionState.expandedFolders.has(selectionState.selectedFolder.path)) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: selectionState.selectedFolder.path });
                }
            });
        } catch (error) {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [selectionState.selectedFolder, expansionState.expandedFolders, fileSystemOps, type, expansionDispatch]);
    
    const handleNewFile = useCallback(async () => {
        if (type !== 'file' || !selectionState.selectedFolder) return;
        
        try {
            await fileSystemOps.createNewFile(selectionState.selectedFolder);
        } catch (error) {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [selectionState.selectedFolder, fileSystemOps, type]);
    
    const getCurrentSortOption = useCallback((): SortOption => {
        return getEffectiveSortOption(plugin.settings, selectionState.selectionType, selectionState.selectedFolder);
    }, [plugin.settings, selectionState.selectionType, selectionState.selectedFolder]);
    
    const getSortIcon = useCallback(() => {
        return getSortIconName(getCurrentSortOption());
    }, [getCurrentSortOption]);
    
    const handleSortMenu = useCallback((event: React.MouseEvent) => {
        if (type !== 'file') return;
        
        const menu = new Menu();
        const currentSort = getCurrentSortOption();
        const isCustomSort = selectionState.selectionType === 'folder' && 
                           selectionState.selectedFolder && 
                           plugin.settings.folderSortOverrides[selectionState.selectedFolder.path];
        
        // Default option
        menu.addItem((item) => {
            item
                .setTitle(`${strings.paneHeader.defaultSort}: ${strings.settings.items.sortNotesBy.options[plugin.settings.defaultFolderSort]}`)
                .setChecked(!isCustomSort)
                .onClick(async () => {
                    if (selectionState.selectionType === 'folder' && selectionState.selectedFolder) {
                        delete plugin.settings.folderSortOverrides[selectionState.selectedFolder.path];
                        await plugin.saveSettings();
                        // Trigger refresh by updating workspace
                        app.workspace.requestSaveLayout();
                    }
                });
        });
        
        menu.addSeparator();
        
        // Sort options
        let lastCategory = '';
        SORT_OPTIONS.forEach((option) => {
            const category = option.split('-')[0];
            if (lastCategory && lastCategory !== category) {
                menu.addSeparator();
            }
            lastCategory = category;
            
            menu.addItem((item) => {
                item
                    .setTitle(strings.settings.items.sortNotesBy.options[option])
                    .setChecked(isCustomSort && currentSort === option)
                    .onClick(async () => {
                        if (selectionState.selectionType === 'folder' && selectionState.selectedFolder) {
                            plugin.settings.folderSortOverrides[selectionState.selectedFolder.path] = option;
                        } else {
                            plugin.settings.defaultFolderSort = option;
                        }
                        await plugin.saveSettings();
                        // Trigger refresh by updating workspace
                        app.workspace.requestSaveLayout();
                    });
            });
        });
        
        menu.showAtMouseEvent(event.nativeEvent);
    }, [type, selectionState.selectionType, selectionState.selectedFolder, plugin, app, getCurrentSortOption]);
    
    // Mobile header with back button
    if (isMobile) {
        let headerTitle = strings.common.noSelection;
        
        if (selectionState.selectionType === 'folder' && selectionState.selectedFolder) {
            headerTitle = selectionState.selectedFolder.path === '/' ? strings.folderTree.rootFolderName : selectionState.selectedFolder.name;
        } else if (selectionState.selectionType === 'tag' && selectionState.selectedTag) {
            headerTitle = selectionState.selectedTag === UNTAGGED_TAG_ID ? strings.common.untagged : selectionState.selectedTag;
        }
        
        // For file pane header on mobile
        if (type === 'file') {
            return (
                <div className="nn-pane-header">
                    <div className="nn-header-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
                        <div className="nn-mobile-back">
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.mobileBackToFolders}
                                onClick={() => uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'list' })}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="arrow-left" />
                            </button>
                            <span className="nn-mobile-title">{headerTitle}</span>
                        </div>
                        <div className="nn-header-actions">
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.changeSortOrder}
                                onClick={handleSortMenu}
                                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name={getSortIcon()} />
                            </button>
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.newNote}
                                onClick={handleNewFile}
                                disabled={!selectionState.selectedFolder}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="file-plus" />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        // For folder pane header on mobile
        return (
            <div className="nn-pane-header">
                <div className="nn-header-actions" style={{ width: '100%', justifyContent: 'flex-end' }}>
                    <button
                        className="nn-icon-button"
                        aria-label={expansionState.expandedFolders.size > 0 ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                        onClick={handleExpandCollapseAll}
                        tabIndex={-1}
                    >
                        <ObsidianIcon 
                            name={expansionState.expandedFolders.size > 0 ? 'chevrons-down-up' : 'chevrons-up-down'}
                        />
                    </button>
                    <button
                        className="nn-icon-button"
                        aria-label={strings.paneHeader.newFolder}
                        onClick={handleNewFolder}
                        disabled={!selectionState.selectedFolder}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="folder-plus" />
                    </button>
                </div>
            </div>
        );
    }
    
    // Desktop header (original code)
    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions">
                {type === 'folder' ? (
                    <>
                        <button
                            className="nn-icon-button"
                            aria-label={expansionState.expandedFolders.size > 0 ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                            onClick={handleExpandCollapseAll}
                            tabIndex={-1}
                        >
                            <ObsidianIcon 
                                name={expansionState.expandedFolders.size > 0 ? 'chevrons-down-up' : 'chevrons-up-down'}
                            />
                        </button>
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.newFolder}
                            onClick={handleNewFolder}
                            disabled={!selectionState.selectedFolder}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="folder-plus" />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.changeSortOrder}
                            onClick={handleSortMenu}
                            disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name={getSortIcon()} />
                        </button>
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.newNote}
                            onClick={handleNewFile}
                            disabled={!selectionState.selectedFolder}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="file-plus" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}