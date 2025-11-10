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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TAbstractFile, TFile, TFolder } from 'obsidian';
import { useSettingsState, useSettingsUpdate } from './SettingsContext';
import { useServices } from './ServicesContext';
import {
    ShortcutEntry,
    ShortcutType,
    SearchShortcut,
    getShortcutKey,
    isFolderShortcut,
    isNoteShortcut,
    isSearchShortcut,
    isTagShortcut
} from '../types/shortcuts';
import type { SearchProvider } from '../types/search';
import { strings } from '../i18n';
import { showNotice } from '../utils/noticeUtils';
import { normalizeTagPath } from '../utils/tagUtils';
import { runAsyncAction } from '../utils/async';

/**
 * Represents a shortcut with resolved file/folder references and validation state.
 * Hydrated shortcuts have their paths resolved to actual Obsidian file objects.
 */
interface HydratedShortcut {
    key: string;
    shortcut: ShortcutEntry;
    folder: TFolder | null;
    note: TFile | null;
    search: SearchShortcut | null;
    tagPath: string | null;
    isMissing: boolean;
}

/**
 * Context value providing shortcut management functionality and state
 */
export interface ShortcutsContextValue {
    shortcuts: ShortcutEntry[];
    hydratedShortcuts: HydratedShortcut[];
    shortcutMap: Map<string, ShortcutEntry>;
    folderShortcutKeysByPath: Map<string, string>;
    noteShortcutKeysByPath: Map<string, string>;
    tagShortcutKeysByPath: Map<string, string>;
    searchShortcutsByName: Map<string, SearchShortcut>;
    addFolderShortcut: (path: string, options?: { index?: number }) => Promise<boolean>;
    addNoteShortcut: (path: string, options?: { index?: number }) => Promise<boolean>;
    addTagShortcut: (tagPath: string, options?: { index?: number }) => Promise<boolean>;
    addSearchShortcut: (input: { name: string; query: string; provider: SearchProvider }, options?: { index?: number }) => Promise<boolean>;
    addShortcutsBatch: (entries: ShortcutEntry[], options?: { index?: number }) => Promise<number>;
    removeShortcut: (key: string) => Promise<boolean>;
    removeSearchShortcut: (name: string) => Promise<boolean>;
    reorderShortcuts: (orderedKeys: string[]) => Promise<boolean>;
    hasFolderShortcut: (path: string) => boolean;
    hasNoteShortcut: (path: string) => boolean;
    hasTagShortcut: (tagPath: string) => boolean;
    findSearchShortcut: (name: string) => SearchShortcut | undefined;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

// Type guard to check if an abstract file is a folder
function isFolder(file: TAbstractFile | null): file is TFolder {
    return file instanceof TFolder;
}

// Type guard to check if an abstract file is a file
function isFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile;
}

interface ShortcutsProviderProps {
    children: React.ReactNode;
}

/**
 * Provider component that manages shortcuts state and operations.
 * Handles adding, removing, reordering shortcuts and maintains lookup maps for fast access.
 */
