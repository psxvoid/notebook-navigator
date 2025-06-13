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
import { useAppContext } from '../context/AppContext';
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
    const { app, appState, dispatch, isMobile, plugin } = useAppContext();
    const fileSystemOps = useFileSystemOps();
    
    const handleExpandCollapseAll = useCallback(() => {
        if (type !== 'folder') return;
        
        // If we have any expanded folders, collapse all
        if (appState.expandedFolders.size > 0) {
            dispatch({ type: 'SET_EXPANDED_FOLDERS', folders: new Set() });
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
            
            dispatch({ type: 'SET_EXPANDED_FOLDERS', folders: allFolders });
        }
    }, [app, appState.expandedFolders.size, dispatch, type, plugin.settings.showRootFolder]);
    
    const handleNewFolder = useCallback(async () => {
        if (type !== 'folder' || !appState.selectedFolder) return;
        
        try {
            await fileSystemOps.createNewFolder(appState.selectedFolder, () => {
                // Expand the parent folder to show the newly created folder
                if (appState.selectedFolder && !appState.expandedFolders.has(appState.selectedFolder.path)) {
                    dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: appState.selectedFolder.path });
                }
            });
        } catch (error) {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [appState.selectedFolder, appState.expandedFolders, fileSystemOps, type, dispatch]);
    
    const handleNewFile = useCallback(async () => {
        if (type !== 'file' || !appState.selectedFolder) return;
        
        try {
            await fileSystemOps.createNewFile(appState.selectedFolder);
        } catch (error) {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [appState.selectedFolder, fileSystemOps, type]);
    
    const getCurrentSortOption = useCallback((): SortOption => {
        return getEffectiveSortOption(plugin.settings, appState.selectionType, appState.selectedFolder);
    }, [plugin.settings, appState.selectionType, appState.selectedFolder]);
    
    const getSortIcon = useCallback(() => {
        return getSortIconName(getCurrentSortOption());
    }, [getCurrentSortOption]);
    
    const handleSortMenu = useCallback((event: React.MouseEvent) => {
        if (type !== 'file') return;
        
        const menu = new Menu();
        const currentSort = getCurrentSortOption();
        const isCustomSort = appState.selectionType === 'folder' && 
                           appState.selectedFolder && 
                           plugin.settings.folderSortOverrides[appState.selectedFolder.path];
        
        // Default option
        menu.addItem((item) => {
            item
                .setTitle(`${strings.paneHeader.defaultSort}: ${strings.settings.items.sortNotesBy.options[plugin.settings.defaultFolderSort]}`)
                .setChecked(!isCustomSort)
                .onClick(async () => {
                    if (appState.selectionType === 'folder' && appState.selectedFolder) {
                        delete plugin.settings.folderSortOverrides[appState.selectedFolder.path];
                        await plugin.saveSettings();
                        dispatch({ type: 'FORCE_REFRESH' });
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
                        if (appState.selectionType === 'folder' && appState.selectedFolder) {
                            plugin.settings.folderSortOverrides[appState.selectedFolder.path] = option;
                        } else {
                            plugin.settings.defaultFolderSort = option;
                        }
                        await plugin.saveSettings();
                        dispatch({ type: 'FORCE_REFRESH' });
                    });
            });
        });
        
        menu.showAtMouseEvent(event.nativeEvent);
    }, [type, appState.selectionType, appState.selectedFolder, plugin, dispatch, getCurrentSortOption]);
    
    // Mobile header with back button
    if (isMobile) {
        let headerTitle = strings.common.noSelection;
        
        if (appState.selectionType === 'folder' && appState.selectedFolder) {
            headerTitle = appState.selectedFolder.path === '/' ? strings.folderTree.rootFolderName : appState.selectedFolder.name;
        } else if (appState.selectionType === 'tag' && appState.selectedTag) {
            headerTitle = appState.selectedTag === UNTAGGED_TAG_ID ? strings.common.untagged : appState.selectedTag;
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
                                onClick={() => dispatch({ type: 'SET_MOBILE_VIEW', view: 'list' })}
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
                                disabled={!appState.selectedFolder && !appState.selectedTag}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name={getSortIcon()} />
                            </button>
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.newNote}
                                onClick={handleNewFile}
                                disabled={!appState.selectedFolder}
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
                        aria-label={appState.expandedFolders.size > 0 ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                        onClick={handleExpandCollapseAll}
                        tabIndex={-1}
                    >
                        <ObsidianIcon 
                            name={appState.expandedFolders.size > 0 ? 'chevrons-down-up' : 'chevrons-up-down'}
                        />
                    </button>
                    <button
                        className="nn-icon-button"
                        aria-label={strings.paneHeader.newFolder}
                        onClick={handleNewFolder}
                        disabled={!appState.selectedFolder}
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
                            aria-label={appState.expandedFolders.size > 0 ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                            onClick={handleExpandCollapseAll}
                            tabIndex={-1}
                        >
                            <ObsidianIcon 
                                name={appState.expandedFolders.size > 0 ? 'chevrons-down-up' : 'chevrons-up-down'}
                            />
                        </button>
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.newFolder}
                            onClick={handleNewFolder}
                            disabled={!appState.selectedFolder}
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
                            disabled={!appState.selectedFolder && !appState.selectedTag}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name={getSortIcon()} />
                        </button>
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.newNote}
                            onClick={handleNewFile}
                            disabled={!appState.selectedFolder}
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