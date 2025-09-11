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
 *    - Feature images use default browser loading behavior
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
import { getExtensionSuffix, isImageFile, shouldShowExtensionSuffix } from '../utils/fileTypeUtils';
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
    /** Active search query for highlighting matches in the file name */
    searchQuery?: string;
}

/**
 * Computes merged highlight ranges for all occurrences of search segments.
 * Overlapping ranges are merged to avoid nested highlights.
 */
function getMergedHighlightRanges(text: string, query?: string): { start: number; end: number }[] {
    if (!query) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const segments = normalized.split(/\s+/).filter(Boolean);
    if (segments.length === 0) return [];

    const lower = text.toLowerCase();
    const ranges: { start: number; end: number }[] = [];

    segments.forEach(seg => {
        let idx = lower.indexOf(seg);
        while (idx !== -1) {
            ranges.push({ start: idx, end: idx + seg.length });
            idx = lower.indexOf(seg, idx + seg.length);
        }
    });

    if (ranges.length === 0) return [];

    ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: { start: number; end: number }[] = [];
    for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (!last || r.start > last.end) {
            merged.push({ ...r });
        } else if (r.end > last.end) {
            last.end = r.end;
        }
    }
    return merged;
}

/**
 * Splits text into plain and highlighted parts based on merged ranges.
 */
