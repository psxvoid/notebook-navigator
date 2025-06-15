# Notebook Navigator - AI Assistant Guide

## Project Summary
Notebook Navigator is an Obsidian plugin that replaces the default file explorer with a Notes-style interface. It provides a clean, two-pane layout with a folder tree on the left and a file list on the right, mimicking the UI/UX patterns found in modern note-taking applications.

## Key Features

### Core Features
- **Two-pane layout**: Folder tree on left, file list on right (desktop)
- **Tag browsing**: Browse notes by tags with expandable tag tree
- **File previews**: Show preview text and feature images
- **Keyboard navigation**: Full keyboard support with arrow keys, Tab, Enter, PageUp, PageDown
- **Drag & drop**: Move files and folders (desktop only)
- **Context menus**: Right-click menus for all operations
- **Mobile support**: Single-pane view with swipe gestures
- **Auto-reveal**: Automatically reveal active file in tree
- **Search & filtering**: Filter files, exclude patterns
- **Pinned notes**: Pin important notes to top of folders
- **Folder icons**: Custom folder icons with Lucide icon picker
- **Folder colors**: Custom folder colors for visual organization
- **RTL support**: Full support for right-to-left languages

## Quick Start for AI Assistants
- **Main entry point**: `src/main.ts` - Plugin class
- **React entry**: `src/view/NotebookNavigatorView.tsx` - View wrapper
- **Main component**: `src/components/NotebookNavigatorComponent.tsx` - Root React component
- **Build command**: `npm run build` for production build
- **Key patterns**: React hooks, Context API, TypeScript strict mode, TanStack Virtual for virtualization
- **Testing**: Manual testing in Obsidian vault (no automated tests)

## Architecture Overview

### Directory Structure
```
notebook-navigator/
├── src/
│   ├── main.ts                    # Obsidian plugin entry point
│   ├── settings.ts                # Settings interface and tab
│   ├── types.ts                   # Shared TypeScript types
│   ├── types/                     # TypeScript type definitions
│   │   └── virtualization.ts     # Types for virtualization
│   ├── view/                      # Obsidian view integration
│   │   └── NotebookNavigatorView.tsx  # React root mounting
│   ├── components/                # React components
│   │   ├── NotebookNavigatorComponent.tsx  # Main container
│   │   ├── LeftPaneVirtualized.tsx  # Virtualized left pane with folders/tags
│   │   ├── FolderTree.tsx        # Left pane folder hierarchy (deprecated)
│   │   ├── FolderItem.tsx        # Individual folder component
│   │   ├── FileList.tsx          # Right pane file listing (virtualized)
│   │   ├── FileItem.tsx          # Individual file component
│   │   ├── PaneHeader.tsx        # Header with actions
│   │   ├── TagList.tsx           # Tag browsing component (deprecated)
│   │   ├── TagTreeItem.tsx       # Individual tag component
│   │   ├── ObsidianIcon.tsx      # Icon wrapper component
│   │   └── ErrorBoundary.tsx      # Error boundary for components
│   ├── context/                   # React Context providers
│   │   ├── AppContext.tsx        # Global app state
│   │   └── ServicesContext.tsx   # Service injection
│   ├── hooks/                     # Custom React hooks
│   │   ├── useVirtualKeyboardNavigation.ts  # Keyboard navigation for virtualized lists
│   │   ├── useContextMenu.ts     # Right-click menus
│   │   ├── useDragAndDrop.ts    # Drag & drop logic
│   │   ├── useResizablePane.ts   # Pane resizing functionality
│   │   └── useSwipeGesture.ts    # Mobile swipe gestures
│   ├── i18n/                      # Internationalization
│   │   ├── index.ts              # i18n setup and exports
│   │   └── locales/              # Translation files
│   │       ├── en.ts             # English translations
│   │       └── sv.ts             # Swedish translations
│   ├── services/                  # Business logic services
│   │   ├── FileSystemService.ts  # File operations
│   │   └── MetadataService.ts    # Folder metadata management
│   ├── modals/                    # Obsidian modal dialogs
│   │   ├── ColorPickerModal.ts   # Color picker for folders
│   │   ├── ConfirmModal.ts       # Delete confirmation
│   │   ├── IconPickerModal.ts    # Folder icon picker
│   │   └── InputModal.ts         # Text input dialog
│   └── utils/                     # Utility functions
│       ├── DateUtils.ts          # Date formatting
│       ├── PreviewTextUtils.ts   # File preview extraction
│       ├── domUtils.ts           # DOM utility functions
│       ├── fileFilters.ts        # File filtering utilities
│       ├── sortUtils.ts          # Sorting utilities
│       ├── tagUtils.ts           # Tag-related utilities
│       ├── typeGuards.ts         # TypeScript type guards
│       ├── treeFlattener.ts      # Flattens tree structure for virtualization
│       └── virtualUtils.ts       # Utilities for virtual scrolling
├── images/                        # Screenshots and assets
│   ├── mobile.psd                # Mobile design source
│   ├── screenshot1.png           # App screenshot
│   ├── screenshot2-source.png    # Screenshot source
│   └── screenshot2.png           # App screenshot
├── styles.css                     # Global styles
├── manifest.json                  # Plugin metadata
├── package.json                  # Dependencies
├── tsconfig.json                  # TypeScript configuration
├── esbuild.config.mjs            # Build configuration
├── version-bump.mjs              # Version management script
├── versions.json                 # Version history
├── LICENSE                       # GPL-3.0 license
├── README.md                     # User documentation
└── CLAUDE.md                     # This file
```

