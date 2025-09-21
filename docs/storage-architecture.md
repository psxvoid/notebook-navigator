# Notebook Navigator Storage Architecture

## Table of Contents

- [Overview](#overview)
- [Storage Containers](#storage-containers)
  - [IndexedDB](#1-indexeddb-persistent-local-storage)
  - [Local Storage](#2-local-storage-persistent-local-storage)
  - [Memory Cache](#3-memory-cache-temporary-storage)
  - [Settings](#4-settings-synchronized-storage)
- [Data Flow Patterns](#data-flow-patterns)
  - [Initial Load](#initial-load-cold-boot)
  - [File Change](#file-change-during-session)
  - [Settings Change](#settings-change)
  - [UI State Change](#ui-state-change)
- [Storage Selection Guidelines](#storage-selection-guidelines)
- [Performance Considerations](#performance-considerations)
- [Version Management](#version-management)

## Overview

The Notebook Navigator plugin uses five distinct storage containers, each serving a specific purpose in the plugin's
data management strategy. These containers work together to provide fast performance, data persistence, and cross-device
synchronization while maintaining clear separation of concerns.

## Storage Containers

### 1. IndexedDB (Persistent Local Storage)

**Purpose**: Stores all file metadata and generated content locally on the device. This is the primary database for
caching vault information to enable fast searches and filtering without repeatedly reading files from disk.

**Location**: Browser's IndexedDB storage (device-specific)

**Synchronization**: Not synchronized - each device maintains its own cache

**Data Stored**:

- File modification times (mtime)
- Extracted tags from files
- Generated preview text (first ~500 characters)
- Feature images (from frontmatter or first embedded image)
- Custom metadata fields (created date, modified date, custom name)

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
interface FileData {
  mtime: number;
  tags: string[] | null; // null = not extracted yet
  preview: string | null; // null = not generated yet
  featureImage: string | null; // null = not found yet
  metadata: {
    name?: string;
    created?: number;
    modified?: number;
  } | null; // null = not extracted yet
}
```

### 2. Local Storage (Persistent Local Storage)

**Purpose**: Stores UI state and preferences that should persist across sessions but remain local to each device. This
allows users to have different UI layouts on desktop vs mobile, for example.

**Location**: Browser's localStorage (device-specific, vault-specific)

**Synchronization**: Not synchronized - each device maintains its own UI state

**Data Stored**:

- Navigation pane width
- Selected folder/tag/file
- Expanded/collapsed folders
- Expanded/collapsed tags
- Database version numbers (for detecting schema changes)
- Last shown version (for release notes)

**Key Characteristics**:

- Persists across Obsidian restarts
- Limited to ~5-10MB total storage
- Synchronous API for immediate access
- Uses Obsidian's vault-specific storage methods
- Automatically cleaned up when plugin is uninstalled

**Implementation**: `src/utils/localStorage.ts`

```typescript
const STORAGE_KEYS = {
  expandedFoldersKey: 'notebookNavigator:expandedFolders',
  expandedTagsKey: 'notebookNavigator:expandedTags',
  navigationPaneWidthKey: 'notebookNavigator:navigationPaneWidth',
  selectedFolderKey: 'notebookNavigator:selectedFolder',
  selectedTagKey: 'notebookNavigator:selectedTag',
  selectedFileKey: 'notebookNavigator:selectedFile'
  // ... more keys
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
- Memory usage: ~500 bytes per file (5MB for 10k files, 50MB for 100k files)
- Automatically updated when IndexedDB changes
- Essential for virtual scrolling performance

**Implementation**: `src/storage/MemoryFileCache.ts`

```typescript
class MemoryFileCache {
  private memoryMap: Map<string, FileData> = new Map();

  // Synchronous access for rendering
  get(path: string): FileData | undefined {
    return this.memoryMap.get(path);
  }
}
```

### 4. Settings (Synchronized Storage)

**Purpose**: Stores user preferences and configuration that should be consistent across all devices. When using Obsidian
Sync, these settings are automatically synchronized.

**Location**: `.obsidian/plugins/notebook-navigator/data.json`

**Synchronization**: Synchronized via Obsidian Sync (if enabled)

**Data Stored**:

- Feature toggles (show tags, show folders, etc.)
- Display preferences (preview lines, date format, etc.)
- Folder metadata:
  - Colors (custom color per folder)
  - Icons (custom icon per folder)
  - Sort overrides (custom sort order per folder)
  - Custom appearance (titleRows, previewRows, showDate, showPreview, showImage)
  - Pinned notes (list of pinned files per folder)
- Tag metadata:
  - Colors (custom color per tag)
  - Icons (custom icon per tag)
  - Sort overrides (custom sort order per tag)
  - Custom appearance (titleRows, previewRows, showDate, showPreview, showImage)
- Global sort preferences
- Frontmatter field mappings

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

- Icon pack files (WOFF2 web font format)
- CSS stylesheets for icon rendering
- Icon manifests with metadata
- Version information for each pack

**Key Characteristics**:

- Persists across Obsidian restarts
- Large storage capacity for icon pack assets (5MB-10MB per pack)
- Asynchronous download and storage
- Automatic version management
- Database name: `notebooknavigator/icon-assets/{appId}`
- Separate from main cache database

**Icon Pack Management**:

- Settings only store which packs are enabled (small metadata)
- Each device checks settings and downloads needed packs
- Packs can be installed/removed independently per device
- Updates handled automatically when new versions available

**Available Icon Packs**:

- **Bootstrap Icons**: 1,800+ icons
- **Font Awesome Free**: 2,000+ icons
- **Material Icons**: 2,100+ icons
- **Phosphor Icons**: 7,000+ icons
- **RPG Awesome**: 500+ game/fantasy icons

**Implementation**: `src/services/icons/external/IconAssetDatabase.ts`

```typescript
interface IconAssetRecord {
  providerId: string;
  version: string;
  css: string;
  fontData: ArrayBuffer;
  manifest: ExternalIconManifest;
}
```

## Data Flow Patterns

### Initial Load (Cold Boot)

1. **Settings** loaded from data.json
2. **IndexedDB** opened/created
3. **Memory Cache** initialized (empty)
4. **Local Storage** checked for saved UI state
5. Vault files scanned → **IndexedDB** populated
6. **IndexedDB** → **Memory Cache** synced
7. **Memory Cache** → UI renders with data

### File Change (During Session)

1. Obsidian detects file change
2. **Content Providers** generate new content
3. New content → **IndexedDB** updated
4. **IndexedDB** → **Memory Cache** auto-synced
5. **Memory Cache** → UI re-renders

### Settings Change

1. User modifies setting in UI
2. New setting → **Settings** (data.json)
3. **Settings** → React Context update
4. All components re-render with new settings
5. If Obsidian Sync enabled → synced to other devices

### UI State Change

1. User resizes pane or selects folder
2. New state → **Local Storage**
3. State persists for next session
4. Each device maintains independent UI state

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

- Storing large binary assets (fonts, images)
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

### Memory Cache

- **Memory Usage**: ~500 bytes per file (50MB for 100k files)
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
