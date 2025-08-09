# Notebook Navigator API Reference

The Notebook Navigator plugin exposes a public API that allows other plugins and
scripts to interact with its features programmatically.

## API Version

Current API Version: **1.0.0**

The API follows semantic versioning:

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

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
  deprecatedFeatures: string[], // Features you're using that are deprecated
  migrationSuggestions: string[] // Helpful migration tips
}
*/

// Get a compatibility-wrapped API (for older plugins)
const compatibleAPI = nn?.getCompatibleAPI('0.9.0');

// TypeScript users can import types
import type {
  NotebookNavigatorAPI,
  SelectionState
} from 'notebook-navigator/api';
const api = app.plugins.plugins['notebook-navigator']
  ?.api as NotebookNavigatorAPI;
```

## API Structure

The API is organized into several sub-APIs for different functionality:

- **FileSystem API** - Smart file deletion and management
- **Metadata API** - Customize folder/tag appearance and pinning
- **Navigation API** - Control view navigation
- **Selection API** - Manage selected items
- **Storage API** - Access cached file data
- **Tag API** - Query and manage tags
- **View API** - Control the navigator view

## FileSystem API

Smart file deletion and management with automatic selection handling.

```typescript
// Delete a file with smart selection
// Automatically selects the next file in the list after deletion
// Uses the plugin's confirmation setting
await nn.fileSystem.deleteFile('notes/old.md');

// Delete multiple files with smart selection
// Automatically manages selection after deletion
await nn.fileSystem.deleteFiles(['file1.md', 'file2.md']);

// Move files to another folder
// Automatically manages selection after deletion
const result = await nn.fileSystem.moveFiles(
  ['notes/file1.md', 'notes/file2.md'],
  '/Archive'
);
/* Returns:
{
  movedCount: number,    // Number of files successfully moved
  skippedCount: number,  // Number of files skipped (already exist)
  errors: Array<{        // Array of errors if any
    path: string,
    error: string
  }>
}
*/
```

### Why Use FileSystem API?

The FileSystem API provides smart selection management when deleting files:

- Automatically selects the next appropriate file in the list
- Maintains focus in the file list for smooth workflow
- Respects your plugin's confirmation settings
- Handles edge cases like deleting the last file in a folder

## Metadata API

Customize folder and tag appearance, manage pinned notes.

### Folder Metadata

```typescript
// Get folder metadata
const metadata = nn.metadata.getFolderMetadata('/Projects');
/* Returns FolderMetadata object:
{
  path: string,            // Folder path
  color?: string,          // Hex color or CSS color
  icon?: string,           // Icon identifier (e.g., 'lucide:folder')
  sortOverride?: SortOption, // Custom sort order for this folder
  appearance?: FolderAppearance, // Display settings
  pinnedNotes?: string[]   // Deprecated - use global pinned notes
}
*/

// Set folder color
await nn.metadata.setFolderColor('/Projects', '#FF5733');

// Set folder icon (lucide icon or emoji)
await nn.metadata.setFolderIcon('/Projects', 'lucide:folder-open');
await nn.metadata.setFolderIcon('/Projects', 'emoji:📁');

// Set custom sort order for a folder
await nn.metadata.setFolderSortOverride('/Projects', 'name-asc');
```

### Pinned Notes

```typescript
// Get all pinned files
const pinnedFiles = nn.metadata.getPinnedFiles();
// Returns: string[] - array of file paths

// Check if a file is pinned
const isPinned = nn.metadata.isPinned('notes/important.md');

// Toggle pin status for a file (pinned files appear at top of lists)
await nn.metadata.togglePin('notes/important.md');
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
await nn.navigation.navigateToFile('notes/example.md');

// Navigate to a folder
await nn.navigation.navigateToFolder('/path/to/folder');

// Navigate to a tag
await nn.navigation.navigateToTag('#project/active');

