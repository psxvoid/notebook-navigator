![Notebook Navigator Banner](https://github.com/johansan/notebook-navigator/blob/main/images/banner.png?raw=true)

Available in: English • Deutsch • Español • Français • 日本語 • 中文

![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=Downloads&query=%24%5B%22notebook-navigator%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![Obsidian Compatibility](https://img.shields.io/badge/Obsidian-v1.8.0+-483699?logo=obsidian&style=flat-square)
[![Discord](https://img.shields.io/discord/1405458145974943846?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/6eeSUvzEJr)

Notebook Navigator is a plugin for [Obsidian](https://obsidian.md) that replaces the default file explorer with a Notes-style interface with a dual-pane layout.

If you love using Notebook Navigator, please consider [buying me a coffee](https://buymeacoffee.com/johansan) or [Sponsor on GitHub ❤️](https://github.com/sponsors/johansan).

<a href="https://www.buymeacoffee.com/johansan" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

<br>

## Getting started

1. **Install Obsidian** - Download and install from [obsidian.md](https://obsidian.md/)
2. **Enable community plugins** - Go to Settings → Community plugins → Turn on community plugins
3. **Install Notebook Navigator** - Click "Browse" → Search for "Notebook Navigator" → Install
4. **Install Featured Image** - For automatic thumbnail generation, install [Featured Image](https://github.com/johansan/obsidian-featured-image) plugin to create optimized thumbnails for all your documents

For precise image management, consider also installing [Pixel Perfect Image](https://github.com/johansan/pixel-perfect-image) which lets you resize images to exact pixel dimensions and perform advanced image operations.

<br>

## Features

![Notebook Navigator Screenshot](https://github.com/johansan/notebook-navigator/blob/main/images/notebook-navigator.png?raw=true)

### Interface

- **Dual-pane layout** - Navigation pane on the left (folders and tags), list pane on right (files)
- **Single-pane layout** - Default on mobile, optional on desktop. Switch between navigation and file list
- **Mobile optimized** - Touch-friendly interface with properly sized buttons for Android, iOS and iPadOS
- **Multi-language support** - English, Deutsch, Español, Français, 日本語, 中文
- **RTL language support** - Right-to-left languages with proper layout mirroring (e.g., العربية)
- **Resizable panes** - Adjust the split between navigation and list pane

### Navigation

- **Hierarchical folder tree** - Browse nested folders with expand/collapse controls
- **Hierarchical tag tree** - Browse nested tags with parent/child relationships (e.g., `projects/work/urgent`)
- **Auto-reveal active file** - Automatically expand folders and scroll to current file
- **Breadcrumb navigation** - Click any segment in the header path to jump to parent folders or tags
- **Keyboard navigation** - Full navigation with arrow keys, Tab, Page Up/Down, Home/End
- **Multi-selection** - Select multiple files with Cmd/Ctrl+Click and Shift+Click

### Organization

- **Pin notes** - Keep important notes at the top of folders and tags
- **Folder notes** - Turn folders into clickable links with associated notes
- **Custom colors** - Set colors for folders and tags
- **Custom icons** - Choose Lucide icons or emojis for folders and tags
- **Custom sort order** - Override global sort settings per folder or tag
- **Custom appearances** - Configure display settings per folder or tag (title rows, preview rows, slim mode)
- **Favorite tags** - Pin frequently used tags to a dedicated section
- **Hidden tags** - Hide tags with wildcard and regex patterns
- **Untagged notes** - Find and organize notes without tags

### File display

- **Note previews** - Display 1-5 lines of text from each note
- **Feature images** - Display thumbnail images from frontmatter or first embedded image
- **Date grouping** - Group notes by Today, Yesterday, This Week when sorted by date
- **Frontmatter support** - Read note names and timestamps from frontmatter fields
- **Note metadata** - Show modification date and tags in the file list
- **Slim mode** - Compact display when preview, date, and images are disabled
- **Clickable tags** - Tags in file list navigate directly to that tag

### Productivity

- **Quick actions** - Hover buttons for open in new tab, pin, and reveal in folder
- **Drag & drop** - Move files between folders, drag to tags to add tags, drag to Untagged to remove tags
- **Tag operations** - Add, remove, or clear tags via context menu and commands
- **File operations** - Create, rename, delete, duplicate, move files and folders
- **Filtering** - Exclude folders and notes with patterns, wildcards, and frontmatter properties
- **Search commands** - Quick navigation to any folder or tag via command palette

### Advanced theming support

- **Style Settings integration** - Full support for the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin
- **80 CSS variables** - Complete set of `--nn-theme-*` variables for colors, backgrounds, and visual elements
- **Light/dark mode support** - Separate theming for light and dark modes
- **[Complete theming guide](docs/theming-guide.md)** - Detailed documentation with examples

### Developer API

- **Public API for JavaScript/TypeScript** - API for plugins and scripts to interact with Notebook Navigator
- **Metadata control** - Set folder/tag colors, icons, and manage pinned notes programmatically
- **Navigation & selection** - Navigate to files and query current selections
- **Event subscriptions** - Subscribe to Notebook Navigator events
- **Full type definitions** - Complete TypeScript support
- **[Complete API documentation](docs/api-reference.md)** - Detailed reference with examples

<br>

## Code quality & compliance

- **Obsidian ESLint Plugin** - Full compliance with [Obsidian's official ESLint plugin](https://github.com/obsidianmd/eslint-plugin)
- **Zero-Tolerance Build Process** - Build aborts on any error or warning
- **Zero-Tolerance Code Quality** - Strict ESLint configuration with `no-explicit-any` enforced. 0 errors, 0 warnings across 30,000 lines of TypeScript
- **Comprehensive Validation** - TypeScript, ESLint, Knip (dead code detection), and Prettier

<br>

## Architecture & performance

- **React + TanStack Virtual** - React architecture with virtualized rendering. Handles 100,000+ notes
- **IndexedDB + RAM Cache** - Dual-layer caching with metadata mirrored in RAM for synchronous access
- **Batch Processing Engine** - Content generation with parallel processing, debounced queuing, and cancellation
- **Unified Cleanup System** - Validates metadata (folders, tags, pins) in single pass during startup

<br>

## Documentation

- [**API Reference**](docs/api-reference.md) - Public API documentation. Covers metadata management, navigation control and event subscriptions for JavaScript/TypeScript developers.

- [**Theming Guide**](docs/theming-guide.md) - Guide for theme developers. Includes CSS class reference, custom
  properties, and theme examples for light and dark modes.

- [**Startup Process**](docs/startup-process.md) - Plugin initialization sequence. Cold boot vs warm boot flows,
  metadata cache resolution, deferred cleanup, and content generation pipeline. Includes Mermaid diagrams.

- [**Storage Architecture**](docs/storage-architecture.md) - Guide to storage containers (IndexedDB, Local Storage,
  Memory Cache, Settings). Data flow patterns and usage guidelines.

- [**Rendering Architecture**](docs/rendering-architecture.md) - React component hierarchy, virtual scrolling with
  TanStack Virtual, performance optimizations, and data flow.

- [**Service Architecture**](docs/service-architecture.md) - Business logic layer: MetadataService, FileSystemOperations, ContentProviderRegistry. Dependency injection patterns and service data flow.

<br>

## How to use

1. Install the plugin from Obsidian's Community Plugins
2. The navigator will replace your default file explorer
3. Navigate using:
   - **Click** to select folders, tags, and notes
   - **Cmd/Ctrl+Click** to add notes to selection
   - **Shift+Click** to select a range of notes
   - **Double-click** folders and tags to expand/collapse
   - **Option/Alt+Click** on chevrons to expand/collapse all descendants
   - **Arrow keys** for navigation
   - **Tab** to switch between navigation pane and list pane
   - **Delete/Backspace** to delete (with optional confirmation)
4. Right-click for context menus:
   - Pin/unpin notes
   - Create new notes, folders, canvas, or drawings
   - Open notes in new tabs or windows
   - Rename, delete, or duplicate items
   - Move files to another folder
   - Add tag - Add tags to selected files
   - Remove tag - Remove specific tags from selected files
   - Remove all tags - Clear all tags from selected files
   - Change or remove folder/tag colors and icons
   - Create or delete folder notes
   - Open version history or reveal in system explorer
   - Reveal in folder - switches to the file's containing folder (useful when viewing notes from subfolders or tags)
5. Drag and drop notes between folders to organize, drag to tags to add tags, or drag to Untagged to remove all tags.
   For more precise tag management, use the right-click context menu options

**Tip:** Use the ribbon icon (folder tree icon) in the left sidebar to reopen Notebook Navigator if closed.

<br>

## Keyboard shortcuts

| Key                                         | Action                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| ↑/↓                                         | Navigate up/down in current pane                                                        |
| ←                                           | In navigation pane: collapse or go to parent<br>In list pane: switch to navigation pane |
| →                                           | In navigation pane: expand or switch to list pane<br>In list pane: switch to editor     |
| Tab                                         | In navigation pane: switch to list pane<br>In list pane: switch to editor               |
| Shift+Tab                                   | Switch from list pane to navigation pane                                                |
| PageUp/PageDown                             | Scroll up/down in navigation pane and list pane                                         |
| Home/End                                    | Jump to first/last item in current pane                                                 |
| Delete (Windows/Linux)<br>Backspace (macOS) | Delete selected item                                                                    |
| Cmd/Ctrl+A                                  | Select all notes in current folder                                                      |
| Cmd/Ctrl+Click                              | Toggle notes selection                                                                  |
| Shift+Click                                 | Select a range of notes                                                                 |
| Shift+Home/End                              | Select from current position to first/last item                                         |
| Shift+↑/↓                                   | Extend selection up/down                                                                |

<br>

## Commands

Set custom hotkeys for these commands in Obsidian's Hotkeys settings:

**View & navigation**

- `Notebook Navigator: Open` Opens Notebook Navigator in left sidebar
- `Notebook Navigator: Reveal file` Reveals current file in navigator. Expands parent folders and scrolls to file
- `Notebook Navigator: Navigate to folder` Search dialog to jump to any folder
- `Notebook Navigator: Navigate to tag` Search dialog to jump to any tag
- `Notebook Navigator: Focus file` Move keyboard focus to file list pane

**Layout & display**

- `Notebook Navigator: Toggle dual pane layout` Toggle single/dual-pane layout (desktop)
- `Notebook Navigator: Toggle show notes from subfolders` Toggle subfolder notes display

**File operations**

- `Notebook Navigator: Create new note` Create note in currently selected folder. **Tip:** Bind Cmd/Ctrl+N to this command (unbind from Obsidian's default "Create new note" first)
- `Notebook Navigator: Move files` Move selected files to another folder. Selects next file in current folder
- `Notebook Navigator: Delete files` Delete selected files. Selects next file in current folder

**Tag operations**

- `Notebook Navigator: Add tag to selected files` Dialog to add tag to selected files. Supports creating new tags
- `Notebook Navigator: Remove tag from selected files` Dialog to remove specific tag. Removes immediately if only one tag
- `Notebook Navigator: Remove all tags from selected files` Clear all tags from selected files with confirmation

<br>

## Settings

### Top level settings

- **Dual pane layout (desktop only):** Show navigation and list panes side by side
- **Auto-reveal active note:** Reveal and select notes when opened from Quick Switcher, links, or search
- **Show tooltips (desktop only):** Display hover tooltips for notes and folders
- **Show file types:** Choose file types to display. Non-Obsidian files open in system's default application. `Markdown only`, `Supported files`, `All files`
- **Excluded folders:** Comma-separated list of folders to hide. Pattern types:
  - **Name patterns:** `archive` excludes all "archive" folders
  - **Path patterns:** `/archive` excludes root archive folder, `/projects/secret` excludes specific path
  - **Wildcards:** `temp*` (starts with), `*_old` (ends with), `/projects/*` (all subfolders)
  - Right-click folders to add to exclusion list
- **Excluded notes:** Comma-separated frontmatter properties. Notes with these properties are hidden (e.g., draft, private, archived)

### Navigation pane

- **Auto-select first note (desktop only):** Select and open first note when switching folders or tags
- **Auto-expand folders and tags:** Expand folders and tags when selected
- **Collapse button behavior:** What expand/collapse all button affects. `All folders and tags`, `Folders only`, `Tags only`
- **Show icons:** Display icons next to folders and tags
- **Show note count:** Display note count in folders and tags
- **Tree indentation:** Indentation width for each folder and tag nesting level (10-24px)
- **Item height:** Height of items in the navigation pane (20-28px)

### Folders

- **Show root folder:** Display "Vault" as root folder
- **Inherit folder colors:** Subfolders inherit parent folder colors when no custom color set
- **Enable folder notes:** Folders with notes become clickable links
- **Folder note name:** Note name without extension. Empty = folder name
- **Hide folder notes in list:** Hide folder note from folder's note list

### Tags

- **Show tags (\*):** Display tags section below folders
- **Show tags above folders:** Display tags section at top of navigation pane
- **Show favorites folder:** Display "Favorites" as collapsible folder
- **Show tags folder:** Display "Tags" as collapsible folder
- **Show untagged notes:** Display "Untagged" for notes without tags
- **Show untagged notes in favorites section:** Display untagged in favorites section
- **Favorite tags:** Comma-separated tag patterns. Supports exact match, wildcards (\*), regex (/pattern/)
- **Hidden tags:** Comma-separated patterns to hide. Supports exact match, wildcards (\*), regex (/pattern/)

### List pane

- **Sort notes by:** Note sort order. `Date edited (newest/oldest first)`, `Date created (newest/oldest first)`, `Title (A-Z first)`
- **Group notes by date:** Group by date headers when sorted by date
- **Optimize note height:** Reduce height for pinned notes and notes without preview
- **Show notes from subfolders:** Display all notes from subfolders
- **Show parent folder names:** Display parent folder for subfolder notes
- **Show quick actions (desktop only):** Hover action buttons
- **Reveal in folder:** Icon to reveal note's actual folder location
- **Pin note:** Icon to pin/unpin notes
- **Open in new tab:** Icon to open in new tab
- **Date format:** Format for displaying dates (uses date-fns format)
- **Time format:** Format for displaying times (uses date-fns format)

### Notes

- **Read metadata from frontmatter (\*):** Read note names and timestamps from frontmatter. Falls back to file system
- **Name field:** Frontmatter field for display name. Empty = file name
- **Created timestamp field:** Frontmatter field for created date. Empty = file system date
- **Modified timestamp field:** Frontmatter field for modified date. Empty = file system date
- **Timestamp format:** Format to parse frontmatter timestamps
- **Title rows:** Rows for note titles. `1` or `2`
- **Show date:** Display date below note names
- **Show tags:** Display tags in file list. Tags are clickable with proper colors
- **Show note preview (\*):** Display preview text
- **Skip headings in preview:** Skip heading lines in preview
- **Preview rows:** Rows for preview text. `1-5`
- **Show feature image (\*):** Display thumbnail images from frontmatter
- **Image properties:** Comma-separated frontmatter properties for images. First found is used. Falls back to first embedded image (requires Obsidian 1.9.4+)

**Note:** When date, preview, and feature image are disabled, list pane displays in compact "slim mode" with only note names.

### Advanced

- **Confirm before deleting:** Confirmation dialog for delete operations

_(\*) These settings store data to a local cache database. You can see the total size of the database at the bottom of the Settings pane. Uncheck each item to remove its data from the cache._

<br>

## Style settings

Notebook Navigator integrates with the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin for visual customization.

- **Colors** - All interface colors including backgrounds, text, icons, and selection states
- **Borders & corners** - Border radius for items, badges, and panels
- **Font weights** - Text weights for folders, tags, files, and various UI elements
- **Mobile styles** - Separate customizations for mobile interface

For theme developers who want to style Notebook Navigator, see the [Theming Guide](docs/theming-guide.md).

<br>

## Tips and tricks

### Display thumbnails with featured image plugin

Combine with the [Featured Image plugin](https://github.com/johansan/obsidian-featured-image) for thumbnail previews:

1. Install the Featured Image plugin
2. Enable "Show feature image" in Notebook Navigator settings
3. Notes display thumbnails from the first image

For best performance and quality, use 128px thumbnails.

### Folder notes

1. Enable "Enable folder notes" in settings
2. Right-click a folder and select "Create folder note"
3. Folders with notes appear as clickable links (underlined)
4. Click the folder name to open its note
5. Click elsewhere on the folder row to view the folder's note list
6. Right-click and select "Delete folder note" to remove

Use cases:

- Project overviews
- Category descriptions
- Table of contents
- Meeting notes by folder

**Configuration:**

- Set custom folder note name like "index" or "readme" in settings
- Hide folder notes from note lists
- Folder notes auto-rename when folder is renamed (if using folder name)
- Folders without notes work normally

### Customizing folders and tags

1. Right-click any folder or tag
2. Select "Change color" or "Change icon"
3. Colors: Choose from palette
4. Icons: Browse Lucide icons or paste emoji
5. Remove: Right-click and select "Remove color/icon"

### Custom sort order per folder/tag

1. Select a folder or tag
2. Click the sort button above the list pane
3. Toggle between:
   - **Default**: Uses global sort setting
   - **Custom**: Specific sort order for this folder/tag
4. Sort preference is remembered per folder and tag

### Custom appearances per folder/tag

1. Select a folder or tag
2. Click "Change appearance" in list pane header
3. Customize display:
   - **Title rows**: 1 or 2 rows or default
   - **Preview rows**: 1-5 rows or default
4. Presets:
   - **Default appearance**: Reset to global settings
   - **Slim mode**: Disable date, preview, and images

Use cases:

- **Slim mode**: Maximum file density
- **5 preview rows**: Folders where preview text matters
- **1-2 preview rows**: Quick scanning

### Tag management

- **Hierarchical tags:** Use nested tags like `#project/work/urgent`
- **Quick filtering:** Click tags to see notes with that tag and subtags
- **Untagged notes:** Find notes without tags via "Untagged"
- **Drag to tag:** Drag notes to tags to add tags
- **Remove tags:** Drag notes to "Untagged" to remove all tags
- **Context menu:** Right-click to add, remove, or clear tags

### Hiding notes with frontmatter

Use "Excluded notes" setting to hide notes with specific frontmatter:

1. Add properties like `private, archived` to excluded notes list
2. Add frontmatter to notes:
   ```yaml
   ---
   private: true
   ---
   ```
3. Notes are hidden from navigator

Use cases:

- Personal/sensitive content
- Archived notes
- Template files with `template: true`

### Navigation shortcuts

- **Breadcrumb navigation:** Click segments in header path to jump to parent folders/tags
- **Scrollable paths on mobile:** Swipe long paths horizontally in mobile header
- **Middle-click:** Open files in new tab without switching focus (desktop)

<br>

## Questions or issues?

**[Join our Discord](https://discord.gg/6eeSUvzEJr)** for support and discussions, or open an issue on the
[GitHub repository](https://github.com/johansan/notebook-navigator).

<br>

## About

Notebook Navigator is built and maintained by [Johan Sanneblad](https://www.linkedin.com/in/johansan/). Johan has a PhD
in Software Development and has worked with innovation development for companies such as Apple, Electronic Arts, Google, Microsoft, Lego, SKF, Volvo Cars, Volvo Group and Yamaha.

Feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/johansan/).

<br>

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) - see the [LICENSE](LICENSE) file for
details.
