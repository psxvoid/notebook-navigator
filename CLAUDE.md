## Project Summary

Notebook Navigator is an Obsidian plugin that replaces the default file explorer with a modern, Notes-style interface. It features a clean, two-pane layout with a folder and tag tree on the left and a virtualized file list on the right, similar to apps like Apple Notes.

## Core Features
- **Two-Pane Layout**: Resizable folder/tag tree on the left and a virtualized file list on the right (desktop).
- **Mobile Support**: Responsive single-pane interface with swipe gestures.
- **Virtualized Lists**: High-performance rendering using TanStack Virtual.
- **File Previews**: Shows stripped markdown previews and feature images from frontmatter.
- **Tag Browse**: Supports hierarchical tags (e.g., `#inbox/processing`) and untagged note filtering.
- **Full Keyboard Navigation**: Navigate using arrow keys, `Tab`, `Enter`, `PageUp`, and `PageDown`.
- **Multi-Selection**: Select multiple files using Cmd/Ctrl+Click, Shift+Click, Shift+Arrow keys, and Cmd/Ctrl+A.
- **Drag & Drop**: Move files and folders with visual feedback (desktop only). Supports dragging multiple selected files.
- **Context Menus**: Right-click menus for files and folders, with support for bulk operations on multi-selection.
- **Customization**:
- **Folder Icons**: Pick custom Lucide icons per folder.
- **Folder Colors**: Customize folder name/icon colors.
- **Sort Overrides**: Per-folder sort settings override global default.
- **Pinned Notes**: Pin notes to the top of folder views.
- **Auto-Reveal**: Automatically selects the active file in the navigator.
- **i18n**: Supports English, German, Spanish, French, Japanese, and Chinese.
    

## Quick Start for AI Assistants
- **Main Entry Point**: `src/main.ts` (`NotebookNavigatorPlugin` class).
- **React Entry Point**: `src/view/NotebookNavigatorView.tsx` (mounts React).
- **Main Component**: `src/components/NotebookNavigatorComponent.tsx` (two-pane layout).
- **Build Command**:
    1. `npm install --legacy-peer-deps`
    2. `./build.sh` (runs npm build and optional local deployment)
- **Release Assets**: `main.js`, `manifest.json`, `styles.css`.
- **Key Patterns**: Functional React components, modular state via Context API, strict TypeScript, virtualized lists.
- **Testing**: Manual testing within an Obsidian vault.


## Architecture Overview

### Directory Structure