## React Architecture

### Component Hierarchy
```
NotebookNavigatorView (Obsidian ItemView)
└── React.StrictMode
    └── ServicesProvider
        └── AppProvider
            └── NotebookNavigatorComponent
                ├── PaneHeader (left pane)
                ├── LeftPaneVirtualized
                │   └── Virtual scrolling for folders and tags
                ├── PaneHeader (right pane)
                └── FileList
                    └── Virtual scrolling for file items
```

### State Management

#### Global State (AppContext)
```typescript
interface AppState {
    selectionType: 'folder' | 'tag';     // Type of selection - folder or tag
    selectedFolder: TFolder | null;      // Currently selected folder
    selectedTag: string | null;          // Currently selected tag
    selectedFile: TFile | null;          // Currently selected file
    expandedFolders: Set<string>;        // Set of expanded folder paths
    expandedTags: Set<string>;           // Set of expanded tag paths
    focusedPane: 'folders' | 'files';   // Which pane has keyboard focus
    scrollToFolderTrigger: number;       // Trigger for scrolling to folder
    currentMobileView: 'list' | 'files'; // Mobile view state
}
```

State is managed through React's useReducer hook with these actions:
- `SET_SELECTED_FOLDER` - Change active folder
- `SET_SELECTED_TAG` - Change active tag
- `SET_SELECTED_FILE` - Change active file
- `SET_EXPANDED_FOLDERS` - Replace all expanded folders
- `SET_EXPANDED_TAGS` - Replace all expanded tags
- `TOGGLE_FOLDER_EXPANDED` - Toggle single folder
- `TOGGLE_TAG_EXPANDED` - Toggle single tag
- `SET_FOCUSED_PANE` - Switch keyboard focus
- `SET_MOBILE_VIEW` - Switch mobile view between list and files
- `EXPAND_FOLDERS` - Expand multiple folders
- `REVEAL_FILE` - Reveal file in tree
- `CLEANUP_DELETED_ITEMS` - Remove deleted items
- `FORCE_REFRESH` - Force component re-render

#### Local Storage Persistence
State is automatically persisted to localStorage:
- `notebook-navigator-expanded-folders` - Array of expanded folder paths
- `notebook-navigator-expanded-tags` - Array of expanded tag paths
- `notebook-navigator-selected-folder` - Current folder path
- `notebook-navigator-selected-file` - Current file path
- `notebook-navigator-left-pane-width` - Resizable pane width

### Context Providers

