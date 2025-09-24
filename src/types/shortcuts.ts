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

import type { SearchProvider } from './search';

/**
 * Enum-like object defining all supported shortcut types
 */
export const ShortcutType = {
    FOLDER: 'folder',
    NOTE: 'note',
    SEARCH: 'search',
    TAG: 'tag'
} as const;

export type ShortcutType = (typeof ShortcutType)[keyof typeof ShortcutType];

/**
 * Common properties shared by all shortcut types
 */
interface ShortcutBase {
    id: string;
    type: ShortcutType;
    order: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * Shortcut pointing to a folder in the vault
 */
export interface FolderShortcut extends ShortcutBase {
    type: typeof ShortcutType.FOLDER;
    path: string;
}

/**
 * Shortcut pointing to a specific note file
 */
export interface NoteShortcut extends ShortcutBase {
    type: typeof ShortcutType.NOTE;
    path: string;
}

/**
 * Shortcut referencing a saved search query
 */
export interface SearchShortcut extends ShortcutBase {
    type: typeof ShortcutType.SEARCH;
    savedSearchId: string;
}

/**
 * Shortcut pointing to a tag
 */
export interface TagShortcut extends ShortcutBase {
    type: typeof ShortcutType.TAG;
    tagPath: string;
}

export type ShortcutEntry = FolderShortcut | NoteShortcut | SearchShortcut | TagShortcut;

/**
 * Represents a saved search query with metadata
 */
export interface SavedSearch {
    id: string;
    name: string;
    query: string;
    provider: SearchProvider;
    createdAt: number;
    updatedAt: number;
}

/**
 * Type guard to check if a shortcut is a folder shortcut
 */
export function isFolderShortcut(shortcut: ShortcutEntry): shortcut is FolderShortcut {
    return shortcut.type === ShortcutType.FOLDER;
}

/**
 * Type guard to check if a shortcut is a note shortcut
 */
export function isNoteShortcut(shortcut: ShortcutEntry): shortcut is NoteShortcut {
    return shortcut.type === ShortcutType.NOTE;
}

/**
 * Type guard to check if a shortcut is a search shortcut
 */
export function isSearchShortcut(shortcut: ShortcutEntry): shortcut is SearchShortcut {
    return shortcut.type === ShortcutType.SEARCH;
}

/**
 * Type guard to check if a shortcut is a tag shortcut
 */
export function isTagShortcut(shortcut: ShortcutEntry): shortcut is TagShortcut {
    return shortcut.type === ShortcutType.TAG;
}