function renderHighlightedText(text: string, query?: string): React.ReactNode {
    const ranges = getMergedHighlightRanges(text, query);
    if (ranges.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((r, i) => {
        if (r.start > cursor) {
            parts.push(text.slice(cursor, r.start));
        }
        parts.push(
            <span key={`h-${i}`} className="nn-search-highlight">
                {text.slice(r.start, r.end)}
            </span>
        );
        cursor = r.end;
    });
    if (cursor < text.length) {
        parts.push(text.slice(cursor));
    }
    return <>{parts}</>;
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
    selectionType,
    searchQuery
}: FileItemProps) {
    // === Hooks (all hooks together at the top) ===
    const { app, isMobile, plugin, commandQueue } = useServices();
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
    const [metadataVersion, setMetadataVersion] = useState(0);

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
        // NOTE TO REVIEWER: Recompute on frontmatter metadata changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, getFileDisplayName, metadataVersion]);

    // Highlight matches in display name when search is active
    const highlightedName = useMemo(() => renderHighlightedText(displayName, searchQuery), [displayName, searchQuery]);

    // Decide whether to render an inline extension suffix after the name
    const extensionSuffix = useMemo(() => getExtensionSuffix(file), [file]);
    const showExtensionSuffix = useMemo(() => shouldShowExtensionSuffix(file), [file]);

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

    // Render tags
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

        // Pinned items are all grouped under "📌 Pinned" section regardless of their actual dates
        // We need to calculate the actual date group to show smart formatting
        if (isPinned) {
            const actualDateGroup = DateUtils.getDateGroup(timestamp);
            return DateUtils.formatDateForGroup(timestamp, actualDateGroup, settings.dateFormat, settings.timeFormat);
        }

        // If in a date group and not in pinned section, format relative to group
        if (dateGroup && dateGroup !== strings.listPane.pinnedSection) {
            return DateUtils.formatDateForGroup(timestamp, dateGroup, settings.dateFormat, settings.timeFormat);
        }

        // Otherwise format as absolute date
        return DateUtils.formatDate(timestamp, settings.dateFormat);
        // NOTE TO REVIEWER: Including **file.stat.mtime**/**file.stat.ctime** to detect file changes
        // Without them, dates won't update after file edits
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        file,
        file.stat.mtime,
        file.stat.ctime,
        sortOption,
        dateGroup,
        isPinned,
        appearanceSettings.showDate,
        settings.dateFormat,
        settings.timeFormat,
        getFileCreatedTime,
        getFileModifiedTime,
        metadataVersion
    ]);

    // Height optimization settings
    const heightOptimizationEnabled = settings.optimizeNoteHeight;
    const heightOptimizationDisabled = !settings.optimizeNoteHeight;

    // Layout decision variables
    const pinnedItemShouldUseCompactLayout = isPinned && heightOptimizationEnabled; // Pinned items get compact treatment only when optimizing
    const shouldUseSingleLineForDateAndPreview = pinnedItemShouldUseCompactLayout || appearanceSettings.previewRows < 2;
    const shouldUseMultiLinePreviewLayout = !pinnedItemShouldUseCompactLayout && appearanceSettings.previewRows >= 2;
    const shouldCollapseEmptyPreviewSpace = heightOptimizationEnabled && !previewText; // Optimization: compact layout for empty preview
    const shouldAlwaysReservePreviewSpace = heightOptimizationDisabled || previewText; // Show full layout when not optimizing OR has content

    // Detect slim mode when all display options are disabled
    const isSlimMode = !appearanceSettings.showDate && !appearanceSettings.showPreview && !appearanceSettings.showImage;

    // Determine if we should show the feature image area (either with an image or extension badge)
    const shouldShowFeatureImageArea =
        appearanceSettings.showImage &&
        (featureImageUrl || // Has an actual image (markdown with feature image, or image files)
            file.extension === 'canvas' ||
            file.extension === 'base');

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
            if (changes.metadata !== undefined) {
                setMetadataVersion(v => v + 1);
            }
        });

        return () => {
            unsubscribe();
        };
        // NOTE TO REVIEWER: Including **file.path** to resubscribe on rename
        // Subscription key changes with path, needs new subscription
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Always include a name at the top. When showing suffix, prefer the true filename (with extension)
        const topLine = shouldShowExtensionSuffix(file) ? file.name : displayName;
        const tooltip = `${topLine}\n\n${datesTooltip}`;

        // Check if RTL mode is active
        const isRTL = document.body.classList.contains('mod-rtl');

        // Set placement to the right (left in RTL)
        setTooltip(fileRef.current, tooltip, {
            placement: isRTL ? 'left' : 'right'
        });
    }, [
        isMobile,
        file,
        file.stat.ctime,
        file.stat.mtime,
        settings,
        displayName,
        getFileCreatedTime,
        getFileModifiedTime,
        sortOption,
        metadataVersion,
        file.name
    ]);

    // Quick action handlers - these don't need memoization because:
    // 1. They're only attached to DOM elements that appear on hover
    // 2. They're not passed as props to child components
    // 3. They don't cause re-renders when recreated
    const handleOpenInNewTab = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (commandQueue) {
            commandQueue.executeOpenInNewContext(file, 'tab', async () => {
                await app.workspace.getLeaf('tab').openFile(file);
            });
        } else {
            app.workspace.getLeaf('tab').openFile(file);
        }
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

    // Handle middle mouse button click to open in new tab
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            if (commandQueue) {
                commandQueue.executeOpenInNewContext(file, 'tab', async () => {
                    await app.workspace.getLeaf('tab').openFile(file);
                });
            } else {
                app.workspace.getLeaf('tab').openFile(file);
            }
        }
    };

    // === Effects ===

    // Set up the icons when quick actions panel is shown
    useEffect(() => {
        if (isHovered && !isMobile) {
            if (revealInFolderIconRef.current && shouldShowRevealIcon) {
                setIcon(revealInFolderIconRef.current, 'lucide-folder');
            }
            if (pinNoteIconRef.current && shouldShowPinNote) {
                setIcon(pinNoteIconRef.current, isPinned ? 'lucide-pin-off' : 'lucide-pin');
            }
            if (openInNewTabIconRef.current && shouldShowOpenInNewTab) {
                setIcon(openInNewTabIconRef.current, 'lucide-file-plus');
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
            onMouseDown={handleMouseDown}
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
                        // ========== SLIM MODE ==========
                        // Minimal layout: only file name + tags
                        // Used when date, preview, and image are all disabled
                        <div className="nn-slim-file-text-content">
                            <div
                                className="nn-file-name"
                                style={{ '--filename-rows': appearanceSettings.titleRows } as React.CSSProperties}
                            >
                                {highlightedName}
                                {showExtensionSuffix && <span className="nn-file-ext-suffix">{extensionSuffix}</span>}
                            </div>
                            {renderTags()}
                        </div>
                    ) : (
                        // ========== NORMAL MODE ==========
                        // Full layout with all enabled elements
                        <>
                            <div className="nn-file-text-content">
                                <div
                                    className="nn-file-name"
                                    style={{ '--filename-rows': appearanceSettings.titleRows } as React.CSSProperties}
                                >
                                    {highlightedName}
                                    {showExtensionSuffix && <span className="nn-file-ext-suffix">{extensionSuffix}</span>}
                                </div>

                                {/* ========== SINGLE LINE MODE ========== */}
                                {/* Conditions: pinnedItemShouldUseCompactLayout OR previewRows < 2 */}
                                {/* Layout: Date+Preview share one line, tags below, parent folder last */}
                                {shouldUseSingleLineForDateAndPreview && (
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

                                        {/* Parent folder - gets its own line */}
                                        {/* Hidden when: pinnedItemShouldUseCompactLayout (pinned + optimization enabled) */}
                                        {settings.showParentFolderNames &&
                                            file.parent &&
                                            !pinnedItemShouldUseCompactLayout &&
                                            (selectionType === ItemType.TAG ||
                                                (settings.includeDescendantNotes && parentFolder && file.parent.path !== parentFolder)) && (
                                                <div className="nn-file-folder">
                                                    <ObsidianIcon name="lucide-folder-closed" className="nn-file-folder-icon" />
                                                    <span>{file.parent.name}</span>
                                                </div>
                                            )}
                                    </>
                                )}

                                {/* ========== MULTI-LINE MODE ========== */}
                                {/* Conditions: !pinnedItemShouldUseCompactLayout AND previewRows >= 2 */}
                                {/* Two sub-cases based on preview content and optimization settings */}
                                {shouldUseMultiLinePreviewLayout && (
                                    <>
                                        {/* CASE 1: COLLAPSED EMPTY PREVIEW */}
                                        {/* Conditions: heightOptimizationEnabled AND !hasPreviewText */}
                                        {/* Layout: Tags first, then Date+Parent on same line (compact) */}
                                        {shouldCollapseEmptyPreviewSpace && (
                                            <>
                                                {/* Tags (show even when no preview text) */}
                                                {renderTags()}
                                                {/* Date + Parent folder share the second line (compact layout) */}
                                                <div className="nn-file-second-line">
                                                    {settings.showFileDate && <div className="nn-file-date">{displayDate}</div>}
                                                    {settings.showParentFolderNames &&
                                                        file.parent &&
                                                        !pinnedItemShouldUseCompactLayout &&
                                                        (selectionType === ItemType.TAG ||
                                                            (settings.includeDescendantNotes &&
                                                                parentFolder &&
                                                                file.parent.path !== parentFolder)) && (
                                                            <div className="nn-file-folder">
                                                                <ObsidianIcon name="lucide-folder-closed" className="nn-file-folder-icon" />
                                                                <span>{file.parent.name}</span>
                                                            </div>
                                                        )}
                                                </div>
                                            </>
                                        )}

                                        {/* CASE 2: ALWAYS RESERVE PREVIEW SPACE */}
                                        {/* Conditions: heightOptimizationDisabled OR hasPreviewText */}
                                        {/* Layout: Full preview rows, tags, then Date+Parent on same line */}
                                        {shouldAlwaysReservePreviewSpace && (
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

                                                {/* Tags row */}
                                                {renderTags()}

                                                {/* Date + Parent folder share the metadata line */}
                                                <div className="nn-file-second-line">
                                                    {settings.showFileDate && <div className="nn-file-date">{displayDate}</div>}
                                                    {settings.showParentFolderNames &&
                                                        file.parent &&
                                                        !pinnedItemShouldUseCompactLayout &&
                                                        (selectionType === ItemType.TAG ||
                                                            (settings.includeDescendantNotes &&
                                                                parentFolder &&
                                                                file.parent.path !== parentFolder)) && (
                                                            <div className="nn-file-folder">
                                                                <ObsidianIcon name="lucide-folder-closed" className="nn-file-folder-icon" />
                                                                <span>{file.parent.name}</span>
                                                            </div>
                                                        )}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                            {/* ========== FEATURE IMAGE AREA ========== */}
                            {/* Shows either actual image or extension badge for non-markdown files */}
                            {shouldShowFeatureImageArea && (
                                <div className="nn-feature-image">
                                    {featureImageUrl ? (
                                        <img
                                            src={featureImageUrl}
                                            alt={strings.common.featureImageAlt}
                                            className="nn-feature-image-img"
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
