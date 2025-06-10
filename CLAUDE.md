# Notebook Navigator - AI Assistant Guide

## Project Summary
Notebook Navigator is an Obsidian plugin that replaces the default file explorer with a Notes-style interface. It provides a clean, two-pane layout with a folder tree on the left and a file list on the right, mimicking the UI/UX patterns found in modern note-taking applications.

## Key Features

### Core Features
- **Two-pane layout**: Folder tree on left, file list on right (desktop)
- **Tag browsing**: Browse notes by tags with expandable tag tree
- **File previews**: Show preview text and feature images
- **Keyboard navigation**: Full keyboard support with arrow keys, Tab, Enter
- **Drag & drop**: Move files and folders (desktop only)
- **Context menus**: Right-click menus for all operations
- **Mobile support**: Single-pane view with swipe gestures
- **Auto-reveal**: Automatically reveal active file in tree
- **Search & filtering**: Filter files, exclude patterns
- **Pinned notes**: Pin important notes to top of folders (backend exists, UI pending)
- **Folder icons**: Custom folder icons (backend exists, UI pending)

## Quick Start for AI Assistants
- **Main entry point**: `src/main.ts` - Plugin class
- **React entry**: `src/view/NotebookNavigatorView.tsx` - View wrapper
- **Main component**: `src/components/NotebookNavigatorComponent.tsx` - Root React component
- **Build command**: `npm run dev` for development with watch mode
- **Key patterns**: React hooks, Context API, TypeScript strict mode, Event delegation
- **Testing**: Manual testing in Obsidian vault (no automated tests)

## Architecture Overview

### Directory Structure
```
notebook-navigator/
├── src/
│   ├── main.ts                    # Obsidian plugin entry point
│   ├── settings.ts                # Settings interface and tab
│   ├── types.ts                   # Shared TypeScript types
│   ├── view/                      # Obsidian view integration
│   │   └── NotebookNavigatorView.tsx  # React root mounting
│   ├── components/                # React components
│   │   ├── NotebookNavigatorComponent.tsx  # Main container
│   │   ├── FolderTree.tsx        # Left pane folder hierarchy
│   │   ├── FolderItem.tsx        # Individual folder component
│   │   ├── FileList.tsx          # Right pane file listing
│   │   ├── FileItem.tsx          # Individual file component
│   │   ├── PaneHeader.tsx        # Header with actions
│   │   ├── TagList.tsx           # Tag browsing component
│   │   ├── TagTreeItem.tsx       # Individual tag component
│   │   └── ObsidianIcon.tsx      # Icon wrapper component
│   ├── context/                   # React Context providers
│   │   ├── AppContext.tsx        # Global app state
│   │   └── ServicesContext.tsx   # Service injection
│   ├── hooks/                     # Custom React hooks
│   │   ├── useKeyboardNavigation.ts  # Keyboard shortcuts
│   │   ├── useContextMenu.ts     # Right-click menus
│   │   ├── useDragAndDrop.ts    # Drag & drop logic
│   │   ├── useScrollIntoView.ts  # Smart scroll positioning
│   │   ├── useResizablePane.ts   # Pane resizing functionality
│   │   └── useSwipeGesture.ts    # Mobile swipe gestures
│   ├── i18n/                      # Internationalization
│   │   ├── index.ts              # i18n setup and exports
│   │   └── locales/              # Translation files
│   │       └── en.ts             # English translations
│   ├── services/                  # Business logic services
│   │   └── FileSystemService.ts  # File operations
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
│       ├── tagUtils.ts           # Tag-related utilities
│       └── typeGuards.ts         # TypeScript type guards
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
                ├── FolderTree
                │   └── FolderItem (recursive)
                ├── TagList
                │   └── TagTreeItem (recursive)
                ├── PaneHeader (right pane)
                └── FileList
                    └── FileItem (multiple)
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

### Custom Hooks

- **useKeyboardNavigation**: Arrow keys, Tab, Enter, Delete with debouncing
- **useContextMenu**: Right-click menus using Obsidian's Menu API
- **useDragAndDrop**: Drag-and-drop with validation and visual feedback (desktop only)
- **useScrollIntoView**: Smart scrolling that centers selected items
- **useResizablePane**: Handles pane resizing with min/max constraints
- **useSwipeGesture**: Mobile swipe gestures for navigation (edge swipe detection)

## Code Style & Patterns

### Key Development Principles

1. **Pragmatism over Purity**: When integrating with Obsidian's imperative APIs and handling performance requirements for large vaults, practical solutions take precedence over strict React patterns.

2. **Performance Matters**: For a file explorer dealing with potentially thousands of items, performance optimizations (like event delegation) are crucial. Choose patterns that scale well.

3. **Documentation is Crucial**: When using non-standard patterns, always document the rationale. Future maintainers need to understand why decisions were made.

### React Patterns

**AVOID direct DOM manipulation in React components unless justified by performance or Obsidian integration needs.**

❌ **Generally Wrong:**
```typescript
// Avoid setTimeout for React state synchronization
setTimeout(() => {
    element?.scrollIntoView();
}, 100);

