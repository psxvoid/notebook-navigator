# Notebook Navigator for Obsidian

A plugin for [Obsidian](https://obsidian.md) that replaces the default file explorer with a clean, Notes-style interface featuring a two-pane layout with folders on the left and files on the right.

## Screenshots

### Desktop

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot1.png?raw=true)

### Mobile

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot2.png?raw=true)

## Features

### Core Interface
- **📁 Two-pane layout** - Folders on left, files on right (like Apple Notes)
- **📱 Mobile optimized** - Touch gestures and single-pane navigation
- **🌓 Theme support** - Seamlessly matches your Obsidian theme
- **🌍 RTL language support** - Full support for right-to-left languages with proper layout mirroring and navigation

### Navigation & Organization
- **🏷️ Tag browser** - Hierarchical tag tree with nested tag support
- **📌 Pin notes** - Keep important files at the top of folders
- **🚀 Auto-reveal** - Find your current file instantly
- **⌨️ Keyboard first** - Full navigation with arrow keys and Tab

### File Display
- **🔍 Smart previews** - See content snippets without opening files
- **🖼️ Thumbnails** - Display feature images from frontmatter
- **📅 Date grouping** - Organize by Today, Yesterday, This Week
- **🔄 Custom sorting** - Per-folder sort preferences

### Productivity
- **🎯 Drag & drop** - Move files between folders (desktop)
- **↔️ Resizable panes** - Adjust the layout to your needs
- **🚫 Smart filtering** - Hide folders/files with patterns
- **🎨 Visual customization** - Folder colors and icons

## How to Use

1. Install the plugin from Obsidian's Community Plugins
2. The navigator will replace your default file explorer
3. Navigate using:
   - **Click** to select folders, tags, and files
   - **Double-click** folders and tags to expand/collapse
   - **Arrow keys** for navigation
   - **Tab** to switch between folder/tag and file panes
   - **Delete/Backspace** to delete (with optional confirmation)
4. Right-click for context menus:
   - Create new files and folders
   - Rename items
   - Delete items
   - Pin/unpin files
   - Change folder colors
   - Remove folder colors
5. Drag and drop files between folders to organize

**Tip:** You can use the ribbon icon (folder tree icon) in the left sidebar to activate Notebook Navigator in case you close it by mistake.

## Keyboard Shortcuts

| Key | Action |
|-----|---------|
| ↑/↓ | Navigate up/down in current pane |
| ← | In folders/tags: collapse or go to parent<br>In files: switch to folder/tag pane |
| → | In folders/tags: expand or switch to file pane<br>In files: open selected file |
| Tab | In folders/tags: switch to file pane<br>In files: open selected file |
| Shift+Tab | Switch from files to folders/tags pane |
| Delete (Windows/Linux)<br>Backspace (macOS) | Delete selected item |

### Commands

You can set custom hotkeys for these commands in Obsidian's Hotkeys settings:

- `Notebook Navigator: Open` Opens the Notebook Navigator view in the left sidebar
- `Notebook Navigator: Reveal active file` Reveals the currently active file in the navigator, expanding parent folders and scrolling to it. Useful if you have the setting "Show notes from subfolders" enabled and want to find out the folder of a specific note.
- `Notebook Navigator: Focus file list` Moves keyboard focus to the file list pane so you can navigate with arrow keys

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

### File Organization

- **Default sort order:** Choose the default sorting for all folders - modified date (newest/oldest), created date (newest/oldest), or title (A-Z/Z-A). This can be overridden on a per-folder basis using the sort button above the file list
  - **Group notes by date:** When sorted by date, group notes under date headers like "Today", "Yesterday", etc.
- **Show notes from subfolders:** Display all notes from subfolders in the current folder view
- **Auto-reveal active note:** Automatically reveal and select notes when opened from Quick Switcher, links, or search
- **Auto-select first file on folder change:** Automatically select and open the first file when switching folders
- **Excluded notes:** Comma-separated list of frontmatter properties. Notes containing any of these properties will be hidden (e.g., `draft, private, archived`)
- **Excluded folders:** Comma-separated list of folders to hide with wildcard support:
  - Simple names: `resources, templates`
  - Wildcards: `*-archive, temp-*, _*` (matches folders like `2023-archive`, `temp-notes`, `_private`)