// Reveal the currently active file
await nn.navigation.revealActiveFile();
```

## Selection API

Get and set the current selection state.

```typescript
// Clear selection
nn.selection.clearSelection();

// Get current selection
const selection = nn.selection.getSelection();
/* Returns SelectionState object:
{
  folder: string | null,   // Currently selected folder path
  tag: string | null,      // Currently selected tag
  files: string[]          // Array of selected file paths
}
*/

// Select multiple files
nn.selection.selectFiles(['file1.md', 'file2.md']);

// Select a folder
nn.selection.selectFolder('/Projects');

// Select a tag
nn.selection.selectTag('#work');
```

## Storage API

Access cached file data and query files.

```typescript
// Get cached data for a file
const fileData = await nn.storage.getFileData('notes/example.md');
/* Returns CachedFileData object (or null if not cached):
{
  path: string,           // File path
  mtime: number,          // Modified time timestamp
  tags: string[] | null,  // Array of tags or null
  preview: string | null, // Preview text or null
  featureImage: string | null, // Feature image path or null
  metadata: {             // File metadata
    name?: string,
    created?: number,
    modified?: number
  } | null
}
*/

// Check if storage is ready
const isReady = nn.storage.isStorageReady();

// Query files with criteria
const files = await nn.storage.queryFiles({
  folder: '/Projects',
  tag: '#active',
  hasPreview: true,
  hasFeatureImage: false,
  includeSubfolders: true,
  limit: 100
});
// Returns: CachedFileData[] - Array of matching files
```

## Tag API

Query and manage the tag system.

```typescript
// Add tag to files
const result = await nn.tags.addTagToFiles('#review', ['file1.md', 'file2.md']);
/* Returns BatchOperationResult:
{
  success: number,        // Number of successful operations
  failed: number,         // Number of failed operations
  errors: Array<{         // Details of any errors
    path: string,
    error: string
  }>
}
*/

// Find a specific tag node
const tagNode = nn.tags.findTagNode('#project/active');
// Returns: TagTreeNode object or null if not found

// Get all tag paths
const allTags = nn.tags.getAllTagPaths();

// Get favorite tags
const favorites = nn.tags.getFavoriteTags();

// Get files with a specific tag
const files = await nn.tags.getFilesWithTag('#project');
// Returns: TFile[] - Array of Obsidian file objects

// Get the complete tag tree
const tagTree = nn.tags.getTagTree();
// Returns: TagTreeNode - Root node of the tag hierarchy

// Get count of untagged files
const untaggedCount = nn.tags.getUntaggedCount();

// Remove tag from files
const result = await nn.tags.removeTagFromFiles('#draft', ['file1.md']);
// Returns: BatchOperationResult (same structure as addTagToFiles)

// Toggle favorite status for a tag
await nn.tags.toggleFavoriteTag('#important');
```

## View API

Control the navigator view itself.

```typescript
// Close the navigator view
nn.view.close();

// Get current view state
const state = nn.view.getViewState();
/* Returns ViewState object (or null if view not open):
{
  isOpen: boolean,         // Whether the navigator view is open
  isActive: boolean,       // Whether the view is currently active/focused
  paneWidth: number,       // Width of navigation pane in pixels
  dualPane: boolean,       // Whether dual-pane mode is enabled
  focusedPane: 'navigation' | 'list' // Which pane has focus
}
*/

// Check if view is open
const isOpen = nn.view.isOpen();

// Open the navigator view
await nn.view.open();

// Set pane width
nn.view.setPaneWidth(400);

// Toggle single pane mode
await nn.view.toggleSinglePaneMode();
```

## Events

Subscribe to events to react to changes in the navigator.

```typescript
// Subscribe to events
const ref = nn.on('selection-changed', selection => {
  console.log('New selection:', selection);
});

nn.on('navigation-changed', ({ type, path }) => {
  console.log(`Navigated to ${type}: ${path}`);
});