#### AppContext
Provides global app state and dispatch function to all components:
- `app` - Obsidian App instance
- `plugin` - Plugin instance with settings
- `appState` - Current state
- `dispatch` - State update function
- `refreshCounter` - Force re-render trigger
- `isMobile` - Whether the app is running on a mobile device

#### ServicesContext
Provides service instances through custom hooks:
- `useFileSystemOps()` - File system operations service
- `useMetadataService()` - Metadata operations service

### Services

#### MetadataService
Centralized service for managing all folder and file metadata:
- **Folder Colors**: `setFolderColor()`, `removeFolderColor()`, `getFolderColor()`
- **Folder Icons**: `setFolderIcon()`, `removeFolderIcon()`, `getFolderIcon()`
- **Sort Overrides**: `setFolderSortOverride()`, `removeFolderSortOverride()`, `getFolderSortOverride()`
- **Pinned Notes**: `togglePinnedNote()`, `isPinned()`, `getPinnedNotes()`
- **Cleanup Operations**: 
  - `cleanupAllMetadata()` - Removes references to deleted items on startup
  - `handleFolderRename()` - Updates metadata when folders are renamed
  - `handleFolderDelete()` - Cleans up metadata when folders are deleted
  - `handleFileDelete()` - Removes file from pinned notes when deleted

The service handles all metadata persistence and ensures consistency across renames and deletions.

#### FileSystemService
Handles file system operations with user interaction:
- `createNewFolder()` - Shows modal for folder name input
- `createNewFile()` - Shows modal for file name input
- `renameFile()` - Shows modal for renaming files/folders
- `deleteFile()` - Shows confirmation modal if enabled
- `duplicateFile()` - Creates a copy with automatic naming

### Custom Hooks

- **useVirtualKeyboardNavigation**: Arrow keys, Tab, Enter, Delete, PageUp/PageDown for virtualized lists
- **useContextMenu**: Right-click menus using Obsidian's Menu API
- **useDragAndDrop**: Drag-and-drop with validation and visual feedback (desktop only)
- **useResizablePane**: Handles pane resizing with min/max constraints
- **useSwipeGesture**: Mobile swipe gestures for navigation (edge swipe detection)

## Virtualization

The plugin uses TanStack Virtual for efficient rendering of large file and folder lists:

### Architecture
- **LeftPaneVirtualized**: Virtualizes the folder tree and tag list
- **FileList**: Virtualizes the file list
- **Tree Flattening**: Hierarchical structures are flattened to arrays with depth information
- **Virtual Utilities**: Helper functions for calculating item sizes and positions

### Key Components
- **treeFlattener.ts**: Converts nested folder/tag structures to flat arrays
- **virtualUtils.ts**: Utilities for virtual scrolling calculations
- **virtualization.ts**: TypeScript types for virtualized items
- **useVirtualKeyboardNavigation**: Handles keyboard navigation in virtualized lists

### Features
- Smooth scrolling with thousands of items
- Maintains selection and focus during scrolling
- Supports variable item heights (expanded/collapsed folders)
- Keyboard navigation with PageUp/PageDown support
- Automatic scroll-to-item functionality

## Code Style & Patterns

### Key Principles
- **TypeScript Strict Mode**: All code must pass strict type checking
- **React Hooks**: Functional components with hooks for state and effects
- **Event Delegation**: Used for performance with large file lists
- **Data Attributes**: Clean separation between data and presentation

### Important Patterns
- **Type Guards**: Use `isTFile()` and `isTFolder()` for Obsidian types
- **Null Safety**: Always use optional chaining (`?.`) and nullish coalescing (`??`)
- **Hook Dependencies**: Use specific properties, not entire objects
- **Performance**: Use `useMemo` and `useCallback` for optimization
- **Constants**: Use `STORAGE_KEYS` for localStorage keys, `PANE_DIMENSIONS` for pane sizing

### CSS Conventions
- **Naming**: BEM-like with `nn-` prefix (e.g., `nn-folder-tree`)
- **Theming**: Use Obsidian's CSS variables
- **States**: Modifier classes (`nn-selected`, `nn-dragging`)

