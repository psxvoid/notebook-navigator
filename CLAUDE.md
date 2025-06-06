# Notebook Navigator - AI Assistant Guide

## Project Summary
Notebook Navigator is an Obsidian plugin that replaces the default file explorer with a Notes-style interface. It provides a clean, two-pane layout with a folder tree on the left and a file list on the right, mimicking the UI/UX patterns found in modern note-taking applications. The plugin has been completely refactored to use React for better performance and maintainability.

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

### Why React?
The plugin was completely refactored from vanilla JavaScript to React for several key benefits:

1. **Performance**: React's virtual DOM and efficient diffing algorithm provide smooth updates even with large vaults
2. **Maintainability**: Component-based architecture makes the codebase modular and easy to extend
3. **State Management**: Centralized state with Context API eliminates prop drilling and makes state predictable
4. **Type Safety**: Full TypeScript integration with strict mode catches errors at compile time
5. **Memory Management**: Automatic cleanup of event listeners and subscriptions prevents memory leaks
6. **Developer Experience**: Hot module reloading, React DevTools, and clear component hierarchy

The refactor maintains 100% feature parity while significantly improving code quality and performance.

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

#### useKeyboardNavigation
Handles all keyboard shortcuts:
- Arrow keys for navigation
- Tab to switch panes
- Enter to open files/toggle folders
- Delete/Backspace to delete items
- Debounced to prevent rapid key spam

#### useContextMenu
Attaches right-click context menus to elements:
- Folder menus: New note/folder/canvas, rename, delete, etc.
- File menus: Open options, pin/unpin, rename, delete, etc.
- Uses Obsidian's Menu API

#### useDragAndDrop
Manages drag and drop operations:
- Visual feedback with CSS classes
- Validation to prevent invalid moves
- Works with both files and folders
- Updates file system on drop

#### useScrollIntoView
Smart scroll positioning for active items:
- Centers selected items in view
- Uses double requestAnimationFrame for proper timing
- Manual scroll calculation for reliability
- Smooth scrolling behavior
- Prevents unnecessary scrolls when item is already visible

## Code Style & Patterns

### CRITICAL: React Patterns - NO setTimeout/DOM Manipulation

**NEVER use setTimeout, setInterval, or direct DOM manipulation in React components.**

❌ **WRONG - Never do this:**
```typescript
// NEVER use setTimeout to wait for React updates
setTimeout(() => {
    const element = document.querySelector('.some-class');
    element?.scrollIntoView();
}, 100);

// NEVER query DOM directly
const fileElement = document.querySelector(`[data-path="${path}"]`);

// NEVER manipulate DOM directly
element.classList.add('active');
```

✅ **CORRECT - Always use React patterns:**
```typescript
// Use useEffect to respond to state changes
useEffect(() => {
    if (isSelected && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth' });
    }
}, [isSelected]);

// Use state and props for conditional rendering
<div className={`item ${isActive ? 'active' : ''}`}>

// Use refs for DOM access when needed
const ref = useRef<HTMLDivElement>(null);
```

**Why this matters:**
1. React controls the DOM - direct manipulation breaks React's virtual DOM
2. setTimeout creates race conditions with React's render cycle
3. React's lifecycle methods guarantee proper timing
4. Direct DOM queries are fragile and break when components re-render

**ALWAYS use React patterns:**
- `useEffect` for side effects
- `useState` for local state
- `useRef` for DOM element references
- `useMemo`/`useCallback` for optimization
- Conditional rendering for dynamic UI

### React Best Practices

#### Component Structure
```typescript
// 1. Imports (React first, then Obsidian, then local)
import React, { useState, useCallback } from 'react';
import { TFile } from 'obsidian';
import { useAppContext } from '../context/AppContext';

// 2. TypeScript interfaces
interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    onClick: () => void;
}

// 3. Component with explicit return type
export function FileItem({ file, isSelected, onClick }: FileItemProps) {
    // 4. Hooks at the top
    const { app } = useAppContext();
    const [loading, setLoading] = useState(false);
    
    // 5. Callbacks with proper dependencies
    const handleClick = useCallback(() => {
        onClick();
    }, [onClick]);
    
    // 6. Render
    return (
        <div className="file-item" onClick={handleClick}>
            {file.basename}
        </div>
    );
}
```

#### Hook Dependencies
Always include all dependencies in hook arrays:
```typescript
// ✅ Good
useEffect(() => {
    doSomething(file.path);
}, [file.path]); // Specific property

// ❌ Bad
useEffect(() => {
    doSomething(file.path);
}, [file]); // Entire object causes unnecessary re-renders
```

