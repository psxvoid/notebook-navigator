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

import React, { useRef, useMemo, useEffect, useState, useCallback, useId } from 'react';
import { TFile, TFolder, setTooltip, setIcon } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import type { FileContentChange, IndexedDBStorage } from '../storage/IndexedDBStorage';
import { useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { useFileCache } from '../context/StorageContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { useTagNavigation } from '../hooks/useTagNavigation';
import { useListPaneAppearance } from '../hooks/useListPaneAppearance';
import { useShortcuts } from '../context/ShortcutsContext';
import { strings } from '../i18n';
import { SortOption } from '../settings';
import { ItemType } from '../types';
import { DateUtils } from '../utils/dateUtils';
import { runAsyncAction } from '../utils/async';
import { openFileInContext } from '../utils/openFileInContext';
import { FILE_VISIBILITY, getExtensionSuffix, isImageFile, shouldDisplayFile, shouldShowExtensionSuffix } from '../utils/fileTypeUtils';
import { getDateField, naturalCompare } from '../utils/sortUtils';
import { getIconService, useIconServiceVersion } from '../services/icons';
import type { SearchResultMeta } from '../types/search';
import { createHiddenTagVisibility } from '../utils/tagPrefixMatcher';
import { areStringArraysEqual } from '../utils/arrayUtils';
import { openAddTagToFilesModal } from '../utils/tagModalHelpers';
import { getTagSearchModifierOperator } from '../utils/tagUtils';
import type { InclusionOperator } from '../utils/filterSearch';

import { useSelectionState } from 'src/context/SelectionContext';
import { EMPTY_ARRAY, EMPTY_STRING } from 'src/utils/empty';

const FEATURE_IMAGE_MAX_ASPECT_RATIO = 16 / 9;
const sortTagsAlphabetically = (tags: string[]): void => {
    tags.sort((firstTag, secondTag) => naturalCompare(firstTag, secondTag));
};

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    hasSelectedAbove?: boolean;
    hasSelectedBelow?: boolean;
    onFileClick: (file: TFile, fileIndex: number | undefined, event: React.MouseEvent) => void;
    fileIndex?: number;
    dateGroup?: string | null;
    sortOption?: SortOption;
    parentFolder?: string | null;
    isPinned?: boolean;
    selectionType?: ItemType | null;
    /** Active search query for highlighting matches in the file name */
    searchQuery?: string;
    /** Search metadata from Omnisearch provider */
    searchMeta?: SearchResultMeta;
    /** Whether the file is normally hidden (frontmatter or excluded folder) */
    isHidden?: boolean;
    /** Modifies the active search query with a tag token when modifier clicking */
    onModifySearchWithTag?: (tag: string, operator: InclusionOperator) => void;
}

/**
 * Computes merged highlight ranges for all occurrences of search segments.
 * Overlapping ranges are merged to avoid nested highlights.
 */
function getMergedHighlightRanges(text: string, query?: string, searchMeta?: SearchResultMeta): { start: number; end: number }[] {
    if (!text) return [];

    const lower = text.toLowerCase();
    const ranges: { start: number; end: number }[] = [];
    const seenTokens = new Set<string>();

    const addTokenRanges = (rawToken: string | undefined) => {
        if (!rawToken) return;
        const token = rawToken.toLowerCase();
        if (!token || seenTokens.has(token)) return;
        seenTokens.add(token);

        let idx = lower.indexOf(token);
        while (idx !== -1) {
            ranges.push({ start: idx, end: idx + token.length });
            idx = lower.indexOf(token, idx + token.length);
        }
    };

    if (searchMeta) {
        searchMeta.matches.forEach(match => addTokenRanges(match.text));
        searchMeta.terms.forEach(term => addTokenRanges(term));
    }

    if (ranges.length === 0 && query) {
        const normalizedQuery = query.trim().toLowerCase();
        if (normalizedQuery) {
            normalizedQuery
                .split(/\s+/)
                .filter(Boolean)
                .forEach(segment => addTokenRanges(segment));
        }
    }

    if (ranges.length === 0) {
        return [];
    }

    ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: { start: number; end: number }[] = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (!last || range.start > last.end) {
            merged.push({ ...range });
        } else if (range.end > last.end) {
            last.end = range.end;
        }
    }

    return merged;
}

/**
 * Splits text into plain and highlighted parts based on merged ranges.
 */
