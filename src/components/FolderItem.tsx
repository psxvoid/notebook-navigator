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
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { setIcon } from 'obsidian';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { useContextMenu } from '../hooks/useContextMenu';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { getFolderNote } from '../utils/fileFinder';
import { strings } from '../i18n';

interface FolderItemProps {
    folder: TFolder;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
    onNameClick?: () => void;
    icon?: string;
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
export const FolderItem = React.memo(function FolderItem({ folder, level, isExpanded, isSelected, onToggle, onClick, onNameClick, icon }: FolderItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const folderRef = useRef<HTMLDivElement>(null);
    
    // Enable context menu
    useContextMenu(folderRef, { type: 'folder', item: folder });
    
    // Count files in folder (including subfolders if setting enabled)
    const fileCount = React.useMemo(() => {
        if (!settings.showFolderFileCount) return 0;
        
        // Parse excluded properties
        const excludedProperties = parseExcludedProperties(settings.excludedFiles);
        
        const countFiles = (folder: TFolder): number => {
            let count = 0;
            for (const child of folder.children) {
                if (isTFile(child)) {
                    if (child.extension === 'md' || child.extension === 'canvas' || child.extension === 'base' || child.extension === 'pdf') {
                        // Check if file should be excluded
                        if (!shouldExcludeFile(child, excludedProperties, app)) {
                            count++;
                        }
                    }
                } else if (settings.showNotesFromSubfolders && isTFolder(child)) {
                    count += countFiles(child);
                }
            }
            return count;
        };
        
        return countFiles(folder);
    }, [folder.path, folder.children.length, settings.showFolderFileCount, settings.showNotesFromSubfolders, settings.excludedFiles, app]);

    const hasChildren = folder.children.some(isTFolder);
    
    const handleDoubleClick = () => {
        if (hasChildren) {
            onToggle();
        }
    };
    
    const chevronRef = React.useRef<HTMLDivElement>(null);
    const iconRef = React.useRef<HTMLSpanElement>(null);
    const customColor = settings.folderColors?.[folder.path];
    
    // Check if folder has a folder note
    const folderNote = settings.enableFolderNotes ? getFolderNote(folder, settings, app) : null;
    const hasFolderNote = folderNote !== null;

    useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded]);

    // Add this useEffect for the folder icon
    useEffect(() => {
        if (iconRef.current && settings.showFolderIcons) {
            if (icon) {
                // Custom icon is set - always show it, never toggle
                setIcon(iconRef.current, icon);
            } else {
                // Default icon - show open folder only if has children AND is expanded
                const iconName = (hasChildren && isExpanded) ? 'folder-open' : 'folder-closed';
                setIcon(iconRef.current, iconName);
            }
        }
    }, [isExpanded, icon, hasChildren, settings.showFolderIcons]);

    return (
        <div 
            ref={folderRef}
            className={`nn-folder-item ${isSelected ? 'nn-selected' : ''}`}
            data-path={folder.path}
            data-drag-path={folder.path}
            data-drag-type="folder"
            data-draggable={!isMobile ? "true" : undefined}
            draggable={!isMobile}
            style={{ paddingInlineStart: `${level * 20}px` }}
        >
            <div 
                className="nn-folder-content"
                onClick={onClick}
                onDoubleClick={handleDoubleClick}
                data-drop-zone="folder"
                data-drop-path={folder.path}
                data-clickable="folder"
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
                {settings.showFolderIcons && (
                    <span 
                        className="nn-folder-icon" 
                        ref={iconRef}
                        style={customColor ? { color: customColor } : undefined}
                    ></span>
                )}
                <span 
                    className={`nn-folder-name ${hasFolderNote ? 'nn-has-folder-note' : ''}`}
                    style={customColor ? { color: customColor, fontWeight: 600 } : undefined}
                    onClick={(e) => {
                        if (onNameClick) {
                            e.stopPropagation();
                            onNameClick();
                        }
                    }}
                >{folder.path === '/' || folder.path === '' ? strings.folderTree.rootFolderName : folder.name}</span>
                <span className="nn-folder-spacer" />
                {settings.showFolderFileCount && fileCount > 0 && (
                    <span className="nn-folder-count">{fileCount}</span>
                )}
            </div>
        </div>
    );
});