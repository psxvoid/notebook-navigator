# Notebook Navigator API Reference

The Notebook Navigator plugin exposes a public API that allows other plugins and scripts to interact with its features
programmatically.

**Current Version:** 1.0.1

## Table of Contents

- [Quick Start](#quick-start)
- [API Overview](#api-overview)
- [Metadata API](#metadata-api)
  - [Folder and Tag Metadata](#folder-and-tag-metadata)
  - [Pinned Files](#pinned-files)
- [Navigation API](#navigation-api)
- [Selection API](#selection-api)
- [Events](#events)
- [Core API Methods](#core-api-methods)
- [TypeScript Support](#typescript-support)

## Quick Start

### Accessing the API

The Notebook Navigator API is available at runtime through the Obsidian app object. Here's a practical example using
Templater:

```javascript
<%* // Templater script to pin the current file in Notebook Navigator
const nn = app.plugins.plugins['notebook-navigator']?.api;

if (nn) {
  // Pin the current file in both folder and tag contexts
  const file = tp.config.target_file;
  await nn.metadata.pin(file);
  new Notice('File pinned in Notebook Navigator');
}
%>
```

Or set a folder color based on the current date:

```javascript
<%* // Set folder color based on day of week
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  const folder = tp.config.target_file.parent;
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
  const dayColor = colors[new Date().getDay()];

  await nn.metadata.setFolderMeta(folder, { color: dayColor });
}
%>
```

## API Overview

The API provides three main namespaces:

- **`metadata`** - Folder/tag colors, icons, and pinned files
- **`navigation`** - Navigate to files in the navigator
- **`selection`** - Query current selection state

Core methods:

- **`getVersion()`** - Get the API version string
- **`isStorageReady()`** - Check if storage is ready for metadata operations

## Metadata API

Customize folder and tag appearance, manage pinned files.

### Runtime Behavior

- **Icon format**: While TypeScript provides compile-time checking via `IconString` type, the API currently accepts any
  string at runtime. Invalid formats are saved but may not render correctly.
- **Color values**: Any string is accepted and saved. Invalid CSS colors will not render correctly but won't throw
  errors.
- **Tag normalization**: The `getTagMeta()` and `setTagMeta()` methods automatically normalize tags:
  - Both `'work'` and `'#work'` are accepted as input
  - Tags are case-insensitive: `'#Work'` and `'#work'` refer to the same tag
  - Tags are stored internally without the '#' prefix as lowercase paths

### Folder and Tag Metadata

| Method                        | Description                          | Returns                  |
| ----------------------------- | ------------------------------------ | ------------------------ |
| `getFolderMeta(folder)`       | Get all folder metadata              | `FolderMetadata \| null` |
| `setFolderMeta(folder, meta)` | Set folder metadata (partial update) | `Promise<void>`          |
| `getTagMeta(tag)`             | Get all tag metadata                 | `TagMetadata \| null`    |
| `setTagMeta(tag, meta)`       | Set tag metadata (partial update)    | `Promise<void>`          |

#### Property Update Behavior

When using `setFolderMeta` or `setTagMeta`, partial updates follow this pattern:

- **`color: 'red'`** - Sets the color to red
- **`color: null`** - Clears the color (removes the property)
- **`color: undefined`** or property not present - Leaves the color unchanged

This applies to all metadata properties (color, backgroundColor, icon). Only properties explicitly included in the
update object are modified.

### Pinned Files

Notes can be pinned in different contexts - they appear at the top of the file list when viewing folders or tags.

#### Pin Methods

| Method                     | Description                                         | Returns            |
| -------------------------- | --------------------------------------------------- | ------------------ |
| `pin(file, context?)`      | Pin a file (defaults to 'all' - both contexts)      | `Promise<void>`    |
| `unpin(file, context?)`    | Unpin a file (defaults to 'all' - both contexts)    | `Promise<void>`    |
| `isPinned(file, context?)` | Check if pinned (no context = any, 'all' = both)    | `boolean`          |
| `getPinned()`              | Get all pinned files with their context information | `Readonly<Pinned>` |

#### Understanding Pin Contexts

Pinned notes behave differently depending on the current view:

- **Folder Context**: When viewing folders in the navigator, only notes pinned in the 'folder' context appear at the top
- **Tag Context**: When viewing tags, only notes pinned in the 'tag' context appear at the top
- **Both Contexts**: A note can be pinned in both contexts and will appear at the top in both views
- **Default Behavior**: Pin/unpin operations default to 'all' (both contexts)

This allows users to have different sets of pinned notes for different workflows - for example, pinning project-related
notes when browsing folders, and reference notes when browsing by tags.

```typescript
// Set folder appearance
const folder = app.vault.getFolderByPath('Projects');
if (folder) {
  await nn.metadata.setFolderMeta(folder, {
    color: '#FF5733', // Hex, or 'red', 'rgb(255, 87, 51)', 'hsl(9, 100%, 60%)'
    backgroundColor: '#FFF3E0', // Light background color
    icon: 'lucide:folder-open' // Type-safe with IconString
  });

  // Update only specific properties (other properties unchanged)
  await nn.metadata.setFolderMeta(folder, { color: 'blue' });

  // Clear properties by passing null
  await nn.metadata.setFolderMeta(folder, { icon: null, backgroundColor: null });
}

// Pin a file
const file = app.workspace.getActiveFile();
if (file) {
  await nn.metadata.pin(file); // Pins in both folder and tag contexts by default

  // Or pin in specific context
  await nn.metadata.pin(file, 'folder');
}

// Check if pinned
if (nn.metadata.isPinned(file, 'folder')) {
  console.log('Pinned in folder context');
}

// Get all pinned files with context info
const pinned = nn.metadata.getPinned();
// Returns: Map<string, { folder: boolean, tag: boolean }>
// Example: Map { "Notes/todo.md" => { folder: true, tag: false }, ... }

// Iterate over pinned files
for (const [path, context] of pinned) {
  if (context.folder) {
    console.log(`${path} is pinned in folder view`);
  }
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
- **If the file doesn't exist**, the method returns silently without error

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

| Event                  | Payload                                         | Description                  |
| ---------------------- | ----------------------------------------------- | ---------------------------- |
| `storage-ready`        | `void`                                          | Storage system is ready      |
| `nav-item-changed`     | `{ item: NavItem }`                             | Navigation selection changed |
| `selection-changed`    | `{ state: SelectionState }`                     | Selection changed            |
| `pinned-files-changed` | `{ files: Readonly<Pinned> }`                   | Pinned files changed         |
| `folder-changed`       | `{ folder: TFolder, metadata: FolderMetadata }` | Folder metadata changed      |
| `tag-changed`          | `{ tag: string, metadata: TagMetadata }`        | Tag metadata changed         |

```typescript
// Subscribe to pin changes
nn.on('pinned-files-changed', ({ files }) => {
  console.log(`Total pinned files: ${files.length}`);
  // Each file includes context information
  files.forEach(pf => {
    console.log(`${pf.file.name} - folder: ${pf.context.folder}, tag: ${pf.context.tag}`);
  });
});

// Use 'once' for one-time events (auto-unsubscribes)
nn.once('storage-ready', () => {
  // Wait for storage to be ready before querying metadata or pinned files
  console.log('Storage is ready - safe to call read APIs');
  // No need to unsubscribe, it's handled automatically
});

// Use 'on' for persistent listeners
const navRef = nn.on('nav-item-changed', ({ item }) => {
  if (item.folder) {
    console.log('Folder selected:', item.folder.path);
  } else if (item.tag) {
    console.log('Tag selected:', item.tag);
  } else {
    console.log('Navigation selection cleared');
  }
});

const selectionRef = nn.on('selection-changed', ({ state }) => {
  // TypeScript knows 'state' is SelectionState with files and focused properties
  console.log(`${state.files.length} files selected`);
});

// Unsubscribe from persistent listeners
nn.off(navRef);
nn.off(selectionRef);
```

## Core API Methods

| Method                                                                                                       | Description                                      | Returns    |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------- |
| `getVersion()`                                                                                               | Get API version                                  | `string`   |
| `on<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void)`   | Subscribe to typed event                         | `EventRef` |
| `once<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void)` | Subscribe once (auto-unsubscribes after trigger) | `EventRef` |
| `off(ref)`                                                                                                   | Unsubscribe from event                           | `void`     |

## TypeScript Support

Since Obsidian plugins don't export types like npm packages, you have two options:

### Option 1: With Type Definitions (Recommended)

Download the TypeScript definitions file for full type safety and IntelliSense:

**[📄 notebook-navigator.d.ts](https://github.com/johansanneblad/notebook-navigator/blob/main/src/api/public/notebook-navigator.d.ts)**

Save it to your plugin project and import:

```typescript
import type { NotebookNavigatorAPI, NotebookNavigatorEvents, NavItem, IconString } from './notebook-navigator';

const nn = app.plugins.plugins['notebook-navigator']?.api as NotebookNavigatorAPI;
if (nn) {
  // Wait for storage if needed, then proceed
  if (!nn.isStorageReady()) {
    await new Promise<void>(resolve => nn.once('storage-ready', resolve));
  }

  // Storage is ready, safe to use metadata APIs
  await nn.metadata.setFolderMeta(folder, { color: '#FF5733' });

  // Icon strings are type-checked at compile time
  const icon: IconString = 'lucide:folder'; // Valid
  // const bad: IconString = 'invalid:icon'; // TypeScript error
  await nn.metadata.setFolderMeta(folder, { icon });

  // Events have full type inference
  nn.on('selection-changed', ({ state }) => {
    // TypeScript knows: state is SelectionState with files and focused properties
  });
}
```

### Option 2: Without Type Definitions

```javascript
// Works fine without types in JavaScript/TypeScript
const nn = app.plugins.plugins['notebook-navigator']?.api;
if (nn) {
  // Wait for storage if needed, then proceed
  if (!nn.isStorageReady()) {
    await new Promise(resolve => nn.once('storage-ready', resolve));
  }

  // Storage is ready, safe to use metadata APIs
  await nn.metadata.setFolderMeta(folder, { color: '#FF5733' });
}
```

### Type Safety Features

The type definitions provide:

- **Template literal types** for icons - `IconString` ensures only valid icon formats at compile time
- **Generic event subscriptions** - Full type inference for event payloads
- **Readonly arrays** - Prevents accidental mutation of returned data at compile time
- **Exported utility types** - `NavItem`, `IconString`, `PinContext`, `PinnedFile`, etc.
- **Complete API interface** - `NotebookNavigatorAPI` with all methods and properties
- **Typed event system** - `NotebookNavigatorEvents` maps event names to payloads
- **Full JSDoc comments** - Documentation for every method and type

**Note**: These type checks are compile-time only. At runtime, the API is permissive and accepts any values (see Runtime
Behavior sections for each API).

## Changelog

### Version 1.0.1 (2025-09-16)

- Added `backgroundColor` property to `FolderMetadata` and `TagMetadata` interfaces

### Version 1.0.0 (2025-09-15)

- Initial public API release
