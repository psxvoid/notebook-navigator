# Notebook Navigator for Obsidian

A plugin for [Obsidian](https://obsidian.md) that replaces the default file explorer with a clean, Notes-style interface featuring a two-pane layout with navigation pane on the left (folders and tags) and list pane on the right (notes).

If you love using Notebook Navigator, please consider [buying me a coffee](https://buymeacoffee.com/johansan) or [Sponsor on GitHub ❤️](https://github.com/sponsors/johansan).

<a href="https://www.buymeacoffee.com/johansan" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## Screenshots

### Desktop

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot1.png?raw=true)

### Mobile

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot2.png?raw=true)

## Features

### Core Interface
- **Two-pane layout** - Navigation pane (folders and tags) on left, list pane (notes) on right
- **Mobile optimized** - Touch gestures and single-pane navigation
- **Theme support** - Seamlessly matches your Obsidian theme
- **Multi-language support** - Available in English, German, Spanish, French, Japanese, and Chinese Simplified
- **RTL language support** - Full support for right-to-left languages with proper layout mirroring and navigation

### Navigation & Organization
- **Tag browser** - Hierarchical tag tree with nested tag support
- **Pin notes** - Keep important notes at the top of folders and tags
- **Auto-reveal** - Automatically show the location of the current note
- **Keyboard first** - Full navigation with arrow keys and Tab
- **Multi-selection** - Select multiple notes with Cmd/Ctrl+Click and Shift+Click

### Notes Display
- **Smart previews** - Preview 1-5 lines of text from each note
- **Feature images** - Display thumbnail images from note frontmatter
- **Date grouping** - Organize by Today, Yesterday, This Week
- **Custom sorting** - Use custom sort preferences for each folder and tag
- **Folder notes** - Folders with notes are displayed as clickable links
- **Frontmatter support** - Read note names and timestamps from frontmatter

### Productivity
- **Drag & drop** - Move notes between folders, drag to tags to add tags, drag to Untagged to remove all tags
- **Resizable panes** - Adjust the layout to your needs
- **Smart filtering** - Exclude folders and notes with patterns
- **Visual customization** - Folder and tag colors and icons

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
   - Create new notes and folders
   - Rename items
   - Delete items
   - Pin/unpin notes
   - Change folder colors
   - Remove folder colors
5. Drag and drop notes between folders to organize, drag to tags to add tags, or drag to Untagged to remove all tags

**Tip:** You can use the ribbon icon (folder tree icon) in the left sidebar to activate Notebook Navigator in case you close it by mistake.

## Keyboard Shortcuts

| Key | Action |
|-----|---------|
| ↑/↓ | Navigate up/down in current pane |
| ← | In navigation pane: collapse or go to parent<br>In list pane: switch to navigation pane |
| → | In navigation pane: expand or switch to list pane<br>In list pane: open selected note |
| Tab | In navigation pane: switch to list pane<br>In list pane: open selected note |
| Shift+Tab | Switch from list pane to navigation pane |
| PageUp/PageDown | Scroll up/down in navigation pane and list pane |
| Home/End | Jump to first/last item in current pane |
| Delete (Windows/Linux)<br>Backspace (macOS) | Delete selected item |
| Cmd/Ctrl+A | Select all notes in current folder |
| Cmd/Ctrl+Click | Toggle notes selection |
| Shift+Click | Select a range of notes |
| Shift+↑/↓ | Extend selection up/down |

### Commands

You can set custom hotkeys for these commands in Obsidian's Hotkeys settings:

- `Notebook Navigator: Open` Opens the Notebook Navigator view in the left sidebar
- `Notebook Navigator: Reveal note` Reveals the currently open note in the navigator, expanding parent folders and scrolling to it. Useful if you have the setting "Show notes from subfolders" enabled and want to find out the folder of a specific note.
- `Notebook Navigator: Focus note` Moves keyboard focus to the list pane so you can navigate with arrow keys
- `Notebook Navigator: Toggle navigation pane` Shows or hides the navigation pane (folder/tag tree) to maximize list pane space

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Notebook Navigator"
4. Click Install
5. Enable the plugin

