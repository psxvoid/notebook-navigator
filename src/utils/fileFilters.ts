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
import type { NotebookNavigatorSettings } from '../settings';
import { shouldDisplayFile } from './fileTypeUtils';
import { getActiveFileVisibility, getActiveHiddenFiles, getActiveHiddenFolders, getHiddenFolderMatcher } from './vaultProfiles';

interface FileFilterOptions {
    showHiddenItems?: boolean;
}

/**
 * When true, excluded folders are not indexed in the database
 * Set to false to index all files regardless of exclusion settings
 */
const SKIP_EXCLUDED_FOLDERS_IN_INDEX = false;

/**
 * Checks if a file should be excluded based on its frontmatter properties
 */
export function shouldExcludeFile(file: TFile, excludedProperties: string[], app: App): boolean {
    if (excludedProperties.length === 0) return false;

    const metadata = app.metadataCache.getFileCache(file);
    const frontmatter = metadata?.frontmatter;
    if (!frontmatter) return false;

    // Hide if any of the listed properties exist in frontmatter (value is ignored)
    return excludedProperties.some(prop => prop in frontmatter);
}

/**
 * Checks if a folder name matches a pattern with wildcard support
 * Supports * at the beginning or end of the pattern
 * @param folderName - The folder name to check
 * @param pattern - The pattern to match against (e.g., "assets*", "*_temp", "exact")
 */
