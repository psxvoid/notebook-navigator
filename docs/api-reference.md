# Notebook Navigator API Reference

The Notebook Navigator plugin exposes a public API that allows other plugins and
scripts to interact with its features programmatically.

**Current Version:** 1.0.0

## Quick Start

```typescript
// Get the API
const nn = app.plugins.plugins['notebook-navigator']?.api;

// Check if available
if (!nn) {
  console.error('Notebook Navigator plugin is not installed or enabled');
  return;
}

// TypeScript users: import types for better code completion
import type { NotebookNavigatorAPI } from 'notebook-navigator/api';
const api = app.plugins.plugins['notebook-navigator']
  ?.api as NotebookNavigatorAPI;
```

## API Overview

The API provides four main namespaces:

- **`file`** - Smart file operations with selection management
- **`metadata`** - Folder/tag colors, icons, and pinned files
- **`navigation`** - Navigate to files in the navigator
- **`selection`** - Query current selection state

## File API

Smart file operations that maintain proper selection in the navigator.

| Method                  | Description                       | Returns               |
| ----------------------- | --------------------------------- | --------------------- |
| `delete(files)`         | Delete files with smart selection | `Promise<void>`       |
| `moveTo(files, folder)` | Move files to another folder      | `Promise<MoveResult>` |

```typescript
// Delete files
const file = app.vault.getFileByPath('notes/old.md');
await nn.file.delete(file);

// Move files
const targetFolder = app.vault.getAbstractFileByPath('Archive');
if (targetFolder instanceof TFolder) {
  const result = await nn.file.moveTo([file1, file2], targetFolder);
  // result: { movedCount: number, errors: Array<{file, error}> }
}
```

## Metadata API

Customize folder and tag appearance, manage pinned files.

### Folder Metadata

| Method                          | Description         | Returns                  |
| ------------------------------- | ------------------- | ------------------------ |
| `getFolderMetadata(folder)`     | Get folder metadata | `FolderMetadata \| null` |
| `setFolderColor(folder, color)` | Set folder color    | `Promise<void>`          |
| `clearFolderColor(folder)`      | Clear folder color  | `Promise<void>`          |
| `setFolderIcon(folder, icon)`   | Set folder icon     | `Promise<void>`          |
| `clearFolderIcon(folder)`       | Clear folder icon   | `Promise<void>`          |

### Tag Metadata

| Method                    | Description      | Returns               |
| ------------------------- | ---------------- | --------------------- |
| `getTagMetadata(tag)`     | Get tag metadata | `TagMetadata \| null` |
| `setTagColor(tag, color)` | Set tag color    | `Promise<void>`       |
| `clearTagColor(tag)`      | Clear tag color  | `Promise<void>`       |
| `setTagIcon(tag, icon)`   | Set tag icon     | `Promise<void>`       |
| `clearTagIcon(tag)`       | Clear tag icon   | `Promise<void>`       |

### Pinned Files

| Method              | Description             | Returns         |
| ------------------- | ----------------------- | --------------- |
| `listPinnedFiles()` | Get all pinned files    | `TFile[]`       |
| `isPinned(file)`    | Check if file is pinned | `boolean`       |
| `pin(file)`         | Pin a file              | `Promise<void>` |
| `unpin(file)`       | Unpin a file            | `Promise<void>` |
| `togglePin(file)`   | Toggle pin status       | `Promise<void>` |

```typescript
// Set folder appearance
const folder = app.vault.getAbstractFileByPath('Projects');
if (folder instanceof TFolder) {
  await nn.metadata.setFolderColor(folder, '#FF5733');
  await nn.metadata.setFolderIcon(folder, 'lucide:folder-open');
}

// Manage pins
const file = app.workspace.getActiveFile();
if (file && !nn.metadata.isPinned(file)) {
  await nn.metadata.pin(file);
}
```

## Navigation API

| Method                 | Description                         | Returns         |
| ---------------------- | ----------------------------------- | --------------- |
| `navigateToFile(file)` | Reveal and select file in navigator | `Promise<void>` |

```typescript
// Navigate to active file
const activeFile = app.workspace.getActiveFile();
if (activeFile) {
  await nn.navigation.navigateToFile(activeFile);
}
```

## Selection API

Query the current selection state in the navigator.

