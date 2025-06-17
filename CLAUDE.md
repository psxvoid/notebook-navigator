## Project Summary

Notebook Navigator is an Obsidian plugin that replaces the default file explorer with a modern, Notes-style interface. It features a clean, two-pane layout with a folder and tag tree on the left and a virtualized file list on the right, similar to apps like Apple Notes.

## Core Features
- **Two-Pane Layout**: Resizable folder/tag tree on the left and a virtualized file list on the right (desktop).
- **Mobile Support**: Responsive single-pane interface with swipe gestures.
- **Virtualized Lists**: High-performance rendering using TanStack Virtual.
- **File Previews**: Shows stripped markdown previews and feature images from frontmatter.
- **Tag Browse**: Supports hierarchical tags (e.g., `#inbox/processing`) and untagged note filtering.
- **Full Keyboard Navigation**: Navigate using arrow keys, `Tab`, `Enter`, `PageUp`, and `PageDown`.
- **Drag & Drop**: Move files and folders with visual feedback (desktop only).
- **Context Menus**: Right-click menus for files and folders.
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
    2. `npm run build`
- **Release Assets**: `main.js`, `manifest.json`, `styles.css`.
- **Key Patterns**: Functional React components, modular state via Context API, strict TypeScript, virtualized lists.
- **Testing**: Manual testing within an Obsidian vault.


## Architecture Overview

### Directory Structure

```
johansan-notebook-navigator/
├── .github/workflows/release.yml
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── components/
│   │   ├── NotebookNavigatorComponent.tsx
│   │   ├── LeftPaneVirtualized.tsx
│   │   ├── FileList.tsx
│   │   ├── FolderItem.tsx
│   │   ├── FileItem.tsx
│   │   ├── TagTreeItem.tsx
│   │   ├── PaneHeader.tsx
│   │   ├── ObsidianIcon.tsx
│   │   └── ErrorBoundary.tsx
│   ├── context/
│   │   ├── ExpansionContext.tsx
│   │   ├── SelectionContext.tsx
│   │   ├── ServicesContext.tsx
│   │   ├── SettingsContext.tsx
│   │   └── UIStateContext.tsx
│   ├── hooks/
│   │   ├── useContextMenu.ts
│   │   ├── useDragAndDrop.ts
│   │   ├── useResizablePane.ts
│   │   ├── useSwipeGesture.ts
│   │   └── useVirtualKeyboardNavigation.ts
│   ├── i18n/
│   │   └── index.ts
│   ├── modals/
│   │   ├── ColorPickerModal.ts
│   │   ├── ConfirmModal.ts
│   │   ├── IconPickerModal.ts
│   │   └── InputModal.ts
│   ├── services/
│   │   ├── FileSystemService.ts
│   │   └── MetadataService.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── virtualization.ts
│   ├── utils/
│   │   ├── DateUtils.ts
│   │   ├── PreviewTextUtils.ts
│   │   ├── domUtils.ts
│   │   ├── fileFilters.ts
│   │   ├── fileFinder.ts
│   │   ├── sortUtils.ts
│   │   ├── tagUtils.ts
│   │   ├── treeFlattener.ts
│   │   ├── typeGuards.ts
│   │   └── virtualUtils.ts
│   └── view/
│       └── NotebookNavigatorView.tsx
├── styles.css
└── manifest.json
```

### Metadata Synchronization Flow

A key challenge is ensuring the React UI updates when changes happen outside of it (e.g., a folder is renamed in the standard Obsidian explorer). The plugin uses a decoupled event-based system to handle this:

1. **Event Trigger**: An event occurs in the vault (e.g., `app.vault.on('rename', ...)`).
2. **`main.ts` Handler**: The handler in `main.ts` catches the event and calls the appropriate method on the single `MetadataService` instance to update the settings data.
3. **Notify Listeners**: After saving the updated settings, `main.ts` calls `onSettingsUpdate()` which iterates over all registered listeners and calls them.
4. **`SettingsProvider` Listener**: The `SettingsProvider` component registers a listener that increments a version counter when called.
5. **React Re-render**: The version increment causes the settings value to be recreated with a new object reference (using spread syntax), triggering a re-render of all components that consume the settings, thus refreshing the UI with the latest data.

This one-way data flow ensures the UI "reacts" to external changes without `main.ts` needing any direct reference to the React components.

## React Architecture

### Component Hierarchy

```
NotebookNavigatorView (Obsidian ItemView)
└── React.StrictMode
    └── SettingsProvider
        └── ServicesProvider
            └── ExpansionProvider
                └── SelectionProvider
                    └── UIStateProvider
                        └── NotebookNavigatorComponent
                            ├── PaneHeader (left)
                            ├── LeftPaneVirtualized
                            │   └── FolderItem / TagTreeItem
                            ├── PaneHeader (right)
                            └── FileList
                                └── FileItem
```

### State Management (Context API)
- **SettingsContext**: Provides and updates plugin settings.
- **ServicesContext**: Injects business logic services (e.g., file operations).
- **ExpansionContext**: Tracks expanded folders and tags.
- **SelectionContext**: Tracks selected folder, tag, or file.
- **UIStateContext**: Manages UI state like focused pane, pane width, scroll targets.
    

### Local Storage Keys
- `notebook-navigator-expanded-folders`
- `notebook-navigator-expanded-tags`
- `notebook-navigator-selected-folder`
- `notebook-navigator-selected-file`
- `notebook-navigator-left-pane-width`
    

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
        

