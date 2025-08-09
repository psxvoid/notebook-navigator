# Notebook Navigator API Reference

The Notebook Navigator plugin exposes a public API that allows other plugins and
scripts to interact with its features programmatically.

## API Version

Current API Version: **1.0.0**

The API follows semantic versioning:

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

## API Philosophy

The Notebook Navigator API **only** exposes functionality that is unique to the
plugin. We do not duplicate any features that can be achieved with Obsidian's
built-in API.

### What We Provide

- **Smart file operations** - Delete/move files with automatic selection
  management in our navigator
- **Custom metadata** - Folder/tag colors, icons, and appearance settings not
  available in Obsidian
- **Pinned files** - Global pinning system specific to our navigation workflow
- **Navigator control** - Navigate within our dual-pane view, not Obsidian's
  file explorer

### What We Don't Provide

- Basic file operations (use `app.vault.delete()`, `app.vault.rename()`)
- File content reading/writing (use `app.vault.read()`, `app.vault.modify()`)
- Metadata cache access (use `app.metadataCache`)
- Workspace management (use `app.workspace`)

This focused approach ensures the API remains lean, maintainable, and truly
complementary to Obsidian's API.

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
  clientVersion: string,         // Your requested version
  compatibility: CompatibilityLevel, // 'full' | 'partial' | 'limited' | 'incompatible'
  availableFeatures: string[],  // List of available feature names
  deprecatedFeatures: string[]  // Features you're using that are deprecated
}
*/

// TypeScript users can import types
import type {
  NotebookNavigatorAPI,
  FolderMetadata,
  TagMetadata
} from 'notebook-navigator/api';
const api = app.plugins.plugins['notebook-navigator']
  ?.api as NotebookNavigatorAPI;
```

## Quick Access Methods

For simple scripts and inline JavaScript (Templater, DataviewJS, etc.), the API
provides direct methods:

```javascript
// Get the Notebook Navigator API
const nn = app.plugins.plugins['notebook-navigator']?.api;

// Quick checks
const file = app.workspace.getActiveFile();
const folder = file?.parent;

const isPinned = nn.isPinned(file);
const folderColor = nn.getFolderColor(folder);
const tagColor = nn.getTagColor('#work');
const isOpen = nn.isNavigatorOpen();
```

### Templater Examples

```javascript
<%*
// Check if current file is pinned
const nn = app.plugins.plugins['notebook-navigator']?.api;
const file = app.workspace.getActiveFile();
if (file && nn?.isPinned(file)) {
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

## API Structure

The API is organized into four main sub-APIs:

- **File API** - Smart file deletion and movement
- **Metadata API** - Folder/tag colors, icons, and pinned files
- **Navigation API** - Navigate to files, folders, and tags
- **Selection API** - Get current selection state

## File API

Smart file operations with automatic selection management.

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

### Why Use File API?

The File API provides smart selection management when deleting or moving files:

- Automatically selects the next appropriate file in the list
- Maintains focus in the file list for smooth workflow
- Respects your plugin's confirmation settings
- Handles edge cases like deleting the last file in a folder

## Metadata API

Customize folder and tag appearance, manage pinned notes.

### Folder Metadata

```typescript
// Get folder metadata
const folder = app.vault.getAbstractFileByPath('/Projects');
if (folder instanceof TFolder) {
  const metadata = nn.metadata.getFolderMetadata(folder);
  /* Returns FolderMetadata object:
  {
    path: string,            // Folder path
    color?: string,          // Hex color or CSS color
    icon?: string,           // Icon identifier (e.g., 'lucide:folder')
    sortOverride?: SortOption, // Custom sort order for this folder
    appearance?: FolderAppearance // Display settings
  }
  */

  // Set folder color
  await nn.metadata.setFolderColor(folder, '#FF5733');

  // Set folder icon (lucide icon or emoji)
  await nn.metadata.setFolderIcon(folder, 'lucide:folder-open');
  await nn.metadata.setFolderIcon(folder, 'emoji:📁');

  // Set custom sort order for a folder
  await nn.metadata.setFolderSortOverride(folder, 'name-asc');
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

// Pin a file (only if not already pinned)
await nn.metadata.pinFile(file);

// Unpin a file (only if pinned)
await nn.metadata.unpinFile(file);
```

### Tag Metadata

```typescript
// Get tag metadata
const metadata = nn.metadata.getTagMetadata('#work');
/* Returns TagMetadata object (or null if no metadata):
{
  path: string,            // Tag path
  color?: string,          // Hex color or CSS color
  icon?: string,           // Icon identifier
  sortOverride?: SortOption, // Custom sort order for this tag
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

Navigate programmatically to folders, tags, and files.

```typescript
// Navigate to a file
const file = app.vault.getFileByPath('notes/example.md');
if (file) await nn.navigation.navigateToFile(file);

// Navigate to a folder
const folder = app.vault.getAbstractFileByPath('/path/to/folder');
if (folder instanceof TFolder) {
  await nn.navigation.navigateToFolder(folder);
}

// Navigate to a tag
await nn.navigation.navigateToTag('#project/active');

// Reveal the currently active file
await nn.navigation.revealActiveFile();
```

## Selection API

Get the current selection state in the navigator.

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

// Get the currently selected files in the file list
const selectedFiles = nn.selection.getSelectedFiles();
// Returns: TFile[] - Array of selected files

// Example: Process selected files
for (const file of selectedFiles) {
  console.log('Selected file:', file.path);
}
```

## Events

Subscribe to events to react to changes in the navigator.

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

## Examples

### Navigate to folder of active file

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const activeFile = app.workspace.getActiveFile();
  if (activeFile?.parent) {
    await nn.navigation.navigateToFolder(activeFile.parent);
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
    await nn.metadata.pinFile(file);
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
      .filter(f => f instanceof TFile)
      .filter(f => {
        // Files older than 30 days
        return f.stat.mtime < Date.now() - 30 * 24 * 60 * 60 * 1000;
      }) as TFile[];

    if (oldFiles.length > 0) {
      // Delete with smart selection management
      await nn.file.delete(oldFiles);
      console.log(`Deleted ${oldFiles.length} old files`);
    }
  }
}
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
- `SortOption` - Sort options for folders/tags
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
