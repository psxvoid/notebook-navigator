# Notebook Navigator API Reference

The Notebook Navigator plugin exposes a public API that allows other plugins and
scripts to interact with its features programmatically.

**Current Version:** 1.0.0

## Quick Start

### Accessing the API

The Notebook Navigator API is available at runtime through the Obsidian app
object:

```javascript
// Get the API instance
const nn = app.plugins.plugins['notebook-navigator']?.api;

// Check if available
if (!nn) {
  console.error('Notebook Navigator plugin is not installed or enabled');
  return;
}

// Use the API
await nn.file.delete([file]);
```

## API Overview

The API provides four main namespaces:

- **`file`** - Smart file operations with selection management
- **`metadata`** - Folder/tag colors, icons, and pinned files
- **`navigation`** - Navigate to files in the navigator
- **`selection`** - Query current selection state

## File API

Smart file operations that maintain proper selection in the navigator.

| Method                     | Description                                                | Returns               |
| -------------------------- | ---------------------------------------------------------- | --------------------- |
| `deleteFiles(files)`       | Move files to Obsidian trash (respects app trash settings) | `Promise<void>`       |
| `moveFiles(files, folder)` | Move files to folder                                       | `Promise<MoveResult>` |

```typescript
// Delete files (throws on failure)
const file = app.vault.getFileByPath('notes/old.md');
await nn.file.deleteFiles([file]);

// Move files (throws on failure, returns counts on success)
const targetFolder = app.vault.getAbstractFileByPath('Archive');
if (targetFolder instanceof TFolder) {
  const result = await nn.file.moveFiles([file1, file2], targetFolder);
  // result: { movedCount: 2, skippedCount: 0 }
  // Files with name collisions are skipped without overwrite; see skippedCount
}
```

## Metadata API

Customize folder and tag appearance, manage pinned files.

### Runtime Behavior

- **Icon format**: While TypeScript provides compile-time checking via
  `IconString` type, the API currently accepts any string at runtime. Invalid
  formats are saved but may not render correctly.
- **Color values**: Any string is accepted and saved. Invalid CSS colors will
  not render correctly but won't throw errors.
- **Tag normalization**: The `getTagMeta()` and tag setter methods automatically
  normalize tags:
  - Both `'work'` and `'#work'` are accepted and treated as `'#work'`
  - Tags are case-insensitive: `'#Work'` and `'#work'` refer to the same tag
  - The plugin preserves the canonical case (first encountered form) for display
    but all comparisons use lowercase

### Folder Metadata

| Method                        | Description                                       | Returns                  |
| ----------------------------- | ------------------------------------------------- | ------------------------ |
| `getFolderMeta(folder)`       | Get all folder metadata                           | `FolderMetadata \| null` |
| `setFolderMeta(folder, meta)` | Set folder metadata (partial update, null clears) | `Promise<void>`          |

### Tag Metadata

Tag parameters accept strings with or without the leading `#` (both `'work'` and
`'#work'` are valid).

| Method                  | Description                                    | Returns               |
| ----------------------- | ---------------------------------------------- | --------------------- |
| `getTagMeta(tag)`       | Get all tag metadata                           | `TagMetadata \| null` |
| `setTagMeta(tag, meta)` | Set tag metadata (partial update, null clears) | `Promise<void>`       |

### Pinned Files

| Method            | Description             | Returns            |
| ----------------- | ----------------------- | ------------------ |
| `getPinned()`     | Get all pinned files    | `readonly TFile[]` |
| `isPinned(file)`  | Check if file is pinned | `boolean`          |
| `pin(file)`       | Pin a file              | `Promise<void>`    |
| `unpin(file)`     | Unpin a file            | `Promise<void>`    |
| `togglePin(file)` | Toggle pin status       | `Promise<void>`    |

```typescript
// Set folder appearance with a single call
const folder = app.vault.getAbstractFileByPath('Projects');
if (folder instanceof TFolder) {
  // Set multiple properties at once
  await nn.metadata.setFolderMeta(folder, {
    color: '#FF5733', // Hex, or 'red', 'rgb(255, 87, 51)', 'hsl(9, 100%, 60%)'
    icon: 'lucide:folder-open' // Type-safe with IconString
  });

  // Update only specific properties
  await nn.metadata.setFolderMeta(folder, { color: 'blue' });

  // Clear properties by passing null
  await nn.metadata.setFolderMeta(folder, { icon: null });
}

// Manage pins
const file = app.workspace.getActiveFile();
if (file && !nn.metadata.isPinned(file)) {
  await nn.metadata.pin(file);
}
```

