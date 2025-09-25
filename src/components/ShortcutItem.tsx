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

import React, { useMemo, useEffect, useRef } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { getIconService, useIconServiceVersion } from '../services/icons';
import type { ShortcutDragHandlers } from '../hooks/useShortcutReorder';

interface ShortcutItemProps {
    icon: string;
    label: string;
    description?: string;
    level: number;
    isDisabled?: boolean;
    type: 'folder' | 'note' | 'search' | 'tag';
    count?: number;
    isExcluded?: boolean;
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    dragHandlers?: ShortcutDragHandlers;
    showDropIndicatorBefore?: boolean;
    showDropIndicatorAfter?: boolean;
    isDragSource?: boolean;
}

/**
 * Renders a single shortcut item in the navigation pane.
 * Handles click events and visual states for different shortcut types.
 */
export const ShortcutItem = React.memo(function ShortcutItem({
    icon,
    label,
    description,
    level,
    isDisabled,
    type,
    count,
    isExcluded,
    onClick,
    onContextMenu,
    dragHandlers,
    showDropIndicatorBefore,
    showDropIndicatorAfter,
    isDragSource
}: ShortcutItemProps) {
    const settings = useSettingsState();
    const iconRef = useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();

    // Build CSS classes based on disabled state
    const itemClassName = useMemo(() => {
        const classes = ['nn-navitem', 'nn-shortcut-item'];
        if (isDisabled) {
            classes.push('nn-shortcut-disabled');
        }
        if (isExcluded) {
            classes.push('nn-excluded');
        }
        if (isDragSource) {
            classes.push('nn-shortcut-drag-source');
        }
        return classes.join(' ');
    }, [isDisabled, isExcluded, isDragSource]);

    useEffect(() => {
        if (iconRef.current && settings.showIcons) {
            getIconService().renderIcon(iconRef.current, icon);
        }
    }, [icon, settings.showIcons, iconVersion]);

    const shouldShowCount = settings.showNoteCount && typeof count === 'number' && count > 0 && (type === 'folder' || type === 'tag');

    const draggable = dragHandlers?.draggable ?? false;

    return (
        <div
            className={itemClassName}
            style={{ '--level': level } as React.CSSProperties}
            onClick={event => {
                // Prevent clicks on disabled shortcuts
                if (isDisabled) {
                    event.preventDefault();
                    return;
                }
                onClick(event);
            }}
            onContextMenu={event => {
                if (onContextMenu) {
                    onContextMenu(event);
                }
            }}
            role="treeitem"
            tabIndex={-1}
            aria-disabled={isDisabled || undefined}
            aria-grabbed={isDragSource ? true : undefined}
            data-shortcut-type={type}
            data-level={level}
            data-shortcut-draggable={draggable ? 'true' : undefined}
            aria-level={level + 1}
            draggable={draggable}
            onDragStart={dragHandlers?.onDragStart}
            onDragOver={dragHandlers?.onDragOver}
            onDragLeave={dragHandlers?.onDragLeave}
            onDrop={dragHandlers?.onDrop}
            onDragEnd={dragHandlers?.onDragEnd}
        >
            {showDropIndicatorBefore ? <div className="nn-shortcut-drop-indicator" data-position="before" aria-hidden="true" /> : null}
            <div className="nn-navitem-content">
                <span className="nn-navitem-chevron nn-navitem-chevron--no-children" aria-hidden="true" />
                {settings.showIcons && <span className="nn-navitem-icon" ref={iconRef} />}
                <span className="nn-navitem-name">
                    <span className="nn-shortcut-label">{label}</span>
                    {description ? <span className="nn-shortcut-description">{description}</span> : null}
                </span>
                <span className="nn-navitem-spacer" />
                {shouldShowCount ? <span className="nn-navitem-count">{count}</span> : null}
            </div>
            {showDropIndicatorAfter ? <div className="nn-shortcut-drop-indicator" data-position="after" aria-hidden="true" /> : null}
        </div>
    );
});
