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

import { TFile, TFolder, App, getAllTags } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { UNTAGGED_TAG_ID } from '../types';
import { parseExcludedProperties, shouldExcludeFile, parseExcludedFolders, shouldExcludeFolder } from './fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY } from './fileTypeUtils';
import { getEffectiveSortOption, sortFiles } from './sortUtils';
import { buildTagTree, findTagNode, collectAllTagPaths } from './tagTree';

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
export function collectPinnedPaths(pinnedNotes: Record<string, string[]>, folder?: TFolder, includeSubfolders = false): Set<string> {
    const allPinnedPaths = new Set<string>();

    if (folder) {
        // Collect from specific folder and optionally its subfolders
        const collectFromFolder = (f: TFolder): void => {
            const paths = pinnedNotes[f.path] || [];
            paths.forEach(p => allPinnedPaths.add(p));

            if (includeSubfolders) {
                for (const child of f.children) {
                    if (child instanceof TFolder) {
                        collectFromFolder(child);
                    }
                }
            }
        };

        collectFromFolder(folder);
    } else {
        // Collect from all folders
        for (const folderPath in pinnedNotes) {
            const pinnedInFolder = pinnedNotes[folderPath];
            if (pinnedInFolder && pinnedInFolder.length > 0) {
                pinnedInFolder.forEach(path => allPinnedPaths.add(path));
            }
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
                // Skip excluded folders when collecting files
                if (excludedFolderPatterns.length === 0 || !shouldExcludeFolder(child.name, excludedFolderPatterns)) {
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
                // Must be directly in the folder we're querying (not in a subfolder)
                if (file.parent.path !== folder.path) {
                    return true;
                }

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

    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, folder, settings.showNotesFromSubfolders);
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
export function getFilesForTag(tag: string, settings: NotebookNavigatorSettings, app: App): TFile[] {
    const excludedProperties = parseExcludedProperties(settings.excludedFiles);

    // Get all files based on visibility setting
    let allFiles: TFile[] = [];

    if (settings.fileVisibility === FILE_VISIBILITY.MARKDOWN) {
        // Only markdown files
        allFiles = app.vault.getMarkdownFiles();
    } else {
        // Get all files and filter based on visibility setting
        allFiles = app.vault.getFiles().filter(file => shouldDisplayFile(file, settings.fileVisibility, app));
    }

    // Apply exclusion filter
    allFiles = allFiles.filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));

    let filteredFiles: TFile[] = [];

    // Special case for untagged files
    if (tag === UNTAGGED_TAG_ID) {
        filteredFiles = allFiles.filter(file => {
            // Non-markdown files are always untagged
            if (file.extension !== 'md') {
                return true;
            }
            // For markdown files, check if they have tags
            const cache = app.metadataCache.getFileCache(file);
            const fileTags = cache ? getAllTags(cache) : null;
            return !fileTags || fileTags.length === 0;
        });
    } else {
        // For regular tags, only consider markdown files since only they can have tags
        const markdownFiles = allFiles.filter(file => file.extension === 'md');

        // Build the tag tree
        const { tree: tagTree } = buildTagTree(markdownFiles, app);

        // Find the selected tag node
        const selectedNode = findTagNode(tagTree, tag);

        if (selectedNode) {
            // Collect all tags to include (selected tag and all children)
            const tagsToInclude = collectAllTagPaths(selectedNode);

            // Create a lowercase set for case-insensitive comparison
            const tagsToIncludeLower = new Set(Array.from(tagsToInclude).map((tag: string) => tag.toLowerCase()));

            // Filter files that have any of the collected tags (case-insensitive)
            filteredFiles = markdownFiles.filter(file => {
                const cache = app.metadataCache.getFileCache(file);
                const fileTags = cache ? getAllTags(cache) : null;
                return (
                    fileTags &&
                    fileTags.some(tag => {
                        // Remove # prefix from file tags before comparison
                        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        return tagsToIncludeLower.has(cleanTag.toLowerCase());
                    })
                );
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

    // Handle pinned notes - for tag view, collect ALL pinned notes from all folders
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes);
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
