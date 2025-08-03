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

import React, { useCallback, useEffect } from 'react';
import { Menu } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { strings } from '../i18n';
import { getIconService } from '../services/icons';
import type { SortOption } from '../settings';
import { UNTAGGED_TAG_ID, ItemType } from '../types';
import { getFilesForFolder } from '../utils/fileFinder';
import { getEffectiveSortOption, getSortIcon as getSortIconName, SORT_OPTIONS } from '../utils/sortUtils';
import { ObsidianIcon } from './ObsidianIcon';

interface ListPaneHeaderProps {
    onHeaderClick?: () => void;
    currentDateGroup?: string | null;
}

export function ListPaneHeader({ onHeaderClick, currentDateGroup }: ListPaneHeaderProps) {
    const iconRef = React.useRef<HTMLSpanElement>(null);
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();

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
        const wasShowingSubfolders = settings.showNotesFromSubfolders;

        await updateSettings(s => {
            s.showNotesFromSubfolders = !s.showNotesFromSubfolders;
        });

        if (!wasShowingSubfolders && selectionState.selectedFolder && !selectionState.selectedFile) {
            const activeFile = app.workspace.getActiveFile();
            if (activeFile) {
                const filesInFolder = getFilesForFolder(selectionState.selectedFolder, { ...settings, showNotesFromSubfolders: true }, app);

                if (filesInFolder.some(f => f.path === activeFile.path)) {
                    selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
                }
            }
        }
    }, [updateSettings, settings, selectionState.selectedFolder, selectionState.selectedFile, app, selectionDispatch]);

    const isCustomSort =
        (selectionState.selectionType === ItemType.FOLDER &&
            selectionState.selectedFolder &&
            metadataService.getFolderSortOverride(selectionState.selectedFolder.path)) ||
        (selectionState.selectionType === ItemType.TAG &&
            selectionState.selectedTag &&
            metadataService.getTagSortOverride(selectionState.selectedTag));

    const getHeaderTitle = (useFolderName = false): string => {
        let title = strings.common.noSelection;

        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            if (selectionState.selectedFolder.path === '/') {
                title = settings.customVaultName || app.vault.getName();
            } else {
                title = useFolderName ? selectionState.selectedFolder.name : selectionState.selectedFolder.path;
            }
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            title = selectionState.selectedTag === UNTAGGED_TAG_ID ? strings.common.untagged : `#${selectionState.selectedTag}`;
        }

        if (currentDateGroup) {
            title = currentDateGroup;
        }

        return title;
    };

    let headerTitle = '';
    let folderIcon = '';

    useEffect(() => {
        if (iconRef.current && folderIcon && settings.showIcons) {
            const iconService = getIconService();
            iconService.renderIcon(iconRef.current, folderIcon);
        }
    }, [folderIcon, settings.showIcons, uiState.singlePane]);

    if (isMobile) {
        const headerTitle = getHeaderTitle(true);

        return (
            <div className="nn-pane-header" onClick={onHeaderClick}>
                <div className="nn-header-actions">
                    <div className="nn-mobile-back">
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.mobileBackToNavigation}
                            onClick={e => {
                                e.stopPropagation();
                                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                            }}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="arrow-left" />
                        </button>
                        <span
                            className="nn-mobile-title"
                            onClick={e => {
                                e.stopPropagation();
                                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                            }}
                        >
                            {headerTitle}
                        </span>
                    </div>
                    <div className="nn-header-actions">
                        <button
                            className={`nn-icon-button ${settings.showNotesFromSubfolders ? 'nn-icon-button-active' : ''}`}
                            aria-label={strings.paneHeader.toggleSubfolders}
                            onClick={e => {
                                e.stopPropagation();
                                handleToggleSubfolders();
                            }}
                            disabled={selectionState.selectionType !== ItemType.FOLDER || !selectionState.selectedFolder}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="layers" />
                        </button>
                        <button
                            className={`nn-icon-button ${isCustomSort ? 'nn-icon-button-active' : ''}`}
                            aria-label={strings.paneHeader.changeSortOrder}
                            onClick={e => {
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
                            onClick={e => {
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

    headerTitle = getHeaderTitle(false);

    if (settings.showIcons) {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            folderIcon = metadataService.getFolderIcon(selectionState.selectedFolder.path) || 'folder';
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            folderIcon = metadataService.getTagIcon(selectionState.selectedTag) || 'tags';
        }
    }

    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions nn-header-actions--space-between">
                {headerTitle && (
                    <span className="nn-pane-header-title">
                        {uiState.singlePane ? (
                            <button
                                className="nn-icon-button nn-icon-button-muted nn-pane-header-icon-button"
                                onClick={() => {
                                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                                }}
                                aria-label={strings.paneHeader.showFolders}
                            >
                                <ObsidianIcon name="chevron-left" className="nn-pane-header-icon" />
                            </button>
                        ) : (
                            folderIcon && <span ref={iconRef} className="nn-pane-header-icon" />
                        )}
                        <span className="nn-pane-header-text">{headerTitle}</span>
                    </span>
                )}
                <div className="nn-header-actions">
                    <button
                        className={`nn-icon-button ${settings.showNotesFromSubfolders ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.toggleSubfolders}
                        onClick={handleToggleSubfolders}
                        disabled={selectionState.selectionType !== ItemType.FOLDER || !selectionState.selectedFolder}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="layers" />
                    </button>
                    <button
                        className={`nn-icon-button ${isCustomSort ? 'nn-icon-button-active' : ''}`}
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
            </div>
        </div>
    );
}
