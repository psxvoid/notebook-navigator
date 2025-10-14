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
 * useNavigationPaneData - Manages navigation tree data for the NavigationPane component
 *
 * This hook handles:
 * - Building folder tree from vault structure
 * - Building tag tree with virtual folders
 * - Combining and ordering navigation items
 * - Computing folder and tag counts
 * - Creating efficient lookup maps
 * - Listening to vault changes
 * - Managing tag contexts (favorites vs all tags)
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { TFile, TFolder, debounce } from 'obsidian';
import type { MetadataCache } from 'obsidian';
import { useServices, useMetadataService } from '../context/ServicesContext';
import { useRecentData } from '../context/RecentDataContext';
import { useExpansionState } from '../context/ExpansionContext';
import { useFileCache } from '../context/StorageContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { strings } from '../i18n';
import {
    UNTAGGED_TAG_ID,
    NavigationPaneItemType,
    VirtualFolder,
    ItemType,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    RECENT_NOTES_VIRTUAL_FOLDER_ID
} from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { TagTreeNode } from '../types/storage';
import type { CombinedNavigationItem } from '../types/virtualization';
import type { NotebookNavigatorSettings, TagSortOrder } from '../settings/types';
import { shouldExcludeFile, shouldExcludeFolder, isFolderInExcludedFolder } from '../utils/fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY, isImageFile } from '../utils/fileTypeUtils';
// Use Obsidian's trailing debounce for vault-driven updates
import { getTotalNoteCount, excludeFromTagTree } from '../utils/tagTree';
import { flattenFolderTree, flattenTagTree } from '../utils/treeFlattener';
import { createHiddenTagMatcher } from '../utils/tagPrefixMatcher';
import { setNavigationIndex } from '../utils/navigationIndex';
import { isFolderShortcut, isNoteShortcut, isSearchShortcut, isTagShortcut } from '../types/shortcuts';
import { useRootFolderOrder } from './useRootFolderOrder';
import { isFolderNote, type FolderNoteDetectionSettings } from '../utils/folderNotes';
import { getDBInstance } from '../storage/fileOperations';
import { naturalCompare } from '../utils/sortUtils';

// Checks if a navigation item is a shortcut-related item (virtual folder, shortcut, or header)
const isShortcutNavigationItem = (item: CombinedNavigationItem): boolean => {
    if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER) {
        return item.data.id === SHORTCUTS_VIRTUAL_FOLDER_ID;
    }

    return (
        item.type === NavigationPaneItemType.SHORTCUT_FOLDER ||
        item.type === NavigationPaneItemType.SHORTCUT_NOTE ||
        item.type === NavigationPaneItemType.SHORTCUT_SEARCH ||
        item.type === NavigationPaneItemType.SHORTCUT_TAG ||
        item.type === NavigationPaneItemType.SHORTCUT_HEADER
    );
};

// Maps non-markdown document extensions to their icon names
const DOCUMENT_EXTENSION_ICONS: Record<string, string> = {
    canvas: 'lucide-layout-grid',
    base: 'lucide-database'
};

const EXCALIDRAW_FILE_SUFFIX = '.excalidraw.md';

// Returns the appropriate icon for a document based on its type and extension
const getDocumentIcon = (file: TFile | null, metadataCache?: MetadataCache): string | undefined => {
    if (!file) {
        return undefined;
    }

    if (isImageFile(file)) {
        return 'lucide-image';
    }

    const lowerCaseName = file.name.toLowerCase();
    if (lowerCaseName.endsWith(EXCALIDRAW_FILE_SUFFIX)) {
        return 'lucide-image';
    }

    if (metadataCache) {
        const frontmatter = metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.['excalidraw-plugin']) {
            return 'lucide-image';
        }
    }

    const extension = file.extension.toLowerCase();
    return DOCUMENT_EXTENSION_ICONS[extension] ?? undefined;
};

/** Comparator function type for sorting tag tree nodes */
type TagComparator = (a: TagTreeNode, b: TagTreeNode) => number;

/** Compares tags alphabetically by name with fallback to path */
const compareTagAlphabetically: TagComparator = (a, b) => {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return a.path.localeCompare(b.path);
};

