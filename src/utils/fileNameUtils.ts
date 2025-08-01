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

    // Fall back to file basename
    return file.basename;
}
