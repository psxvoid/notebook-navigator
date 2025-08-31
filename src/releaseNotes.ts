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
        version: '1.4.3',
        date: '2025-08-31',
        showOnUpdate: false,
        fixed: ['The Help buttons for date strings in Settings are now visible again (they had invalid icons).']
    },
    {
        version: '1.4.2',
        date: '2025-08-30',
        showOnUpdate: false,
        new: [
            'New setting: **Use embedded image fallback**. Default ON, uses the first embedded image in the document as a fallback when no thumbnail is found in frontmatter properties. Disable to verify that thumbnails are properly configured.'
        ]
    },
    {
        version: '1.4.1',
        date: '2025-08-29',
        showOnUpdate: true,
        new: [
            'New Style Settings parameter: **Tree indentation** to adjust the indentation width for each folder and tag in the navigation pane.'
        ],
        fixed: ['Removed legacy ESLint 8 support from build process. Added more rules to ESLint 9 config file.']
    },
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