// Creates comparator for tag sorting modes. Returns undefined for default alphabetical ascending order.
const createTagComparator = (order: TagSortOrder, includeDescendantNotes: boolean): TagComparator | undefined => {
    if (order === 'alpha-asc') {
        return undefined;
    }

    if (order === 'alpha-desc') {
        return (a, b) => -compareTagAlphabetically(a, b);
    }

    /** Gets note count for a tag based on descendant inclusion setting */
    const getCount = includeDescendantNotes
        ? (node: TagTreeNode) => getTotalNoteCount(node)
        : (node: TagTreeNode) => node.notesWithTag.size;

    /** Compares tags by frequency (note count) with alphabetical fallback */
    const compareByFrequency: TagComparator = (a, b) => {
        const diff = getCount(a) - getCount(b);
        if (diff !== 0) {
            return diff;
        }
        return compareTagAlphabetically(a, b);
    };

    if (order === 'frequency-asc') {
        return compareByFrequency;
    }

    return (a, b) => -compareByFrequency(a, b);
};

/**
 * Parameters for the useNavigationPaneData hook
 */
interface UseNavigationPaneDataParams {
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Whether the navigation pane is currently visible */
    isVisible: boolean;
    /** Whether the shortcuts virtual folder is expanded */
    shortcutsExpanded: boolean;
    /** Whether the recent notes virtual folder is expanded */
    recentNotesExpanded: boolean;
    /** Whether shortcuts should be pinned at the top of the pane */
    pinShortcuts: boolean;
}

/**
 * Return value of the useNavigationPaneData hook
 */
interface UseNavigationPaneDataResult {
    /** Combined list of navigation items (folders and tags) */
    items: CombinedNavigationItem[];
    /** Shortcuts rendered separately when pinShortcuts is enabled */
    shortcutItems: CombinedNavigationItem[];
    /** Map from item keys to index in items array */
    pathToIndex: Map<string, number>;
    /** Map from shortcut id to index */
    shortcutIndex: Map<string, number>;
    /** Map from tag path to file count */
    tagCounts: Map<string, number>;
    /** Map from folder path to file count */
    folderCounts: Map<string, number>;
    /** Ordered list of root-level folders */
    rootLevelFolders: TFolder[];
}

/**
 * Hook that manages navigation tree data for the NavigationPane component.
 * Handles folder and tag tree building, counts, and vault change monitoring.
 *
 * @param params - Configuration parameters
 * @returns Navigation items and lookup maps
 */