**Note:** Available on both desktop and mobile versions of Obsidian.

### Beta Installation (via BRAT)

Until the plugin is approved in the Community Plugins directory, you can install it using BRAT:

1. Install the BRAT plugin from Community Plugins
2. Enable BRAT
3. In BRAT settings, click "Add Beta Plugin"
4. Enter the repository URL: `https://github.com/johansan/notebook-navigator`
5. Click "Add Plugin"
6. Enable "Notebook Navigator" in your Community Plugins settings

## Settings

### General

- **Auto-reveal active note:** Automatically reveal and select notes when opened from Quick Switcher, links, or search
- **Show tooltips:** Display hover tooltips with additional information for notes and folders
- **Excluded folders:** Comma-separated list of folders to hide. Supports wildcards: assets* (starts with), *_temp (ends with)
- **Excluded notes:** Comma-separated list of frontmatter properties. Notes containing any of these properties will be hidden (e.g., draft, private, archived)

### Navigation Pane

- **Auto-select first note on focus change:** Automatically select and open the first note when switching folders or tags
- **Show note count:** Display the number of notes in each folder and tag
- **Show icons:** Display icons next to folders and tags in the navigation pane
- **Collapse button behavior:** Choose what the expand/collapse all button affects - All folders and tags, Folders only, or Tags only

### Folders

- **Show root folder:** Display "Vault" as the root folder in the tree
- **Enable folder notes:** When enabled, folders with associated notes are displayed as clickable links
  - **Folder note name:** Name of the folder note without extension. Leave empty to use the same name as the folder
  - **Hide folder notes in list:** Hide the folder note from appearing in the folder's note list

### Tags

- **Show tags:** Display tags section below folders in the navigator
  - **Show untagged notes:** Display "Untagged" item for notes without any tags

### List Pane

- **Sort notes by:** Choose how notes are sorted in the note list - Date edited (newest/oldest first), Date created (newest/oldest first), or Title (A/Z first)
  - **Group notes by date:** When sorted by date, group notes under date headers
- **Show notes from subfolders:** Display all notes from subfolders in the current folder view
  - **Show parent folder names:** Display the parent folder name for notes from subfolders
- **Date format:** Format for displaying dates (uses date-fns format)
- **Time format:** Format for displaying times (uses date-fns format)

### Notes

- **Read metadata from frontmatter:** Read note names and timestamps from frontmatter when available, falling back to file system values
  - **Name field:** Frontmatter field to use as the note display name. Leave empty to use the file name
  - **Created timestamp field:** Frontmatter field name for the created timestamp. Leave empty to only use file system date
  - **Modified timestamp field:** Frontmatter field name for the modified timestamp. Leave empty to only use file system date
  - **Timestamp format:** Format used to parse timestamps in frontmatter
- **Title rows:** Number of rows to display for note titles (1 or 2)
- **Show date:** Display the date below note names
- **Show note preview:** Display preview text beneath note names
  - **Skip headings in preview:** Skip heading lines when generating preview text
  - **Skip non-text in preview:** Skip images, embeds, and other non-text elements from preview text
  - **Preview rows:** Number of rows to display for preview text (1-5)
- **Show feature image:** Display thumbnail images from frontmatter. Tip: Use the "Featured Image" plugin to automatically set feature images for all your documents
  - **Feature image property:** The frontmatter property name for thumbnail images. Important! In Featured Image plugin you can choose to create resized thumbnails, this will significantly improve performance! Use 42 pixels for maximum performance, or 84 pixels for retina displays. The resized property is called "featureResized" by default

**Note:** When date, preview, and feature image are all disabled, the list pane displays in a compact "slim mode" with only note names, providing a cleaner, more minimal interface.

### Advanced

- **Confirm before deleting:** Show confirmation dialog when deleting notes or folders

## Tips and Tricks

### Creating beautiful note lists

