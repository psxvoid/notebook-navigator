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

import React, { useState, useEffect, forwardRef } from 'react';
import { useFileCache } from '../context/StorageContext';
import { useUIState } from '../context/UIStateContext';
import { STORAGE_KEYS, NAVIGATION_PANE_DIMENSIONS } from '../types';
import { NotebookNavigatorComponent } from './NotebookNavigatorComponent';
import type { NotebookNavigatorHandle } from './NotebookNavigatorComponent';
import { SkeletonView } from './SkeletonView';
import { localStorage } from '../utils/localStorage';

/**
 * Container component that handles storage initialization.
 * Shows a skeleton view while storage is loading, then renders the full navigator.
 */
export const NotebookNavigatorContainer = React.memo(
    forwardRef<NotebookNavigatorHandle>(function NotebookNavigatorContainer(_, ref) {
        const { isStorageReady } = useFileCache();
        const uiState = useUIState();
        const [paneWidth, setPaneWidth] = useState(NAVIGATION_PANE_DIMENSIONS.defaultWidth);

        // Load saved pane width
        useEffect(() => {
            const savedWidth = localStorage.get<number>(STORAGE_KEYS.navigationPaneWidthKey);
            if (savedWidth) {
                setPaneWidth(savedWidth);
            }
        }, []);

        if (!isStorageReady) {
            return (
                <div className="nn-split-container nn-desktop">
                    <SkeletonView paneWidth={paneWidth} singlePane={uiState.singlePane} />
                </div>
            );
        }

        return <NotebookNavigatorComponent ref={ref} />;
    })
);
