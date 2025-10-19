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

import { useCallback } from 'react';
import { useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { normalizeTagPath } from '../utils/tagUtils';
import { UNTAGGED_TAG_ID } from '../types';

/**
 * Custom hook that provides tag navigation functionality.
 * Handles navigating to tags, expanding parent tags, and managing UI state.
 *
 * This hook encapsulates the tag navigation logic to make it reusable
 * across different components (NotebookNavigatorComponent, FileItem, etc).
 */
export function useTagNavigation() {
    const selectionDispatch = useSelectionDispatch();
    const expansionDispatch = useExpansionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

    /**
     * Navigates to a tag, expanding parent tags if it's hierarchical.
     *
     * @param tagPath - The tag path to navigate to (e.g., "parent/child")
     */
    const navigateToTag = useCallback(
        (tagPath: string) => {
            const canonicalPath = normalizeTagPath(tagPath);
            if (!canonicalPath) {
                return;
            }

            // For hierarchical tags, expand all parent tags
            if (canonicalPath !== UNTAGGED_TAG_ID && canonicalPath.includes('/')) {
                const tagsToExpand: string[] = [];
                const parts = canonicalPath.split('/');

                // Build parent paths to expand
                for (let i = 1; i <= parts.length - 1; i++) {
                    tagsToExpand.push(parts.slice(0, i).join('/'));
                }

                // Expand parent tags
                if (tagsToExpand.length > 0) {
                    expansionDispatch({ type: 'EXPAND_TAGS', tagPaths: tagsToExpand });
                }
            }

            selectionDispatch({ type: 'SET_SELECTED_TAG', tag: canonicalPath });

            // Switch to files view in single-pane mode
            if (uiState.singlePane) {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            // Set focus to navigation pane to show the selected tag
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
        },
        [selectionDispatch, expansionDispatch, uiState.singlePane, uiDispatch]
    );

    return {
        navigateToTag
    };
}
