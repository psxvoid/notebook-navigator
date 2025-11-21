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

import type { FileVisibility } from '../utils/fileTypeUtils';
import type { FolderAppearance, TagAppearance } from '../hooks/useListPaneAppearance';
import type { BackgroundMode, PinnedNotes } from '../types';
import type { FolderNoteCreationPreference } from '../types/folderNote';
import type { KeyboardShortcutConfig } from '../utils/keyboardShortcuts';
import type { ShortcutEntry } from '../types/shortcuts';
import type { SearchProvider } from '../types/search';

/** Available sort options for file listing */
export type SortOption = 'modified-desc' | 'modified-asc' | 'created-desc' | 'created-asc' | 'title-asc' | 'title-desc';

/** Available orderings for tags in the navigation pane */
export type TagSortOrder = 'alpha-asc' | 'alpha-desc' | 'frequency-asc' | 'frequency-desc';

/** Type guard for validating tag sort order values */
export function isTagSortOrder(value: string): value is TagSortOrder {
    return value === 'alpha-asc' || value === 'alpha-desc' || value === 'frequency-asc' || value === 'frequency-desc';
}

/** Scope of items that button actions affect */
export type ItemScope = 'all' | 'folders-only' | 'tags-only';

/** Modifier key used for multi-select operations */
export type MultiSelectModifier = 'cmdCtrl' | 'optionAlt';

/** Display options for list pane title */
export type ListPaneTitleOption = 'header' | 'list' | 'hidden';

/** Grouping options for list pane notes */
export type ListNoteGroupingOption = 'none' | 'date' | 'folder';

/** Date source to display when alphabetical sorting is active */
export type AlphabeticalDateMode = 'created' | 'modified';

/** Buttons available in the navigation toolbar */
export type NavigationToolbarButtonId = 'shortcuts' | 'expandCollapse' | 'hiddenItems' | 'rootReorder' | 'newFolder';

/** Buttons available in the list toolbar */
export type ListToolbarButtonId = 'search' | 'descendants' | 'sort' | 'appearance' | 'newNote';

/** Visibility toggles for toolbar buttons */
export interface ToolbarVisibilitySettings {
    navigation: Record<NavigationToolbarButtonId, boolean>;
    list: Record<ListToolbarButtonId, boolean>;
}

/** Vault profile storing hidden folder, tag, and note patterns */
export interface VaultProfile {
    id: string;
    name: string;
    fileVisibility: FileVisibility;
    hiddenFolders: string[];
    hiddenTags: string[];
    hiddenFiles: string[];
    navigationBanner: string | null;
    shortcuts: ShortcutEntry[];
}

/**
 * Plugin settings interface defining all configurable options
 * Settings are organized by tab for easier maintenance
 */
export interface NotebookNavigatorSettings {
    // General tab - Filtering
    fileVisibility: FileVisibility;
    hiddenTags: string[];
    vaultProfiles: VaultProfile[];
    vaultProfile: string;

    // General tab - Behavior
    autoRevealActiveFile: boolean;
    autoRevealIgnoreRightSidebar: boolean;
    multiSelectModifier: MultiSelectModifier;

    // General tab - View
    startView: 'navigation' | 'files';

    // General tab - Homepage
    homepage: string | null;
    mobileHomepage: string | null;
    useMobileHomepage: boolean;

    // General tab - Desktop appearance
    showTooltips: boolean;
    showTooltipPath: boolean;
    desktopBackground: BackgroundMode;
    desktopScale: number;

    // General tab - Mobile appearance
    mobileBackground: BackgroundMode;
    mobileScale: number;

    // General tab - Formatting
    dateFormat: string;
    timeFormat: string;

    // Navigation pane tab
    skipAutoScroll: boolean;
    showSectionIcons: boolean;
    showShortcuts: boolean;
    showRecentNotes: boolean;
    recentNotesCount: number;
    collapseBehavior: ItemScope;
    smartCollapse: boolean;
    colorIconOnly: boolean;
    toolbarVisibility: ToolbarVisibilitySettings;
    showNoteCount: boolean;
    separateNoteCounts: boolean;
    navIndent: number;
    navItemHeight: number;
    navItemHeightScaleText: boolean;
    rootLevelSpacing: number;

