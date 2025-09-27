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

import { useEffect, useRef, useState } from 'react';
import { TFile, TFolder, debounce } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useSettingsUpdate } from '../context/SettingsContext';
import type { NotebookNavigatorSettings } from '../settings';
import { naturalCompare } from '../utils/sortUtils';
import { compareFolderOrderWithFallback } from '../utils/treeFlattener';
import { TIMEOUTS } from '../types/obsidian-extended';

const ROOT_PATH = '/';

interface PendingRootOrderChanges {
    renames: Map<string, string>;
    removals: Set<string>;
    additions: Set<string>;
}

export interface UseRootFolderOrderParams {
    settings: NotebookNavigatorSettings;
    onFileChange?: () => void;
}

export interface RootFolderOrderState {
    rootFolders: TFolder[];
    rootLevelFolders: TFolder[];
    rootFolderOrderMap: Map<string, number>;
}

function stripTrailingSlash(path: string): string {
    if (path === ROOT_PATH) {
        return path;
    }
    return path.endsWith('/') ? path.slice(0, -1) : path;
}

function isRootLevelPath(path: string): boolean {
    if (!path) {
        return false;
    }
    const normalized = stripTrailingSlash(path);
    if (normalized === ROOT_PATH) {
        return false;
    }
    return !normalized.includes('/');
}

function normalizeRootFolderOrder(existingOrder: string[], folders: TFolder[]): string[] {
    if (folders.length === 0) {
        return [];
    }

    const folderMap = new Map<string, TFolder>();
    folders.forEach(folder => {
        folderMap.set(folder.path, folder);
    });

    const sanitizedOrder = existingOrder.filter(path => folderMap.has(path));
    const existingSet = new Set(sanitizedOrder);

    const missingFolders = folders
        .filter(folder => !existingSet.has(folder.path))
        .sort((a, b) => naturalCompare(a.name, b.name))
        .map(folder => folder.path);

    return [...sanitizedOrder, ...missingFolders];
}

function createRootOrderMap(order: string[]): Map<string, number> {
    const map = new Map<string, number>();
    order.forEach((path, index) => {
        map.set(path, index);
    });
    return map;
}

function sortFoldersByOrder(folders: TFolder[], orderMap: Map<string, number>): TFolder[] {
    return folders.slice().sort((a, b) => compareFolderOrderWithFallback(a, b, orderMap));
}

function arraysEqual(first: string[], second: string[]): boolean {
    if (first.length !== second.length) {
        return false;
    }
    return first.every((value, index) => value === second[index]);
}

