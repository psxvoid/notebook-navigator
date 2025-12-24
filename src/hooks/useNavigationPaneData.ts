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
 * - Managing tag expansion state
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { TFile, TFolder, debounce } from 'obsidian';
import type { App } from 'obsidian';
import { useServices, useMetadataService } from '../context/ServicesContext';
import { useRecentData } from '../context/RecentDataContext';
import { useExpansionState } from '../context/ExpansionContext';
import { useFileCache } from '../context/StorageContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { strings } from '../i18n';
import {
    TAGGED_TAG_ID,
    UNTAGGED_TAG_ID,
    NavigationPaneItemType,
    VirtualFolder,
    ItemType,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    RECENT_NOTES_VIRTUAL_FOLDER_ID,
    NavigationSectionId
} from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { TagTreeNode } from '../types/storage';
import type { CombinedNavigationItem } from '../types/virtualization';
import type { NotebookNavigatorSettings, TagSortOrder } from '../settings/types';
import { createHiddenFileNameMatcherForVisibility, isFolderInExcludedFolder } from '../utils/fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY } from '../utils/fileTypeUtils';
import { resolveFileIconId, type FileNameIconNeedle } from '../utils/fileIconUtils';
// Use Obsidian's trailing debounce for vault-driven updates
import { getTotalNoteCount, excludeFromTagTree, findTagNode } from '../utils/tagTree';
import { flattenFolderTree, flattenTagTree, compareTagOrderWithFallback } from '../utils/treeFlattener';
import { createHiddenTagVisibility } from '../utils/tagPrefixMatcher';
import { setNavigationIndex } from '../utils/navigationIndex';
import { resolveCanonicalTagPath } from '../utils/tagUtils';
import { isFolderShortcut, isNoteShortcut, isSearchShortcut, isTagShortcut } from '../types/shortcuts';
import { useRootFolderOrder } from './useRootFolderOrder';
import { useRootTagOrder } from './useRootTagOrder';
import type { FolderNoteDetectionSettings } from '../utils/folderNotes';
import { getDBInstance } from '../storage/fileOperations';
import { naturalCompare } from '../utils/sortUtils';
import type { NoteCountInfo } from '../types/noteCounts';
import { calculateFolderNoteCounts } from '../utils/noteCountUtils';
import { getEffectiveFrontmatterExclusions } from '../utils/exclusionUtils';
import { sanitizeNavigationSectionOrder } from '../utils/navigationSections';
import { getVirtualTagCollection, isVirtualTagCollectionId, VIRTUAL_TAG_COLLECTION_IDS } from '../utils/virtualTagCollections';
import {
    buildFolderSeparatorKey,
    buildSectionSeparatorKey,
    buildTagSeparatorKey,
    parseNavigationSeparatorKey
} from '../utils/navigationSeparators';
import type { MetadataService } from '../services/MetadataService';
import { useSettingsDerived, type ActiveProfileState } from '../context/SettingsContext';

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

// Checks if a navigation item is part of the recent notes section
const isRecentNavigationItem = (item: CombinedNavigationItem): boolean => {
    if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER) {
        return item.data.id === RECENT_NOTES_VIRTUAL_FOLDER_ID;
    }
    return item.type === NavigationPaneItemType.RECENT_NOTE;
};

/** Options controlling which navigation items are eligible for root spacing */
interface RootSpacingOptions {
    showRootFolder: boolean;
    tagRootLevel: number;
}

/** Determines if the navigation item is a top-level folder or tag eligible for root spacing */
const isRootSpacingCandidate = (item: CombinedNavigationItem, options: RootSpacingOptions): boolean => {
    if (item.type === NavigationPaneItemType.FOLDER) {
        const desiredLevel = options.showRootFolder ? 1 : 0;
        return item.level === desiredLevel;
    }
    if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
        return item.level === options.tagRootLevel;
    }
    return false;
};

