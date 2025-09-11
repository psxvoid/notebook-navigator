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
        version: '1.4.13',
        date: '2025-09-11',
        showOnUpdate: true,
        new: ['You can now **drag and drop files** from your operating system directly onto folders to import them into your vault.'],
        changed: [
            'The toolbar button "Show notes from subfolders" was renamed to **Show notes from descendants** and now applies to both folders and tags.',
            'The command **Toggle notes from subfolders** was renamed to "Toggle notes from descendants" (ID: toggle-descendant-notes). Please update your hotkeys.',
            'File names show extension suffix for all files except md, canvas and base.'
        ],
        fixed: [
            'Toggling **Show hidden items** now properly focuses the selected item in the navigation pane. Also greatly improved the scrolling logic.'
        ],
        improved: ['Tag view now shows parent folder for each note when "Show parent folder names" is enabled.']
    },
    {
        version: '1.4.12',
        date: '2025-09-10',
        showOnUpdate: false,
        fixed: [
            'Folders now properly show an expansion arrow when they contain only hidden subfolders while "Show hidden items" is enabled.',
            'Mobile keyboard hides correctly when switching from list pane to navigation pane.'
        ]
    },
    {
        version: '1.4.11',
        date: '2025-09-09',
        showOnUpdate: true,
        improved: [
            'Folders, tags, and files now use **natural sorting** that compares number sequences by value (e.g., "note2" is now listed before "note10").'
        ],
        changed: [
            'Tag metadata (colors, icons, appearance, sorting) is no longer automatically cleaned up on startup, as tags may be used occasionally for special items.'
        ],
        fixed: [
            'If **Read metadata from frontmatter** is enabled, metadata changes will now properly trigger updates of file name, sorting, and tooltips when changed.',
            'Fixed an issue where deleting multiple files would not select the next file in the same folder.'
        ]
    },
    {
        version: '1.4.10',
        date: '2025-09-07',
        showOnUpdate: true,
        improved: ['**Quick search** now highlights filename matches in the list pane.'],
        changed: [
            '**File visibility**: You can now choose between documents / supported / all files (was previously "markdown only" / supported / all). Default is "documents" showing md, canvas and base files.',
            '**Show hidden items** now applies to both folders and tags, it just complicated things to have them separate where tags had files in hidden folders etc.'
        ],
        fixed: [
            '**Untagged** no longer includes files from hidden folders unless Show hidden items is enabled.',
            '**Untagged note counter** now only counts markdown files.'
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
