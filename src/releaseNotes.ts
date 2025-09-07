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
        version: '1.4.9',
        date: '2025-09-07',
        showOnUpdate: true,
        info: 'Important: Since the plugin is not yet approved I took the opportunity to rename four command IDs. The new names are: `open`, `toggle-notes-from-subfolders`, `delete-files` and `new-note`. Please update your hotkeys.',
        new: [
            '**Smart collapse**: The collapse button now keeps the currently selected folder or tag and its parents expanded when collapsing. This can be disabled in settings.',
            '**Collapse command**: New command to trigger collapse / expand. Assign a hotkey for quick access, try using this with Auto-expand folders and tags for a super efficient workflow!'
        ],
        improved: ['**Auto-expand folders and tags** in settings now also auto-collapses items when expanded.'],
        changed: ['**Auto-expand button removed** from the toolbar. The setting remains available in the plugin settings panel.']
    },
    {
        version: '1.4.8',
        date: '2025-09-05',
        showOnUpdate: true,
        new: [
            'New button: **Show hidden items**. Quickly show hidden folders and tags with the new navigation button.',
            'New setting: **Show hidden items**. Control which items are affected by the show/hide button: all items, folders or tags.',
            'New command: **Toggle hidden items**. Show or hide excluded items with the new shortcut command.',
            'New tag context menu option: **Hide tag**. Hide a tag from the navigation pane with smart filtering logic.'
        ],
        changed: [
            'On startup, the view will now only reset to single pane **on the first startup** if the view is too narrow. Previously it checked on every startup.',
            '**Untagged section** will now only show markdown files, even if other types are enabled in settings, since only markdown documents can have tags.'
        ],
        fixed: ['Some icons were missing for some of the context menu options.']
    },
    {
        version: '1.4.7',
        date: '2025-09-04',
        showOnUpdate: true,
        changed: [
            '**Startup behavior**: Notebook Navigator no longer auto-reveals the current file in its actual folder during startup. Instead when "Show notes from subfolders" is enabled it now stays in the selected ancestor folder.',
            '**Auto-select first note (desktop only)** now defaults to **false** based on user feedback. The reason for having it set to **true** by default was to match behavior with Apple Notes.'
        ],
        fixed: [
            'The **Notebook Navigator: Open** command now properly activates the navigator view when it is already open but hidden behind another in sidebar view.',
            '**Multi-selection scrolling** with Shift + Up / Down now properly focuses the file where the cursor is.',
            'Fixed an issue where **Tab / Enter keys** in the search field would not always move focus to list pane.',
            'Filtering list with a search query now **scrolls to top** when there is no selected file in the list.'
        ]
    },
    {
        version: '1.4.6',
        date: '2025-09-03',
        showOnUpdate: true,
        fixed: ['Untagged notes folder would not show immediately when enabled from settings (only showed after restart).']
    },
    {
        version: '1.4.5',
        date: '2025-09-03',
        showOnUpdate: true,
        info: 'Thanks a lot for using Notebook Navigator! In this release we have a great new feature: Quick search, to instantly filter files in the current folder or tag! Bind it to a shortcut key like CMD+SHIFT+S to quickly open or focus the quick search field. Use Tab or Enter to move focus to the file list, use Shift+Tab to move to navigation pane, or Esc to close.',
        new: [
            '**Quick search**. Filter files in the current folder or tag with the new search button in the toolbar.',
            '**Search command**. Access quick search from anywhere with the new Notebook Navigator: Search command.',
            '**New theme variable**. `--nn-theme-list-header-search-active-bg` to customize the search field background when active. Also available in Style Settings.'
        ],
        improved: [
            'The **Open** command now moves focus to list pane if the plugin is already open. Use this for keyboard first navigation.'
        ],
        changed: [
            'Removed the now redundant **Focus file** command since the **Open** command now handles both opening and focusing. Make sure to update your hot keys.'
        ],
        fixed: ['Non-markdown files now correctly stay pinned when the plugin restarts.']
    },
    {
        version: '1.4.4',
        date: '2025-09-02',
        showOnUpdate: true,
        new: [
            'New setting: **Item height**. Adjust the height of folders and tags in the navigation pane.',
            'New setting: **Tree indentation**. Adjust the indentation width for nested folders and tags.'
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
