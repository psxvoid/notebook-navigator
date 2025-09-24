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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Notice, TAbstractFile, TFile, TFolder } from 'obsidian';
import { useSettingsState, useSettingsUpdate } from './SettingsContext';
import { useServices } from './ServicesContext';
import { ShortcutEntry, ShortcutType, SavedSearch, isFolderShortcut, isNoteShortcut, isTagShortcut } from '../types/shortcuts';
import type { SearchProvider } from '../types/search';
import { strings } from '../i18n';

/**
 * Represents a shortcut with its resolved target.
 * Hydration resolves shortcut references to actual Obsidian objects.
 */
interface HydratedShortcut {
    shortcut: ShortcutEntry;
    folder: TFolder | null;
    note: TFile | null;
    savedSearch: SavedSearch | null;
    tagPath: string | null;
    isMissing: boolean;
}

export interface ShortcutsContextValue {
    shortcuts: ShortcutEntry[];
    hydratedShortcuts: HydratedShortcut[];
    shortcutsById: Map<string, ShortcutEntry>;
    folderShortcutIdsByPath: Map<string, string>;
    noteShortcutIdsByPath: Map<string, string>;
    tagShortcutIdsByPath: Map<string, string>;
    savedSearchesById: Map<string, SavedSearch>;
    addFolderShortcut: (path: string) => Promise<string | null>;
    addNoteShortcut: (path: string) => Promise<string | null>;
    addTagShortcut: (tagPath: string) => Promise<string | null>;
    addSearchShortcut: (input: { name: string; query: string; provider: SearchProvider }) => Promise<{
        shortcutId: string;
        savedSearchId: string;
    } | null>;
    removeShortcut: (shortcutId: string) => Promise<boolean>;
    removeSearchShortcut: (savedSearchId: string) => Promise<boolean>;
    renameSavedSearch: (savedSearchId: string, name: string) => Promise<boolean>;
    reorderShortcuts: (orderedIds: string[]) => Promise<boolean>;
    hasFolderShortcut: (path: string) => boolean;
    hasNoteShortcut: (path: string) => boolean;
    hasTagShortcut: (tagPath: string) => boolean;
    findSearchShortcutId: (savedSearchId: string) => string | null;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

const SHORTCUTS_SCHEMA_VERSION = 1;

function createId(): string {
    if (typeof globalThis !== 'undefined' && typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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

    const hasMigratedRef = useRef(false);

    // Extract saved searches and shortcuts from settings with fallback to empty collections
    const savedSearchEntries = useMemo(() => settings.savedSearches ?? {}, [settings.savedSearches]);
    const rawShortcuts = useMemo(() => settings.shortcuts ?? [], [settings.shortcuts]);

    // Convert saved searches object to Map for efficient lookup
    const savedSearchesById = useMemo(() => {
        return new Map<string, SavedSearch>(Object.entries(savedSearchEntries));
    }, [savedSearchEntries]);

    // Create lookup map for shortcuts by ID
    const shortcutsById = useMemo(() => {
        const map = new Map<string, ShortcutEntry>();
        rawShortcuts.forEach(shortcut => {
            map.set(shortcut.id, shortcut);
        });
        return map;
    }, [rawShortcuts]);

    // Create lookup map for folder shortcuts by path to detect duplicates
    const folderShortcutIdsByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isFolderShortcut(shortcut)) {
                map.set(shortcut.path, shortcut.id);
            }
        });
        return map;
    }, [rawShortcuts]);

    // Create lookup map for note shortcuts by path to detect duplicates
    const noteShortcutIdsByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isNoteShortcut(shortcut)) {
                map.set(shortcut.path, shortcut.id);
            }
        });
        return map;
    }, [rawShortcuts]);

    // Create lookup map for tag shortcuts by path to detect duplicates
    const tagShortcutIdsByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isTagShortcut(shortcut)) {
                map.set(shortcut.tagPath, shortcut.id);
            }
        });
        return map;
    }, [rawShortcuts]);

    // Sort shortcuts by order, then creation time, then ID for consistent display
    const shortcuts = useMemo(() => {
        return [...rawShortcuts].sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            if (a.createdAt !== b.createdAt) {
                return a.createdAt - b.createdAt;
            }
            return a.id.localeCompare(b.id);
        });
    }, [rawShortcuts]);

    // Resolve shortcut targets to actual vault objects and detect missing items
    const hydratedShortcuts = useMemo(() => {
        return shortcuts.map<HydratedShortcut>(shortcut => {
            if (isFolderShortcut(shortcut)) {
                const target = app.vault.getAbstractFileByPath(shortcut.path);
                if (isFolder(target)) {
                    return {
                        shortcut,
                        folder: target,
                        note: null,
                        savedSearch: null,
                        tagPath: null,
                        isMissing: false
                    };
                }
                return {
                    shortcut,
                    folder: null,
                    note: null,
                    savedSearch: null,
                    tagPath: null,
                    isMissing: true
                };
            }

            if (isNoteShortcut(shortcut)) {
                const target = app.vault.getAbstractFileByPath(shortcut.path);
                if (isFile(target)) {
                    return {
                        shortcut,
                        folder: null,
                        note: target,
                        savedSearch: null,
                        tagPath: null,
                        isMissing: false
                    };
                }
                return {
                    shortcut,
                    folder: null,
                    note: null,
                    savedSearch: null,
                    tagPath: null,
                    isMissing: true
                };
            }

            if (isTagShortcut(shortcut)) {
                return {
                    shortcut,
                    folder: null,
                    note: null,
                    savedSearch: null,
                    tagPath: shortcut.tagPath,
                    isMissing: false
                };
            }

            const savedSearch = savedSearchesById.get(shortcut.savedSearchId) ?? null;
            return {
                shortcut,
                folder: null,
                note: null,
                savedSearch,
                tagPath: null,
                isMissing: savedSearch === null
            };
        });
    }, [app.vault, shortcuts, savedSearchesById]);

    // Ensure shortcuts have required fields for backwards compatibility
    const migrateShortcuts = useCallback(async () => {
        if (hasMigratedRef.current) {
            return;
        }

        hasMigratedRef.current = true;
        await updateSettings(current => {
            const now = Date.now();
            let changed = false;

            current.shortcuts = current.shortcuts ?? [];
            current.savedSearches = current.savedSearches ?? {};

            current.shortcuts.forEach((shortcut, index) => {
                const base = shortcut as Partial<ShortcutEntry> & { savedSearchId?: string };
                if (!base.id) {
                    base.id = createId();
                    changed = true;
                }
                if (typeof base.order !== 'number') {
                    base.order = index;
                    changed = true;
                }
                if (typeof base.createdAt !== 'number') {
                    base.createdAt = now;
                    changed = true;
                }
                if (typeof base.updatedAt !== 'number') {
                    base.updatedAt = base.createdAt ?? now;
                    changed = true;
                }
                if (base.type === ShortcutType.SEARCH) {
                    if (!base.savedSearchId && base.id) {
                        base.savedSearchId = base.id;
                        changed = true;
                    }
                }
            });

            Object.values(current.savedSearches).forEach(saved => {
                const record = saved as Partial<SavedSearch>;
                if (!record.id) {
                    record.id = createId();
                    changed = true;
                }
                if (typeof record.createdAt !== 'number') {
                    record.createdAt = now;
                    changed = true;
                }
                if (typeof record.updatedAt !== 'number') {
                    record.updatedAt = record.createdAt ?? now;
                    changed = true;
                }
            });

            if (current.shortcutsVersion !== SHORTCUTS_SCHEMA_VERSION) {
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
                changed = true;
            }

            if (!changed) {
                return;
            }
        });
    }, [updateSettings]);

    useEffect(() => {
        if (settings.shortcutsVersion !== SHORTCUTS_SCHEMA_VERSION) {
            void migrateShortcuts();
        } else if (!hasMigratedRef.current) {
            hasMigratedRef.current = true;
        }
    }, [settings.shortcutsVersion, migrateShortcuts]);

    // Clean up shortcuts pointing to deleted files/folders
    const removeMissingShortcuts = useCallback(async () => {
        const missingIds = hydratedShortcuts.filter(entry => entry.isMissing).map(entry => entry.shortcut.id);

        if (missingIds.length === 0) {
            return;
        }

        const missingSet = new Set(missingIds);
        await updateSettings(current => {
            const before = current.shortcuts.length;
            current.shortcuts = current.shortcuts.filter(shortcut => !missingSet.has(shortcut.id));
            if (current.shortcuts.length !== before) {
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
            }
        });
    }, [hydratedShortcuts, updateSettings]);

    useEffect(() => {
        if (!hasMigratedRef.current) {
            return;
        }

        const hasMissing = hydratedShortcuts.some(entry => entry.isMissing);
        if (hasMissing) {
            void removeMissingShortcuts();
        }
    }, [hydratedShortcuts, removeMissingShortcuts]);

    type ShortcutCreateInput =
        | {
              type: typeof ShortcutType.FOLDER;
              path: string;
          }
        | {
              type: typeof ShortcutType.NOTE;
              path: string;
          }
        | {
              type: typeof ShortcutType.TAG;
              tagPath: string;
          };

    // Generic function to create any type of shortcut
    const addShortcut = useCallback(
        async (shortcut: ShortcutCreateInput) => {
            const shortcutId = createId();
            const now = Date.now();
            await updateSettings(current => {
                const existingShortcuts = current.shortcuts ?? [];
                const order = existingShortcuts.length;
                current.shortcuts = [
                    ...existingShortcuts,
                    {
                        ...shortcut,
                        id: shortcutId,
                        order,
                        createdAt: now,
                        updatedAt: now
                    } as ShortcutEntry
                ];
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
            });
            return shortcutId;
        },
        [updateSettings]
    );

    const addFolderShortcut = useCallback(
        async (path: string) => {
            if (folderShortcutIdsByPath.has(path)) {
                new Notice(strings.shortcuts.folderExists);
                return null;
            }
            const shortcutId = await addShortcut({
                type: ShortcutType.FOLDER,
                path
            });
            return shortcutId;
        },
        [addShortcut, folderShortcutIdsByPath]
    );

    const addNoteShortcut = useCallback(
        async (path: string) => {
            if (noteShortcutIdsByPath.has(path)) {
                new Notice(strings.shortcuts.noteExists);
                return null;
            }
            const shortcutId = await addShortcut({
                type: ShortcutType.NOTE,
                path
            });
            return shortcutId;
        },
        [addShortcut, noteShortcutIdsByPath]
    );

    const addTagShortcut = useCallback(
        async (tagPath: string) => {
            if (tagShortcutIdsByPath.has(tagPath)) {
                new Notice(strings.shortcuts.tagExists);
                return null;
            }
            const shortcutId = await addShortcut({
                type: ShortcutType.TAG,
                tagPath
            });
            return shortcutId;
        },
        [addShortcut, tagShortcutIdsByPath]
    );

    const addSearchShortcut = useCallback(
        async ({ name, query, provider }: { name: string; query: string; provider: SearchProvider }) => {
            const normalizedQuery = query.trim();
            if (!normalizedQuery) {
                new Notice(strings.shortcuts.emptySearchQuery);
                return null;
            }

            const existing = Array.from(savedSearchesById.values()).find(
                saved => saved.query === normalizedQuery && saved.provider === provider
            );
            if (existing) {
                new Notice(strings.shortcuts.searchExists);
                return null;
            }

            const savedSearchId = createId();
            const shortcutId = createId();
            const now = Date.now();
            await updateSettings(current => {
                const existingSavedSearches = current.savedSearches ?? {};
                current.savedSearches = {
                    ...existingSavedSearches,
                    [savedSearchId]: {
                        id: savedSearchId,
                        name,
                        query: normalizedQuery,
                        provider,
                        createdAt: now,
                        updatedAt: now
                    }
                };

                const existingShortcuts = current.shortcuts ?? [];
                const order = existingShortcuts.length;
                current.shortcuts = [
                    ...existingShortcuts,
                    {
                        id: shortcutId,
                        type: ShortcutType.SEARCH,
                        savedSearchId,
                        order,
                        createdAt: now,
                        updatedAt: now
                    }
                ];
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
            });

            return {
                shortcutId,
                savedSearchId
            };
        },
        [updateSettings, savedSearchesById]
    );

    const removeShortcut = useCallback(
        async (shortcutId: string) => {
            if (!shortcutsById.has(shortcutId)) {
                return false;
            }
            await updateSettings(current => {
                const updatedShortcuts = (current.shortcuts ?? []).filter(shortcut => shortcut.id !== shortcutId);
                updatedShortcuts.forEach((shortcut, index) => {
                    shortcut.order = index;
                    shortcut.updatedAt = Date.now();
                });
                current.shortcuts = updatedShortcuts;
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
            });

            return true;
        },
        [updateSettings, shortcutsById]
    );

    const removeSearchShortcut = useCallback(
        async (savedSearchId: string) => {
            if (!savedSearchesById.has(savedSearchId)) {
                return false;
            }

            await updateSettings(current => {
                if (current.savedSearches) {
                    const nextSavedSearches = { ...current.savedSearches };
                    delete nextSavedSearches[savedSearchId];
                    current.savedSearches = nextSavedSearches;
                }

                const updatedShortcuts = (current.shortcuts ?? []).filter(shortcut => {
                    if (shortcut.type === ShortcutType.SEARCH) {
                        return shortcut.savedSearchId !== savedSearchId;
                    }
                    return true;
                });

                updatedShortcuts.forEach((shortcut, index) => {
                    shortcut.order = index;
                    shortcut.updatedAt = Date.now();
                });

                current.shortcuts = updatedShortcuts;
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
            });
            return true;
        },
        [updateSettings, savedSearchesById]
    );

    const renameSavedSearch = useCallback(
        async (savedSearchId: string, name: string) => {
            if (!savedSearchesById.has(savedSearchId)) {
                return false;
            }
            await updateSettings(current => {
                const existing = current.savedSearches?.[savedSearchId];
                if (existing) {
                    current.savedSearches = {
                        ...current.savedSearches,
                        [savedSearchId]: {
                            ...existing,
                            name,
                            updatedAt: Date.now()
                        }
                    };
                }
            });
            return true;
        },
        [updateSettings, savedSearchesById]
    );

    // Update shortcut display order after drag and drop
    const reorderShortcuts = useCallback(
        async (orderedIds: string[]) => {
            const uniqueIds = new Set(orderedIds);
            if (uniqueIds.size !== orderedIds.length) {
                return false;
            }

            const hasAll = shortcuts.every(shortcut => uniqueIds.has(shortcut.id));
            if (!hasAll || orderedIds.length !== shortcuts.length) {
                return false;
            }

            await updateSettings(current => {
                const byId = new Map(current.shortcuts.map(shortcut => [shortcut.id, shortcut] as const));
                current.shortcuts = orderedIds.map(id => byId.get(id)).filter((entry): entry is ShortcutEntry => Boolean(entry));
                current.shortcuts.forEach((shortcut, index) => {
                    shortcut.order = index;
                    shortcut.updatedAt = Date.now();
                });
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
            });
            return true;
        },
        [updateSettings, shortcuts]
    );

    // Update shortcut paths when files/folders are renamed
    const handleVaultRename = useCallback(
        async (file: TAbstractFile, oldPath: string) => {
            if (!isFile(file) && !isFolder(file)) {
                return;
            }

            const newPath = file.path;
            const targetShortcuts = rawShortcuts.filter(shortcut => {
                if (isFolderShortcut(shortcut)) {
                    return shortcut.path === oldPath;
                }
                if (isNoteShortcut(shortcut)) {
                    return shortcut.path === oldPath;
                }
                return false;
            });

            if (targetShortcuts.length === 0) {
                return;
            }

            await updateSettings(current => {
                const shortcuts = current.shortcuts ?? [];
                let didChange = false;
                const updatedShortcuts = shortcuts.map(shortcut => {
                    if ((isFolderShortcut(shortcut) || isNoteShortcut(shortcut)) && shortcut.path === oldPath) {
                        didChange = true;
                        return {
                            ...shortcut,
                            path: newPath,
                            updatedAt: Date.now()
                        } as ShortcutEntry;
                    }
                    return shortcut;
                });

                if (didChange) {
                    current.shortcuts = updatedShortcuts;
                    current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
                }
            });
        },
        [rawShortcuts, updateSettings]
    );

    // Remove shortcuts when their targets are deleted
    const handleVaultDelete = useCallback(
        async (file: TAbstractFile) => {
            const path = file.path;
            const targetShortcuts = rawShortcuts.filter(shortcut => {
                if (isFolderShortcut(shortcut) || isNoteShortcut(shortcut)) {
                    return shortcut.path === path;
                }
                return false;
            });

            if (targetShortcuts.length === 0) {
                return;
            }

            await updateSettings(current => {
                const updatedShortcuts = (current.shortcuts ?? []).filter(shortcut => {
                    if (isFolderShortcut(shortcut) || isNoteShortcut(shortcut)) {
                        return shortcut.path !== path;
                    }
                    return true;
                });

                updatedShortcuts.forEach((shortcut, index) => {
                    shortcut.order = index;
                    shortcut.updatedAt = Date.now();
                });

                current.shortcuts = updatedShortcuts;
                current.shortcutsVersion = SHORTCUTS_SCHEMA_VERSION;
            });
        },
        [rawShortcuts, updateSettings]
    );

    useEffect(() => {
        const renameRef = app.vault.on('rename', handleVaultRename);
        const deleteRef = app.vault.on('delete', handleVaultDelete);
        return () => {
            app.vault.offref(renameRef);
            app.vault.offref(deleteRef);
        };
    }, [app.vault, handleVaultRename, handleVaultDelete]);

    const hasFolderShortcut = useCallback((path: string) => folderShortcutIdsByPath.has(path), [folderShortcutIdsByPath]);

    const hasNoteShortcut = useCallback((path: string) => noteShortcutIdsByPath.has(path), [noteShortcutIdsByPath]);

    const hasTagShortcut = useCallback((tagPath: string) => tagShortcutIdsByPath.has(tagPath), [tagShortcutIdsByPath]);

    // Find shortcut ID for a given saved search
    const findSearchShortcutId = useCallback(
        (savedSearchId: string) => {
            const entry = shortcuts.find(shortcut => shortcut.type === ShortcutType.SEARCH && shortcut.savedSearchId === savedSearchId);
            return entry ? entry.id : null;
        },
        [shortcuts]
    );

    const contextValue = useMemo<ShortcutsContextValue>(() => {
        return {
            shortcuts,
            hydratedShortcuts,
            shortcutsById,
            folderShortcutIdsByPath,
            noteShortcutIdsByPath,
            tagShortcutIdsByPath,
            savedSearchesById,
            addFolderShortcut,
            addNoteShortcut,
            addTagShortcut,
            addSearchShortcut,
            removeShortcut,
            removeSearchShortcut,
            renameSavedSearch,
            reorderShortcuts,
            hasFolderShortcut,
            hasNoteShortcut,
            hasTagShortcut,
            findSearchShortcutId
        };
    }, [
        shortcuts,
        hydratedShortcuts,
        shortcutsById,
        folderShortcutIdsByPath,
        noteShortcutIdsByPath,
        tagShortcutIdsByPath,
        savedSearchesById,
        addFolderShortcut,
        addNoteShortcut,
        addTagShortcut,
        addSearchShortcut,
        removeShortcut,
        removeSearchShortcut,
        renameSavedSearch,
        reorderShortcuts,
        hasFolderShortcut,
        hasNoteShortcut,
        hasTagShortcut,
        findSearchShortcutId
    ]);

    return <ShortcutsContext.Provider value={contextValue}>{children}</ShortcutsContext.Provider>;
}

export function useShortcuts() {
    const context = useContext(ShortcutsContext);
    if (!context) {
        throw new Error('useShortcuts must be used within a ShortcutsProvider');
    }
    return context;
}
