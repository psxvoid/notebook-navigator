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

interface NavigationToolbarProps {
    onExpandCollapseComplete?: () => void;
}

export function NavigationToolbar({ onExpandCollapseComplete }: NavigationToolbarProps) {
    const settings = useSettingsState();
    const selectionState = useSelectionState();

    // Use the shared actions hook
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleShowExcludedFolders } = useNavigationActions();

    return (
        <div className="nn-mobile-toolbar">
            <button
                className="nn-mobile-toolbar-button"
                aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                onClick={() => {
                    handleExpandCollapseAll();
                    if (onExpandCollapseComplete) {
                        // Use requestAnimationFrame to ensure DOM updates are complete
                        requestAnimationFrame(() => {
                            onExpandCollapseComplete();
                        });
                    }
                }}
                tabIndex={-1}
            >
                <ObsidianIcon name={shouldCollapseItems() ? 'lucide-chevrons-down-up' : 'lucide-chevrons-up-down'} />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${settings.showHiddenItems ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={settings.showHiddenItems ? strings.paneHeader.hideExcludedItems : strings.paneHeader.showExcludedItems}
                onClick={handleToggleShowExcludedFolders}
                disabled={settings.excludedFolders.length === 0 && settings.hiddenTags.length === 0}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-eye" />
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
