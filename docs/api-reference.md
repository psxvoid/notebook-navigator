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

## API Naming Conventions

### Method Prefixes

- **`get*`** - Returns a single value or object (e.g., `getVersion()`,
  `getFocusedFile()`)
- **`list*`** - Returns an array (e.g., `listFeatures()`, `listSelectedFiles()`,
  `listPinnedFiles()`)
- **`set*`** - Sets a value (e.g., `setFolderColor()`, `setTagIcon()`)
- **`clear*`** - Removes/clears a value (e.g., `clearFolderColor()`,
  `clearTagIcon()`)
- **`is*`/`has*`** - Returns a boolean (e.g., `isPinned()`, `hasFeature()`,
  `hasMultipleSelection()`)
- **`toggle*`** - Toggles state, primarily for UI interactions (e.g.,
  `togglePin()`)
- **Action verbs** - Direct actions (e.g., `pin()`, `unpin()`, `delete()`,
  `moveTo()`, `navigateToFile()`)

### API Namespaces

- **`core`** - Main API methods (`negotiateVersion()`, `listFeatures()`, `on()`,
  `off()`)
- **`file`** - File operations (`delete()`, `moveTo()`)
- **`metadata`** - Folder/tag/pin management (`setFolderColor()`,
  `clearTagIcon()`, `pin()`)
- **`navigation`** - View navigation (`navigateToFile()`)
- **`selection`** - Selection state (`listSelectedFiles()`, `getFocusedFile()`,
  `getSelectedNavigationItem()`)

### Event Conventions

- **Event IDs** - Kebab-case (e.g., `storage-ready`, `folder-selected`,
  `file-selection-changed`, `pinned-files-changed`)
- **Event payload keys** - camelCase (e.g., `files`, `paths`, `focused`)

### Type Conventions

- **Prefer Obsidian types** - Use `TFile[]` and `TFolder` over `string[]` paths
  when possible
- **Path fields** - When paths are needed, explicitly name the field `paths` or
  `path`
- **Dual provision** - Provide both objects and paths when useful (e.g.,
  selection events include both `files: TFile[]` and `paths: string[]`)
- **Nullable fields** - Use `| null` for nullable fields (e.g.,
  `focused: TFile | null`)

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

| Method                      | Description                     |
| --------------------------- | ------------------------------- |
| `getVersion()`              | Get current API version         |
| `negotiateVersion(version)` | Negotiate version compatibility |
| `on(event, callback)`       | Subscribe to events             |
| `off(ref)`                  | Unsubscribe from events         |
| `hasFeature(feature)`       | Check if a feature is available |
| `listFeatures()`            | List all available features     |

### Available Features

Use `hasFeature()` and `listFeatures()` to check which features are available.

| Feature Key                           | Description                       |
| ------------------------------------- | --------------------------------- |
| `file.delete`                         | Delete files with smart selection |
| `file.moveTo`                         | Move files to another folder      |
| `metadata.setFolderColor`             | Set folder color                  |
| `metadata.clearFolderColor`           | Clear folder color                |
| `metadata.setFolderIcon`              | Set folder icon                   |
| `metadata.clearFolderIcon`            | Clear folder icon                 |
| `metadata.clearFolderAppearance`      | Clear folder appearance settings  |
| `metadata.setTagColor`                | Set tag color                     |
| `metadata.clearTagColor`              | Clear tag color                   |
| `metadata.setTagIcon`                 | Set tag icon                      |
| `metadata.clearTagIcon`               | Clear tag icon                    |
| `metadata.clearTagAppearance`         | Clear tag appearance settings     |
| `metadata.pin`                        | Pin a file                        |
| `metadata.unpin`                      | Unpin a file                      |
| `metadata.togglePin`                  | Toggle pin status                 |
| `metadata.listPinnedFiles`            | List all pinned files             |
| `navigation.navigateToFile`           | Navigate to a file                |
| `selection.listSelectedFiles`         | List selected files               |
| `selection.listSelectedPaths`         | List selected file paths          |
| `selection.getSelectionState`         | Get complete selection state      |
| `selection.getFocusedFile`            | Get focused file                  |
| `selection.getSelectedNavigationItem` | Get selected folder or tag        |
| `events.storage-ready`                | Storage ready event               |
| `events.folder-selected`              | Folder selected event             |
| `events.tag-selected`                 | Tag selected event                |
| `events.file-selection-changed`       | File selection change event       |
| `events.pinned-files-changed`         | Pinned files change event         |
| `events.folder-metadata-changed`      | Folder metadata change event      |
| `events.tag-metadata-changed`         | Tag metadata change event         |