```
johansan-notebook-navigator/
├── .github/workflows/release.yml              # GitHub Actions for automated releases
├── src/
│   ├── main.ts                                # Plugin entry point, event handlers, lifecycle
│   ├── settings.ts                            # Settings interface, defaults, settings tab UI
│   ├── components/
│   │   ├── NotebookNavigatorComponent.tsx    # Main component, two-pane layout orchestration
│   │   ├── NavigationPane.tsx                # Left pane virtualized folder/tag tree
│   │   ├── FileList.tsx                       # Right pane virtualized file list with headers
│   │   ├── FolderItem.tsx                     # Single folder row with icon/color/chevron
│   │   ├── FileItem.tsx                       # Single file row with preview/date/image
│   │   ├── TagTreeItem.tsx                    # Single tag row in hierarchical tree
│   │   ├── PaneHeader.tsx                     # Header with title, actions, mobile nav
│   │   ├── ObsidianIcon.tsx                  # Lucide icon wrapper for Obsidian
│   │   └── ErrorBoundary.tsx                  # React error boundary with fallback UI
│   ├── context/
│   │   ├── ExpansionContext.tsx              # Tracks expanded/collapsed folders & tags
│   │   ├── SelectionContext.tsx              # Current selection state & navigation logic
│   │   ├── ServicesContext.tsx               # Dependency injection for services
│   │   ├── SettingsContext.tsx               # Global settings provider with versioning
│   │   └── UIStateContext.tsx                # UI state: focus, pane width, mobile view
│   ├── hooks/
│   │   ├── useContextMenu.ts                 # Right-click menu creation & handling
│   │   ├── useDragAndDrop.ts                 # File/folder drag & drop with visual feedback
│   │   ├── useResizablePane.ts               # Pane resizing with mouse/touch support
│   │   ├── useSwipeGesture.ts                # Mobile swipe navigation between panes
│   │   ├── useVirtualKeyboardNavigation.ts   # Keyboard nav with smart PageUp/PageDown
│   │   ├── useAutoReveal.ts                  # Auto-reveal active file with state machine
│   │   └── useFilePreview.ts                 # Async file preview generation & caching
│   ├── i18n/
│   │   └── index.ts                          # Internationalization system & translations
│   ├── modals/
│   │   ├── ColorPickerModal.ts               # Folder color selection dialog
│   │   ├── ConfirmModal.ts                   # Generic confirmation dialog
│   │   ├── IconPickerModal.ts                # Lucide icon picker for folders
│   │   └── InputModal.ts                     # Text input dialog for names/paths
│   ├── reducers/
│   │   └── autoRevealReducer.ts              # State machine for auto-reveal logic
│   ├── services/
│   │   ├── FileSystemService.ts              # File/folder CRUD operations with modals
│   │   └── MetadataService.ts                # Folder metadata & settings with queue
│   ├── types/
│   │   ├── index.ts                          # Core TypeScript interfaces & constants
│   │   └── virtualization.ts                 # Types for virtualized list items
│   ├── utils/
│   │   ├── DateUtils.ts                      # i18n date formatting & grouping logic
│   │   ├── PreviewTextUtils.ts               # Markdown stripping for file previews
│   │   ├── domUtils.ts                       # DOM helpers & data attribute access
│   │   ├── fileFilters.ts                    # File/folder exclusion pattern matching
│   │   ├── fileFinder.ts                     # File retrieval with sort/filter/pin logic
│   │   ├── fileNameUtils.ts                  # File name display logic with extension handling
│   │   ├── sortUtils.ts                      # File sorting comparators & overrides
│   │   ├── tagUtils.ts                       # Tag tree building & hierarchy parsing
│   │   ├── treeFlattener.ts                  # Tree to flat array for virtualization
│   │   ├── typeGuards.ts                     # Type guards for TFile/TFolder/etc
│   │   ├── virtualUtils.ts                   # Virtualizer scroll & index helpers
│   │   └── debugLog.ts                       # File-based debug logging for mobile
│   └── view/
│       └── NotebookNavigatorView.tsx         # Obsidian ItemView & React root mounting
├── styles.css                                # All plugin styles with nn- prefix
└── manifest.json                             # Plugin metadata for Obsidian
```

### Metadata Synchronization Flow

A key challenge is ensuring the React UI updates when changes happen outside of it (e.g., a folder is renamed in the standard Obsidian explorer). The plugin uses a decoupled event-based system to handle this:

1. **Event Trigger**: An event occurs in the vault (e.g., `app.vault.on('rename', ...)`).
2. **`main.ts` Handler**: The handler in `main.ts` catches the event and calls the appropriate method on the single `MetadataService` instance to update the settings data.
3. **Notify Listeners**: After saving the updated settings, `main.ts` calls `onSettingsUpdate()` which iterates over all registered listeners and calls them.
4. **`SettingsProvider` Listener**: The `SettingsProvider` component registers a listener that increments a version counter when called.
5. **React Re-render**: The version increment causes the settings value to be recreated with a new object reference (using spread syntax), triggering a re-render of all components that consume the settings, thus refreshing the UI with the latest data.

This one-way data flow ensures the UI "reacts" to external changes without `main.ts` needing any direct reference to the React components.

### Architectural Improvements

#### MetadataService Promise Queue
The `MetadataService` now uses a promise queue to serialize all settings updates. This critical improvement prevents race conditions when multiple events try to modify settings simultaneously (e.g., rapid file operations or batch renames). All update operations are queued and processed sequentially, ensuring data integrity.

