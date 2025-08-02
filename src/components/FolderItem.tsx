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

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { TFolder, TFile, setTooltip, setIcon } from 'obsidian';
import { useServices, useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { strings } from '../i18n';
import { getIconService } from '../services/icons';
import { isSupportedFileExtension, ItemType } from '../types';
import { getFolderNote } from '../utils/fileFinder';

interface FolderItemProps {
    folder: TFolder;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
    onNameClick?: () => void;
    onToggleAllSiblings?: () => void;
    icon?: string;
    fileCount?: number;
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
export const FolderItem = React.memo(function FolderItem({
    folder,
    level,
    isExpanded,
    isSelected,
    onToggle,
    onClick,
    onNameClick,
    onToggleAllSiblings,
    icon,
    fileCount: precomputedFileCount
}: FolderItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const metadataService = useMetadataService();
    const folderRef = useRef<HTMLDivElement>(null);

    const chevronRef = React.useRef<HTMLDivElement>(null);
    const iconRef = React.useRef<HTMLSpanElement>(null);

    // Count folders and files for tooltip (skip on mobile to save computation)
    const folderStats = React.useMemo(() => {
        // Skip computation on mobile since tooltips aren't shown
        if (isMobile || !settings.showTooltips) {
            return { fileCount: 0, folderCount: 0 };
        }

        let fileCount = 0;
        let folderCount = 0;

        for (const child of folder.children) {
            if (child instanceof TFile) {
                if (isSupportedFileExtension(child.extension)) {
                    fileCount++;
                }
            } else if (child instanceof TFolder) {
                folderCount++;
            }
        }

        return { fileCount, folderCount };
    }, [folder.children, isMobile, settings.showTooltips]);

    // Use precomputed file count from parent component
    // NavigationPane pre-computes all folder counts for performance
    const fileCount = precomputedFileCount ?? 0;

    // Memoize computed values
    const hasChildren = useMemo(() => folder.children && folder.children.some(child => child instanceof TFolder), [folder.children]);

    const customColor = useMemo(() => metadataService.getFolderColor(folder.path), [metadataService, folder.path]);

    const hasFolderNote = useMemo(() => {
        if (!settings.enableFolderNotes) return false;
        const folderNote = getFolderNote(folder, settings, app);
        return folderNote !== null;
    }, [folder, settings, app]);

    // Memoize className to avoid string concatenation on every render
    const className = useMemo(() => {
        const classes = ['nn-folder-item'];
        if (isSelected) classes.push('nn-selected');
        return classes.join(' ');
    }, [isSelected]);

    const folderNameClassName = useMemo(() => {
        const classes = ['nn-folder-name'];
        if (hasFolderNote) classes.push('nn-has-folder-note');
        if (customColor) classes.push('nn-has-custom-color');
        return classes.join(' ');
    }, [hasFolderNote, customColor]);

    // Stable event handlers
    const handleDoubleClick = useCallback(() => {
        if (hasChildren) {
            onToggle();
        }
    }, [hasChildren, onToggle]);

    const handleChevronClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) {
                if (e.altKey && onToggleAllSiblings) {
                    onToggleAllSiblings();
                } else {
                    onToggle();
                }
            }
        },
        [hasChildren, onToggle, onToggleAllSiblings]
    );

    const handleChevronDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

    const handleNameClick = useCallback(
        (e: React.MouseEvent) => {
            if (onNameClick) {
                e.stopPropagation();
                onNameClick();
            }
        },
        [onNameClick]
    );

    // Add Obsidian tooltip
    useEffect(() => {
        if (!folderRef.current) return;

        // Skip tooltip creation on mobile
        if (isMobile) return;

        // Remove tooltip if disabled
        if (!settings.showTooltips) {
            setTooltip(folderRef.current, '');
            return;
        }

        // Build tooltip with proper singular/plural forms
        const fileText =
            folderStats.fileCount === 1
                ? `${folderStats.fileCount} ${strings.tooltips.file}`
                : `${folderStats.fileCount} ${strings.tooltips.files}`;
        const folderText =
            folderStats.folderCount === 1
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
    }, [folderStats.fileCount, folderStats.folderCount, folder.name, settings, isMobile]);

    useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded]);

    // Add this useEffect for the folder icon
    useEffect(() => {
        if (iconRef.current && settings.showIcons) {
            const iconService = getIconService();

            if (icon) {
                // Custom icon is set - always show it, never toggle
                iconService.renderIcon(iconRef.current, icon);
            } else {
                // Default icon - show open folder only if has children AND is expanded
                const iconName = hasChildren && isExpanded ? 'folder-open' : 'folder-closed';
                iconService.renderIcon(iconRef.current, iconName);
            }
        }
    }, [isExpanded, icon, hasChildren, settings.showIcons]);

    // Enable context menu
    useContextMenu(folderRef, { type: ItemType.FOLDER, item: folder });

    return (
        <div
            ref={folderRef}
            className={className}
            data-path={folder.path}
            data-drag-path={folder.path}
            data-drag-type="folder"
            data-draggable={!isMobile ? 'true' : undefined}
            draggable={!isMobile}
            data-drop-zone="folder"
            data-drop-path={folder.path}
            data-clickable="folder"
            onClick={onClick}
            onDoubleClick={handleDoubleClick}
            style={{ paddingInlineStart: `${level * 20}px` }}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-level={level + 1}
        >
            <div className="nn-folder-content">
                <div
                    className={`nn-folder-chevron ${hasChildren ? 'nn-folder-chevron--has-children' : 'nn-folder-chevron--no-children'}`}
                    ref={chevronRef}
                    onClick={handleChevronClick}
                    onDoubleClick={handleChevronDoubleClick}
                    tabIndex={-1}
                />
                {settings.showIcons && (
                    <span className="nn-folder-icon" ref={iconRef} style={customColor ? { color: customColor } : undefined}></span>
                )}
                <span className={folderNameClassName} style={customColor ? { color: customColor } : undefined} onClick={handleNameClick}>
                    {folder.path === '/' ? settings.customVaultName || app.vault.getName() : folder.name}
                </span>
                <span className="nn-folder-spacer" />
                {settings.showNoteCount && fileCount > 0 && <span className="nn-folder-count">{fileCount}</span>}
            </div>
        </div>
    );
});
