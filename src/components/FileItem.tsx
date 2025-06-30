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

import React, { useRef, useMemo, memo, useEffect } from 'react';
import { TFile, setTooltip } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { DateUtils } from '../utils/DateUtils';
import { getDateField, getEffectiveSortOption } from '../utils/sortUtils';
import { useContextMenu } from '../hooks/useContextMenu';
import { useFilePreview } from '../hooks/useFilePreview';
import { getFileDisplayName } from '../utils/fileNameUtils';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useSelectionState } from '../context/SelectionContext';
import { ItemType } from '../types';

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    hasSelectedAbove?: boolean;
    hasSelectedBelow?: boolean;
    onClick: (e: React.MouseEvent) => void;
    dateGroup?: string | null;
    formattedDate?: string;
    parentFolder?: string | null;
}

/**
 * Internal FileItem implementation without memoization.
 * Renders an individual file item in the file list with preview text and metadata.
 * Displays the file name, date, preview text, and optional feature image.
 * Handles selection state, context menus, and drag-and-drop functionality.
 * 
 * @param props - The component props
 * @param props.file - The Obsidian TFile to display
 * @param props.isSelected - Whether this file is currently selected
 * @param props.onClick - Handler called when the file is clicked
 * @returns A file item element with name, date, preview and optional image
 */
