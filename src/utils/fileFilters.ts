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
 * Filters the excluded files array to remove empty entries
 */
export function parseExcludedProperties(excludedFiles: string[]): string[] {
    return excludedFiles.filter(p => p && p.trim());
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

/**
 * Filters the excluded folders array to remove empty entries
 */
export function parseExcludedFolders(ignoreFolders: string[]): string[] {
    return ignoreFolders.filter(f => f && f.trim());
}

/**
 * Checks if a folder name matches a pattern with wildcard support
 * Supports * at the beginning or end of the pattern
 * @param folderName - The folder name to check
 * @param pattern - The pattern to match against (e.g., "assets*", "*_temp", "exact")
 */
export function matchesFolderPattern(folderName: string, pattern: string): boolean {
    // Empty pattern should not match anything
    if (!pattern) {
        return false;
    }
    
    // Exact match if no wildcards
    if (!pattern.includes('*')) {
        return folderName === pattern;
    }
    
    // Handle wildcard at the end (e.g., "assets*")
    if (pattern.endsWith('*') && !pattern.startsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return folderName.startsWith(prefix);
    }
    
    // Handle wildcard at the beginning (e.g., "*_temp")
    if (pattern.startsWith('*') && !pattern.endsWith('*')) {
        const suffix = pattern.slice(1);
        return folderName.endsWith(suffix);
    }
    
    // For now, we don't support wildcards in the middle or multiple wildcards
    // Just do exact match as fallback
    return folderName === pattern;
}

/**
 * Checks if a folder should be excluded based on the patterns
 */
export function shouldExcludeFolder(folderName: string, patterns: string[]): boolean {
    return patterns.some(pattern => matchesFolderPattern(folderName, pattern));
}