// Avoid direct DOM manipulation for state
element.classList.add('active');
```

✅ **Preferred React Patterns:**
```typescript
// Use React lifecycle for side effects
useEffect(() => {
    if (isSelected && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth' });
    }
}, [isSelected]);

// Use state for UI changes
<div className={`item ${isActive ? 'active' : ''}`}>
```

### Pragmatic Exceptions

Some patterns deviate from React best practices for good reasons:

1. **DOM Queries in useKeyboardNavigation**: Used for dynamic navigation through complex, nested structures. Managing refs for hundreds of items would add unnecessary complexity.

2. **Event Delegation in useDragAndDrop**: Provides superior performance with 4 listeners vs hundreds. Essential for large vaults.

3. **Data Attributes**: Used extensively for drag-and-drop and keyboard navigation. Provides clean separation between data and presentation.

### React Best Practices

- **Component Structure**: Imports → Interfaces → Component → Hooks → Callbacks → Render
- **Hook Dependencies**: Use specific properties, not entire objects
- **Performance**: Use `useMemo` for expensive computations, `useCallback` for stable references
- **DOM Measurements**: Use `useLayoutEffect` to prevent visual flicker

### TypeScript Patterns

- **Type Guards**: Use `isTFile()` and `isTFolder()` for Obsidian's abstract types
- **Null Safety**: Always use optional chaining (`?.`) and nullish coalescing (`??`)
- **Strict Mode**: TypeScript strict mode is enabled - handle all edge cases

### Event Handling

- **Event Delegation**: Used for performance with large lists (see `useDragAndDrop` and `useKeyboardNavigation`)
- **Keyboard Events**: Always `preventDefault()` for navigation keys to prevent scrolling
- **Data Attributes**: Used for associating data with DOM elements in event delegation patterns

### CSS Classes & Styling

- **Naming Convention**: BEM-like with `nn-` prefix (e.g., `nn-folder-tree`, `nn-folder-item--expanded`)
- **Theming**: Use Obsidian's CSS variables for consistent theming
- **States**: Use modifier classes for states (`nn-selected`, `nn-dragging`, `nn-drag-over`)

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

## Performance Considerations

### React Rendering
- File list uses `useLayoutEffect` for flicker-free auto-selection
- Preview text loads asynchronously in FileItem
- Memoized computations for sorting and filtering
- Debounced vault change events (100ms)

### Memory Management
- Event delegation prevents listener leaks
- Cleanup functions in useEffect hooks
- WeakMap for drag-drop data storage
- Proper ref cleanup

### Large Vaults
- No virtualization yet (potential future enhancement)
- Folder counts update separately from tree renders
- Progressive preview loading
- Efficient Set operations for expanded folders

## Common Pitfalls & Solutions

### State Not Updating
```typescript
// ❌ Wrong - mutating state
appState.expandedFolders.add(folderPath);

// ✅ Correct - dispatch action
dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath });
```

### Effect Running Too Often
```typescript
// ❌ Wrong - object in dependency
useEffect(() => {}, [someObject]);

// ✅ Correct - specific properties
useEffect(() => {}, [someObject.id, someObject.name]);
```

### Memory Leaks
```typescript
// ❌ Wrong - no cleanup
useEffect(() => {
    const timer = setTimeout(...);
});

// ✅ Correct - cleanup function
useEffect(() => {
    const timer = setTimeout(...);
    return () => clearTimeout(timer);
});
```

### Context Menu Not Working
```typescript
// ❌ Wrong - creating ref in render
<div ref={useRef()}>

// ✅ Correct - stable ref
const ref = useRef();
<div ref={ref}>
```

### DOM Manipulation
```typescript
// ❌ Avoid - setTimeout for React synchronization
setTimeout(() => {
    document.querySelector('.item')?.scrollIntoView();
}, 100);

// ✅ Preferred - React lifecycle
useEffect(() => {
    if (condition && ref.current) {
        ref.current.scrollIntoView();
    }
}, [condition]);
```

**REMEMBER: Prefer React patterns, but prioritize performance and practicality when needed.**

## Build Process

### Development
```bash
npm run dev    # Start development build with watch mode
```

### Production
```bash
npm run build  # Create production build
```

The build process:
1. TypeScript compilation with strict mode
2. React JSX transformation
3. Bundle creation with esbuild
4. Output to `main.js` in project root
5. Sourcemap generation for debugging

### Version Management
```bash
npm run version   # Bump version in manifest.json and versions.json
```

## Mobile Support

### Mobile-Specific Features

1. **Single-Pane View**: On mobile devices, the navigator switches to a single-pane view that shows either the folder/tag list or the file list
2. **Swipe Gestures**: Edge swipe (from left edge) navigates back from files to folder list
3. **Mobile View States**: 
   - `list` - Shows folder tree and tag list
   - `files` - Shows file list for selected folder/tag
4. **No Drag & Drop**: Drag and drop is disabled on mobile for better touch interaction
5. **Responsive Layout**: Pane resizing is disabled, full width is used

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