nn.on('metadata-changed', ({ type, path }) => {
  console.log(`Metadata changed for ${type}: ${path}`);
});

nn.on('tags-updated', ({ added, removed, modified }) => {
  console.log('Tags updated:', { added, removed, modified });
});

// Unsubscribe from events
nn.off(ref);
```

### Available Events

- `file-cached` - File data was cached
- `metadata-changed` - Folder/tag/file metadata changed
- `navigation-changed` - Navigation occurred
- `selection-changed` - Selection state changed
- `settings-changed` - Plugin settings changed
- `storage-ready` - Storage system is ready
- `tags-updated` - Tag tree was updated

## Examples

### Navigate to folder of active file

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const activeFile = app.workspace.getActiveFile();
  if (activeFile?.parent) {
    await nn.navigation.navigateToFolder(activeFile.parent.path);
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

  for (const folder of folders) {
    await nn.metadata.setFolderColor(folder.path, folder.color);
  }
}
```

### Find files with multiple tags

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const tag1Files = await nn.tags.getFilesWithTag('#project');
  const tag2Files = await nn.tags.getFilesWithTag('#active');

  // Find intersection
  const tag2Paths = new Set(tag2Files.map(f => f.path));
  const filesWithBothTags = tag1Files.filter(f => tag2Paths.has(f.path));

  console.log('Files with both tags:', filesWithBothTags);
}
```

### Pin important files

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Pin files based on criteria
  const files = await nn.storage.queryFiles({
    tag: '#important',
    limit: 10
  });

  for (const file of files) {
    if (!nn.metadata.isPinned(file.path)) {
      await nn.metadata.togglePin(file.path);
    }
  }

  console.log('Pinned files:', nn.metadata.getPinnedFiles());
}
```

### Clean up old files

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Find old archived files
  const oldFiles = await nn.storage.queryFiles({
    folder: '/Archive',
    limit: 100
  });

  // Filter files older than 30 days
  const toDelete = oldFiles
    .filter(f => f.mtime < Date.now() - 30 * 24 * 60 * 60 * 1000)
    .map(f => f.path);

  if (toDelete.length > 0) {
    // Delete with smart selection management
    await nn.fileSystem.deleteFiles(toDelete);
    console.log(`Deleted ${toDelete.length} old files`);
  }

  // Move completed tasks to archive
  const completedTasks = await nn.storage.queryFiles({
    tag: '#completed',
    folder: '/Tasks'
  });

  if (completedTasks.length > 0) {
    const result = await nn.fileSystem.moveFiles(
      completedTasks.map(f => f.path),
      '/Archive/CompletedTasks'
    );

    console.log(
      `Moved ${result.movedCount} tasks, skipped ${result.skippedCount}`
    );
  }
}
```

## Type Definitions

The API provides comprehensive TypeScript type definitions. Import these types
from `notebook-navigator/api` for type-safe development:

- `APIError` - Standardized error type with error codes
- `APIErrorCode` - Enumeration of all possible error codes
- `BatchOperationResult` - Result of batch operations
- `CachedFileData` - Cached file metadata and content
- `CompatibilityLevel` - API compatibility levels (full, partial, limited,
  incompatible)
- `FileQueryOptions` - Options for querying files
- `FolderMetadata` - Folder customization data
- `NavigationResult` - Result of navigation operations
- `SelectionState` - Current selection state
- `TagMetadata` - Tag customization data
- `VersionNegotiation` - Result of version compatibility check
- `ViewState` - Current view state

## Error Handling

The API uses standardized error codes for consistent error handling:

```typescript
import { APIError, APIErrorCode } from 'notebook-navigator/api';

try {
  await nn.fileSystem.deleteFile('non-existent.md');
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
if (nn.hasFeature('fileSystem.deleteFiles')) {
  // Feature is available
  await nn.fileSystem.deleteFiles(['file1.md', 'file2.md']);
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
  console.log('Migration suggestions:', negotiation.migrationSuggestions);
}
```
