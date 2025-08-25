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
import { useSelectionState } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { strings } from '../i18n';
import type { SortOption } from '../settings';
import { ItemType } from '../types';
import { getEffectiveSortOption, getSortIcon as getSortIconName, SORT_OPTIONS } from '../utils/sortUtils';
import { ObsidianIcon } from './ObsidianIcon';
import { showListPaneAppearanceMenu } from './ListPaneAppearanceMenu';
import { useListPaneAppearance } from '../hooks/useListPaneAppearance';

export function ListTabBar() {
    const { app } = useServices();
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const selectionState = useSelectionState();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();
    const appearanceSettings = useListPaneAppearance();

    const handleNewFile = useCallback(async () => {
        if (!selectionState.selectedFolder) return;

        try {
            await fileSystemOps.createNewFile(selectionState.selectedFolder);
        } catch {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [selectionState.selectedFolder, fileSystemOps]);

    const getCurrentSortOption = useCallback((): SortOption => {
        return getEffectiveSortOption(settings, selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag);
    }, [settings, selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag]);

    const getSortIcon = useCallback(() => {
        return getSortIconName(getCurrentSortOption());
    }, [getCurrentSortOption]);

    const handleAppearanceMenu = useCallback(
        (event: React.MouseEvent) => {
            showListPaneAppearanceMenu({
                event: event.nativeEvent,
                titleRows: appearanceSettings.titleRows,
                previewRows: appearanceSettings.previewRows,
                showDate: appearanceSettings.showDate,
                showPreview: appearanceSettings.showPreview,
                showImage: appearanceSettings.showImage,
                settings,
                selectedFolder: selectionState.selectedFolder,
                selectedTag: selectionState.selectedTag,
                selectionType: selectionState.selectionType,
                updateSettings
            });
        },
        [
            appearanceSettings,
            settings,
            selectionState.selectedFolder,
            selectionState.selectedTag,
            selectionState.selectionType,
            updateSettings
        ]
    );

    const handleSortMenu = useCallback(
        (event: React.MouseEvent) => {
            const menu = new Menu();
            const currentSort = getCurrentSortOption();
            const isCustomSort =
                (selectionState.selectionType === ItemType.FOLDER &&
                    selectionState.selectedFolder &&
                    metadataService.getFolderSortOverride(selectionState.selectedFolder.path)) ||
                (selectionState.selectionType === ItemType.TAG &&
                    selectionState.selectedTag &&
                    metadataService.getTagSortOverride(selectionState.selectedTag));

            menu.addItem(item => {
                item.setTitle(
                    `${strings.paneHeader.defaultSort}: ${strings.settings.items.sortNotesBy.options[settings.defaultFolderSort]}`
                )
                    .setChecked(!isCustomSort)
                    .onClick(async () => {
                        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                            await metadataService.removeFolderSortOverride(selectionState.selectedFolder.path);
                        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                            await metadataService.removeTagSortOverride(selectionState.selectedTag);
                        }
                        app.workspace.requestSaveLayout();
                    });
            });

            menu.addSeparator();

            let lastCategory = '';
            SORT_OPTIONS.forEach(option => {
                const category = option.split('-')[0];
                if (lastCategory && lastCategory !== category) {
                    menu.addSeparator();
                }
                lastCategory = category;

                menu.addItem(item => {
                    item.setTitle(strings.settings.items.sortNotesBy.options[option])
                        .setChecked(!!isCustomSort && currentSort === option)
                        .onClick(async () => {
                            if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                                await metadataService.setFolderSortOverride(selectionState.selectedFolder.path, option);
                            } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                                await metadataService.setTagSortOverride(selectionState.selectedTag, option);
                            } else {
                                await updateSettings(s => {
                                    s.defaultFolderSort = option;
                                });
                            }
                            app.workspace.requestSaveLayout();
                        });
                });
            });

            menu.showAtMouseEvent(event.nativeEvent);
        },
        [
            selectionState.selectionType,
            selectionState.selectedFolder,
            selectionState.selectedTag,
            app,
            getCurrentSortOption,
            updateSettings,
            metadataService,
            settings
        ]
    );

    const handleToggleSubfolders = useCallback(async () => {
        await updateSettings(s => {
            s.showNotesFromSubfolders = !s.showNotesFromSubfolders;
        });
    }, [updateSettings]);

    const isCustomSort =
        (selectionState.selectionType === ItemType.FOLDER &&
            selectionState.selectedFolder &&
            metadataService.getFolderSortOverride(selectionState.selectedFolder.path)) ||
        (selectionState.selectionType === ItemType.TAG &&
            selectionState.selectedTag &&
            metadataService.getTagSortOverride(selectionState.selectedTag));

    // Check if folder or tag has custom appearance settings
    const hasCustomAppearance =
        (selectionState.selectedFolder &&
            settings.folderAppearances &&
            settings.folderAppearances[selectionState.selectedFolder.path] &&
            Object.keys(settings.folderAppearances[selectionState.selectedFolder.path]).length > 0) ||
        (selectionState.selectedTag &&
            settings.tagAppearances &&
            settings.tagAppearances[selectionState.selectedTag] &&
            Object.keys(settings.tagAppearances[selectionState.selectedTag]).length > 0);

    return (
        <div className="nn-mobile-toolbar">
            <button
                className={`nn-mobile-toolbar-button ${settings.showNotesFromSubfolders ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.toggleSubfolders}
                onClick={handleToggleSubfolders}
                disabled={selectionState.selectionType !== ItemType.FOLDER || !selectionState.selectedFolder}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-layers" />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${isCustomSort ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.changeSortOrder}
                onClick={handleSortMenu}
                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                tabIndex={-1}
            >
                <ObsidianIcon name={getSortIcon()} />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${hasCustomAppearance ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.changeAppearance}
                onClick={handleAppearanceMenu}
                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-palette" />
            </button>
            <button
                className="nn-mobile-toolbar-button"
                aria-label={strings.paneHeader.newNote}
                onClick={handleNewFile}
                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-pen-box" />
            </button>
        </div>
    );
}