export function useNavigationPaneData({
    settings,
    isVisible,
    shortcutsExpanded,
    recentNotesExpanded,
    pinShortcuts
}: UseNavigationPaneDataParams): UseNavigationPaneDataResult {
    const { app } = useServices();
    const { recentNotes } = useRecentData();
    const metadataService = useMetadataService();
    const expansionState = useExpansionState();
    const { fileData } = useFileCache();
    const { hydratedShortcuts } = useShortcuts();

    // Version counter that increments when vault files change
    const [fileChangeVersion, setFileChangeVersion] = useState(0);
    // Increments version counter to trigger dependent recalculations
    const handleRootFileChange = useCallback(() => {
        setFileChangeVersion(value => value + 1);
    }, []);
    // Get ordered root folders and notify on file changes
    const { rootFolders, rootLevelFolders, rootFolderOrderMap } = useRootFolderOrder({
        settings,
        onFileChange: handleRootFileChange
    });

    // Extract tag tree data from file cache
    const favoriteTree = fileData.favoriteTree;
    const tagTree = fileData.tagTree;
    const untaggedCount = fileData.untagged;

    // Create matcher for hidden tag patterns (supports "archive", "temp*", "*draft")
    const hiddenTagMatcher = useMemo(() => createHiddenTagMatcher(settings.hiddenTags), [settings.hiddenTags]);
    // Determine if any hidden tag rules are configured
    const hiddenMatcherHasRules =
        hiddenTagMatcher.prefixes.length > 0 || hiddenTagMatcher.startsWithNames.length > 0 || hiddenTagMatcher.endsWithNames.length > 0;

    /** Create tag comparator based on current sort order and descendant note settings */
    const tagComparator = useMemo(
        () => createTagComparator(settings.tagSortOrder, settings.includeDescendantNotes),
        [settings.tagSortOrder, settings.includeDescendantNotes]
    );

    /**
     * Build folder items from vault structure
     */
    const folderItems = useMemo(() => {
        return flattenFolderTree(rootFolders, expansionState.expandedFolders, settings.excludedFolders, 0, new Set(), {
            rootOrderMap: rootFolderOrderMap
        });
    }, [rootFolders, expansionState.expandedFolders, settings.excludedFolders, rootFolderOrderMap]);

    /**
     * Build tag items with virtual folders and organization
     */
    const tagItems = useMemo(() => {
        const items: CombinedNavigationItem[] = [];

        if (!settings.showTags) return items;

        // Get list of configured favorite tag patterns
        const favoritePatterns = settings.favoriteTags;

        // Adds an untagged notes node at the specified level and context
        const addUntaggedNode = (level: number, context?: 'favorites' | 'tags') => {
            if (settings.showUntagged && untaggedCount > 0) {
                const untaggedNode: TagTreeNode = {
                    path: UNTAGGED_TAG_ID,
                    displayPath: UNTAGGED_TAG_ID,
                    name: strings.tagList.untaggedLabel,
                    children: new Map(),
                    notesWithTag: new Set()
                };

                items.push({
                    type: NavigationPaneItemType.UNTAGGED,
                    data: untaggedNode,
                    key: UNTAGGED_TAG_ID,
                    level,
                    context
                });
            }
        };

        // Creates and adds a virtual folder item to the navigation tree
        const addVirtualFolder = (id: string, name: string, icon?: string) => {
            const folder: VirtualFolder = { id, name, icon };
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: folder,
                level: 0,
                key: id
            });
        };

        // Filter out hidden tags when showHiddenItems is false
        const shouldHideTags = !settings.showHiddenItems;
        const hasHiddenPatterns = hiddenMatcherHasRules;
        const visibleFavoriteTree = hasHiddenPatterns && shouldHideTags ? excludeFromTagTree(favoriteTree, hiddenTagMatcher) : favoriteTree;
        const visibleTagTree = hasHiddenPatterns && shouldHideTags ? excludeFromTagTree(tagTree, hiddenTagMatcher) : tagTree;

        // When showing all tags, pass matcher to mark hidden ones with eye icon
        const matcherForMarking = !shouldHideTags && hasHiddenPatterns ? hiddenTagMatcher : undefined;

        // Flattens and adds tag items under a virtual folder
        const addTagItems = (tags: Map<string, TagTreeNode>, folderId: string) => {
            if (expansionState.expandedVirtualFolders.has(folderId)) {
                const tagItems = flattenTagTree(
                    Array.from(tags.values()),
                    expansionState.expandedTags,
                    1, // Start at level 1 since they're inside the virtual folder
                    {
                        context: folderId === 'favorite-tags-root' ? 'favorites' : 'tags',
                        hiddenMatcher: matcherForMarking,
                        comparator: tagComparator
                    }
                );
                items.push(...tagItems);

                // Add untagged node to favorites folder if enabled
                if (folderId === 'favorite-tags-root' && settings.showUntaggedInFavorites) {
                    addUntaggedNode(1, 'favorites');
                }

                // Add untagged node if this is the last tag container
                const isLastContainer = favoritePatterns.length === 0 || folderId === 'all-tags-root';
                // If no favorites exist, always show untagged in Tags regardless of showUntaggedInFavorites
                const shouldShowUntagged = favoritePatterns.length === 0 || !settings.showUntaggedInFavorites;
                if (isLastContainer && shouldShowUntagged) {
                    addUntaggedNode(1, 'tags');
                }
            }
        };

        // Organize tags into favorites and non-favorites sections
        if (favoritePatterns.length > 0) {
            // Determine if favorites section has any content
            const hasVisibleFavoriteTags = visibleFavoriteTree.size > 0;
            const hasFavoriteUntagged = settings.showUntagged && settings.showUntaggedInFavorites && untaggedCount > 0;

            if (settings.showFavoriteTagsFolder) {
                // Only render the favorites folder when it has content
                if (hasVisibleFavoriteTags || hasFavoriteUntagged) {
                    addVirtualFolder('favorite-tags-root', strings.tagList.favoriteTags, 'lucide-star');
                    addTagItems(visibleFavoriteTree, 'favorite-tags-root');
                }
            } else {
                // Show favorite tags directly without folder
                if (hasVisibleFavoriteTags) {
                    const favoriteItems = flattenTagTree(
                        Array.from(visibleFavoriteTree.values()),
                        expansionState.expandedTags,
                        0, // Start at level 0 since no virtual folder
                        {
                            context: 'favorites',
                            hiddenMatcher: matcherForMarking,
                            comparator: tagComparator
                        }
                    );
                    items.push(...favoriteItems);
                }

                // Add untagged after favorite tags when folder isn't shown
                if (settings.showUntaggedInFavorites && hasFavoriteUntagged) {
                    addUntaggedNode(0, 'favorites');
                }
            }

            if (settings.showAllTagsFolder) {
                // Show "Tags" folder
                addVirtualFolder('all-tags-root', strings.tagList.allTags, 'lucide-tags');
                addTagItems(visibleTagTree, 'all-tags-root');
            } else {
                // Show non-favorite tags directly without folder
                const nonFavoriteItems = flattenTagTree(
                    Array.from(visibleTagTree.values()),
                    expansionState.expandedTags,
                    0, // Start at level 0 since no virtual folder
                    {
                        context: 'tags',
                        hiddenMatcher: matcherForMarking,
                        comparator: tagComparator
                    }
                );
                items.push(...nonFavoriteItems);

                // Add untagged node at the end when not using folder and not in favorites
                if (!settings.showUntaggedInFavorites) {
                    addUntaggedNode(0, 'tags');
                }
            }
        } else {
            // No favorites configured
            if (settings.showAllTagsFolder) {
                // Show "Tags" folder
                addVirtualFolder('tags-root', strings.tagList.tags, 'lucide-tags');
                addTagItems(visibleTagTree, 'tags-root');
            } else {
                // Show all tags directly without folder
                const tagTreeItems = flattenTagTree(
                    Array.from(visibleTagTree.values()),
                    expansionState.expandedTags,
                    0, // Start at level 0 since no virtual folder
                    {
                        context: 'tags',
                        hiddenMatcher: matcherForMarking,
                        comparator: tagComparator
                    }
                );
                items.push(...tagTreeItems);

                // Add untagged node at the end
                addUntaggedNode(0, 'tags');
            }
        }

        return items;
    }, [
        settings.showTags,
        settings.favoriteTags,
        hiddenTagMatcher,
        hiddenMatcherHasRules,
        settings.showHiddenItems,
        settings.showUntagged,
        settings.showUntaggedInFavorites,
        settings.showFavoriteTagsFolder,
        settings.showAllTagsFolder,
        favoriteTree,
        tagTree,
        untaggedCount,
        expansionState.expandedTags,
        expansionState.expandedVirtualFolders,
        tagComparator
    ]);

    /**
     * Pre-compute parsed excluded folders to avoid repeated parsing
     */
    const parsedExcludedFolders = useMemo(() => settings.excludedFolders, [settings.excludedFolders]);

    // Build list of shortcut items with proper hierarchy
    const shortcutItems = useMemo(() => {
        if (!settings.showShortcuts) {
            return [] as CombinedNavigationItem[];
        }

        const headerLevel = 0;
        const itemLevel = headerLevel + 1;

        // Start with the shortcuts header/virtual folder
        const items: CombinedNavigationItem[] = [
            {
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                key: SHORTCUTS_VIRTUAL_FOLDER_ID,
                level: headerLevel,
                data: {
                    id: SHORTCUTS_VIRTUAL_FOLDER_ID,
                    name: strings.navigationPane.shortcutsHeader,
                    icon: 'lucide-bookmark'
                }
            }
        ];

        // Return only header if shortcuts folder is collapsed
        if (!shortcutsExpanded) {
            return items;
        }

        // Add individual shortcut items based on their type
        hydratedShortcuts.forEach(entry => {
            const { key, shortcut, folder, note, search, tagPath } = entry;

            // Handle folder shortcuts
            if (isFolderShortcut(shortcut)) {
                if (!folder) {
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_FOLDER,
                        key,
                        level: itemLevel,
                        shortcut,
                        folder: null,
                        isMissing: true,
                        missingLabel: shortcut.path
                    });
                    return;
                }

                const isExcluded = settings.excludedFolders.length > 0 && isFolderInExcludedFolder(folder, settings.excludedFolders);
                if (isExcluded && !settings.showHiddenItems) {
                    return;
                }

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_FOLDER,
                    key,
                    level: itemLevel,
                    shortcut,
                    folder,
                    isExcluded
                });
                return;
            }

            // Handle note shortcuts
            if (isNoteShortcut(shortcut)) {
                if (!note) {
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_NOTE,
                        key,
                        level: itemLevel,
                        shortcut,
                        note: null,
                        isMissing: true,
                        missingLabel: shortcut.path
                    });
                    return;
                }
                const isExternalFile = !shouldDisplayFile(note, FILE_VISIBILITY.SUPPORTED, app);
                const icon = isExternalFile ? 'lucide-external-link' : getDocumentIcon(note, app.metadataCache);
                items.push({
                    type: NavigationPaneItemType.SHORTCUT_NOTE,
                    key,
                    level: itemLevel,
                    shortcut,
                    note,
                    icon
                });
                return;
            }

            // Handle search shortcuts
            if (isSearchShortcut(shortcut)) {
                items.push({
                    type: NavigationPaneItemType.SHORTCUT_SEARCH,
                    key,
                    level: itemLevel,
                    shortcut,
                    searchShortcut: search ?? shortcut
                });
                return;
            }

            // Handle tag shortcuts
            if (isTagShortcut(shortcut)) {
                const resolvedPath = tagPath ?? shortcut.tagPath;
                if (!resolvedPath) {
                    return;
                }

                // Determine display name and context for tag shortcuts
                const tagNode = favoriteTree.get(resolvedPath) ?? tagTree.get(resolvedPath);
                const displayPath = tagNode?.displayPath ?? resolvedPath;
                const context = tagNode ? (favoriteTree.has(resolvedPath) ? ('favorites' as const) : ('tags' as const)) : undefined;
                const isMissing = !tagNode;

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_TAG,
                    key,
                    level: itemLevel,
                    shortcut,
                    tagPath: resolvedPath,
                    displayName: displayPath,
                    context,
                    isMissing,
                    missingLabel: isMissing ? resolvedPath : undefined
                });
            }
        });

        return items;
    }, [
        app,
        hydratedShortcuts,
        favoriteTree,
        tagTree,
        settings.excludedFolders,
        settings.showHiddenItems,
        settings.showShortcuts,
        shortcutsExpanded
    ]);

    // Build list of recent notes items with proper hierarchy
    const recentNotesItems = useMemo(() => {
        if (!settings.showRecentNotes) {
            return [] as CombinedNavigationItem[];
        }

        const headerLevel = 0;
        const itemLevel = headerLevel + 1;

        // Use appropriate header based on file visibility setting
        const recentHeaderName =
            settings.fileVisibility === FILE_VISIBILITY.DOCUMENTS
                ? strings.navigationPane.recentNotesHeader
                : strings.navigationPane.recentFilesHeader;

        // Start with the recent notes header/virtual folder
        const items: CombinedNavigationItem[] = [
            {
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                key: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                level: headerLevel,
                data: {
                    id: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                    name: recentHeaderName,
                    icon: 'lucide-history'
                }
            }
        ];

        // Return only header if recent notes folder is collapsed
        if (!recentNotesExpanded) {
            return items;
        }

        // Add recent note items up to the configured limit
        const limit = Math.max(1, settings.recentNotesCount ?? 1);
        const recentPaths = recentNotes.slice(0, limit);

        recentPaths.forEach(path => {
            const file = app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                const isExternalFile = !shouldDisplayFile(file, FILE_VISIBILITY.SUPPORTED, app);
                const icon = isExternalFile ? 'lucide-external-link' : getDocumentIcon(file, app.metadataCache);
                items.push({
                    type: NavigationPaneItemType.RECENT_NOTE,
                    key: `recent-${path}`,
                    level: itemLevel,
                    note: file,
                    icon
                });
            }
        });

        return items;
    }, [app, settings.showRecentNotes, recentNotes, settings.recentNotesCount, settings.fileVisibility, recentNotesExpanded]);

    /**
     * Combine shortcut, folder, and tag items based on display order settings
     */
    // Combine all navigation items in the correct order with spacers
    const items = useMemo(() => {
        const allItems: CombinedNavigationItem[] = [];

        // Path to the banner file configured in settings
        const bannerPath = settings.navigationBanner;
        // Banner appears in main list when not pinning shortcuts or when shortcuts list is empty
        const shouldIncludeBannerInMainList = Boolean(bannerPath && (!pinShortcuts || shortcutItems.length === 0));

        if (shouldIncludeBannerInMainList && bannerPath) {
            allItems.push({
                type: NavigationPaneItemType.TOP_SPACER,
                key: 'banner-top-spacer'
            });
            allItems.push({
                type: NavigationPaneItemType.BANNER,
                key: `banner-${bannerPath}`,
                path: bannerPath
            });
        }

        // Add top spacer for visual separation between pinned content and tree items
        allItems.push({
            type: NavigationPaneItemType.TOP_SPACER,
            key: 'top-spacer'
        });

        const sections: CombinedNavigationItem[][] = [];

        if (shortcutItems.length > 0) {
            sections.push(shortcutItems);
        }

        if (recentNotesItems.length > 0) {
            sections.push(recentNotesItems);
        }

        const mainSection: CombinedNavigationItem[] = [];

        if (settings.showTags && settings.showTagsAboveFolders) {
            mainSection.push(...tagItems);
            if (folderItems.length > 0 && tagItems.length > 0) {
                mainSection.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: 'tags-folders-spacer'
                });
            }
            mainSection.push(...folderItems);
        } else {
            mainSection.push(...folderItems);
            if (settings.showTags && tagItems.length > 0) {
                mainSection.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: 'folders-tags-spacer'
                });
                mainSection.push(...tagItems);
            }
        }

        if (mainSection.length > 0) {
            sections.push(mainSection);
        }

        sections.forEach((section, index) => {
            allItems.push(...section);
            if (index < sections.length - 1) {
                allItems.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: `section-spacer-${index}`
                });
            }
        });

        allItems.push({
            type: NavigationPaneItemType.BOTTOM_SPACER,
            key: 'bottom-spacer'
        });

        return allItems;
    }, [
        folderItems,
        tagItems,
        shortcutItems,
        recentNotesItems,
        settings.showTags,
        settings.showTagsAboveFolders,
        settings.navigationBanner,
        pinShortcuts
    ]);

    /**
     * Create a stable version key for metadata objects that gets updated when they're mutated
     * This is needed because the settings objects are mutated in place when colors/icons change
     * We depend on the entire settings object to ensure this recalculates when settings update
     */
    // Track frontmatter metadata changes separately since they're stored in IndexedDB
    const [frontmatterMetadataVersion, setFrontmatterMetadataVersion] = useState(0);

    // Subscribe to IndexedDB content changes to detect frontmatter metadata updates
    useEffect(() => {
        const db = getDBInstance();
        const unsubscribe = db.onContentChange(changes => {
            const hasMetadataChange = changes.some(change => change.changeType === 'metadata' || change.changeType === 'both');
            if (hasMetadataChange) {
                setFrontmatterMetadataVersion(version => version + 1);
            }
        });
        return unsubscribe;
    }, []);

    const metadataVersion = useMemo(() => {
        // Create a version string that will change when any metadata is added/removed/changed
        // We use JSON.stringify to detect any changes in the objects
        const settingsSignature = JSON.stringify({
            folderColors: settings.folderColors || {},
            folderBackgroundColors: settings.folderBackgroundColors || {},
            tagColors: settings.tagColors || {},
            tagBackgroundColors: settings.tagBackgroundColors || {},
            folderIcons: settings.folderIcons || {},
            tagIcons: settings.tagIcons || {},
            fileIcons: settings.fileIcons || {},
            fileColors: settings.fileColors || {},
            inheritFolderColors: settings.inheritFolderColors
        });
        return `${settingsSignature}::${frontmatterMetadataVersion}`;
    }, [settings, frontmatterMetadataVersion]); // Depend on entire settings object to catch mutations

    /**
     * Add metadata (colors, icons) and excluded folders to items
     * This pre-computation avoids calling these functions during render
     */
    const itemsWithMetadata = useMemo(() => {
        return items.map(item => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                return {
                    ...item,
                    color: metadataService.getFolderColor(item.data.path),
                    backgroundColor: metadataService.getFolderBackgroundColor(item.data.path),
                    icon: metadataService.getFolderIcon(item.data.path),
                    parsedExcludedFolders
                };
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                return {
                    ...item,
                    color: metadataService.getTagColor(tagNode.path),
                    backgroundColor: metadataService.getTagBackgroundColor(tagNode.path),
                    icon: metadataService.getTagIcon(tagNode.path)
                };
            } else if (item.type === NavigationPaneItemType.SHORTCUT_FOLDER) {
                // Apply custom folder icon to shortcut if available
                const folderPath = item.folder?.path;
                const folderColor = folderPath ? metadataService.getFolderColor(folderPath) : undefined;
                return {
                    ...item,
                    icon: (folderPath && metadataService.getFolderIcon(folderPath)) || 'lucide-folder',
                    color: folderColor
                };
            } else if (item.type === NavigationPaneItemType.SHORTCUT_TAG) {
                // Apply custom tag icon to shortcut if available
                const tagColor = metadataService.getTagColor(item.tagPath);
                return {
                    ...item,
                    icon: metadataService.getTagIcon(item.tagPath) || 'lucide-tags',
                    color: tagColor
                };
            } else if (item.type === NavigationPaneItemType.SHORTCUT_NOTE) {
                const note = item.note;
                if (!note) {
                    return item;
                }
                const customIcon = metadataService.getFileIcon(note.path);
                const color = metadataService.getFileColor(note.path);
                return {
                    ...item,
                    icon: customIcon ?? item.icon,
                    color
                };
            } else if (item.type === NavigationPaneItemType.RECENT_NOTE) {
                const customIcon = metadataService.getFileIcon(item.note.path);
                const color = metadataService.getFileColor(item.note.path);
                return {
                    ...item,
                    icon: customIcon ?? item.icon,
                    color
                };
            }
            return item;
        });
        // NOTE TO REVIEWER: Including **metadataVersion** to detect settings mutations
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, parsedExcludedFolders, metadataService, metadataVersion]);

    // Extract shortcut items when pinning is enabled for display in pinned area
    const shortcutItemsWithMetadata = useMemo(() => {
        if (!pinShortcuts) {
            return [] as CombinedNavigationItem[];
        }

        return itemsWithMetadata.filter(isShortcutNavigationItem);
    }, [itemsWithMetadata, pinShortcuts]);

    /**
     * Filter items based on showHiddenItems setting
     * When showHiddenItems is false, filter out folders marked as excluded
     */
    const filteredItems = useMemo(() => {
        // When pinning shortcuts, exclude them from main tree (they're rendered separately)
        const baseItems = pinShortcuts ? itemsWithMetadata.filter(current => !isShortcutNavigationItem(current)) : itemsWithMetadata;

        if (settings.showHiddenItems) {
            // Show all items including excluded ones
            return baseItems;
        }

        return baseItems.filter(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.isExcluded) {
                return false;
            }
            return true;
        });
    }, [itemsWithMetadata, settings.showHiddenItems, pinShortcuts]);

    /**
     * Create a map for O(1) item lookups by path
     * Build from filtered items so indices match what's displayed
     */
    const pathToIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        filteredItems.forEach((item, index) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                setNavigationIndex(indexMap, ItemType.FOLDER, item.data.path, index);
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                setNavigationIndex(indexMap, ItemType.TAG, tagNode.path, index);
            }
        });

        return indexMap;
    }, [filteredItems]);

    // Build index map for shortcuts to enable scrolling to specific shortcuts
    const shortcutIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        const source = pinShortcuts ? shortcutItemsWithMetadata : filteredItems;

        source.forEach((item, index) => {
            if (
                item.type === NavigationPaneItemType.SHORTCUT_FOLDER ||
                item.type === NavigationPaneItemType.SHORTCUT_NOTE ||
                item.type === NavigationPaneItemType.SHORTCUT_SEARCH ||
                item.type === NavigationPaneItemType.SHORTCUT_TAG
            ) {
                indexMap.set(item.key, index);
            }
        });

        return indexMap;
    }, [filteredItems, pinShortcuts, shortcutItemsWithMetadata]);

    /**
     * Pre-compute tag counts to avoid expensive calculations during render
     */
    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();

        // Skip computation if pane is not visible or not showing tags
        if (!isVisible || !settings.showTags) return counts;

        // Add untagged count
        if (settings.showUntagged) {
            counts.set(UNTAGGED_TAG_ID, untaggedCount);
        }

        // Compute counts for all tag items
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.TAG) {
                const tagNode = item.data;
                // Respect descendants setting for tags:
                // - When enabled: include notes from descendant tags
                // - When disabled: count only notes directly on the tag
                const count = settings.includeDescendantNotes ? getTotalNoteCount(tagNode) : tagNode.notesWithTag.size;
                counts.set(tagNode.path, count);
            }
        });

        return counts;
    }, [itemsWithMetadata, settings.showTags, settings.showUntagged, settings.includeDescendantNotes, untaggedCount, isVisible]);

    /**
     * Pre-compute folder file counts to avoid recursive counting during render
     */
    const folderCounts = useMemo(() => {
        const counts = new Map<string, number>();

        // Skip computation if pane is not visible or not showing note counts
        if (!isVisible || !settings.showNoteCount) return counts;

        const excludedProperties = settings.excludedFiles;
        const excludedFolderPatterns = settings.excludedFolders;
        const folderNoteSettings: FolderNoteDetectionSettings = {
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName
        };

        // Recursively counts files in a folder, respecting exclusion rules
        const countFiles = (folder: TFolder): number => {
            let count = 0;
            for (const child of folder.children) {
                if (child instanceof TFile) {
                    if (
                        folderNoteSettings.enableFolderNotes &&
                        settings.hideFolderNoteInList &&
                        isFolderNote(child, folder, folderNoteSettings)
                    ) {
                        continue;
                    }

                    if (shouldDisplayFile(child, settings.fileVisibility, app)) {
                        if (!shouldExcludeFile(child, excludedProperties, app)) {
                            count++;
                        }
                    }
                } else if (settings.includeDescendantNotes && child instanceof TFolder) {
                    // When showing hidden items, include files from excluded descendant folders
                    if (settings.showHiddenItems || !shouldExcludeFolder(child.name, excludedFolderPatterns, child.path)) {
                        count += countFiles(child);
                    }
                }
            }
            return count;
        };

        // Compute counts for all folder items
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.data instanceof TFolder) {
                counts.set(item.data.path, countFiles(item.data));
            }
        });

        return counts;
        // NOTE TO REVIEWER: Including **fileChangeVersion** to trigger recalculation when non-markdown files move
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        itemsWithMetadata,
        settings.showNoteCount,
        settings.includeDescendantNotes,
        settings.excludedFiles,
        settings.excludedFolders,
        settings.showHiddenItems,
        settings.fileVisibility,
        settings.enableFolderNotes,
        settings.folderNoteName,
        settings.hideFolderNoteInList,
        app,
        isVisible,
        fileChangeVersion
    ]);

    // Refresh folder counts when frontmatter changes (e.g., hide/unhide via frontmatter properties)
    useEffect(() => {
        const bumpCounts = debounce(
            () => {
                setFileChangeVersion(v => v + 1);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );

        const metaRef = app.metadataCache.on('changed', file => {
            if (file instanceof TFile) {
                bumpCounts();
            }
        });

        return () => {
            app.metadataCache.offref(metaRef);
            bumpCounts.cancel();
        };
    }, [app]);

    return {
        items: filteredItems,
        shortcutItems: shortcutItemsWithMetadata,
        pathToIndex,
        shortcutIndex,
        tagCounts,
        folderCounts,
        rootLevelFolders
    };
}
