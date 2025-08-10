# Notebook Navigator API Reference

The Notebook Navigator plugin exposes a public API that allows other plugins and
scripts to interact with its features programmatically.

## Contents

- [File API](#file-api) - Smart file operations with selection management
- [Metadata API](#metadata-api) - Folder/tag customization and pinned files
- [Navigation API](#navigation-api) - Navigate to files in the navigator
- [Selection API](#selection-api) - Query current navigation and file selection
- [Events](#events) - Subscribe to navigator events

## API Version

Current API Version: **1.0.0**

The API follows semantic versioning:

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

## API Philosophy

When designing the Notebook Navigator API, the goal was to create a focused,
complementary interface that extends rather than duplicates Obsidian's
capabilities. The API exposes functionality that is unique to the plugin while
relying on Obsidian's robust built-in API for standard operations.

### What's Included

- **Smart file operations** - Delete/move files with automatic selection
  management in the navigator
- **Custom metadata** - Folder/tag colors, icons, and appearance settings not
  available in Obsidian
- **Pinned files** - Global pinning system for important notes
- **Navigation** - Navigate to files within the dual-pane view
- **Selection state** - Query what's currently selected in the navigator

### What's Not Included

- Basic file operations (use `app.vault.delete()`, `app.vault.rename()`)
- File content reading/writing (use `app.vault.read()`, `app.vault.modify()`)
- Metadata cache access (use `app.metadataCache`)
- Workspace management (use `app.workspace`)

This design philosophy keeps the API lean and maintainable while ensuring it
works seamlessly alongside Obsidian's native capabilities.

## Working with Obsidian Types

The Notebook Navigator API uses Obsidian's native `TFile` and `TFolder` objects
throughout, just like Obsidian's own API. This ensures consistency and type
safety when working with files and folders.

- **TFile** - Represents a file in your vault (obtained via
  `app.vault.getFileByPath()` or `app.workspace.getActiveFile()`)
- **TFolder** - Represents a folder in your vault (obtained via
  `app.vault.getAbstractFileByPath()` and checking `instanceof TFolder`)

All methods that work with files or folders accept these Obsidian objects
directly, not string paths. This design choice makes the API feel native to
Obsidian and prevents errors from invalid paths.

## Accessing the API

### Core Methods

| Method                        | Description                         | Since | Deprecated |
| ----------------------------- | ----------------------------------- | ----- | ---------- |
| `getVersion()`                | Get current API version             | 1.0.0 |            |
| `checkCompatibility(version)` | Check if your version is compatible | 1.0.0 |            |
| `on(event, callback)`         | Subscribe to events                 | 1.0.0 |            |
| `off(ref)`                    | Unsubscribe from events             | 1.0.0 |            |
| `hasFeature(feature)`         | Check if a feature is available     | 1.0.0 |            |
| `getAvailableFeatures()`      | Get list of all available features  | 1.0.0 |            |

```typescript
// Get the API instance
const nn = app.plugins.plugins['notebook-navigator']?.api;

// Check API version
const version = nn?.getVersion(); // Returns "1.0.0"

// Check compatibility with your plugin
const compatibility = nn?.checkCompatibility('1.0.0');
/* Returns VersionNegotiation object:
{
  apiVersion: string,           // Current API version (e.g., "1.0.0")
  compatibility: CompatibilityLevel, // 'full' | 'partial' | 'limited' | 'incompatible'
  availableFeatures: string[],  // List of available feature names
  deprecatedFeatures: string[]  // Features you're using that are deprecated
}
*/

// TypeScript users can import types for better code completion and type safety
// Add these imports at the top of your .ts file:
import type {
  NotebookNavigatorAPI,
  FolderMetadata,
  TagMetadata
} from 'notebook-navigator/api';

// Then cast the API to get proper typing:
const api = app.plugins.plugins['notebook-navigator']
  ?.api as NotebookNavigatorAPI;

// Optional: Add this module declaration to a .d.ts file in your project
// to get typing everywhere without needing to cast:
declare module 'obsidian' {
  interface App {
    plugins: {
      plugins: {
        'notebook-navigator'?: {
          api: NotebookNavigatorAPI;
        };
      };
    };
  }
}
```

## Quick Access Examples

For simple scripts and inline JavaScript (Templater, DataviewJS, etc.):

```javascript
// Get the Notebook Navigator API
const nn = app.plugins.plugins['notebook-navigator']?.api;

// Quick checks using the sub-APIs
const file = app.workspace.getActiveFile();
const folder = file?.parent;

const isPinned = nn?.metadata.isPinned(file);
const folderMeta = nn?.metadata.getFolderMetadata(folder);
const tagMeta = nn?.metadata.getTagMetadata('#work');
```

### Templater Examples

```javascript
<%*
// Check if current file is pinned
const nn = app.plugins.plugins['notebook-navigator']?.api;
const file = app.workspace.getActiveFile();
if (file && nn?.metadata.isPinned(file)) {
  tR += `This file is pinned!`;
}
%>
```

### DataviewJS Examples

```javascript
// List all pinned files
const nn = app.plugins.plugins['notebook-navigator']?.api;
const pinnedFiles = nn?.metadata.getPinnedFiles() || [];
for (const file of pinnedFiles) {
  dv.paragraph(`- [[${file.basename}]]`);
}
```

### Console Quick Scripts

```javascript
// Pin the active file
const nn = app.plugins.plugins['notebook-navigator']?.api;
const file = app.workspace.getActiveFile();
if (file) await nn.metadata.togglePin(file);

// Set color for current folder
const folder = app.workspace.getActiveFile()?.parent;
if (folder) await nn.metadata.setFolderColor(folder, '#FF5733');
```

## File API

Smart file operations with automatic selection management. The File API provides
intelligent handling when deleting or moving files:

- Maintains focus in the file list
- Automatically selects the next appropriate file in the list
- Honors the confirmation settings configured in Notebook Navigator
- Handles edge cases like deleting the last file in a folder

### Methods

| Method                | Description                                              | Since | Deprecated |
| --------------------- | -------------------------------------------------------- | ----- | ---------- |
| `delete(files)`       | Delete one or more files with smart selection management | 1.0.0 |            |
| `move(files, folder)` | Move one or more files to another folder                 | 1.0.0 |            |

```typescript
// Delete one or more files with smart selection
// Automatically manages selection after deletion
const file = app.vault.getFileByPath('notes/old.md');
if (file) await nn.file.delete(file);

// Delete multiple files
const files = [file1, file2]; // TFile objects
await nn.file.delete(files);

// Move one or more files to another folder
// Automatically manages selection after move
const targetFolder = app.vault.getAbstractFileByPath('/Archive');
if (targetFolder instanceof TFolder) {
  const result = await nn.file.move(files, targetFolder);
  /* Returns:
  {
    movedCount: number,    // Number of files successfully moved
    skippedCount: number,  // Number of files skipped (already exist)
    errors: Array<{        // Array of errors if any
      file: TFile,
      error: string
    }>
  }
  */
}
```

## Metadata API

Customize folder and tag appearance, manage pinned notes.

### Methods

| Method                          | Description                                     | Since | Deprecated |
| ------------------------------- | ----------------------------------------------- | ----- | ---------- |
| **Folders**                     |                                                 |       |            |
| `getFolderMetadata(folder)`     | Get folder color, icon, and appearance settings | 1.0.0 |            |
| `setFolderColor(folder, color)` | Set or remove folder color                      | 1.0.0 |            |
| `setFolderIcon(folder, icon)`   | Set or remove folder icon                       | 1.0.0 |            |
| **Tags**                        |                                                 |       |            |
| `getTagMetadata(tag)`           | Get tag color, icon, and appearance settings    | 1.0.0 |            |
| `setTagColor(tag, color)`       | Set or remove tag color                         | 1.0.0 |            |
| `setTagIcon(tag, icon)`         | Set or remove tag icon                          | 1.0.0 |            |
| **Pinned Files**                |                                                 |       |            |
| `getPinnedFiles()`              | Get all pinned files                            | 1.0.0 |            |
| `isPinned(file)`                | Check if a file is pinned                       | 1.0.0 |            |
| `togglePin(file)`               | Toggle pin status                               | 1.0.0 |            |

### Folder Metadata

```typescript
// Get folder metadata
const folder = app.vault.getAbstractFileByPath('/Projects');
if (folder instanceof TFolder) {
  const metadata = nn.metadata.getFolderMetadata(folder);
  /* Returns FolderMetadata object:
  {
    color?: string,          // Hex color or CSS color
    icon?: string,           // Icon identifier (e.g., 'lucide:folder')
    appearance?: FolderAppearance // Display settings
  }
  */

  // Set folder color
  await nn.metadata.setFolderColor(folder, '#FF5733');

  // Set folder icon (lucide icon or emoji)
  await nn.metadata.setFolderIcon(folder, 'lucide:folder-open');
  await nn.metadata.setFolderIcon(folder, 'emoji:📁');
}
```

### Pinned Notes

```typescript
// Get all pinned files (returns TFile[])
const pinnedFiles = nn.metadata.getPinnedFiles();

// Check if a file is pinned
const file = app.workspace.getActiveFile();
const isPinned = nn.metadata.isPinned(file);

// Toggle pin status for a file
await nn.metadata.togglePin(file);
```

### Tag Metadata

```typescript
// Get tag metadata
const metadata = nn.metadata.getTagMetadata('#work');
/* Returns TagMetadata object (or null if no metadata):
{
  color?: string,          // Hex color or CSS color
  icon?: string,           // Icon identifier
  appearance?: TagAppearance, // Display settings
  isFavorite?: boolean     // Whether tag is marked as favorite
}
*/

// Set tag color
await nn.metadata.setTagColor('#work', '#00FF00');

// Set tag icon
await nn.metadata.setTagIcon('#work', 'lucide:tag');
```

## Navigation API

Navigate to and reveal files in the navigator.

### Methods

| Method                 | Description                                       | Since | Deprecated |
| ---------------------- | ------------------------------------------------- | ----- | ---------- |
| `navigateToFile(file)` | Navigate to a file and select it in the navigator | 1.0.0 |            |

```typescript
// Navigate to a specific file
const file = app.vault.getFileByPath('notes/example.md');
if (file) await nn.navigation.navigateToFile(file);

// Reveal the active file (just use navigateToFile)
const activeFile = app.workspace.getActiveFile();
if (activeFile) await nn.navigation.navigateToFile(activeFile);
```

## Selection API

Get the current selection state in the navigator, including both navigation pane
(folder/tag) and file list selections.

### Methods

| Method                     | Description                                             | Since | Deprecated |
| -------------------------- | ------------------------------------------------------- | ----- | ---------- |
| **Navigation Selection**   |                                                         |       |            |
| `getNavigationSelection()` | Get currently selected folder or tag in navigation pane | 1.0.0 |            |
| **File Selection**         |                                                         |       |            |
| `getSelectedFiles()`       | Get all currently selected files as TFile array         | 1.0.0 |            |
| `getSelectedFilePaths()`   | Get all selected file paths as string array             | 1.0.0 |            |
| `hasMultipleSelection()`   | Check if multiple files are selected                    | 1.0.0 |            |
| `getSelectionCount()`      | Get the count of selected files                         | 1.0.0 |            |
| `getPrimarySelectedFile()` | Get the primary selected file (cursor position)         | 1.0.0 |            |

```typescript
// Get the currently selected folder or tag in the navigation pane
const navSelection = nn.selection.getNavigationSelection();
/* Returns:
{
  folder: TFolder | null,  // Currently selected folder (if folder is selected)
  tag: string | null       // Currently selected tag (if tag is selected)
}
*/

// Check what's selected
if (navSelection.folder) {
  console.log('Selected folder:', navSelection.folder.path);
} else if (navSelection.tag) {
  console.log('Selected tag:', navSelection.tag);
}

// Get all currently selected files (returns TFile[])
const selectedFiles = nn.selection.getSelectedFiles();
console.log(`${selectedFiles.length} files selected`);

// Get just the file paths (returns string[])
const selectedPaths = nn.selection.getSelectedFilePaths();

// Check if multiple files are selected
if (nn.selection.hasMultipleSelection()) {
  console.log('Multiple files selected');
}

// Get the count of selected files
const count = nn.selection.getSelectionCount();

// Get the primary selected file (cursor position in multi-selection)
// This is the file that has keyboard focus
const primaryFile = nn.selection.getPrimarySelectedFile();
if (primaryFile) {
  console.log('Cursor is on:', primaryFile.basename);
}
```

## Events

Subscribe to events to react to changes in the navigator.

### Available Events

| Event                    | Payload                                     | Description                         | Since | Deprecated |
| ------------------------ | ------------------------------------------- | ----------------------------------- | ----- | ---------- |
| `navigation-changed`     | `{ type: 'folder' \| 'tag', path: string }` | User navigated to a folder or tag   | 1.0.0 |            |
| `storage-ready`          | `void`                                      | Storage system is ready for queries | 1.0.0 |            |
| `file-selection-changed` | `{ files: string[], count: number }`        | File selection changed              | 1.0.0 |            |

```typescript
// Listen for when storage is ready
nn.on('storage-ready', () => {
  console.log('Storage system is ready');
  // Now safe to query metadata, pinned files, etc.
  const pinnedFiles = nn.metadata.getPinnedFiles();
});

// Subscribe to navigation events
const ref = nn.on('navigation-changed', ({ type, path }) => {
  console.log(`User navigated to ${type}: ${path}`);

  // React to navigation changes
  if (type === 'folder') {
    // User selected a folder in the navigation pane
    console.log('Folder selected:', path);
  } else if (type === 'tag') {
    // User selected a tag in the navigation pane
    console.log('Tag selected:', path);
  }
});

// Unsubscribe from events
nn.off(ref);

// Listen for file selection changes
nn.on('file-selection-changed', ({ files, count }) => {
  console.log(`Selection changed: ${count} files selected`);
  if (count > 1) {
    console.log('Multiple selection active');
  }
  console.log('Selected files:', files);
});
```

### Available Events

- `storage-ready` - Fired when the plugin's storage system is fully initialized
  - Payload: `void`
  - **Important**: Wait for this event before querying metadata, pinned files,
    or other cached data
  - The storage system builds an IndexedDB cache of all vault files on startup

- `navigation-changed` - Fired when the user navigates to a folder or tag in the
  UI
  - Payload: `{ type: 'folder' | 'tag', path: string }`
  - Triggered by user clicks in the navigation pane, NOT by API calls
  - Use this to react to user navigation actions

- `file-selection-changed` - Fired when the file selection changes
  - Payload: `{ files: string[], count: number }`
  - `files`: Array of file paths that are currently selected
  - `count`: Number of selected files
  - Triggered by user clicks, keyboard navigation, or multi-selection actions
  - Multi-selection state is persisted across plugin restarts

## Examples

### Reveal active file in navigator

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const activeFile = app.workspace.getActiveFile();
  if (activeFile) {
    await nn.navigation.navigateToFile(activeFile);
  }
}
```

### Apply theme colors to folders

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const folders = [
    { path: '/Work', color: '#FF5733' },
    { path: '/Personal', color: '#33FF57' },
    { path: '/Archive', color: '#5733FF' }
  ];

  for (const { path, color } of folders) {
    const folder = app.vault.getAbstractFileByPath(path);
    if (folder instanceof TFolder) {
      await nn.metadata.setFolderColor(folder, color);
    }
  }
}
```

### Pin important files

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Get all files with #important tag
  const taggedFiles = app.vault.getMarkdownFiles().filter(file => {
    const cache = app.metadataCache.getFileCache(file);
    return cache?.tags?.some(t => t.tag === '#important');
  });

  // Pin them all
  for (const file of taggedFiles) {
    if (!nn.metadata.isPinned(file)) {
      await nn.metadata.togglePin(file);
    }
  }

  console.log(
    'Pinned files:',
    nn.metadata.getPinnedFiles().map(f => f.basename)
  );
}
```

### Clean up old files

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Find old files in Archive folder
  const archiveFolder = app.vault.getAbstractFileByPath('/Archive');
  if (archiveFolder instanceof TFolder) {
    const oldFiles = archiveFolder.children
      .filter((f): f is TFile => f instanceof TFile)
      .filter(f => {
        // Files older than 30 days
        return f.stat.mtime < Date.now() - 30 * 24 * 60 * 60 * 1000;
      });

    if (oldFiles.length > 0) {
      // Delete with smart selection management
      await nn.file.delete(oldFiles);
      console.log(`Deleted ${oldFiles.length} old files`);
    }
  }
}
```

### Bulk move files

```javascript
// Move all files from Inbox to Projects folder
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const inbox = app.vault.getAbstractFileByPath('Inbox');
  const projects = app.vault.getAbstractFileByPath('Projects');

  if (inbox instanceof TFolder && projects instanceof TFolder) {
    const files = inbox.children.filter(f => f instanceof TFile);
    await nn.file.move(files, projects);
  }
}
```

### Work with selected files

```javascript
// Process all currently selected files
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const selectedFiles = nn.selection.getSelectedFiles();

  // Add a tag to all selected files
  for (const file of selectedFiles) {
    await app.fileManager.processFrontMatter(file, fm => {
      if (!fm.tags) fm.tags = [];
      if (!fm.tags.includes('processed')) {
        fm.tags.push('processed');
      }
    });
  }

  console.log(`Processed ${selectedFiles.length} files`);
}

// React to selection changes
nn.on('file-selection-changed', async ({ files, count }) => {
  if (count > 0) {
    // Update a status bar item or perform other actions
    console.log(`User selected ${count} file(s)`);

    // Get the actual TFile objects if needed
    const fileObjects = files
      .map(path => app.vault.getFileByPath(path))
      .filter(f => f !== null);
  }
});
```

## Type Definitions

The API provides comprehensive TypeScript type definitions. Import these types
from `notebook-navigator/api` for type-safe development:

- `APIError` - Standardized error type with error codes
- `APIErrorCode` - Enumeration of all possible error codes
- `CachedFileData` - Cached file metadata and content
- `CompatibilityLevel` - API compatibility levels (full, partial, limited,
  incompatible)
- `FileQueryOptions` - Options for querying files
- `FolderAppearance` - Folder display settings
  ```typescript
  interface FolderAppearance {
    titleRows?: number; // Number of title rows to display
    previewRows?: number; // Number of preview rows
    showDate?: boolean; // Show file dates
    showPreview?: boolean; // Show file preview text
    showImage?: boolean; // Show feature images
  }
  ```
- `FolderMetadata` - Folder customization data
- `NavigationResult` - Result of navigation operations
- `SelectionState` - Current selection state
- `TagAppearance` - Tag display settings (same as FolderAppearance)
- `TagMetadata` - Tag customization data
- `VersionNegotiation` - Result of version compatibility check
- `ViewState` - Current view state

## Error Handling

The API uses standardized error codes for consistent error handling:

```typescript
import { APIError, APIErrorCode } from 'notebook-navigator/api';

try {
  const file = app.vault.getFileByPath('non-existent.md');
  if (file) await nn.file.delete(file);
} catch (error) {
  if (error instanceof APIError) {
    switch (error.code) {
      case APIErrorCode.FILE_NOT_FOUND:
        console.log('File not found');
        break;
      case APIErrorCode.PERMISSION_DENIED:
        console.log('Permission denied');
        break;
      default:
        console.log('Unknown error:', error.message);
    }
  }
}
```

## Version Compatibility

The API includes built-in version checking and compatibility layers.

### Compatibility Levels

- **`full`** - Your version matches exactly, all features work as expected
- **`partial`** - Your version is newer than the API, some features may not
  exist yet
- **`limited`** - Your version is older but still supported, with compatibility
  adapters
- **`incompatible`** - Your version is too old or too new to work properly

### Usage Examples

```typescript
// Check if a feature is available
if (nn.hasFeature('file.delete')) {
  // Feature is available
  await nn.file.delete(files);
}

// Get all available features
const features = nn.getAvailableFeatures();
console.log('Available features:', features);

// For plugin developers - ensure compatibility
const negotiation = nn.checkCompatibility('1.0.0');
if (negotiation.compatibility === 'incompatible') {
  console.error('This plugin requires Notebook Navigator API v1.0.0 or higher');
  return;
}

// Show any deprecation warnings
if (negotiation.deprecatedFeatures.length > 0) {
  console.warn('Using deprecated features:', negotiation.deprecatedFeatures);
}
```
