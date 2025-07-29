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

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { TFile, setTooltip } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { useTagNavigation } from '../hooks/useTagNavigation';
import { strings } from '../i18n';
import { ItemType } from '../types';
import { isImageFile } from '../utils/fileTypeUtils';
import { ObsidianIcon } from './ObsidianIcon';

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
 * Memoized FileItem component.
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
export const FileItem = React.memo(function FileItem({
    file,
    isSelected,
    hasSelectedAbove,
    hasSelectedBelow,
    onClick,
    formattedDates,
    parentFolder
}: FileItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const { getFileDisplayName, getDB } = useFileCache();
    const fileRef = useRef<HTMLDivElement>(null);
    const { navigateToTag } = useTagNavigation();
    const metadataService = useMetadataService();

    // Load preview text from IndexedDB
    const [previewText, setPreviewText] = useState<string>('');

    // Load tags from RAM cache
    const [tags, setTags] = useState<string[]>([]);

    // Load feature image URL
    const [featureImageUrl, setFeatureImageUrl] = useState<string | null>(null);

    // Get display name from context which handles cache and frontmatter
    const displayName = useMemo(() => {
        return getFileDisplayName(file);
    }, [file, getFileDisplayName]);

    // Handle tag click
    const handleTagClick = useCallback(
        (e: React.MouseEvent, tag: string) => {
            e.stopPropagation(); // Prevent file selection

            // Use the shared tag navigation logic
            navigateToTag(tag);
        },
        [navigateToTag]
    );

    // Get tag color
    const getTagColor = useCallback(
        (tag: string): string | undefined => {
            return metadataService.getTagColor(tag);
        },
        [metadataService]
    );

    // Get display date from pre-computed dates
    const displayDate = formattedDates?.display || '';

    // Detect slim mode when all display options are disabled
    const isSlimMode = !settings.showFileDate && !settings.showFilePreview && !settings.showFeatureImage;

    // Determine if we should show the feature image area (either with an image or extension badge)
    const shouldShowFeatureImageArea =
        settings.showFeatureImage &&
        (featureImageUrl || // Has an actual image
            (file.extension !== 'md' && !isImageFile(file))); // Non-markdown, non-image files show extension badge

    const className = `nn-file-item ${isSelected ? 'nn-selected' : ''} ${isSlimMode ? 'nn-slim' : ''} ${isSelected && hasSelectedAbove ? 'nn-has-selected-above' : ''} ${isSelected && hasSelectedBelow ? 'nn-has-selected-below' : ''}`;

    // Single subscription for all content changes
    useEffect(() => {
        const db = getDB();

        // Initial load of all data
        if (settings.showFilePreview && file.extension === 'md') {
            setPreviewText(db.getDisplayPreviewText(file.path));
        } else {
            setPreviewText('');
        }

        if (settings.showFeatureImage) {
            if (isImageFile(file)) {
                try {
                    setFeatureImageUrl(app.vault.getResourcePath(file));
                } catch {
                    setFeatureImageUrl(null);
                }
            } else {
                const imageUrl = db.getDisplayFeatureImageUrl(file.path);
                setFeatureImageUrl(imageUrl || null);
            }
        } else {
            setFeatureImageUrl(null);
        }

        const initialTags = db.getDisplayTags(file.path);
        setTags(initialTags);

        // Subscribe to changes for this specific file
        const unsubscribe = db.onFileContentChange(file.path, changes => {
            if (changes.preview !== undefined && settings.showFilePreview && file.extension === 'md') {
                setPreviewText(changes.preview || '');
            }
            if (changes.featureImage !== undefined && settings.showFeatureImage && !isImageFile(file)) {
                setFeatureImageUrl(changes.featureImage || null);
            }
            if (changes.tags !== undefined) {
                setTags(changes.tags || []);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [file.path, settings.showFilePreview, settings.showFeatureImage, getDB, app, file.extension]);

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

    // Enable context menu
    useContextMenu(fileRef, { type: ItemType.FILE, item: file });

    return (
        <div
            ref={fileRef}
            className={className}
            data-path={file.path}
            data-drag-path={file.path}
            data-drag-type="file"
            data-draggable={!isMobile ? 'true' : undefined}
            onClick={e => onClick(e)}
            draggable={!isMobile}
            role="listitem"
        >
            <div className="nn-file-content">
                {isSlimMode ? (
                    // Slim mode: Only show file name with minimal styling
                    <div className="nn-file-name" style={{ '--filename-rows': settings.fileNameRows } as React.CSSProperties}>
                        {displayName}
                    </div>
                ) : (
                    // Normal mode: Show all enabled elements
                    <>
                        <div className="nn-file-text-content">
                            <div className="nn-file-name" style={{ '--filename-rows': settings.fileNameRows } as React.CSSProperties}>
                                {displayName}
                            </div>

                            {/* Single row mode (preview rows = 1) - show all elements */}
                            {settings.previewRows < 2 && (
                                <>
                                    {/* Date + Preview on same line */}
                                    <div className="nn-file-second-line">
                                        {settings.showFileDate && <div className="nn-file-date">{displayDate}</div>}
                                        {settings.showFilePreview && (
                                            <div className="nn-file-preview" style={{ '--preview-rows': 1 } as React.CSSProperties}>
                                                {previewText}
                                            </div>
                                        )}
                                    </div>

                                    {/* Tags */}
                                    {settings.showTags && settings.showFileTags && tags.length > 0 && (
                                        <div className="nn-file-tags">
                                            {tags.map((tag, index) => {
                                                const tagColor = getTagColor(tag);
                                                return (
                                                    <span
                                                        key={index}
                                                        className="nn-file-tag nn-clickable-tag"
                                                        onClick={e => handleTagClick(e, tag)}
                                                        role="button"
                                                        tabIndex={0}
                                                        style={tagColor ? { backgroundColor: tagColor } : undefined}
                                                    >
                                                        #{tag}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Parent folder */}
                                    {settings.showNotesFromSubfolders &&
                                        settings.showParentFolderNames &&
                                        parentFolder &&
                                        file.parent &&
                                        file.parent.path !== parentFolder && (
                                            <div className="nn-file-folder">
                                                <ObsidianIcon name="folder-closed" className="nn-file-folder-icon" />
                                                <span>{file.parent.name}</span>
                                            </div>
                                        )}
                                </>
                            )}

                            {/* Multi-row mode (preview rows >= 2) - different layouts based on preview content */}
                            {settings.previewRows >= 2 && (
                                <>
                                    {/* Case 1: Empty preview text - show tags, then date + parent folder */}
                                    {!previewText && (
                                        <>
                                            {/* Tags (show even when no preview text) */}
                                            {settings.showTags && settings.showFileTags && tags.length > 0 && (
                                                <div className="nn-file-tags">
                                                    {tags.map((tag, index) => {
                                                        const tagColor = getTagColor(tag);
                                                        return (
                                                            <span
                                                                key={index}
                                                                className="nn-file-tag nn-clickable-tag"
                                                                onClick={e => handleTagClick(e, tag)}
                                                                role="button"
                                                                tabIndex={0}
                                                                style={tagColor ? { backgroundColor: tagColor } : undefined}
                                                            >
                                                                #{tag}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {/* Date + Parent folder on same line */}
                                            <div className="nn-file-second-line">
                                                {settings.showFileDate && <div className="nn-file-date">{displayDate}</div>}
                                                {settings.showNotesFromSubfolders &&
                                                    settings.showParentFolderNames &&
                                                    parentFolder &&
                                                    file.parent &&
                                                    file.parent.path !== parentFolder && (
                                                        <div className="nn-file-folder">
                                                            <ObsidianIcon name="folder-closed" className="nn-file-folder-icon" />
                                                            <span>{file.parent.name}</span>
                                                        </div>
                                                    )}
                                            </div>
                                        </>
                                    )}

                                    {/* Case 2: Has preview text - show preview, tags, then date + parent folder */}
                                    {previewText && (
                                        <>
                                            {/* Multi-row preview - show preview text spanning multiple rows */}
                                            {settings.showFilePreview && (
                                                <div
                                                    className="nn-file-preview"
                                                    style={{ '--preview-rows': settings.previewRows } as React.CSSProperties}
                                                >
                                                    {previewText}
                                                </div>
                                            )}

                                            {/* Tags (only when preview text exists) */}
                                            {settings.showTags && settings.showFileTags && tags.length > 0 && (
                                                <div className="nn-file-tags">
                                                    {tags.map((tag, index) => {
                                                        const tagColor = getTagColor(tag);
                                                        return (
                                                            <span
                                                                key={index}
                                                                className="nn-file-tag nn-clickable-tag"
                                                                onClick={e => handleTagClick(e, tag)}
                                                                role="button"
                                                                tabIndex={0}
                                                                style={tagColor ? { backgroundColor: tagColor } : undefined}
                                                            >
                                                                #{tag}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Date + Parent folder on same line */}
                                            <div className="nn-file-second-line">
                                                {settings.showFileDate && <div className="nn-file-date">{displayDate}</div>}
                                                {settings.showNotesFromSubfolders &&
                                                    settings.showParentFolderNames &&
                                                    parentFolder &&
                                                    file.parent &&
                                                    file.parent.path !== parentFolder && (
                                                        <div className="nn-file-folder">
                                                            <ObsidianIcon name="folder-closed" className="nn-file-folder-icon" />
                                                            <span>{file.parent.name}</span>
                                                        </div>
                                                    )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                        {shouldShowFeatureImageArea && (
                            <div className="nn-feature-image">
                                {featureImageUrl ? (
                                    <img
                                        src={featureImageUrl}
                                        alt={strings.common.featureImageAlt}
                                        className="nn-feature-image-img"
                                        onError={e => {
                                            const img = e.target as HTMLImageElement;
                                            const featureImageDiv = img.closest('.nn-feature-image');
                                            if (featureImageDiv) {
                                                (featureImageDiv as HTMLElement).style.display = 'none';
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="nn-file-extension-badge">
                                        <span className="nn-file-extension-text">{file.extension}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
});
