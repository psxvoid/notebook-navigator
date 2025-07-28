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

import React from 'react';

interface SkeletonViewProps {
    paneWidth: number;
    singlePane: boolean;
    currentSinglePaneView: 'navigation' | 'files';
}

export const SkeletonView = React.memo(function SkeletonView({ paneWidth, singlePane, currentSinglePaneView }: SkeletonViewProps) {
    if (singlePane) {
        return <div className={`nn-skeleton-${currentSinglePaneView}-pane`} style={{ width: '100%', height: '100%' }} />;
    }

    return (
        <>
            <div className="nn-skeleton-navigation-pane" style={{ width: `${paneWidth}px`, height: '100%' }} />
            <div className="nn-skeleton-list-pane" style={{ flex: 1, height: '100%' }} />
        </>
    );
});
