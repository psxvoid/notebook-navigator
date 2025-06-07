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
import { TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { setIcon } from 'obsidian';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { useContextMenu } from '../hooks/useContextMenu';
import { useScrollIntoView } from '../hooks/useScrollIntoView';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';

interface FolderItemProps {
    folder: TFolder;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
}

/**
 * Renders an individual folder item in the folder tree with expand/collapse functionality.
 * Displays folder icon, name, and optional file count. Handles selection state,
 * context menus, drag-and-drop, and auto-scrolling when selected.
 * 
 * @param props - The component props
 * @param props.folder - The Obsidian TFolder to display
 * @param props.level - The nesting level for indentation
 * @param props.isExpanded - Whether this folder is currently expanded
 * @param props.isSelected - Whether this folder is currently selected
 * @param props.onToggle - Handler called when the expand/collapse chevron is clicked
 * @param props.onClick - Handler called when the folder is clicked
 * @returns A folder item element with chevron, icon, name and optional file count
 */
export function FolderItem({ folder, level, isExpanded, isSelected, onToggle, onClick }: FolderItemProps) {
    const { app, plugin, refreshCounter, appState } = useAppContext();
    const folderRef = useRef<HTMLDivElement>(null);
    
    // Enable context menu
    useContextMenu(folderRef, { type: 'folder', item: folder });
    
    // Auto-scroll to selected folder when needed
    useScrollIntoView(
        folderRef,
        '.nn-folder-tree',
        isSelected,
        [folder.path, appState.scrollToFolderTrigger]
    );
    
    // Count files in folder (including subfolders if setting enabled)
    const fileCount = React.useMemo(() => {
        if (!plugin.settings.showFolderFileCount) return 0;
        
        // Parse excluded properties
        const excludedProperties = parseExcludedProperties(plugin.settings.excludedFiles);
        
        const countFiles = (folder: TFolder): number => {
            let count = 0;
            for (const child of folder.children) {
                if (isTFile(child)) {
                    if (child.extension === 'md' || child.extension === 'canvas' || child.extension === 'base') {
                        // Check if file should be excluded
                        if (!shouldExcludeFile(child, excludedProperties, app)) {
                            count++;
                        }
                    }
                } else if (plugin.settings.showNotesFromSubfolders && isTFolder(child)) {
                    count += countFiles(child);
                }
            }
            return count;
        };
        
        return countFiles(folder);
    }, [folder.path, folder.children.length, plugin.settings.showFolderFileCount, plugin.settings.showNotesFromSubfolders, plugin.settings.excludedFiles, app, refreshCounter]);

    const hasChildren = folder.children.some(isTFolder);
    
    const handleDoubleClick = () => {
        if (hasChildren) {
            onToggle();
        }
    };
    
    const chevronRef = React.useRef<HTMLDivElement>(null);
    const iconRef = React.useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded]);

    // Add this useEffect for the folder icon
    useEffect(() => {
        if (iconRef.current) {
            const customIcon = plugin.settings.folderIcons?.[folder.path];
            if (customIcon) {
                // Custom icon is set - always show it, never toggle
                setIcon(iconRef.current, customIcon);
            } else {
                // Default icon - show open folder only if has children AND is expanded
                const iconName = (hasChildren && isExpanded) ? 'folder-open' : 'folder-closed';
                setIcon(iconRef.current, iconName);
            }
        }
    }, [isExpanded, folder.path, plugin.settings.folderIcons, hasChildren, refreshCounter]);

    return (
        <div 
            ref={folderRef}
            className={`nn-folder-item ${isSelected ? 'nn-selected' : ''}`}
            data-path={folder.path}
            data-drag-path={folder.path}
            data-drag-type="folder"
            data-draggable="true"
            draggable="true"
        >
            <div 
                className="nn-folder-content"
                onClick={onClick}
                onDoubleClick={handleDoubleClick}
                data-drop-zone="folder"
                data-drop-path={folder.path}
                data-clickable="folder"
                style={{ paddingLeft: `${level * 20}px` }}
            >
                <div 
                    className="nn-folder-chevron"
                    ref={chevronRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggle();
                    }}
                    style={{ 
                        visibility: hasChildren ? 'visible' : 'hidden',
                        cursor: hasChildren ? 'pointer' : 'default'
                    }}
                />
                <span className="nn-folder-icon" ref={iconRef}></span>
                <span className="nn-folder-name">{folder.path === '/' || folder.path === '' ? 'Vault' : folder.name}</span>
                {plugin.settings.showFolderFileCount && fileCount > 0 && (
                    <span className="nn-folder-count">{fileCount}</span>
                )}
            </div>
        </div>
    );
}