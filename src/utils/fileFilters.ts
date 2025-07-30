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

import { TFile, TFolder, App } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { shouldDisplayFile } from './fileTypeUtils';

/**
 * Filters the excluded files array to remove empty entries
 */
export function parseExcludedProperties(excludedFiles: string[]): string[] {
    return excludedFiles.filter(p => p && p.trim());
}

/**
 * Checks if a file should be excluded based on its frontmatter properties
 */
export function shouldExcludeFile(file: TFile, excludedProperties: string[], app: App): boolean {
    if (excludedProperties.length === 0) return false;

    const metadata = app.metadataCache.getFileCache(file);
    const frontmatter = metadata?.frontmatter;
    if (!frontmatter) return false;

    return excludedProperties.some(prop => prop in frontmatter);
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

/**
 * Checks if a file is in an excluded folder by checking all parent folders
 */
function isFileInExcludedFolder(file: TFile, excludedFolderPatterns: string[]): boolean {
    if (!file || excludedFolderPatterns.length === 0) return false;

    let currentFolder: TFolder | null = file.parent;
    while (currentFolder) {
        if (shouldExcludeFolder(currentFolder.name, excludedFolderPatterns)) {
            return true;
        }
        currentFolder = currentFolder.parent;
    }

    return false;
}

/**
 * Checks if a file path is in an excluded folder by checking all parent folders
 * This is a path-based version that doesn't require a TFile object
 */
export function isPathInExcludedFolder(filePath: string, excludedFolderPatterns: string[]): boolean {
    if (!filePath || excludedFolderPatterns.length === 0) return false;

    const pathParts = filePath.split('/');
    // Check each folder in the path (excluding the file name itself)
    for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        if (shouldExcludeFolder(folderName, excludedFolderPatterns)) {
            return true;
        }
    }

    return false;
}

/**
 * Gets filtered markdown files from the vault, excluding files based on:
 * - Excluded folder patterns
 * - Excluded frontmatter properties
 */
export function getFilteredMarkdownFiles(app: App, settings: NotebookNavigatorSettings): TFile[] {
    if (!app || !settings) return [];

    const excludedProperties = parseExcludedProperties(settings.excludedFiles);
    const excludedFolderPatterns = parseExcludedFolders(settings.excludedFolders);

    return app.vault.getMarkdownFiles().filter(file => {
        // Filter by excluded properties
        if (excludedProperties.length > 0 && shouldExcludeFile(file, excludedProperties, app)) {
            return false;
        }

        // Filter by excluded folders
        if (isFileInExcludedFolder(file, excludedFolderPatterns)) {
            return false;
        }

        return true;
    });
}

/**
 * Gets all filtered files from the vault (markdown and non-markdown), excluding:
 * - Excluded folder patterns
 * - Excluded frontmatter properties (for markdown files only)
 * - Files based on visibility settings
 */
export function getFilteredFiles(app: App, settings: NotebookNavigatorSettings): TFile[] {
    if (!app || !settings) return [];

    const excludedProperties = parseExcludedProperties(settings.excludedFiles);
    const excludedFolderPatterns = parseExcludedFolders(settings.excludedFolders);

    return app.vault.getFiles().filter(file => {
        // Filter by visibility settings
        if (!shouldDisplayFile(file, settings.fileVisibility, app)) {
            return false;
        }

        // Filter by excluded properties (only for markdown files)
        if (file.extension === 'md' && excludedProperties.length > 0 && shouldExcludeFile(file, excludedProperties, app)) {
            return false;
        }

        // Filter by excluded folders
        if (isFileInExcludedFolder(file, excludedFolderPatterns)) {
            return false;
        }

        return true;
    });
}
