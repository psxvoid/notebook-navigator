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

import { FileCache, FileData } from '../types/cache';
import { findFileInCache } from './fileCacheUtils';

/**
 * Get cached file data for a given file
 * @param cache - The file cache
 * @param filePath - The file path to look up
 * @returns The cached file data or null if not found
 */
export function getCachedFileData(
    cache: FileCache | null | undefined,
    filePath: string
): FileData | null {
    if (!cache) return null;
    return findFileInCache(cache.root, filePath);
}