```typescript
// Get the API instance
const nn = app.plugins.plugins['notebook-navigator']?.api;

// Check API version
const version = nn?.getVersion(); // Returns "1.0.0"

// Check compatibility with your plugin
const compatibility = nn?.negotiateVersion('1.0.0');
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
const pinnedFiles = nn?.metadata.listPinnedFiles() || [];
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

| Method                  | Description                                              | Since | Deprecated |
| ----------------------- | -------------------------------------------------------- | ----- | ---------- |
| `delete(files)`         | Delete one or more files with smart selection management | 1.0.0 |            |
| `moveTo(files, folder)` | Move one or more files to another folder                 | 1.0.0 |            |

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
const targetFolder = app.vault.getAbstractFileByPath('Archive');
if (targetFolder instanceof TFolder) {
  const result = await nn.file.moveTo(files, targetFolder);
  /* Returns MoveResult:
  {
    movedCount: number,    // Number of files successfully moved
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
| `setFolderColor(folder, color)` | Set folder color                                | 1.0.0 |            |
| `clearFolderColor(folder)`      | Clear folder color                              | 1.0.0 |            |
| `setFolderIcon(folder, icon)`   | Set folder icon                                 | 1.0.0 |            |
| `clearFolderIcon(folder)`       | Clear folder icon                               | 1.0.0 |            |
| **Tags**                        |                                                 |       |            |
| `getTagMetadata(tag)`           | Get tag color, icon, and appearance settings    | 1.0.0 |            |
| `setTagColor(tag, color)`       | Set tag color                                   | 1.0.0 |            |
| `clearTagColor(tag)`            | Clear tag color                                 | 1.0.0 |            |
| `setTagIcon(tag, icon)`         | Set tag icon                                    | 1.0.0 |            |
| `clearTagIcon(tag)`             | Clear tag icon                                  | 1.0.0 |            |
| **Pinned Files**                |                                                 |       |            |
| `listPinnedFiles()`             | List all pinned files                           | 1.0.0 |            |
| `isPinned(file)`                | Check if a file is pinned                       | 1.0.0 |            |
| `pin(file)`                     | Pin a file                                      | 1.0.0 |            |
| `unpin(file)`                   | Unpin a file                                    | 1.0.0 |            |
| `togglePin(file)`               | Toggle pin status (for UI)                      | 1.0.0 |            |

### Folder Metadata

```typescript
// Get folder metadata
const folder = app.vault.getAbstractFileByPath('Projects');
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
const pinnedFiles = nn.metadata.listPinnedFiles();

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

| Method                 | Description                                                         | Since | Deprecated |
| ---------------------- | ------------------------------------------------------------------- | ----- | ---------- |
| `navigateToFile(file)` | Reveal and select a file in the navigator (does not open in editor) | 1.0.0 |            |

