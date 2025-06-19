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

import { TFile, MetadataCache } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';

/**
 * Get the display name for a file, optionally reading from frontmatter
 * @param file - The file to get the name for
 * @param settings - Plugin settings
 * @param metadataCache - Obsidian metadata cache
 * @returns The display name for the file
 */
export function getFileDisplayName(
    file: TFile,
    settings: NotebookNavigatorSettings,
    metadataCache: MetadataCache
): string {
    // If frontmatter is disabled or no field is specified, return basename
    if (!settings.useFrontmatterDates || !settings.frontmatterNameField || settings.frontmatterNameField.trim() === '') {
        return file.basename;
    }

    // Try to get name from frontmatter
    const metadata = metadataCache.getFileCache(file);
    const frontmatter = metadata?.frontmatter;
    
    if (frontmatter) {
        const frontmatterName = frontmatter[settings.frontmatterNameField];
        
        // Return frontmatter name if it exists and is a non-empty string
        if (frontmatterName && typeof frontmatterName === 'string' && frontmatterName.trim() !== '') {
            return frontmatterName.trim();
        }
    }
    
    // Fall back to file basename
    return file.basename;
}