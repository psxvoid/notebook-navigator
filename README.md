# Notebook Navigator for Obsidian

A plugin for [Obsidian](https://obsidian.md) that replaces the default file explorer with a clean, Notes-style interface featuring a two-pane layout with folders on the left and files on the right.

## Features

- 📁 **Two-pane interface:** Clean layout with folder tree on the left, file list on the right
- 🏷️ **Tag browsing:** View and navigate all your tags in a dedicated section
- 🔍 **Smart file previews:** Shows content preview with date and first lines of text
- 🖼️ **Feature images:** Display thumbnail images from frontmatter properties
- 📌 **Pin important notes:** Keep frequently accessed notes at the top of any folder
- ⌨️ **Full keyboard navigation:** Navigate entirely with arrow keys, Tab and Shift+Tab
- 🔄 **Multiple sort options:** Sort by date modified, date created, or title
- 📅 **Date grouping:** Automatically group files by Today, Yesterday, Previous 7 days, etc.
- 🎯 **Drag and drop:** Move files and folders with intuitive drag and drop
- 🎨 **Customizable appearance:** Adjust date formats
- 🌓 **Dark mode support:** Fully integrated with Obsidian's theme system
- ↔️ **Resizable panes:** Drag the divider to adjust folder/file pane widths
- 🚀 **Auto-reveal:** Automatically reveal files when opened from search or links

## Screenshot

![Notebook Navigator Interface](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot1.png?raw=true)

## How to Use

1. Install the plugin from Obsidian's Community Plugins
2. The navigator will replace your default file explorer
3. Navigate using:
   - **Click** to select folders, tags, and files
   - **Double-click** folders to expand/collapse
   - **Arrow keys** for navigation
   - **Tab** to switch between folder/tag and file panes
   - **Delete/Backspace** to delete (with optional confirmation)
4. Right-click for context menus:
   - Create new files and folders
   - Rename items
   - Delete items
   - Pin/unpin files
5. Drag and drop files between folders to organize

**Tip:** You can use the ribbon icon (folder tree icon) in the left sidebar to activate Notebook Navigator in case you close it by mistake.

## Keyboard Shortcuts

| Key | Action |
|-----|---------|
| ↑/↓ | Navigate up/down in current pane |
| ← | In folders: collapse or go to parent<br>In files: switch to folder pane |
| → | In folders: expand or switch to file pane<br>In files: open selected file |
| Tab | When in folders: switch to file pane<br>When in files: open selected file |
| Shift+Tab | Switch from files to folders pane |
| Delete (Windows/Linux)<br>Backspace (macOS) | Delete selected item |

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Notebook Navigator"
4. Click Install
5. Enable the plugin

### Manual Installation

1. Download the latest release from [GitHub](https://github.com/johansan/notebook-navigator/releases)
2. Extract the files to your vault's `.obsidian/plugins/notebook-navigator/` folder
3. Reload Obsidian
4. Enable the plugin in Settings

## Settings

![Settings Screenshot](https://github.com/johansan/notebook-navigator/blob/main/images/screenshot2.png?raw=true)

### File Organization

- **Sort files by:** Choose between date edited, date created, or title
- **Group notes by date:** When sorted by date, group files under headers like "Today", "Yesterday", etc.
- **Show notes from subfolders:** Display all notes from subfolders in the current folder view
- **Auto-reveal active file:** Automatically show and select files when opened from search or links
- **Excluded files:** Comma-separated list of frontmatter properties. Files containing any of these properties will be hidden (e.g., `draft, private, archived`)
- **Excluded folders:** Comma-separated list of folders to hide (e.g., `resources, templates`)

### File Display

- **Show file preview:** Display preview text beneath file names
- **Skip headings in preview:** Skip heading lines when generating preview text
- **Skip non-text in preview:** Skip images, embeds, and other non-text elements from preview text
- **Show feature image:** Display thumbnail images from frontmatter properties
- **Feature image property:** The frontmatter property name for thumbnails (default: `feature`)
  - **Tip:** Use the [Featured Image plugin](https://github.com/johansan/obsidian-featured-image) (also available in community plugins) to automatically set feature images for all your notes based on the first image in each document!

### Folder Display

- **Show root folder:** Display "Vault" as the root folder in the tree
- **Show folder file count:** Display the number of files in each folder (also applies to tag counts)
- **Show tags:** Display tags section below folders in the navigator

### Appearance

- **Date format:** Format for displaying dates (uses date-fns format)
  - Common formats:
    - `MMM d, yyyy` = Jan 5, 2024
    - `dd/MM/yyyy` = 05/01/2024
    - `yyyy-MM-dd` = 2024-01-05

### Advanced

- **Confirm before deleting files:** Show confirmation dialog when deleting files or folders
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

### Quick navigation patterns

- **Quick file access:** Press Tab from folders to jump to files
- **Parent folder navigation:** Press Left arrow to go up the folder tree
- **Rapid browsing:** Hold arrow keys for continuous navigation
- **Focus management:** The focused pane has a subtle border highlight

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

## Compatibility

- Works with all Obsidian themes
- Compatible with other file management plugins
- **Desktop only** - This plugin is only available for desktop versions of Obsidian
- Respects Obsidian's safe mode

## Support

If you have any questions, suggestions, or issues, please open an issue on the [GitHub repository](https://github.com/johansan/notebook-navigator).

## Development

This plugin is open source and built with a modern React/TypeScript stack. Contributions are welcome!

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

### Technical Stack

- **React** - Component-based UI with hooks and Context API
- **TypeScript** - Full type safety with strict mode
- **esbuild** - Lightning-fast bundling and development builds
- **Obsidian API** - Deep integration with Obsidian's plugin system

### Architecture Highlights

- **Component-based design** - Each UI element is a self-contained React component
- **Custom hooks** - Reusable logic for keyboard navigation, context menus, and drag-and-drop
- **Context providers** - Centralized state management without prop drilling
- **Service layer** - Clean separation of business logic from UI components
- **Zero setTimeout/DOM manipulation** - Pure React patterns for predictable behavior

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code:
- Follows React best practices and hooks rules
- Maintains TypeScript strict mode compliance
- Includes proper cleanup in useEffect hooks
- Avoids direct DOM manipulation
- Preserves keyboard navigation functionality
- Has been thoroughly tested on desktop

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by modern note-taking applications
- Built with the amazing [Obsidian API](https://docs.obsidian.md/)
- Thanks to all contributors and users for their feedback

---

Enjoy using Notebook Navigator!