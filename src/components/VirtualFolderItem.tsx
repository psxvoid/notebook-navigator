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

/**
 * OPTIMIZATIONS:
 *
 * 1. React.memo - Component only re-renders when props actually change
 *
 * 2. Props-based data flow:
 *    - All data comes from NavigationPane via props
 *    - virtualFolder: Static UI construct defined in NavigationPane
 *    - isExpanded: Expansion state from ExpansionContext (via NavigationPane)
 *    - hasChildren: Computed by NavigationPane based on tag tree structure
 *    - No direct service or cache access
 *
 * 3. Stable callbacks:
 *    - handleDoubleClick: Memoized to handle expansion toggle
 *    - handleChevronClick: Memoized with event propagation handling
 *
 * 4. Icon optimization:
 *    - Icons set via useEffect to avoid render blocking
 *    - Chevron updates based on hasChildren and isExpanded
 *    - Virtual folder icons are defined in the virtualFolder prop
 *
 * 5. Minimal overhead:
 *    - No file operations or context menus
 *    - No tooltip functionality needed
 *    - Pure presentational component
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { setIcon } from 'obsidian';
import { useSettingsState } from '../context/SettingsContext';
import { getIconService } from '../services/icons';
import { VirtualFolder } from '../types';

interface VirtualFolderItemProps {
    virtualFolder: VirtualFolder; // Static data structure from NavigationPane
    level: number; // Nesting level for indentation
    isExpanded: boolean; // From ExpansionContext via NavigationPane
    hasChildren: boolean; // Computed by NavigationPane from tag tree
    onToggle: () => void; // Expansion toggle handler
}

/**
 * Renders a virtual folder item used for organizing tags in the navigation pane.
 * Virtual folders are UI-only constructs that group tags (e.g., "Favorite tags", "All tags").
 * They have expand/collapse functionality but no file operations or context menus.
 *
 * This is a pure presentational component - all data flows from NavigationPane via props.
 *
 * @param props - The component props
 * @param props.virtualFolder - The virtual folder data containing id, name, and optional icon (defined in NavigationPane)
 * @param props.level - The nesting level for indentation
 * @param props.isExpanded - Whether this folder is currently expanded (from ExpansionContext via NavigationPane)
 * @param props.hasChildren - Whether this folder contains child items (computed by NavigationPane)
 * @param props.onToggle - Handler called when the expand/collapse chevron is clicked
 * @returns A virtual folder item element with chevron, icon, and name
 */
export const VirtualFolderComponent = React.memo(function VirtualFolderComponent({
    virtualFolder,
    level,
    isExpanded,
    hasChildren,
    onToggle
}: VirtualFolderItemProps) {
    const settings = useSettingsState();
    const folderRef = useRef<HTMLDivElement>(null);
    const chevronRef = useRef<HTMLDivElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);

    const handleDoubleClick = useCallback(() => {
        if (hasChildren) {
            onToggle();
        }
    }, [hasChildren, onToggle]);

    const handleChevronClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) onToggle();
        },
        [hasChildren, onToggle]
    );

    const handleChevronDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

    useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded]);

    useEffect(() => {
        if (iconRef.current && settings.showIcons && virtualFolder.icon) {
            getIconService().renderIcon(iconRef.current, virtualFolder.icon);
        }
    }, [virtualFolder.icon, settings.showIcons]);

    return (
        <div
            ref={folderRef}
            className="nn-navitem"
            data-path={virtualFolder.id}
            data-level={level}
            style={{ paddingInlineStart: `${level * 20}px` }}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-level={level + 1}
        >
            <div className="nn-navitem-content" onClick={onToggle} onDoubleClick={handleDoubleClick}>
                <div
                    className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                    ref={chevronRef}
                    onClick={handleChevronClick}
                    onDoubleClick={handleChevronDoubleClick}
                    tabIndex={-1}
                />
                {settings.showIcons && virtualFolder.icon && <span className="nn-navitem-icon" ref={iconRef} />}
                <span className="nn-navitem-name">{virtualFolder.name}</span>
                <span className="nn-navitem-spacer" />
            </div>
        </div>
    );
});
