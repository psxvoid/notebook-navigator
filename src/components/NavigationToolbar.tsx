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

export function NavigationToolbar() {
    const settings = useSettingsState();
    const selectionState = useSelectionState();

    // Use the shared actions hook
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleAutoExpand } = useNavigationActions();

    return (
        <div className="nn-mobile-toolbar">
            <button
                className="nn-mobile-toolbar-button"
                aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                onClick={handleExpandCollapseAll}
                tabIndex={-1}
            >
                <ObsidianIcon name={shouldCollapseItems() ? 'lucide-chevrons-down-up' : 'lucide-chevrons-up-down'} />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${settings.autoExpandFoldersTags ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.autoExpandFoldersTags}
                onClick={handleToggleAutoExpand}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-folder-tree" />
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
