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
import { useSettingsState } from '../context/SettingsContext';
import type { ListReorderHandlers } from '../hooks/useListReorder';
import { NavigationListRow, type DragHandleConfig } from './NavigationListRow';

interface ShortcutItemProps {
    icon: string;
    color?: string;
    label: string;
    description?: string;
    level: number;
    isDisabled?: boolean;
    type: 'folder' | 'note' | 'search' | 'tag';
    count?: number;
    isExcluded?: boolean;
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    dragHandlers?: ListReorderHandlers;
    showDropIndicatorBefore?: boolean;
    showDropIndicatorAfter?: boolean;
    isDragSource?: boolean;
    dragHandleConfig?: DragHandleConfig;
}

export const ShortcutItem = React.memo(function ShortcutItem({
    icon,
    color,
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
    isDragSource,
    dragHandleConfig
}: ShortcutItemProps) {
    const settings = useSettingsState();
    // Determine whether to display count based on settings and item type
    const shouldShowCount = settings.showNoteCount && typeof count === 'number' && count > 0 && (type === 'folder' || type === 'tag');

    return (
        <NavigationListRow
            icon={icon}
            color={color}
            label={label}
            description={description}
            level={level}
            itemType={type}
            isDisabled={isDisabled}
            isExcluded={isExcluded}
            onClick={event => {
                if (isDisabled) {
                    event.preventDefault();
                    return;
                }
                onClick(event);
            }}
            onContextMenu={onContextMenu}
            dragHandlers={dragHandlers}
            showDropIndicatorBefore={showDropIndicatorBefore}
            showDropIndicatorAfter={showDropIndicatorAfter}
            isDragSource={isDragSource}
            showCount={shouldShowCount}
            count={count}
            className="nn-shortcut-item"
            tabIndex={-1}
            ariaDisabled={isDisabled}
            ariaGrabbed={isDragSource}
            dragHandleConfig={dragHandleConfig}
        />
    );
});