#### FileList Mobile Scroll Momentum
The `FileList` component includes a sophisticated system to preserve scroll momentum on mobile devices. When new items are virtualized during scrolling, the component carefully manages scroll events to prevent interrupting the native "inertial" scrolling. This provides a smooth, native-feeling scrolling experience even with large file lists.

#### Tag Tree Cache System
The plugin implements a sophisticated caching system for tag data to dramatically improve startup performance in large vaults. The cache stores file metadata and tags in localStorage, enabling instant UI display while processing changes in the background.

**Cache Structure:**
```typescript
interface TagCache {
    version: number;                          // For future migrations
    lastModified: number;                     // Timestamp of last update
    fileData: Record<string, {               // Keyed by file path
        mtime: number;                        // File modification time
        tags: string[];                       // Array of tags in file
    }>;
    untaggedCount: number;                    // Count of files without tags
}
```

**How It Works:**
1. **First Load**: Builds tag tree from scratch, saves to localStorage
2. **Subsequent Loads**: 
   - Loads cached data instantly for immediate UI display
   - Calculates diff in background using `requestIdleCallback`
   - Only processes new/modified/deleted files
   - Updates cache with changes

**Sync Safety:**
- Event listeners update cache in real-time during usage
- Modification time (mtime) checks detect external changes
- Version checking handles cache format migrations
- Graceful fallback to full rebuild if cache is invalid

**Performance Impact:**
- Tag tree appears instantly instead of processing all files
- Background diff typically processes 0 files (when nothing changed)
- Scales to large vaults without impacting startup time

#### Deferred Initialization
The plugin uses `requestIdleCallback` to defer non-critical startup operations:
- **Metadata Cleanup**: Runs when browser is idle instead of blocking startup (2-second timeout)
- **Tag Tree Diff**: Processes file changes in background (1-second timeout)
- **Initial Tag Build**: Even first-time builds happen in background (1-second timeout)

This approach follows modern web performance best practices: show UI immediately, enhance progressively.

## React Architecture

### Component Hierarchy

```
NotebookNavigatorView (Obsidian ItemView)
└── React.StrictMode
    └── SettingsProvider
        └── ServicesProvider
            └── TagCacheProvider
                └── ExpansionProvider
                    └── SelectionProvider
                        └── UIStateProvider
                            └── NotebookNavigatorComponent
                                ├── PaneHeader (left)
                                ├── NavigationPane
                                │   └── FolderItem / TagTreeItem
                                ├── PaneHeader (right)
                                └── FileList
                                    └── FileItem
```

### State Management (Context API)
- **SettingsContext**: Provides and updates plugin settings.
- **ServicesContext**: Injects business logic services (e.g., file operations).
- **TagCacheContext**: Manages tag tree caching and loading. Loads immediately on plugin startup (not when NavigationPane mounts) to ensure tags are ready when needed. Handles all tag building, caching, and diff calculations.
- **ExpansionContext**: Tracks expanded folders and tags.
- **SelectionContext**: Tracks selected folder, tag, and files (supports multi-selection). Maintains `selectedFiles` as a Set for multi-selection, `selectedFile` as the cursor position for keyboard navigation. Includes flags `isRevealOperation` and `isFolderChangeWithAutoSelect` for coordinating complex state updates and preventing unwanted side effects.
- **UIStateContext**: Manages UI state like focused pane, pane width, current mobile view ('list' or 'files'), and tracking newly created paths to ensure proper reveal and selection.
    

### Local Storage Keys

**IMPORTANT**: Always use the `STORAGE_KEYS` constant from `src/types.ts` instead of hard-coding localStorage key strings. This ensures consistency and makes it easy to track all localStorage usage.

```typescript
// ❌ DON'T hard-code keys
localStorage.setItem('notebook-navigator-tag-cache', data);

// ✅ DO use STORAGE_KEYS constant
import { STORAGE_KEYS } from '../types';
localStorage.setItem(STORAGE_KEYS.tagCacheKey, data);
```

