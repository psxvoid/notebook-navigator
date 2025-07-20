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
import { useContextMenu } from '../hooks/useContextMenu';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useFileCache } from '../context/FileCacheContext';
import { getCachedFileData } from '../utils/cacheUtils';
import { isImageFile } from '../utils/fileTypeUtils';
import { ItemType } from '../types';

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    hasSelectedAbove?: boolean;
    hasSelectedBelow?: boolean;
    onClick: (e: React.MouseEvent) => void;
    dateGroup?: string | null;
    formattedDates?: {
        display: string;
        created: string;
        modified: string;
    };
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

function FileItemInternal({ file, isSelected, hasSelectedAbove, hasSelectedBelow, onClick, formattedDates, parentFolder }: FileItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const { getFileDisplayName, cache } = useFileCache();
    const fileRef = useRef<HTMLDivElement>(null);
    
    // Get cached data for preview and image
    const cachedData = useMemo(() => {
        return cache ? getCachedFileData(cache, file.path) : null;
    }, [cache, file.path]);
    
    // Get display name from context which handles cache and frontmatter
    const displayName = useMemo(() => {
        return getFileDisplayName(file);
    }, [file, getFileDisplayName]);
    
    // Get preview text from cache
    const previewText = useMemo(() => {
        if (!settings.showFilePreview || !cachedData) {
            return '';
        }
        
        return cachedData.p || '';
    }, [settings.showFilePreview, cachedData?.p]);
    
    // Get display date from pre-computed dates
    const displayDate = formattedDates?.display || '';
    
    // Get feature image URL - either from cache (for markdown) or the file itself (for images)
    const featureImageUrl = useMemo(() => {
        if (!settings.showFeatureImage) {
            return null;
        }
        
        // If the file itself is an image, use it directly
        if (isImageFile(file)) {
            try {
                return app.vault.getResourcePath(file);
            } catch (e) {
                return null;
            }
        }
        
        // For markdown files, get from cache
        if (cachedData) {
            return cachedData.f || null;
        }
        
        return null;
    }, [settings.showFeatureImage, cachedData?.f, file, app]);
    
    // Enable context menu
    useContextMenu(fileRef, { type: ItemType.FILE, item: file });
    
    // Add Obsidian tooltip (desktop only)
    useEffect(() => {
        if (!fileRef.current) return;
        
        // Skip tooltips on mobile
        if (isMobile) return;
        
        // Remove tooltip if disabled
        if (!settings.showTooltips) {
            setTooltip(fileRef.current, '');
            return;
        }
        
        const createdDate = formattedDates?.created || '';
        const modifiedDate = formattedDates?.modified || '';
        // Check current sort to determine date order
        const isCreatedSort = settings.defaultFolderSort.startsWith('created-');
        
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
        });
    }, [isMobile, file.stat.ctime, file.stat.mtime, settings, displayName, formattedDates]);
    
    // Detect slim mode when all display options are disabled
    const isSlimMode = !settings.showDate && 
                       !settings.showFilePreview && 
                       !settings.showFeatureImage;
    
    // Determine if we should show the feature image area (either with an image or extension badge)
    const shouldShowFeatureImageArea = settings.showFeatureImage && (
        featureImageUrl || // Has an actual image
        (file.extension !== 'md' && !isImageFile(file)) // Non-markdown, non-image files show extension badge
    );
    
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
            role="listitem"
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
                            {settings.showNotesFromSubfolders && settings.showParentFolderNames && parentFolder && file.parent && file.parent.path !== parentFolder && (
                                <div className="nn-file-folder">
                                    <ObsidianIcon name="folder-closed" className="nn-file-folder-icon" />
                                    <span>{file.parent.name}</span>
                                </div>
                            )}
                        </div>
                        {shouldShowFeatureImageArea && (
                            <div className="nn-feature-image">
                                {featureImageUrl ? (
                                    <img 
                                        src={featureImageUrl} 
                                        alt={strings.common.featureImageAlt} 
                                        className="nn-feature-image-img"
                                        onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            const featureImageDiv = img.closest('.nn-feature-image');
                                            if (featureImageDiv) {
                                                (featureImageDiv as HTMLElement).style.display = 'none';
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="nn-file-extension-badge">
                                        <span className="nn-file-extension-text">.{file.extension}</span>
                                    </div>
                                )}
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
export const FileItem = memo(FileItemInternal);