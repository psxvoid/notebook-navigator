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

import { ItemType } from '../types';

export type NavigationIndexKey = string;

/**
 * Normalizes a navigation path for index lookups.
 * Tags use lowercase paths. Folders pass through unchanged.
 */
export function normalizeNavigationPath(itemType: ItemType, path: string): string {
    if (itemType === ItemType.TAG) {
        return path.toLowerCase();
    }
    return path;
}

/**
 * Creates the composite key used for navigation index lookups.
 */
function createNavigationIndexKey(itemType: ItemType, path: string): NavigationIndexKey {
    const normalizedPath = normalizeNavigationPath(itemType, path);
    return `${itemType}:${normalizedPath}`;
}

/**
 * Looks up the index for a navigation item using its type-aware key.
 */
export function getNavigationIndex(indexMap: Map<NavigationIndexKey, number>, itemType: ItemType, path: string): number | undefined {
    return indexMap.get(createNavigationIndexKey(itemType, path));
}

/**
 * Stores the index for a navigation item using its type-aware key.
 */
export function setNavigationIndex(indexMap: Map<NavigationIndexKey, number>, itemType: ItemType, path: string, index: number): void {
    indexMap.set(createNavigationIndexKey(itemType, path), index);
}