**Current keys in STORAGE_KEYS:**
- `expandedFoldersKey`: `'notebook-navigator-expanded-folders'`
- `expandedTagsKey`: `'notebook-navigator-expanded-tags'`
- `selectedFolderKey`: `'notebook-navigator-selected-folder'`
- `selectedFileKey`: `'notebook-navigator-selected-file'`
- `navigationPaneWidthKey`: `'notebook-navigator-navigation-pane-width'`
- `navigationPaneCollapsedKey`: `'notebook-navigator-navigation-pane-collapsed'`
- `tagCacheKey`: `'notebook-navigator-tag-cache'`

When adding new localStorage keys:
1. Add the key to the `LocalStorageKeys` interface in `src/types.ts`
2. Add the actual key string to the `STORAGE_KEYS` constant
3. Import and use `STORAGE_KEYS.yourNewKey` in your code
    

### Services
- **MetadataService**
- `setFolderColor()`, `removeFolderColor()`
- `setFolderIcon()`, `removeFolderIcon()`
- `setFolderSortOverride()`, `removeFolderSortOverride()`
- `togglePinnedNote()`, `isPinned()`
- `cleanupAllMetadata()`, `handleFolderRename()`, etc.
- **FileSystemService**
- File/folder creation: `createNewFolder()`, `createNewFile()`, etc.
- Renaming, deletion, duplication with confirmation modals.
        

## Code Style & Patterns
- **TypeScript**: Strict mode enforced.
- **React**: Functional components with hooks.
- **Event Delegation**: Used for drag-and-drop.
- **Data Attributes**: Used to avoid prop drilling.
- **CSS**: All in `styles.css`, BEM-like class names with `nn-` prefix.
- **Type Guards**: Helpers like `isTFile()` and `isTFolder()`.
- **Constants**: In `src/types.ts`, including `UNTAGGED_TAG_ID`.
- **i18n**: Strings stored in `src/i18n/locales/`.
    

## Obsidian Plugin Type Safety Requirements

Per Obsidian's plugin review guidelines, type casting with `as` should be avoided for Obsidian file types. Instead, use `instanceof` checks or type guard functions:

### ❌ Don't use type assertions:
```typescript
// Bad - will fail Obsidian review
const file = item.data as TFile;
const folder = item.data as TFolder;
```

### ✅ Do use instanceof checks or type guards:
```typescript
// Good - using type guard functions
if (isTFile(item.data)) {
    // item.data is now safely typed as TFile
    console.log(item.data.path);
}

// Good - using instanceof directly
if (item.data instanceof TFile) {
    // item.data is now safely typed as TFile
    console.log(item.data.path);
}

// Good - early return pattern
const file = item.data;
if (!isTFile(file)) return;
// file is now safely typed as TFile
```

### Type Guard Functions
The codebase provides type guard functions in `src/utils/typeGuards.ts`:
- `isTFile(obj: unknown): obj is TFile` - Checks if object is a TFile
- `isTFolder(obj: unknown): obj is TFolder` - Checks if object is a TFolder

These functions perform runtime checks to ensure type safety and satisfy Obsidian's review requirements.
    

## Obsidian Plugin Style Requirements

Per Obsidian's plugin review guidelines, inline styles should be avoided. All styles should be defined in CSS files to allow themes and snippets to customize the appearance.

### ❌ Don't use inline styles:
```javascript
// Bad - will fail Obsidian review
element.style.cssText = `
    position: absolute;
    background-color: #dc3545;
    color: white;
`;

// Bad - also avoid individual style properties
element.style.backgroundColor = '#dc3545';
element.style.position = 'absolute';
```

### ✅ Do use CSS classes:
```javascript
// Good - define styles in CSS
element.className = 'nn-drag-count-badge';

// Good - use multiple classes for variations
element.className = 'nn-header-actions nn-header-actions--space-between';
```

