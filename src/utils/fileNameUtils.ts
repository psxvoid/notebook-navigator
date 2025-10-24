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

import { TFile } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';

export const EXCALIDRAW_BASENAME_SUFFIX = '.excalidraw';

/**
 * Checks whether a filename ends with the Excalidraw composite extension (.excalidraw.md).
 */
export function isExcalidrawFileName(value: string): boolean {
    if (!value) {
        return false;
    }

    return value.toLowerCase().endsWith(`${EXCALIDRAW_BASENAME_SUFFIX}.md`);
}

/**
 * Removes the Excalidraw basename suffix when present.
 * Returns the original value for non-Excalidraw names.
 */
export function stripExcalidrawSuffix(value: string): string {
    if (!value) {
        return value;
    }
    const lower = value.toLowerCase();
    if (lower.endsWith(EXCALIDRAW_BASENAME_SUFFIX)) {
        return value.slice(0, -EXCALIDRAW_BASENAME_SUFFIX.length);
    }
    return value;
}

/**
 * Checks whether a file uses the Excalidraw composite extension (.excalidraw.md).
 */
export function isExcalidrawFile(file: TFile): boolean {
    return isExcalidrawFileName(file.name);
}

/**
 * Get the display name for a file
 * @param file - The file to get the name for
 * @param cachedData - Optional cached file data containing frontmatter name
 * @param settings - Plugin settings to check if frontmatter is enabled
 * @returns The display name for the file
 */
export function getFileDisplayName(file: TFile, cachedData?: { fn?: string }, settings?: NotebookNavigatorSettings): string {
    // If we have cached frontmatter name and feature is enabled, use it
    if (cachedData?.fn && settings?.useFrontmatterMetadata) {
        return cachedData.fn;
    }

    // Strip .excalidraw suffix from Excalidraw files for cleaner display
    if (isExcalidrawFile(file)) {
        return stripExcalidrawSuffix(file.basename);
    }

    // Fall back to file basename
    return file.basename;
}
