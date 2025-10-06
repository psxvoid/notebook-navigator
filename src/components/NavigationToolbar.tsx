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
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useNavigationActions } from '../hooks/useNavigationActions';
import { useUIState } from '../context/UIStateContext';

interface NavigationToolbarProps {
    onTreeUpdateComplete?: () => void;
    onTogglePinnedShortcuts?: () => void;
    onToggleRootFolderReorder?: () => void;
    rootReorderActive?: boolean;
    rootReorderDisabled?: boolean;
}

export function NavigationToolbar({
    onTreeUpdateComplete,
    onTogglePinnedShortcuts,
    onToggleRootFolderReorder,
    rootReorderActive,
    rootReorderDisabled
}: NavigationToolbarProps) {
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const uiState = useUIState();

    // Hook providing shared navigation actions (expand/collapse, folder creation, toggle visibility)
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleShowExcludedFolders } = useNavigationActions();
    const hasHiddenItems = settings.excludedFolders.length > 0 || settings.hiddenTags.length > 0;

    return (
        <div className="nn-mobile-toolbar">
            {settings.showShortcuts ? (
                <button
                    className="nn-mobile-toolbar-button"
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
                className="nn-mobile-toolbar-button"
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
                    className={`nn-mobile-toolbar-button ${settings.showHiddenItems ? 'nn-mobile-toolbar-button-active' : ''}`}
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
                    disabled={!hasHiddenItems}
                    tabIndex={-1}
                >
                    <ObsidianIcon name="lucide-eye" />
                </button>
            ) : null}
            <button
                className={`nn-mobile-toolbar-button ${rootReorderActive ? 'nn-mobile-toolbar-button-active' : ''}`}
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
                className="nn-mobile-toolbar-button"
                aria-label={strings.paneHeader.newFolder}
                onClick={handleNewFolder}
                disabled={!selectionState.selectedFolder}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-folder-plus" />
            </button>
        </div>
    );
}