function FileItemInternal({ file, isSelected, hasSelectedAbove, hasSelectedBelow, onClick, dateGroup, formattedDate, parentFolder }: FileItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const { selectedFolder, selectionType } = useSelectionState();
    const fileRef = useRef<HTMLDivElement>(null);
    
    // Get file metadata for preview
    const metadata = app.metadataCache.getFileCache(file);
    
    // Get display name
    const displayName = useMemo(() => 
        getFileDisplayName(file, settings, app.metadataCache),
        [file, settings, app.metadataCache]
    );
    
    // Use the custom hook for preview text
    const previewText = useFilePreview({ file, metadata, settings, app });
    
    // Enable context menu
    useContextMenu(fileRef, { type: ItemType.FILE, item: file });
    
    // Add Obsidian tooltip
    useEffect(() => {
        if (!fileRef.current) return;
        
        // Remove tooltip if disabled
        if (!settings.showTooltips) {
            setTooltip(fileRef.current, '');
            return;
        }
        
        const dateTimeFormat = settings.timeFormat ? `${settings.dateFormat} ${settings.timeFormat}` : settings.dateFormat;
        const createdDate = DateUtils.formatDate(file.stat.ctime, dateTimeFormat);
        const modifiedDate = DateUtils.formatDate(file.stat.mtime, dateTimeFormat);
        // Get effective sort option to determine date order
        const effectiveSort = getEffectiveSortOption(settings, selectionType, selectedFolder);
        const isCreatedSort = effectiveSort.startsWith('created-');
        
        // Build tooltip with filename and dates
        const datesTooltip = isCreatedSort
            ? `${strings.tooltips.createdAt} ${createdDate}\n${strings.tooltips.lastModifiedAt} ${modifiedDate}`
            : `${strings.tooltips.lastModifiedAt} ${modifiedDate}\n${strings.tooltips.createdAt} ${createdDate}`;
        
        // Always include filename at the top
        const tooltip = `${displayName}\n\n${datesTooltip}`;
        
        // Check if RTL mode is active
        const isRTL = document.body.classList.contains('mod-rtl');
        
        // Set placement to the right (left in RTL)
        setTooltip(fileRef.current, tooltip, { 
            placement: isRTL ? 'left' : 'right'
        } as any);
    }, [file.stat.ctime, file.stat.mtime, settings, selectionType, selectedFolder, displayName]);

    // Use pre-formatted date if provided, otherwise format it ourselves
    const displayDate = useMemo(() => {
        if (formattedDate !== undefined) return formattedDate;
        if (!settings.showDate) return '';
        
        const dateField = getDateField(settings.defaultFolderSort);
        const dateToShow = file.stat[dateField];
        return dateGroup 
            ? DateUtils.formatDateForGroup(dateToShow, dateGroup, settings.dateFormat, settings.timeFormat)
            : DateUtils.formatDate(dateToShow, settings.dateFormat);
    }, [formattedDate, settings.showDate, settings.defaultFolderSort, 
        settings.dateFormat, settings.timeFormat, file.stat.mtime, file.stat.ctime, dateGroup]);

    // Calculate feature image URL if enabled
    const featureImageUrl = useMemo(() => {
        if (!settings.showFeatureImage) {
            return null;
        }

        const imagePath = metadata?.frontmatter?.[settings.featureImageProperty];

        if (!imagePath) {
            return null;
        }

        // Handle wikilinks e.g., [[image.png]]
        const resolvedPath = imagePath.startsWith('[[') && imagePath.endsWith(']]')
            ? imagePath.slice(2, -2)
            : imagePath;

        const imageFile = app.metadataCache.getFirstLinkpathDest(resolvedPath, file.path);
        if (imageFile) {
            try {
                return app.vault.getResourcePath(imageFile);
            } catch (e) {
                // Vault might not be ready, return null
                return null;
            }
        }

        return null;
    }, [file.path, file.stat.mtime, metadata, settings.showFeatureImage, settings.featureImageProperty, app.metadataCache, app.vault]);
    
    // Detect slim mode when all display options are disabled
    const isSlimMode = !settings.showDate && 
                       !settings.showFilePreview && 
                       !settings.showFeatureImage;
    
    const className = `nn-file-item ${isSelected ? 'nn-selected' : ''} ${isSlimMode ? 'nn-slim' : ''} ${isSelected && hasSelectedAbove ? 'nn-has-selected-above' : ''} ${isSelected && hasSelectedBelow ? 'nn-has-selected-below' : ''}`;

    return (
        <div 
            ref={fileRef} 
            className={className} 
            data-path={file.path} 
            data-drag-path={file.path}
            data-drag-type="file"
            data-draggable={!isMobile ? "true" : undefined}
            onClick={(e) => onClick(e)} 
            draggable={!isMobile}
        >
            <div className="nn-file-content">
                {isSlimMode ? (
                    // Slim mode: Only show file name with minimal styling
                    <div 
                        className="nn-file-name"
                        style={{ '--filename-rows': settings.fileNameRows } as React.CSSProperties}
                    >{displayName}</div>
                ) : (
                    // Normal mode: Show all enabled elements
                    <>
                        <div className="nn-file-text-content">
                            <div 
                                className="nn-file-name"
                                style={{ '--filename-rows': settings.fileNameRows } as React.CSSProperties}
                            >{displayName}</div>
                            {/* Show preview and date on same line when preview is 1 row */}
                            {settings.previewRows < 2 && (settings.showDate || settings.showFilePreview) && (
                                <div className="nn-file-second-line">
                                    {settings.showDate && (
                                        <div className="nn-file-date">{displayDate}</div>
                                    )}
                                    {settings.showFilePreview && (
                                        <div 
                                            className="nn-file-preview" 
                                            style={{ '--preview-rows': settings.previewRows } as React.CSSProperties}
                                        >{previewText}</div>
                                    )}
                                </div>
                            )}
                            {/* Show preview vertically when 2+ rows */}
                            {settings.previewRows >= 2 && settings.showFilePreview && (
                                <div 
                                    className="nn-file-preview" 
                                    style={{ '--preview-rows': settings.previewRows } as React.CSSProperties}
                                >{previewText}</div>
                            )}
                            {/* Show date below preview when 2+ rows */}
                            {settings.previewRows >= 2 && settings.showDate && (
                                <div className="nn-file-date nn-file-date-below">{displayDate}</div>
                            )}
                            {/* Show folder indicator */}
                            {settings.showNotesFromSubfolders && settings.showSubfolderNamesInList && parentFolder && file.parent && file.parent.path !== parentFolder && (
                                <div className="nn-file-folder">
                                    <ObsidianIcon name="folder-closed" className="nn-file-folder-icon" />
                                    <span>{file.parent.name}</span>
                                </div>
                            )}
                        </div>
                        {settings.showFeatureImage && featureImageUrl && (
                            <div className="nn-feature-image">
                                <img src={featureImageUrl} alt={strings.common.featureImageAlt} className="nn-feature-image-img" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Memoized FileItem component that only re-renders when necessary.
 * This optimization is critical for performance with large file lists.
 * 
 * The component will only re-render when:
 * - The file path changes (different file)
 * - The file is modified (mtime changes)
 * - The selection state changes 
 * - The date group changes
 * - The onClick handler changes (should be stable from parent)
 * - Settings version changes (forces re-render for settings updates)
 */
export const FileItem = memo(FileItemInternal, (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    // Return false if props changed (do re-render)
    const isEqual = (
        prevProps.file.path === nextProps.file.path &&
        prevProps.file.name === nextProps.file.name &&
        prevProps.file.stat.mtime === nextProps.file.stat.mtime &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.hasSelectedAbove === nextProps.hasSelectedAbove &&
        prevProps.hasSelectedBelow === nextProps.hasSelectedBelow &&
        prevProps.dateGroup === nextProps.dateGroup &&
        prevProps.onClick === nextProps.onClick &&
        prevProps.formattedDate === nextProps.formattedDate &&
        prevProps.parentFolder === nextProps.parentFolder
    );
    
    return isEqual;
});