function renderHighlightedText(text: string, query?: string, searchMeta?: SearchResultMeta): React.ReactNode {
    if (!text) return text;
    const ranges = getMergedHighlightRanges(text, query, searchMeta);
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

interface ParentFolderLabelProps {
    iconId: string;
    label: string;
    iconVersion: number;
    color?: string;
    showIcon: boolean;
    applyColorToName: boolean;
    onReveal?: () => void;
}

/**
 * Renders a parent folder label with icon for display in file items.
 */
function ParentFolderLabel({ iconId, label, iconVersion, color, showIcon, applyColorToName, onReveal }: ParentFolderLabelProps) {
    const iconRef = useRef<HTMLSpanElement>(null);
    const hasColor = Boolean(color);
    const iconStyle: React.CSSProperties | undefined = color ? { color } : undefined;
    const labelStyle: React.CSSProperties | undefined = applyColorToName && color ? { color } : undefined;
    const labelClassName = applyColorToName ? 'nn-parent-folder-label nn-parent-folder-label--colored' : 'nn-parent-folder-label';
    const isRevealEnabled = Boolean(onReveal);

    // Handles click on parent folder label to reveal the file when enabled
    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!onReveal) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onReveal();
        },
        [onReveal]
    );

    // Render the folder icon when iconId or iconVersion changes
    useEffect(() => {
        const iconContainer = iconRef.current;
        if (!iconContainer) {
            return;
        }

        iconContainer.innerHTML = '';
        if (!iconId || !showIcon) {
            return;
        }

        const iconService = getIconService();
        iconService.renderIcon(iconContainer, iconId);
    }, [iconId, iconVersion, showIcon]);

    return (
        <div className="nn-parent-folder">
            <div
                className="nn-parent-folder-content"
                data-reveal={isRevealEnabled ? 'true' : 'false'}
                onClick={isRevealEnabled ? handleClick : undefined}
            >
                {showIcon ? (
                    <span
                        className="nn-parent-folder-icon"
                        ref={iconRef}
                        aria-hidden="true"
                        data-has-color={hasColor ? 'true' : 'false'}
                        style={iconStyle}
                    />
                ) : null}
                <span className={labelClassName} style={labelStyle} data-has-color={applyColorToName ? 'true' : 'false'}>
                    {label}
                </span>
            </div>
        </div>
    );
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
    onFileClick,
    fileIndex,
    dateGroup,
    sortOption,
    parentFolder,
    isPinned = false,
    selectionType,
    searchQuery,
    searchMeta,
    isHidden = false,
    onModifySearchWithTag
}: FileItemProps) {
    // === Hooks (all hooks together at the top) ===
    const { app, isMobile, plugin, commandQueue, tagOperations } = useServices();
    const settings = useSettingsState();
    const uxPreferences = useUXPreferences();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;
    const showHiddenItems = uxPreferences.showHiddenItems;
    const appearanceSettings = useListPaneAppearance();
    const { getFileDisplayName, getDB, getFileCreatedTime, getFileModifiedTime } = useFileCache();
    const { navigateToTag } = useTagNavigation();
    const metadataService = useMetadataService();
    const { addNoteShortcut, hasNoteShortcut, noteShortcutKeysByPath, removeShortcut } = useShortcuts();
    const hiddenTagVisibility = useMemo(
        () => createHiddenTagVisibility(settings.hiddenTags, showHiddenItems),
        [settings.hiddenTags, showHiddenItems]
    );
    const selectionState = useSelectionState();

    // === Helper functions ===
    // Load all file metadata from cache
    const loadFileData = useCallback(async () => {
        const db = getDB();

        const preview = appearanceSettings.showPreview && file.extension === 'md' ? db.getCachedPreviewText(file.path) : '';

        const tagList = [...(db.getCachedTags(file.path) ?? [])];

        let imageUrl: string | null = null;
        if (appearanceSettings.showImage) {
            if (isImageFile(file)) {
                try {
                    imageUrl = app.vault.getResourcePath(file);
                } catch {
                    imageUrl = null;
                }
            } else {
                const previewBase64 = (await db.getFileWithPreview(file.path))?.featureImageResized

                if (previewBase64 != null) {
                    imageUrl = previewBase64
                }
            }
        }

        return { preview, tags: tagList, imageUrl };
    }, [appearanceSettings.showImage, appearanceSettings.showPreview, app, file, getDB]);

    // === State ===
    const [isHovered, setIsHovered] = React.useState(false);

    // Cache initial data to avoid recomputing on every render
    const initialDataRef = useRef<Awaited<ReturnType<typeof loadFileData>> | null>(null);

    useEffect(() => {
        const asyncEffect = async function() {
            initialDataRef.current ??= await loadFileData();
        }

        asyncEffect()
    }, [loadFileData])

    const [previewText, setPreviewText] = useState<string>(initialDataRef.current?.preview ?? EMPTY_STRING);
    const [tags, setTags] = useState<string[]>(initialDataRef.current?.tags ?? EMPTY_ARRAY);
    const [featureImageUrl, setFeatureImageUrl] = useState<string | null>(initialDataRef.current?.imageUrl ?? null);
    const [featureImageAspectRatio, setFeatureImageAspectRatio] = useState<number | null>(null);
    const [isFeatureImageHidden, setIsFeatureImageHidden] = useState(false);
    const [metadataVersion, setMetadataVersion] = useState(0);

    // === Refs ===
    const fileRef = useRef<HTMLDivElement>(null);
    const revealInFolderIconRef = useRef<HTMLDivElement>(null);
    const addTagIconRef = useRef<HTMLDivElement>(null);
    const addShortcutIconRef = useRef<HTMLDivElement>(null);
    const pinNoteIconRef = useRef<HTMLDivElement>(null);
    const openInNewTabIconRef = useRef<HTMLDivElement>(null);
    const fileIconRef = useRef<HTMLSpanElement>(null);
    // Icon shown next to filename for files not natively supported by Obsidian
    const fileExternalIconRef = useRef<HTMLSpanElement>(null);
    // Icon shown in slim mode to indicate file type (canvas, base, or external)
    const slimModeIconRef = useRef<HTMLSpanElement>(null);
    // Unique ID for linking screen reader description to the file item
    const hiddenDescriptionId = useId();

    // === Derived State & Memoized Values ===

    // Check which quick actions should be shown
    const shouldShowOpenInNewTab = settings.showQuickActions && settings.quickActionOpenInNewTab;
    const shouldShowPinNote = settings.showQuickActions && settings.quickActionPinNote;
    const shouldShowRevealIcon =
        settings.showQuickActions && settings.quickActionRevealInFolder && file.parent && file.parent.path !== parentFolder;
    const canAddTagsToFile = file.extension === 'md';
    const shouldShowAddTagAction = settings.showQuickActions && settings.quickActionAddTag && canAddTagsToFile && Boolean(tagOperations);
    const hasShortcut = hasNoteShortcut(file.path);
    const shouldShowShortcutAction = settings.showQuickActions && settings.quickActionAddToShortcuts;
    const hasQuickActions =
        shouldShowOpenInNewTab || shouldShowPinNote || shouldShowRevealIcon || shouldShowAddTagAction || shouldShowShortcutAction;
    const iconServiceVersion = useIconServiceVersion();

    // Get display name from RAM cache (handles frontmatter title)
    const displayName = useMemo(() => {
        return getFileDisplayName(file);
        // NOTE TO REVIEWER: Recompute on frontmatter metadata changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, getFileDisplayName, metadataVersion]);

    // Highlight matches in display name when search is active
    const highlightedName = useMemo(
        () => renderHighlightedText(displayName, searchQuery, searchMeta),
        [displayName, searchQuery, searchMeta]
    );

    // Decide whether to render an inline extension suffix after the name
    const extensionSuffix = useMemo(() => getExtensionSuffix(file), [file]);
    const showExtensionSuffix = useMemo(() => shouldShowExtensionSuffix(file), [file]);
    const fileIconId = metadataService.getFileIcon(file.path);
    const fileColor = metadataService.getFileColor(file.path);
    const fileExtension = file.extension;
    const isImageDocument = isImageFile(file);
    // Determine the default icon to use based on file type
    const defaultTypeIconId = useMemo(() => {
        if (fileExtension === 'canvas') {
            return 'lucide-layout-grid';
        }
        if (fileExtension === 'base') {
            return 'lucide-database';
        }
        if (isImageDocument) {
            return 'lucide-image';
        }
        if (fileExtension === 'md') {
            return 'lucide-file-text';
        }
        return 'lucide-file';
    }, [fileExtension, isImageDocument]);
    // Determine the actual icon to display, considering custom icon and colorIconOnly setting
    const effectiveFileIconId = useMemo(() => {
        if (fileIconId) {
            return fileIconId;
        }
        if (settings.colorIconOnly && fileColor) {
            return defaultTypeIconId;
        }
        return null;
    }, [defaultTypeIconId, fileColor, fileIconId, settings.colorIconOnly]);
    // Determine whether to apply color to the file name instead of the icon
    const applyColorToName = Boolean(fileColor) && !settings.colorIconOnly;
    // Check if using a fallback type icon because colorIconOnly is enabled
    const usingFallbackIcon = !fileIconId && Boolean(fileColor) && settings.colorIconOnly;
    // Icon to use when dragging the file
    const dragIconId = useMemo(() => {
        if (effectiveFileIconId) {
            return effectiveFileIconId;
        }
        return defaultTypeIconId;
    }, [defaultTypeIconId, effectiveFileIconId]);

    // Check if file is not natively supported by Obsidian (e.g., Office files, archives)
    const isExternalFile = useMemo(() => {
        return !shouldDisplayFile(file, FILE_VISIBILITY.SUPPORTED, app);
    }, [app, file]);

    // Determine which icon to show in slim mode based on file type
    const slimModeTypeIconId = useMemo(() => {
        if (fileExtension === 'base') {
            return 'lucide-database';
        }
        if (fileExtension === 'canvas') {
            return 'lucide-layout-grid';
        }
        if (isExternalFile) {
            return 'lucide-external-link';
        }
        return null;
    }, [fileExtension, isExternalFile]);

    const isSlimMode = !appearanceSettings.showDate && !appearanceSettings.showPreview && !appearanceSettings.showImage;

    // Determines whether to display the file icon based on icon availability and external file handling
    // External files with fallback icons are hidden in non-slim mode to avoid visual clutter
    const shouldShowFileIcon = useMemo(() => {
        if (!effectiveFileIconId) {
            return false;
        }
        if (usingFallbackIcon && isExternalFile && !isSlimMode) {
            return false;
        }
        return true;
    }, [effectiveFileIconId, isExternalFile, isSlimMode, usingFallbackIcon]);

    const isMultiRowTitle = appearanceSettings.titleRows > 1;

    const fileTitleElement = useMemo(() => {
        return (
            <div
                className="nn-file-name-wrapper"
                data-title-rows={appearanceSettings.titleRows}
                data-multiline={isMultiRowTitle ? 'true' : 'false'}
            >
                {shouldShowFileIcon ? (
                    <span
                        ref={fileIconRef}
                        className="nn-file-icon"
                        data-has-color={fileColor ? 'true' : 'false'}
                        style={fileColor ? { color: fileColor } : undefined}
                    />
                ) : null}
                <div className="nn-file-name-content">
                    <div className="nn-file-name-row">
                        {!isSlimMode && isExternalFile ? (
                            <span
                                className="nn-file-icon nn-file-external-icon"
                                ref={fileExternalIconRef}
                                aria-hidden="true"
                                data-has-color={fileColor ? 'true' : 'false'}
                                style={fileColor ? { color: fileColor } : undefined}
                            />
                        ) : null}
                        <div
                            className="nn-file-name"
                            data-has-color={applyColorToName ? 'true' : 'false'}
                            style={
                                {
                                    '--filename-rows': appearanceSettings.titleRows,
                                    ...(applyColorToName ? { '--nn-file-name-custom-color': fileColor } : {})
                                } as React.CSSProperties
                            }
                        >
                            {highlightedName}
                            {showExtensionSuffix && <span className="nn-file-ext-suffix">{extensionSuffix}</span>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [
        appearanceSettings.titleRows,
        extensionSuffix,
        fileColor,
        applyColorToName,
        highlightedName,
        isExternalFile,
        isSlimMode,
        isMultiRowTitle,
        shouldShowFileIcon,
        showExtensionSuffix
    ]);

    // === Callbacks ===

    // Handle tag click
    const handleTagClick = useCallback(
        (event: React.MouseEvent, tag: string) => {
            event.stopPropagation();

            if (onModifySearchWithTag) {
                const operator = getTagSearchModifierOperator(event, settings.multiSelectModifier, isMobile);
                if (operator) {
                    event.preventDefault();
                    onModifySearchWithTag(tag, operator);
                    return;
                }
            }

            navigateToTag(tag);
        },
        [navigateToTag, onModifySearchWithTag, settings.multiSelectModifier, isMobile]
    );

    // Get tag color
    const getTagColor = useCallback(
        (tag: string): string | undefined => {
            return metadataService.getTagColor(tag);
        },
        [metadataService]
    );

    const colorFileTags = settings.colorFileTags;
    const prioritizeColoredFileTags = settings.prioritizeColoredFileTags;

    const visibleTags = useMemo(() => {
        if (tags.length === 0) {
            return tags;
        }
        if (!hiddenTagVisibility.shouldFilterHiddenTags) {
            return tags;
        }

        return tags.filter(tag => hiddenTagVisibility.isTagVisible(tag));
    }, [hiddenTagVisibility, tags]);

    // Sort tags alphabetically and optionally prioritize colored tags
    const categorizedTags = useMemo(() => {
        if (visibleTags.length === 0) {
            return visibleTags;
        }

        if (!prioritizeColoredFileTags || !colorFileTags) {
            const sortedTags = [...visibleTags];
            sortTagsAlphabetically(sortedTags);
            return sortedTags;
        }

        const coloredTags: string[] = [];
        const regularTags: string[] = [];

        visibleTags.forEach(tag => {
            if (getTagColor(tag)) {
                coloredTags.push(tag);
            } else {
                regularTags.push(tag);
            }
        });

        sortTagsAlphabetically(coloredTags);
        sortTagsAlphabetically(regularTags);

        return [...coloredTags, ...regularTags];
    }, [colorFileTags, getTagColor, prioritizeColoredFileTags, visibleTags]);

    const shouldShowFileTags = useMemo(() => {
        if (!settings.showTags || !settings.showFileTags) {
            return false;
        }
        if (categorizedTags.length === 0) {
            return false;
        }
        if (isSlimMode && !settings.showFileTagsInSlimMode) {
            return false;
        }
        return true;
    }, [categorizedTags, isSlimMode, settings.showFileTags, settings.showFileTagsInSlimMode, settings.showTags]);


    const getTagDisplayName = useCallback(
        (tag: string): { displayTag: string, tooltip?: string } => {
            if (settings.showFileTagAncestors && !settings.collapseFileTagsToSelectedTag) {
                return { displayTag: tag };
            }

            const segments = tag.split('/').filter(segment => segment.length > 0);

            if (segments.length === 0) {
                return { displayTag: tag };
            }

            let displayTag: string = tag
            const selectedTag = selectionState.selectedTag ?? EMPTY_STRING;

            if (settings.collapseFileTagsToSelectedTag
                && selectedTag.length !== 0 && selectionState.selectionType === 'tag') {

                if (selectedTag.length === tag.length && selectedTag === tag) {
                    return { displayTag: EMPTY_STRING }
                }

                const selectedTagSegments = selectedTag.split('/').filter(segment => segment.length > 0);

                while(segments.length > 0 && segments.length > 0 && selectedTagSegments[0] === segments[0]) {
                    segments.shift()
                    selectedTagSegments.shift()
                }

                displayTag = segments.join('/')
            }

            if (!settings.showFileTagAncestors && segments.length > 0) {
                displayTag = segments[segments.length - 1]
            }

            const displayTooltip = displayTag.length < tag.length ? tag : undefined

            return { displayTag, tooltip: displayTooltip }
        },
        [settings.showFileTagAncestors, settings.collapseFileTagsToSelectedTag, selectionState]
    );

    const RenderTag = useCallback(function RenderTag(el: { tag: string, index: number }) {
        const { tag, index } = el
        const tagRef = useRef<HTMLSpanElement>(null);
        const tagColor = colorFileTags ? getTagColor(tag) : undefined;
        const { displayTag, tooltip } = getTagDisplayName(tag);

        useEffect(() => {
            if (tagRef.current == null || displayTag.length === 0 || tooltip == null) {
                return
            }

            setTooltip(tagRef.current, tooltip);
        }, [tagRef, displayTag, tooltip]);

        return displayTag === EMPTY_STRING ? null : (
            <span
                key={index}
                className="nn-file-tag nn-clickable-tag"
                onClick={e => handleTagClick(e, tag)}
                role="button"
                tabIndex={0}
                style={tagColor ? { backgroundColor: tagColor } : undefined}
                ref={el => { if (el != null) tagRef.current = el }}
            >
                {displayTag}
            </span>
        );
    }, [colorFileTags, getTagColor, getTagDisplayName, handleTagClick])

    // Render tags
    const renderTags = useCallback(() => {
        if (!shouldShowFileTags) {
            return null;
        }

        return (
            <div className="nn-file-tags">
                {categorizedTags.map((tag, index) => <RenderTag {...{tag, index}}/>).filter(x => x != null)}
            </div>
        );
    }, [categorizedTags, shouldShowFileTags, RenderTag]);

    // Format display date based on current sort
    const displayDate = useMemo(() => {
        if (!appearanceSettings.showDate || !sortOption) return '';

        const createdTimestamp = getFileCreatedTime(file);
        const modifiedTimestamp = getFileModifiedTime(file);
        const isAlphabeticalSort = sortOption.startsWith('title');
        const alphabeticalMode = settings.alphabeticalDateMode ?? 'modified';

        // Determine which date to show based on sort option and user preference
        const dateField = getDateField(sortOption);
        // For alphabetical sort, use the alphabeticalMode setting; for date sorts, use the sort field
        const shouldUseCreatedDate = isAlphabeticalSort ? alphabeticalMode === 'created' : dateField === 'ctime';
        const timestamp = shouldUseCreatedDate ? createdTimestamp : modifiedTimestamp;

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
        settings.alphabeticalDateMode,
        getFileCreatedTime,
        getFileModifiedTime,
        metadataVersion
    ]);

    // Height optimization settings
    const heightOptimizationEnabled = settings.optimizeNoteHeight;
    const heightOptimizationDisabled = !settings.optimizeNoteHeight;

    // Layout decision variables
    const pinnedItemShouldUseCompactLayout = isPinned && heightOptimizationEnabled; // Pinned items get compact treatment only when optimizing
    const effectivePreviewText =
        searchMeta && searchMeta.excerpt && searchMeta.excerpt.trim().length > 0 ? searchMeta.excerpt : previewText;
    const hasPreviewContent = effectivePreviewText.trim().length > 0;
    const highlightedPreview = useMemo(
        // Only Omnisearch trigger highlighting in preview, not regular filter
        () => (searchMeta ? renderHighlightedText(effectivePreviewText, undefined, searchMeta) : effectivePreviewText),
        [effectivePreviewText, searchMeta]
    );

    const shouldUseSingleLineForDateAndPreview = pinnedItemShouldUseCompactLayout || appearanceSettings.previewRows < 2;
    const shouldUseMultiLinePreviewLayout = !pinnedItemShouldUseCompactLayout && appearanceSettings.previewRows >= 2;
    const shouldCollapseEmptyPreviewSpace = heightOptimizationEnabled && !hasPreviewContent; // Optimization: compact layout for empty preview
    const shouldAlwaysReservePreviewSpace = heightOptimizationDisabled || hasPreviewContent; // Show full layout when not optimizing OR has content

    // Determine parent folder display metadata
    const parentFolderSource = file.parent;
    let parentFolderMeta: {
        name: string;
        iconId: string;
        color?: string;
        applyColorToName: boolean;
        showIcon: boolean;
    } | null = null;
    if (settings.showParentFolder && parentFolderSource instanceof TFolder && !pinnedItemShouldUseCompactLayout) {
        // Show parent label in tag view or when viewing descendants
        const shouldShowParentLabel =
            selectionType === ItemType.TAG || (includeDescendantNotes && parentFolder && parentFolderSource.path !== parentFolder);

        if (shouldShowParentLabel && parentFolderSource.path !== '/') {
            // Use custom icon if set, otherwise use default folder icon
            const customParentIcon = metadataService.getFolderIcon(parentFolderSource.path);
            const fallbackParentIcon = parentFolderSource.path === '/' ? 'vault' : 'lucide-folder-closed';
            const parentFolderColor = settings.showParentFolderColor ? metadataService.getFolderColor(parentFolderSource.path) : undefined;
            parentFolderMeta = {
                name: parentFolderSource.name,
                iconId: customParentIcon ?? fallbackParentIcon,
                color: parentFolderColor,
                applyColorToName: Boolean(parentFolderColor) && !settings.colorIconOnly,
                showIcon: settings.showFolderIcons
            };
        }
    }

    // Render parent folder label if metadata is available
    const renderParentFolder = () =>
        parentFolderMeta ? (
            <ParentFolderLabel
                iconId={parentFolderMeta.iconId}
                label={parentFolderMeta.name}
                iconVersion={iconServiceVersion}
                color={parentFolderMeta.color}
                showIcon={parentFolderMeta.showIcon}
                applyColorToName={parentFolderMeta.applyColorToName}
                onReveal={settings.parentFolderClickRevealsFile ? revealFileInNavigation : undefined}
            />
        ) : null;

    // Determine if we should show the feature image area (either with an image or extension badge)
    const shouldShowFeatureImageArea =
        appearanceSettings.showImage &&
        (featureImageUrl || // Has an actual image (markdown with feature image, or image files)
            file.extension === 'canvas' ||
            file.extension === 'base');

    // Reset image hidden state when the feature image URL changes
    useEffect(() => {
        setIsFeatureImageHidden(false);
    }, [featureImageUrl]);

    const featureImageContainerClassName = useMemo(() => {
        const classes = ['nn-feature-image'];
        if (!featureImageUrl || settings.forceSquareFeatureImage) {
            classes.push('nn-feature-image--square');
        } else {
            classes.push('nn-feature-image--natural');
        }
        // Hide container if image failed to load
        if (isFeatureImageHidden) {
            classes.push('nn-feature-image--hidden');
        }
        return classes.join(' ');
    }, [featureImageUrl, settings.forceSquareFeatureImage, isFeatureImageHidden]);

    const featureImageStyle = useMemo(() => {
        if (!featureImageUrl || settings.forceSquareFeatureImage) {
            return undefined;
        }

        const aspectRatio = featureImageAspectRatio ?? 1;
        return {
            '--nn-feature-image-aspect-ratio': aspectRatio
        } as React.CSSProperties;
    }, [featureImageAspectRatio, featureImageUrl, settings.forceSquareFeatureImage]);

    // Memoize className to avoid string concatenation on every render
    const className = useMemo(() => {
        const classes = ['nn-file'];
        if (isSelected) classes.push('nn-selected');
        if (isSlimMode) classes.push('nn-slim');
        if (isSelected && hasSelectedAbove) classes.push('nn-has-selected-above');
        if (isSelected && hasSelectedBelow) classes.push('nn-has-selected-below');
        // Apply muted style when file is normally hidden but shown via "show hidden items"
        if (isHidden) classes.push('nn-hidden-file');
        return classes.join(' ');
    }, [isSelected, isSlimMode, hasSelectedAbove, hasSelectedBelow, isHidden]);

    // Screen reader description for files shown via "show hidden items" toggle
    const hiddenDescription = useMemo(() => {
        if (!isHidden) {
            return undefined;
        }
        return strings.listPane.hiddenItemAriaLabel.replace('{name}', displayName);
    }, [isHidden, displayName]);

    // Handle file changes and subscribe to content updates
    useEffect(() => {
        let unsubscribe: ReturnType<typeof IndexedDBStorage.prototype.onFileContentChange>
        const asyncFunc = async function() {
            const { preview, tags: initialTags, imageUrl } = await loadFileData();

            // Only update state if values actually changed to prevent unnecessary re-renders
            setPreviewText(prev => (prev === preview ? prev : preview));
            setTags(prev => (areStringArraysEqual(prev, initialTags) ? prev : initialTags));
            setFeatureImageUrl(prev => (prev === imageUrl ? prev : imageUrl));

            const db = getDB();
            unsubscribe = db.onFileContentChange(file.path, (changes: FileContentChange['changes']) => {
                // Update preview text when it changes
                if (changes.preview !== undefined && appearanceSettings.showPreview && file.extension === 'md') {
                    const nextPreview = changes.preview || '';
                    setPreviewText(prev => (prev === nextPreview ? prev : nextPreview));
                }
                // Update feature image when it changes
                if (changes.featureImage !== undefined && appearanceSettings.showImage) {
                    let resourceUrl: string | null = null;
                    if (changes.featureImage) {
                        if (changes.featureImageResized) {
                            try {
                                resourceUrl = changes.featureImageResized
                            } catch {
                                resourceUrl = null;
                            }
                        }
                    } else if (isImageFile(file)) {
                        try {
                            resourceUrl = app.vault.getResourcePath(file);
                        } catch {
                            resourceUrl = null;
                        }
                    }
                    setFeatureImageUrl(prev => (prev === resourceUrl ? prev : resourceUrl));
                }
                // Update tags when they change
                if (changes.tags !== undefined) {
                    const nextTags = [...(changes.tags ?? [])];
                    setTags(prev => (areStringArraysEqual(prev, nextTags) ? prev : nextTags));
                }
                // Trigger metadata refresh when frontmatter changes
                if (changes.metadata !== undefined) {
                    setMetadataVersion(v => v + 1);
                }
            });
        }

        asyncFunc()

        return () => {
            // Review: Refactoring: use abort controller with proper async handling
            (unsubscribe ?? function(){})();
        };
        // NOTE: include file.path because Obsidian reuses TFile instance on rename
    }, [file, file.path, appearanceSettings.showPreview, appearanceSettings.showImage, getDB, app, loadFileData]);

    useEffect(() => {
        if (!featureImageUrl || settings.forceSquareFeatureImage) {
            setFeatureImageAspectRatio(null);
            return;
        }

        setFeatureImageAspectRatio(null);

        let isActive = true;
        const image = new Image();

        const applyAspectRatio = (width: number, height: number) => {
            if (!isActive) {
                return;
            }
            if (width <= 0 || height <= 0) {
                setFeatureImageAspectRatio(null);
                return;
            }
            const ratio = width / height;
            const clampedRatio = Math.min(ratio, FEATURE_IMAGE_MAX_ASPECT_RATIO);
            setFeatureImageAspectRatio(clampedRatio);
        };

        image.onload = () => applyAspectRatio(image.naturalWidth, image.naturalHeight);
        image.onerror = () => {
            if (isActive) {
                setFeatureImageAspectRatio(null);
            }
        };
        image.src = featureImageUrl;

        if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
            applyAspectRatio(image.naturalWidth, image.naturalHeight);
        }

        return () => {
            isActive = false;
        };
    }, [featureImageUrl, settings.forceSquareFeatureImage]);

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

        // Build tooltip content with multiple lines
        const tooltipLines = [topLine];

        // Include folder path in tooltip when enabled
        if (settings.showTooltipPath) {
            const parentPath = file.parent?.path ?? '/';
            tooltipLines.push(parentPath);
        }

        // Add empty line separator and date information
        tooltipLines.push('', datesTooltip);
        const tooltip = tooltipLines.join('\n');

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

    // Reveals the file by selecting its folder in navigation pane and showing the file in list pane
    const revealFileInNavigation = () => {
        runAsyncAction(async () => {
            await plugin.activateView();
            await plugin.revealFileInActualFolder(file);
        });
    };

    // Quick action handlers - these don't need memoization because:
    // 1. They're only attached to DOM elements that appear on hover
    // 2. They're not passed as props to child components
    // 3. They don't cause re-renders when recreated
    const handleOpenInNewTab = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        runAsyncAction(() => openFileInContext({ app, commandQueue, file, context: 'tab' }));
    };

    // Toggle pin status for the file in the current context
    const handlePinClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        runAsyncAction(async () => {
            const context = selectionType === ItemType.TAG ? ItemType.TAG : ItemType.FOLDER;
            await metadataService.togglePin(file.path, context);
        });
    };

    const handleShortcutToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        runAsyncAction(async () => {
            const shortcutKey = noteShortcutKeysByPath.get(file.path);
            if (shortcutKey) {
                await removeShortcut(shortcutKey);
            } else {
                await addNoteShortcut(file.path);
            }
        });
    };

    // Reveal the file in its actual folder in the navigator
    const handleRevealClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        revealFileInNavigation();
    };

    const handleAddTagClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (!tagOperations) {
            return;
        }

        openAddTagToFilesModal({
            app,
            plugin,
            tagOperations,
            files: [file]
        });
    };

    // Handle middle mouse button click to open in new tab
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 1) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        runAsyncAction(() => openFileInContext({ app, commandQueue, file, context: 'tab' }));
    };

    const quickActionItems: { key: string; element: React.ReactNode }[] = [];

    if (shouldShowRevealIcon) {
        quickActionItems.push({
            key: 'reveal',
            element: (
                <div
                    ref={revealInFolderIconRef}
                    className="nn-quick-action-item"
                    onClick={handleRevealClick}
                    title={strings.contextMenu.file.revealInFolder}
                />
            )
        });
    }

    if (shouldShowAddTagAction) {
        quickActionItems.push({
            key: 'add-tag',
            element: (
                <div
                    ref={addTagIconRef}
                    className="nn-quick-action-item"
                    onClick={handleAddTagClick}
                    title={strings.contextMenu.file.addTag}
                />
            )
        });
    }

    if (shouldShowShortcutAction) {
        quickActionItems.push({
            key: 'shortcut',
            element: (
                <div
                    ref={addShortcutIconRef}
                    className="nn-quick-action-item"
                    onClick={handleShortcutToggle}
                    title={hasShortcut ? strings.shortcuts.remove : strings.shortcuts.add}
                />
            )
        });
    }

    if (shouldShowPinNote) {
        quickActionItems.push({
            key: 'pin',
            element: (
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
            )
        });
    }

    if (shouldShowOpenInNewTab) {
        quickActionItems.push({
            key: 'new-tab',
            element: (
                <div
                    ref={openInNewTabIconRef}
                    className="nn-quick-action-item"
                    onClick={handleOpenInNewTab}
                    title={strings.contextMenu.file.openInNewTab}
                />
            )
        });
    }

    // === Effects ===

    // Renders the file icon in the DOM using the icon service
    useEffect(() => {
        const iconContainer = fileIconRef.current;
        if (!iconContainer) {
            return;
        }

        iconContainer.innerHTML = '';
        if (!shouldShowFileIcon) {
            return;
        }

        const iconId = effectiveFileIconId;
        if (!iconId) {
            return;
        }
        const iconService = getIconService();
        iconService.renderIcon(iconContainer, iconId);
    }, [effectiveFileIconId, iconServiceVersion, shouldShowFileIcon, isSlimMode]);

    // Render external file indicator icon (shown next to filename in non-slim mode)
    useEffect(() => {
        const indicator = fileExternalIconRef.current;
        if (!indicator) {
            return;
        }

        indicator.innerHTML = '';
        if (isSlimMode || !isExternalFile) {
            return;
        }

        setIcon(indicator, 'lucide-external-link');
    }, [iconServiceVersion, isExternalFile, isSlimMode]);

    // Render file type icon in slim mode (canvas, base, or external file indicator)
    useEffect(() => {
        const indicator = slimModeIconRef.current;
        if (!indicator) {
            return;
        }

        indicator.innerHTML = '';
        if (!isSlimMode || !slimModeTypeIconId) {
            return;
        }

        setIcon(indicator, slimModeTypeIconId);
    }, [iconServiceVersion, isSlimMode, slimModeTypeIconId]);

    // Set up the icons when quick actions panel is shown
    useEffect(() => {
        if (isHovered && !isMobile) {
            if (revealInFolderIconRef.current && shouldShowRevealIcon) {
                setIcon(revealInFolderIconRef.current, 'lucide-folder-search');
            }
            if (addTagIconRef.current && shouldShowAddTagAction) {
                setIcon(addTagIconRef.current, 'lucide-tag');
            }
            if (addShortcutIconRef.current && shouldShowShortcutAction) {
                setIcon(addShortcutIconRef.current, hasShortcut ? 'lucide-bookmark-x' : 'lucide-bookmark');
            }
            if (pinNoteIconRef.current && shouldShowPinNote) {
                setIcon(pinNoteIconRef.current, isPinned ? 'lucide-pin-off' : 'lucide-pin');
            }
            if (openInNewTabIconRef.current && shouldShowOpenInNewTab) {
                setIcon(openInNewTabIconRef.current, 'lucide-file-plus');
            }
        }
    }, [
        isHovered,
        isMobile,
        shouldShowOpenInNewTab,
        shouldShowPinNote,
        shouldShowRevealIcon,
        shouldShowAddTagAction,
        shouldShowShortcutAction,
        hasShortcut,
        isPinned
    ]);

    // Enable context menu
    useContextMenu(fileRef, { type: ItemType.FILE, item: file });

    // Wrap onFileClick to pass file and fileIndex
    const handleItemClick = useCallback(
        (event: React.MouseEvent) => {
            onFileClick(file, fileIndex, event);
        },
        [file, fileIndex, onFileClick]
    );

    return (
        <div
            ref={fileRef}
            className={className}
            data-path={file.path}
            // Path to use when this file is dragged
            data-drag-path={file.path}
            // Type of item being dragged (folder, file, or tag)
            data-drag-type="file"
            // Marks element as draggable for event delegation
            data-draggable={!isMobile ? 'true' : undefined}
            // Icon to display in drag ghost
            data-drag-icon={dragIconId}
            // Icon color to display in drag ghost
            data-drag-icon-color={fileColor || undefined}
            onClick={handleItemClick}
            onMouseDown={handleMouseDown}
            draggable={!isMobile}
            role="listitem"
            onMouseEnter={() => !isMobile && setIsHovered(true)}
            onMouseLeave={() => !isMobile && setIsHovered(false)}
            aria-describedby={hiddenDescription ? hiddenDescriptionId : undefined}
        >
            <div className="nn-file-content">
                {/* Quick actions panel - appears on hover */}
                {isHovered && !isMobile && hasQuickActions && (
                    <div
                        className={`nn-quick-actions-panel ${isSlimMode ? 'nn-slim-mode' : ''}`}
                        data-title-rows={appearanceSettings.titleRows}
                        data-has-tags={shouldShowFileTags ? 'true' : 'false'}
                    >
                        {quickActionItems.map((action, index) => (
                            <React.Fragment key={action.key}>
                                {index > 0 && <div className="nn-quick-action-separator" />}
                                {action.element}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                <div className="nn-file-inner-content">
                    {isSlimMode ? (
                        // ========== SLIM MODE ==========
                        // Minimal layout: only file name + tags
                        // Used when date, preview, and image are all disabled
                        <div className="nn-slim-file-text-content">
                            <div className="nn-slim-file-header">
                                {fileTitleElement}
                                {slimModeTypeIconId ? (
                                    <span
                                        ref={slimModeIconRef}
                                        className="nn-file-icon nn-slim-file-type-icon"
                                        aria-hidden="true"
                                        data-has-color="false"
                                    />
                                ) : null}
                            </div>
                            {renderTags()}
                        </div>
                    ) : (
                        // ========== NORMAL MODE ==========
                        // Full layout with all enabled elements
                        <>
                            <div className="nn-file-text-content">
                                {fileTitleElement}

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
                                                    {highlightedPreview}
                                                </div>
                                            )}
                                        </div>

                                        {/* Tags */}
                                        {renderTags()}

                                        {/* Parent folder - gets its own line */}
                                        {renderParentFolder()}
                                    </>
                                )}

                                {/* ========== MULTI-LINE MODE ========== */}
                                {/* Conditions: !pinnedItemShouldUseCompactLayout AND previewRows >= 2 */}
                                {/* Two sub-cases based on preview content and optimization settings */}
                                {shouldUseMultiLinePreviewLayout && (
                                    <>
                                        {/* CASE 1: COLLAPSED EMPTY PREVIEW */}
                                        {/* Conditions: heightOptimizationEnabled AND !hasPreviewContent */}
                                        {/* Layout: Tags first, then Date+Parent on same line (compact) */}
                                        {shouldCollapseEmptyPreviewSpace && (
                                            <>
                                                {/* Tags (show even when no preview text) */}
                                                {renderTags()}
                                                {/* Date + Parent folder share the second line (compact layout) */}
                                                <div className="nn-file-second-line">
                                                    {settings.showFileDate && <div className="nn-file-date">{displayDate}</div>}
                                                    {renderParentFolder()}
                                                </div>
                                            </>
                                        )}

                                        {/* CASE 2: ALWAYS RESERVE PREVIEW SPACE */}
                                        {/* Conditions: heightOptimizationDisabled OR hasPreviewContent */}
                                        {/* Layout: Full preview rows, tags, then Date+Parent on same line */}
                                        {shouldAlwaysReservePreviewSpace && (
                                            <>
                                                {/* Multi-row preview - show preview text spanning multiple rows */}
                                                {settings.showFilePreview && (
                                                    <div
                                                        className="nn-file-preview"
                                                        style={{ '--preview-rows': appearanceSettings.previewRows } as React.CSSProperties}
                                                    >
                                                        {highlightedPreview}
                                                    </div>
                                                )}

                                                {/* Tags row */}
                                                {renderTags()}

                                                {/* Date + Parent folder share the metadata line */}
                                                <div className="nn-file-second-line">
                                                    {settings.showFileDate && <div className="nn-file-date">{displayDate}</div>}
                                                    {renderParentFolder()}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                            {/* ========== FEATURE IMAGE AREA ========== */}
                            {/* Shows either actual image or extension badge for non-markdown files */}
                            {shouldShowFeatureImageArea && (
                                <div className={featureImageContainerClassName} style={featureImageStyle}>
                                    {featureImageUrl ? (
                                        <img
                                            src={featureImageUrl}
                                            alt={strings.common.featureImageAlt}
                                            className="nn-feature-image-img"
                                            draggable={false}
                                            onDragStart={e => e.preventDefault()}
                                            // Hide the image container when image fails to load
                                            onError={() => {
                                                setIsFeatureImageHidden(true);
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
            {/* Screen reader announcement for hidden files */}
            {hiddenDescription ? (
                <span id={hiddenDescriptionId} className="nn-visually-hidden">
                    {hiddenDescription}
                </span>
            ) : null}
        </div>
    );
});
