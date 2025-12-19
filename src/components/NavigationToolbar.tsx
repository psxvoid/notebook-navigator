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

import { useSelectionState } from '../context/SelectionContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useNavigationActions } from '../hooks/useNavigationActions';
import { useUIState } from '../context/UIStateContext';
import { hasHiddenItemSources } from '../utils/exclusionUtils';
import { runAsyncAction } from '../utils/async';

interface NavigationToolbarProps {
    onTreeUpdateComplete?: () => void;
    onTogglePinnedShortcuts?: () => void;
    onToggleRootFolderReorder?: () => void;
    rootReorderActive?: boolean;
    rootReorderDisabled?: boolean;
    pinToggleLabel?: string;
}

export function NavigationToolbar({
    onTreeUpdateComplete,
    onTogglePinnedShortcuts,
    onToggleRootFolderReorder,
    rootReorderActive,
    rootReorderDisabled,
    pinToggleLabel
}: NavigationToolbarProps) {
    const settings = useSettingsState();
    const uxPreferences = useUXPreferences();
    const showHiddenItems = uxPreferences.showHiddenItems;
    const selectionState = useSelectionState();
    const uiState = useUIState();
    const navigationVisibility = settings.toolbarVisibility.navigation;

    // Hook providing shared navigation actions (expand/collapse, folder creation, toggle visibility)
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleShowExcludedFolders } = useNavigationActions();
    // Detects if any hidden folders, tags, or files are configured to determine if toggle should be shown
    const hasHiddenItems = hasHiddenItemSources(settings);

    const showShortcutsButton = settings.showShortcuts && navigationVisibility.shortcuts;
    const showExpandCollapseButton = navigationVisibility.expandCollapse;
    const showHiddenItemsButton = navigationVisibility.hiddenItems && hasHiddenItems;
    const showRootReorderButton = navigationVisibility.rootReorder;
    const showNewFolderButton = navigationVisibility.newFolder;

    const leftButtonCount = [showShortcutsButton, showExpandCollapseButton, showHiddenItemsButton, showRootReorderButton].filter(
        Boolean
    ).length;
    const totalButtonCount = leftButtonCount + (showNewFolderButton ? 1 : 0);
    const leftGroupClassName = leftButtonCount === 1 ? 'nn-mobile-toolbar-circle' : 'nn-mobile-toolbar-pill';
    const leftButtonBaseClassName =
        leftButtonCount === 1 ? 'nn-mobile-toolbar-button nn-mobile-toolbar-button-circle' : 'nn-mobile-toolbar-button';

    if (totalButtonCount === 0) {
        return null;
    }

    return (
        <div className="nn-mobile-toolbar">
            <div className="nn-mobile-toolbar-left">
                {leftButtonCount > 0 ? (
                    <div className={leftGroupClassName}>
                        {showShortcutsButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${uiState.pinShortcuts ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={
                                    pinToggleLabel ??
                                    (uiState.pinShortcuts ? strings.navigationPane.unpinShortcuts : strings.navigationPane.pinShortcuts)
                                }
                                onClick={onTogglePinnedShortcuts}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="lucide-bookmark" />
                            </button>
                        ) : null}
                        {showExpandCollapseButton ? (
                            <button
                                className={leftButtonBaseClassName}
                                aria-label={
                                    shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders
                                }
                                onClick={() => {
                                    handleExpandCollapseAll();
                                    if (onTreeUpdateComplete) {
                                        requestAnimationFrame(() => {
                                            onTreeUpdateComplete();
                                        });
                                    }
                                }}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name={shouldCollapseItems() ? 'lucide-chevrons-down-up' : 'lucide-chevrons-up-down'} />
                            </button>
                        ) : null}
                        {showHiddenItemsButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${showHiddenItems ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={showHiddenItems ? strings.paneHeader.hideExcludedItems : strings.paneHeader.showExcludedItems}
                                onClick={() => {
                                    handleToggleShowExcludedFolders();
                                    if (onTreeUpdateComplete) {
                                        requestAnimationFrame(() => {
                                            onTreeUpdateComplete();
                                        });
                                    }
                                }}
                                disabled={!hasHiddenItems}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="lucide-eye" />
                            </button>
                        ) : null}
                        {showRootReorderButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${rootReorderActive ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={
                                    rootReorderActive ? strings.paneHeader.finishRootFolderReorder : strings.paneHeader.reorderRootFolders
                                }
                                onClick={onToggleRootFolderReorder}
                                disabled={rootReorderDisabled}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="lucide-list-tree" />
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {showNewFolderButton ? (
                <div className="nn-mobile-toolbar-right">
                    <div className="nn-mobile-toolbar-circle">
                        <button
                            className="nn-mobile-toolbar-button nn-mobile-toolbar-button-circle"
                            aria-label={strings.paneHeader.newFolder}
                            onClick={() => {
                                runAsyncAction(() => handleNewFolder());
                            }}
                            disabled={!selectionState.selectedFolder}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="lucide-folder-plus" />
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
