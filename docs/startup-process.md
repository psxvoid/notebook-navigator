# Notebook Navigator Startup Process

## Table of Contents

- [Overview](#overview)
- [Key Concepts](#key-concepts)
  - [Cold Boot](#cold-boot)
  - [Warm Boot](#warm-boot)
  - [Version System](#version-system)
- [Startup Phases](#startup-phases)
  - [Phase 1: Plugin Registration](#phase-1-plugin-registration-maints)
  - [Phase 2: View Creation](#phase-2-view-creation-notebooknavigatorviewtsx)
  - [Phase 3: Database Version Check](#phase-3-database-version-check-and-initialization)
  - [Phase 4: Initial Data Load](#phase-4-initial-data-load-and-metadata-resolution)
  - [Phase 5: Background Processing](#phase-5-background-processing)
- [Critical Timing Mechanisms](#critical-timing-mechanisms)
  - [Deferred Scheduling](#deferred-scheduling)
  - [Debouncing Strategies](#debouncing-strategies)

## Overview

The Notebook Navigator plugin has a multi-phase startup process that handles data synchronization and content
generation. The startup behavior differs between cold boots (first launch) and warm boots (subsequent launches).

## Key Concepts

### Cold Boot

A **cold boot** occurs when:

- The plugin is installed for the first time
- The IndexedDB database doesn't exist
- Database schema version has changed (DB_SCHEMA_VERSION)
- Content version has changed (DB_CONTENT_VERSION)

Characteristics:

- Full database initialization required
- All files need content generation
- Database is either created new or cleared completely

### Warm Boot

A **warm boot** occurs when:

- Obsidian is restarted with the plugin already enabled
- The plugin is enabled after being disabled
- Database exists with valid schema and content versions

Characteristics:

- Database already exists with cached data
- Only changed files need processing
- Metadata cache is typically ready immediately

### Version System

The plugin uses two version numbers to manage database state:

**DB_SCHEMA_VERSION**: Controls the IndexedDB structure

- Changes when database schema is modified (new indexes, stores, etc.)
- Triggers complete database recreation on change

**DB_CONTENT_VERSION**: Controls the data format

- Changes when content structure or generation logic is modified
- Triggers data clearing but preserves database structure
- Examples: changing how previews are generated, tag extraction logic updates

Both versions are stored in localStorage to detect changes between sessions.

Both version changes result in a cold boot to ensure data consistency.

## Startup Phases

### Phase 1: Plugin Registration (main.ts)

**Trigger**: Obsidian calls Plugin.onload() when enabling the plugin

1. Obsidian calls `Plugin.onload()`.
2. Initialize vault-scoped localStorage (`localStorage.init`) before any database work.
3. Initialize IndexedDB early via `initializeDatabase(appId)`.
   - Database is ready for all consumers from the start.
   - Operation is idempotent to support rapid enable/disable cycles.
4. Load settings from `data.json` and run migrations.
   - Sanitize keyboard shortcuts and migrate legacy fields.
   - Apply default date/time formats and normalize folder note properties.
   - Load dual-pane orientation and UX preferences from localStorage.
5. Handle first-launch setup when no saved data exists.
   - Normalize tag settings, clear vault-scoped localStorage keys, and expand the root folder.
   - Reset dual-pane orientation and UX preferences to defaults.
   - Record the current localStorage schema version for future migrations.
6. Initialize recent data and UX tracking.
   - `RecentDataManager` loads persisted recent notes and icons.
   - `RecentNotesService` starts recording file-open history.
7. Construct core services and controllers:
   - `WorkspaceCoordinator` and `HomepageController` manage view activation and homepage flow.
   - `MetadataService`, `TagOperations`, `TagTreeService`, and `CommandQueueService`.
   - `FileSystemOperations` wired with tag tree and visibility preferences.
   - `OmnisearchService`, `NotebookNavigatorAPI`, and `ReleaseCheckService`.
   - `ExternalIconProviderController` initializes icon providers and syncs settings.
8. Register view, commands, settings tab, and workspace integrations.
   - `registerNavigatorCommands` wires command palette entries.
   - `registerWorkspaceEvents` adds editor context menu actions, the ribbon icon, recent-note tracking, and
     rename/delete handlers.
9. Wait for `workspace.onLayoutReady()`.
   - `HomepageController.handleWorkspaceReady()` activates the view on first launch and opens the configured homepage
     when available.
   - Triggers Style Settings parsing, version notice checks, and optional release polling.

### Phase 2: View Creation (NotebookNavigatorView.tsx)

**Trigger**: activateView() creates the view via workspace.getLeaf()

1. Obsidian calls onOpen() when view is created
2. React app mounts with the following context providers:
   - `SettingsProvider` (settings state and update actions)
   - `UXPreferencesProvider` (dual-pane and search preferences synced with the plugin)
   - `RecentDataProvider` (recent notes and icon lists)
   - `ServicesProvider` (Obsidian app, services, and platform flags)
   - `ShortcutsProvider` (pinned shortcut hydration and operations)
   - `StorageProvider` (IndexedDB access and content pipeline)
   - `ExpansionProvider` (expanded folders and tags)
   - `SelectionProvider` (selected items plus rename listeners from the plugin)
   - `UIStateProvider` (pane focus and layout mode)
3. Container renders skeleton view while storage initializes:
   - Shows placeholder panes with saved dimensions
   - Provides immediate visual feedback
   - Prevents layout shift when data loads
4. Mobile detection adds platform-specific class and determines UI layout:
   - Desktop: NavigationPaneHeader and ListPaneHeader at top of panes
   - Mobile: NavigationToolbar and ListToolbar at bottom of panes
   - Touch optimizations and swipe gestures enabled on mobile

### Phase 3: Database Version Check and Initialization

**Trigger**: Database already initialized by Plugin.onload() in Phase 1

1. StorageContext retrieves the shared database instance.
   - Calls `getDBInstance()` (singleton created during plugin load).
   - Awaits `db.init()` and sets `isIndexedDBReady` on success.
   - Logs and keeps the flag false if initialization fails.
2. `IndexedDBStorage.init()` handles schema and content version checks.
   - Reads stored versions from vault-scoped localStorage.
   - Deletes the database when `DB_SCHEMA_VERSION` changes.
   - Marks a rebuild when only `DB_CONTENT_VERSION` changes.
   - Persists the current versions back to localStorage.
3. Database opening and cache hydration:
   - Rebuilds start with an empty `MemoryFileCache`.
   - Warm boots load all records into the cache for synchronous access.
4. StorageContext creates a `ContentProviderRegistry` once and registers the preview, feature image, metadata, and tag
   providers.
5. With `isIndexedDBReady` true, Phase 4 processing can begin.

#### Cold Boot Path (database empty or cleared):

1. Database is deleted or cleared during initialization.
2. `MemoryFileCache` starts empty because no cached data exists.
3. Providers remain idle until Phase 4 queues work.
4. Continue to Phase 4 with an empty database snapshot.

#### Warm Boot Path (database has existing data):

1. Database opens without recreation.
2. All records load into `MemoryFileCache`.
3. Providers have immediate access to cached content.
4. Continue to Phase 4 with populated data.

### Phase 4: Initial Data Load and Metadata Resolution

**Trigger**: Database initialization completes (from Phase 3)

This phase handles the initial synchronization between the vault and the database, then ensures metadata is ready for
tag extraction:

#### Shared Initial Steps:

1. StorageContext calls `processExistingCache()`.
   - Cold boot: `isInitialLoad=true` runs synchronously.
   - Warm boot: `isInitialLoad=false` defers work via zero-delay timeouts.
2. Gather markdown files with `getFilteredMarkdownFiles()`.
3. Calculate diffs through `calculateFileDiff()`.
   - Cold boot: All files appear as new (database is empty)
   - Warm boot: Compare against cached data to find changes

#### Cold Boot Specific:

4. Record all files in IndexedDB with basic metadata only
   - Store path and mtime (modification time)
   - Set content fields to null (tags, preview, featureImage, metadata)
   - Null fields act as flags that content needs to be generated
5. Sync MemoryFileCache with new database entries
   - Updates the empty memory cache with the new file records
6. Rebuild tag tree via `rebuildTagTree()` (`buildTagTreeFromDatabase`).
   - Tree mirrors the empty database; counts remain zero until tags extract.

#### Warm Boot Specific:

4. Update IndexedDB based on diff results:
   - Add new files with null content fields (recordFileChanges)
   - Don't update entries for modified files (keeps old mtime in database)
   - The mtime difference (file.mtime != db.mtime) triggers content regeneration later
   - Remove deleted files (removeFilesFromCache)
5. Sync MemoryFileCache with any database changes
   - Cache already loaded in Phase 3, just sync changes
6. Rebuild tag tree only when deletions occur.
   - Otherwise preserve counts already cached in memory.

#### Shared Final Steps:

7. Mark storage as ready (`setIsStorageReady(true)` and `NotebookNavigatorAPI.setStorageReady(true)`).
   - Cold boot: UI renders with folder/file lists while content fields remain empty.
   - Warm boot: Cached previews, tags, and metadata remain visible immediately.
8. When tags are enabled, identify files with `tags === null` and call `waitForMetadataCache()`.
   - Subscribes to Obsidian's `resolved` and `changed` events.
   - Queues tag extraction once metadata exists for every tracked file.
9. Determine metadata-dependent content types with `getMetadataDependentTypes()`.
   - `queueMetadataContentWhenReady()` holds back tag, feature image, and metadata providers until metadata is
     available.
   - Preview generation (and other non-dependent providers) runs immediately.
10. Begin background processing (see Phase 5).
    - Cold boot: all files have pending work across providers.
    - Warm boot: only changed or missing records are queued.

#### Data Flow Diagram

The metadata cache resolution and tag extraction process is managed by the `waitForMetadataCache` function in
StorageContext:

```mermaid
graph TD
    Start[From Phase 3:<br/>Database & Providers Ready] --> A

    subgraph "Shared Initial Steps"
        A[processExistingCache] --> B[getFilteredMarkdownFiles]
        B --> C[calculateFileDiff]
    end

    C --> D{Boot Type}

    subgraph "Cold Boot Path"
        E[All files new] --> F[recordFileChanges]
        F --> G[sync MemoryFileCache]
        G --> H[rebuildTagTree]
    end

    subgraph "Warm Boot Path"
        I[Diff results] --> J[record updates & removals]
        J --> K[sync MemoryFileCache]
        K --> L[rebuild tag tree if files removed]
    end

    D -->|Cold| E
    D -->|Warm| I

    H --> M
    L --> M

    subgraph "Shared Final Steps"
        M[Mark storage ready<br/>notify API]
        M --> N[Queue preview provider immediately]
        M --> O{Tags enabled?}
        O -->|Yes| P[waitForMetadataCache]
        P --> Q[Queue tag provider when metadata arrives]
        O -->|No| R[Skip tag gating]
        M --> S[Resolve metadata-dependent types]
        S --> T{Any gated types?}
        T -->|Yes| U[queueMetadataContentWhenReady]
        U --> V[Schedule metadata/feature image providers]
        T -->|No| R
        R --> W[Enter Phase 5]
        V --> W
        Q --> W
        N --> W
    end
```

#### Metadata Cleanup

**Purpose**: Remove orphaned metadata for folders, tags, and files deleted or renamed outside of Obsidian. Metadata
cleanup is performed manually from settings.

**When It's Needed**:

- Files/folders deleted directly from file system
- Files/folders renamed outside of Obsidian
- Vault synchronized with missing or renamed files
- Files renamed or deleted by external tools or scripts
- After major vault reorganization outside Obsidian
- Sync conflicts that resulted in orphaned metadata

**How to Run**: Open Settings → Notebook Navigator → Advanced → Clean up metadata

**What Gets Cleaned**:

- Folder colors, icons, sort settings, and background colors for deleted/renamed folders
- Tag colors, icons, sort settings, and background colors for removed tags
- Pinned notes that no longer exist
- Custom appearances for non-existent items

**Technical Details**: The cleanup process uses validators to compare stored metadata against the current vault state.
See `MetadataService.cleanupAllMetadata()` and `MetadataService.getCleanupSummary()` for implementation.

### Phase 5: Background Processing

**Trigger**: Files queued by ContentProviderRegistry (from Phase 4)

Content is generated asynchronously in the background by the ContentProviderRegistry and individual providers:

1. **File Detection**: Each provider checks if files need processing
   - TagContentProvider: Checks if tags are null or file modified
   - PreviewContentProvider: Checks if preview is null or file modified
   - FeatureImageContentProvider: Checks if featureImage is null or file modified
   - MetadataContentProvider: Checks if metadata is null or file modified

2. **Queue Management**: Files are queued based on enabled settings
   - ContentProviderRegistry manages the queue
   - Processes files in batches to avoid blocking UI
   - Uses deferred scheduling for background processing
   - `queueMetadataContentWhenReady()` delays metadata-dependent providers until Obsidian's metadata cache has entries

3. **Processing**: Each provider processes files independently
   - TagContentProvider: Extracts tags from app.metadataCache.getFileCache()
   - PreviewContentProvider: Reads file content via app.vault.cachedRead()
   - FeatureImageContentProvider: Checks frontmatter properties via app.metadataCache.getFileCache(), falls back to
     checking embedded images using app.metadataCache.getFirstLinkpathDest()
   - MetadataContentProvider: Extracts custom frontmatter fields from app.metadataCache.getFileCache()

4. **Database Updates**: Results stored in IndexedDB
   - Each provider returns updates to IndexedDBStorage
   - Database fires content change events

5. **Memory Sync**: MemoryFileCache automatically synced with IndexedDB changes

6. **UI Updates**: StorageContext listens for database changes
   - Tag changes trigger tag tree rebuild (buildTagTreeFromDatabase)
   - Components re-render with new content via React context

## Critical Timing Mechanisms

### Deferred Scheduling

StorageContext defers non-blocking work with `setTimeout`, keeping the UI responsive:

- Schedules background batches with zero-delay timeouts
- Works across desktop, mobile, and Safari
- Used for background processing and cleanup

### Debouncing

The plugin uses a single debouncing approach based on Obsidian's built‑in `debounce` utility. It is applied consistently
across vault events and UI updates to coalesce rapid event bursts and avoid redundant work.

- Scope: vault events (create, delete, rename, modify) and UI flows (list refresh, tree rebuilds, focus changes)
- Mechanism: `debounce(handler, timeout, options)` from the Obsidian API
- Goal: reduce repeated processing and unnecessary re-renders when events arrive in quick succession

## Shutdown Process

### Phase 1: Plugin Unload (main.ts)

**Trigger**: Obsidian calls Plugin.onunload() when disabling the plugin

1. Set the `isUnloading` flag to prevent new operations from starting.
2. Dispose runtime managers that watch local storage and external providers.
   - `RecentDataManager.dispose()` stops persistence sync.
   - `ExternalIconProviderController.dispose()` releases icon provider hooks.
3. Clear listener maps to avoid callbacks during teardown:
   - Settings update listeners
   - File rename listeners
   - Recent data listeners
4. Release service instances:
   - `MetadataService` and `TagOperations` references set to `null`
   - `CommandQueueService.clearAllOperations()` then set to `null`
   - `OmnisearchService` reference cleared
   - `RecentDataManager` reference cleared after disposal
5. Stop content processing in every navigator leaf:
   - Iterate leaves via `getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW)`
   - Call `stopContentProcessing()` on each view to halt the `ContentProviderRegistry`
6. Remove the ribbon icon element.
7. Call `shutdownDatabase()` to:
   - Close the IndexedDB connection
   - Clear the in-memory cache
   - Reset the singleton instance
   - Keep the operation idempotent for repeated unloads

### Phase 2: View Cleanup (NotebookNavigatorView.tsx)

**Trigger**: View.onClose() when view is destroyed

1. Remove CSS classes from container:
   - notebook-navigator
   - notebook-navigator-mobile (if applicable)
2. Unmount React root:
   - Call root.unmount()
   - Set root to null
3. StorageContext cleanup (via useEffect return):
   - Stop all content processing in ContentProviderRegistry
   - Cancel any pending timers
   - Prevent setState calls after unmount

### Key Principles

1. **Clear Ownership**: Plugin owns database lifecycle, not React components
2. **Processing Before Shutdown**: Always stop content providers before closing database
3. **Idempotent Operations**: Both initializeDatabase and shutdownDatabase are safe to call multiple times
4. **Prevent Late Operations**: isUnloading flag prevents new operations during shutdown
5. **Clean Separation**: Database lifecycle is separate from view lifecycle