## Tag System

### Tag Features
- **Tag browsing**: Separate section below folder tree for tag navigation
- **Nested tags**: Support for hierarchical tags (e.g., `#project/work`)
- **Untagged notes**: Special pseudo-tag `__untagged__` for notes without tags
- **Tag counts**: Display number of notes for each tag
- **Expandable tree**: Collapsible tag hierarchy similar to folder tree
- **Tag selection**: Select tag to show all notes with that tag

### Tag Implementation
- **Tag extraction**: Uses Obsidian's `CachedMetadata` for tag information
- **Tag tree building**: Hierarchical structure built from tag paths
- **State management**: Separate `expandedTags` and `selectedTag` in AppState
- **Persistence**: Expanded tags saved to localStorage

## Common Development Tasks

- **New Setting**: Add to interface → DEFAULT_SETTINGS → Settings tab UI → Use in component
- **New Keyboard Shortcut**: Add case in `useKeyboardNavigation` → preventDefault → Dispatch action
- **New Context Menu**: Find menu builder in `useContextMenu` → Add menu item → Implement handler
- **New Component**: Create in `src/components/` → Named export → TypeScript props interface
- **New Global State**: Add to AppState → Add action type → Implement reducer case → Add persistence
- **New Mobile Feature**: Check `isMobile` → Add conditional logic → Test on mobile device
- **New Tag Feature**: Update TagList/TagTreeItem → Handle in AppContext reducer → Add tag-specific logic
- **New Metadata Type**: Add to MetadataService → Add getter/setter/remover methods → Handle in cleanup operations
- **New Service**: Create in `src/services/` → Add to ServicesContext → Create convenience hook

## Performance Considerations

- **Virtualization**: Uses TanStack Virtual for efficient rendering of large file and folder lists
- **Event delegation**: For scalability with large vaults
- **Memoized computations**: For sorting and filtering
- **Asynchronous preview loading**: Non-blocking preview text generation
- **Efficient Set operations**: For expanded state management
- **Tree flattening**: Converts hierarchical structures to flat arrays for virtualization

## Common Pitfalls

- **State Mutations**: Always use dispatch actions, never mutate state directly
- **Effect Dependencies**: Use specific properties, not entire objects
- **Memory Leaks**: Always clean up effects, timers, and listeners
- **Ref Creation**: Create refs outside render, not inline

## Build & Development

```bash
npm run build     # Production build
npm run dev       # Development with watch mode
npm run version   # Bump version
```

The build outputs `main.js` in the project root using esbuild with TypeScript strict mode.

## Mobile Support

### Mobile-Specific Features

1. **Single-Pane View**: On mobile devices, the navigator switches to a single-pane view that shows either the folder/tag list or the file list
2. **Swipe Gestures**: Edge swipe (from left edge) navigates back from files to folder list
3. **Mobile View States**: 
   - `list` - Shows folder tree and tag list
   - `files` - Shows file list for selected folder/tag
4. **No Drag & Drop**: Drag and drop is disabled on mobile for better touch interaction
5. **Responsive Layout**: Pane resizing is disabled, full width is used
6. **RTL Support**: Swipe gestures are reversed in RTL mode for natural interaction

### Mobile Implementation Details

- Mobile detection: Uses `Platform.isMobile` from Obsidian API
- View switching: Managed through `currentMobileView` state
- Swipe handling: `useSwipeGesture` hook with edge detection (25px threshold)
- CSS classes: `.show-list` and `.show-files` control visibility
- Back navigation: PaneHeader shows back button when viewing files

## Internationalization (i18n)

The plugin is prepared for internationalization with all UI strings centralized:

- **Locale files**: `src/i18n/locales/en.ts` contains all English translations
- **Import pattern**: `import { strings } from '../i18n';`
- **Usage in JSX**: `{strings.fileList.emptyStateNoSelection}`, `{strings.common.new}`
- **Type safety**: Full TypeScript support with autocomplete for all keys
- **Structure**: Hierarchical organization by feature (common, folder, file, tag, etc.)