    // Folders & tags tab
    autoSelectFirstFileOnFocusChange: boolean;
    autoExpandFoldersTags: boolean;
    showFolderIcons: boolean;
    showRootFolder: boolean;
    inheritFolderColors: boolean;
    enableFolderNotes: boolean;
    folderNoteType: FolderNoteCreationPreference;
    folderNoteName: string;
    folderNoteProperties: string;
    hideFolderNoteInList: boolean;
    pinCreatedFolderNote: boolean;
    showTags: boolean;
    showTagIcons: boolean;
    showAllTagsFolder: boolean;
    showUntagged: boolean;
    tagSortOrder: TagSortOrder;
    keepEmptyTagsProperty: boolean;

    // List pane tab
    defaultFolderSort: SortOption;
    revealFileOnListChanges: boolean;
    listPaneTitle: ListPaneTitleOption;
    noteGrouping: ListNoteGroupingOption;
    filterPinnedByFolder: boolean;
    showPinnedGroupHeader: boolean;
    showPinnedIcon: boolean;
    showFileIcons: boolean;
    optimizeNoteHeight: boolean;
    slimItemHeight: number;
    slimItemHeightScaleText: boolean;
    showQuickActions: boolean;
    quickActionRevealInFolder: boolean;
    quickActionAddTag: boolean;
    quickActionAddToShortcuts: boolean;
    quickActionPinNote: boolean;
    quickActionOpenInNewTab: boolean;

    // Notes tab
    useFrontmatterMetadata: boolean;
    frontmatterIconField: string;
    frontmatterColorField: string;
    frontmatterNameField: string;
    frontmatterCreatedField: string;
    frontmatterModifiedField: string;
    frontmatterDateFormat: string;
    saveMetadataToFrontmatter: boolean;
    fileNameRows: number;
    showFileDate: boolean;
    alphabeticalDateMode: AlphabeticalDateMode;
    showFileTags: boolean;
    showFileTagAncestors: boolean;
    colorFileTags: boolean;
    prioritizeColoredFileTags: boolean;
    showFileTagsInSlimMode: boolean;
    showParentFolder: boolean;
    parentFolderClickRevealsFile: boolean;
    showParentFolderColor: boolean;
    showFilePreview: boolean;
    skipHeadingsInPreview: boolean;
    skipCodeBlocksInPreview: boolean;
    previewProperties: string[];
    previewRows: number;
    showFeatureImage: boolean;
    featureImageProperties: string[];
    forceSquareFeatureImage: boolean;
    useEmbeddedImageFallback: boolean;

    // Icon packs tab
    externalIconProviders: Record<string, boolean>;

    // Search & hotkeys tab
    searchProvider: SearchProvider | null;
    keyboardShortcuts: KeyboardShortcutConfig;

    // Advanced tab
    checkForUpdatesOnStart: boolean;
    confirmBeforeDelete: boolean;

    // Runtime state and cached data
    customVaultName: string;
    pinnedNotes: PinnedNotes;
    fileIcons: Record<string, string>;
    fileColors: Record<string, string>;
    folderIcons: Record<string, string>;
    folderColors: Record<string, string>;
    folderBackgroundColors: Record<string, string>;
    folderSortOverrides: Record<string, SortOption>;
    folderAppearances: Record<string, FolderAppearance>;
    tagIcons: Record<string, string>;
    tagColors: Record<string, string>;
    tagBackgroundColors: Record<string, string>;
    tagSortOverrides: Record<string, SortOption>;
    tagAppearances: Record<string, TagAppearance>;
    navigationSeparators: Record<string, boolean>;
    recentColors: string[];
    lastShownVersion: string;
    latestKnownRelease: string;
    lastAnnouncedRelease: string;
    lastReleaseCheckAt: number | null;
    rootFolderOrder: string[];
    rootTagOrder: string[];
}
