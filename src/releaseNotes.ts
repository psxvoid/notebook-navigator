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
 * 2. If version increased, it shows all release notes between versions
 * 3. If downgraded or same version, it shows the latest 5 releases
 * 4. Individual releases can be marked with showOnUpdate: false to skip auto-display
 * 5. Users can always manually access release notes via plugin settings
 *
 * The lastShownVersion is stored in plugin settings to track what the user has seen.
 */

/**
 * Formatting in release notes
 *
 * Supported inline formats in both info and list items:
 * - Bold text: **text**
 * - Critical emphasis (red + bold): ==text==
 * - Markdown link: [label](https://example.com)
 * - Auto-link: https://example.com
 *
 * Not supported:
 * - Italics, headings, inline code, HTML
 *
 * Writing rules:
 * - Use factual, concise statements
 * - Avoid benefit language and subjective adjectives
 * - Keep to the categories: new, improved, changed, fixed
 */

/**
 * Represents a single release note entry
 */
export interface ReleaseNote {
    version: string;
    date: string;
    /** If false, skip automatic modal display for this version during startup */
    showOnUpdate?: boolean;
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
 * 2. Categorize features into: new, improved, changed, or fixed arrays
 */
const RELEASE_NOTES: ReleaseNote[] = [
    {
        version: '1.9.3',
        date: '2025-12-23',
        showOnUpdate: true,
        info: 'The two major improvements in this release are 1: ==File icons==. You can now define rules so file names with certain text and extensions now show specific icons. 2. You can now ==Resize the pinned shortcuts area==. This makes it much easier to manage a large set of shortcuts. Merry Christmas!',
        new: [
            'New setting: Notes > Appearance > ==Icons by file name==. Map file name substrings to icons. Default disabled.',
            'New setting: Notes > Appearance > ==Icons by file type==. If enabled show category icons for all files. Default disabled.',
            'New setting: Notes > Appearance > ==File name icon map==. You can now set custom icon mappings for text in file names, text=icon.',
            'New setting: Notes > Appearance > ==File type icon map==. You can now set custom icon mappings for file types, extension=icon.',
            'New setting: Folders & tags > ==Spring-loaded folders==. Expand folders and tags on hover during drag operations. Default enabled.',
            'When spring-loaded folders is enabled you now have two new sub-settings: ==First expand delay== and ==Subsequent expand delay== to configure how long to hover before a folder/tag expands during drag operations.',
            'New command: ==Set as folder note==. Renames the active file to its folder note name.',
            'New command: ==Detach folder note==. Detaches and renames the active folder note to a new name.',
            'Public API: Added **navigation.navigateToFolder(folder)** and **navigation.navigateToTag(tag)**.'
        ],
        improved: [
            '==You can now resize the pinned shortcuts area== by dragging the separator line.',
            '==You can now add multiple files to shortcuts== using multi-selection and context menu.',
            '==You can now remove all shortcuts== using the new "Remove all shortcuts" option in the shortcuts context menu.',
            'If you use metadata from frontmatter, you can now enter ==multiple fields for name from frontmatter== such as title, name.'
        ],
        fixed: []
    },
    {
        version: '1.9.2',
        date: '2025-12-17',
        showOnUpdate: true,
        new: [
            'New setting: Notes > Appearance > ==Strip HTML in previews==. Default enabled - removes html tags like <br>, <ul> etc from note previews in list pane.',
            'New setting: General > Filtering > ==Hide files==. You can now hide filenames by pattern, like temp-* or *.png.'
        ],
        improved: [
            'Settings now support the new ==SettingGroup API== in Obsidian 1.11 and later. Settings groups are now clearly outlined in settings.',
            '==Toolbar buttons in iOS== now uses the Liquid Glass style in Obsidian 1.11 and later.',
            'Commands: ==Select next file== and ==Select previous file== no longer reveal the Notebook Navigator view.'
        ],
        changed: ['Bumped DB_CONTENT_VERSION to support HTML tag removal from note previews. Cache will be rebuilt on next startup.'],
        fixed: ['Folders and tags placed in shortcuts no longer show "Add separator" / "Remove separator" menu options']
    },
    {
        version: '1.9.1',
        date: '2025-12-07',
        showOnUpdate: true,
        info: 'Lots of internal improvements in this release. The mobile drag and drop functionality was rewritten from the ground up, pattern matching for hidden folders and tags was greatly improved in performance, and lots of other internal improvements.\n\nThank you all the feedback and suggestions, and thank you for using Notebook Navigator!',
        new: [
            'New setting: **Navigation pane > Behavior > Pin recent notes with shortcuts**. Enable this to pin both shortcuts and recent notes to the top of the navigation pane. Default disabled.',
            'New style setting: **Navigation file text color** (--nn-theme-navitem-file-name-color). Customize the color of files shown in shortcuts and recent files in navigation pane.'
        ],
        improved: [
            "==Creating new Excalidraw and Tldraw documents== now use the names and templates configured in each plugin's settings.",
            '==Drag and drop finally works on all Android devices!== 🎉 Due to persistent issues with HTML5 drag-and-drop on certain Android devices, the entire mobile drag-and-drop implementation for shortcuts and reorder root items was rebuilt from the ground up to use the library **dnd-kit**, https://github.com/clauderic/dnd-kit.',
            '==Android users can now swipe in the middle of the view== to go from list pane to navigation pane.',
            'File operations like **move, delete, create, pin/unpin** now keeps current list scroll position when nothing is selected in the list pane.',
            'Notebook Navigator now also supports **AVIF images** for image previews in list pane.'
        ],
        changed: [
            '==Active vault profile is no longer synced between devices==, so you can have different active vault profiles on different devices.',
            '==Moved zoom level, tag sort order, recent colors, search provider and release check timestamp== from **synced settings** to **local storage**. Settings file is now only used for configuration settings, not UX state.',
            'Significantly optimized **hidden folder** and **hidden tag** pattern matching performance.'
        ],
        fixed: [
            'Creating new notes with "Reading mode" enabled prevented the plugin Templater from inserting templates. This has been fixed by always opening new notes in "Editing mode", just like the built-in file explorer does it.'
        ]
    },
    {
        version: '1.9.0',
        date: '2025-11-30',
        showOnUpdate: true,
        new: [
            '==Tldraw support==. If you have the plugin Tldraw installed you can now create new Tldraw drawings directly from the navigation pane in Notebook Navigator!',
            'New setting: Settings > Folders & tags > Tags > ==Inherit tag colors==. Disable this to prevent tags from inheriting colors from parent tags. Default enabled.',
            'Notebook Navigator has been translated to Russian, Turkish, Ukrainian, Vietnamese, Portuguese, Indonesian, Thai, Persian (Farsi), and Italian. ==Notebook Navigator now supports 21 languages!=='
        ],
        improved: [
            '==The color picker== has been greatly enhanced! You can now toggle between **default colors** and **custom colors**, you can copy and paste colors in the dialog, you can drag and drop colors, and you can even double click to set color and close dialog! Thanks @alltiagocom for your ideas!',
            'You can now ==copy and paste styles like icons and colors== between folders, tags and files! Just use the new **Style menu**!',
            'You can now easily ==remove icons, colors or all styles== from a folder, tag or file using the new **Style menu**.',
            'You can now ==apply colors and icons to multiple files== at once! You can even paste styles to multiple files!',
            'You can now ==reorder vault profiles== in **Settings > General > Filtering**. Click **Edit profiles** to add, rename, delete, or reorder vault profiles.',
            '==Improved the way file tags are rendered== in the list pane. They now respect background color and text color and it just looks so much better!',
            '==Improved Excalidraw support==. When you create a new Excalidraw drawing from the navigation pane, it now opens immediately in drawing mode.',
            '==Duplicating a folder== will now also duplicate icon and color settings for the folder and all subfolders.',
            'Android: Drag and drop now works in shortcuts and reorder root items mode on newer Android devices.',
            'Android: Notebook Navigator now handles custom system font sizes correctly.',
            '"Settings > Folders & tags > Expand on selection" will now also collapse tags and folders on single click.'
        ],
        fixed: ['Fixed an issue where the context menu in navigation pane did not hide if clicking on a folder title.']
    },
    {
        version: '1.8.9',
        date: '2025-11-25',
        showOnUpdate: true,
        new: [
            '==Customizable user colors in the color picker==. The color picker now has 20 editable color slots. Click a slot to select it, then use the picker to change it. Your colors are saved and synced automatically. Use the new toolbar buttons to copy, paste, or reset the palette.',
            'Notebook Navigator has been translated to ==Arabic (ar)==.'
        ],
        fixed: [
            'Notebook Navigator no longer listens to Obsidian workspace "quit" commands, since they apparantly are sent to all plugins when receiving obsidian://open-url requests. This means the plugin thought it was going to quit while Obsidian never shut it down.',
            'Fixed an issue with font scaling on Android devices overriding plugin font sizes.'
        ]
    },
    {
        version: '1.8.8',
        date: '2025-11-24',
        showOnUpdate: true,
        new: [
            'New setting: ==List pane > Appearance > Default list mode==. Choose the default list layout between **standard** and **compact**. **Standard** shows title, date, description, and preview text. **Compact** only shows title. You can override the appearance for each folder or tag.',
            'New setting: ==Notes > Appearance > Show file icons==. Disable to hide all file icons and avoid the indentation in the list pane.'
        ],
        improved: [
            'If you change filename color in Style Settings, that color is now also used in shortcuts and recent notes.',
            'In single pane mode with the setting **Folders & tags > Expand on selection** enabled, first click on a folder or tag with children now expands them in navigation pane, second click shows files pane. This makes it easier to navigate the trees on mobile devices.'
        ],
        changed: [],
        fixed: [
            'Improved Chinese translation for "Reveal" functionality. Now uses "定位" (locate) instead of "显示" (show) to better convey the meaning of revealing/locating files in folders.',
            'Fixed a crash when using tags named "constructor", "toString", or other special JavaScript words. These tag names now work correctly without causing the view to blank out.',
            'Fixed a crash when entering invalid date or time format strings in settings. Invalid formats now fall back to default formatting instead of crashing.',
            'Fixed an issue where multiple menus would show if right clicking many times in the folder tree.'
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

/**
 * Determines whether release notes for the given version should appear automatically on update.
 */
export function isReleaseAutoDisplayEnabled(version: string): boolean {
    const note = RELEASE_NOTES.find(entry => entry.version === version);
    if (!note) {
        return true;
    }
    return note.showOnUpdate !== false;
}
