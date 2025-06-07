# Notebook Navigator - AI Assistant Guide

## Project Summary
Notebook Navigator is an Obsidian plugin that replaces the default file explorer with a Notes-style interface. It provides a clean, two-pane layout with a folder tree on the left and a file list on the right, mimicking the UI/UX patterns found in modern note-taking applications.

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
│   │   └── PaneHeader.tsx        # Header with actions
│   ├── context/                   # React Context providers
│   │   ├── AppContext.tsx        # Global app state
│   │   └── ServicesContext.tsx   # Service injection
│   ├── hooks/                     # Custom React hooks
│   │   ├── useKeyboardNavigation.ts  # Keyboard shortcuts
│   │   ├── useContextMenu.ts     # Right-click menus
│   │   ├── useDragAndDrop.ts    # Drag & drop logic
│   │   └── useScrollIntoView.ts  # Smart scroll positioning
│   ├── services/                  # Business logic services
│   │   └── FileSystemService.ts  # File operations
│   ├── modals/                    # Obsidian modal dialogs
│   │   ├── ConfirmModal.ts       # Delete confirmation
│   │   ├── InputModal.ts         # Text input dialog
│   │   └── IconPickerModal.ts    # Folder icon picker
│   └── utils/                     # Utility functions
│       ├── DateUtils.ts          # Date formatting
│       ├── PreviewTextUtils.ts   # File preview extraction
│       ├── typeGuards.ts         # TypeScript type guards
│       └── fileFilters.ts        # File filtering utilities
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
                ├── PaneHeader
                ├── FolderTree
                │   └── FolderItem (recursive)
                └── FileList
                    └── FileItem (multiple)
```

### State Management

#### Global State (AppContext)
```typescript
interface AppState {
    selectedFolder: TFolder | null;      // Currently selected folder
    selectedFile: TFile | null;          // Currently selected file
    expandedFolders: Set<string>;        // Set of expanded folder paths
    focusedPane: 'folders' | 'files';   // Which pane has keyboard focus
}
```

State is managed through React's useReducer hook with these actions:
- `SET_SELECTED_FOLDER` - Change active folder
- `SET_SELECTED_FILE` - Change active file
- `SET_EXPANDED_FOLDERS` - Replace all expanded folders
- `TOGGLE_FOLDER_EXPANDED` - Toggle single folder
- `SET_FOCUSED_PANE` - Switch keyboard focus
- `EXPAND_FOLDERS` - Expand multiple folders
- `REVEAL_FILE` - Reveal file in tree
- `CLEANUP_DELETED_ITEMS` - Remove deleted items
- `FORCE_REFRESH` - Force component re-render

#### Local Storage Persistence
State is automatically persisted to localStorage:
- `notebook-navigator-expanded-folders` - Array of expanded folder paths
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

#### ServicesContext
Provides service instances through custom hooks:
- `useFileSystemOps()` - File system operations service

### Custom Hooks

- **useKeyboardNavigation**: Arrow keys, Tab, Enter, Delete with debouncing
- **useContextMenu**: Right-click menus using Obsidian's Menu API
- **useDragAndDrop**: Drag-and-drop with validation and visual feedback  
- **useScrollIntoView**: Smart scrolling that centers selected items
- **useResizablePane**: Handles pane resizing with min/max constraints

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

## Common Development Tasks

- **New Setting**: Add to interface → DEFAULT_SETTINGS → Settings tab UI → Use in component
- **New Keyboard Shortcut**: Add case in `useKeyboardNavigation` → preventDefault → Dispatch action
- **New Context Menu**: Find menu builder in `useContextMenu` → Add menu item → Implement handler
- **New Component**: Create in `src/components/` → Named export → TypeScript props interface
- **New Global State**: Add to AppState → Add action type → Implement reducer case → Add persistence

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

## Testing Checklist
When making changes, test:
- [ ] Keyboard navigation (arrows, Tab, Enter, Delete)
- [ ] Mouse interactions (click, double-click, right-click)
- [ ] Drag and drop (files to folders, folders to folders)
- [ ] File operations (create, rename, delete)
- [ ] Settings changes take effect immediately
- [ ] State persists across plugin reload
- [ ] No console errors or warnings
- [ ] Performance with large folders (100+ files)
- [ ] Theme compatibility (light/dark)
- [ ] Mobile/tablet if applicable

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

## Debugging Tips

- **React DevTools**: Use Components tab to inspect state and props
- **Console Logging**: Prefix with `[NN]` for easy filtering
- **State Inspection**: Check localStorage keys for persisted state
- **Performance**: Use React Profiler to identify render bottlenecks

## Future Enhancement Ideas
- Virtual scrolling for large file lists
- Folder icons customization (UI exists, needs implementation)
- Bulk file operations
- Search within navigator
- Tag-based filtering
- Custom sort orders
- Folder templates
- Keyboard shortcut customization

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

## Contributing Guidelines
1. Follow existing code patterns
2. Add TypeScript types for all parameters
3. Include JSDoc comments for public APIs
4. Document any non-standard patterns with clear rationale
5. Test with both light and dark themes
6. Ensure mobile compatibility
7. Consider performance implications for large vaults
8. Update this documentation for significant changes