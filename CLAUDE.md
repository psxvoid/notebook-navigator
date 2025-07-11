## Project Summary

Notebook Navigator is an Obsidian plugin that replaces the default file explorer with a modern, Notes-style interface. It features a clean, two-pane layout with a folder and tag tree on the left and a virtualized file list on the right, similar to apps like Apple Notes.

## Core Features
- **Two-Pane Layout**: Resizable folder/tag tree on the left, virtualized file list on the right
- **Single-Pane Mode**: Optional for desktop/mobile, switches between navigation and file views
- **Mobile Support**: Touch-optimized with swipe gestures
- **Virtualized Lists**: High-performance rendering using TanStack Virtual
- **File Previews**: Stripped markdown previews and frontmatter feature images
- **Tag Browse**: Hierarchical tags (`#inbox/processing`) and untagged filtering
- **Keyboard Navigation**: Arrow keys, Tab, Enter, PageUp/PageDown
- **Multi-Selection**: Cmd/Ctrl+Click, Shift+Click, Shift+Arrows, Cmd/Ctrl+A
- **Drag & Drop**: Move files/folders with visual feedback (desktop only)
- **Context Menus**: Right-click with bulk operations support
- **Customization**: Custom folder icons/colors, per-folder sort, pinned notes
- **Auto-Reveal**: Automatically selects active file
- **i18n**: English, German, Spanish, French, Japanese, Chinese

## Quick Start
```bash
# Install
npm install --legacy-peer-deps

# Build (use this instead of npm run build)
./scripts/build.sh

# Development
npm run dev
```

**Key Files:**
- Entry: `src/main.ts` (plugin), `src/view/NotebookNavigatorView.tsx` (React mount)
- Main UI: `src/components/NotebookNavigatorComponent.tsx`
- Settings: `src/settings.ts`
- Types: `src/types.ts` (main), `src/types/*.ts` (specific domains)

## Architecture

### Directory Structure
```
src/
├── main.ts                    # Plugin entry, event handlers
├── settings.ts                # Settings interface & UI
├── types.ts                   # Core types & constants
├── components/                # React components
│   ├── NotebookNavigatorComponent.tsx    # Main two-pane layout
│   ├── NavigationPane.tsx     # Virtualized folder/tag tree
│   ├── FileList.tsx           # Virtualized file list
│   ├── [Item components...]   # FolderItem, FileItem, TagTreeItem, etc.
├── context/                   # State management
├── hooks/                     # Custom React hooks
├── services/                  # Business logic
│   ├── FileSystemService.ts   # File/folder CRUD
│   ├── MetadataService.ts     # Folder metadata management
│   └── metadata/              # Modular metadata services
├── utils/                     # Utility functions
├── modals/                    # Obsidian modal dialogs
└── i18n/                      # Translations
```

### Key Architectural Patterns

**Event-Based UI Sync**: React UI updates when external changes occur:
1. Vault event → `main.ts` handler → MetadataService update
2. MetadataService saves → notifies listeners
3. SettingsProvider increments version → React re-renders

**Performance Optimizations**:
- **Promise Queue**: MetadataService serializes updates to prevent race conditions
- **Tag Cache**: Stores tags in localStorage for instant startup, diffs in background
- **Deferred Init**: Uses `requestIdleCallback` for non-critical operations
- **Mobile Scroll**: Preserves momentum during virtualization

### State Management

| Context | Purpose | Key State |
|---------|---------|-----------|
| **SettingsContext** | Global settings with version tracking | Plugin settings, version counter |
| **SelectionContext** | File/folder selection & navigation | selectedFolder, selectedFiles Set, cursor position |
| **ExpansionContext** | Tree expansion state | expandedFolders/Tags Sets |
| **UIStateContext** | UI behavior | focusedPane, paneWidth, singlePaneView |
| **TagCacheContext** | Tag tree performance | Cached tag data, loading states |
| **ServicesContext** | Dependency injection | FileSystemService, MetadataService |

### localStorage Keys
Always use `STORAGE_KEYS` from `src/types.ts`:
```typescript
import { STORAGE_KEYS } from '../types';
localStorage.setItem(STORAGE_KEYS.tagCacheKey, data);
```

## Key Development Patterns

### Type Safety
**No `any`/`unknown` allowed**. Use:
- Type guards: `isTFile(obj)` instead of `obj as TFile`
- Specific event types: `(e: MouseEvent)` not `(e: any)`
- Discriminated unions for complex types
- `Record<string, T>` for object maps

### Obsidian Plugin Requirements
```typescript
// ❌ BAD - Will fail review
const file = item.data as TFile;              // No type assertions
await app.vault.delete(file);                 // Use trashFile
element.style.backgroundColor = '#dc3545';    // No inline styles

// ✅ GOOD
if (isTFile(item.data)) { /* use item.data */ }
await app.fileManager.trashFile(file);
element.className = 'nn-drag-count-badge';
```

**Style Requirements**:
- All styles in `styles.css` with `nn-` prefix
- Use Obsidian CSS variables
- Inline styles only for dynamic values (transforms, user colors)

**UI Text**: Use sentence case ("Copy image" not "Copy Image")

### Multi-Selection
- `selectedFiles`: Set of selected files
- `selectedFile`: Cursor position for keyboard nav
- Actions: `TOGGLE_FILE_SELECTION`, `TOGGLE_WITH_CURSOR`, `CLEAR_FILE_SELECTION`

## Common Tasks

**Add Setting**: Update `NotebookNavigatorSettings`, `DEFAULT_SETTINGS`, `NotebookNavigatorSettingTab`, use via `useSettingsState()`

**Add Keyboard Shortcut**: Update `useVirtualKeyboardNavigation.ts`

**Add Context Menu**: Edit appropriate builder in `src/utils/contextMenu/`

**Change State**: Use correct context, dispatch action

## Important Instructions
- DO NOT create documentation files unless explicitly requested
- ALWAYS prefer editing existing files over creating new ones
- NEVER use `any` or `unknown` types
- ALWAYS use type guards for Obsidian types
- ALWAYS use `fileManager.trashFile()` not `vault.delete()`
- ALWAYS define styles in CSS, not inline
- ALWAYS use sentence case for UI text
- NEVER assume a problem is fixed unless user has tested that it works
- NEVER add comments to code describing the change you did