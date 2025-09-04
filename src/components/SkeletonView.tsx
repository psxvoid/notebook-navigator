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
    searchActive: boolean;
}

export const SkeletonView = React.memo(function SkeletonView({ paneWidth, singlePane, searchActive }: SkeletonViewProps) {
    const listPaneClass = searchActive ? 'nn-skeleton-list-pane nn-search-active' : 'nn-skeleton-list-pane';

    if (singlePane) {
        return (
            <div className={listPaneClass}>
                <div className="nn-skeleton-list-header" />
                {searchActive && <div className="nn-skeleton-search-bar" />}
                <div className="nn-skeleton-content" />
            </div>
        );
    }

    return (
        <>
            <div className="nn-skeleton-navigation-pane" style={{ width: `${paneWidth}px` }}>
                <div className="nn-skeleton-nav-header" />
                <div className="nn-skeleton-content" />
            </div>
            <div className={listPaneClass}>
                <div className="nn-skeleton-list-header" />
                {searchActive && <div className="nn-skeleton-search-bar" />}
                <div className="nn-skeleton-content" />
            </div>
        </>
    );
});
