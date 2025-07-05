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
import { Menu, TFolder } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useSettings } from '../context/SettingsContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { isTFolder } from '../utils/typeGuards';
import { ObsidianIcon } from './ObsidianIcon';
import { strings } from '../i18n';
import { UNTAGGED_TAG_ID, ItemType } from '../types';
import { getEffectiveSortOption, getSortIcon as getSortIconName, SORT_OPTIONS } from '../utils/sortUtils';
import type { SortOption } from '../settings';
import { useTagCache } from '../context/TagCacheContext';
import { collectAllTagPaths } from '../utils/tagUtils';

interface PaneHeaderProps {
    type: 'folder' | 'file';
    onHeaderClick?: () => void;
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
export function PaneHeader({ type, onHeaderClick }: PaneHeaderProps) {
    const { app, isMobile } = useServices();
    const { settings, updateSettings } = useSettings();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();
    const { tagData } = useTagCache();
    
    /**
     * Determines whether the expand/collapse button should perform a collapse action
     * based on the current expansion state and behavior setting
     */
    const shouldCollapseItems = useCallback(() => {
        const behavior = settings.collapseButtonBehavior;
        
        // Check expansion state for folders and tags
        const hasFoldersExpanded = settings.showRootFolder 
            ? Array.from(expansionState.expandedFolders).some(path => path !== '/')
            : expansionState.expandedFolders.size > 0;
        const hasTagsExpanded = expansionState.expandedTags.size > 0;
        
        // Determine if we should collapse based on behavior setting
        return behavior === 'all' ? (hasFoldersExpanded || hasTagsExpanded) :
               behavior === 'folders-only' ? hasFoldersExpanded :
               behavior === 'tags-only' ? hasTagsExpanded :
               false;
    }, [settings.collapseButtonBehavior, settings.showRootFolder, expansionState.expandedFolders, expansionState.expandedTags]);
    
    /**
     * Handles the expand/collapse all button click.
     * 
     * BEHAVIOR:
     * - When collapsing: Sets expanded folders/tags based on collapseButtonBehavior setting
     *   - 'all': Collapses both folders and tags
     *   - 'folders-only': Collapses only folders
     *   - 'tags-only': Collapses only tags
     * - When expanding: Expands items recursively based on the same setting
     * 
     * For folders:
     *   - If showRootFolder is true: Keeps root folder ('/') expanded when collapsing
     *   - If showRootFolder is false: Collapses all folders (root children still visible)
     */
    const handleExpandCollapseAll = useCallback(() => {
        if (type !== 'folder') return;
        
        const behavior = settings.collapseButtonBehavior;
        const rootFolder = app.vault.getRoot();
        const shouldCollapse = shouldCollapseItems();
        
        // Check which types should be affected
        const shouldAffectFolders = behavior === 'all' || behavior === 'folders-only';
        const shouldAffectTags = behavior === 'all' || behavior === 'tags-only';
        
        if (shouldCollapse) {
            // Collapse items
            if (shouldAffectFolders) {
                const collapsedFolders = new Set<string>();
                if (settings.showRootFolder) {
                    collapsedFolders.add('/');
                }
                expansionDispatch({ type: 'SET_EXPANDED_FOLDERS', folders: collapsedFolders });
            }
            
            if (shouldAffectTags) {
                expansionDispatch({ type: 'SET_EXPANDED_TAGS', tags: new Set() });
            }
        } else {
            // Expand items
            if (shouldAffectFolders) {
                const allFolders = new Set<string>();
                
                const collectAllFolders = (folder: TFolder) => {
                    folder.children.forEach((child) => {
                        if (isTFolder(child)) {
                            allFolders.add(child.path);
                            collectAllFolders(child);
                        }
                    });
                };
                
                if (settings.showRootFolder) {
                    allFolders.add(rootFolder.path);
                }
                
                collectAllFolders(rootFolder);
                expansionDispatch({ type: 'SET_EXPANDED_FOLDERS', folders: allFolders });
            }
            
            if (shouldAffectTags) {
                // Collect all tag paths from the tag tree
                const allTagPaths = new Set<string>();
                
                // Collect paths from all root-level tags
                for (const tagNode of tagData.tree.values()) {
                    collectAllTagPaths(tagNode, allTagPaths);
                }
                
                expansionDispatch({ type: 'SET_EXPANDED_TAGS', tags: allTagPaths });
            }
        }
        
    }, [app, expansionDispatch, type, settings.showRootFolder, settings.collapseButtonBehavior, tagData.tree, shouldCollapseItems]);
    
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
            const file = await fileSystemOps.createNewFile(selectionState.selectedFolder);
            if (file) {
                uiDispatch({ type: 'SET_NEWLY_CREATED_PATH', path: file.path });
            }
        } catch (error) {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [selectionState.selectedFolder, fileSystemOps, type, uiDispatch]);
    
    const getCurrentSortOption = useCallback((): SortOption => {
        return getEffectiveSortOption(settings, selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag);
    }, [settings, selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag]);
    
    const getSortIcon = useCallback(() => {
        return getSortIconName(getCurrentSortOption());
    }, [getCurrentSortOption]);
    
