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

    return (
        <div className="nn-mobile-toolbar">
            <div className="nn-mobile-toolbar-pill">
                {settings.showShortcuts && navigationVisibility.shortcuts ? (
                    <button
                        className="nn-mobile-toolbar-button"
                        aria-label={
                            pinToggleLabel ??
                            (uiState.pinShortcuts ? strings.navigationPane.unpinShortcuts : strings.navigationPane.pinShortcuts)
                        }
                        onClick={onTogglePinnedShortcuts}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name={uiState.pinShortcuts ? 'lucide-bookmark-minus' : 'lucide-bookmark'} />
                    </button>
                ) : null}
                {navigationVisibility.expandCollapse ? (
                    <button
                        className="nn-mobile-toolbar-button"
                        aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
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
                {navigationVisibility.hiddenItems && hasHiddenItems ? (
                    <button
                        className={`nn-mobile-toolbar-button ${showHiddenItems ? 'nn-mobile-toolbar-button-active' : ''}`}
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
                {navigationVisibility.rootReorder ? (
                    <button
                        className={`nn-mobile-toolbar-button ${rootReorderActive ? 'nn-mobile-toolbar-button-active' : ''}`}
                        aria-label={rootReorderActive ? strings.paneHeader.finishRootFolderReorder : strings.paneHeader.reorderRootFolders}
                        onClick={onToggleRootFolderReorder}
                        disabled={rootReorderDisabled}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-list-tree" />
                    </button>
                ) : null}
                {navigationVisibility.newFolder ? (
                    <button
                        className="nn-mobile-toolbar-button"
                        aria-label={strings.paneHeader.newFolder}
                        onClick={() => {
                            runAsyncAction(() => handleNewFolder());
                        }}
                        disabled={!selectionState.selectedFolder}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-folder-plus" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}