| Method                        | Description                  | Returns                                            |
| ----------------------------- | ---------------------------- | -------------------------------------------------- |
| `getSelectedNavigationItem()` | Get selected folder or tag   | `{ folder: TFolder \| null, tag: TagRef \| null }` |
| `listSelectedFiles()`         | Get selected files           | `TFile[]`                                          |
| `getFocusedFile()`            | Get focused file             | `TFile \| null`                                    |
| `getSelectionState()`         | Get complete selection state | `SelectionState`                                   |

```typescript
// Check what's selected
const navItem = nn.selection.getSelectedNavigationItem();
if (navItem.folder) {
  console.log('Folder selected:', navItem.folder.path);
} else if (navItem.tag) {
  console.log('Tag selected:', navItem.tag);
}

// Get selected files
const selectedFiles = nn.selection.listSelectedFiles();
const focusedFile = nn.selection.getFocusedFile();
```

## Events

Subscribe to navigator events to react to user actions.

| Event                     | Payload                                            | Description             |
| ------------------------- | -------------------------------------------------- | ----------------------- |
| `storage-ready`           | `void`                                             | Storage system is ready |
| `folder-selected`         | `{ folder: TFolder }`                              | Folder selected         |
| `tag-selected`            | `{ tag: TagRef }`                                  | Tag selected            |
| `file-selection-changed`  | `{ files: TFile[], focused: TFile \| null }`       | Selection changed       |
| `pinned-files-changed`    | `{ files: TFile[] }`                               | Pinned files changed    |
| `folder-metadata-changed` | `{ folder: TFolder, property: 'color' \| 'icon' }` | Folder metadata changed |
| `tag-metadata-changed`    | `{ tag: TagRef, property: 'color' \| 'icon' }`     | Tag metadata changed    |

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

| Method                      | Description                 | Returns              |
| --------------------------- | --------------------------- | -------------------- |
| `getVersion()`              | Get API version             | `string`             |
| `negotiateVersion(version)` | Check version compatibility | `VersionNegotiation` |
| `hasFeature(feature)`       | Check if feature exists     | `boolean`            |
| `listFeatures()`            | List all features           | `string[]`           |
| `on(event, callback)`       | Subscribe to event          | `EventRef`           |
| `off(ref)`                  | Unsubscribe from event      | `void`               |

## Types

```typescript
// Core types
type TagRef = `#${string}`;

interface FolderMetadata {
  color?: string; // Any valid CSS color
  icon?: string; // 'lucide:folder' or 'emoji:📁'
}

interface TagMetadata {
  color?: string;
  icon?: string;
  isFavorite?: boolean;
}

interface MoveResult {
  movedCount: number;
  errors: Array<{ file: TFile; error: string }>;
}

interface SelectionState {
  files: TFile[];
  focused: TFile | null;
}

type CompatibilityLevel = 'full' | 'partial' | 'limited' | 'incompatible';

interface VersionNegotiation {
  apiVersion: string;
  compatibility: CompatibilityLevel;
  availableFeatures: string[];
  deprecatedFeatures: string[];
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
}
```

### Apply theme colors to folders

```typescript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const folders = [
    { path: 'Work', color: '#FF5733' },
    { path: 'Personal', color: '#33FF57' }
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
  const selectedFiles = nn.selection.listSelectedFiles();

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
  await nn.file.moveTo(files, projects);
}
```

## API Design Notes

- **Uses Obsidian types** - All methods use `TFile` and `TFolder` objects, not
  string paths
- **Async operations** - Methods that modify state return `Promise` as they
  persist to settings
- **Smart selection** - File operations automatically manage selection in the
  navigator
- **CSS colors** - Colors accept any valid CSS string (hex, rgb, named colors)
- **Icon format** - Icons use `lucide:<name>` or `emoji:<unicode>` format
- **Error handling** - Methods throw standard `Error` on failure

## Version Compatibility

The API uses semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backwards compatible)
- **PATCH** - Bug fixes

```typescript
// Check compatibility
const negotiation = nn.negotiateVersion('1.0.0');
if (negotiation.compatibility === 'incompatible') {
  console.error('API version incompatible');
  return;
}

// Check for specific features
if (nn.hasFeature('file.delete')) {
  // Feature is available
}
```
