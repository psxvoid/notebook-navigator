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
 * Release Notes System
 *
 * This module manages the "What's new" feature that shows users what has changed
 * between plugin versions. The system works as follows:
 *
 * 1. On plugin load, it compares the current version with the last shown version
 * 2. If upgraded, it shows all release notes between versions
 * 3. If downgraded or same version, it shows the latest 5 releases
 * 4. Individual releases can be marked with showOnUpdate: false to skip auto-display
 * 5. Users can always manually access release notes via plugin settings
 *
 * The lastShownVersion is stored in plugin settings to track what the user has seen.
 */

/**
 * Represents a single release note entry
 */
export interface ReleaseNote {
    version: string;
    date: string;
    showOnUpdate: boolean; // If false, won't show automatically on upgrade
    info?: string; // General information about the release, shown at top without bullets
    new?: string[];
    improved?: string[];
    changed?: string[];
    fixed?: string[];
}

/**
 * All release notes for the plugin, ordered from newest to oldest.
 *
 * When adding a new release:
 * 1. Add it at the beginning of the array (newest first)
 * 2. Set showOnUpdate to false for minor bug fixes that don't need user attention
 * 3. Categorize features into: new, improved, changed, or fixed arrays
 */
const RELEASE_NOTES: ReleaseNote[] = [
    {
        version: '1.4.0',
        date: '2025-08-26',
        showOnUpdate: true,
        new: [
            '**Public API**. Other plugins and Javascript developers can now interact with Notebook Navigator through a comprehensive API that provides metadata management, navigation control, and event subscriptions. Full TypeScript support included!',
            '**Theming support**. Notebook Navigator now exposes custom CSS properties and provides detailed documentation for theme developers. Theme developers can fully customize colors, selection styles, hover effects, and all UI elements including mobile-specific components.',
            '**Style Settings support**. Full integration with the Style Settings plugin makes it super easy to get Notebook Navigator to look just the way you want it!',
            '**New setting: Optimize note height**. You can now toggle off the automatic height reduction of pinned notes and notes without preview text (default on).',
            '**New setting: Inherit folder colors**. You can now toggle on color inheritance for folders.'
        ],
        changed: [
            '**Pinned notes are now context-aware**. Files are now pinned separately in folder view and tag view, allowing different pinned files for each context.'
        ],
        fixed: [
            'Lots of improvements to the user experience. Featured images scale in size depending on item height, we use native scroll bars on macOS, and the interface was improved in over a dozen places.'
        ]
    },
    {
        version: '1.3.18',
        date: '2025-08-08',
        showOnUpdate: true,
        changed: [
            'Changed the order of the quick action buttons, order is now (1) Reveal in folder, (2) Pin note and (3) Open in new tab. The reason for the change is that we always want the icon that is not always visible to the left so physical position does not change for the other icons.'
        ],
        fixed: [
            "Added Obsidian's official ESLint plugin to the build process, https://github.com/obsidianmd/eslint-plugin. The build will only run if there are 0 errors and 0 warnings.",
            'Fixed the minor issues that the official ESLint plugin revealed, the source code now compiles with 0 errors and 0 warnings.',
            'Upgraded to ESLint v9 with full Obsidian plugin compliance.',
            'Implemented some minor polish to the mobile UX: Background color in navigation pane is now same as list pane, icon stroke width is now standard, tab bar height is now iOS standard).'
        ]
    },
    {
        version: '1.3.17',
        date: '2025-08-07',
        showOnUpdate: true,
        new: [
            '**Path-based folder exclusion**. You can now exclude specific folder paths (e.g., `/archive` to exclude only the root archive folder, not all folders named "archive"). Supports wildcards like `/projects/*` to exclude all subfolders.',
            '**Right-click to exclude folders**. Quickly exclude any folder from the navigation by right-clicking and selecting "Exclude folder". The system automatically cleans up redundant patterns when adding parent folders.',
            '**Improved mobile experience**. The navigation and list pane headers are now optimized for mobile devices with touch-friendly buttons and better spacing.'
        ]
    },
    {
        version: '1.3.16',
        date: '2025-08-07',
        showOnUpdate: false,
        fixed: [
            '**Fixed metadata cleanup not running when tags are disabled**. The cleanup process now runs correctly regardless of the tags setting, ensuring orphaned folder metadata and invalid pinned notes are always removed on startup.',
            '**Fixed empty folders losing their custom properties on restart**. The metadata cleanup now properly preserves settings for empty folders by directly traversing the vault folder tree.'
        ]
    },
    {
        version: '1.3.15',
        date: '2025-08-06',
        showOnUpdate: true,
        new: [
            '**Clickable path segments in header**. You can now click on parent folders or tags in the list pane header to quickly navigate up the hierarchy. For example, in "Projects/Web/Frontend", clicking "Projects" or "Web" will take you directly to that folder.',
            'New quick action: **Open in new tab**. Quickly open notes in a new tab without using the context menu.',
            'New quick action: **Pin note**. Pin or unpin notes directly from the file list hover actions.'
        ],
        improved: [
            'List pane header now always shows the current folder or tag path, instead of being replaced by date group headers when scrolling.'
        ],
        fixed: [
            '**Fixed custom tag colors disappearing on sync to new devices**. Tag metadata cleanup now waits for tags to be fully extracted from files before running, preventing tag colors from being deleted when syncing settings to a device with an empty database.',
            '**Fixed quick actions not appearing in single-pane mode**. The hover effects were only working in dual-pane mode due to how the CSS classes were structured - now they work consistently in both modes.',
            'Fixed folder and tag icons not updating in the list pane header when changing folders and tags.'
        ]
    },
    {
        version: '1.3.14',
        date: '2025-08-06',
        showOnUpdate: true,
        new: [
            'New setting: **Quick actions**. When enabled (default on), quick action icons appear when hovering notes in the list pane.',
            'New quick action: **Reveal in folder**. Click the quick action folder icon to quickly navigate to the actual folder of the file (from parent or tag view).'
        ],
        improved: [
            '**Tag system improvement**: Tags are now stored with separate lowercase paths for logic and canonical display paths for UI. This ensures consistent case-insensitive matching while preserving your preferred tag capitalization throughout the interface.'
        ],
        fixed: [
            '**Tag system improvement**: Tag operations are now case-insensitive. Adding #TODO to a file that already has #todo will be skipped, and removing tags will match regardless of case.',
            '**Tag system improvement**: Tag removal in the UI now shows each unique tag only once (e.g., #todo and #ToDo appear as single option).',
            '**Tag system improvement**: Excluded and ignored tags in settings are now automatically converted to lowercase for consistent matching.'
        ]
    },
    {
        version: '1.3.13',
        date: '2025-08-05',
        showOnUpdate: false,
        fixed: ['Enhanced compatibility with Obsidian updates and other plugins through modernized API usage.']
    },
    {
        version: '1.3.12',
        date: '2025-08-04',
        showOnUpdate: true,
        new: [
            'You can now set custom appearances for each folder and tag! Use the new "Change appearance" button to make each folder or tag have a unique style - like slim mode to show as many items as possible, or 5 preview rows for those folders where you want to see lots of the preview text!',
            'New tag operations in the file context menu: Add tag, Remove tag, and Remove all tags. You can also access them from the command palette. They are smart and use fuzzy search to add tags, and will only show used tags when you want to remove a tag. If you add a tag that is an ancestor of an existing tag, the new tag will replace the current tag.'
        ],
        improved: ['Pinned notes now show at max 1 preview row without parent folder, taking up less vertical space.']
    },
    {
        version: '1.3.11',
        date: '2025-08-03',
        showOnUpdate: true,
        new: [
            'Completely revamped the tag favorites system! You can now right-click any tag to add/remove from favorites! When adding a parent tag (e.g., "photo"), the system intelligently removes redundant child tags (e.g., "photo/camera") from favorites automatically.',
            'Added Alt / Option + Click on folder or tag chevrons to expand/collapse all descendants recursively. Super efficient for managing large tag trees or folder structures.',
            'Added "Folder note properties" setting - automatically add custom frontmatter properties to newly created folder notes.'
        ],
        improved: [
            'Tags in list pane will now use smart sorting: (1) Favorite tags will show first, then (2) Colored tags, then (3) uncolored normal tags. The goal here is to help you quickly find the items you are looking for, and hopefully this helps out if you have many tags assigned to your notes.',
            'Tags now inherit their parent colors, so if you have a parent tag with a color, all child tags will automatically use that color unless they have their own color set.',
            'Many performance optimizations under the hood. Rendering is faster, startup faster, and overall experience is smoother.'
        ],
        fixed: ['Fixed an issue with auto reveal file where it sometimes would not scroll to the selected folder in navigation pane.']
    },
    {
        version: '1.3.10',
        date: '2025-07-31',
        showOnUpdate: false,
        improved: [
            'If a custom sort order is set for a folder, the custom sort button in Pane header will now be highlighted.',
            'Navigation pane on mobile will now auto scroll to the selected folder or tag when view is resized',
            'Improved cold startup time'
        ]
    },
    {
        version: '1.3.9',
        date: '2025-07-30',
        showOnUpdate: true,
        new: ['Added SHIFT+HOME and SHIFT+END keyboard shortcuts for selecting items in the list pane.'],
        improved: ['Slim mode interface now has cleaner appearance with no separator lines and tighter spacing.'],
        fixed: [
            'Fixed file date display not updating when files are modified.',
            'Fixed auto-select behavior to select the first file when navigating to files pane with keyboard in dual pane mode on desktop.'
        ]
    },
    {
        version: '1.3.8',
        date: '2025-07-30',
        showOnUpdate: true,
        improved: [
            'You can now rename the root vault folder! The root vault folder now also uses your current vault name as default, not just "Vault".',
            'Removed markdown tables from preview text - should result in cleaner previews.'
        ],
        fixed: [
            'Changing folders on desktop in single-pane mode will no longer auto select the first file if current folder does not contain the current file (#105).',
            'Tags from excluded folders were showing in the tag tree (including the Untagged section) (#104).',
            'Moving files with tags outside the vault or to ignored folders using Finder or Explorer did not update tag counts properly.'
        ]
    },
    {
        version: '1.3.7',
        date: '2025-07-29',
        showOnUpdate: true,
        improved: [
            'Read metadata from frontmatter: Timestamp format will now no longer fallback to ISO 8601 if parsing fails and will instead show you the number of failed files.',
            'Read metadata from frontmatter: You can now export the files that could not be parsed with your Timestamp format! This markdown file will be saved in your root vault so you can click on the links to go directly to the notes that failed parsing!',
            'Read metadata from frontmatter: You will now see detailed statistics for each field being parsed.',
            'Slim mode can now also show clickable tags. If you only want note title and tags in your list you got it!'
        ],
        fixed: [
            "Ribbon icon now remains in place after plugin load instead of disappearing/reappearing based on Navigator view state, preserving user's custom ribbon ordering.",
            "Replaced direct localStorage usage with Obsidian's vault-specific storage API to properly isolate data between different vaults on the same device.",
            'Replaced verbose toggleClass() calls with cleaner toggle() API for showing/hiding UI elements.',
            'Replaced custom type guard functions with standard instanceof checks, aligning with Obsidian API best practices.',
            'Removed dynamic ribbon icon management that could interfere with user preferences and cause unexpected UI behavior.'
        ]
    },
    {
        version: '1.3.6',
        date: '2025-07-29',
        showOnUpdate: false,
        improved: [
            'Selection rectangle and drop targets in Navigation Pane are now full-width, making it easier to select and work with folders and tags.',
            "Plugin is now always made visible when you run commands, such as 'Reveal file' and 'Focus file'."
        ],
        changed: ['Tags in PaneHeader now show with hashtag prefix (#).']
    },
    {
        version: '1.3.5',
        date: '2025-07-28',
        showOnUpdate: false,
        fixed: [
            'Startup now works better with large vaults and large folders (>10,000 files).',
            'Improved auto reveal behavior for notes in untagged folder when restarting the plugin.',
            "'Reveal in Finder' now says 'Show in system explorer' on Windows PCs."
        ],
        changed: ['Default value for Preview rows is now 2.']
    },
    {
        version: '1.3.4',
        date: '2025-07-27',
        showOnUpdate: true,
        new: [
            'Show file tags! Tags are now shown for each file in the file list! They use your tag colors and you can click them to quickly switch to the right tag in the tag tree!',
            "'Reveal in folder' menu command - Same functionality as 'Reveal file' command. Useful with 'Show notes from subfolders' enabled or when working with tags."
        ],
        improved: [
            'Tag navigation enhancements - Restarting the app remembers your selected tag. Files opened in the editor now show in the tag tree if they have tags (or untagged if enabled). Enables 100% tag-based workflow.',
            'Cleaner drag and drop visuals for easier file management.',
            'Eliminated tiny flicker when changing folders/tags where selected item was temporarily deselected.',
            'Many minor tweaks, improvements and polishes throughout the app.'
        ],
        changed: ['Tag storage in database was restructured - you will need to re-assign icons to your tags.']
    },
    {
        version: '1.3.3',
        date: '2025-07-24',
        showOnUpdate: false,
        improved: [
            'Keyboard input is now only captured within the Notebook Navigator window. So if you press DELETE in your canvas document it will not be captured by Notebook Navigator.'
        ],
        changed: ["Default setting for 'Show file types' is now 'Supported files'."],
        fixed: [
            'Scroll to selected file is now working much better. Current solution is clean, robust and future proof.',
            'Preview text filter improvements. Spent lots of time improving the filtering system to remove markdown symbols from preview text. Now properly removes 21 different formatting styles from preview text.'
        ]
    },
    {
        version: '1.3.2',
        date: '2025-07-23',
        showOnUpdate: true,
        new: ["Added setting: 'Preview properties'. You can now specify frontmatter properties to use as preview text."],
        improved: [
            'Migrated to IndexedDB with RAM cache for database storage, significantly improving performance and reliability with large vaults.',
            'Files with no preview text now render with just 1 preview text line for better readability.'
        ],
        changed: [
            "The setting 'Skip text before first heading' was removed since it added too much performance overhead.",
            "The setting 'Skip non-text in preview' was removed since it is now always applied."
        ],
        fixed: ['Preview text generation now properly excludes code blocks and most markdown markers.']
    },
    {
        version: '1.3.1',
        date: '2025-07-20',
        showOnUpdate: true,
        new: [
            'Support for EMOJI icons! Notebook Navigator now also has an Icon provider module for further expansions.',
            "Added command 'Navigate to Tag'.",
            "Added folder menu option 'Reveal in Finder / System explorer'.",
            "Added preview text setting 'Skip text before first heading'."
        ],
        improved: [
            'Added an advanced caching system for all display elements. This significantly improves overall performance when using the plugin.',
            'Mobile clients now persist state perfectly when switching between plugin and editor.',
            'Significantly increased scrolling performance where all items now have predetermined heights.',
            'Lots of internal tweaks and optimizations, code is now in an excellent state for further development.'
        ]
    }
];