```typescript
// Reveal and select a file in the navigator (does not open it in the editor)
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

| Method                        | Description                                             | Since | Deprecated |
| ----------------------------- | ------------------------------------------------------- | ----- | ---------- |
| **Navigation Selection**      |                                                         |       |            |
| `getSelectedNavigationItem()` | Get currently selected folder or tag in navigation pane | 1.0.0 |            |
| **File Selection**            |                                                         |       |            |
| `listSelectedFiles()`         | List all currently selected files as TFile array        | 1.0.0 |            |
| `listSelectedPaths()`         | List all selected file paths as string array            | 1.0.0 |            |
| `hasMultipleSelection()`      | Check if multiple files are selected                    | 1.0.0 |            |
| `getSelectionCount()`         | Get the count of selected files                         | 1.0.0 |            |
| `getFocusedFile()`            | Get the focused file (cursor position)                  | 1.0.0 |            |

```typescript
// Get the currently selected folder or tag in the navigation pane
const navSelection = nn.selection.getSelectedNavigationItem();
/* Returns:
{
  folder: TFolder | null,  // Currently selected folder (if folder is selected)
  tag: TagRef | null       // Currently selected tag (if tag is selected)
}
*/

// Check what's selected
if (navSelection.folder) {
  console.log('Selected folder:', navSelection.folder.path);
} else if (navSelection.tag) {
  console.log('Selected tag:', navSelection.tag);
}

// Get all currently selected files (returns TFile[])
const selectedFiles = nn.selection.listSelectedFiles();
console.log(`${selectedFiles.length} files selected`);

// Get just the file paths (returns string[])
const selectedPaths = nn.selection.listSelectedPaths();

// Check if multiple files are selected
if (nn.selection.hasMultipleSelection()) {
  console.log('Multiple files selected');
}

// Get the count of selected files
const count = nn.selection.getSelectionCount();

// Get the primary selected file (cursor position in multi-selection)
// This is the file that has keyboard focus
const focusedFile = nn.selection.getFocusedFile();
if (focusedFile) {
  console.log('Cursor is on:', focusedFile.basename);
}
```

## Events

Subscribe to events to react to changes in the navigator.

### Available Events

| Event                     | Payload                                            | Description                         | Since | Deprecated |
| ------------------------- | -------------------------------------------------- | ----------------------------------- | ----- | ---------- |
| `storage-ready`           | `void`                                             | Storage system is ready for queries | 1.0.0 |            |
| `folder-selected`         | `{ folder: TFolder }`                              | User selected a folder              | 1.0.0 |            |
| `tag-selected`            | `{ tag: TagRef }`                                  | User selected a tag                 | 1.0.0 |            |
| `file-selection-changed`  | `{ files: TFile[], focused: TFile \| null }`       | File selection changed              | 1.0.0 |            |
| `pinned-files-changed`    | `{ files: TFile[] }`                               | Pinned files changed                | 1.0.0 |            |
| `folder-metadata-changed` | `{ folder: TFolder, property: 'color' \| 'icon' }` | Folder metadata changed             | 1.0.0 |            |
| `tag-metadata-changed`    | `{ tag: TagRef, property: 'color' \| 'icon' }`     | Tag metadata changed                | 1.0.0 |            |

```typescript
// Listen for when storage is ready
nn.on('storage-ready', () => {
  console.log('Storage system is ready');
  // Now safe to query metadata, pinned files, etc.
  const pinnedFiles = nn.metadata.listPinnedFiles();
});

// Subscribe to folder selection events
const folderRef = nn.on('folder-selected', ({ folder }) => {
  console.log('Folder selected:', folder.path);
});

// Subscribe to tag selection events
const tagRef = nn.on('tag-selected', ({ tag }) => {
  console.log('Tag selected:', tag);
});

// Unsubscribe from events (idempotent - safe to call multiple times)
nn.off(ref);
nn.off(ref); // Safe to call again

// Listen for file selection changes
nn.on('file-selection-changed', ({ files, focused }) => {
  console.log(`Selection changed: ${files.length} files selected`);
  if (focused) console.log('Focused:', focused.basename);
  console.log(
    'Selected files:',
    files.map(f => f.path)
  );
});

// Listen for pinned files changes
nn.on('pinned-files-changed', ({ files }) => {
  console.log(`${files.length} files are pinned`);
  files.forEach(file => console.log('  -', file.path));
});

// Listen for metadata changes
nn.on('folder-metadata-changed', ({ folder, property }) => {
  console.log(`Folder ${folder.path} ${property} changed`);
});