function matchesFolderPattern(folderName: string, pattern: string): boolean {
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
 * Supports both name-based patterns and path-based patterns (starting with /)
 * @param folderName - The folder name to check (e.g., "archive")
 * @param patterns - Array of exclusion patterns (e.g., ["archive", "/root/archive", "temp*"])
 * @param folderPath - The full folder path for path-based patterns (e.g., "root/archive")
 * @returns true if the folder should be excluded
 */
export function shouldExcludeFolder(folderName: string, patterns: string[], folderPath?: string): boolean {
    const pathMatcher = getHiddenFolderMatcher(patterns).matches;
    const hasNamePattern = patterns.some(pattern => !pattern.startsWith('/') && matchesFolderPattern(folderName, pattern));

    if (hasNamePattern) {
        return true;
    }

    if (!folderPath) {
        return false;
    }

    const normalizedPath = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
    return pathMatcher(normalizedPath);
}

/**
 * Checks if a file is in an excluded folder by checking all parent folders
 */
function isFileInExcludedFolder(file: TFile, excludedFolderPatterns: string[]): boolean {
    if (!file || excludedFolderPatterns.length === 0) return false;

    const pathMatcher = getHiddenFolderMatcher(excludedFolderPatterns).matches;
    const namePatterns = excludedFolderPatterns.filter(pattern => !pattern.startsWith('/'));
    const matchesNamePattern = (name: string) => namePatterns.some(pattern => matchesFolderPattern(name, pattern));

    let currentFolder: TFolder | null = file.parent;
    while (currentFolder) {
        const normalizedPath = currentFolder.path.startsWith('/') ? currentFolder.path : `/${currentFolder.path}`;
        if (matchesNamePattern(currentFolder.name) || pathMatcher(normalizedPath)) {
            return true;
        }
        currentFolder = currentFolder.parent;
    }

    return false;
}

/**
 * Checks if a folder is a child of an excluded folder by checking all parent folders
 * Also handles wildcard patterns that might exclude parent folders
 */
export function isFolderInExcludedFolder(folder: TFolder, excludedFolderPatterns: string[]): boolean {
    if (!folder || excludedFolderPatterns.length === 0) return false;

    const pathMatcher = getHiddenFolderMatcher(excludedFolderPatterns).matches;
    const namePatterns = excludedFolderPatterns.filter(pattern => !pattern.startsWith('/'));
    const matchesNamePattern = (name: string) => namePatterns.some(pattern => matchesFolderPattern(name, pattern));

    const normalizedFolderPath = folder.path.startsWith('/') ? folder.path : `/${folder.path}`;
    if (pathMatcher(normalizedFolderPath) || matchesNamePattern(folder.name)) {
        return true;
    }

    let currentFolder: TFolder | null = folder.parent;
    while (currentFolder) {
        const normalizedPath = currentFolder.path.startsWith('/') ? currentFolder.path : `/${currentFolder.path}`;
        if (pathMatcher(normalizedPath) || matchesNamePattern(currentFolder.name)) {
            return true;
        }
        currentFolder = currentFolder.parent;
    }

    return false;
}

/**
 * Cleans up redundant exclusion patterns when adding a new pattern
 * Removes existing patterns that would be covered by the new pattern
 * @param existingPatterns - Current list of exclusion patterns
 * @param newPattern - The new pattern being added
 * @returns Cleaned list with the new pattern added and redundant ones removed
 */
export function cleanupExclusionPatterns(existingPatterns: string[], newPattern: string): string[] {
    // If the new pattern is not a path pattern, just add it without cleanup
    // (name patterns work differently and we don't want to mess with them)
    if (!newPattern.startsWith('/')) {
        return [...existingPatterns, newPattern];
    }

    const matcher = getHiddenFolderMatcher([newPattern]).matches;

    // Filter out patterns that would be made redundant by the new pattern
    const cleanedPatterns = existingPatterns.filter(existing => {
        // Keep name-based patterns (they work differently)
        if (!existing.startsWith('/')) {
            return true;
        }

        const normalizedExisting = existing.startsWith('/') ? existing : `/${existing}`;
        return !matcher(normalizedExisting);
    });

    // Add the new pattern
    cleanedPatterns.push(newPattern);

    return cleanedPatterns;
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
        // Build the folder path up to this point
        const folderPath = pathParts.slice(0, i + 1).join('/');
        if (shouldExcludeFolder(folderName, excludedFolderPatterns, folderPath)) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if a folder has any subfolders based on visibility settings.
 * This is used to determine whether to show expand/collapse chevrons
 * and whether to use the open/closed folder icon.
 *
 * @param folder - The folder to check
 * @param excludePatterns - Array of exclusion patterns
 * @param showHiddenItems - Whether excluded folders are being shown
 * @returns True if the folder has subfolders (visible or all, depending on settings)
 */
export function hasSubfolders(folder: TFolder, excludePatterns: string[], showHiddenItems: boolean): boolean {
    if (!folder.children || folder.children.length === 0) {
        return false;
    }

    // When showing hidden items, count all child folders regardless of exclusion patterns
    // This ensures chevrons appear so users can expand to reveal excluded children
    if (showHiddenItems) {
        return folder.children.some(child => child instanceof TFolder);
    }

    // Skip exclusion check if no exclusion patterns are defined
    const noPatterns = excludePatterns.length === 0;

    // Check if any visible (non-excluded) child folder exists
    return folder.children.some(child => {
        if (!(child instanceof TFolder)) {
            return false;
        }

        // If there are no patterns, any folder counts
        if (noPatterns) {
            return true;
        }

        // Exclude subfolders that match patterns when not showing hidden items
        return !shouldExcludeFolder(child.name, excludePatterns, child.path);
    });
}

/**
 * Returns true if a file passes exclusion rules based on settings
 * - Excludes markdown files with matching frontmatter properties
 * - Optionally excludes files in excluded folders when indexing is configured to skip them
 */
function passesExclusionFilters(file: TFile, settings: NotebookNavigatorSettings, app: App, options?: FileFilterOptions): boolean {
    const excludedProperties = getActiveHiddenFiles(settings);
    const excludedFolderPatterns = getActiveHiddenFolders(settings);
    // Skip frontmatter-based exclusion when showHiddenItems override is provided from options
    const includeHiddenFiles = options?.showHiddenItems ?? false;

    // Frontmatter based exclusion (markdown only)
    if (
        !includeHiddenFiles &&
        file.extension === 'md' &&
        excludedProperties.length > 0 &&
        shouldExcludeFile(file, excludedProperties, app)
    ) {
        return false;
    }

    // Folder based exclusion (only if configured to skip in index)
    if (SKIP_EXCLUDED_FOLDERS_IN_INDEX && isFileInExcludedFolder(file, excludedFolderPatterns)) {
        return false;
    }

    return true;
}

/**
 * Gets filtered markdown files from the vault, excluding files based on:
 * - Excluded folder patterns
 * - Excluded frontmatter properties
 */
export function getFilteredMarkdownFiles(app: App, settings: NotebookNavigatorSettings, options?: FileFilterOptions): TFile[] {
    if (!app || !settings) return [];

    return app.vault.getMarkdownFiles().filter(file => passesExclusionFilters(file, settings, app, options));
}

/**
 * Gets filtered document files (markdown, canvas, base) from the vault, excluding files based on:
 * - Excluded folder patterns
 * - Excluded frontmatter properties
 */
export function getFilteredDocumentFiles(app: App, settings: NotebookNavigatorSettings, options?: FileFilterOptions): TFile[] {
    if (!app || !settings) return [];

    return app.vault.getFiles().filter(file => {
        // Only include document files (md, canvas, base)
        const isDocument = file.extension === 'md' || file.extension === 'canvas' || file.extension === 'base';
        if (!isDocument) return false;

        return passesExclusionFilters(file, settings, app, options);
    });
}

/**
 * Gets all filtered files from the vault (markdown and non-markdown), excluding:
 * - Excluded folder patterns
 * - Excluded frontmatter properties (for markdown files only)
 * - Files based on visibility settings
 */
export function getFilteredFiles(app: App, settings: NotebookNavigatorSettings, options?: FileFilterOptions): TFile[] {
    if (!app || !settings) return [];

    const fileVisibility = getActiveFileVisibility(settings);

    return app.vault.getFiles().filter(file => {
        // Filter by visibility settings
        if (!shouldDisplayFile(file, fileVisibility, app)) {
            return false;
        }

        return passesExclusionFilters(file, settings, app, options);
    });
}
