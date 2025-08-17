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
import { Menu, TFolder } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useFileCache } from '../context/StorageContext';
import { useExpansionState } from '../context/ExpansionContext';
import { strings } from '../i18n';
import { getIconService } from '../services/icons';
import type { SortOption } from '../settings';
import { UNTAGGED_TAG_ID, ItemType } from '../types';
import { getFilesForFolder } from '../utils/fileFinder';
import { getEffectiveSortOption, getSortIcon as getSortIconName, SORT_OPTIONS } from '../utils/sortUtils';
import { ObsidianIcon } from './ObsidianIcon';
import { showListPaneAppearanceMenu } from './ListPaneAppearanceMenu';
import { useListPaneAppearance } from '../hooks/useListPaneAppearance';

interface ListPaneHeaderProps {
    onHeaderClick?: () => void;
}

export function ListPaneHeader({ onHeaderClick }: ListPaneHeaderProps) {
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
    const { getTagDisplayPath } = useFileCache();
    const appearanceSettings = useListPaneAppearance();
    const expansionState = useExpansionState();

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

    // Function to render clickable path segments
    const renderPathSegments = (): React.ReactNode => {
        // Handle folders
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            const folder = selectionState.selectedFolder;

            // Root folder - just show vault name, not clickable
            if (folder.path === '/') {
                return settings.customVaultName || app.vault.getName();
            }

            // Split path into segments
            const segments = folder.path.split('/').filter(s => s);

            // Single segment - no parent to click
            if (segments.length === 1) {
                return folder.name;
            }

            // Multiple segments - make all but last clickable
            return (
                <>
                    {segments.map((segment, index) => {
                        const isLast = index === segments.length - 1;

                        if (isLast) {
                            return (
                                <span key={index} className="nn-path-current">
                                    {segment}
                                </span>
                            );
                        }

                        const pathToSegment = segments.slice(0, index + 1).join('/');
                        return (
                            <React.Fragment key={pathToSegment}>
                                <span
                                    className="nn-path-segment"
                                    onClick={e => {
                                        e.stopPropagation();
                                        const targetFolder = app.vault.getAbstractFileByPath(pathToSegment);
                                        if (targetFolder instanceof TFolder) {
                                            selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: targetFolder });
                                        }
                                    }}
                                >
                                    {segment}
                                </span>
                                <span className="nn-path-separator"> / </span>
                            </React.Fragment>
                        );
                    })}
                </>
            );
        }

        // Handle tags
        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            const tag = selectionState.selectedTag;

            // Special case for untagged
            if (tag === UNTAGGED_TAG_ID) {
                return strings.common.untagged;
            }

            // Get display path for tag
            const displayPath = getTagDisplayPath(tag);
            const segments = displayPath.split('/').filter(s => s);

            // Single segment tag - no parent to click
            if (segments.length === 1) {
                return displayPath;
            }

            // Multiple segments - make all but last clickable
            return (
                <>
                    {segments.map((segment, index) => {
                        const isLast = index === segments.length - 1;

                        if (isLast) {
                            return (
                                <span key={index} className="nn-path-current">
                                    {segment}
                                </span>
                            );
                        }

                        const pathToSegment = segments.slice(0, index + 1).join('/');
                        return (
                            <React.Fragment key={pathToSegment}>
                                <span
                                    className="nn-path-segment"
                                    onClick={e => {
                                        e.stopPropagation();
                                        selectionDispatch({ type: 'SET_SELECTED_TAG', tag: pathToSegment });
                                    }}
                                >
                                    {segment}
                                </span>
                                <span className="nn-path-separator"> / </span>
                            </React.Fragment>
                        );
                    })}
                </>
            );
        }

        // Fallback for no selection
        return strings.common.noSelection;
    };

    // Determine the icon to display based on current selection
    let folderIcon = '';
    if (settings.showIcons) {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            const customIcon = metadataService.getFolderIcon(selectionState.selectedFolder.path);
            if (customIcon) {
                folderIcon = customIcon;
            } else {
                // Use open/closed folder icon based on expansion state and children
                const hasChildren = selectionState.selectedFolder.children.length > 0;
                const isExpanded = expansionState.expandedFolders.has(selectionState.selectedFolder.path);
                folderIcon = hasChildren && isExpanded ? 'folder-open' : 'folder-closed';
            }
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            folderIcon = metadataService.getTagIcon(selectionState.selectedTag) || 'tags';
        }
    }

    useEffect(() => {
        // Only render icon in dual pane mode (in single pane, we show a chevron button instead)
        if (iconRef.current && folderIcon && settings.showIcons && !uiState.singlePane) {
            const iconService = getIconService();
            iconService.renderIcon(iconRef.current, folderIcon);
        }
    }, [
        folderIcon,
        settings.showIcons,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectionType,
        uiState.singlePane,
        expansionState.expandedFolders
    ]);

    if (isMobile) {
        // On mobile, show simplified header with back button and path - actions moved to tab bar
        return (
            <div className="nn-pane-header nn-pane-header-simple" onClick={onHeaderClick}>
                <div className="nn-mobile-header">
                    <button
                        className="nn-icon-button nn-back-button"
                        aria-label={strings.paneHeader.mobileBackToNavigation}
                        onClick={e => {
                            e.stopPropagation();
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                        }}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="arrow-left" />
                    </button>
                    <span className="nn-mobile-title">{renderPathSegments()}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions nn-header-actions--space-between">
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
                    <span className="nn-pane-header-text">{renderPathSegments()}</span>
                </span>
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
                        className={`nn-icon-button ${hasCustomAppearance ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.changeAppearance}
                        onClick={handleAppearanceMenu}
                        disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="palette" />
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