```css
/* In styles.css */
.nn-drag-count-badge {
    position: absolute;
    background-color: var(--background-modifier-error);
    color: var(--text-on-accent);
}
```

### When Inline Styles Are Acceptable
Inline styles are only acceptable for truly dynamic values that cannot be predefined:
- Virtual scrolling positions (transform values)
- User-customizable colors from settings
- Calculated dimensions based on runtime state
- CSS custom properties for dynamic values

```javascript
// Acceptable - dynamic transform for virtual scrolling
style={{ transform: `translateY(${virtualItem.start}px)` }}

// Acceptable - user-defined color from settings
style={{ color: userSelectedColor }}

// Acceptable - CSS custom property
style={{ '--preview-rows': settings.previewRows } as React.CSSProperties}
```

### Best Practices
1. Use CSS variables (`var(--variable-name)`) for theme compatibility
2. Create modifier classes for variations (e.g., `nn-header--mobile`)
3. Avoid hardcoded colors - use Obsidian's CSS variables
4. Test with multiple themes to ensure compatibility
    

## Obsidian Plugin File Deletion Requirements

Per Obsidian's plugin review guidelines, use `app.fileManager.trashFile()` instead of `app.vault.delete()` for file deletion. This ensures files are deleted according to the user's preferences (trash vs permanent delete).

### ❌ Don't use vault.delete:
```typescript
// Bad - will fail Obsidian review
await this.app.vault.delete(file);
```

### ✅ Do use fileManager.trashFile:
```typescript
// Good - respects user's trash preferences
await this.app.fileManager.trashFile(file);
```

This applies to both individual file deletions and bulk operations. The `trashFile` method works with both `TFile` and `TFolder` instances.
    

## UI Text Letter Casing Convention

All UI text should use sentence case (only first letter capitalized) for consistency and readability:

### ❌ Don't use Title Case or ALL CAPS:
```typescript
// Bad - avoid Title Case
'Copy Image'
'Remove Custom Size'
'Open In New Tab'

// Bad - avoid ALL CAPS
'COPY IMAGE'
```

### ✅ Do use sentence case:
```typescript
// Good - sentence case
'Copy image'
'Remove custom size'
'Open in new tab'
```

### Exceptions:
- Proper nouns keep their capitalization (e.g., 'Finder', 'Explorer', 'Photoshop')
- Acronyms remain capitalized (e.g., 'CMD', 'CTRL', 'URL')
- Operating system names (e.g., 'macOS', 'Windows')

### Examples:
- ✅ 'Show in Finder' (Finder is a proper noun)
- ✅ 'CMD + click behavior' (CMD is an acronym)
- ✅ 'External editor path (macOS)' (macOS is a proper noun with specific casing)
    

## Common Development Tasks

- **Add a New Setting**
    1. Update `NotebookNavigatorSettings` in `settings.ts`.
    2. Add default in `DEFAULT_SETTINGS`.
    3. Add control in `NotebookNavigatorSettingTab`.
    4. Access via `useSettingsState()`.

- **Add a Keyboard Shortcut**
    1. Update `useVirtualKeyboardNavigation.ts`.
    2. Use `e.preventDefault()` and dispatch action.

- **Add a Context Menu Item**
    1. Edit `useContextMenu.ts`.
    2. Use `menu.addItem()` with `title`, `icon`, and `onClick`.

- **Change Global State**
    1. Use the correct context (e.g., `SelectionContext`).
    2. Dispatch an action.
    3. If missing, extend the reducer and action type.

- **Working with Multi-Selection**
    1. Use `selectedFiles` Set from `SelectionContext` to track selected files.
    2. Use `selectedFile` as the cursor position for keyboard navigation.
    3. Dispatch `TOGGLE_FILE_SELECTION` to add/remove files from selection.
    4. Dispatch `TOGGLE_WITH_CURSOR` when you need to both toggle selection and update cursor.
    5. Use `CLEAR_FILE_SELECTION` to clear all selections.
    6. Context menus should check `selectedFiles.size` for bulk operations.
        

