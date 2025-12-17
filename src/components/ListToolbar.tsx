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
import { useListActions } from '../hooks/useListActions';
import { runAsyncAction } from '../utils/async';

interface ListToolbarProps {
    isSearchActive?: boolean;
    onSearchToggle?: () => void;
}

export function ListToolbar({ isSearchActive, onSearchToggle }: ListToolbarProps) {
    const uxPreferences = useUXPreferences();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;
    const selectionState = useSelectionState();
    const settings = useSettingsState();
    const listVisibility = settings.toolbarVisibility.list;

    // Use the shared actions hook
    const { handleNewFile, handleAppearanceMenu, handleSortMenu, handleToggleDescendants, getSortIcon, isCustomSort, hasCustomAppearance } =
        useListActions();

    const showSearchButton = listVisibility.search;
    const showDescendantsButton = listVisibility.descendants;
    const showSortButton = listVisibility.sort;
    const showAppearanceButton = listVisibility.appearance;
    const showNewNoteButton = listVisibility.newNote;

    const leftButtonCount = [showSearchButton, showDescendantsButton, showSortButton, showAppearanceButton].filter(Boolean).length;
    const totalButtonCount = leftButtonCount + (showNewNoteButton ? 1 : 0);
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
                        {showSearchButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${isSearchActive ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={strings.paneHeader.search}
                                onClick={onSearchToggle}
                                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="lucide-search" />
                            </button>
                        ) : null}
                        {showDescendantsButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${includeDescendantNotes ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={strings.paneHeader.toggleDescendantNotes}
                                onClick={handleToggleDescendants}
                                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="lucide-layers" />
                            </button>
                        ) : null}
                        {showSortButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${isCustomSort ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={strings.paneHeader.changeSortOrder}
                                onClick={handleSortMenu}
                                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name={getSortIcon()} />
                            </button>
                        ) : null}
                        {showAppearanceButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${hasCustomAppearance ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={strings.paneHeader.changeAppearance}
                                onClick={handleAppearanceMenu}
                                disabled={!selectionState.selectedFolder && !selectionState.selectedTag}
                                tabIndex={-1}
                            >
                                <ObsidianIcon name="lucide-palette" />
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {showNewNoteButton ? (
                <div className="nn-mobile-toolbar-right">
                    <div className="nn-mobile-toolbar-circle">
                        <button
                            className="nn-mobile-toolbar-button nn-mobile-toolbar-button-circle"
                            aria-label={strings.paneHeader.newNote}
                            onClick={() => {
                                runAsyncAction(() => handleNewFile());
                            }}
                            disabled={!selectionState.selectedFolder}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="lucide-pen-box" />
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
