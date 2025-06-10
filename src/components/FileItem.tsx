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

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { TFile } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { DateUtils } from '../utils/DateUtils';
import { PreviewTextUtils } from '../utils/PreviewTextUtils';
import { useContextMenu } from '../hooks/useContextMenu';
import { useScrollIntoView } from '../hooks/useScrollIntoView';

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    onClick: () => void;
}

/**
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
export function FileItem({ file, isSelected, onClick }: FileItemProps) {
    const { app, plugin, refreshCounter, isMobile } = useAppContext();
    const [previewText, setPreviewText] = useState('...');
    const fileRef = useRef<HTMLDivElement>(null);
    
    // Enable context menu
    useContextMenu(fileRef, { type: 'file', item: file });
    
    // Auto-scroll to selected file when needed
    useScrollIntoView(fileRef, '.nn-file-list', isSelected, [file.path]);

    // Show date based on sort option - created date when sorted by created, modified date otherwise
    const dateToShow = plugin.settings.sortOption === 'created' ? file.stat.ctime : file.stat.mtime;
    const formattedDate = DateUtils.formatDate(dateToShow, plugin.settings.dateFormat);

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
            return app.vault.getResourcePath(imageFile);
        }

        return null;
    }, [file.path, plugin.settings.showFeatureImage, plugin.settings.featureImageProperty, refreshCounter]);

    // useEffect is how you perform side effects, like reading file content.
    useEffect(() => {
        // Only load preview text if the setting is enabled
        if (!plugin.settings.showFilePreview) {
            setPreviewText('');
            return;
        }
        
        let isCancelled = false;
        if (file.extension === 'md') {
            app.vault.cachedRead(file).then(content => {
                if (!isCancelled) {
                    setPreviewText(PreviewTextUtils.extractPreviewText(content, plugin.settings));
                }
            });
        } else {
            setPreviewText(file.extension.toUpperCase());
        }
        // This cleanup function prevents state updates on unmounted components
        return () => { isCancelled = true; };
    }, [file.path, app.vault, plugin.settings.showFilePreview, plugin.settings.skipHeadingsInPreview, plugin.settings.skipNonTextInPreview, refreshCounter]); // Rerun effect if file path, preview settings, or content changes
    
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
                            <div className="nn-file-date">{formattedDate}</div>
                        )}
                        {plugin.settings.showFilePreview && (
                            <div className="nn-file-preview">{previewText}</div>
                        )}
                    </div>
                </div>
                {featureImageUrl && (
                    <div className="nn-feature-image">
                        <img src={featureImageUrl} alt="Feature image" className="nn-feature-image-img" />
                    </div>
                )}
            </div>
        </div>
    );
}