## Build & Development

```
# Install dependencies
npm install --legacy-peer-deps

# Production build - run this every time you finish working tasks
./build.sh

# Development mode
npm run dev
```

**Note**: Use `./build.sh` instead of `npm run build`. This script runs the build and checks for an optional `build-local.sh` file (gitignored) that can contain local deployment commands.

Releases are automated via GitHub Actions in `.github/workflows/release.yml`. Output assets include `main.js`, `manifest.json`, and `styles.css`.

## Detailed File Descriptions

This section provides a detailed breakdown of each file in the project, explaining its role and key responsibilities.

#### Core Plugin Files
- **`src/main.ts`**
- **Purpose**: The main entry point for the Obsidian plugin.
- **Responsibilities**:
- Initializes the plugin in the `onload` method, including loading settings, registering the custom view, and adding ribbon icons and commands.
- Sets up event listeners for vault changes like file renaming and deletion to keep metadata in sync.
- Adds the "Reveal in Navigator" option to the editor context menu.
- Initializes the `MetadataService` and the `debugLog` utility.
- Handles plugin cleanup in the `onunload` method.
- **`src/settings.ts`**
- **Purpose**: Defines the plugin's settings structure and creates the settings UI tab.
- **Key Exports**:
- `NotebookNavigatorSettings`: The TypeScript interface for the entire settings object.
- `DEFAULT_SETTINGS`: A constant object with the default values for all settings.
- `NotebookNavigatorSettingTab`: The class that renders the settings UI in Obsidian's settings window, providing controls for all user-configurable options. It includes logic for showing/hiding dependent settings.
- **`src/view/NotebookNavigatorView.tsx`**
- **Purpose**: The bridge between Obsidian's view system and the React application.
- **Responsibilities**:
- Extends Obsidian's `ItemView` class.
- In `onOpen()`, it creates a React root and renders the main `NotebookNavigatorComponent` inside the view's container element.
- Wraps the main component with all necessary Context Providers (`SettingsProvider`, `ServicesProvider`, `ExpansionProvider`, etc.).
- In `onClose()`, it unmounts the React root to prevent memory leaks.
- Exposes methods like `revealFile` and `focusFilePane` that can be called from the main plugin class to interact with the React components.
            

#### Main React Components
- **`src/components/NotebookNavigatorComponent.tsx`**
- **Purpose**: The top-level React component that structures the entire UI.
- **Responsibilities**:
- Creates the two-pane layout (or single-pane on mobile).
- Integrates the `LeftPaneVirtualized` and `FileList` components.
- Implements the resizable pane logic using the `useResizablePane` hook.
- Implements mobile navigation using the `useSwipeGesture` hook.
- Implements drag-and-drop functionality using the `useDragAndDrop` hook.
- Contains the primary `useEffect` hooks for handling the `autoRevealActiveFile` setting by listening to workspace events.
- **`src/components/NavigationPane.tsx`**
- **Purpose**: Renders the virtualized navigation pane, which contains both the folder tree and the tag tree.
- **Responsibilities**:
- Uses `@tanstack/react-virtual` (`useVirtualizer`) to efficiently render long lists of folders and tags.
- Uses `flattenFolderTree` and `flattenTagTree` utilities to convert the hierarchical data into a flat array for the virtualizer.
- Handles user interactions like clicks and toggles on folders and tags, dispatching actions to the `SelectionContext` and `ExpansionContext`.
- Renders `FolderItem` or `TagTreeItem` components for each item in the virtualized list.
- **`src/components/FileList.tsx`**
- **Purpose**: Renders the virtualized file pane, which displays the list of files for the currently selected folder or tag.
- **Responsibilities**:
- Also uses `useVirtualizer` for high-performance rendering of file lists.
- Calculates the list of files to display by calling `getFilesForFolder` or `getFilesForTag`.
- Handles file sorting, grouping by date, and separating pinned notes.
- Handles file clicks, which updates the selection state and opens the file in the editor.
- Renders `FileItem` components for each file and date headers when grouping is enabled.
- **`src/components/FileItem.tsx`**
- **Purpose**: Renders a single file in the file list.
- **Responsibilities**:
- Displays the file's name, modification date, and an optional feature image.
- Asynchronously reads the file content to generate and display a text preview using `PreviewTextUtils`.
- Manages its own selected state via props.
- Attaches a context menu using the `useContextMenu` hook.
- It is heavily memoized (`React.memo`) for performance, only re-rendering when its specific props change.
- **`src/components/FolderItem.tsx`**
- **Purpose**: Renders a single folder in the navigation pane's tree.
- **Responsibilities**:
- Displays the folder's name, an expand/collapse chevron, an icon (custom or default), and an optional file count.
- Applies custom colors and icons from the `MetadataService`.
- Handles indentation based on its nesting level.
- Attaches a context menu using the `useContextMenu` hook.
        