### Note Display

- **Title rows:** Display note titles in 1 or 2 rows (default: 1 row). Use 2 rows for longer titles
- **Show date:** Display the date below note names
  - **Date format:** Format for displaying dates (uses date-fns format)
    - Common formats:
      - `MMM d, yyyy` = Jan 5, 2024
      - `dd/MM/yyyy` = 05/01/2024
      - `yyyy-MM-dd` = 2024-01-05
  - **Time format:** Format for displaying time (uses date-fns format)
    - Common formats:
      - `h:mm a` = 3:30 PM (12-hour)
      - `HH:mm` = 15:30 (24-hour)
- **Show note preview:** Display preview text beneath note names
  - **Skip headings in preview:** Skip heading lines when generating preview text
  - **Skip non-text in preview:** Skip images, embeds, and other non-text elements from preview text
  - **Preview rows:** Number of rows to display for preview text (1-5 rows)
- **Show feature image:** Display thumbnail images from frontmatter properties
  - **Feature image property:** The frontmatter property name for thumbnails (default: `feature`)
    - **Tip:** Use the [Featured Image plugin](https://github.com/johansan/obsidian-featured-image) (also available in community plugins) to automatically set feature images for all your notes based on the first image in each document!
    - **Important!** In Featured Image plugin you can choose to create resized thumbnails, this will significantly improve performance! Use 42 pixels for maximum performance, or 84 pixels for retina displays. The resized property is called `featureResized` by default.

### Folder Display

- **Show root folder:** Display "Vault" as the root folder in the tree
- **Show folder note count:** Display the number of notes in each folder
- **Show folder icons:** Display folder icons in the folder tree

### Tag Display

- **Show tags:** Display tags section below folders in the navigator
  - **Show untagged notes:** Display "Untagged" item for notes without any tags

### Advanced

- **Confirm before deleting notes:** Show confirmation dialog when deleting notes or folders
- **Clear saved state:** Reset expanded folders, selections, and pane width to defaults

## Tips and Tricks

### Creating beautiful note lists

Combine Notebook Navigator with the [Featured Image plugin](https://github.com/johansan/obsidian-featured-image) to display thumbnail previews in your file list:

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

This creates optimized 42px thumbnails that load quickly and display perfectly in the file list, rather than loading full-size images.

### Organizing with pins

Pin frequently accessed notes to keep them at the top:
1. Right-click any file
2. Select "Pin note"
3. Pinned notes appear at the top with a 📌 icon

### Customizing folder colors and icons

Add visual organization to your folders with custom colors and icons:

1. Right-click any folder
2. Select "Change color" or "Change icon"
3. Choose from a palette of colors or variety of Lucide icons
4. To remove, right-click and select "Remove color" or "Remove icon"

Visual customization helps you:
- Quickly identify different types of content at a glance
- Highlight important project folders
- Create a more personalized and intuitive navigation experience
- Combine colors and icons for even better organization

### Using tags effectively

The tags section provides powerful ways to organize and find your notes:

- **Hierarchical organization:** Use nested tags like `#project/work/urgent` to create tag hierarchies
- **Quick filtering:** Click any tag to see all notes with that tag and its subtags
- **Untagged notes:** Find notes without tags by clicking "Untagged"

### Managing draft and private notes

Use the "Excluded files" setting to hide notes with specific frontmatter properties:

1. Add properties like `draft, private, archived` to the excluded files list
2. Add frontmatter to your notes:
   ```yaml
   ---
   draft: true
   ---
   ```
3. These files will be automatically hidden from the navigator

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

## Support Development

If you love using Notebook Navigator, please consider supporting its continued development.

[❤️ Sponsor on GitHub](https://github.com/sponsors/johansan)

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) - see the [LICENSE](LICENSE) file for details.