## Build & Development

```
# Install dependencies
npm install --legacy-peer-deps

# Production build
npm run build

# Development mode
npm run dev

# Bump plugin version
npm run version
```

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
- **`src/components/LeftPaneVirtualized.tsx`**
- **Purpose**: Renders the virtualized left pane, which contains both the folder tree and the tag tree.
- **Responsibilities**:
- Uses `@tanstack/react-virtual` (`useVirtualizer`) to efficiently render long lists of folders and tags.
- Uses `flattenFolderTree` and `flattenTagTree` utilities to convert the hierarchical data into a flat array for the virtualizer.
- Handles user interactions like clicks and toggles on folders and tags, dispatching actions to the `SelectionContext` and `ExpansionContext`.
- Renders `FolderItem` or `TagTreeItem` components for each item in the virtualized list.
- **`src/components/FileList.tsx`**
- **Purpose**: Renders the virtualized right pane, which displays the list of files for the currently selected folder or tag.
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
- **Purpose**: Renders a single folder in the left pane's tree.
- **Responsibilities**:
- Displays the folder's name, an expand/collapse chevron, an icon (custom or default), and an optional file count.
- Applies custom colors and icons from the `MetadataService`.
- Handles indentation based on its nesting level.
- Attaches a context menu using the `useContextMenu` hook.
        

#### State Management (Contexts)
- **`src/context/ExpansionContext.tsx`**: Manages the state of expanded/collapsed folders and tags (`expandedFolders: Set<string>`, `expandedTags: Set<string>`). Persists this state to `localStorage`.
- **`src/context/SelectionContext.tsx`**: Manages what is currently selected (`selectedFolder`, `selectedTag`, `selectedFile`). It contains the core logic for what happens when a selection changes, such as auto-selecting the first file in a folder. Persists selection to `localStorage`.
- **`src/context/SettingsContext.tsx`**: Provides the global `NotebookNavigatorSettings` object to the entire React component tree. Uses a version counter to trigger re-renders when settings change. When the version increments, it creates a new settings object reference using spread syntax, ensuring React detects the change and re-renders dependent components.
- **`src/context/ServicesContext.tsx`**: Acts as a dependency injection container. It instantiates business logic services (`FileSystemService`, `MetadataService`) and makes them available to any component via custom hooks.
- **`src/context/UIStateContext.tsx`**: Manages state related to the UI's appearance and behavior, such as which pane has keyboard focus (`focusedPane`), the width of the resizable pane, the current view on mobile (`currentMobileView`), and triggers for programmatic scrolling (`scrollToFolderIndex`, `scrollToFileIndex`).
    

#### Business Logic (Services)
- **`src/services/FileSystemService.ts`**
- **Purpose**: Handles all direct interactions with the vault's file system that require user input.
- **Responsibilities**: Encapsulates logic for creating, renaming, and deleting files and folders. It is responsible for launching the appropriate `InputModal` or `ConfirmModal` to get user input or confirmation before performing an action.
- **`src/services/MetadataService.ts`**
- **Purpose**: Manages all custom metadata associated with folders (colors, icons, sort overrides, pinned notes).
- **Responsibilities**: All reads and writes to this metadata (which is stored in the main settings object) go through this service. It includes crucial cleanup logic to handle file/folder renames and deletions, ensuring no stale metadata is left behind.
        

#### Custom Hooks

#### Utility Functions
- **`src/utils/fileFinder.ts`**: Contains the main logic (`getFilesForFolder`, `getFilesForTag`) for retrieving the correct list of files based on the current selection and all relevant settings (sorting, pinning, exclusions).
- **`src/utils/treeFlattener.ts`**: A critical utility for virtualization. It takes a hierarchical data structure (like nested folders) and converts it into a flat array with level information, which is what the `useVirtualizer` hook needs to render the list.
- **`src/utils/sortUtils.ts`**: Contains all file sorting logic. It determines the effective sort option (global default vs. folder-specific override) and provides the comparison functions for `Array.sort()`.
- **`src/utils/tagUtils.ts`**: Contains the logic for parsing all tags from the vault and building the hierarchical tag tree that is displayed in the left pane.
- **`src/utils/PreviewTextUtils.ts`**: Provides a high-performance, single-pass regex function to strip markdown syntax from text to generate clean file previews.
- **`src/utils/DateUtils.ts`**: A centralized utility for all date and time operations, using the `date-fns` library for robust, i18n-aware date formatting and grouping.
- **`src/utils/fileFilters.ts`**: Handles the logic for filtering out files and folders based on user-defined exclusion patterns in the settings.
- **`src/utils/domUtils.ts`**: A collection of helper functions for interacting with the DOM, primarily to get information from `data-*` attributes on elements.
- **`src/utils/typeGuards.ts`**: Provides TypeScript type guard functions (`isTFile`, `isTFolder`) to safely work with Obsidian's abstract file types.
- **`src/utils/virtualUtils.ts`**: Contains helper functions for working with the `@tanstack/react-virtual` library, such as programmatically scrolling to a specific item.
- **`src/utils/debugLog.ts`**: A custom logger that writes detailed diagnostic information to a file in the vault, designed to help debug issues on mobile devices.
    

#### Build and CI
- **`.github/workflows/release.yml`**: A GitHub Actions workflow that automates the release process. On a new tag push, it checks out the code, installs dependencies, runs the build script, and creates a draft GitHub release with the compiled `main.js`, `styles.css`, and `manifest.json` files as attachments.
