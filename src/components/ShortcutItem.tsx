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

interface ShortcutItemProps {
    icon: string;
    label: string;
    description?: string;
    level: number;
    isDisabled?: boolean;
    type: 'folder' | 'note' | 'search' | 'tag';
    count?: number;
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
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
    onClick,
    onContextMenu
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
        return classes.join(' ');
    }, [isDisabled]);

    useEffect(() => {
        if (iconRef.current && settings.showIcons) {
            getIconService().renderIcon(iconRef.current, icon);
        }
    }, [icon, settings.showIcons, iconVersion]);

    const shouldShowCount = settings.showNoteCount && typeof count === 'number' && count > 0 && (type === 'folder' || type === 'tag');

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
            data-shortcut-type={type}
            data-level={level}
            aria-level={level + 1}
        >
            <div className="nn-navitem-content">
                {settings.showIcons && <span className="nn-navitem-icon" ref={iconRef} />}
                <span className="nn-navitem-name">
                    <span className="nn-shortcut-label">{label}</span>
                    {description ? <span className="nn-shortcut-description">{description}</span> : null}
                </span>
                <span className="nn-navitem-spacer" />
                {shouldShowCount ? <span className="nn-navitem-count">{count}</span> : null}
            </div>
        </div>
    );
});
