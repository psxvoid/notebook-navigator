/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Public API exports for Notebook Navigator
 *
 * Usage in TypeScript:
 * ```typescript
 * import type { NotebookNavigatorAPI, SelectionState } from 'notebook-navigator/api';
 *
 * const nn = (app as any).plugins.plugins['notebook-navigator']?.api as NotebookNavigatorAPI;
 * if (nn) {
 *   const selection = nn.selection.getSelection();
 *   await nn.navigation.navigateToFolder('/path/to/folder');
 * }
 * ```
 */

// Main API class
export { NotebookNavigatorAPI } from './NotebookNavigatorAPI';

// Sub-API classes (for advanced usage)
export { NavigationAPI } from './modules/NavigationAPI';
export { SelectionAPI } from './modules/SelectionAPI';
export { MetadataAPI } from './modules/MetadataAPI';
export { TagAPI } from './modules/TagAPI';
export { StorageAPI } from './modules/StorageAPI';
export { ViewAPI } from './modules/ViewAPI';

// Type exports
export type {
    NavigationResult,
    SelectionState,
    CachedFileData,
    FolderMetadata,
    TagMetadata,
    NotebookNavigatorEventType,
    NotebookNavigatorEvents,
    FileQueryOptions,
    BatchOperationResult,
    ViewState
} from './types';