#### Performance Optimizations
1. Use `useMemo` for expensive computations:
```typescript
const sortedFiles = useMemo(() => {
    return files.sort((a, b) => b.stat.mtime - a.stat.mtime);
}, [files]);
```

2. Use `useCallback` for functions passed as props:
```typescript
const handleClick = useCallback(() => {
    dispatch({ type: 'SELECT_FILE', file });
}, [dispatch, file]);
```

3. Use `useLayoutEffect` for DOM measurements to prevent flicker:
```typescript
useLayoutEffect(() => {
    const firstItem = document.querySelector('.nn-file-item');
    if (firstItem) {
        // Synchronous DOM updates before paint
    }
}, [folder]);
```

### TypeScript Patterns

#### Type Guards
Use type guards for Obsidian's abstract types:
```typescript
// In utils/typeGuards.ts
export function isTFile(file: TAbstractFile): file is TFile {
    return 'extension' in file;
}

export function isTFolder(file: TAbstractFile): file is TFolder {
    return 'children' in file;
}
```

#### Strict Null Checks
Always handle null/undefined:
```typescript
// ✅ Good
const fileName = file?.basename ?? 'Untitled';

// ❌ Bad
const fileName = file.basename; // Could crash
```

### Event Handling

#### Event Delegation
Use event delegation for dynamic lists to prevent memory leaks:
```typescript
// In parent component
<div onClick={handleContainerClick}>
    {items.map(item => (
        <div key={item.id} data-id={item.id}>
            {item.name}
        </div>
    ))}
</div>

// Handler
const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const id = target.closest('[data-id]')?.getAttribute('data-id');
    if (id) {
        handleItemClick(id);
    }
};
```

#### Keyboard Events
Prevent default browser behavior:
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault(); // Prevent page scroll
        navigateDown();
    }
};
```

### CSS Classes & Styling

#### BEM-like Naming
Use consistent class naming:
```css
.nn-folder-tree {}           /* Block */
.nn-folder-item {}           /* Element */
.nn-folder-item--expanded {} /* Modifier */
.nn-selected {}              /* State */
```

#### CSS Variables
Use CSS variables for theming:
```css
.notebook-navigator {
    --nn-selection-color: var(--interactive-accent);
    --nn-hover-color: var(--background-modifier-hover);
}
```

## Common Development Tasks

### Adding a New Setting
1. Add to `NotebookNavigatorSettings` interface in `settings.ts`
2. Add default value to `DEFAULT_SETTINGS`
3. Add UI control in `NotebookNavigatorSettingTab.display()`
4. Use setting in relevant component via `plugin.settings.yourSetting`

### Adding a New Keyboard Shortcut
1. Add case to switch statement in `useKeyboardNavigation` hook
2. Prevent default if needed with `e.preventDefault()`
3. Dispatch appropriate action or call service method
4. Update this documentation

### Adding a New Context Menu Item
1. Locate the appropriate menu builder in `useContextMenu`
2. Add new menu item with `menu.addItem()`
3. Implement handler function
4. Consider adding to FileSystemService if it's a file operation

### Creating a New Component
1. Create file in `src/components/`
2. Define TypeScript interface for props
3. Export named function (not default)
4. Use hooks for state and context access
5. Add to component hierarchy documentation

### Adding a New Global State Property
1. Add to `AppState` interface in `AppContext.tsx`
2. Add initial value in `loadStateFromStorage()`
3. Add new action type to `AppAction` union
4. Implement reducer case
5. Add localStorage persistence if needed

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

### DOM Manipulation (NEVER DO THIS)
```typescript
// ❌ Wrong - setTimeout and DOM queries
setTimeout(() => {
    document.querySelector('.item')?.scrollIntoView();
}, 100);

// ✅ Correct - React lifecycle
useEffect(() => {
    if (condition && ref.current) {
        ref.current.scrollIntoView();
    }
}, [condition]);
```

**REMEMBER: React owns the DOM. Use React patterns ONLY.**

## Debugging Tips

### React DevTools
1. Install React Developer Tools browser extension
2. Look for "Notebook Navigator" in Components tab
3. Check props and state values
4. Use Profiler to find performance issues

### Console Logging
```typescript
// Temporary debug logging
console.log('[NN]', 'FolderTree render', { 
    selectedFolder: appState.selectedFolder?.path,
    expandedCount: appState.expandedFolders.size 
});
```

### State Inspection
```typescript
// In browser console
localStorage.getItem('notebook-navigator-expanded-folders')
```

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
4. Test with both light and dark themes
5. Ensure mobile compatibility
6. Update this documentation for significant changes