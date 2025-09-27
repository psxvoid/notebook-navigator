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
import { useUIState } from '../context/UIStateContext';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useNavigationActions } from '../hooks/useNavigationActions';

interface NavigationPaneHeaderProps {
    onTreeUpdateComplete?: () => void;
    onScrollToShortcuts?: () => void;
    onToggleRootFolderReorder?: () => void;
    rootReorderActive?: boolean;
    rootReorderDisabled?: boolean;
}

export function NavigationPaneHeader({
    onTreeUpdateComplete,
    onScrollToShortcuts,
    onToggleRootFolderReorder,
    rootReorderActive,
    rootReorderDisabled
}: NavigationPaneHeaderProps) {
    const { isMobile, plugin } = useServices();
    const settings = useSettingsState();
    const uiState = useUIState();
    const selectionState = useSelectionState();

    // Hook providing shared navigation actions (expand/collapse, folder creation, toggle visibility)
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleShowExcludedFolders } = useNavigationActions();

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
                    <ObsidianIcon name={uiState.dualPane ? 'lucide-panel-left-close' : 'lucide-panel-right-open'} />
                </button>
                <div className="nn-header-actions">
                    {settings.showShortcuts ? (
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.scrollToShortcuts}
                            onClick={() => {
                                if (onScrollToShortcuts) {
                                    onScrollToShortcuts();
                                }
                            }}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="lucide-star" />
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
                    <button
                        className={`nn-icon-button ${settings.showHiddenItems ? 'nn-icon-button-active' : ''}`}
                        aria-label={settings.showHiddenItems ? strings.paneHeader.hideExcludedItems : strings.paneHeader.showExcludedItems}
                        onClick={async () => {
                            await handleToggleShowExcludedFolders();
                            if (onTreeUpdateComplete) {
                                // Defer callback until after DOM updates complete
                                requestAnimationFrame(() => {
                                    onTreeUpdateComplete();
                                });
                            }
                        }}
                        disabled={settings.excludedFolders.length === 0 && settings.hiddenTags.length === 0}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-eye" />
                    </button>
                    <button
                        className={`nn-icon-button ${rootReorderActive ? 'nn-icon-button-active' : ''}`}
                        aria-label={rootReorderActive ? strings.paneHeader.finishRootFolderReorder : strings.paneHeader.reorderRootFolders}
                        onClick={() => {
                            if (onToggleRootFolderReorder) {
                                onToggleRootFolderReorder();
                            }
                        }}
                        disabled={rootReorderDisabled}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-list-tree" />
                    </button>
                    <button
                        className="nn-icon-button"
                        aria-label={strings.paneHeader.newFolder}
                        onClick={handleNewFolder}
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
