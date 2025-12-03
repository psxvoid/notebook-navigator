# Notebook Navigator Storage Architecture

## Table of Contents

- [Overview](#overview)
- [Storage Containers](#storage-containers)
  - [IndexedDB](#1-indexeddb-persistent-local-storage)
  - [Local Storage](#2-local-storage-persistent-local-storage)
  - [Memory Cache](#3-memory-cache-temporary-storage)
  - [Settings](#4-settings-synchronized-storage)
  - [Icon Assets Database](#5-icon-assets-database-device-specific-storage)
- [Data Flow Patterns](#data-flow-patterns)
  - [Initial Load](#initial-load-cold-boot)
  - [File Change](#file-change-during-session)
  - [Settings Change](#settings-change)
  - [UI State Change](#ui-state-change)
- [Hidden Pattern Rules](#hidden-pattern-rules)
- [Storage Selection Guidelines](#storage-selection-guidelines)
- [Performance Considerations](#performance-considerations)
- [Version Management](#version-management)

## Overview

The Notebook Navigator plugin uses five distinct storage containers, each serving a specific purpose in the plugin's
data management strategy. These containers work together to provide fast performance, data persistence, and cross-device
synchronization while maintaining clear separation of concerns. The stack consists of the IndexedDB cache, an in-memory
mirror, vault-scoped localStorage, synchronized settings in `data.json`, and a dedicated icon asset database.

## Storage Containers

### 1. IndexedDB (Persistent Local Storage)

**Purpose**: Stores all file metadata and generated content locally on the device. This is the primary database for
caching vault information to enable fast searches and filtering without repeatedly reading files from disk.

**Location**: Browser's IndexedDB storage (device-specific)

**Synchronization**: Not synchronized - each device maintains its own cache

**Data Stored**:

- File modification times (mtime)
- Extracted tags from Markdown content and frontmatter
- Generated preview text (first ~500 characters)
- Feature image references from frontmatter or embedded image fallback
- Frontmatter metadata overrides (display name, created timestamp, modified timestamp)
- Frontmatter icon and color overrides
- Hidden flag when file matches exclusion patterns

**Key Characteristics**:

- Persists across Obsidian restarts
- Can store large amounts of data (typically gigabytes)
- Asynchronous API requires careful handling
- Cleared when DB_SCHEMA_VERSION or DB_CONTENT_VERSION changes
- Database name: `notebooknavigator/cache/{appId}` (vault-specific)
- Store name: `keyvaluepairs`

**Lifecycle Management**:

- Initialized early in Plugin.onload() via `initializeDatabase(appId)`
- Database connection owned by plugin, not React components
- Shutdown in Plugin.onunload() via `shutdownDatabase()`
- Idempotent operations prevent issues with rapid enable/disable cycles
- StorageContext checks availability but doesn't manage lifecycle

**Implementation**: `src/storage/IndexedDBStorage.ts`

```typescript
export interface FileData {
  mtime: number;
  tags: string[] | null;
  preview: string | null;
  featureImage: string | null;
  metadata: {
    name?: string;
    created?: number;
    modified?: number;
    icon?: string;
    color?: string;
    hidden?: boolean;
  } | null;
}
```

### 2. Local Storage (Persistent Local Storage)

**Purpose**: Stores UI state and preferences that should persist across sessions but remain local to each device. This
allows users to have different UI layouts on desktop vs mobile, for example.

**Location**: Browser's localStorage (device-specific, vault-specific)

**Synchronization**: Not synchronized - each device maintains its own UI state

**Data Stored**:

- Navigation pane width and height
- Dual-pane preference and orientation
- Selected folder, tag, file, and multi-select state
- Expanded folders, tags, and virtual folders
- Navigation section order and collapsed state for shortcuts and recent notes
- UX preferences (search toggle, descendant scope, hidden item visibility, pinned shortcuts)
- Recent note history and recent icon usage
- Database version numbers (for detecting schema changes)
- Local storage schema version marker

**Key Characteristics**:

- Persists across Obsidian restarts
- Limited to ~5-10MB total storage
- Synchronous API for immediate access
- Uses Obsidian's vault-specific storage methods
- Automatically cleaned up when plugin is uninstalled

**Implementation**: `src/utils/localStorage.ts`

```typescript
export const STORAGE_KEYS: LocalStorageKeys = {
  expandedFoldersKey: 'notebook-navigator-expanded-folders',
  expandedTagsKey: 'notebook-navigator-expanded-tags',
  selectedFolderKey: 'notebook-navigator-selected-folder',
  selectedFileKey: 'notebook-navigator-selected-file',
  selectedFilesKey: 'notebook-navigator-selected-files',
  navigationPaneWidthKey: 'notebook-navigator-navigation-pane-width',
  navigationPaneHeightKey: 'notebook-navigator-navigation-pane-height',
  dualPaneKey: 'notebook-navigator-dual-pane',
  dualPaneOrientationKey: 'notebook-navigator-dual-pane-orientation',
  shortcutsExpandedKey: 'notebook-navigator-shortcuts-expanded',
  recentNotesExpandedKey: 'notebook-navigator-recent-notes-expanded',
  uxPreferencesKey: 'notebook-navigator-ux-preferences',
  recentNotesKey: 'notebook-navigator-recent-notes',
  recentIconsKey: 'notebook-navigator-recent-icons',
  databaseSchemaVersionKey: 'notebook-navigator-db-schema-version',
  databaseContentVersionKey: 'notebook-navigator-db-content-version',
  localStorageVersionKey: 'notebook-navigator-localstorage-version',
  vaultProfileKey: 'notebook-navigator-vault-profile'
  // ... additional keys omitted for brevity
};
```

### 3. Memory Cache (Temporary Storage)

**Purpose**: Provides synchronous access to all file data during rendering. This in-memory mirror of IndexedDB
eliminates async operations in React components, preventing layout shifts and enabling smooth scrolling in virtualized
lists.

**Location**: JavaScript heap memory (RAM)

**Synchronization**: Automatically synced with IndexedDB changes

**Data Stored**: Complete mirror of all IndexedDB file data

**Key Characteristics**:

- Cleared when plugin reloads or Obsidian restarts
- Provides instant synchronous access for UI rendering
- Memory usage: ~300 bytes per file (3MB for 10k files, 30MB for 100k files)
- Hydrated from IndexedDB on startup and updated with every database write
- Essential for virtual scrolling performance

**Implementation**: `src/storage/MemoryFileCache.ts`

## Hidden Pattern Rules

Hidden folders and tags share the same pattern handling:

- Name patterns (no `/`) apply to every path segment. `Projects*` hides `Projects`, its descendants, and any folder or
  tag whose name starts with `Projects` (for example `Projects2024`).
- Path patterns start with `/`. `/Projects*` hides `Projects` plus all descendants. `/Projects/*` hides descendants of
  `Projects` but keeps the base visible.
- Mid-segment wildcards match one segment only. `/Projects/*/Archive` hides `Projects/Client/Archive` and deeper
  descendants, but not `Projects/Archive`.
- Trailing `*` never matches an empty segment. `/Projects/*` and `projects/*` require at least one child segment.
- Patterns with multiple wildcards in a single segment or wildcards in the middle of a segment are ignored.

```typescript
export class MemoryFileCache {
  private memoryMap = new Map<string, FileData>();

  getFile(path: string): FileData | null {
    return this.memoryMap.get(path) ?? null;
  }

  updateFile(path: string, data: FileData): void {
    this.memoryMap.set(path, data);
  }
}
```

### 4. Settings (Synchronized Storage)

**Purpose**: Stores user preferences and configuration that should be consistent across all devices. When using Obsidian
Sync, these settings are automatically synchronized.

**Location**: `.obsidian/plugins/notebook-navigator/data.json`

**Synchronization**: Synchronized via Obsidian Sync (if enabled)

**Data Stored**:

- Feature toggles and display preferences (folder visibility, preview rows, grouping, date/time formats, quick actions)
- Frontmatter field mappings and metadata extraction options
- Folder metadata:
  - Colors and background colors (custom palette per folder)
  - Icons (custom icon per folder)
  - Sort overrides (custom sort order per folder)
  - Custom appearance (titleRows, previewRows, showDate, showPreview, showImage)
  - Pinned notes (list of pinned files per folder)
- Tag metadata:
  - Colors and background colors (custom palette per tag)
  - Icons (custom icon per tag)
  - Sort overrides (custom sort order per tag)
  - Custom appearance (titleRows, previewRows, showDate, showPreview, showImage)
- File metadata overrides:
  - Icons (custom icon per file)
  - Colors (custom color per file)
- Shortcut definitions and keyboard shortcut configuration
- External icon provider enablement flags
- Recent color palette, release notice tracking, and sync timestamps
- Root folder order, root tag order, and custom vault name
- Homepage configuration for desktop and mobile

**Key Characteristics**:

- JSON file in the vault
- Synchronized across devices with Obsidian Sync
- Loaded once at startup, cached in memory
- Changes trigger UI re-renders via React context
- Must be kept small to avoid sync conflicts

**Implementation**: `src/settings.ts`

```typescript
interface NotebookNavigatorSettings {
  showFolders: boolean;
  showTags: boolean;

  // Per-folder customization
  folderColors: Record<string, string>;
  folderIcons: Record<string, string>;
  folderSortOverrides: Record<string, SortOption>;
  folderAppearances: Record<string, FolderAppearance>;
  pinnedNotes: Record<string, string[]>;

  // Per-tag customization
  tagColors: Record<string, string>;
  tagIcons: Record<string, string>;
  tagSortOverrides: Record<string, SortOption>;
  tagAppearances: Record<string, TagAppearance>;

  // ... more settings
```

### 5. Icon Assets Database (Device-Specific Storage)

**Purpose**: Stores downloaded icon pack assets locally on each device. This allows users to have extensive icon
libraries without bloating the vault or sync system.

**Location**: Browser's IndexedDB storage (device-specific)

**Synchronization**: Not synchronized - each device downloads its own icon packs

**Data Stored**:

- Icon font binary data (ArrayBuffer)
- Metadata manifests with icon identifiers and keywords
- Font MIME type
- Metadata format indicator (currently JSON)
- Provider version and last updated timestamp

**Key Characteristics**:

- Persists across Obsidian restarts
- Large storage capacity for icon pack assets (5MB-10MB per pack)
- Asynchronous download and storage
- Automatic version management
- Database name: `notebooknavigator/icons/{appId}`
- Records keyed by provider ID (one entry per installed pack)
- Separate from main cache database

**Icon Pack Management**:

- Settings only store which packs are enabled (small metadata)
- Each device checks settings and downloads needed packs
- Packs can be installed/removed independently per device
- Updates handled automatically when new versions available

**Available Icon Packs**:

- **Bootstrap Icons**: 1,800+ icons
- **Font Awesome Solid**: 2,000+ icons
- **Material Icons**: 2,100+ icons
- **Phosphor Icons**: 7,000+ icons
- **RPG Awesome**: 500+ game/fantasy icons
- **Simple Icons**: 2,700+ brand icons

**Implementation**: `src/services/icons/external/IconAssetDatabase.ts`

```typescript
interface IconAssetRecord {
  id: string;
  version: string;
  mimeType: string;
  data: ArrayBuffer;
  metadataFormat: 'json';
  metadata: string;
  updated: number;
}
```

## Data Flow Patterns

### Initial Load (Cold Boot)

1. **Settings** loaded from data.json
2. **IndexedDB** opened, schema/content versions validated, and databases cleared if versions changed
3. Existing **IndexedDB** records hydrated into the in-memory cache
4. **Local Storage** read for pane layout, selections, UX preferences, and recent data
5. StorageContext diffs vault files and writes additions, updates, and removals to **IndexedDB**
6. Tag tree rebuilt from the synchronized database
7. Content providers queue pending previews, tags, metadata, and feature images while UI renders from the memory cache

### File Change (During Session)

1. Obsidian emits vault event (create, delete, rename, modify)
2. StorageContext diffs vault files and updates **IndexedDB** (adds new files, removes deleted entries, preserves
   renamed data)
3. **ContentProviderRegistry** queues affected files for previews, tags, feature images, and metadata
4. Providers write updates through **IndexedDBStorage**, keeping the memory cache in sync and notifying listeners
5. React components re-render with the refreshed in-memory data

### Settings Change

1. User modifies setting in UI
2. New setting → **Settings** (data.json)
3. **Settings** context broadcasts updates to React tree
4. StorageContext compares old and new settings, marks affected files for regeneration, and queues content providers
5. Components re-render with updated configuration
6. If Obsidian Sync enabled → synced to other devices

### UI State Change

1. User resizes a pane, changes selection, or toggles a UX preference
2. New state → **Local Storage** (immediate writes for layout/selection, debounced writes for recent data)
3. State persists for the next session on that device
4. Each device maintains independent UI and recent history

## Storage Selection Guidelines

### Use IndexedDB When:

- Storing file-derived data that can be regenerated
- Data is large or numerous (thousands of entries)
- Data should not sync between devices
- Async access is acceptable

### Use Local Storage When:

- Storing UI state that should persist locally
- Data is small (< 100KB total)
- Synchronous access is required
- Device-specific preferences are needed

### Use Memory Cache When:

- Data needs synchronous access during rendering
- Performance is critical (virtual scrolling)
- Data already exists in IndexedDB
- Temporary storage during session is sufficient

### Use Settings When:

- User preferences should sync between devices
- Data configures plugin behavior
- Changes should trigger UI updates
- Data is small and JSON-serializable

### Use Icon Assets Database When:

- Storing large binary assets (icon fonts)
- Data is too large for settings sync
- Device-specific resources are acceptable
- Content can be re-downloaded if needed

## Performance Considerations

### IndexedDB

- **Batch Operations**: Group multiple updates in single transaction
- **Async Processing**: Use deferred scheduling for background updates
- **Version Management**: Increment versions carefully to avoid unnecessary cache clears

### Local Storage

- **Size Limits**: Keep under 5MB total across all keys
- **JSON Parsing**: Cache parsed values to avoid repeated parsing
- **Cleanup**: Remove obsolete keys during migration
- **Debounced Writes**: RecentStorageService batches writes (~1s delay) to reduce churn for recent data

### Memory Cache

- **Memory Usage**: ~300 bytes per file (30MB for 100k files)
- **Synchronization**: Keep perfectly synced with IndexedDB
- **Initialization**: Load all data upfront for consistent performance

### Settings

- **File Size**: Keep under 1MB to avoid sync conflicts
- **Metadata Cleanup**: Remove orphaned metadata via settings for files deleted outside Obsidian
- **Change Detection**: Use React context for efficient re-renders

## Version Management

### Schema Changes

When IndexedDB schema changes:

1. Increment `DB_SCHEMA_VERSION`
2. Database automatically cleared on next start
3. Full rebuild from vault files
4. Memory cache populated fresh

### Content Format Changes

When content generation logic changes:

1. Increment `DB_CONTENT_VERSION`
2. Database data cleared (structure preserved)
3. Content regenerated for all files
4. Gradual population via background processing

Current values: `DB_SCHEMA_VERSION = 1`, `DB_CONTENT_VERSION = 6`.

### Settings Updates

When settings structure changes:

1. Load existing settings
2. Apply new structure in `loadSettings()`
3. Save updated settings
4. Sync propagates to other devices

### Local Storage Updates

When storage keys change:

1. Check for old keys
2. Copy data to new keys
3. Delete old keys
4. Handle missing data gracefully
5. Update `LOCALSTORAGE_VERSION` so migrations run only once