#### State Management (Contexts)
- **`src/context/ExpansionContext.tsx`**: Manages the state of expanded/collapsed folders and tags (`expandedFolders: Set<string>`, `expandedTags: Set<string>`). Persists this state to `localStorage`.
- **`src/context/SelectionContext.tsx`**: Manages what is currently selected (`selectedFolder`, `selectedTag`, `selectedFiles` Set for multi-selection, and `selectedFile` as cursor position). It contains the core logic for what happens when a selection changes, such as auto-selecting the first file in a folder. Supports multi-selection actions: `TOGGLE_FILE_SELECTION` (add/remove from selection), `TOGGLE_WITH_CURSOR` (toggle selection and update cursor), `CLEAR_FILE_SELECTION` (clear all selections), and `UPDATE_CURRENT_FILE` (move cursor without changing selection). Includes flags `isRevealOperation` and `isFolderChangeWithAutoSelect` for coordinating complex state updates and preventing unwanted side effects, like files being automatically opened when navigating. Persists selection to `localStorage`.
- **`src/context/SettingsContext.tsx`**: Provides the global `NotebookNavigatorSettings` object to the entire React component tree. Uses a version counter to trigger re-renders when settings change. When the version increments, it creates a new settings object reference using spread syntax, ensuring React detects the change and re-renders dependent components.
- **`src/context/ServicesContext.tsx`**: Acts as a dependency injection container. It instantiates business logic services (`FileSystemService`, `MetadataService`) and makes them available to any component via custom hooks.
- **`src/context/UIStateContext.tsx`**: Manages state related to the UI's appearance and behavior, such as which pane has keyboard focus (`focusedPane`), the width of the resizable pane, the current view on mobile (`currentMobileView` - 'list' or 'files'), and tracking newly created paths (`newlyCreatedPath`) to ensure they are properly revealed and selected. Scrolling is now handled declaratively within components using the virtualizer's `scrollToIndex` method, triggered by changes in `SelectionContext`.
    

#### Business Logic (Services)
- **`src/services/FileSystemService.ts`**
- **Purpose**: Handles all direct interactions with the vault's file system that require user input.
- **Responsibilities**: Encapsulates logic for creating, renaming, and deleting files and folders. It is responsible for launching the appropriate `InputModal` or `ConfirmModal` to get user input or confirmation before performing an action.
- **`src/services/MetadataService.ts`**
- **Purpose**: Manages all custom metadata associated with folders (colors, icons, sort overrides, pinned notes).
- **Responsibilities**: All reads and writes to this metadata (which is stored in the main settings object) go through this service. It includes crucial cleanup logic to handle file/folder renames and deletions, ensuring no stale metadata is left behind. Uses a promise queue to serialize all updates, preventing race conditions when multiple events try to modify settings simultaneously.
        

