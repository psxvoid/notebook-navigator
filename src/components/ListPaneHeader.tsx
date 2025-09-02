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

import React, { useEffect } from 'react';
import { TFolder, Platform } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useFileCache } from '../context/StorageContext';
import { useExpansionState } from '../context/ExpansionContext';
import { strings } from '../i18n';
import { getIconService } from '../services/icons';
import { UNTAGGED_TAG_ID, ItemType } from '../types';
import { hasVisibleSubfolders, parseExcludedFolders } from '../utils/fileFilters';
import { ObsidianIcon } from './ObsidianIcon';
import { useListActions } from '../hooks/useListActions';

interface ListPaneHeaderProps {
    onHeaderClick?: () => void;
    isSearchActive?: boolean;
    onSearchToggle?: () => void;
}

export function ListPaneHeader({ onHeaderClick, isSearchActive, onSearchToggle }: ListPaneHeaderProps) {
    const iconRef = React.useRef<HTMLSpanElement>(null);
    const mobileIconRef = React.useRef<HTMLSpanElement>(null);
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const metadataService = useMetadataService();
    const { getTagDisplayPath } = useFileCache();
    const expansionState = useExpansionState();

    // Use the shared actions hook
    const { handleNewFile, handleAppearanceMenu, handleSortMenu, handleToggleSubfolders, getSortIcon, isCustomSort, hasCustomAppearance } =
        useListActions();

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
                // Use open/closed folder icon based on expansion state and visible children
                const excludedFolders = parseExcludedFolders(settings.excludedFolders);
                const hasChildren = hasVisibleSubfolders(selectionState.selectedFolder, excludedFolders);
                const isExpanded = expansionState.expandedFolders.has(selectionState.selectedFolder.path);
                folderIcon = hasChildren && isExpanded ? 'lucide-folder-open' : 'lucide-folder-closed';
            }
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            folderIcon = metadataService.getTagIcon(selectionState.selectedTag) || 'lucide-tags';
        }
    }

    useEffect(() => {
        // Always render icon when available
        const iconService = getIconService();
        if (iconRef.current && folderIcon && settings.showIcons) {
            iconService.renderIcon(iconRef.current, folderIcon);
        }
        if (mobileIconRef.current && folderIcon && settings.showIcons) {
            iconService.renderIcon(mobileIconRef.current, folderIcon);
        }
    }, [
        folderIcon,
        settings.showIcons,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectionType,
        expansionState.expandedFolders
    ]);

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [showFade, setShowFade] = React.useState(false);

    // Auto-scroll to end when selection changes
    React.useEffect(() => {
        if (isMobile && scrollContainerRef.current) {
            // Use setTimeout to ensure the DOM has updated with new content
            const timeoutId = window.setTimeout(() => {
                if (scrollContainerRef.current) {
                    // Use scrollTo with behavior: 'instant' for immediate scroll
                    scrollContainerRef.current.scrollTo({
                        left: scrollContainerRef.current.scrollWidth,
                        behavior: 'instant'
                    });
                }
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [selectionState.selectedFolder, selectionState.selectedTag, isMobile]);

    // Check scroll position to show/hide fade
    const handleScroll = React.useCallback(() => {
        if (scrollContainerRef.current) {
            setShowFade(scrollContainerRef.current.scrollLeft > 0);
        }
    }, []);

    if (isMobile) {
        // On mobile, show simplified header with back button and path - actions moved to tab bar
        return (
            <div className="nn-pane-header nn-pane-header-simple" onClick={onHeaderClick}>
                <div className={`nn-mobile-header ${!folderIcon || !settings.showIcons ? 'nn-mobile-header-no-icon' : ''}`}>
                    <button
                        className="nn-icon-button nn-back-button"
                        aria-label={strings.paneHeader.mobileBackToNavigation}
                        onClick={e => {
                            e.stopPropagation();
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                        }}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name={Platform.isAndroidApp ? 'lucide-arrow-left' : 'lucide-chevron-left'} />
                    </button>
                    {showFade && <div className="nn-breadcrumb-fade" />}
                    <div ref={scrollContainerRef} className="nn-breadcrumb-scroll" onScroll={handleScroll}>
                        <span className="nn-mobile-title">{renderPathSegments()}</span>
                    </div>
                    {folderIcon && settings.showIcons && <span ref={mobileIconRef} className="nn-mobile-header-icon" />}
                </div>
            </div>
        );
    }

    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions nn-header-actions--space-between">
                {uiState.singlePane && (
                    <button
                        className="nn-icon-button"
                        onClick={() => {
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                        }}
                        aria-label={strings.paneHeader.showFolders}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-chevron-left" />
                    </button>
                )}
                <span className="nn-pane-header-title">
                    {folderIcon && <span ref={iconRef} className="nn-pane-header-icon" />}
                    <span className="nn-pane-header-text">{renderPathSegments()}</span>
                </span>
                <div className="nn-header-actions">
                    <button
                        className={`nn-icon-button ${isSearchActive ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.search}
                        onClick={onSearchToggle}
                        disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-search" />
                    </button>
                    <button
                        className={`nn-icon-button ${settings.showNotesFromSubfolders ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.toggleSubfolders}
                        onClick={handleToggleSubfolders}
                        disabled={selectionState.selectionType !== ItemType.FOLDER || !selectionState.selectedFolder}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-layers" />
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
                        <ObsidianIcon name="lucide-palette" />
                    </button>
                    <button
                        className="nn-icon-button"
                        aria-label={strings.paneHeader.newNote}
                        onClick={handleNewFile}
                        disabled={!selectionState.selectedFolder}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-pen-box" />
                    </button>
                </div>
            </div>
        </div>
    );
}
