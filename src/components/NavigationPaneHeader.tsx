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
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { useUIState } from '../context/UIStateContext';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useNavigationActions } from '../hooks/useNavigationActions';
import { hasHiddenItemSources } from '../utils/exclusionUtils';
import { runAsyncAction } from '../utils/async';

interface NavigationPaneHeaderProps {
    onTreeUpdateComplete?: () => void;
    onTogglePinnedShortcuts?: () => void;
    onToggleRootFolderReorder?: () => void;
    rootReorderActive?: boolean;
    rootReorderDisabled?: boolean;
}

export function NavigationPaneHeader({
    onTreeUpdateComplete,
    onTogglePinnedShortcuts,
    onToggleRootFolderReorder,
    rootReorderActive,
    rootReorderDisabled
}: NavigationPaneHeaderProps) {
    const { isMobile, plugin } = useServices();
    const settings = useSettingsState();
    const uxPreferences = useUXPreferences();
    const showHiddenItems = uxPreferences.showHiddenItems;
    const uiState = useUIState();
    const selectionState = useSelectionState();

    // Hook providing shared navigation actions (expand/collapse, folder creation, toggle visibility)
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleShowExcludedFolders } = useNavigationActions();
    // Detects if any hidden folders, tags, or files are configured to determine if toggle should be shown
    const hasHiddenItems = hasHiddenItemSources(settings);

    if (isMobile) {
        // Mobile devices render actions in tab bar instead of header
        return null;
    }

    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions nn-header-actions--space-between">
                <button
                    className="nn-icon-button"
                    aria-label={uiState.dualPane ? strings.paneHeader.showSinglePane : strings.paneHeader.showDualPane}
                    onClick={() => {
                        plugin.setDualPanePreference(!plugin.useDualPane());
                    }}
                    tabIndex={-1}
                >
                    <ObsidianIcon name={uiState.dualPane ? 'lucide-panel-left-dashed' : 'lucide-panel-left'} />
                </button>
                <div className="nn-header-actions">
                    {settings.showShortcuts ? (
                        <button
                            className="nn-icon-button"
                            aria-label={uiState.pinShortcuts ? strings.navigationPane.unpinShortcuts : strings.navigationPane.pinShortcuts}
                            onClick={() => {
                                if (onTogglePinnedShortcuts) {
                                    onTogglePinnedShortcuts();
                                }
                            }}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name={uiState.pinShortcuts ? 'lucide-bookmark-minus' : 'lucide-bookmark'} />
                        </button>
                    ) : null}
                    <button
                        className="nn-icon-button"
                        aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                        onClick={() => {
                            handleExpandCollapseAll();
                            if (onTreeUpdateComplete) {
                                // Defer callback until after DOM updates complete
                                requestAnimationFrame(() => {
                                    onTreeUpdateComplete();
                                });
                            }
                        }}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name={shouldCollapseItems() ? 'lucide-chevrons-down-up' : 'lucide-chevrons-up-down'} />
                    </button>
                    {hasHiddenItems ? (
                        <button
                            className={`nn-icon-button ${showHiddenItems ? 'nn-icon-button-active' : ''}`}
                            aria-label={showHiddenItems ? strings.paneHeader.hideExcludedItems : strings.paneHeader.showExcludedItems}
                            onClick={() => {
                                handleToggleShowExcludedFolders();
                                if (onTreeUpdateComplete) {
                                    // Defer callback until after DOM updates complete
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
                    <button
                        className={`nn-icon-button ${rootReorderActive ? 'nn-icon-button-active' : ''}`}
                        aria-label={rootReorderActive ? strings.paneHeader.finishRootFolderReorder : strings.paneHeader.reorderRootFolders}
                        onClick={onToggleRootFolderReorder}
                        disabled={rootReorderDisabled}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-list-tree" />
                    </button>
                    <button
                        className="nn-icon-button"
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
        </div>
    );
}