export function useRootFolderOrder({ settings, onFileChange }: UseRootFolderOrderParams): RootFolderOrderState {
    const { app } = useServices();
    const updateSettings = useSettingsUpdate();
    const [rootFolders, setRootFolders] = useState<TFolder[]>([]);
    const [rootLevelFolders, setRootLevelFolders] = useState<TFolder[]>([]);
    const [rootFolderOrderMap, setRootFolderOrderMap] = useState<Map<string, number>>(new Map());
    const pendingRootOrderChangesRef = useRef<PendingRootOrderChanges>({
        renames: new Map(),
        removals: new Set(),
        additions: new Set()
    });
    const rootFolderOrderRef = useRef<string[]>(settings.rootFolderOrder);

    useEffect(() => {
        rootFolderOrderRef.current = settings.rootFolderOrder.slice();
    }, [settings.rootFolderOrder]);

    useEffect(() => {
        const pendingChanges = pendingRootOrderChangesRef.current;

        const buildFolders = () => {
            const vault = app.vault;
            const root = vault.getRoot();
            const rootChildren = root.children.filter((child): child is TFolder => child instanceof TFolder);

            let workingOrder = rootFolderOrderRef.current.slice();

            if (pendingChanges.renames.size > 0 || pendingChanges.removals.size > 0 || pendingChanges.additions.size > 0) {
                pendingChanges.renames.forEach((newPath, oldPath) => {
                    const index = workingOrder.indexOf(oldPath);
                    if (index !== -1) {
                        workingOrder[index] = newPath;
                    }
                });

                if (pendingChanges.removals.size > 0) {
                    workingOrder = workingOrder.filter(path => !pendingChanges.removals.has(path));
                }

                pendingChanges.additions.forEach(path => {
                    if (!workingOrder.includes(path)) {
                        workingOrder.push(path);
                    }
                });

                pendingChanges.renames.clear();
                pendingChanges.removals.clear();
                pendingChanges.additions.clear();
            }

            if (rootFolderOrderRef.current.length === 0) {
                const alphabeticalChildren = rootChildren.slice().sort((a, b) => naturalCompare(a.name, b.name));

                pendingChanges.renames.clear();
                pendingChanges.removals.clear();
                pendingChanges.additions.clear();

                setRootLevelFolders(alphabeticalChildren);

                if (settings.showRootFolder) {
                    setRootFolders([root]);
                } else {
                    setRootFolders(alphabeticalChildren);
                }

                setRootFolderOrderMap(new Map());
                return;
            }

            const normalizedOrder = normalizeRootFolderOrder(workingOrder, rootChildren);
            const orderMap = createRootOrderMap(normalizedOrder);
            const orderedChildren = sortFoldersByOrder(rootChildren, orderMap);

            if (!arraysEqual(normalizedOrder, rootFolderOrderRef.current)) {
                rootFolderOrderRef.current = normalizedOrder;
                void updateSettings(current => {
                    current.rootFolderOrder = normalizedOrder;
                });
            }

            setRootLevelFolders(orderedChildren);

            if (settings.showRootFolder) {
                setRootFolders([root]);
            } else {
                setRootFolders(orderedChildren);
            }

            setRootFolderOrderMap(orderMap);
        };

        const notifyFileChange = () => {
            if (onFileChange) {
                onFileChange();
            }
        };

        buildFolders();

        const rebuildFolders = debounce(buildFolders, TIMEOUTS.FILE_OPERATION_DELAY, true);

        const handleFolderCreate = (file: TFolder) => {
            const normalizedPath = stripTrailingSlash(file.path);
            if (file.parent === app.vault.getRoot() && normalizedPath !== ROOT_PATH) {
                pendingChanges.additions.add(normalizedPath);
            }
            rebuildFolders();
        };

        const handleFolderDelete = (file: TFolder) => {
            const normalizedPath = stripTrailingSlash(file.path);
            if (isRootLevelPath(normalizedPath)) {
                pendingChanges.removals.add(normalizedPath);
            }
            rebuildFolders();
        };

        const handleFolderRename = (file: TFolder, oldPath: string) => {
            const normalizedOldPath = stripTrailingSlash(oldPath);
            const normalizedNewPath = stripTrailingSlash(file.path);
            const isNowRoot = file.parent === app.vault.getRoot();
            const wasRoot = isRootLevelPath(normalizedOldPath);

            if (wasRoot && isNowRoot) {
                if (normalizedOldPath !== normalizedNewPath) {
                    pendingChanges.renames.set(normalizedOldPath, normalizedNewPath);
                }
            } else if (wasRoot && !isNowRoot) {
                pendingChanges.removals.add(normalizedOldPath);
            } else if (!wasRoot && isNowRoot) {
                pendingChanges.additions.add(normalizedNewPath);
            }

            rebuildFolders();
        };

        const events = [
            app.vault.on('create', file => {
                if (file instanceof TFolder) {
                    handleFolderCreate(file);
                }
                if (file instanceof TFile) {
                    notifyFileChange();
                }
            }),
            app.vault.on('delete', file => {
                if (file instanceof TFolder) {
                    handleFolderDelete(file);
                }
                if (file instanceof TFile) {
                    notifyFileChange();
                }
            }),
            app.vault.on('rename', (file, oldPath) => {
                if (file instanceof TFolder) {
                    handleFolderRename(file, oldPath);
                }
                if (file instanceof TFile) {
                    notifyFileChange();
                }
            })
        ];

        return () => {
            events.forEach(eventRef => app.vault.offref(eventRef));
            rebuildFolders.cancel();
        };
    }, [app, onFileChange, settings.showRootFolder, settings.rootFolderOrder, updateSettings]);

    return {
        rootFolders,
        rootLevelFolders,
        rootFolderOrderMap
    };
}
