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

/**
 * Tracks pending changes to root folder order that haven't been applied yet
 */
interface PendingRootOrderChanges {
    renames: Map<string, string>;  // Maps old paths to new paths for renamed folders
    removals: Set<string>;         // Folders that have been deleted
    additions: Set<string>;        // Newly created folders
}

/**
 * Parameters for the useRootFolderOrder hook
 */
export interface UseRootFolderOrderParams {
    settings: NotebookNavigatorSettings;
    onFileChange?: () => void;  // Callback triggered when files change
}

/**
 * State returned by the useRootFolderOrder hook
 */
export interface RootFolderOrderState {
    rootFolders: TFolder[];         // Folders to display as roots (may include vault root)
    rootLevelFolders: TFolder[];    // All top-level folders in custom order
    rootFolderOrderMap: Map<string, number>;  // Maps folder paths to their order index
}

/**
 * Removes trailing slash from path, except for root path
 */
function stripTrailingSlash(path: string): string {
    if (path === ROOT_PATH) {
        return path;
    }
    return path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Checks if a path represents a top-level folder (direct child of vault root)
 */
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

/**
 * Normalizes the folder order by removing missing folders and adding new ones.
 * Preserves existing order and appends new folders alphabetically.
 */
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

/**
 * Creates a map from folder paths to their order index for efficient sorting
 */
function createRootOrderMap(order: string[]): Map<string, number> {
    const map = new Map<string, number>();
    order.forEach((path, index) => {
        map.set(path, index);
    });
    return map;
}

/**
 * Sorts folders according to the custom order map with fallback to natural sorting
 */
function sortFoldersByOrder(folders: TFolder[], orderMap: Map<string, number>): TFolder[] {
    return folders.slice().sort((a, b) => compareFolderOrderWithFallback(a, b, orderMap));
}

/**
 * Checks if two string arrays are equal in both content and order
 */
function arraysEqual(first: string[], second: string[]): boolean {
    if (first.length !== second.length) {
        return false;
    }
    return first.every((value, index) => value === second[index]);
}

/**
 * Hook that manages the custom ordering of root-level folders.
 * Tracks folder creation, deletion, and renaming to maintain order consistency.
 */
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

        // Rebuilds the folder structure and applies pending changes
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

        // Notifies parent component of file changes
        const notifyFileChange = () => {
            if (onFileChange) {
                onFileChange();
            }
        };

        buildFolders();

        const rebuildFolders = debounce(buildFolders, TIMEOUTS.FILE_OPERATION_DELAY, true);

        // Handles creation of new folders, adding them to pending additions if at root level
        const handleFolderCreate = (file: TFolder) => {
            const normalizedPath = stripTrailingSlash(file.path);
            if (file.parent === app.vault.getRoot() && normalizedPath !== ROOT_PATH) {
                pendingChanges.additions.add(normalizedPath);
            }
            rebuildFolders();
        };

        // Handles folder deletion, marking root-level folders for removal
        const handleFolderDelete = (file: TFolder) => {
            const normalizedPath = stripTrailingSlash(file.path);
            if (isRootLevelPath(normalizedPath)) {
                pendingChanges.removals.add(normalizedPath);
            }
            rebuildFolders();
        };

        // Handles folder renaming, tracking changes to maintain order across renames
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
