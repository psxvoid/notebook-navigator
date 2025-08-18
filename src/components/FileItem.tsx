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

/**
 * OPTIMIZATIONS:
 *
 * 1. React.memo - Component only re-renders when props actually change
 *
 * 2. Memoized values:
 *    - displayName: Cached computation of file display name from frontmatter/filename
 *    - displayDate: Cached date formatting to avoid repeated date calculations
 *    - showExtensionBadge: Cached logic for when to show file extension badges
 *    - className: Cached CSS class string to avoid string concatenation on each render
 *
 * 3. Stable callbacks:
 *    - handleTagClick: Memoized to prevent re-creating function on each render
 *
 * 4. Content subscription optimization:
 *    - Single useEffect subscribes to all content changes (preview, tags, feature image)
 *    - Uses file.path as dependency to properly handle file renames
 *    - All data is fetched from RAM cache (MemoryFileCache) for synchronous access
 *    - RAM cache is kept in sync with IndexedDB by StorageContext
 *
 * 5. Data loading pattern:
 *    - Initial load: Synchronously fetch all data from RAM cache
 *    - Updates: Subscribe to cache changes and update state when data changes
 *    - Background: Content providers asynchronously generate preview text and find feature images
 *
 * 6. Image optimization:
 *    - Feature images use native browser lazy loading
 *    - Resource paths are cached to avoid repeated vault.getResourcePath calls
 */

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { TFile, setTooltip, setIcon } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import type { FileContentChange } from '../storage/IndexedDBStorage';
import { useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useFileCache } from '../context/StorageContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { useTagNavigation } from '../hooks/useTagNavigation';
import { useListPaneAppearance } from '../hooks/useListPaneAppearance';
import { strings } from '../i18n';
import { SortOption } from '../settings';
import { ItemType } from '../types';
import { DateUtils } from '../utils/dateUtils';
import { isImageFile } from '../utils/fileTypeUtils';
import { getDateField } from '../utils/sortUtils';
import { ObsidianIcon } from './ObsidianIcon';

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    hasSelectedAbove?: boolean;
    hasSelectedBelow?: boolean;
    onClick: (e: React.MouseEvent) => void;
    dateGroup?: string | null;
    sortOption?: SortOption;
    parentFolder?: string | null;
    isPinned?: boolean;
    selectionType?: ItemType | null;
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
    dateGroup,
    sortOption,
    parentFolder,
    isPinned = false,
    selectionType
}: FileItemProps) {
    // === Hooks (all hooks together at the top) ===
    const { app, isMobile, plugin } = useServices();
    const settings = useSettingsState();
    const appearanceSettings = useListPaneAppearance();
    const { getFileDisplayName, getDB, getFileCreatedTime, getFileModifiedTime, findTagInFavoriteTree } = useFileCache();
    const { navigateToTag } = useTagNavigation();
    const metadataService = useMetadataService();

    // === Helper functions ===
    // Load all file metadata from cache
    const loadFileData = () => {
        const db = getDB();

        const preview = appearanceSettings.showPreview && file.extension === 'md' ? db.getCachedPreviewText(file.path) : '';

        const tagList = db.getCachedTags(file.path);

        let imageUrl: string | null = null;
        if (appearanceSettings.showImage) {
            if (isImageFile(file)) {
                try {
                    imageUrl = app.vault.getResourcePath(file);
                } catch {
                    imageUrl = null;
                }
            } else {
                const imagePath = db.getCachedFeatureImageUrl(file.path);
                if (imagePath) {
                    const imageFile = app.vault.getFileByPath(imagePath);
                    if (imageFile) {
                        try {
                            imageUrl = app.vault.getResourcePath(imageFile);
                        } catch {
                            imageUrl = null;
                        }
                    }
                }
            }
        }

        return { preview, tagList, imageUrl };
    };

    // === State ===
    const [isHovered, setIsHovered] = React.useState(false);

    // Initialize state with cache data
    const initialData = loadFileData();
    const [previewText, setPreviewText] = useState<string>(initialData.preview);
    const [tags, setTags] = useState<string[]>(initialData.tagList);
    const [featureImageUrl, setFeatureImageUrl] = useState<string | null>(initialData.imageUrl);

    // === Refs ===
    const fileRef = useRef<HTMLDivElement>(null);
    const revealInFolderIconRef = useRef<HTMLDivElement>(null);
    const pinNoteIconRef = useRef<HTMLDivElement>(null);
    const openInNewTabIconRef = useRef<HTMLDivElement>(null);

    // === Derived State & Memoized Values ===

    // Check which quick actions should be shown
    const shouldShowOpenInNewTab = settings.showQuickActions && settings.quickActionOpenInNewTab;
    const shouldShowPinNote = settings.showQuickActions && settings.quickActionPinNote;
    const shouldShowRevealIcon =
        settings.showQuickActions && settings.quickActionRevealInFolder && file.parent && file.parent.path !== parentFolder;
    const hasQuickActions = shouldShowOpenInNewTab || shouldShowPinNote || shouldShowRevealIcon;

    // Get display name from RAM cache (handles frontmatter title)
    const displayName = useMemo(() => {
        return getFileDisplayName(file);
    }, [file, getFileDisplayName]);

    // === Callbacks ===

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

    // Categorize tags by priority: favorites first, then colored, then regular
    const categorizedTags = useMemo(() => {
        if (tags.length === 0) return tags;

        // Categorize tags
        const favoriteTags: string[] = [];
        const coloredTags: string[] = [];
        const regularTags: string[] = [];

        tags.forEach(tag => {
            // Check if it's a favorite tag by looking in the favoriteTree
            const isFavorite = findTagInFavoriteTree(tag) !== null;

            if (isFavorite) {
                favoriteTags.push(tag);
            } else if (getTagColor(tag)) {
                // Check if it has a custom color
                coloredTags.push(tag);
            } else {
                regularTags.push(tag);
            }
        });

        // Combine in priority order without sorting
        return [...favoriteTags, ...coloredTags, ...regularTags];
    }, [tags, findTagInFavoriteTree, getTagColor]);

    // Render tags - extracted to avoid duplication
    const renderTags = useCallback(() => {
        if (!settings.showTags || !settings.showFileTags || categorizedTags.length === 0) {
            return null;
        }

        return (
            <div className="nn-file-tags">
                {categorizedTags.map((tag, index) => {
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
        );
    }, [settings.showTags, settings.showFileTags, categorizedTags, getTagColor, handleTagClick]);

    // Format display date based on current sort
    const displayDate = useMemo(() => {
        if (!appearanceSettings.showDate || !sortOption) return '';

        // Determine which date to show based on sort option
        const dateField = getDateField(sortOption);
        const timestamp = dateField === 'ctime' ? getFileCreatedTime(file) : getFileModifiedTime(file);

        // If in a date group and not in pinned section, format relative to group
        if (dateGroup && dateGroup !== strings.listPane.pinnedSection) {
            return DateUtils.formatDateForGroup(timestamp, dateGroup, settings.dateFormat, settings.timeFormat);
        }

        // Otherwise format as absolute date
        return DateUtils.formatDate(timestamp, settings.dateFormat);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- file.stat.mtime and file.stat.ctime are needed to detect file changes
    }, [
        file,
        file.stat.mtime,
        file.stat.ctime,
        sortOption,
        dateGroup,
        appearanceSettings.showDate,
        settings.dateFormat,
        settings.timeFormat,
        getFileCreatedTime,
        getFileModifiedTime
    ]);

    // Cleaner logic: when optimization is OFF, always use full height
    const useFullFileItemHeight = !settings.optimizeNoteHeight;

    // Detect slim mode when all display options are disabled
    const isSlimMode = !appearanceSettings.showDate && !appearanceSettings.showPreview && !appearanceSettings.showImage;

    // Determine if we should show the feature image area (either with an image or extension badge)
    const shouldShowFeatureImageArea =
        appearanceSettings.showImage &&
        (featureImageUrl || // Has an actual image
            (file.extension !== 'md' && !isImageFile(file))); // Non-markdown, non-image files show extension badge

    // Memoize className to avoid string concatenation on every render
    const className = useMemo(() => {
        const classes = ['nn-file'];
        if (isSelected) classes.push('nn-selected');
        if (isSlimMode) classes.push('nn-slim');
        if (isSelected && hasSelectedAbove) classes.push('nn-has-selected-above');
        if (isSelected && hasSelectedBelow) classes.push('nn-has-selected-below');
        return classes.join(' ');
    }, [isSelected, isSlimMode, hasSelectedAbove, hasSelectedBelow]);

    // Handle file changes and subscribe to content updates
    useEffect(() => {
        // Load current file data
        const { preview, tagList, imageUrl } = loadFileData();
        setPreviewText(preview);
        setTags(tagList);
        setFeatureImageUrl(imageUrl);

        // Subscribe to content changes
        const db = getDB();
        const unsubscribe = db.onFileContentChange(file.path, (changes: FileContentChange['changes']) => {
            if (changes.preview !== undefined && appearanceSettings.showPreview && file.extension === 'md') {
                setPreviewText(changes.preview || '');
            }
            if (changes.featureImage !== undefined && appearanceSettings.showImage && !isImageFile(file)) {
                // Convert path to URL
                if (changes.featureImage) {
                    const imageFile = app.vault.getFileByPath(changes.featureImage);
                    if (imageFile) {
                        try {
                            const resourceUrl = app.vault.getResourcePath(imageFile);
                            setFeatureImageUrl(resourceUrl);
                        } catch {
                            setFeatureImageUrl(null);
                        }
                    } else {
                        setFeatureImageUrl(null);
                    }
                } else {
                    setFeatureImageUrl(null);
                }
            }
            if (changes.tags !== undefined) {
                setTags(changes.tags || []);
            }
        });

        return () => {
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- file.path is needed to resubscribe when file is renamed
    }, [file.path, appearanceSettings.showPreview, appearanceSettings.showImage, getDB, app]);

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

        // Format dates for tooltip with time
        const dateTimeFormat = settings.timeFormat ? `${settings.dateFormat} ${settings.timeFormat}` : settings.dateFormat;
        const createdTimestamp = getFileCreatedTime(file);
        const modifiedTimestamp = getFileModifiedTime(file);
        const createdDate = DateUtils.formatDate(createdTimestamp, dateTimeFormat);
        const modifiedDate = DateUtils.formatDate(modifiedTimestamp, dateTimeFormat);

        // Check current sort to determine date order
        const isCreatedSort = sortOption ? sortOption.startsWith('created-') : false;

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
    }, [isMobile, file, file.stat.ctime, file.stat.mtime, settings, displayName, getFileCreatedTime, getFileModifiedTime, sortOption]);

    // Quick action handlers - these don't need memoization because:
    // 1. They're only attached to DOM elements that appear on hover
    // 2. They're not passed as props to child components
    // 3. They don't cause re-renders when recreated
    const handleOpenInNewTab = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        app.workspace.getLeaf('tab').openFile(file);
    };

    const handlePinClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const context = selectionType === ItemType.TAG ? ItemType.TAG : ItemType.FOLDER;
        await metadataService.togglePin(file.path, context);
    };

    const handleRevealClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        await plugin.activateView();
        await plugin.revealFileInActualFolder(file);
    };

    // === Effects ===

    // Set up the icons when quick actions panel is shown
    useEffect(() => {
        if (isHovered && !isMobile) {
            if (revealInFolderIconRef.current && shouldShowRevealIcon) {
                setIcon(revealInFolderIconRef.current, 'folder');
            }
            if (pinNoteIconRef.current && shouldShowPinNote) {
                setIcon(pinNoteIconRef.current, isPinned ? 'pin-off' : 'pin');
            }
            if (openInNewTabIconRef.current && shouldShowOpenInNewTab) {
                setIcon(openInNewTabIconRef.current, 'file-plus');
            }
        }
    }, [isHovered, isMobile, shouldShowOpenInNewTab, shouldShowPinNote, shouldShowRevealIcon, isPinned]);

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
            onClick={onClick}
            draggable={!isMobile}
            role="listitem"
            onMouseEnter={() => !isMobile && setIsHovered(true)}
            onMouseLeave={() => !isMobile && setIsHovered(false)}
        >
            <div className="nn-file-content">
                {/* Quick actions panel - appears on hover */}
                {isHovered && !isMobile && hasQuickActions && (
                    <div
                        className={`nn-quick-actions-panel ${isSlimMode ? 'nn-slim-mode' : ''}`}
                        data-title-rows={appearanceSettings.titleRows}
                        data-has-tags={settings.showTags && settings.showFileTags && categorizedTags.length > 0 ? 'true' : 'false'}
                    >
                        {shouldShowRevealIcon && (
                            <div
                                ref={revealInFolderIconRef}
                                className="nn-quick-action-item"
                                onClick={handleRevealClick}
                                title={strings.contextMenu.file.revealInFolder}
                            />
                        )}
                        {shouldShowRevealIcon && shouldShowPinNote && <div className="nn-quick-action-separator" />}
                        {shouldShowPinNote && (
                            <div
                                ref={pinNoteIconRef}
                                className="nn-quick-action-item"
                                onClick={handlePinClick}
                                title={
                                    isPinned
                                        ? file.extension === 'md'
                                            ? strings.contextMenu.file.unpinNote
                                            : strings.contextMenu.file.unpinFile
                                        : file.extension === 'md'
                                          ? strings.contextMenu.file.pinNote
                                          : strings.contextMenu.file.pinFile
                                }
                            />
                        )}
                        {shouldShowPinNote && shouldShowOpenInNewTab && <div className="nn-quick-action-separator" />}
                        {shouldShowOpenInNewTab && (
                            <div
                                ref={openInNewTabIconRef}
                                className="nn-quick-action-item"
                                onClick={handleOpenInNewTab}
                                title={strings.contextMenu.file.openInNewTab}
                            />
                        )}
                    </div>
                )}
                <div className="nn-file-inner-content">
                    {isSlimMode ? (
                        // Slim mode: Show file name and tags with minimal styling
                        <div className="nn-slim-file-text-content">
                            <div
                                className="nn-file-name"
                                style={{ '--filename-rows': appearanceSettings.titleRows } as React.CSSProperties}
                            >
                                {displayName}
                            </div>
                            {renderTags()}
                        </div>
                    ) : (
                        // Normal mode: Show all enabled elements
                        <>
                            <div className="nn-file-text-content">
                                <div
                                    className="nn-file-name"
                                    style={{ '--filename-rows': appearanceSettings.titleRows } as React.CSSProperties}
                                >
                                    {displayName}
                                </div>

                                {/* Single row mode (preview rows = 1) - show all elements */}
                                {((!useFullFileItemHeight && isPinned) || appearanceSettings.previewRows < 2) && (
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
                                        {renderTags()}

                                        {/* Parent folder - not shown for pinned items when optimization is enabled */}
                                        {(useFullFileItemHeight || !isPinned) &&
                                            settings.showNotesFromSubfolders &&
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
                                {(useFullFileItemHeight || !isPinned) && appearanceSettings.previewRows >= 2 && (
                                    <>
                                        {/* Case 1: Empty preview text - show tags, then date + parent folder */}
                                        {!useFullFileItemHeight && !previewText && (
                                            <>
                                                {/* Tags (show even when no preview text) */}
                                                {renderTags()}
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
                                        {(useFullFileItemHeight || previewText) && (
                                            <>
                                                {/* Multi-row preview - show preview text spanning multiple rows */}
                                                {settings.showFilePreview && (
                                                    <div
                                                        className="nn-file-preview"
                                                        style={{ '--preview-rows': appearanceSettings.previewRows } as React.CSSProperties}
                                                    >
                                                        {previewText}
                                                    </div>
                                                )}

                                                {/* Tags (only when preview text exists) */}
                                                {renderTags()}

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
                                            loading="eager" // Load images immediately when switching folders
                                            draggable={false}
                                            onDragStart={e => e.preventDefault()}
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
        </div>
    );
});
