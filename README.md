# Notebook Navigator for Obsidian

A plugin for [Obsidian](https://obsidian.md) that replaces the default file
explorer with a clean, Notes-style interface featuring a dual-pane layout with
navigation pane on the left (folders and tags) and list pane on the right
(notes), or an optional single-pane layout.

If you love using Notebook Navigator, please consider
[buying me a coffee](https://buymeacoffee.com/johansan) or
[Sponsor on GitHub ❤️](https://github.com/sponsors/johansan).

<a href="https://www.buymeacoffee.com/johansan" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

<br>

## Screenshots

### Desktop

Transform your Obsidian file explorer from the default UI like this:

![Default Obsidian File Explorer](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot0.png?raw=true)

To a modern, Notes-style interface like this:

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot1.png?raw=true)

### Mobile

<img src="https://github.com/johansan/notebook-navigator/blob/main/images/screenshot2.png?raw=true" alt="Notebook Navigator Interface" width="40%">

<br>

## Features

### Core Interface

- **Dual-pane layout** - Navigation pane (folders and tags) on left, list pane
  (notes) on right (desktop default)
- **Single-pane layout** - Clean interface switching between navigation and file
  list (mobile, optional on desktop)
- **Mobile optimized** - Touch gestures and responsive interface
- **Theme support** - Matches your Obsidian theme
- **Multi-language support** - Available in English, German, Spanish, French,
  Japanese, and Chinese Simplified
- **RTL language support** - Full support for right-to-left languages with
  proper layout mirroring and navigation

### Navigation & Organization

- **Tag browser** - Hierarchical tag tree with nested tag support
- **Pin notes** - Keep important notes at the top of folders and tags
- **Auto-reveal** - Automatically show the location of the current note
- **Keyboard first** - Full navigation with arrow keys and Tab
- **Multi-selection** - Select multiple notes with Cmd/Ctrl+Click and
  Shift+Click

### Notes Display

- **Smart previews** - Preview 1-5 lines of text from each note
- **Feature images** - Display thumbnail images from note frontmatter
- **Date grouping** - Organize by Today, Yesterday, This Week
- **Custom sorting** - Use custom sort preferences for each folder and tag
- **Folder notes** - Folders with notes are displayed as clickable links
- **Frontmatter support** - Read note names and timestamps from frontmatter

### Productivity

- **Drag & drop** - Move notes between folders, drag to tags to add tags, drag
  to Untagged to remove all tags
- **Resizable panes** - Adjust the layout to your needs
- **Smart filtering** - Exclude folders and notes with patterns
- **Visual customization** - Folder and tag colors with customizable icons
  (Lucide icons or emojis)

<br>

## Architecture & Performance

- **React + TanStack Virtual** - Modern React architecture with virtualized
  rendering handling 100,000+ notes
- **IndexedDB + RAM Cache** - Dual-layer caching system provides instant access
  to metadata while maintaining zero memory overhead
- **TypeScript Throughout** - 100% type-safe codebase with zero `any` types and
  comprehensive type guards
- **Promise Queue Architecture** - Serialized file operations prevent race
  conditions during rapid vault changes
- **Event-Driven State Management** - Real-time sync with Obsidian's vault
  events using proper cleanup and memory management
- **Mobile-First Performance** - Touch-optimized event handling and 120Hz
  animations

<br>

## How to Use

1. Install the plugin from Obsidian's Community Plugins
2. The navigator will replace your default file explorer
3. Navigate using:
   - **Click** to select folders, tags, and notes
   - **Cmd/Ctrl+Click** to add notes to selection
   - **Shift+Click** to select a range of notes
   - **Double-click** folders and tags to expand/collapse
   - **Arrow keys** for navigation
   - **Tab** to switch between navigation pane and list pane
   - **Delete/Backspace** to delete (with optional confirmation)
4. Right-click for context menus:
   - Pin/unpin notes
   - Create new notes, folders, canvas, or drawings
   - Open notes in new tabs or windows
   - Rename, delete, or duplicate items
   - Move files to another folder
   - Change or remove folder/tag colors and icons
   - Create or delete folder notes
   - Open version history or reveal in system explorer
   - Reveal in folder - switches to the file's containing folder (useful when
     viewing notes from subfolders or tags)
5. Drag and drop notes between folders to organize, drag to tags to add tags, or
   drag to Untagged to remove all tags

**Tip:** You can use the ribbon icon (folder tree icon) in the left sidebar to
activate Notebook Navigator in case you close it by mistake.

<br>

## Keyboard Shortcuts

| Key                                         | Action                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| ↑/↓                                         | Navigate up/down in current pane                                                        |
| ←                                           | In navigation pane: collapse or go to parent<br>In list pane: switch to navigation pane |
| →                                           | In navigation pane: expand or switch to list pane<br>In list pane: switch to editor     |
| Tab                                         | In navigation pane: switch to list pane<br>In list pane: switch to editor               |
| Shift+Tab                                   | Switch from list pane to navigation pane                                                |
| PageUp/PageDown                             | Scroll up/down in navigation pane and list pane                                         |
| Home/End                                    | Jump to first/last item in current pane                                                 |
| Shift+Home/End                              | Select from current position to first/last item                                         |
| Delete (Windows/Linux)<br>Backspace (macOS) | Delete selected item                                                                    |
| Cmd/Ctrl+A                                  | Select all notes in current folder                                                      |
| Cmd/Ctrl+Click                              | Toggle notes selection                                                                  |
| Shift+Click                                 | Select a range of notes                                                                 |
| Shift+↑/↓                                   | Extend selection up/down                                                                |

<br>

## Commands

You can set custom hotkeys for these commands in Obsidian's Hotkeys settings:

**View & Navigation**

- `Notebook Navigator: Open` Opens the Notebook Navigator view in the left
  sidebar
- `Notebook Navigator: Reveal file` Reveals the currently open file in the
  navigator, expanding parent folders and scrolling to it. Useful if you have
  the setting "Show notes from subfolders" enabled and want to find out the
  folder of a specific note
- `Notebook Navigator: Navigate to folder` Opens a search dialog to quickly jump
  to any folder in your vault
- `Notebook Navigator: Navigate to tag` Opens a search dialog to quickly jump to
  any tag in your vault
- `Notebook Navigator: Focus file` Moves keyboard focus to the file list pane so
  you can navigate with arrow keys

**Layout & Display**

- `Notebook Navigator: Toggle dual pane layout` Toggles between single-pane and
  dual-pane layout on desktop
- `Notebook Navigator: Toggle show notes from subfolders` Toggles showing notes
  from subfolders

**File Operations**

- `Notebook Navigator: Create new note` Creates a new note in the currently
  selected folder. Unlike Obsidian's default new note command which only allows
  creating in the same folder as current note, root folder, or a specific
  folder, this always creates in your currently selected folder. **Tip:** You
  can bind Cmd/Ctrl+N to this command for a more intuitive workflow - just
  unbind it from Obsidian's built-in "Create new note" command first
- `Notebook Navigator: Move files` Move selected files to another folder, then
  automatically select the next file in the current folder (stays in the
  selected folder)
- `Notebook Navigator: Delete files` Delete selected files and automatically
  select the next file in the current folder (stays in the selected folder)

<br>

## Settings

### Top Level Settings

- **Dual pane layout (desktop only):** Show navigation pane and list pane side
  by side on desktop
- **Auto-reveal active note:** Automatically reveal and select notes when opened
  from Quick Switcher, links, or search
- **Show tooltips (desktop only):** Display hover tooltips with additional
  information for notes and folders
- **Show file types:** Choose which file types to display in the navigator.
  Files not supported by Obsidian will open in your system's default application
  - Markdown only, Supported files, or All files
- **Excluded folders:** Comma-separated list of folders to hide. Supports
  wildcards: assets* (starts with), *\_temp (ends with)
- **Excluded notes:** Comma-separated list of frontmatter properties. Notes
  containing any of these properties will be hidden (e.g., draft, private,
  archived)

### Navigation Pane

- **Auto-select first note (desktop only):** Automatically select and open the
  first note when switching folders or tags
- **Auto-expand folders and tags:** Automatically expand folders and tags when
  they are selected
- **Show note count:** Display the number of notes in each folder and tag
- **Show icons:** Display icons next to folders and tags in the navigation pane
- **Collapse button behavior:** Choose what the expand/collapse all button
  affects
  - All folders and tags, Folders only, or Tags only

### Folders

- **Show root folder:** Display "Vault" as the root folder in the tree
- **Enable folder notes:** When enabled, folders with associated notes are
  displayed as clickable links
  - **Folder note name:** Name of the folder note without extension. Leave empty
    to use the same name as the folder
  - **Hide folder notes in list:** Hide the folder note from appearing in the
    folder's note list

### Tags

- **Show tags (\*):** Display tags section below folders in the navigator
  - **Show tags above folders:** Display tags section before folders in the
    navigator. When enabled, tags appear at the top of the navigation pane
  - **Show favorites folder:** Display "Favorites" as a collapsible folder when
    favorite tags are configured
  - **Show tags folder:** Display "Tags" as a collapsible folder
  - **Show untagged notes:** Display "Untagged" item for notes without any tags
    - **Show untagged notes in favorites section:** Display untagged notes in
      the favorites section, either inside the folder or directly below
      favorites
  - **Favorite tags:** Comma-separated list of favorite tag patterns. Supports
    exact match, wildcards (\*), and regex (/pattern/)
  - **Hidden tags:** Comma-separated list of tag patterns to hide from the tag
    tree. Supports exact match, wildcards (\*), and regex (/pattern/)

### List Pane

- **Sort notes by:** Choose how notes are sorted in the note list
  - Date edited (newest/oldest first), Date created (newest/oldest first), or
    Title (A/Z first)
- **Group notes by date:** When sorted by date, group notes under date headers
- **Show notes from subfolders:** Display all notes from subfolders in the
  current folder view
  - **Show parent folder names:** Display the parent folder name for notes from
    subfolders
- **Date format:** Format for displaying dates (uses date-fns format)
- **Time format:** Format for displaying times (uses date-fns format)

### Notes

- **Read metadata from frontmatter (\*):** Read note names and timestamps from
  frontmatter when available, falling back to file system values
  - **Name field:** Frontmatter field to use as the note display name. Leave
    empty to use the file name
  - **Created timestamp field:** Frontmatter field name for the created
    timestamp. Leave empty to only use file system date
  - **Modified timestamp field:** Frontmatter field name for the modified
    timestamp. Leave empty to only use file system date
  - **Timestamp format:** Format used to parse timestamps in frontmatter
- **Title rows:** Number of rows to display for note titles (1 or 2)
- **Show date:** Display the date below note names
- **Show tags:** Display tags in the file list. Tags are shown with their proper
  color and can be clicked to navigate to that tag in the tag tree
- **Show note preview (\*):** Display preview text beneath note names
  - **Skip headings in preview:** Skip heading lines when generating preview
    text
  - **Preview rows:** Number of rows to display for preview text (1-5)
- **Show feature image (\*):** Display thumbnail images from frontmatter. Tip:
  Use the "Featured Image" plugin to automatically set feature images for all
  your documents
  - **Image properties:** Comma-separated list of frontmatter properties to
    check for thumbnail images. The first property with an image will be used.
    If no image is found in the properties, the first embedded image in the
    document will be used (requires Obsidian 1.9.4+)

**Note:** When date, preview, and feature image are all disabled, the list pane
displays in a compact "slim mode" with only note names, providing a cleaner,
more minimal interface.

### Advanced

- **Confirm before deleting:** Show confirmation dialog when deleting notes or
  folders

<br>

_(\*) These settings store data to a local cache database. You can see the total
size of the database at the bottom of the Settings pane. Uncheck each item to
remove its data from the cache._

<br>

## Tips and Tricks

### Creating beautiful note lists

Combine Notebook Navigator with the
[Featured Image plugin](https://github.com/johansan/obsidian-featured-image) to
display thumbnail previews in your list pane:

1. Install the Featured Image plugin
2. Enable "Show feature image" in Notebook Navigator settings
3. Your notes will automatically display thumbnails from the first image

#### Optimizing thumbnail performance

For best performance with Notebook Navigator's 42px thumbnails, configure these
Featured Image plugin settings:

- **Create resized thumbnail:** `true`
- **Resized thumbnail frontmatter property:** `featureResized`
- **Max resized width:** `42` (or `84` for retina displays)
- **Max resized height:** `42` (or `84` for retina displays)
- **Fill resized dimensions:** `true`

Then in Notebook Navigator settings:

- **Image properties:** `featureResized, feature`

This configuration first checks for optimized 42px thumbnails (featureResized),
then falls back to the full-size feature image if no thumbnail exists. The
optimized thumbnails load quickly and display perfectly in the list pane.

### Using folder notes

Turn folders into clickable links for better organization:

1. Enable "Enable folder notes" in settings
2. Right-click a folder and select "Create folder note" to create an associated
   note
3. Folders with notes appear as clickable links (visually distinguished with an
   underline)
4. Click the folder name to open its note directly
5. Click anywhere else on the folder row to view the folder's note list as usual
6. Right-click and select "Delete folder note" to remove the association

Folder notes are perfect for:

- Project overviews and documentation
- Category descriptions
- Table of contents for folder contents
- Meeting notes or journals organized by folder

**Tips:**

- Set a custom folder note name like "index" or "readme" in settings
- Hide folder notes from note lists to keep things clean
- When you rename a folder, its folder note is automatically renamed too (if
  using folder name)
- Folders without notes still work normally - click to select and view their
  notes

### Organizing with pins

Pin frequently accessed notes to keep them at the top:

1. Right-click any note
2. Select "Pin note"
3. Pinned notes appear at the top with a 📌 icon

### Customizing folders and tags

Add visual organization with custom colors and icons:

1. Right-click any folder or tag
2. Select "Change color" or "Change icon"
3. For colors: Choose from a palette of colors
4. For icons: Browse Lucide icons or search/paste any emoji
5. To remove: Right-click and select "Remove color/icon"

### Custom sort order

Each folder and tag can have its own sort preference:

1. Select a folder or tag
2. Click the sort button above the list pane (shows current sort mode)
3. Toggle between:
   - **Default**: Uses the global sort setting from preferences
   - **Custom**: Choose a specific sort order for this folder/tag only
4. Your custom sort preference is remembered for each folder and tag

### Using tags effectively

The tags section provides powerful ways to organize and find your notes:

- **Hierarchical organization:** Use nested tags like `#project/work/urgent` to
  create tag hierarchies
- **Quick filtering:** Click any tag to see all notes with that tag and its
  subtags
- **Untagged notes:** Find notes without tags by clicking "Untagged"
- **Drag to tag:** Drag notes onto tags to add that tag to the notes
- **Remove tags:** Drag notes to "Untagged" to remove all tags from those notes

### Managing draft and private notes

Use the "Excluded notes" setting to hide notes with specific frontmatter
properties:

1. Add properties like `private, archived` to the excluded notes list
2. Add frontmatter to your notes:
   ```yaml
   ---
   private: true
   ---
   ```
3. These notes will be automatically hidden from the navigator

This is perfect for:

- Personal/sensitive content
- Archived notes you want to keep but not see daily
- Template files with a `template: true` property

<br>

## Support

If you have any questions, suggestions, or issues, please open an issue on the
[GitHub repository](https://github.com/johansan/notebook-navigator).

<br>

## About

Notebook Navigator is built and maintained by
[Johan Sanneblad](https://www.linkedin.com/in/johansan/). Johan has a PhD in
Software Development and has worked with innovation development for companies
such as Apple, Electronic Arts, Google, Microsoft, Lego, SKF, Volvo Cars, Volvo
Group and Yamaha.

Feel free to connect with me on
[LinkedIn](https://www.linkedin.com/in/johansan/).

<br>

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) -
see the [LICENSE](LICENSE) file for details.