Combine Notebook Navigator with the [Featured Image plugin](https://github.com/johansan/obsidian-featured-image) to display thumbnail previews in your list pane:

1. Install the Featured Image plugin
2. Enable "Show feature image" in Notebook Navigator settings
3. Your notes will automatically display thumbnails from the first image

#### Optimizing thumbnail performance

For best performance with Notebook Navigator's 42px thumbnails, configure these Featured Image plugin settings:

- **Create resized thumbnail:** `true`
- **Resized thumbnail frontmatter property:** `featureResized`
- **Max resized width:** `42` (or `84` for retina displays)
- **Max resized height:** `42` (or `84` for retina displays)
- **Fill resized dimensions:** `true`

Then in Notebook Navigator settings:
- **Feature image property:** `featureResized`

This creates optimized 42px thumbnails that load quickly and display perfectly in the list pane, rather than loading full-size images.

### Using folder notes

Turn folders into clickable links for better organization:

1. Enable "Enable folder notes" in settings
2. Right-click a folder and select "Create folder note" to create an associated note
3. Folders with notes appear as clickable links (visually distinguished with an underline)
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
- When you rename a folder, its folder note is automatically renamed too (if using folder name)
- Folders without notes still work normally - click to select and view their notes

### Organizing with pins

Pin frequently accessed notes to keep them at the top:
1. Right-click any note
2. Select "Pin note"
3. Pinned notes appear at the top with a 📌 icon

### Customizing folders and tags

Add visual organization with custom colors and icons:

1. Right-click any folder or tag
2. Select "Change color" or "Change icon"
3. Choose from a palette of colors or variety of Lucide icons
4. To remove, right-click and select "Remove color" or "Remove icon"

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

- **Hierarchical organization:** Use nested tags like `#project/work/urgent` to create tag hierarchies
- **Quick filtering:** Click any tag to see all notes with that tag and its subtags
- **Untagged notes:** Find notes without tags by clicking "Untagged"
- **Drag to tag:** Drag notes onto tags to add that tag to the notes
- **Remove tags:** Drag notes to "Untagged" to remove all tags from those notes

### Managing draft and private notes

Use the "Excluded notes" setting to hide notes with specific frontmatter properties:

1. Add properties like `draft, private, archived` to the excluded notes list
2. Add frontmatter to your notes:
   ```yaml
   ---
   draft: true
   ---
   ```
3. These notes will be automatically hidden from the navigator

This is perfect for:
- Work-in-progress notes
- Personal/sensitive content
- Archived notes you want to keep but not see daily
- Template files with a `template: true` property

## Support

If you have any questions, suggestions, or issues, please open an issue on the [GitHub repository](https://github.com/johansan/notebook-navigator).

## Development

### Built with Modern React Architecture

Notebook Navigator is built using React and TypeScript, providing:

- ⚡ **Lightning-fast performance** with React's virtual DOM and optimized rendering
- 🚀 **Virtualization** powered by TanStack Virtual for smooth scrolling with thousands of notes
- 🏗️ **Modular architecture** with reusable components and custom hooks
- 🔒 **Type safety** with TypeScript strict mode throughout the codebase
- 🧠 **Smart state management** using React Context API for predictable updates
- 🔄 **Automatic memory cleanup** preventing leaks with proper lifecycle management
- 🛠️ **Developer-friendly** with hot module reloading and React DevTools support

### Building from Source

```bash
# Clone the repository
git clone https://github.com/johansan/notebook-navigator.git
cd notebook-navigator

# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build
```

## About

Notebook Navigator is built and maintained by [Johan Sanneblad](https://www.linkedin.com/in/johansan/), CEO at [TokenTek](https://tokentek.ai). Johan has a PhD in Applied IT and has been programming for over 40 years. He has worked with innovation development for companies such as Apple, Google, Microsoft, Lego, SKF, Volvo Cars, Volvo Group and Yamaha, and is currently exploring how Transformer-based AI and AI agents can improve corporate productivity.

Feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/johansan/).

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) - see the [LICENSE](LICENSE) file for details.
