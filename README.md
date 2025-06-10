# Notebook Navigator for Obsidian

A plugin for [Obsidian](https://obsidian.md) that replaces the default file explorer with a clean, Notes-style interface featuring a two-pane layout with folders on the left and files on the right.

## Screenshots

### Desktop

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot1.png?raw=true)

### Mobile

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot2.png?raw=true)

## Features

- 📁 **Two-pane interface:** Clean layout with folder tree on the left, file list on the right
- 🏷️ **Hierarchical tag browsing:** View and navigate all your tags in a tree structure with nested tags support
- 🔍 **Smart file previews:** Shows content preview with date and first lines of text
- 🖼️ **Feature images:** Display thumbnail images from frontmatter properties
- 📌 **Pin important notes:** Keep frequently accessed notes at the top of any folder
- ⌨️ **Full keyboard navigation:** Navigate entirely with arrow keys, Tab and Shift+Tab
- 🔄 **Multiple sort options:** Sort by date modified, date created, or title
- 📅 **Date grouping:** Automatically group files by Today, Yesterday, Previous 7 days, etc.
- 🎯 **Drag and drop:** Move files and folders with intuitive drag and drop
- 🎨 **Customizable appearance:** Adjust date formats and folder colors
- 🌓 **Dark mode support:** Fully integrated with Obsidian's theme system
- 📱 **Mobile support:** Full functionality on iOS and Android devices with touch gestures
- ↔️ **Resizable panes:** Drag the divider to adjust folder/file pane widths
- 🚀 **Auto-reveal:** Automatically reveal files when opened from search or links

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

### Manual Installation

1. Download the latest release from [GitHub](https://github.com/johansan/notebook-navigator/releases)
2. Extract the files to your vault's `.obsidian/plugins/notebook-navigator/` folder
3. Reload Obsidian
4. Enable the plugin in Settings

## Settings

### File Organization

- **Sort notes by:** Choose between date edited, date created, or title
- **Group notes by date:** When sorted by date, group notes under date headers like "Today", "Yesterday", etc.
- **Show notes from subfolders:** Display all notes from subfolders in the current folder view
- **Auto-reveal active note:** Automatically reveal and select notes when opened from Quick Switcher, links, or search
- **Excluded notes:** Comma-separated list of frontmatter properties. Notes containing any of these properties will be hidden (e.g., `draft, private, archived`)
- **Excluded folders:** Comma-separated list of folders to hide (e.g., `resources, templates`)

### Note Display

- **Show date:** Display the date below note names
- **Date format:** Format for displaying dates (uses date-fns format)
  - Common formats:
    - `MMM d, yyyy` = Jan 5, 2024
    - `dd/MM/yyyy` = 05/01/2024
    - `yyyy-MM-dd` = 2024-01-05
- **Show note preview:** Display preview text beneath note names
- **Skip headings in preview:** Skip heading lines when generating preview text
- **Skip non-text in preview:** Skip images, embeds, and other non-text elements from preview text
- **Preview rows:** Number of rows to display for preview text (1-5 rows)
- **Show feature image:** Display thumbnail images from frontmatter properties
- **Feature image property:** The frontmatter property name for thumbnails (default: `feature`)
  - **Tip:** Use the [Featured Image plugin](https://github.com/johansan/obsidian-featured-image) (also available in community plugins) to automatically set feature images for all your notes based on the first image in each document!

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

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) - see the [LICENSE](LICENSE) file for details.