/**
 * Gets all release notes between two versions (inclusive).
 * Used when upgrading to show what's changed since the last version.
 *
 * @param fromVersion - The starting version (usually the previously shown version)
 * @param toVersion - The ending version (usually the current version)
 * @returns Array of release notes between the versions, or latest notes if versions not found
 */
export function getReleaseNotesBetweenVersions(fromVersion: string, toVersion: string): ReleaseNote[] {
    const fromIndex = RELEASE_NOTES.findIndex(note => note.version === fromVersion);
    const toIndex = RELEASE_NOTES.findIndex(note => note.version === toVersion);

    // If either version is not found, fall back to showing latest releases
    if (fromIndex === -1 || toIndex === -1) {
        return getLatestReleaseNotes();
    }

    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    return RELEASE_NOTES.slice(startIndex, endIndex + 1);
}

/**
 * Gets the most recent release notes.
 * Used for manual "What's new" access and as fallback.
 *
 * @param count - Number of latest releases to return (defaults to 5)
 * @returns Array of the most recent release notes
 */
export function getLatestReleaseNotes(count: number = 5): ReleaseNote[] {
    return RELEASE_NOTES.slice(0, count);
}

/**
 * Determines if the "What's new" modal should automatically show for a specific version.
 *
 * @param version - The version to check
 * @returns true if the modal should show automatically, false if it should be skipped
 */
export function shouldShowReleaseNotesForVersion(version: string): boolean {
    const releaseNote = RELEASE_NOTES.find(note => note.version === version);
    // Default to true if showOnUpdate is not specified
    return releaseNote?.showOnUpdate !== false;
}

/**
 * Compares two semantic version strings.
 *
 * @param v1 - First version string (e.g., "1.2.3")
 * @param v2 - Second version string (e.g., "1.2.4")
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;

        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }

    return 0;
}
