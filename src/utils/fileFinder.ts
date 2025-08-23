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
import { NavigatorContext, PinnedNotes } from '../types';
import { UNTAGGED_TAG_ID } from '../types';
import {
    parseExcludedProperties,
    shouldExcludeFile,
    parseExcludedFolders,
    shouldExcludeFolder,
    getFilteredMarkdownFiles,
    getFilteredFiles
} from './fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY } from './fileTypeUtils';
import { getEffectiveSortOption, sortFiles } from './sortUtils';
import { TagTreeService } from '../services/TagTreeService';
import { getDBInstance } from '../storage/fileOperations';

/**
 * Gets the folder note for a folder if it exists
 */
export function getFolderNote(folder: TFolder, settings: NotebookNavigatorSettings, _app: App): TFile | null {
    if (!settings.enableFolderNotes) {
        return null;
    }

    // Look for the folder note in the folder
    for (const child of folder.children) {
        // Only check files, not folders
        if (child instanceof TFile) {
            // Check if file is a folder note
            // Must be directly in the folder
            if (child.parent?.path !== folder.path) {
                continue;
            }

            // Only markdown files can be folder notes
            if (child.extension !== 'md') {
                continue;
            }

            // If folderNoteName is empty, use the folder name
            const expectedName = settings.folderNoteName || folder.name;
            if (child.basename === expectedName) {
                return child;
            }
        }
    }

    return null;
}

/**
 * Collects all pinned note paths from settings
 */
export function collectPinnedPaths(pinnedNotes: PinnedNotes, contextFilter?: NavigatorContext): Set<string> {
    const allPinnedPaths = new Set<string>();

    if (!pinnedNotes || typeof pinnedNotes !== 'object') {
        return allPinnedPaths;
    }

    for (const [path, contexts] of Object.entries(pinnedNotes)) {
        if (!contextFilter) {
            // Include all pinned notes
            allPinnedPaths.add(path);
        } else if (contexts[contextFilter]) {
            // Include if pinned in the specified context
            allPinnedPaths.add(path);
        }
    }

    return allPinnedPaths;
}

/**
 * Gets a sorted list of files for a given folder, respecting all plugin settings.
 * This is the primary utility function to be used by the reducer.
 */
export function getFilesForFolder(folder: TFolder, settings: NotebookNavigatorSettings, app: App): TFile[] {
    const excludedProperties = parseExcludedProperties(settings.excludedFiles);

    // Collect files from folder
    const files: TFile[] = [];
    const excludedFolderPatterns = parseExcludedFolders(settings.excludedFolders);

    const collectFiles = (f: TFolder): void => {
        for (const child of f.children) {
            if (child instanceof TFile) {
                // Check if file should be displayed based on visibility setting
                if (shouldDisplayFile(child, settings.fileVisibility, app)) {
                    files.push(child);
                }
            } else if (settings.showNotesFromSubfolders && child instanceof TFolder) {
                // Skip excluded folders when collecting files - pass full path for path-based patterns
                if (excludedFolderPatterns.length === 0 || !shouldExcludeFolder(child.name, excludedFolderPatterns, child.path)) {
                    collectFiles(child);
                }
            }
        }
    };

    collectFiles(folder);
    let allFiles = files.filter(file => !shouldExcludeFile(file, excludedProperties, app));

    // Filter out folder notes if enabled and set to hide
    if (settings.enableFolderNotes && settings.hideFolderNoteInList) {
        allFiles = allFiles.filter(file => {
            // Check if this file is a folder note for its parent folder
            if (file.parent && file.parent instanceof TFolder) {
                // Only markdown files can be folder notes
                if (file.extension !== 'md') {
                    return true;
                }

                // If folderNoteName is empty, use the folder name
                const expectedName = settings.folderNoteName || file.parent.name;
                return file.basename !== expectedName;
            }
            return true;
        });
    }

    const sortOption = getEffectiveSortOption(settings, 'folder', folder);
    sortFiles(
        allFiles,
        sortOption,
        (file: TFile) => file.stat.ctime,
        (file: TFile) => file.stat.mtime
    );

    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, 'folder');
    // Separate pinned and unpinned files
    let sortedFiles: TFile[];
    if (pinnedPaths.size === 0) {
        sortedFiles = allFiles;
    } else {
        const pinnedFiles: TFile[] = [];
        const unpinnedFiles: TFile[] = [];

        for (const file of allFiles) {
            if (pinnedPaths.has(file.path)) {
                pinnedFiles.push(file);
            } else {
                unpinnedFiles.push(file);
            }
        }

        sortedFiles = [...pinnedFiles, ...unpinnedFiles];
    }

    return sortedFiles;
}

/**
 * Gets a sorted list of files for a given tag, respecting all plugin settings.
 */
export function getFilesForTag(tag: string, settings: NotebookNavigatorSettings, app: App, tagTreeService: TagTreeService | null): TFile[] {
    // Get all files based on visibility setting, with proper filtering
    let allFiles: TFile[] = [];

    if (settings.fileVisibility === FILE_VISIBILITY.MARKDOWN) {
        // Only markdown files
        allFiles = getFilteredMarkdownFiles(app, settings);
    } else {
        // Get all files with filtering
        allFiles = getFilteredFiles(app, settings);
    }

    let filteredFiles: TFile[] = [];

    const db = getDBInstance();

    // Special case for untagged files
    if (tag === UNTAGGED_TAG_ID) {
        filteredFiles = allFiles.filter(file => {
            // Non-markdown files are always untagged
            if (file.extension !== 'md') {
                return true;
            }
            // For markdown files, check if they have tags using our cache
            const fileTags = db.getCachedTags(file.path);
            return fileTags.length === 0;
        });
    } else {
        // For regular tags, only consider markdown files since only they can have tags
        const markdownFiles = allFiles.filter(file => file.extension === 'md');

        // Find the selected tag node using TagTreeService
        const selectedNode = tagTreeService?.findTagNode(tag) || null;

        if (selectedNode) {
            // Collect all tags to include (selected tag and all children)
            const tagsToInclude = tagTreeService?.collectTagPaths(selectedNode) || new Set<string>();

            // Create a lowercase set for case-insensitive comparison
            const tagsToIncludeLower = new Set(Array.from(tagsToInclude).map((tag: string) => tag.toLowerCase()));

            // Filter files that have any of the collected tags (case-insensitive)
            filteredFiles = markdownFiles.filter(file => {
                const fileTags = db.getCachedTags(file.path);
                return fileTags.some(tag => {
                    return tagsToIncludeLower.has(tag.toLowerCase());
                });
            });
        } else {
            // Fallback to empty if tag not found
            filteredFiles = [];
        }
    }

    // Sort files
    const sortOption = getEffectiveSortOption(settings, 'tag', null, tag);
    sortFiles(
        filteredFiles,
        sortOption,
        (file: TFile) => file.stat.ctime,
        (file: TFile) => file.stat.mtime
    );

    // Handle pinned notes for tag context
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, 'tag');
    // Separate pinned and unpinned files
    if (pinnedPaths.size === 0) {
        return filteredFiles;
    } else {
        const pinnedFiles: TFile[] = [];
        const unpinnedFiles: TFile[] = [];

        for (const file of filteredFiles) {
            if (pinnedPaths.has(file.path)) {
                pinnedFiles.push(file);
            } else {
                unpinnedFiles.push(file);
            }
        }

        return [...pinnedFiles, ...unpinnedFiles];
    }
}