export function ShortcutsProvider({ children }: ShortcutsProviderProps) {
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const { app } = useServices();
    const [vaultChangeVersion, setVaultChangeVersion] = useState(0);

    // Extracts shortcuts array from settings with fallback to empty array
    const rawShortcuts = useMemo(() => settings.shortcuts ?? [], [settings.shortcuts]);

    // TODO: remove migration once tag shortcuts are normalized across active installs
    // Normalize stored tag shortcut paths for consistent lookups
    useEffect(() => {
        const requiresNormalization = rawShortcuts.some(shortcut => {
            if (!isTagShortcut(shortcut)) {
                return false;
            }
            const normalized = normalizeTagPath(shortcut.tagPath);
            return normalized !== null && normalized !== shortcut.tagPath;
        });

        if (!requiresNormalization) {
            return;
        }

        runAsyncAction(async () => {
            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                current.shortcuts = existing.map(entry => {
                    if (isTagShortcut(entry)) {
                        const normalized = normalizeTagPath(entry.tagPath);
                        if (!normalized) {
                            return entry;
                        }
                        return {
                            ...entry,
                            tagPath: normalized
                        };
                    }
                    return entry;
                });
            });
        });
    }, [rawShortcuts, updateSettings]);

    // Creates map of shortcuts by their unique keys for O(1) lookup
    const shortcutMap = useMemo(() => {
        const map = new Map<string, ShortcutEntry>();
        rawShortcuts.forEach(shortcut => {
            map.set(getShortcutKey(shortcut), shortcut);
        });
        return map;
    }, [rawShortcuts]);

    // Maps folder paths to their shortcut keys for duplicate detection
    const folderShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isFolderShortcut(shortcut)) {
                map.set(shortcut.path, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    // Maps note paths to their shortcut keys for duplicate detection
    const noteShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isNoteShortcut(shortcut)) {
                map.set(shortcut.path, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    // Maps tag paths to their shortcut keys for duplicate detection
    const tagShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isTagShortcut(shortcut)) {
                const normalized = normalizeTagPath(shortcut.tagPath);
                if (normalized) {
                    map.set(normalized, getShortcutKey(shortcut));
                }
            }
        });
        return map;
    }, [rawShortcuts]);

    // Maps search shortcut names (lowercase) to shortcuts for fast lookup
    const searchShortcutsByName = useMemo(() => {
        const map = new Map<string, SearchShortcut>();
        rawShortcuts.forEach(shortcut => {
            if (isSearchShortcut(shortcut)) {
                map.set(shortcut.name.toLowerCase(), shortcut);
            }
        });
        return map;
    }, [rawShortcuts]);

    // Monitors vault changes for shortcut target files to trigger re-hydration when they are created/deleted/renamed
    useEffect(() => {
        const folderPaths = new Map(folderShortcutKeysByPath);
        const notePaths = new Map(noteShortcutKeysByPath);

        if (folderPaths.size === 0 && notePaths.size === 0) {
            return;
        }

        const vault = app.vault;

        const handleCreate = (file: TAbstractFile) => {
            if (!isFolder(file) && !isFile(file)) {
                return;
            }
            if (folderPaths.has(file.path) || notePaths.has(file.path)) {
                setVaultChangeVersion(value => value + 1);
            }
        };

        const handleDelete = (file: TAbstractFile) => {
            if (!isFolder(file) && !isFile(file)) {
                return;
            }
            if (folderPaths.has(file.path) || notePaths.has(file.path)) {
                setVaultChangeVersion(value => value + 1);
            }
        };

        const handleRename = (file: TAbstractFile, oldPath: string) => {
            if (!isFolder(file) && !isFile(file)) {
                return;
            }
            if (folderPaths.has(oldPath) || notePaths.has(oldPath) || folderPaths.has(file.path) || notePaths.has(file.path)) {
                setVaultChangeVersion(value => value + 1);
            }
        };

        const createRef = vault.on('create', handleCreate);
        const deleteRef = vault.on('delete', handleDelete);
        const renameRef = vault.on('rename', (file, oldPath) => {
            handleRename(file, oldPath);
        });

        return () => {
            vault.offref(createRef);
            vault.offref(deleteRef);
            vault.offref(renameRef);
        };
    }, [app.vault, folderShortcutKeysByPath, noteShortcutKeysByPath]);

    const hydratedShortcuts = useMemo<HydratedShortcut[]>(() => {
        void vaultChangeVersion; // Ensures memo recalculates after vault changes
        return rawShortcuts.map(shortcut => {
            const key = getShortcutKey(shortcut);

            if (isFolderShortcut(shortcut)) {
                const target = shortcut.path === '/' ? app.vault.getRoot() : app.vault.getAbstractFileByPath(shortcut.path);
                if (isFolder(target)) {
                    return {
                        key,
                        shortcut,
                        folder: target,
                        note: null,
                        search: null,
                        tagPath: null,
                        isMissing: false
                    };
                }
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: null,
                    isMissing: true
                };
            }

            if (isNoteShortcut(shortcut)) {
                const target = app.vault.getAbstractFileByPath(shortcut.path);
                if (isFile(target)) {
                    return {
                        key,
                        shortcut,
                        folder: null,
                        note: target,
                        search: null,
                        tagPath: null,
                        isMissing: false
                    };
                }
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: null,
                    isMissing: true
                };
            }

            if (isTagShortcut(shortcut)) {
                const normalizedTagPath = normalizeTagPath(shortcut.tagPath);
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: normalizedTagPath ?? shortcut.tagPath,
                    isMissing: !normalizedTagPath
                };
            }

            // Search shortcut
            return {
                key,
                shortcut,
                folder: null,
                note: null,
                search: shortcut,
                tagPath: null,
                isMissing: false
            };
        });
    }, [app.vault, rawShortcuts, vaultChangeVersion]);

    // Inserts a shortcut at the specified index or appends to the end
    const insertShortcut = useCallback(
        async (shortcut: ShortcutEntry, index?: number) => {
            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                const next = [...existing];
                const insertAt = typeof index === 'number' ? Math.max(0, Math.min(index, next.length)) : next.length;
                next.splice(insertAt, 0, shortcut);
                current.shortcuts = next;
            });
            return true;
        },
        [updateSettings]
    );

    // Adds multiple shortcuts, validating each type and showing notices for duplicates or invalid entries
    const addShortcutsBatch = useCallback(
        async (entries: ShortcutEntry[], options?: { index?: number }) => {
            if (entries.length === 0) {
                return 0;
            }

            // Create sets of existing paths/names for O(1) duplicate checking
            const folderPaths = new Set(folderShortcutKeysByPath.keys());
            const notePaths = new Set(noteShortcutKeysByPath.keys());
            const tagPaths = new Set(tagShortcutKeysByPath.keys());
            const searchNames = new Set(searchShortcutsByName.keys());

            // Track validation errors to show notices after processing all entries
            let duplicateFolder = false;
            let duplicateNote = false;
            let duplicateTag = false;
            let invalidTag = false;
            let duplicateSearch = false;
            let emptySearchName = false;
            let emptySearchQuery = false;

            // Validate and normalize each entry, tracking errors
            const normalizedEntries: ShortcutEntry[] = [];
            entries.forEach(entry => {
                if (entry.type === ShortcutType.FOLDER) {
                    if (folderPaths.has(entry.path)) {
                        duplicateFolder = true;
                        return;
                    }
                    folderPaths.add(entry.path);
                    normalizedEntries.push(entry);
                    return;
                }

                if (entry.type === ShortcutType.NOTE) {
                    if (notePaths.has(entry.path)) {
                        duplicateNote = true;
                        return;
                    }
                    notePaths.add(entry.path);
                    normalizedEntries.push(entry);
                    return;
                }

                if (entry.type === ShortcutType.TAG) {
                    const normalizedPath = normalizeTagPath(entry.tagPath);
                    if (!normalizedPath) {
                        invalidTag = true;
                        return;
                    }
                    if (tagPaths.has(normalizedPath)) {
                        duplicateTag = true;
                        return;
                    }
                    tagPaths.add(normalizedPath);
                    normalizedEntries.push({
                        ...entry,
                        tagPath: normalizedPath
                    });
                    return;
                }

                if (entry.type === ShortcutType.SEARCH) {
                    const normalizedName = entry.name.trim();
                    const normalizedQuery = entry.query.trim();
                    if (!normalizedName) {
                        emptySearchName = true;
                        return;
                    }
                    if (!normalizedQuery) {
                        emptySearchQuery = true;
                        return;
                    }
                    const lookupKey = normalizedName.toLowerCase();
                    if (searchNames.has(lookupKey)) {
                        duplicateSearch = true;
                        return;
                    }
                    searchNames.add(lookupKey);
                    normalizedEntries.push({
                        ...entry,
                        name: normalizedName,
                        query: normalizedQuery
                    });
                }
            });

            // Show notices for any validation errors found
            if (duplicateFolder) {
                showNotice(strings.shortcuts.folderExists, { variant: 'warning' });
            }
            if (duplicateNote) {
                showNotice(strings.shortcuts.noteExists, { variant: 'warning' });
            }
            if (duplicateTag) {
                showNotice(strings.shortcuts.tagExists, { variant: 'warning' });
            }
            if (invalidTag) {
                showNotice(strings.modals.tagOperation.invalidTagName, { variant: 'warning' });
            }
            if (duplicateSearch) {
                showNotice(strings.shortcuts.searchExists, { variant: 'warning' });
            }
            if (emptySearchName) {
                showNotice(strings.shortcuts.emptySearchName, { variant: 'warning' });
            }
            if (emptySearchQuery) {
                showNotice(strings.shortcuts.emptySearchQuery, { variant: 'warning' });
            }

            if (normalizedEntries.length === 0) {
                return 0;
            }

            // Insert normalized entries at specified index, shifting subsequent items
            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                const next = [...existing];
                let insertAt = typeof options?.index === 'number' ? Math.max(0, Math.min(options.index, next.length)) : next.length;

                normalizedEntries.forEach(entry => {
                    next.splice(insertAt, 0, entry);
                    insertAt += 1;
                });

                current.shortcuts = next;
            });

            return normalizedEntries.length;
        },
        [folderShortcutKeysByPath, noteShortcutKeysByPath, tagShortcutKeysByPath, searchShortcutsByName, updateSettings]
    );

    // Adds a folder shortcut if it doesn't already exist
    const addFolderShortcut = useCallback(
        async (path: string, options?: { index?: number }) => {
            if (folderShortcutKeysByPath.has(path)) {
                showNotice(strings.shortcuts.folderExists, { variant: 'warning' });
                return false;
            }
            return insertShortcut({ type: ShortcutType.FOLDER, path }, options?.index);
        },
        [insertShortcut, folderShortcutKeysByPath]
    );

    // Adds a note shortcut if it doesn't already exist
    const addNoteShortcut = useCallback(
        async (path: string, options?: { index?: number }) => {
            if (noteShortcutKeysByPath.has(path)) {
                showNotice(strings.shortcuts.noteExists, { variant: 'warning' });
                return false;
            }
            return insertShortcut({ type: ShortcutType.NOTE, path }, options?.index);
        },
        [insertShortcut, noteShortcutKeysByPath]
    );

    // Adds a tag shortcut if it doesn't already exist
    const addTagShortcut = useCallback(
        async (tagPath: string, options?: { index?: number }) => {
            const normalizedPath = normalizeTagPath(tagPath);
            if (!normalizedPath) {
                return false;
            }
            if (tagShortcutKeysByPath.has(normalizedPath)) {
                showNotice(strings.shortcuts.tagExists, { variant: 'warning' });
                return false;
            }
            return insertShortcut({ type: ShortcutType.TAG, tagPath: normalizedPath }, options?.index);
        },
        [insertShortcut, tagShortcutKeysByPath]
    );

    // Adds a search shortcut with validation for name and query uniqueness
    const addSearchShortcut = useCallback(
        async ({ name, query, provider }: { name: string; query: string; provider: SearchProvider }, options?: { index?: number }) => {
            const normalizedQuery = query.trim();
            if (!normalizedQuery) {
                showNotice(strings.shortcuts.emptySearchQuery, { variant: 'warning' });
                return false;
            }

            const normalizedName = name.trim();
            if (!normalizedName) {
                showNotice(strings.shortcuts.emptySearchName, { variant: 'warning' });
                return false;
            }

            const nameKey = normalizedName.toLowerCase();
            if (searchShortcutsByName.has(nameKey)) {
                showNotice(strings.shortcuts.searchExists, { variant: 'warning' });
                return false;
            }

            return insertShortcut(
                {
                    type: ShortcutType.SEARCH,
                    name: normalizedName,
                    query: normalizedQuery,
                    provider
                },
                options?.index
            );
        },
        [insertShortcut, searchShortcutsByName]
    );

    // Removes a shortcut by its unique key
    const removeShortcut = useCallback(
        async (key: string) => {
            if (!shortcutMap.has(key)) {
                return false;
            }

            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                current.shortcuts = existing.filter(entry => getShortcutKey(entry) !== key);
            });

            return true;
        },
        [shortcutMap, updateSettings]
    );

    // Removes a search shortcut by its name (case-insensitive)
    const removeSearchShortcut = useCallback(
        async (name: string) => {
            const shortcut = searchShortcutsByName.get(name.trim().toLowerCase());
            if (!shortcut) {
                return false;
            }

            return removeShortcut(getShortcutKey(shortcut));
        },
        [removeShortcut, searchShortcutsByName]
    );

    // Reorders shortcuts based on provided key order (for drag & drop functionality)
    // Validates that all keys are present before applying the new order
    const reorderShortcuts = useCallback(
        async (orderedKeys: string[]) => {
            if (orderedKeys.length !== rawShortcuts.length) {
                return false;
            }

            const orderedEntries: ShortcutEntry[] = [];
            for (const key of orderedKeys) {
                const entry = shortcutMap.get(key);
                if (!entry) {
                    return false;
                }
                orderedEntries.push(entry);
            }

            await updateSettings(current => {
                current.shortcuts = orderedEntries;
            });

            return true;
        },
        [rawShortcuts.length, shortcutMap, updateSettings]
    );

    // Checks if a folder shortcut exists for the given path
    const hasFolderShortcut = useCallback((path: string) => folderShortcutKeysByPath.has(path), [folderShortcutKeysByPath]);
    // Checks if a note shortcut exists for the given path
    const hasNoteShortcut = useCallback((path: string) => noteShortcutKeysByPath.has(path), [noteShortcutKeysByPath]);
    // Checks if a tag shortcut exists for the given tag path
    const hasTagShortcut = useCallback(
        (tagPath: string) => {
            const normalized = normalizeTagPath(tagPath);
            return normalized ? tagShortcutKeysByPath.has(normalized) : false;
        },
        [tagShortcutKeysByPath]
    );

    // Finds a search shortcut by name (case-insensitive)
    const findSearchShortcut = useCallback((name: string) => searchShortcutsByName.get(name.trim().toLowerCase()), [searchShortcutsByName]);

    const value: ShortcutsContextValue = useMemo(
        () => ({
            shortcuts: rawShortcuts,
            hydratedShortcuts,
            shortcutMap,
            folderShortcutKeysByPath,
            noteShortcutKeysByPath,
            tagShortcutKeysByPath,
            searchShortcutsByName,
            addFolderShortcut,
            addNoteShortcut,
            addTagShortcut,
            addSearchShortcut,
            addShortcutsBatch,
            removeShortcut,
            removeSearchShortcut,
            reorderShortcuts,
            hasFolderShortcut,
            hasNoteShortcut,
            hasTagShortcut,
            findSearchShortcut
        }),
        [
            rawShortcuts,
            hydratedShortcuts,
            shortcutMap,
            folderShortcutKeysByPath,
            noteShortcutKeysByPath,
            tagShortcutKeysByPath,
            searchShortcutsByName,
            addFolderShortcut,
            addNoteShortcut,
            addTagShortcut,
            addSearchShortcut,
            addShortcutsBatch,
            removeShortcut,
            removeSearchShortcut,
            reorderShortcuts,
            hasFolderShortcut,
            hasNoteShortcut,
            hasTagShortcut,
            findSearchShortcut
        ]
    );

    return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

/**
 * Hook to access the shortcuts context.
 * Must be used within a ShortcutsProvider.
 */
export function useShortcuts() {
    const context = useContext(ShortcutsContext);
    if (!context) {
        throw new Error('useShortcuts must be used within a ShortcutsProvider');
    }
    return context;
}
