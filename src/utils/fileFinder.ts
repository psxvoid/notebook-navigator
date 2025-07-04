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

import { TFile, TFolder, App, MetadataCache, getAllTags } from 'obsidian';
import { NotebookNavigatorSettings, SortOption } from '../settings';
import { isTFile, isTFolder } from './typeGuards';
import { parseExcludedProperties, shouldExcludeFile } from './fileFilters';
import { getEffectiveSortOption, sortFiles } from './sortUtils';
import { buildTagTree, findTagNode, collectAllTagPaths } from './tagUtils';
import { UNTAGGED_TAG_ID, isSupportedFileExtension } from '../types';
import { shouldDisplayFile, FILE_VISIBILITY } from './fileTypeUtils';

/**
 * Checks if a file is a folder note for the given folder
 */
export function isFolderNote(file: TFile, folder: TFolder, folderNoteName: string): boolean {
    // Must be directly in the folder
    if (file.parent?.path !== folder.path) {
        return false;
    }
    
    // Only markdown files can be folder notes
    if (file.extension !== 'md') {
        return false;
    }
    
    // If folderNoteName is empty, use the folder name
    const expectedName = folderNoteName || folder.name;
    return file.basename === expectedName;
}

/**
 * Gets the folder note for a folder if it exists
 */
export function getFolderNote(folder: TFolder, settings: NotebookNavigatorSettings, app: App): TFile | null {
    if (!settings.enableFolderNotes) {
        return null;
    }

    // Look for the folder note in the folder
    for (const child of folder.children) {
        // Only check files, not folders
        if (isTFile(child) && isFolderNote(child, folder, settings.folderNoteName)) {
            return child;
        }
    }
    
    return null;
}

/**
 * Collects files from a folder and optionally its subfolders
 */
export function collectFilesFromFolder(folder: TFolder, includeSubfolders: boolean, settings: NotebookNavigatorSettings, app: App): TFile[] {
    const files: TFile[] = [];
    
    const collectFiles = (f: TFolder): void => {
        for (const child of f.children) {
            if (isTFile(child)) {
                // Check if file should be displayed based on visibility setting
                if (shouldDisplayFile(child, settings.fileVisibility, app)) {
                    files.push(child);
                }
            } else if (includeSubfolders && isTFolder(child)) {
                collectFiles(child);
            }
        }
    };
    
    collectFiles(folder);
    return files;
}

/**
 * Separates files into pinned and unpinned arrays based on pinned paths
 */
export function separatePinnedFiles(files: TFile[], pinnedPaths: Set<string>): TFile[] {
    if (pinnedPaths.size === 0) {
        return files;
    }
    
    const pinnedFiles: TFile[] = [];
    const unpinnedFiles: TFile[] = [];
    
    for (const file of files) {
        if (pinnedPaths.has(file.path)) {
            pinnedFiles.push(file);
        } else {
            unpinnedFiles.push(file);
        }
    }
    
    return [...pinnedFiles, ...unpinnedFiles];
}

/**
 * Collects all pinned note paths from settings
 */
export function collectPinnedPaths(
    pinnedNotes: Record<string, string[]>, 
    folder?: TFolder, 
    includeSubfolders = false
): Set<string> {
    const allPinnedPaths = new Set<string>();
    
    if (folder) {
        // Collect from specific folder and optionally its subfolders
        const collectFromFolder = (f: TFolder): void => {
            const paths = pinnedNotes[f.path] || [];
            paths.forEach(p => allPinnedPaths.add(p));
            
            if (includeSubfolders) {
                for (const child of f.children) {
                    if (isTFolder(child)) {
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
export function getFilesForFolder(
    folder: TFolder,
    settings: NotebookNavigatorSettings,
    app: App
): TFile[] {
    const excludedProperties = parseExcludedProperties(settings.excludedFiles);
    
    let allFiles = collectFilesFromFolder(folder, settings.showNotesFromSubfolders, settings, app)
        .filter(file => !shouldExcludeFile(file, excludedProperties, app));
    
    // Filter out folder notes if enabled and set to hide
    if (settings.enableFolderNotes && settings.hideFolderNoteInList) {
        allFiles = allFiles.filter(file => {
            // Check if this file is a folder note for its parent folder
            if (file.parent && isTFolder(file.parent)) {
                return !isFolderNote(file, file.parent, settings.folderNoteName);
            }
            return true;
        });
    }
    
    const sortOption = getEffectiveSortOption(settings, 'folder', folder);
    sortFiles(allFiles, sortOption, settings, app.metadataCache);
    
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, folder, settings.showNotesFromSubfolders);
    const sortedFiles = separatePinnedFiles(allFiles, pinnedPaths);

    return sortedFiles;
}

/**
 * Gets a sorted list of files for a given tag, respecting all plugin settings.
 */
export function getFilesForTag(
    tag: string,
    settings: NotebookNavigatorSettings,
    app: App
): TFile[] {
    const excludedProperties = parseExcludedProperties(settings.excludedFiles);
    
    // Get all files based on visibility setting
    let allFiles: TFile[] = [];
    
    if (settings.fileVisibility === FILE_VISIBILITY.MARKDOWN) {
        // Only markdown files
        allFiles = app.vault.getMarkdownFiles();
    } else {
        // Get all files and filter based on visibility setting
        allFiles = app.vault.getFiles()
            .filter(file => shouldDisplayFile(file, settings.fileVisibility, app));
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
        const tagTree = buildTagTree(markdownFiles, app);
        
        // Find the selected tag node
        const selectedNode = findTagNode(tag, tagTree);
        
        if (selectedNode) {
            // Collect all tags to include (selected tag and all children)
            const tagsToInclude = collectAllTagPaths(selectedNode);
            
            // Create a lowercase set for case-insensitive comparison
            const tagsToIncludeLower = new Set(
                Array.from(tagsToInclude).map(tag => tag.toLowerCase())
            );
            
            // Filter files that have any of the collected tags (case-insensitive)
            filteredFiles = markdownFiles.filter(file => {
                const cache = app.metadataCache.getFileCache(file);
                const fileTags = cache ? getAllTags(cache) : null;
                return fileTags && fileTags.some(tag => {
                    // Remove # prefix from file tags before comparison
                    const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
                    return tagsToIncludeLower.has(cleanTag.toLowerCase());
                });
            });
        } else {
            // Fallback to empty if tag not found
            filteredFiles = [];
        }
    }
    
    // Sort files
    const sortOption = getEffectiveSortOption(settings, 'tag', null, tag);
    sortFiles(filteredFiles, sortOption, settings, app.metadataCache);
    
    // Handle pinned notes - for tag view, collect ALL pinned notes from all folders
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes);
    return separatePinnedFiles(filteredFiles, pinnedPaths);
}