function decorateNavigationItems(
    source: CombinedNavigationItem[],
    app: App,
    settings: NotebookNavigatorSettings,
    fileNameIconNeedles: readonly FileNameIconNeedle[],
    getFileDisplayName: (file: TFile) => string,
    metadataService: MetadataService,
    parsedExcludedFolders: string[],
    _metadataVersion: string
): CombinedNavigationItem[] {
    void _metadataVersion;
    const shouldResolveFileNameIcons = settings.showFilenameMatchIcons;
    const fileIconSettings = {
        showFilenameMatchIcons: settings.showFilenameMatchIcons,
        fileNameIconMap: settings.fileNameIconMap,
        showCategoryIcons: true,
        fileTypeIconMap: settings.fileTypeIconMap
    };
    const fileIconFallbackMode = 'file';

    return source.map(item => {
        if (item.type === NavigationPaneItemType.FOLDER) {
            return {
                ...item,
                color: metadataService.getFolderColor(item.data.path),
                backgroundColor: metadataService.getFolderBackgroundColor(item.data.path),
                icon: metadataService.getFolderIcon(item.data.path),
                parsedExcludedFolders
            };
        }
        if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
            const tagNode = item.data;
            return {
                ...item,
                color: metadataService.getTagColor(tagNode.path),
                backgroundColor: metadataService.getTagBackgroundColor(tagNode.path),
                icon: metadataService.getTagIcon(tagNode.path)
            };
        }
        if (item.type === NavigationPaneItemType.SHORTCUT_FOLDER) {
            const folderPath = item.folder?.path;
            const folderColor = folderPath ? metadataService.getFolderColor(folderPath) : undefined;
            const folderBackground = folderPath ? metadataService.getFolderBackgroundColor(folderPath) : undefined;
            const customIcon = folderPath ? metadataService.getFolderIcon(folderPath) : undefined;
            const defaultIcon = folderPath === '/' ? 'vault' : 'lucide-folder';
            return {
                ...item,
                icon: customIcon || defaultIcon,
                color: folderColor,
                backgroundColor: folderBackground
            };
        }
        if (item.type === NavigationPaneItemType.SHORTCUT_TAG) {
            const tagColor = metadataService.getTagColor(item.tagPath);
            const tagBackground = metadataService.getTagBackgroundColor(item.tagPath);
            return {
                ...item,
                icon: metadataService.getTagIcon(item.tagPath) || 'lucide-tags',
                color: tagColor,
                backgroundColor: tagBackground
            };
        }
        if (item.type === NavigationPaneItemType.SHORTCUT_NOTE) {
            const note = item.note;
            if (!note) {
                return item;
            }
            const color = metadataService.getFileColor(note.path);
            const customIconId = metadataService.getFileIcon(note.path);
            const isExternalFile = !shouldDisplayFile(note, FILE_VISIBILITY.SUPPORTED, app);
            const resolvedIconId = resolveFileIconId(note, fileIconSettings, {
                customIconId,
                metadataCache: app.metadataCache,
                isExternalFile,
                fallbackMode: fileIconFallbackMode,
                fileNameNeedles: fileNameIconNeedles,
                fileNameForMatch: shouldResolveFileNameIcons ? getFileDisplayName(note) : undefined
            });
            return {
                ...item,
                icon: resolvedIconId ?? undefined,
                color
            };
        }
        if (item.type === NavigationPaneItemType.RECENT_NOTE) {
            const note = item.note;
            const customIconId = metadataService.getFileIcon(note.path);
            const color = metadataService.getFileColor(note.path);
            const isExternalFile = !shouldDisplayFile(note, FILE_VISIBILITY.SUPPORTED, app);
            const resolvedIconId = resolveFileIconId(note, fileIconSettings, {
                customIconId,
                metadataCache: app.metadataCache,
                isExternalFile,
                fallbackMode: fileIconFallbackMode,
                fileNameNeedles: fileNameIconNeedles,
                fileNameForMatch: shouldResolveFileNameIcons ? getFileDisplayName(note) : undefined
            });
            return {
                ...item,
                icon: resolvedIconId ?? undefined,
                color
            };
        }
        return item;
    });
}

/**
 * Inserts spacer items between consecutive root-level folders or tags
 * @param items Navigation items to augment with spacing
 * @param spacing Spacing value in pixels
 */
const CUSTOM_SEPARATOR_PREFIXES = ['folder:', 'tag:'];
const isCustomSeparatorKey = (key: string): boolean => CUSTOM_SEPARATOR_PREFIXES.some(prefix => key.startsWith(prefix));
const SPACER_ITEM_TYPES = new Set<NavigationPaneItemType>([
    NavigationPaneItemType.TOP_SPACER,
    NavigationPaneItemType.LIST_SPACER,
    NavigationPaneItemType.BOTTOM_SPACER,
    NavigationPaneItemType.ROOT_SPACER
]);

const insertRootSpacing = (items: CombinedNavigationItem[], spacing: number, options: RootSpacingOptions): CombinedNavigationItem[] => {
    if (spacing <= 0) {
        return items;
    }

    const result: CombinedNavigationItem[] = [];
    let rootCountInSection = 0;
    let spacerId = 0;

    const shouldResetSection = (item: CombinedNavigationItem): boolean => {
        if (
            item.type === NavigationPaneItemType.TOP_SPACER ||
            item.type === NavigationPaneItemType.BOTTOM_SPACER ||
            item.type === NavigationPaneItemType.BANNER ||
            item.type === NavigationPaneItemType.VIRTUAL_FOLDER
        ) {
            return true;
        }

        if (item.type === NavigationPaneItemType.LIST_SPACER) {
            return !isCustomSeparatorKey(item.key);
        }

        return false;
    };

    for (const item of items) {
        if (shouldResetSection(item)) {
            rootCountInSection = 0;
            result.push(item);
            continue;
        }

        if (isRootSpacingCandidate(item, options)) {
            if (rootCountInSection > 0) {
                result.push({
                    type: NavigationPaneItemType.ROOT_SPACER,
                    key: `root-spacer-${spacerId++}`,
                    spacing
                });
            }
            rootCountInSection += 1;
            result.push(item);
            continue;
        }

        result.push(item);
    }

    return result;
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
    /** Active profile-derived values */
    activeProfile: ActiveProfileState;
    /** Whether the navigation pane is currently visible */
    isVisible: boolean;
    /** Whether the shortcuts virtual folder is expanded */
    shortcutsExpanded: boolean;
    /** Whether the recent notes virtual folder is expanded */
    recentNotesExpanded: boolean;
    /** Whether shortcuts should be pinned at the top of the pane */
    pinShortcuts: boolean;
    /** Preferred ordering of navigation sections */
    sectionOrder: NavigationSectionId[];
}

/**
 * Return value of the useNavigationPaneData hook
 */
