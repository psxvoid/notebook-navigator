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

import { useCallback } from 'react';
import { TFolder } from 'obsidian';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState } from '../context/SelectionContext';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { strings } from '../i18n';
import { collectAllTagPaths } from '../utils/tagTree';
import { ObsidianIcon } from './ObsidianIcon';

export function NavigationTabBar() {
    const { app } = useServices();
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const fileSystemOps = useFileSystemOps();
    const { fileData } = useFileCache();

    const shouldCollapseItems = useCallback(() => {
        const behavior = settings.collapseButtonBehavior;

        const hasFoldersExpanded = settings.showRootFolder
            ? Array.from(expansionState.expandedFolders).some(path => path !== '/')
            : expansionState.expandedFolders.size > 0;
        const hasTagsExpanded = expansionState.expandedTags.size > 0;

        return behavior === 'all'
            ? hasFoldersExpanded || hasTagsExpanded
            : behavior === 'folders-only'
              ? hasFoldersExpanded
              : behavior === 'tags-only'
                ? hasTagsExpanded
                : false;
    }, [settings.collapseButtonBehavior, settings.showRootFolder, expansionState.expandedFolders, expansionState.expandedTags]);

    const handleExpandCollapseAll = useCallback(() => {
        const behavior = settings.collapseButtonBehavior;
        const rootFolder = app.vault.getRoot();
        const shouldCollapse = shouldCollapseItems();

        const shouldAffectFolders = behavior === 'all' || behavior === 'folders-only';
        const shouldAffectTags = behavior === 'all' || behavior === 'tags-only';

        if (shouldCollapse) {
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
            if (shouldAffectFolders) {
                const allFolders = new Set<string>();

                const collectAllFolders = (folder: TFolder) => {
                    folder.children.forEach(child => {
                        if (child instanceof TFolder) {
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
                const allTags = new Set<string>();
                // Collect all tag paths from both trees
                fileData.favoriteTree.forEach(node => {
                    collectAllTagPaths(node).forEach(path => allTags.add(path));
                });
                fileData.tagTree.forEach(node => {
                    collectAllTagPaths(node).forEach(path => allTags.add(path));
                });
                expansionDispatch({ type: 'SET_EXPANDED_TAGS', tags: allTags });
            }
        }
    }, [
        app.vault,
        settings.collapseButtonBehavior,
        settings.showRootFolder,
        expansionDispatch,
        fileData.favoriteTree,
        fileData.tagTree,
        shouldCollapseItems
    ]);

    const handleNewFolder = useCallback(async () => {
        if (!selectionState.selectedFolder) return;

        try {
            await fileSystemOps.createNewFolder(selectionState.selectedFolder, () => {
                if (selectionState.selectedFolder && !expansionState.expandedFolders.has(selectionState.selectedFolder.path)) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: selectionState.selectedFolder.path });
                }
            });
        } catch {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [selectionState.selectedFolder, expansionState.expandedFolders, fileSystemOps, expansionDispatch]);

    const handleToggleAutoExpand = useCallback(async () => {
        await updateSettings(s => {
            s.autoExpandFoldersTags = !s.autoExpandFoldersTags;
        });
    }, [updateSettings]);

    return (
        <div className="nn-mobile-toolbar">
            <button
                className="nn-mobile-toolbar-button"
                aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                onClick={handleExpandCollapseAll}
                tabIndex={-1}
            >
                <ObsidianIcon name={shouldCollapseItems() ? 'chevrons-down-up' : 'chevrons-up-down'} />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${settings.autoExpandFoldersTags ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.autoExpandFoldersTags}
                onClick={handleToggleAutoExpand}
                tabIndex={-1}
            >
                <ObsidianIcon name="folder-tree" />
            </button>
            <button
                className="nn-mobile-toolbar-button"
                aria-label={strings.paneHeader.newFolder}
                onClick={handleNewFolder}
                disabled={!selectionState.selectedFolder}
                tabIndex={-1}
            >
                <ObsidianIcon name="folder-plus" />
            </button>
        </div>
    );
}
