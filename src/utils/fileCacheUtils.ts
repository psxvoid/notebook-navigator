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

import { TFile, App, getAllTags } from 'obsidian';
import { STORAGE_KEYS } from '../types';

// Import cache types from centralized location
import { FileData, CacheNode, FileCache, isFileData, isCacheNode } from '../types/cache';
export type { FileData, CacheNode, FileCache } from '../types/cache';

// Re-export TagTreeNode for backward compatibility
export type { TagTreeNode } from '../types/cache';




/**
 * File Cache Utilities
 * 
 * This module contains functions for managing the hierarchical file cache
 * stored in localStorage. The cache mirrors the vault's folder structure
 * and stores metadata, preview text, and feature images for each file.
 * 
 * For tag-related utilities, see tagTreeUtils.ts
 */

export const CACHE_VERSION = 3;

/**
 * Loads the file cache from localStorage
 * @returns The cached data or null if not found/invalid
 */
export function loadFileCache(): FileCache | null {
    try {
        const cached = localStorage.getItem(STORAGE_KEYS.fileCacheKey);
        if (!cached) {
            return null;
        }
        
        const cache = JSON.parse(cached) as FileCache;
        
        // Validate cache structure
        if (!cache || typeof cache !== 'object') {
            console.warn('Invalid cache structure');
            return null;
        }
        
        // Validate cache version
        if (cache.version !== CACHE_VERSION) {
            console.log(`Cache version mismatch (${cache.version} vs ${CACHE_VERSION}), clearing cache`);
            return null;
        }
        
        // Validate that cache has required structure
        if (!cache.root || typeof cache.root !== 'object') {
            console.log(`Invalid cache structure, clearing cache`);
            return null;
        }
        
        return cache;
    } catch (error) {
        console.error('Error loading file cache:', error);
        return null;
    }
}

/**
 * Saves the file cache to localStorage
 * @param cache - The cache data to save
 */
export function saveFileCache(cache: FileCache): void {
    try {
        cache.version = CACHE_VERSION;
        cache.lastModified = Date.now();
        
        const serialized = JSON.stringify(cache);
        
        // Check size before saving (localStorage typically has 5-10MB limit)
        const sizeInBytes = new Blob([serialized]).size;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        if (sizeInMB > 4) {
            console.warn(`File cache is large (${sizeInMB.toFixed(2)}MB), consider optimizing`);
        }
        
        localStorage.setItem(STORAGE_KEYS.fileCacheKey, serialized);
        
    } catch (error) {
        console.error('Error saving file cache:', error);
        // If localStorage is full, try to clear the cache and continue without it
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            try {
                localStorage.removeItem(STORAGE_KEYS.fileCacheKey);
                console.warn('localStorage quota exceeded, cleared file cache');
            } catch (clearError) {
                // Ignore if we can't even clear
            }
        }
    }
}

/**
 * Helper function to find a file in the hierarchical cache
 * @param cache - The cache root node
 * @param filePath - The file path to find
 * @returns The file data if found, null otherwise
 */
export function findFileInCache(cache: CacheNode, filePath: string): FileData | null {
    const parts = filePath.split('/');
    let current = cache;
    
    // Navigate through folders
    for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        const next = current[folderName];
        
        if (!next || !isCacheNode(next)) {
            // Folder not found or it's a file
            return null;
        }
        
        current = next;
    }
    
    // Check for the file
    const fileName = parts[parts.length - 1];
    const fileNode = current[fileName];
    
    if (fileNode && isFileData(fileNode)) {
        return fileNode;
    }
    
    return null;
}

/**
 * Collects all file paths from the hierarchical cache
 * @param node - The cache node to traverse
 * @param path - Current path being built
 * @param paths - Set to collect paths into
 */
function collectAllPaths(node: CacheNode, path: string = '', paths: Set<string> = new Set()): Set<string> {
    for (const [key, value] of Object.entries(node)) {
        const fullPath = path ? `${path}/${key}` : key;
        
        if (isFileData(value)) {
            // It's a file
            paths.add(fullPath);
        } else if (isCacheNode(value)) {
            // It's a folder
            collectAllPaths(value, fullPath, paths);
        }
    }
    
    return paths;
}

/**
 * Calculates the diff between cached data and current vault state
 * @param cache - The hierarchical cache structure
 * @param currentFiles - Current markdown files in the vault
 * @param app - Obsidian app instance
 * @returns Files to add, update, and remove
 */
export function calculateFileCacheDiff(
    cache: FileCache,
    currentFiles: TFile[],
    _app: App
): {
    toAdd: TFile[];
    toUpdate: TFile[];
    toRemove: string[];
} {
    const toAdd: TFile[] = [];
    const toUpdate: TFile[] = [];
    const toRemove: string[] = [];
    
    // Create a set of current file paths for quick lookup
    const currentPaths = new Set(currentFiles.map(f => f.path));
    
    // Check each current file
    for (const file of currentFiles) {
        const cached = findFileInCache(cache.root, file.path);
        
        if (!cached) {
            // New file not in cache
            toAdd.push(file);
        } else if (file.stat.mtime !== cached.m) {
            // File modified since last cache
            toUpdate.push(file);
        }
    }
    
    // Check for deleted files
    const cachedPaths = collectAllPaths(cache.root);
    for (const path of cachedPaths) {
        if (!currentPaths.has(path)) {
            toRemove.push(path);
        }
    }
    
    
    return { toAdd, toUpdate, toRemove };
}


/**
 * Builds a hierarchical cache tree from files
 * @param files - Array of files to cache
 * @param app - Obsidian app instance
 * @returns Hierarchical cache structure
 */
export function buildCacheTree(files: TFile[], app: App): CacheNode {
    const root: CacheNode = {};
    
    for (const file of files) {
        const parts = file.path.split('/');
        let current = root;
        
        // Navigate/create folder structure
        for (let i = 0; i < parts.length - 1; i++) {
            const folderName = parts[i];
            if (!current[folderName]) {
                current[folderName] = {};
            }
            const next = current[folderName];
            if (!isCacheNode(next)) {
                throw new Error(`Expected folder but found file at ${folderName}`);
            }
            current = next;
        }
        
        // Add file data
        const fileName = parts[parts.length - 1];
        const cache = app.metadataCache.getFileCache(file);
        const tags = cache ? getAllTags(cache) : [];
        
        current[fileName] = {
            m: file.stat.mtime,
            t: tags ? tags.join(',') : '',
            p: '', // Preview text will be populated later
            f: '', // Feature image will be populated later
            g: 0 // No content generated yet
        };
    }
    
    return root;
}

// Re-export tag-related functions for backward compatibility
export {
    buildTagTree,
    buildTagTreeFromCache,
    clearNoteCountCache,
    getTotalNoteCount,
    collectAllTagPaths,
    findTagNode,
    countTotalTags,
    parseTagPatterns,
    matchesTagPattern,
    filterTagTree,
    excludeFromTagTree
} from './tagTreeUtils';