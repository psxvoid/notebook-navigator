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

import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { Notice, TAbstractFile, TFile, TFolder } from 'obsidian';
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

interface HydratedShortcut {
    key: string;
    shortcut: ShortcutEntry;
    folder: TFolder | null;
    note: TFile | null;
    search: SearchShortcut | null;
    tagPath: string | null;
    isMissing: boolean;
}

export interface ShortcutsContextValue {
    shortcuts: ShortcutEntry[];
    hydratedShortcuts: HydratedShortcut[];
    shortcutMap: Map<string, ShortcutEntry>;
    folderShortcutKeysByPath: Map<string, string>;
    noteShortcutKeysByPath: Map<string, string>;
    tagShortcutKeysByPath: Map<string, string>;
    searchShortcutsByName: Map<string, SearchShortcut>;
    addFolderShortcut: (path: string) => Promise<boolean>;
    addNoteShortcut: (path: string) => Promise<boolean>;
    addTagShortcut: (tagPath: string) => Promise<boolean>;
    addSearchShortcut: (input: { name: string; query: string; provider: SearchProvider }) => Promise<boolean>;
    removeShortcut: (key: string) => Promise<boolean>;
    removeSearchShortcut: (name: string) => Promise<boolean>;
    reorderShortcuts: (orderedKeys: string[]) => Promise<boolean>;
    hasFolderShortcut: (path: string) => boolean;
    hasNoteShortcut: (path: string) => boolean;
    hasTagShortcut: (tagPath: string) => boolean;
    findSearchShortcut: (name: string) => SearchShortcut | undefined;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

function isFolder(file: TAbstractFile | null): file is TFolder {
    return file instanceof TFolder;
}

function isFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile;
}

interface ShortcutsProviderProps {
    children: React.ReactNode;
}

export function ShortcutsProvider({ children }: ShortcutsProviderProps) {
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const { app } = useServices();

    const rawShortcuts = useMemo(() => settings.shortcuts ?? [], [settings.shortcuts]);

    const shortcutMap = useMemo(() => {
        const map = new Map<string, ShortcutEntry>();
        rawShortcuts.forEach(shortcut => {
            map.set(getShortcutKey(shortcut), shortcut);
        });
        return map;
    }, [rawShortcuts]);

    const folderShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isFolderShortcut(shortcut)) {
                map.set(shortcut.path, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    const noteShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isNoteShortcut(shortcut)) {
                map.set(shortcut.path, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    const tagShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isTagShortcut(shortcut)) {
                map.set(shortcut.tagPath, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    const searchShortcutsByName = useMemo(() => {
        const map = new Map<string, SearchShortcut>();
        rawShortcuts.forEach(shortcut => {
            if (isSearchShortcut(shortcut)) {
                map.set(shortcut.name.toLowerCase(), shortcut);
            }
        });
        return map;
    }, [rawShortcuts]);

    const hydratedShortcuts = useMemo<HydratedShortcut[]>(() => {
        return rawShortcuts.map(shortcut => {
            const key = getShortcutKey(shortcut);

            if (isFolderShortcut(shortcut)) {
                const target = app.vault.getAbstractFileByPath(shortcut.path);
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
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: shortcut.tagPath,
                    isMissing: false
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
    }, [app.vault, rawShortcuts]);

    useEffect(() => {
        const missingKeys = hydratedShortcuts.filter(entry => entry.isMissing).map(entry => entry.key);
        if (missingKeys.length === 0) {
            return;
        }

        void updateSettings(current => {
            const existing = current.shortcuts ?? [];
            current.shortcuts = existing.filter(shortcut => !missingKeys.includes(getShortcutKey(shortcut)));
        });
    }, [hydratedShortcuts, updateSettings]);

    const appendShortcut = useCallback(
        async (shortcut: ShortcutEntry) => {
            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                current.shortcuts = [...existing, shortcut];
            });
            return true;
        },
        [updateSettings]
    );

    const addFolderShortcut = useCallback(
        async (path: string) => {
            if (folderShortcutKeysByPath.has(path)) {
                new Notice(strings.shortcuts.folderExists);
                return false;
            }
            return appendShortcut({ type: ShortcutType.FOLDER, path });
        },
        [appendShortcut, folderShortcutKeysByPath]
    );

    const addNoteShortcut = useCallback(
        async (path: string) => {
            if (noteShortcutKeysByPath.has(path)) {
                new Notice(strings.shortcuts.noteExists);
                return false;
            }
            return appendShortcut({ type: ShortcutType.NOTE, path });
        },
        [appendShortcut, noteShortcutKeysByPath]
    );

    const addTagShortcut = useCallback(
        async (tagPath: string) => {
            if (tagShortcutKeysByPath.has(tagPath)) {
                new Notice(strings.shortcuts.tagExists);
                return false;
            }
            return appendShortcut({ type: ShortcutType.TAG, tagPath });
        },
        [appendShortcut, tagShortcutKeysByPath]
    );

    const addSearchShortcut = useCallback(
        async ({ name, query, provider }: { name: string; query: string; provider: SearchProvider }) => {
            const normalizedQuery = query.trim();
            if (!normalizedQuery) {
                new Notice(strings.shortcuts.emptySearchQuery);
                return false;
            }

            const normalizedName = name.trim();
            if (!normalizedName) {
                new Notice(strings.shortcuts.emptySearchName);
                return false;
            }

            const nameKey = normalizedName.toLowerCase();
            if (searchShortcutsByName.has(nameKey)) {
                new Notice(strings.shortcuts.searchExists);
                return false;
            }

            return appendShortcut({
                type: ShortcutType.SEARCH,
                name: normalizedName,
                query: normalizedQuery,
                provider
            });
        },
        [appendShortcut, searchShortcutsByName]
    );

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

    const hasFolderShortcut = useCallback((path: string) => folderShortcutKeysByPath.has(path), [folderShortcutKeysByPath]);
    const hasNoteShortcut = useCallback((path: string) => noteShortcutKeysByPath.has(path), [noteShortcutKeysByPath]);
    const hasTagShortcut = useCallback((tagPath: string) => tagShortcutKeysByPath.has(tagPath), [tagShortcutKeysByPath]);

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

export function useShortcuts() {
    const context = useContext(ShortcutsContext);
    if (!context) {
        throw new Error('useShortcuts must be used within a ShortcutsProvider');
    }
    return context;
}
