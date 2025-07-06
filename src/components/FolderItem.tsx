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
import { TFolder, setTooltip } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { setIcon } from 'obsidian';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { useContextMenu } from '../hooks/useContextMenu';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { getFolderNote } from '../utils/fileFinder';
import { strings } from '../i18n';
import { isSupportedFileExtension, ItemType } from '../types';
import { shouldDisplayFile } from '../utils/fileTypeUtils';

interface FolderItemProps {
    folder: TFolder;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
    onNameClick?: () => void;
    icon?: string;
    isVirtual?: boolean;
    hasChildren?: boolean;
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
export const FolderItem = React.memo(function FolderItem({ folder, level, isExpanded, isSelected, onToggle, onClick, onNameClick, icon, isVirtual = false, hasChildren: hasChildrenProp }: FolderItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const folderRef = useRef<HTMLDivElement>(null);
    
    // Enable context menu (only for non-virtual folders)
    useContextMenu(folderRef, isVirtual ? null : { type: ItemType.FOLDER, item: folder });
    
    // Count folders and files for tooltip
    const folderStats = React.useMemo(() => {
        let fileCount = 0;
        let folderCount = 0;
        
        // Skip stats for virtual folders
        if (!isVirtual) {
            for (const child of folder.children) {
                if (isTFile(child)) {
                    if (isSupportedFileExtension(child.extension)) {
                        fileCount++;
                    }
                } else if (isTFolder(child)) {
                    folderCount++;
                }
            }
        }
        
        return { fileCount, folderCount };
    }, [folder.path, folder.children?.length, isVirtual]);
    
    // Add Obsidian tooltip
    useEffect(() => {
        if (!folderRef.current) return;
        
        // Remove tooltip if disabled
        if (!settings.showTooltips) {
            setTooltip(folderRef.current, '');
            return;
        }
        
        // Build tooltip with proper singular/plural forms
        const fileText = folderStats.fileCount === 1 
            ? `${folderStats.fileCount} ${strings.tooltips.file}`
            : `${folderStats.fileCount} ${strings.tooltips.files}`;
        const folderText = folderStats.folderCount === 1
            ? `${folderStats.folderCount} ${strings.tooltips.folder}`
            : `${folderStats.folderCount} ${strings.tooltips.folders}`;
        const statsTooltip = `${fileText}, ${folderText}`;
        
        // Always include folder name at the top
        const tooltip = `${folder.name}\n\n${statsTooltip}`;
        
        // Check if RTL mode is active
        const isRTL = document.body.classList.contains('mod-rtl');
        
        // Set placement to the right (left in RTL)
        setTooltip(folderRef.current, tooltip, { 
            placement: isRTL ? 'left' : 'right'
        });
    }, [folderStats.fileCount, folderStats.folderCount, folder.name, settings]);
    
    // Count files in folder (including subfolders if setting enabled)
    const fileCount = React.useMemo(() => {
        if (!settings.showNoteCount || isVirtual) return 0;
        
        // Parse excluded properties
        const excludedProperties = parseExcludedProperties(settings.excludedFiles);
        
        const countFiles = (folder: TFolder): number => {
            let count = 0;
            for (const child of folder.children) {
                if (isTFile(child)) {
                    if (shouldDisplayFile(child, settings.fileVisibility, app)) {
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
    }, [folder.path, folder.children?.length, settings.showNoteCount, settings.showNotesFromSubfolders, settings.excludedFiles, settings.fileVisibility, app, isVirtual]);

    const hasChildren = hasChildrenProp !== undefined ? hasChildrenProp : (folder.children && folder.children.some(isTFolder));
    
    const handleDoubleClick = () => {
        if (hasChildren) {
            onToggle();
        }
    };
    
    const chevronRef = React.useRef<HTMLDivElement>(null);
    const iconRef = React.useRef<HTMLSpanElement>(null);
    const customColor = settings.folderColors?.[folder.path];
    
    // Check if folder has a folder note (skip for virtual folders)
    const folderNote = settings.enableFolderNotes && !isVirtual ? getFolderNote(folder, settings, app) : null;
    const hasFolderNote = folderNote !== null;

    useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded]);

    // Add this useEffect for the folder icon
    useEffect(() => {
        if (iconRef.current && settings.showIcons) {
            if (icon) {
                // Custom icon is set - always show it, never toggle
                setIcon(iconRef.current, icon);
            } else {
                // Default icon - show open folder only if has children AND is expanded
                const iconName = (hasChildren && isExpanded) ? 'folder-open' : 'folder-closed';
                setIcon(iconRef.current, iconName);
            }
        }
    }, [isExpanded, icon, hasChildren, settings.showIcons]);

    return (
        <div 
            ref={folderRef}
            className={`nn-folder-item ${isSelected ? 'nn-selected' : ''}`}
            data-path={folder.path}
            data-drag-path={!isVirtual ? folder.path : undefined}
            data-drag-type={!isVirtual ? "folder" : undefined}
            data-draggable={!isMobile && !isVirtual ? "true" : undefined}
            draggable={!isMobile && !isVirtual}
            style={{ paddingInlineStart: `${level * 20}px` }}
        >
            <div 
                className="nn-folder-content"
                onClick={onClick}
                onDoubleClick={handleDoubleClick}
                data-drop-zone={!isVirtual ? "folder" : undefined}
                data-drop-path={!isVirtual ? folder.path : undefined}
                data-clickable={!isVirtual ? "folder" : undefined}
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
                />
                {settings.showIcons && (
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
                >{folder.path === '/' ? strings.folderTree.rootFolderName : folder.name}</span>
                <span className="nn-folder-spacer" />
                {settings.showNoteCount && fileCount > 0 && (
                    <span className="nn-folder-count">{fileCount}</span>
                )}
            </div>
        </div>
    );
});