nn.on('tag-metadata-changed', ({ tag, property }) => {
  console.log(`Tag ${tag} ${property} changed`);
});
```

### Event Details

- `storage-ready` - Fired when the plugin's storage system is fully initialized
  - Payload: `void`
  - **Important**: Wait for this event before querying metadata, pinned files,
    or other cached data
  - The storage system builds an IndexedDB cache of all vault files on startup

- `folder-selected` - Fired when the user selects a folder in the navigation
  pane
  - Payload: `{ folder: TFolder }`
  - Provides the TFolder object (use folder.path to get the path)
  - Triggered by user clicks in the navigation pane, NOT by API calls

- `tag-selected` - Fired when the user selects a tag in the navigation pane
  - Payload: `{ tag: TagRef }` where TagRef is `#${string}` type
  - Triggered by user clicks in the navigation pane, NOT by API calls

- `file-selection-changed` - Fired when the file selection changes
  - Payload: `{ files: TFile[], focused: TFile | null }`
  - `files`: Array of TFile objects that are currently selected
  - `focused`: The focused file (cursor position) or null if no focus
  - Triggered by user clicks, keyboard navigation, or multi-selection actions
  - Multi-selection state is persisted across plugin restarts

- `pinned-files-changed` - Fired when pinned files change
  - Payload: `{ files: TFile[] }`
  - `files`: Array of all currently pinned TFile objects
  - Triggered when any file is pinned or unpinned
  - Use this to track the current state of pinned files

- `folder-metadata-changed` - Fired when folder metadata changes
  - Payload: `{ folder: TFolder, property: 'color' | 'icon' }`
  - `folder`: The TFolder object that was changed
  - `property`: Which metadata property changed
  - Triggered when folder color or icon is modified

- `tag-metadata-changed` - Fired when tag metadata changes
  - Payload: `{ tag: TagRef, property: 'color' | 'icon' }`
  - `tag`: The tag reference (e.g., '#work')
  - `property`: Which metadata property changed
  - Triggered when tag color or icon is modified

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
    { path: 'Work', color: '#FF5733' },
    { path: 'Personal', color: '#33FF57' },
    { path: 'Archive', color: '#5733FF' }
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
    nn.metadata.listPinnedFiles().map(f => f.basename)
  );
}
```

### Clean up old files

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Find old files in Archive folder
  const archiveFolder = app.vault.getAbstractFileByPath('Archive');
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
    await nn.file.moveTo(files, projects);
  }
}
```

### Work with selected files

```javascript
// Process all currently selected files
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const selectedFiles = nn.selection.listSelectedFiles();

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
nn.on('file-selection-changed', async ({ files, paths, focused }) => {
  if (files.length > 0) {
    // Update a status bar item or perform other actions
    console.log(`User selected ${files.length} file(s)`);
    if (focused) {
      console.log(`Focused file: ${focused.basename}`);
    }
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
- `TagRef` - Type-safe tag reference
  ```typescript
  type TagRef = `#${string}`;
  ```
- `FolderAppearance` - Folder display settings
  ```typescript
  interface FolderAppearance {
    showPreview?: boolean;
    showImage?: boolean;
    layoutStyle?: 'list' | 'grid' | 'card';
  }
  ```
- `FolderMetadata` - Folder customization data
- `NavigationResult` - Result of navigation operations
- `SelectionState` - Current selection state
- `TagAppearance` - Tag display settings
  ```typescript
  interface TagAppearance {
    showPreview?: boolean;
    showImage?: boolean;
    layoutStyle?: 'list' | 'grid' | 'card';
  }
  ```
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
const features = nn.listFeatures();
console.log('Available features:', features);

// For plugin developers - ensure compatibility
const negotiation = nn.negotiateVersion('1.0.0');
if (negotiation.compatibility === 'incompatible') {
  console.error('This plugin requires Notebook Navigator API v1.0.0 or higher');
  return;
}

// Show any deprecation warnings
if (negotiation.deprecatedFeatures.length > 0) {
  console.warn('Using deprecated features:', negotiation.deprecatedFeatures);
}
```
