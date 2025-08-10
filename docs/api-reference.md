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

### TypeScript Support

Since Obsidian plugins don't export types like npm packages, you have two
options:

**Option 1: Download the type definitions** (Recommended)

Download the TypeScript definitions file:

- [📄 notebook-navigator.d.ts](https://github.com/johansanneblad/notebook-navigator/blob/main/src/api/public/notebook-navigator.d.ts)

Save it to your plugin project and import:

```typescript
// In your plugin code
import type { NotebookNavigatorAPI } from './notebook-navigator';

const nn = app.plugins.plugins['notebook-navigator']
  ?.api as NotebookNavigatorAPI;
```

**Option 2: Use without types**

```javascript
// Works fine without types in JavaScript/TypeScript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  await nn.metadata.setFolderColor(folder, '#FF5733');
}
```

## API Overview

The API provides four main namespaces:

- **`file`** - Smart file operations with selection management
- **`metadata`** - Folder/tag colors, icons, and pinned files
- **`navigation`** - Navigate to files in the navigator
- **`selection`** - Query current selection state

## File API

Smart file operations that maintain proper selection in the navigator.

| Method                | Description          | Returns               |
| --------------------- | -------------------- | --------------------- |
| `delete(files)`       | Delete files         | `Promise<void>`       |
| `move(files, folder)` | Move files to folder | `Promise<MoveResult>` |

```typescript
// Delete files (throws on failure)
const file = app.vault.getFileByPath('notes/old.md');
await nn.file.delete([file]);

// Move files (throws on failure, returns counts on success)
const targetFolder = app.vault.getAbstractFileByPath('Archive');
if (targetFolder instanceof TFolder) {
  const result = await nn.file.move([file1, file2], targetFolder);
  // result: { movedCount: 2, skippedCount: 0 }
  // skippedCount > 0 means files already existed at destination
}
```

## Metadata API

Customize folder and tag appearance, manage pinned files.

### Folder Metadata

| Method                          | Description         | Returns                  |
| ------------------------------- | ------------------- | ------------------------ |
| `getFolderMeta(folder)`         | Get folder metadata | `FolderMetadata \| null` |
| `setFolderColor(folder, color)` | Set folder color    | `Promise<void>`          |
| `clearFolderColor(folder)`      | Clear folder color  | `Promise<void>`          |
| `setFolderIcon(folder, icon)`   | Set folder icon     | `Promise<void>`          |
| `clearFolderIcon(folder)`       | Clear folder icon   | `Promise<void>`          |

### Tag Metadata

Tag parameters accept strings with or without the leading `#` (both `'work'` and
`'#work'` are valid).

| Method                    | Description      | Returns               |
| ------------------------- | ---------------- | --------------------- |
| `getTagMeta(tag)`         | Get tag metadata | `TagMetadata \| null` |
| `setTagColor(tag, color)` | Set tag color    | `Promise<void>`       |
| `clearTagColor(tag)`      | Clear tag color  | `Promise<void>`       |
| `setTagIcon(tag, icon)`   | Set tag icon     | `Promise<void>`       |
| `clearTagIcon(tag)`       | Clear tag icon   | `Promise<void>`       |

### Pinned Files

| Method            | Description             | Returns         |
| ----------------- | ----------------------- | --------------- |
| `getPinned()`     | Get all pinned files    | `TFile[]`       |
| `isPinned(file)`  | Check if file is pinned | `boolean`       |
| `pin(file)`       | Pin a file              | `Promise<void>` |
| `unpin(file)`     | Unpin a file            | `Promise<void>` |
| `togglePin(file)` | Toggle pin status       | `Promise<void>` |

```typescript
// Set folder appearance - colors accept any CSS format
const folder = app.vault.getAbstractFileByPath('Projects');
if (folder instanceof TFolder) {
  await nn.metadata.setFolderColor(folder, '#FF5733'); // Hex
  // Also works: 'red', 'rgb(255, 87, 51)', 'hsl(9, 100%, 60%)'
  await nn.metadata.setFolderIcon(folder, 'lucide:folder-open');
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

```typescript
// Navigate to active file
const activeFile = app.workspace.getActiveFile();
if (activeFile) {
  await nn.navigation.reveal(activeFile);
}
```

## Selection API

Query the current selection state in the navigator.

| Method         | Description                  | Returns                                            |
| -------------- | ---------------------------- | -------------------------------------------------- |
| `getNavItem()` | Get selected folder or tag   | `{ folder: TFolder \| null, tag: string \| null }` |
| `getCurrent()` | Get complete selection state | `SelectionState`                                   |

```typescript
// Check what's selected
const navItem = nn.selection.getNavItem();
if (navItem.folder) {
  console.log('Folder selected:', navItem.folder.path);
} else if (navItem.tag) {
  console.log('Tag selected:', navItem.tag);
}

// Get selected files
const { files, focused } = nn.selection.getCurrent();
```

## Events

Subscribe to navigator events to react to user actions.

| Event                     | Payload                                            | Description             |
| ------------------------- | -------------------------------------------------- | ----------------------- |
| `storage-ready`           | `void`                                             | Storage system is ready |
| `folder-selected`         | `{ folder: TFolder }`                              | Folder selected         |
| `tag-selected`            | `{ tag: string }`                                  | Tag selected            |
| `file-selection-changed`  | `{ files: TFile[], focused: TFile \| null }`       | Selection changed       |
| `pinned-files-changed`    | `{ files: TFile[] }`                               | Pinned files changed    |
| `folder-metadata-changed` | `{ folder: TFolder, property: 'color' \| 'icon' }` | Folder metadata changed |
| `tag-metadata-changed`    | `{ tag: string, property: 'color' \| 'icon' }`     | Tag metadata changed    |

```typescript
// Subscribe to events
const folderRef = nn.on('folder-selected', ({ folder }) => {
  console.log('Folder selected:', folder.path);
});

const selectionRef = nn.on('file-selection-changed', ({ files, focused }) => {
  console.log(`${files.length} files selected`);
});

// Unsubscribe
nn.off(folderRef);
nn.off(selectionRef);
```

## Core API Methods

| Method                | Description            | Returns    |
| --------------------- | ---------------------- | ---------- |
| `getVersion()`        | Get API version        | `string`   |
| `on(event, callback)` | Subscribe to event     | `EventRef` |
| `off(ref)`            | Unsubscribe from event | `void`     |

## Types

Download the complete type definitions:

- [📄 notebook-navigator.d.ts](https://github.com/johansanneblad/notebook-navigator/blob/main/src/api/public/notebook-navigator.d.ts)

For reference, here's the complete API interface:

```typescript
import { TFile, TFolder, EventRef } from 'obsidian';

// Core types

export interface FolderMetadata {
  color?: string; // Any valid CSS color (hex, rgb, hsl, named colors)
  icon?: string; // 'lucide:folder' or 'emoji:📁'
}

export interface TagMetadata {
  color?: string; // Any valid CSS color (hex, rgb, hsl, named colors)
  icon?: string; // 'lucide:tag' or 'emoji:🏷️'
}

export interface MoveResult {
  movedCount: number;
  skippedCount: number; // Files that already exist at destination
}

export interface SelectionState {
  files: TFile[];
  focused: TFile | null;
}

// Complete API interface
export interface NotebookNavigatorAPI {
  getVersion(): string;

  file: {
    delete(files: TFile[]): Promise<void>;
    move(files: TFile[], folder: TFolder): Promise<MoveResult>;
  };

  metadata: {
    // Folders
    getFolderMeta(folder: TFolder): FolderMetadata | null;
    setFolderColor(folder: TFolder, color: string): Promise<void>;
    clearFolderColor(folder: TFolder): Promise<void>;
    setFolderIcon(folder: TFolder, icon: string): Promise<void>;
    clearFolderIcon(folder: TFolder): Promise<void>;

    // Tags
    getTagMeta(tag: string): TagMetadata | null;
    setTagColor(tag: string, color: string): Promise<void>;
    clearTagColor(tag: string): Promise<void>;
    setTagIcon(tag: string, icon: string): Promise<void>;
    clearTagIcon(tag: string): Promise<void>;

    // Pins
    getPinned(): TFile[];
    isPinned(file: TFile): boolean;
    pin(file: TFile): Promise<void>;
    unpin(file: TFile): Promise<void>;
    togglePin(file: TFile): Promise<void>;
  };

  navigation: {
    reveal(file: TFile): Promise<void>;
  };

  selection: {
    getNavItem(): { folder: TFolder | null; tag: string | null };
    getCurrent(): SelectionState;
  };

  // Events
  on(event: string, callback: (data: unknown) => void): EventRef;
  off(ref: EventRef): void;
}
```

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
  // Colors can be specified in any CSS format
  const folders = [
    { path: 'Work', color: '#FF5733' }, // Hex
    { path: 'Personal', color: 'rgb(51, 255, 87)' }, // RGB
    { path: 'Archive', color: 'gray' }, // Named color
    { path: 'Projects', color: 'hsl(200, 100%, 50%)' } // HSL
  ];

  for (const { path, color } of folders) {
    const folder = app.vault.getAbstractFileByPath(path);
    if (folder instanceof TFolder) {
      await nn.metadata.setFolderColor(folder, color);
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
    await nn.file.delete(oldFiles);
  }
}

// Move files between folders
const inbox = app.vault.getAbstractFileByPath('Inbox');
const projects = app.vault.getAbstractFileByPath('Projects');
if (inbox instanceof TFolder && projects instanceof TFolder) {
  const files = inbox.children.filter(f => f instanceof TFile);
  try {
    const result = await nn.file.move(files, projects);
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
- **Icon format** - Icons use `lucide:<name>` or `emoji:<unicode>` format
- **Error handling** - Methods throw standard `Error` on failure