#### Custom Hooks
- **`src/hooks/useAutoReveal.ts`**
  - **Purpose**: Manages the sophisticated logic for auto-revealing the active file in the navigator.
  - **Responsibilities**: Checks if the user is actively interacting with the navigator (to avoid interrupting workflows), listens to workspace events, and triggers reveal operations when appropriate. Uses a state machine approach with `autoRevealReducer` to track states (IDLE, USER_INTERACTING, AUTO_REVEALING).
- **`src/hooks/useFilePreview.ts`**
  - **Purpose**: Encapsulates the asynchronous logic for reading file content and generating clean previews.
  - **Responsibilities**: Reads file content, handles special file types like Excalidraw drawings, strips markdown using `PreviewTextUtils`, and manages loading states. This separation of concerns keeps the `FileItem` component focused on rendering.
- **`src/hooks/useVirtualKeyboardNavigation.ts`**
  - **Purpose**: Implements comprehensive keyboard navigation for the virtualized lists.
  - **Responsibilities**: Handles arrow keys, Tab, Enter, and PageUp/PageDown. Supports multi-selection with Shift+Arrow keys (Apple Notes-style behavior where cursor jumps through selected items), Cmd/Ctrl+A for select all. The PageUp/PageDown implementation intelligently calculates the number of visible items based on viewport geometry and average item height, providing natural page-wise navigation.

#### Reducers
- **`src/reducers/autoRevealReducer.ts`**
  - **Purpose**: Formalizes the state machine for auto-reveal logic.
  - **States**: IDLE (no reveal operation), USER_INTERACTING (user is actively using the navigator), AUTO_REVEALING (automatic reveal in progress).
  - **Benefits**: Makes the auto-reveal behavior more predictable and easier to debug.

#### Utility Functions
- **`src/utils/fileFinder.ts`**: Contains the main logic (`getFilesForFolder`, `getFilesForTag`) for retrieving the correct list of files based on the current selection and all relevant settings (sorting, pinning, exclusions).
- **`src/utils/fileNameUtils.ts`**: Handles file name display logic, including showing/hiding file extensions based on user settings and Obsidian's internal settings. Provides the `getFileDisplayName` function used throughout the UI.
- **`src/utils/treeFlattener.ts`**: A critical utility for virtualization. It takes a hierarchical data structure (like nested folders) and converts it into a flat array with level information, which is what the `useVirtualizer` hook needs to render the list.
- **`src/utils/sortUtils.ts`**: Contains all file sorting logic. It determines the effective sort option (global default vs. folder-specific override) and provides the comparison functions for `Array.sort()`.
- **`src/utils/tagUtils.ts`**: Contains the logic for parsing all tags from the vault and building the hierarchical tag tree that is displayed in the navigation pane.
- **`src/utils/PreviewTextUtils.ts`**: Provides a high-performance, single-pass regex function to strip markdown syntax from text to generate clean file previews.
- **`src/utils/DateUtils.ts`**: A centralized utility for all date and time operations, using the `date-fns` library for robust, i18n-aware date formatting and grouping.
- **`src/utils/fileFilters.ts`**: Handles the logic for filtering out files and folders based on user-defined exclusion patterns in the settings.
- **`src/utils/domUtils.ts`**: A collection of helper functions for interacting with the DOM, primarily to get information from `data-*` attributes on elements.
- **`src/utils/typeGuards.ts`**: Provides TypeScript type guard functions (`isTFile`, `isTFolder`) to safely work with Obsidian's abstract file types.
- **`src/utils/virtualUtils.ts`**: Contains helper functions for working with the `@tanstack/react-virtual` library, such as programmatically scrolling to a specific item.
- **`src/utils/debugLog.ts`**: A custom logger that writes detailed diagnostic information to a file in the vault, designed to help debug issues on mobile devices.
    

#### Build and CI
- **`.github/workflows/release.yml`**: A GitHub Actions workflow that automates the release process. On a new tag push, it checks out the code, installs dependencies, runs the build script, and creates a draft GitHub release with the compiled `main.js`, `styles.css`, and `manifest.json` files as attachments.
