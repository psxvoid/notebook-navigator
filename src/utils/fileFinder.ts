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
import { UNTAGGED_TAG_ID } from '../types';

/**
 * Collects files from a folder and optionally its subfolders
 */
function collectFilesFromFolder(folder: TFolder, includeSubfolders: boolean): TFile[] {
    const files: TFile[] = [];
    
    const collectFiles = (f: TFolder): void => {
        for (const child of f.children) {
            if (isTFile(child)) {
                // Only include supported file types
                if (child.extension === 'md' || child.extension === 'canvas' || 
                    child.extension === 'base' || child.extension === 'pdf') {
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
function separatePinnedFiles(files: TFile[], pinnedPaths: Set<string>): TFile[] {
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
function collectPinnedPaths(
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
    
    let allFiles = collectFilesFromFolder(folder, settings.showNotesFromSubfolders)
        .filter(file => !shouldExcludeFile(file, excludedProperties, app));
    
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
    
    // Get all markdown files that aren't excluded
    const allMarkdownFiles = app.vault.getMarkdownFiles()
        .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
    
    let allFiles: TFile[] = [];
    
    // Special case for untagged files
    if (tag === UNTAGGED_TAG_ID) {
        allFiles = allMarkdownFiles.filter(file => {
            const cache = app.metadataCache.getFileCache(file);
            const fileTags = cache ? getAllTags(cache) : null;
            return !fileTags || fileTags.length === 0;
        });
    } else {
        // Build the tag tree
        const tagTree = buildTagTree(allMarkdownFiles, app);
        
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
            allFiles = allMarkdownFiles.filter(file => {
                const cache = app.metadataCache.getFileCache(file);
                const fileTags = cache ? getAllTags(cache) : null;
                return fileTags && fileTags.some(tag => tagsToIncludeLower.has(tag.toLowerCase()));
            });
        } else {
            // Fallback to empty if tag not found
            allFiles = [];
        }
    }
    
    // Sort files
    const sortOption = getEffectiveSortOption(settings, 'tag', null);
    sortFiles(allFiles, sortOption, settings, app.metadataCache);
    
    // Handle pinned notes - for tag view, collect ALL pinned notes from all folders
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes);
    return separatePinnedFiles(allFiles, pinnedPaths);
}