interface UseNavigationPaneDataResult {
    /** Combined list of navigation items (folders and tags) */
    items: CombinedNavigationItem[];
    /** First visible navigation section when shortcuts are inlined */
    firstSectionId: NavigationSectionId | null;
    /** First folder path rendered inline after spacers when shortcuts are pinned */
    firstInlineFolderPath: string | null;
    /** Shortcuts rendered separately when pinShortcuts is enabled */
    shortcutItems: CombinedNavigationItem[];
    /** Whether the tags virtual folder has visible children */
    tagsVirtualFolderHasChildren: boolean;
    /** Recent notes items rendered in the pinned area when pinning is enabled */
    pinnedRecentNotesItems: CombinedNavigationItem[];
    /** Whether recent notes are pinned with shortcuts */
    shouldPinRecentNotes: boolean;
    /** Map from item keys to index in items array */
    pathToIndex: Map<string, number>;
    /** Map from shortcut id to index */
    shortcutIndex: Map<string, number>;
    /** Map from tag path to current/descendant note counts */
    tagCounts: Map<string, NoteCountInfo>;
    /** Map from folder path to current/descendant note counts */
    folderCounts: Map<string, NoteCountInfo>;
    /** Ordered list of root-level folders */
    rootLevelFolders: TFolder[];
    /** Paths from settings that are not currently present in the vault */
    missingRootFolderPaths: string[];
    /** Final ordered keys used for rendering root-level tags in navigation */
    resolvedRootTagKeys: string[];
    /** Combined tag tree used for ordering (includes hidden roots) */
    rootOrderingTagTree: Map<string, TagTreeNode>;
    /** Map from tag path to custom order index */
    rootTagOrderMap: Map<string, number>;
    /** Paths for tags in custom order that are not currently present */
    missingRootTagPaths: string[];
    /** Version marker that bumps when vault files or metadata change */
    vaultChangeVersion: number;
    /** Path to the navigation banner from the active vault profile */
    navigationBannerPath: string | null;
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
    activeProfile,
    isVisible,
    shortcutsExpanded,
    recentNotesExpanded,
    pinShortcuts,
    sectionOrder
}: UseNavigationPaneDataParams): UseNavigationPaneDataResult {
    const { app } = useServices();
    const { fileNameIconNeedles } = useSettingsDerived();
    const { recentNotes } = useRecentData();
    const metadataService = useMetadataService();
    const expansionState = useExpansionState();
    const { fileData, getFileDisplayName } = useFileCache();
    const { hydratedShortcuts } = useShortcuts();
    const uxPreferences = useUXPreferences();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;
    const showHiddenItems = uxPreferences.showHiddenItems;
    // Resolves frontmatter exclusions, returns empty array when hidden items are shown
    const effectiveFrontmatterExclusions = getEffectiveFrontmatterExclusions(settings, showHiddenItems);
    const { hiddenFolders, hiddenFileNamePatterns, hiddenTags, fileVisibility, navigationBanner } = activeProfile;
    const navigationBannerPath = navigationBanner;
    const folderCountFileNameMatcher = useMemo(() => {
        return createHiddenFileNameMatcherForVisibility(hiddenFileNamePatterns, showHiddenItems);
    }, [hiddenFileNamePatterns, showHiddenItems]);

    // Version counter that increments when vault files change
    const [fileChangeVersion, setFileChangeVersion] = useState(0);
    // Increments version counter to trigger dependent recalculations
    const handleRootFileChange = useCallback(() => {
        setFileChangeVersion(value => value + 1);
    }, []);
    // Get ordered root folders and notify on file changes
    const { rootFolders, rootLevelFolders, rootFolderOrderMap, missingRootFolderPaths } = useRootFolderOrder({
        settings,
        onFileChange: handleRootFileChange
    });

    // Extract tag tree data from file cache
    const tagTree = useMemo(() => fileData.tagTree ?? new Map<string, TagTreeNode>(), [fileData.tagTree]);
    const untaggedCount = fileData.untagged;

    // Create matcher for hidden tag patterns (supports "archive", "temp*", "*draft")
    const hiddenTagVisibility = useMemo(() => createHiddenTagVisibility(hiddenTags, showHiddenItems), [hiddenTags, showHiddenItems]);
    const hiddenTagMatcher = hiddenTagVisibility.matcher;
    const hiddenMatcherHasRules = hiddenTagVisibility.hasHiddenRules;

    const visibleTagTree = useMemo(() => {
        if (!hiddenMatcherHasRules || showHiddenItems) {
            return tagTree;
        }
        return excludeFromTagTree(tagTree, hiddenTagMatcher);
    }, [tagTree, hiddenMatcherHasRules, showHiddenItems, hiddenTagMatcher]);

    const visibleTaggedCount = fileData.tagged ?? 0;

    /** Create tag comparator based on current sort order and descendant note settings */
    const tagComparator = useMemo(
        () => createTagComparator(settings.tagSortOrder, includeDescendantNotes),
        [settings.tagSortOrder, includeDescendantNotes]
    );

    // Retrieves hidden root tag nodes when tags are visible but hidden items are not shown
    const hiddenRootTagNodes = useMemo(() => {
        if (!settings.showTags || showHiddenItems) {
            return new Map<string, TagTreeNode>();
        }
        return fileData.hiddenRootTags ?? new Map<string, TagTreeNode>();
    }, [fileData.hiddenRootTags, showHiddenItems, settings.showTags]);

    // Combines visible and hidden tag trees for root tag ordering calculations
    const tagTreeForOrdering = useMemo(() => {
        if (hiddenRootTagNodes.size === 0) {
            return tagTree;
        }
        const combined = new Map<string, TagTreeNode>(tagTree);
        hiddenRootTagNodes.forEach((node, path) => {
            if (!combined.has(path)) {
                combined.set(path, node);
            }
        });
        return combined;
    }, [hiddenRootTagNodes, tagTree]);

    // Manages custom ordering for root-level tags
    const { rootTagOrderMap, missingRootTagPaths } = useRootTagOrder({
        settings,
        tagTree: tagTreeForOrdering,
        comparator: tagComparator ?? compareTagAlphabetically
    });

    /**
     * Build folder items from vault structure
     */
    const folderItems = useMemo(() => {
        return flattenFolderTree(rootFolders, expansionState.expandedFolders, hiddenFolders, 0, new Set(), {
            rootOrderMap: rootFolderOrderMap
        });
    }, [rootFolders, expansionState.expandedFolders, hiddenFolders, rootFolderOrderMap]);

    /**
     * Build tag items with a single tag tree
     */
    const { tagItems, resolvedRootTagKeys, tagsVirtualFolderHasChildren } = useMemo(() => {
        if (!settings.showTags) {
            return {
                tagItems: [] as CombinedNavigationItem[],
                resolvedRootTagKeys: [],
                tagsVirtualFolderHasChildren: false
            };
        }

        const items: CombinedNavigationItem[] = [];

        const shouldHideTags = !showHiddenItems;
        const hasHiddenPatterns = hiddenMatcherHasRules;
        const shouldIncludeUntagged = settings.showUntagged && untaggedCount > 0;
        const matcherForMarking = !shouldHideTags && hasHiddenPatterns ? hiddenTagMatcher : undefined;
        const taggedCollectionCount: NoteCountInfo = {
            current: visibleTaggedCount,
            descendants: 0,
            total: visibleTaggedCount
        };

        // Adds the untagged node to the items list at the specified level
        const pushUntaggedNode = (level: number) => {
            if (!shouldIncludeUntagged) {
                return;
            }
            const untaggedNode: TagTreeNode = {
                path: UNTAGGED_TAG_ID,
                displayPath: UNTAGGED_TAG_ID,
                name: getVirtualTagCollection(VIRTUAL_TAG_COLLECTION_IDS.UNTAGGED).getLabel(),
                children: new Map(),
                notesWithTag: new Set()
            };

            items.push({
                type: NavigationPaneItemType.UNTAGGED,
                data: untaggedNode,
                key: UNTAGGED_TAG_ID,
                level
            });
        };

        const addVirtualFolder = (
            id: string,
            name: string,
            icon?: string,
            options?: { tagCollectionId?: string; showFileCount?: boolean; noteCount?: NoteCountInfo }
        ) => {
            const folder: VirtualFolder = { id, name, icon };
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: folder,
                level: 0,
                key: id,
                isSelectable: Boolean(options?.tagCollectionId),
                tagCollectionId: options?.tagCollectionId,
                showFileCount: options?.showFileCount,
                noteCount: options?.noteCount
            });
        };

        if (visibleTagTree.size === 0) {
            if (settings.showAllTagsFolder) {
                const folderId = 'tags-root';
                addVirtualFolder(folderId, strings.tagList.tags, 'lucide-tags', {
                    tagCollectionId: TAGGED_TAG_ID,
                    showFileCount: settings.showNoteCount,
                    noteCount: taggedCollectionCount
                });

                if (expansionState.expandedVirtualFolders.has(folderId) && shouldIncludeUntagged) {
                    pushUntaggedNode(1);
                }

                const tagsVirtualFolderHasChildren = shouldIncludeUntagged;
                return {
                    tagItems: items,
                    resolvedRootTagKeys: shouldIncludeUntagged ? [UNTAGGED_TAG_ID] : [],
                    tagsVirtualFolderHasChildren
                };
            }

            if (shouldIncludeUntagged) {
                pushUntaggedNode(0);
                return { tagItems: items, resolvedRootTagKeys: [UNTAGGED_TAG_ID], tagsVirtualFolderHasChildren: true };
            }

            return { tagItems: items, resolvedRootTagKeys: [], tagsVirtualFolderHasChildren: false };
        }

        // Extract root nodes and determine effective comparator based on custom ordering
        const visibleRootNodes = Array.from(visibleTagTree.values());
        const baseComparator = tagComparator ?? compareTagAlphabetically;
        const effectiveComparator: TagComparator =
            rootTagOrderMap.size > 0 ? (a, b) => compareTagOrderWithFallback(a, b, rootTagOrderMap, baseComparator) : baseComparator;
        const sortedRootNodes = visibleRootNodes.length > 0 ? visibleRootNodes.slice().sort(effectiveComparator) : visibleRootNodes;
        const hasVisibleTags = sortedRootNodes.length > 0;
        const hasTagCollectionContent = visibleTaggedCount > 0;
        const hasContent = hasVisibleTags || shouldIncludeUntagged || hasTagCollectionContent;
        const tagsVirtualFolderHasChildren = hasVisibleTags || shouldIncludeUntagged;

        // Build map of all root nodes including visible and hidden ones
        const rootNodeMap = new Map<string, TagTreeNode>();
        sortedRootNodes.forEach(node => {
            rootNodeMap.set(node.path, node);
        });
        hiddenRootTagNodes.forEach((node, path) => {
            rootNodeMap.set(path, node);
        });

        // Determine default ordering and allowed keys for final tag list
        const defaultKeyOrder = sortedRootNodes.map(node => node.path);
        const allowedKeys = new Set(defaultKeyOrder);
        if (shouldIncludeUntagged) {
            allowedKeys.add(UNTAGGED_TAG_ID);
        }
        hiddenRootTagNodes.forEach((_, path) => {
            allowedKeys.add(path);
            if (!defaultKeyOrder.includes(path)) {
                defaultKeyOrder.push(path);
            }
        });

        // Build final ordered list of root tag keys, respecting custom order first
        const resolvedRootTagKeys: string[] = [];
        settings.rootTagOrder.forEach(entry => {
            if (!allowedKeys.has(entry)) {
                return;
            }
            if (resolvedRootTagKeys.includes(entry)) {
                return;
            }
            resolvedRootTagKeys.push(entry);
        });

        // Add remaining keys not in custom order
        defaultKeyOrder.forEach(key => {
            if (!resolvedRootTagKeys.includes(key)) {
                resolvedRootTagKeys.push(key);
            }
        });

        // Ensure untagged is included if enabled
        if (shouldIncludeUntagged && !resolvedRootTagKeys.includes(UNTAGGED_TAG_ID)) {
            resolvedRootTagKeys.push(UNTAGGED_TAG_ID);
        }

        // Helper function to flatten and append a tag node with its children
        const appendTagNode = (node: TagTreeNode, level: number) => {
            const tagEntries = flattenTagTree([node], expansionState.expandedTags, level, {
                hiddenMatcher: matcherForMarking,
                comparator: effectiveComparator
            });
            items.push(...tagEntries);
        };

        if (settings.showAllTagsFolder) {
            if (hasContent) {
                const folderId = 'tags-root';
                addVirtualFolder(folderId, strings.tagList.tags, 'lucide-tags', {
                    tagCollectionId: TAGGED_TAG_ID,
                    showFileCount: settings.showNoteCount,
                    noteCount: taggedCollectionCount
                });

                if (expansionState.expandedVirtualFolders.has(folderId)) {
                    resolvedRootTagKeys.forEach(key => {
                        if (hiddenRootTagNodes.has(key) && !showHiddenItems) {
                            return;
                        }
                        if (key === UNTAGGED_TAG_ID) {
                            pushUntaggedNode(1);
                            return;
                        }
                        const node = rootNodeMap.get(key);
                        if (!node) {
                            return;
                        }
                        appendTagNode(node, 1);
                    });
                }
            }
        } else {
            resolvedRootTagKeys.forEach(key => {
                if (hiddenRootTagNodes.has(key) && !showHiddenItems) {
                    return;
                }
                if (key === UNTAGGED_TAG_ID) {
                    pushUntaggedNode(0);
                    return;
                }
                const node = rootNodeMap.get(key);
                if (!node) {
                    return;
                }
                appendTagNode(node, 0);
            });
        }

        return { tagItems: items, resolvedRootTagKeys, tagsVirtualFolderHasChildren };
    }, [
        settings.showTags,
        settings.showAllTagsFolder,
        showHiddenItems,
        settings.showUntagged,
        hiddenTagMatcher,
        hiddenMatcherHasRules,
        visibleTagTree,
        visibleTaggedCount,
        untaggedCount,
        settings.showNoteCount,
        settings.rootTagOrder,
        expansionState.expandedTags,
        expansionState.expandedVirtualFolders,
        tagComparator,
        rootTagOrderMap,
        hiddenRootTagNodes
    ]);

    /**
     * Pre-compute parsed excluded folders to avoid repeated parsing
     */
    const parsedExcludedFolders = hiddenFolders;

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

                const isExcluded = hiddenFolders.length > 0 && isFolderInExcludedFolder(folder, hiddenFolders);
                if (isExcluded && !showHiddenItems) {
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
                items.push({
                    type: NavigationPaneItemType.SHORTCUT_NOTE,
                    key,
                    level: itemLevel,
                    shortcut,
                    note
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

                const canonicalPath = resolveCanonicalTagPath(resolvedPath, tagTree);
                if (!canonicalPath) {
                    return;
                }

                const tagNode = findTagNode(tagTree, canonicalPath);
                let displayPath = tagNode?.displayPath ?? resolvedPath;
                let isMissing = !tagNode;

                if (isVirtualTagCollectionId(canonicalPath)) {
                    displayPath = getVirtualTagCollection(canonicalPath).getLabel();
                    isMissing = false;
                }

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_TAG,
                    key,
                    level: itemLevel,
                    shortcut,
                    tagPath: canonicalPath,
                    displayName: displayPath,
                    isMissing,
                    missingLabel: isMissing ? resolvedPath : undefined
                });
            }
        });

        return items;
    }, [hydratedShortcuts, tagTree, hiddenFolders, showHiddenItems, settings.showShortcuts, shortcutsExpanded]);

    // Build list of recent notes items with proper hierarchy
    const recentNotesItems = useMemo(() => {
        if (!settings.showRecentNotes) {
            return [] as CombinedNavigationItem[];
        }

        const headerLevel = 0;
        const itemLevel = headerLevel + 1;

        // Use appropriate header based on file visibility setting
        const recentHeaderName =
            fileVisibility === FILE_VISIBILITY.DOCUMENTS
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
                items.push({
                    type: NavigationPaneItemType.RECENT_NOTE,
                    key: `recent-${path}`,
                    level: itemLevel,
                    note: file
                });
            }
        });

        return items;
    }, [app, settings.recentNotesCount, settings.showRecentNotes, recentNotes, fileVisibility, recentNotesExpanded]);

    const shouldPinRecentNotes = pinShortcuts && settings.pinRecentNotesWithShortcuts && settings.showRecentNotes;

    // Sanitize section order from local storage and ensure defaults are present
    const normalizedSectionOrder = useMemo(() => sanitizeNavigationSectionOrder(sectionOrder), [sectionOrder]);

    /**
     * Combine shortcut, folder, and tag items based on display order settings
     */
    // Combine all navigation items in the correct order with spacers
    const { items, sectionSpacerMap, firstSectionId } = useMemo(() => {
        const allItems: CombinedNavigationItem[] = [];
        const sectionSpacerMap = new Map<NavigationSectionId, string>();
        let firstVisibleSectionId: NavigationSectionId | null = null;

        // Path to the banner file configured in the active vault profile
        const bannerPath = navigationBannerPath;
        // Banner appears in main list only when nothing is pinned
        const pinnedShortcutItems = pinShortcuts && shortcutItems.length > 0;
        const pinnedRecentItems = shouldPinRecentNotes && recentNotesItems.length > 0;
        const shouldIncludeBannerInMainList = Boolean(bannerPath && !(pinnedShortcutItems || pinnedRecentItems));

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

        // Determines which sections should be displayed based on settings and available items
        const shouldIncludeShortcutsSection = settings.showShortcuts && shortcutItems.length > 0 && !pinShortcuts;
        const shouldIncludeRecentSection = settings.showRecentNotes && recentNotesItems.length > 0 && !shouldPinRecentNotes;
        const shouldIncludeFoldersSection = folderItems.length > 0;
        const shouldIncludeTagsSection = settings.showTags && tagItems.length > 0;

        // Builds sections in the user-specified order
        const orderedSections: { id: NavigationSectionId; items: CombinedNavigationItem[] }[] = [];

        // Adds sections to the display based on user-specified order and visibility conditions
        normalizedSectionOrder.forEach(identifier => {
            switch (identifier) {
                case NavigationSectionId.SHORTCUTS:
                    if (shouldIncludeShortcutsSection) {
                        orderedSections.push({ id: NavigationSectionId.SHORTCUTS, items: shortcutItems });
                    }
                    break;
                case NavigationSectionId.RECENT:
                    if (shouldIncludeRecentSection) {
                        orderedSections.push({ id: NavigationSectionId.RECENT, items: recentNotesItems });
                    }
                    break;
                case NavigationSectionId.FOLDERS:
                    if (shouldIncludeFoldersSection) {
                        orderedSections.push({ id: NavigationSectionId.FOLDERS, items: folderItems });
                    }
                    break;
                case NavigationSectionId.TAGS:
                    if (shouldIncludeTagsSection) {
                        orderedSections.push({ id: NavigationSectionId.TAGS, items: tagItems });
                    }
                    break;
                default:
                    break;
            }
        });

        // Filters out empty sections that have no items to display
        const visibleSections = orderedSections.filter(section => section.items.length > 0);

        if (visibleSections.length > 0) {
            firstVisibleSectionId = visibleSections[0].id;
            // Track the spacer key used for the first section so pinned shortcuts can hide its separator
            sectionSpacerMap.set(visibleSections[0].id, 'top-spacer');
        }

        // Assembles final item list with spacers between sections
        visibleSections.forEach((section, index) => {
            allItems.push(...section.items);
            if (index < visibleSections.length - 1) {
                const nextSection = visibleSections[index + 1];
                const spacerKey = buildSectionSeparatorKey(nextSection.id);
                sectionSpacerMap.set(nextSection.id, spacerKey);
                allItems.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: spacerKey
                });
            }
        });

        allItems.push({
            type: NavigationPaneItemType.BOTTOM_SPACER,
            key: 'bottom-spacer'
        });

        return { items: allItems, sectionSpacerMap, firstSectionId: firstVisibleSectionId };
    }, [
        folderItems,
        tagItems,
        shortcutItems,
        recentNotesItems,
        normalizedSectionOrder,
        settings.showShortcuts,
        shouldPinRecentNotes,
        settings.showRecentNotes,
        settings.showTags,
        navigationBannerPath,
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
            inheritFolderColors: settings.inheritFolderColors,
            inheritTagColors: settings.inheritTagColors
        });
        return `${settingsSignature}::${frontmatterMetadataVersion}`;
    }, [settings, frontmatterMetadataVersion]); // Depend on entire settings object to catch mutations

    const [navigationSeparatorVersion, setNavigationSeparatorVersion] = useState(() => metadataService.getNavigationSeparatorsVersion());

    useEffect(() => {
        return metadataService.subscribeToNavigationSeparatorChanges(version => {
            setNavigationSeparatorVersion(version);
        });
    }, [metadataService]);
    const navigationSeparatorSnapshot = useMemo(() => {
        return {
            version: navigationSeparatorVersion,
            record: settings.navigationSeparators || {}
        };
    }, [navigationSeparatorVersion, settings.navigationSeparators]);

    const parsedNavigationSeparators = useMemo(() => {
        const separatorRecord = navigationSeparatorSnapshot.record;
        const folderSeparators = new Set<string>();
        const tagSeparators = new Set<string>();
        const sectionSeparatorIds = new Set<NavigationSectionId>();
        let useSectionSpacerForRootFolder = false;

        Object.entries(separatorRecord || {}).forEach(([key, enabled]) => {
            if (!enabled) {
                return;
            }

            const descriptor = parseNavigationSeparatorKey(key);
            if (!descriptor) {
                return;
            }

            if (descriptor.type === 'section') {
                if (descriptor.id === NavigationSectionId.TAGS && !settings.showAllTagsFolder) {
                    return;
                }
                sectionSeparatorIds.add(descriptor.id);
                return;
            }

            if (descriptor.type === 'folder') {
                if (descriptor.path === '/') {
                    useSectionSpacerForRootFolder = settings.showRootFolder;
                } else {
                    folderSeparators.add(descriptor.path);
                }
                return;
            }

            if (descriptor.type === 'tag') {
                tagSeparators.add(descriptor.path);
            }
        });

        const hasAnySeparators =
            folderSeparators.size > 0 || tagSeparators.size > 0 || sectionSeparatorIds.size > 0 || useSectionSpacerForRootFolder;

        return { folderSeparators, tagSeparators, sectionSeparatorIds, useSectionSpacerForRootFolder, hasAnySeparators };
    }, [navigationSeparatorSnapshot, settings.showRootFolder, settings.showAllTagsFolder]);

    const itemsWithSeparators = useMemo(() => {
        const { folderSeparators, tagSeparators, sectionSeparatorIds, useSectionSpacerForRootFolder, hasAnySeparators } =
            parsedNavigationSeparators;

        if (!hasAnySeparators) {
            return items;
        }

        const spacerKeysWithSeparators = new Set<string>();
        const effectiveSectionIds = new Set(sectionSeparatorIds);
        if (pinShortcuts) {
            effectiveSectionIds.delete(NavigationSectionId.SHORTCUTS);
            if (firstSectionId) {
                // When shortcuts are pinned the first inlined section should never draw its separator line
                effectiveSectionIds.delete(firstSectionId);
            }
        }

        effectiveSectionIds.forEach(sectionId => {
            const spacerKey = sectionSpacerMap.get(sectionId);
            if (spacerKey) {
                spacerKeysWithSeparators.add(spacerKey);
            }
        });

        // Include root section separator when:
        // - Section spacer for root folder is enabled AND
        // - Either shortcuts are not pinned OR the first section is not NOTES
        // This ensures proper separation between pinned shortcuts and main navigation sections
        const shouldIncludeRootSectionSeparator =
            useSectionSpacerForRootFolder && (!pinShortcuts || firstSectionId !== NavigationSectionId.FOLDERS);
        if (shouldIncludeRootSectionSeparator) {
            const spacerKey = sectionSpacerMap.get(NavigationSectionId.FOLDERS);
            if (spacerKey) {
                spacerKeysWithSeparators.add(spacerKey);
            }
        }

        if (spacerKeysWithSeparators.size === 0 && folderSeparators.size === 0 && tagSeparators.size === 0) {
            return items;
        }

        const createCustomSeparator = (key: string): CombinedNavigationItem => ({
            type: NavigationPaneItemType.LIST_SPACER,
            key,
            hasSeparator: true
        });

        const result: CombinedNavigationItem[] = [];

        items.forEach(item => {
            if (item.type === NavigationPaneItemType.TOP_SPACER || item.type === NavigationPaneItemType.LIST_SPACER) {
                if (spacerKeysWithSeparators.has(item.key)) {
                    result.push({ ...item, hasSeparator: true });
                } else {
                    result.push(item);
                }
                return;
            }

            const shouldHideFolderSeparator = item.type === NavigationPaneItemType.FOLDER && item.isExcluded && !showHiddenItems;

            if (item.type === NavigationPaneItemType.FOLDER) {
                if (!shouldHideFolderSeparator && folderSeparators.has(item.data.path)) {
                    result.push(createCustomSeparator(buildFolderSeparatorKey(item.data.path)));
                }
            } else if (
                (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) &&
                tagSeparators.has(item.data.path)
            ) {
                result.push(createCustomSeparator(buildTagSeparatorKey(item.data.path)));
            }

            result.push(item);
        });

        return result;
    }, [firstSectionId, items, parsedNavigationSeparators, sectionSpacerMap, showHiddenItems, pinShortcuts]);

    const decorateItems = useCallback(
        (sourceItems: CombinedNavigationItem[]) =>
            decorateNavigationItems(
                sourceItems,
                app,
                settings,
                fileNameIconNeedles,
                getFileDisplayName,
                metadataService,
                parsedExcludedFolders,
                metadataVersion
            ),
        [app, settings, fileNameIconNeedles, getFileDisplayName, metadataService, parsedExcludedFolders, metadataVersion]
    );

    /**
     * Add metadata (colors, icons) and excluded folders to items
     * This pre-computation avoids calling these functions during render
     */
    const itemsWithMetadata = useMemo(() => decorateItems(itemsWithSeparators), [decorateItems, itemsWithSeparators]);

    const decoratedRecentNotes = useMemo(() => itemsWithMetadata.filter(isRecentNavigationItem), [itemsWithMetadata]);

    // Extract shortcut items when pinning is enabled for display in pinned area
    const shortcutItemsWithMetadata = useMemo(() => {
        if (!pinShortcuts) {
            return [] as CombinedNavigationItem[];
        }
        return decorateItems(shortcutItems);
    }, [decorateItems, pinShortcuts, shortcutItems]);

    const pinnedRecentNotesItems = useMemo(() => {
        if (!shouldPinRecentNotes) {
            return [] as CombinedNavigationItem[];
        }
        if (decoratedRecentNotes.length > 0) {
            return decoratedRecentNotes;
        }
        return decorateItems(recentNotesItems);
    }, [decorateItems, decoratedRecentNotes, recentNotesItems, shouldPinRecentNotes]);

    /**
     * Filter items based on showHiddenItems setting
     * When showHiddenItems is false, filter out folders marked as excluded
     */
    const filteredItems = useMemo(() => {
        // When pinning shortcuts, exclude them from main tree (they're rendered separately)
        const baseItems = itemsWithMetadata.filter(current => {
            if (pinShortcuts && isShortcutNavigationItem(current)) {
                return false;
            }
            if (shouldPinRecentNotes && isRecentNavigationItem(current)) {
                return false;
            }
            return true;
        });

        if (showHiddenItems) {
            // Show all items including excluded ones
            return baseItems;
        }

        return baseItems.filter(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.isExcluded) {
                return false;
            }
            return true;
        });
    }, [itemsWithMetadata, showHiddenItems, pinShortcuts, shouldPinRecentNotes]);

    /**
     * Find the first folder that appears inline (not in the pinned area) when shortcuts are pinned.
     *
     * Special behavior when shortcuts are pinned:
     * - Shortcuts themselves cannot have separators added/removed (no context menu separator options)
     * - The first item after pinned shortcuts cannot have separators added/removed
     * - This maintains clean visual separation between pinned area and main navigation
     * - Users must disable pinned shortcuts to manage separators on these items
     */
    const firstInlineFolderPath = useMemo(() => {
        if (!pinShortcuts) {
            return null;
        }

        // Skip spacer items to find the first actual navigation item
        let firstInlineItem: CombinedNavigationItem | null = null;
        for (const item of filteredItems) {
            if (SPACER_ITEM_TYPES.has(item.type)) {
                continue;
            }
            firstInlineItem = item;
            break;
        }

        if (!firstInlineItem) {
            return null;
        }

        // Only return path if it's a folder (not a tag or other item type)
        if (firstInlineItem.type === NavigationPaneItemType.FOLDER) {
            return firstInlineItem.data.path;
        }

        return null;
    }, [filteredItems, pinShortcuts]);

    // Suppress the separator for the first inline folder when shortcuts are pinned
    // This prevents visual separation between pinned shortcuts and the main navigation list
    const filteredItemsForDisplay = useMemo(() => {
        if (!pinShortcuts) {
            return filteredItems;
        }
        if (!firstInlineFolderPath) {
            return filteredItems;
        }

        const { folderSeparators } = parsedNavigationSeparators;
        const hasSeparator = folderSeparators.has(firstInlineFolderPath);
        if (!hasSeparator) {
            return filteredItems;
        }

        // Remove the separator spacer item for the first inline folder
        const suppressedKey = buildFolderSeparatorKey(firstInlineFolderPath);
        let matchIndex = -1;
        for (let i = 0; i < filteredItems.length; i += 1) {
            const item = filteredItems[i];
            if (item.type === NavigationPaneItemType.LIST_SPACER && item.key === suppressedKey) {
                matchIndex = i;
                break;
            }
        }

        if (matchIndex === -1) {
            return filteredItems;
        }

        // Create new array without the suppressed separator
        const nextItems = filteredItems.slice();
        nextItems.splice(matchIndex, 1);
        return nextItems;
    }, [filteredItems, firstInlineFolderPath, parsedNavigationSeparators, pinShortcuts]);

    /**
     * Create a map for O(1) item lookups by path
     * Build from filtered items so indices match what's displayed
     */
    const itemsWithRootSpacing = useMemo(() => {
        const tagRootLevel = settings.showAllTagsFolder ? 1 : 0;
        return insertRootSpacing(filteredItemsForDisplay, settings.rootLevelSpacing, {
            showRootFolder: settings.showRootFolder,
            tagRootLevel
        });
    }, [filteredItemsForDisplay, settings.rootLevelSpacing, settings.showRootFolder, settings.showAllTagsFolder]);

    const pathToIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        itemsWithRootSpacing.forEach((item, index) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                setNavigationIndex(indexMap, ItemType.FOLDER, item.data.path, index);
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                setNavigationIndex(indexMap, ItemType.TAG, tagNode.path, index);
            } else if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER && item.tagCollectionId) {
                setNavigationIndex(indexMap, ItemType.TAG, item.tagCollectionId, index);
            }
        });

        return indexMap;
    }, [itemsWithRootSpacing]);

    // Build index map for shortcuts to enable scrolling to specific shortcuts
    const shortcutIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        const source = pinShortcuts ? shortcutItemsWithMetadata : itemsWithRootSpacing;

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
    }, [itemsWithRootSpacing, pinShortcuts, shortcutItemsWithMetadata]);

    /**
     * Pre-compute tag counts to avoid expensive calculations during render
     */
    const tagCounts = useMemo(() => {
        const counts = new Map<string, NoteCountInfo>();

        // Skip computation if pane is not visible or not showing tags
        if (!isVisible || !settings.showTags) return counts;

        counts.set(TAGGED_TAG_ID, {
            current: visibleTaggedCount,
            descendants: 0,
            total: visibleTaggedCount
        });

        // Add untagged count
        if (settings.showUntagged) {
            counts.set(UNTAGGED_TAG_ID, {
                current: untaggedCount,
                descendants: 0,
                total: untaggedCount
            });
        }

        // Compute counts for all tag items
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.TAG) {
                const tagNode = item.data;
                const current = tagNode.notesWithTag.size;
                if (includeDescendantNotes) {
                    const total = getTotalNoteCount(tagNode);
                    const descendants = Math.max(total - current, 0);
                    counts.set(tagNode.path, { current, descendants, total });
                } else {
                    counts.set(tagNode.path, {
                        current,
                        descendants: 0,
                        total: current
                    });
                }
            }
        });

        return counts;
    }, [itemsWithMetadata, settings.showTags, settings.showUntagged, includeDescendantNotes, visibleTaggedCount, untaggedCount, isVisible]);

    /**
     * Pre-compute folder file counts to avoid recursive counting during render
     */
    const folderCounts = useMemo(() => {
        const counts = new Map<string, NoteCountInfo>();

        // Skip computation if pane is not visible or not showing note counts
        if (!isVisible || !settings.showNoteCount) {
            return counts;
        }

        const excludedProperties = effectiveFrontmatterExclusions;
        const excludedFolderPatterns = hiddenFolders;
        const folderNoteSettings: FolderNoteDetectionSettings = {
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName
        };
        const includeDescendants = includeDescendantNotes;
        const showHiddenFolders = showHiddenItems;
        const countOptions = {
            app,
            fileVisibility,
            excludedFiles: excludedProperties,
            excludedFolders: excludedFolderPatterns,
            fileNameMatcher: folderCountFileNameMatcher,
            includeDescendants,
            showHiddenFolders,
            hideFolderNoteInList: settings.hideFolderNoteInList,
            folderNoteSettings,
            cache: counts
        };

        // Compute counts for all folder items
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.data instanceof TFolder) {
                calculateFolderNoteCounts(item.data, countOptions);
            }
        });

        return counts;
        // NOTE TO REVIEWER: Including **fileChangeVersion** to trigger recalculation when non-markdown files move
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        itemsWithMetadata,
        settings.showNoteCount,
        includeDescendantNotes,
        effectiveFrontmatterExclusions,
        hiddenFolders,
        hiddenFileNamePatterns,
        showHiddenItems,
        folderCountFileNameMatcher,
        fileVisibility,
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
        items: itemsWithRootSpacing,
        firstSectionId,
        firstInlineFolderPath,
        shortcutItems: shortcutItemsWithMetadata,
        pinnedRecentNotesItems,
        shouldPinRecentNotes,
        tagsVirtualFolderHasChildren,
        pathToIndex,
        shortcutIndex,
        tagCounts,
        folderCounts,
        rootLevelFolders,
        missingRootFolderPaths,
        resolvedRootTagKeys,
        rootOrderingTagTree: tagTreeForOrdering,
        rootTagOrderMap,
        missingRootTagPaths,
        vaultChangeVersion: fileChangeVersion,
        navigationBannerPath
    };
}
