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
        version: '1.7.3',
        date: '2025-11-02',
        showOnUpdate: true,
        new: [
            '==Multi-tag selection!== This is huge! You can now command+click tags to select multiple tags in list pane with "AND", or shift+command+click to select multiple tags with "OR". This updates the search field, and you can save these filters for future use!',
            '==You can now override "Group by" for each tag and folder==. Just click the "Change appearance" toolbar button in list pane.',
            'New setting: ==List Pane > Appearance > Slim item height==. Reduce line spacing in list pane with slim mode enabled.',
            'New setting: ==List Pane > Appearance > Show pinned group header==. Toggle to hide the section header above pinned notes.',
            'New setting: ==Navigation Pane > Appearance > Root folder spacing==. Use it to add extra spacing between root folders and tags in navigation pane. Especially useful when you use background colors with inheritance.',
            'New setting: ==Notes > Appearance > Show parent folder colors==. When enabled, parent folder names in list pane will use their text color from navigation pane. Enabled by default.',
            'Added "Reveal in Notebook Navigator" to folder menus. Right clicking a folder in Obsidian opens it in Notebook Navigator.',
            'Three new localizations: Dutch (nl), Italian (it) and Portuguese / Brazil (pt-BR).'
        ],
        improved: [
            'You can now click the "Tags" folder to view all notes with tags.',
            'Significantly improved the way background color renders in navigation pane. This is a huge upgrade if you use background color for folders and tags in your vault!',
            'Horizontal rules are now removed from preview text.',
            'Added two new theme variables for selected folder and selected file name when pane is inactive: --nn-theme-navitem-selected-inactive-name-color and --nn-theme-file-selected-inactive-name-color.',
            'When using "Group by subfolder" the current folder name will no longer display as a group.',
            'File reveal now preserve folder selection when "Show notes from subfolders" is enabled and a descendant folder contains the file.'
        ],
        changed: ['Changed ZH-CN translation for "Untitled" to 未命名 to match Obsidian default.'],
        fixed: [
            'Date parsing in frontmatter now uses correct locale handling.',
            'Drag and drop is broken on Android devices due to a Chromium bug. This was fixed by implementing a popup menu on Android devices to rearrange items.'
        ]
    },
    {
        version: '1.7.2',
        date: '2025-10-28',
        showOnUpdate: false,
        new: [
            'New setting: ==Show pinned notes in parent folder only==. When enabled, pinned notes are only shown when their parent folder is selected in navigation pane. Useful if you have many pinned notes.'
        ],
        changed: [
            'Removed the extra separator bar between navigation pane and list pane in vertical split mode since it looked bad with some themes.',
            'The setting "Dual pane orientation" is now always shown even if Dual pane is disabled, to make it easier to find.'
        ],
        fixed: ['Fixed an issue when renaming files with multiple periods in the name, causing incorrect extension in the final name.']
    },
    {
        version: '1.7.1',
        date: '2025-10-28',
        showOnUpdate: true,
        new: [
            '**VERTICAL SPLIT!** You now have a new setting: ==Dual pane orientation== where you can choose **horizontal or vertical split** for the dual pane.',
            'To match this setting you also have a new setting: ==Background color (mobile & desktop)== where you can choose to use separate background colors for both panes (like current), make both panes look like navigation pane, or make both panes look like list pane.',
            "New ==UI Zoom for Notebook Navigator==! You can now set a custom zoom level for Notebook Navigator independent of Obsidian's zoom level. Separate for desktop and mobile! This is useful if you want to have a larger or smaller font size in Notebook Navigator without affecting the rest of Obsidian. Find it in Settings → Zoom Level!",
            'You can now also ==group files by subfolder==! The old setting "Group notes by date" is now replaced with a dropdown where you can choose no grouping, date or folder. Note that tags are always sorted by date or none.',
            'New command: ==Pin all folder notes==. Use it to quickly pin all folder notes in the vault.',
            'New command: ==Toggle tag sort order==. Use it to quickly switch between alphabetical and frequency based sorting for tags.',
            'New setting: ==Date display for name sort==. Choose which date to display when sorting notes by name (modified or created).',
            'New setting: ==Keep scroll position for shortcuts==. Preserves navigation pane position when activating folder or tag shortcuts.',
            'New setting: ==Retain tags property after removing last tag==. When enabled, the tags property is kept in frontmatter even when the last tag is removed from a note. Default disabled.',
            'New setting: ==Reset pane separator position==. Use it to reset the separator between navigation and list panes back to default position.'
        ],
        improved: [
            'Files hidden by property are now shown when "Show hidden items" is toggled with the toolbar button in navigation pane or the command "Toggle hidden items".',
            'You can now right-click shown hidden folders and choose "Unhide" without going to settings.',
            '"Folder Note Properties" can now be entered as a text area for full control of what is copied to frontmatter.',
            'New option for "Default folder note type": "Ask". Will now ask you if you want to create a Markdown, Canvas or Base when creating a new folder note from the context menu. Thanks @artuncolak for the PR!',
            'If your homepage is open in another tab during startup, it will now be focused instead of opening it again in the current tab.',
            'You can now scroll the file tags in list pane if there are many tags.'
        ],
        changed: [
            'The toolbar settings for "Show hidden items", "Search"  and "Show notes from subfolders" are no longer synced across devices. All toolbar buttons were reset as an effect of this, so you have to click the ==pin shortcuts== toolbar button after upgrading.'
        ],
        fixed: [
            'Fixed a startup crash issue when parsing tags with double slash in their path, like #tag//subtag. Thanks @kennethn for helping me fix this one.',
            'Fixed a crash when resizing left pane while using banner image. The scrollbar that appears triggered an infinite render loop. Thanks @muttleydosomething for all the amazing help solving this one.',
            'Fixed an issue where root folder added to shortcuts would show without name and with the wrong icon.',
            'Fixed an issue where the style setting "Selected file parent folder color" did not work.',
            'Fixed an issue where the style settings "Selection background for folders and tags" applied to list pane.',
            'Fixed two drag and drop issues: Dragging a file from a subfolder to the list pane would cause it to move to the current folder, and dragging and holding in listpane would incorrectly cause the current folder to expand in navigation pane.',
            'Files and tags in shortcuts area now properly show background color.',
            'Fixed a bug where IME preedit text was not replaced on commit, causing duplicated Latin input when typing with a Chinese IME active.',
            'Excalidraw files now display with clean names (without .excalidraw suffix) and maintain correct list item height when renamed.'
        ]
    },
    {
        version: '1.6.3',
        date: '2025-10-22',
        showOnUpdate: false,
        new: [
            'If "Multi-select modifier" in List Pane Settings is set to Alt/Option, you can now use Ctrl/Cmd + click to open folder notes in a new tab.'
        ],
        fixed: [
            'Fixed **drag and drop issues** on Android devices caused by a bug in Chromium 128+, see https://issues.chromium.org/issues/40820174',
            '**Tags from notes in hidden folders** no longer hide matching tags if the tags exist in visible notes.',
            '**Folder notes are now shown** after being created from the context menu without having to collapse or expand the parent folder.',
            '**Preview text** now strips empty task markers, keeps blockquote text, and always keeps inline code.'
        ]
    },
    {
        version: '1.6.2',
        date: '2025-10-21',
        showOnUpdate: false,
        fixed: [
            'Fixed an issue where some icons in Font awesome were missing.',
            'Fixed a startup issue on mobile devices if default pane was set to navigation and a tag was selected, it would always try to switch to list pane.'
        ]
    },
    {
        version: '1.6.1',
        date: '2025-10-20',
        showOnUpdate: true,
        info: [
            'In this release I have some good news and some bad news. The bad news is that I had to remove the **favorite tags** section due to architectural complexity. It made the codebase very hard to maintain with special cases everywhere. The good news is that you can now sort root tags manually just like folders, so you can still put your favorite tags or untagged notes at the top of the tag list.',
            'My plan is to continue developing and improving this plugin for a long time. Years, maybe even decades. This is why some features might be cut in future releases, but right now I am quite happy with the internal architecture so I do not see this happening with any other features in the near future.',
            'Thank you for using Notebook Navigator!'
        ].join('\n\n'),
        new: [
            'You can now ==reorder sections== like Shortcuts, Recent files, Notes and Tags in the navigation pane. Just drag and drop the section headers in the updated "Reorder root folders and tags" mode accessible through a toolbar button in navigation pane.',
            'You can now change ==sort order for root tags==, just like folders. Just click the button "Reorder root folders and tags" in the navigation pane.',
            'Support for ==back and forward mouse buttons==! Use them on desktop in single pane to quickly switch between navigation and list panes.',
            'Two new style settings: ==Navigation pane transparency== and ==List pane transparency==. You can now make the navigation and list pane transparent (remove background).',
            '**COMMANDS**',
            'New command: ==Add to shortcuts==. Adds the current file, folder, or tag to shortcuts.',
            '**SETTINGS**',
            'New setting: ==Pin created folder notes==. Automatically pin folder notes when created from the context menu. Default disabled.',
            'New setting: ==Separate note counts==. Display separate counts for current folder/tag notes and descendant notes ("2 ▾ 5" instead of "7"). Default enabled.',
            'New setting: ==Show path==. Display the folder path below note names in tooltips. Default enabled.',
            '**MENUS**',
            'New folder menu item: =="Move to..."==. Opens a modal to move the folder to another location.',
            'New file menu items: ==Copy path== and ==Copy relative path==.',
            '==New menu== when right-clicking empty area in list pane: Create new note, folder, canvas, base or drawing.'
        ],
        changed: [
            '**Favorite tags section is removed**. I am sorry about this change, but having a separate favorite tags section caused an architectural nightmare that caused special wiring all over the application. To get a similar experience you can sort tags by frequency, or reorder root tags manually.'
        ],
        improved: [
            'Hidden tags are now also hidden in the list pane ("file tags").',
            'Icon packs will now update automatically if version number in the plugin distribution is newer than the downloaded version.'
        ],
        fixed: [
            'Fixed a rare startup crash that hid Notebook Navigator during startup after enabling the plugin.',
            'Fixed an issue where shortcuts could not be reordered on Android devices.',
            'Fixed scroll to active note in list pane when toggling "Show notes from descendants".',
            'Tab buttons in settings are now rendered properly with various themes.',
            'Fixed issues with text preview filter: italic text, inline code, quotes, footnotes, tasks are now handled properly.'
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