## Navigation API

| Method         | Description                         | Returns         |
| -------------- | ----------------------------------- | --------------- |
| `reveal(file)` | Reveal and select file in navigator | `Promise<void>` |

### Reveal Behavior

When calling `reveal(file)`:

- **Switches to the file's parent folder** in the navigation pane
- **Expands parent folders** as needed to make the folder visible
- **Selects and focuses the file** in the file list
- **Switches to file list view** if in single-pane mode
- **If the file doesn't exist or has no parent folder**, the method returns
  silently without error

```typescript
// Navigate to active file
const activeFile = app.workspace.getActiveFile();
if (activeFile) {
  await nn.navigation.reveal(activeFile);
  // File is now selected in its parent folder
}
```

## Selection API

Query the current selection state in the navigator.

| Method         | Description                  | Returns          |
| -------------- | ---------------------------- | ---------------- |
| `getNavItem()` | Get selected folder or tag   | `NavItem`        |
| `getCurrent()` | Get complete selection state | `SelectionState` |

```typescript
// Check what's selected
const navItem = nn.selection.getNavItem();
if (navItem.folder) {
  console.log('Folder selected:', navItem.folder.path);
} else if (navItem.tag) {
  console.log('Tag selected:', navItem.tag);
} else {
  console.log('Nothing selected in navigation pane');
}

// Get selected files
const { files, focused } = nn.selection.getCurrent();
```

## Events

Subscribe to navigator events to react to user actions.

| Event                     | Payload                                               | Description                  |
| ------------------------- | ----------------------------------------------------- | ---------------------------- |
| `storage-ready`           | `void`                                                | Storage system is ready      |
| `nav-item-changed`        | `{ item: NavItem }`                                   | Navigation selection changed |
| `file-selection-changed`  | `{ files: readonly TFile[], focused: TFile \| null }` | File selection changed       |
| `pinned-files-changed`    | `{ files: readonly TFile[] }`                         | Pinned files changed         |
| `folder-metadata-changed` | `{ folder: TFolder, property: 'color' \| 'icon' }`    | Folder metadata changed      |
| `tag-metadata-changed`    | `{ tag: string, property: 'color' \| 'icon' }`        | Tag metadata changed         |

```typescript
// Subscribe to events with full type safety

// storage-ready has void payload, so callback has no parameters
const storageRef = nn.on('storage-ready', () => {
  console.log('Storage is ready - safe to call read APIs');
});

// nav-item-changed provides the complete navigation state
const navRef = nn.on('nav-item-changed', ({ item }) => {
  if (item.folder) {
    console.log('Folder selected:', item.folder.path);
  } else if (item.tag) {
    console.log('Tag selected:', item.tag);
  } else {
    console.log('Navigation selection cleared');
  }
});

const selectionRef = nn.on('file-selection-changed', ({ files, focused }) => {
  // TypeScript knows 'files' is readonly TFile[] and 'focused' is TFile | null
  console.log(`${files.length} files selected`);
});

// Unsubscribe
nn.off(storageRef);
nn.off(navRef);
nn.off(selectionRef);
```

## Core API Methods

| Method                                                                                                     | Description              | Returns    |
| ---------------------------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| `getVersion()`                                                                                             | Get API version          | `string`   |
| `on<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void)` | Subscribe to typed event | `EventRef` |
| `off(ref)`                                                                                                 | Unsubscribe from event   | `void`     |

## TypeScript Support

Since Obsidian plugins don't export types like npm packages, you have two
options:

### Option 1: With Type Definitions (Recommended)

Download the TypeScript definitions file for full type safety and IntelliSense:

