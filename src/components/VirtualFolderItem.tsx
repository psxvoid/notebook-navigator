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

import React, { useRef, useEffect } from 'react';
import { setIcon } from 'obsidian';
import { useSettingsState } from '../context/SettingsContext';
import { VirtualFolder } from '../types';
import { getIconService } from '../services/icons';

interface VirtualFolderItemProps {
    virtualFolder: VirtualFolder;
    level: number;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggle: () => void;
}

/**
 * Renders a virtual folder item used for organizing tags in the navigation pane.
 * Virtual folders are UI-only constructs that group tags (e.g., "Favorite tags", "All tags").
 * They have expand/collapse functionality but no file operations or context menus.
 * 
 * @param props - The component props
 * @param props.virtualFolder - The virtual folder data containing id, name, and optional icon
 * @param props.level - The nesting level for indentation
 * @param props.isExpanded - Whether this folder is currently expanded
 * @param props.hasChildren - Whether this folder contains child items
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
    
    const handleDoubleClick = () => {
        if (hasChildren) {
            onToggle();
        }
    };
    
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
            className="nn-folder-item"
            data-path={virtualFolder.id}
            style={{ paddingInlineStart: `${level * 20}px` }}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-level={level + 1}
        >
            <div 
                className="nn-folder-content"
                onClick={onToggle}
                onDoubleClick={handleDoubleClick}
            >
                <div 
                    className={`nn-folder-chevron ${hasChildren ? 'nn-folder-chevron--has-children' : 'nn-folder-chevron--no-children'}`}
                    ref={chevronRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggle();
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    tabIndex={-1}
                />
                {settings.showIcons && virtualFolder.icon && (
                    <span 
                        className="nn-folder-icon" 
                        ref={iconRef}
                    />
                )}
                <span className="nn-folder-name">{virtualFolder.name}</span>
                <span className="nn-folder-spacer" />
            </div>
        </div>
    );
});