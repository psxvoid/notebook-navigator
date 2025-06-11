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

import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { TFile } from 'obsidian';
import { useStableAppContext } from '../context/AppContext';
import { DateUtils } from '../utils/DateUtils';
import { PreviewTextUtils } from '../utils/PreviewTextUtils';
import { getDateField } from '../utils/sortUtils';
import { useContextMenu } from '../hooks/useContextMenu';
import { useScrollIntoView } from '../hooks/useScrollIntoView';
import { strings } from '../i18n';

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    onClick: () => void;
    dateGroup?: string | null;
    settingsVersion?: number;
    formattedDate?: string;
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
function FileItemInternal({ file, isSelected, onClick, dateGroup, formattedDate }: FileItemProps) {
    const { app, plugin, isMobile } = useStableAppContext();
    const [previewText, setPreviewText] = useState('');
    const fileRef = useRef<HTMLDivElement>(null);
    
    // Enable context menu
    useContextMenu(fileRef, { type: 'file', item: file });
    
    // Auto-scroll to selected file when needed
    useScrollIntoView(fileRef, '.nn-file-list', isSelected, [file.path]);

    // Use pre-formatted date if provided, otherwise format it ourselves
    const displayDate = useMemo(() => {
        if (formattedDate !== undefined) return formattedDate;
        if (!plugin.settings.showDate) return '';
        
        const dateField = getDateField(plugin.settings.defaultFolderSort);
        const dateToShow = file.stat[dateField];
        return dateGroup 
            ? DateUtils.formatDateForGroup(dateToShow, dateGroup, plugin.settings.dateFormat, plugin.settings.timeFormat)
            : DateUtils.formatDate(dateToShow, plugin.settings.dateFormat);
    }, [formattedDate, plugin.settings.showDate, plugin.settings.defaultFolderSort, 
        plugin.settings.dateFormat, plugin.settings.timeFormat, file.stat.mtime, file.stat.ctime, dateGroup]);

    // Calculate feature image URL if enabled
    const featureImageUrl = useMemo(() => {
        if (!plugin.settings.showFeatureImage) {
            return null;
        }

        const metadata = app.metadataCache.getFileCache(file);
        const imagePath = metadata?.frontmatter?.[plugin.settings.featureImageProperty];

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
    }, [file.path, file.stat.mtime, plugin.settings.showFeatureImage, plugin.settings.featureImageProperty, app.metadataCache, app.vault]);

    // Load preview text
    useEffect(() => {
        // Only load preview text if the setting is enabled
        if (!plugin.settings.showFilePreview) {
            setPreviewText('');
            return;
        }
        
        let isCancelled = false;
        
        // For non-markdown files, set extension immediately
        if (file.extension !== 'md') {
            setPreviewText(file.extension.toUpperCase());
            return;
        }
        
        // Load markdown preview text from file content
        app.vault.cachedRead(file)
            .then(content => {
                if (!isCancelled) {
                    setPreviewText(PreviewTextUtils.extractPreviewText(content, plugin.settings));
                }
            })
            .catch(error => {
                if (!isCancelled) {
                    console.error('Failed to read file preview:', error);
                    setPreviewText(''); // Clear preview on error
                }
            });
        
        // Cleanup function
        return () => { 
            isCancelled = true;
        };
    }, [file.path, file.stat.mtime, app.vault, plugin.settings.showFilePreview, plugin.settings.skipHeadingsInPreview, plugin.settings.skipNonTextInPreview]); // Include mtime to detect file changes
    
    const className = `nn-file-item ${isSelected ? 'nn-selected' : ''}`;

    return (
        <div 
            ref={fileRef} 
            className={className} 
            data-path={file.path} 
            data-drag-path={file.path}
            data-drag-type="file"
            data-draggable={!isMobile ? "true" : undefined}
            onClick={onClick} 
            draggable={!isMobile}
        >
            <div className="nn-file-content">
                <div className="nn-file-text-content">
                    <div className="nn-file-name">{file.basename}</div>
                    <div className="nn-file-second-line">
                        {plugin.settings.showDate && (
                            <div className="nn-file-date">{displayDate}</div>
                        )}
                        {plugin.settings.showFilePreview && (
                            <div 
                                className="nn-file-preview" 
                                style={{ '--preview-rows': plugin.settings.previewRows } as React.CSSProperties}
                            >{previewText}</div>
                        )}
                    </div>
                </div>
                {featureImageUrl && (
                    <div className="nn-feature-image">
                        <img src={featureImageUrl} alt={strings.common.featureImageAlt} className="nn-feature-image-img" />
                    </div>
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
    return (
        prevProps.file.path === nextProps.file.path &&
        prevProps.file.stat.mtime === nextProps.file.stat.mtime &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.dateGroup === nextProps.dateGroup &&
        prevProps.onClick === nextProps.onClick &&
        prevProps.settingsVersion === nextProps.settingsVersion &&
        prevProps.formattedDate === nextProps.formattedDate
    );
});