    const handleSortMenu = useCallback((event: React.MouseEvent) => {
        if (type !== 'file') return;
        
        const menu = new Menu();
        const currentSort = getCurrentSortOption();
        const isCustomSort = (selectionState.selectionType === ItemType.FOLDER && 
                           selectionState.selectedFolder && 
                           settings.folderSortOverrides[selectionState.selectedFolder.path]) ||
                           (selectionState.selectionType === ItemType.TAG && 
                           selectionState.selectedTag && 
                           settings.tagSortOverrides?.[selectionState.selectedTag]);
        
        // Default option
        menu.addItem((item) => {
            item
                .setTitle(`${strings.paneHeader.defaultSort}: ${strings.settings.items.sortNotesBy.options[settings.defaultFolderSort]}`)
                .setChecked(!isCustomSort)
                .onClick(async () => {
                    if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                        await metadataService.removeFolderSortOverride(selectionState.selectedFolder.path);
                    } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                        await metadataService.removeTagSortOverride(selectionState.selectedTag);
                    }
                    // Trigger refresh by updating workspace
                    app.workspace.requestSaveLayout();
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
                    .setChecked(!!isCustomSort && currentSort === option)
                    .onClick(async () => {
                        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                            await metadataService.setFolderSortOverride(selectionState.selectedFolder.path, option);
                        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                            await metadataService.setTagSortOverride(selectionState.selectedTag, option);
                        } else {
                            // Fallback to default sort if no folder or tag is selected
                            await updateSettings((s) => {
                                s.defaultFolderSort = option;
                            });
                        }
                        // Trigger refresh by updating workspace
                        app.workspace.requestSaveLayout();
                    });
            });
        });
        
        menu.showAtMouseEvent(event.nativeEvent);
    }, [type, selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag, app, getCurrentSortOption, updateSettings, metadataService, settings]);
    
    // Mobile header with back button
    if (isMobile) {
        let headerTitle = strings.common.noSelection;
        
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            headerTitle = selectionState.selectedFolder.path === '/' ? strings.folderTree.rootFolderName : selectionState.selectedFolder.name;
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            headerTitle = selectionState.selectedTag === UNTAGGED_TAG_ID ? strings.common.untagged : selectionState.selectedTag;
        }
        
        // For file pane header on mobile
        if (type === 'file') {
            return (
                <div className="nn-pane-header" onClick={onHeaderClick}>
                    <div className="nn-header-actions">
                        <div className="nn-mobile-back">
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.mobileBackToFolders}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'list' });
                                }}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="arrow-left" />
                            </button>
                            <span 
                                className="nn-mobile-title"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    uiDispatch({ type: 'SET_MOBILE_VIEW', view: 'list' });
                                }}
                            >
                                {headerTitle}
                            </span>
                        </div>
                        <div className="nn-header-actions">
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.changeSortOrder}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSortMenu(e);
                                }}
                                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name={getSortIcon()} />
                            </button>
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.newNote}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleNewFile();
                                }}
                                disabled={!selectionState.selectedFolder}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="pen-box" />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        // For folder pane header on mobile
        return (
            <div className="nn-pane-header" onClick={onHeaderClick}>
                <div className="nn-header-actions nn-header-actions--flex-end">
                    <button
                        className="nn-icon-button"
                        aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleExpandCollapseAll();
                        }}
                        tabIndex={-1}
                    >
                        <ObsidianIcon 
                            name={shouldCollapseItems() ? 'chevrons-down-up' : 'chevrons-up-down'}
                        />
                    </button>
                    <button
                        className="nn-icon-button"
                        aria-label={strings.paneHeader.newFolder}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleNewFolder();
                        }}
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
    // Prepare header title for file pane
    let headerTitle = '';
    if (type === 'file') {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            headerTitle = selectionState.selectedFolder.path === '/' ? strings.folderTree.rootFolderName : selectionState.selectedFolder.name;
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            headerTitle = selectionState.selectedTag === UNTAGGED_TAG_ID ? strings.common.untagged : selectionState.selectedTag;
        }
    }
    
    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions nn-header-actions--space-between">
                {type === 'folder' ? (
                    <>
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.hideFolders}
                            onClick={() => uiDispatch({ type: 'TOGGLE_NAVIGATION_PANE' })}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="sidebar-left" />
                        </button>
                        <div className="nn-header-actions">
                            <button
                                className="nn-icon-button"
                                aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                                onClick={handleExpandCollapseAll}
                                tabIndex={-1}
                            >
                                <ObsidianIcon 
                                    name={shouldCollapseItems() ? 'chevrons-down-up' : 'chevrons-up-down'}
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
                    </>
                ) : (
                    <>
                        {uiState.navigationPaneCollapsed && (
                            <button
                                className="nn-icon-button"
                                aria-label={strings.paneHeader.showFolders}
                                onClick={() => uiDispatch({ type: 'TOGGLE_NAVIGATION_PANE' })}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="sidebar-left" />
                            </button>
                        )}
                        {headerTitle && (
                            <span className="nn-pane-header-title">{headerTitle}</span>
                        )}
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
                                <ObsidianIcon name="pen-box" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}