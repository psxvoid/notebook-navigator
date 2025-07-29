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
    showOnUpdate?: boolean; // If false, won't show automatically on upgrade (defaults to true)
    features: string[];
}

/**
 * All release notes for the plugin, ordered from newest to oldest.
 *
 * When adding a new release:
 * 1. Add it at the beginning of the array (newest first)
 * 2. Set showOnUpdate to false for minor bug fixes that don't need user attention
 * 3. Features should start with NEW:, IMPROVED:, CHANGED: or FIXED:
 */
const RELEASE_NOTES: ReleaseNote[] = [
    {
        version: '1.3.6',
        date: '2025-07-29',
        showOnUpdate: false,
        features: [
            'IMPROVED: Selection rectangle and drop targets in Navigation Pane are now full-width, making it easier to select and work with folders and tags.',
            "IMPROVED: Plugin is now always made visible when you run commands, such as 'Reveal file' and 'Focus file'.",
            'CHANGED: Tags in PaneHeader now show with hashtag prefix (#).'
        ]
    },
    {
        version: '1.3.5',
        date: '2025-07-28',
        showOnUpdate: false,
        features: [
            'FIXED: Startup now works better with large vaults and large folders (>10,000 files).',
            'FIXED: Improved auto reveal behavior for notes in untagged folder when restarting the plugin.',
            "FIXED: 'Reveal in Finder' now says 'Show in system explorer' on Windows PCs.",
            'CHANGED: Default value for Preview rows is now 2.'
        ]
    },
    {
        version: '1.3.4',
        date: '2025-07-27',
        showOnUpdate: true,
        features: [
            'NEW: Show file tags! Tags are now shown for each file in the file list! They use your tag colors and you can click them to quickly switch to the right tag in the tag tree!',
            "NEW: 'Reveal in folder' menu command - Same functionality as 'Reveal file' command. Useful with 'Show notes from subfolders' enabled or when working with tags.",
            'IMPROVED: Tag navigation enhancements - Restarting the app remembers your selected tag. Files opened in the editor now show in the tag tree if they have tags (or untagged if enabled). Enables 100% tag-based workflow.',
            'IMPROVED: Cleaner drag and drop visuals for easier file management.',
            'IMPROVED: Eliminated tiny flicker when changing folders/tags where selected item was temporarily deselected.',
            'IMPROVED: Many minor tweaks, improvements and polishes throughout the app.',
            'CHANGED: Tag storage in database was restructured - you will need to re-assign icons to your tags.'
        ]
    },
    {
        version: '1.3.3',
        date: '2025-07-24',
        showOnUpdate: false,
        features: [
            'IMPROVED: Keyboard input is now only captured within the Notebook Navigator window. So if you press DELETE in your canvas document it will not be captured by Notebook Navigator.',
            "CHANGED: Default setting for 'Show file types' is now 'Supported files'.",
            'FIXED: Scroll to selected file is now working much better. Current solution is clean, robust and future proof.',
            'FIXED: Preview text filter improvements. Spent lots of time improving the filtering system to remove markdown symbols from preview text. Now properly removes 21 different formatting styles from preview text.'
        ]
    },
    {
        version: '1.3.2',
        date: '2025-07-23',
        showOnUpdate: true,
        features: [
            "NEW: Added setting: 'Preview properties'. You can now specify frontmatter properties to use as preview text.",
            'IMPROVED: Migrated to IndexedDB with RAM cache for database storage, significantly improving performance and reliability with large vaults.',
            'IMPROVED: Files with no preview text now render with just 1 preview text line for better readability.',
            "CHANGED: The setting 'Skip text before first heading' was removed since it added too much performance overhead.",
            "CHANGED: The setting 'Skip non-text in preview' was removed since it is now always applied.",
            'FIXED: Preview text generation now properly excludes code blocks and most markdown markers.'
        ]
    },
    {
        version: '1.3.1',
        date: '2025-07-20',
        showOnUpdate: true,
        features: [
            'NEW: Support for EMOJI icons! Notebook Navigator now also has an Icon provider module for further expansions.',
            "NEW: Added command 'Navigate to Tag'.",
            "NEW: Added folder menu option 'Reveal in Finder / System explorer'.",
            "NEW: Added preview text setting 'Skip text before first heading'.",
            'IMPROVED: Added an advanced caching system for all display elements. This significantly improves overall performance when using the plugin.',
            'IMPROVED: Mobile clients now persist state perfectly when switching between plugin and editor.',
            'IMPROVED: Significantly increased scrolling performance where all items now have predetermined heights.',
            'IMPROVED: Lots of internal tweaks and optimizations, code is now in an excellent state for further development.'
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