**[📄 notebook-navigator.d.ts](https://github.com/johansanneblad/notebook-navigator/blob/main/src/api/public/notebook-navigator.d.ts)**

Save it to your plugin project and import:

```typescript
import type {
  NotebookNavigatorAPI,
  NotebookNavigatorEvents,
  NavItem,
  IconString
} from './notebook-navigator';

const nn = app.plugins.plugins['notebook-navigator']
  ?.api as NotebookNavigatorAPI;
if (nn) {
  // Full type safety and autocomplete
  await nn.metadata.setFolderColor(folder, '#FF5733');

  // Icon strings are type-checked at compile time
  const icon: IconString = 'lucide:folder'; // ✅ Valid
  // const bad: IconString = 'invalid:icon'; // ❌ TypeScript error
  await nn.metadata.setFolderIcon(folder, icon);

  // Events have full type inference
  nn.on('file-selection-changed', ({ files, focused }) => {
    // TypeScript knows: files is readonly TFile[], focused is TFile | null
  });
}
```

### Option 2: Without Type Definitions

```javascript
// Works fine without types in JavaScript/TypeScript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  await nn.metadata.setFolderColor(folder, '#FF5733');
}
```

### Type Safety Features

The type definitions provide:

- **Template literal types** for icons - `IconString` ensures only valid icon
  formats at compile time
- **Generic event subscriptions** - Full type inference for event payloads
- **Readonly arrays** - Prevents accidental mutation of returned data at compile
  time
- **Exported utility types** - `NavItem`, `IconString`, etc. for reuse in your
  code
- **Complete API interface** - `NotebookNavigatorAPI` with all methods and
  properties
- **Typed event system** - `NotebookNavigatorEvents` maps event names to
  payloads
- **Full JSDoc comments** - Documentation for every method and type

**Note**: These type checks are compile-time only. At runtime, the API is
permissive and accepts any values (see Runtime Behavior sections for each API).

## Examples

### Pin files with specific tag

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const taggedFiles = app.vault.getMarkdownFiles().filter(file => {
    const cache = app.metadataCache.getFileCache(file);
    return cache?.tags?.some(t => t.tag === '#important');
  });

  for (const file of taggedFiles) {
    if (!nn.metadata.isPinned(file)) {
      await nn.metadata.pin(file);
    }
  }

  // Check all pinned files
  const pinnedFiles = nn.metadata.getPinned();
  console.log(`${pinnedFiles.length} files are pinned`);
}
```

### Apply theme colors to folders

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Set colors and icons for multiple folders
  const folders = [
    { path: 'Work', meta: { color: '#FF5733', icon: 'lucide:briefcase' } },
    {
      path: 'Personal',
      meta: { color: 'rgb(51, 255, 87)', icon: 'lucide:home' }
    },
    { path: 'Archive', meta: { color: 'gray', icon: 'lucide:archive' } },
    {
      path: 'Projects',
      meta: { color: 'hsl(200, 100%, 50%)', icon: 'lucide:folder-git-2' }
    }
  ];

  for (const { path, meta } of folders) {
    const folder = app.vault.getAbstractFileByPath(path);
    if (folder instanceof TFolder) {
      await nn.metadata.setFolderMeta(folder, meta);
    }
  }
}
```

### Process selected files

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const { files: selectedFiles } = nn.selection.getCurrent();

  for (const file of selectedFiles) {
    await app.fileManager.processFrontMatter(file, fm => {
      if (!fm.tags) fm.tags = [];
      if (!fm.tags.includes('processed')) {
        fm.tags.push('processed');
      }
    });
  }
}
```

### Bulk operations

```typescript
// Delete old files
const archiveFolder = app.vault.getAbstractFileByPath('Archive');
if (archiveFolder instanceof TFolder) {
  const oldFiles = archiveFolder.children
    .filter((f): f is TFile => f instanceof TFile)
    .filter(f => f.stat.mtime < Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (oldFiles.length > 0) {
    await nn.file.deleteFiles(oldFiles);
  }
}

// Move files between folders
const inbox = app.vault.getAbstractFileByPath('Inbox');
const projects = app.vault.getAbstractFileByPath('Projects');
if (inbox instanceof TFolder && projects instanceof TFolder) {
  const files = inbox.children.filter(f => f instanceof TFile);
  try {
    const result = await nn.file.moveFiles(files, projects);
    console.log(
      `Moved ${result.movedCount} files, skipped ${result.skippedCount}`
    );
  } catch (error) {
    console.error('Move failed:', error.message);
  }
}
```

## API Design Notes

- **Uses Obsidian types** - All methods use `TFile` and `TFolder` objects, not
  string paths
- **Async operations** - Methods that modify state return `Promise` as they
  persist to settings
- **CSS colors** - Colors accept any valid CSS format (hex, rgb, hsl, named
  colors)
- **Icon format** - Icons use `IconString` type (`lucide:<name>` or
  `emoji:<unicode>`), validated at compile time
- **Type-safe events** - Generic `on()` method provides full type inference for
  event payloads
- **Immutable returns** - Arrays returned from API are `readonly` to prevent
  mutations
- **Error handling** - Methods throw standard `Error` on failure
