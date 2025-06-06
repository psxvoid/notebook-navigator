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

/**
 * Parses the excluded files setting into an array of property names
 */
export function parseExcludedProperties(excludedFiles: string): string[] {
    return excludedFiles
        .split(',')
        .map(p => p.trim())
        .filter(p => p);
}

/**
 * Checks if a file should be excluded based on its frontmatter properties
 */
export function shouldExcludeFile(file: TFile, excludedProperties: string[], app: any): boolean {
    if (excludedProperties.length === 0) return false;
    
    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata?.frontmatter) return false;
    
    return excludedProperties.some(prop => prop in metadata.frontmatter!);
}