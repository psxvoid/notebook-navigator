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
