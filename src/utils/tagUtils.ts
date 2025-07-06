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

/**
 * Represents a node in the hierarchical tag tree.
 * Each node contains information about a tag and its nested children.
 */
export interface TagTreeNode {
    /** The name of this part of the tag (e.g., "processing" for "inbox/processing") */
    name: string;
    /** The full path of the tag without # prefix (e.g., "inbox/processing") */
    path: string;
    /** Map of child tag nodes, keyed by their name */
    children: Map<string, TagTreeNode>;
    /** Set of file paths that have this exact tag */
    notesWithTag: Set<string>;
}

// Extend global type for our cache
declare global {
    var __tagUtilsNoteCountCache: WeakMap<TagTreeNode, number> | undefined;
}

/**
 * Represents cached file metadata for tag processing (used internally)
 */
interface CachedFileData {
    /** Last modification time of the file */
    mtime: number;
    /** Array of tags found in the file */
    tags: string[];
}

/**
 * Represents file data in the hierarchical cache
 */
interface FileData {
    /** Last modification time (m for mtime) */
    m: number;
    /** Tags as comma-separated string (t for tags) */
    t: string;
}

/**
 * Represents a node in the hierarchical cache structure
 */
interface CacheNode {
    [key: string]: CacheNode | FileData;
}

/**
 * Structure for the tag cache stored in localStorage
 */
export interface TagCache {
    /** Version number for cache format migrations */
    version: number;
    /** Timestamp when cache was last updated */
    lastModified: number;
    /** Hierarchical tree structure of the cache */
    root: CacheNode;
    /** Number of untagged files */
    untaggedCount: number;
}

const CACHE_VERSION = 1;

/**
 * Builds a hierarchical tree structure from flat tags.
 * Tags like "#inbox/processing" will create nested nodes.
 * Tags are case-insensitive - #Tag and #TAG are treated as the same tag.
 * The first-seen casing is preserved for display.
 * 
 * @param allFiles - Array of markdown files to process
 * @param app - Obsidian app instance for metadata access
 * @returns Map of root-level tag nodes
 */
export function buildTagTree(allFiles: TFile[], app: App): Map<string, TagTreeNode> {
    const root = new Map<string, TagTreeNode>();
    // Track first-seen casing for each tag part
    const casingMap = new Map<string, string>();
    
    // Early return for empty file list
    if (!allFiles || allFiles.length === 0) {
        return root;
    }
    
    // Single pass: build tree and collect files
    for (const file of allFiles) {
        const cache = app.metadataCache.getFileCache(file);
        if (!cache) continue;
        
        const tags = getAllTags(cache);
        if (!tags || tags.length === 0) continue;
        
        for (const tag of tags) {
            // Skip empty or invalid tags
            if (!tag || tag.length <= 1) continue;
            
            // Remove the # prefix and split by /
            const parts = tag.substring(1).split('/');
            let currentLevel = root;
            let pathParts: string[] = [];

            parts.forEach((part, index) => {
                const lowerPart = part.toLowerCase();
                
                // Track first-seen casing
                if (!casingMap.has(lowerPart)) {
                    casingMap.set(lowerPart, part);
                }
                
                // Use the preserved casing
                const displayPart = casingMap.get(lowerPart)!;
                pathParts.push(displayPart);
                
                // Rebuild the full path up to this point with preserved casing (without #)
                const currentPath = pathParts.join('/');

                // Use lowercase key for case-insensitive lookup
                let node = currentLevel.get(lowerPart);
                
                if (!node) {
                    node = {
                        name: displayPart,
                        path: currentPath,
                        children: new Map(),
                        notesWithTag: new Set(),
                    };
                    currentLevel.set(lowerPart, node);
                }

                // If this is the last part, add the file to this tag
                if (index === parts.length - 1) {
                    node.notesWithTag.add(file.path);
                }

                currentLevel = node.children;
            });
        }
    }

    return root;
}

// Cache for total note counts to avoid recalculation
const noteCountCache = new WeakMap<TagTreeNode, number>();

/**
 * Clears the note count cache. Should be called when rebuilding the tag tree
 * to prevent memory accumulation from old TagTreeNode references.
 */
export function clearNoteCountCache(): void {
    // WeakMap doesn't have a clear method, so we create a new instance
    // The old cache will be garbage collected when all references are gone
    // This is a workaround but necessary for proper memory management
    globalThis.__tagUtilsNoteCountCache = new WeakMap<TagTreeNode, number>();
}

// Use the global cache instance
function getNoteCountCache(): WeakMap<TagTreeNode, number> {
    if (!globalThis.__tagUtilsNoteCountCache) {
        globalThis.__tagUtilsNoteCountCache = new WeakMap<TagTreeNode, number>();
    }
    return globalThis.__tagUtilsNoteCountCache;
}

/**
 * Gets the total count of notes for a tag node including all its children.
 * This is useful for showing aggregate counts in parent tags.
 * Uses memoization to improve performance.
 * 
 * @param node - The tag node to count
 * @returns Total number of notes with this tag or any child tags
 */
export function getTotalNoteCount(node: TagTreeNode): number {
    const cache = getNoteCountCache();
    
    // Check cache first
    const cached = cache.get(node);
    if (cached !== undefined) {
        return cached;
    }
    
    let count = node.notesWithTag.size;
    
    for (const child of node.children.values()) {
        count += getTotalNoteCount(child);
    }
    
    // Cache the result
    cache.set(node, count);
    
    return count;
}

/**
 * Collects all tag paths from a node and its descendants.
 * Used when filtering files by a parent tag.
 * 
 * @param node - The root node to start from
 * @param paths - Set to collect paths into (optional)
 * @returns Set of all tag paths in this subtree
 */
export function collectAllTagPaths(node: TagTreeNode, paths: Set<string> = new Set()): Set<string> {
    paths.add(node.path);
    
    for (const child of node.children.values()) {
        collectAllTagPaths(child, paths);
    }
    
    return paths;
}

/**
 * Finds a tag node by its path in the tree.
 * Uses case-insensitive matching for tag paths.
 * 
 * @param path - The tag path to find (e.g., "inbox/processing")
 * @param tree - The root tree to search in
 * @returns The tag node if found, null otherwise
 */
export function findTagNode(path: string, tree: Map<string, TagTreeNode>): TagTreeNode | null {
    // Validate input
    if (!path || path.length === 0) {
        return null;
    }
    
    const parts = path.split('/').filter(part => part.length > 0);
    if (parts.length === 0) {
        return null;
    }
    
    let currentLevel = tree;
    let currentNode: TagTreeNode | undefined;

    for (const part of parts) {
        // Use lowercase for case-insensitive lookup
        currentNode = currentLevel.get(part.toLowerCase());
        if (!currentNode) return null;
        currentLevel = currentNode.children;
    }

    return currentNode || null;
}

/**
 * Loads the tag cache from localStorage
 * @returns The cached data or null if not found/invalid
 */
export function loadTagCache(): TagCache | null {
    try {
        const cached = localStorage.getItem(STORAGE_KEYS.tagCacheKey);
        if (!cached) {
            return null;
        }
        
        const cache = JSON.parse(cached) as TagCache;
        
        // Validate cache version
        if (cache.version !== CACHE_VERSION) {
            return null;
        }
        
        // Validate that cache has required structure
        if (!cache.root || typeof cache.root !== 'object') {
            return null;
        }
        
        return cache;
    } catch (error) {
        console.error('[NotebookNavigator] Error loading tag cache:', error);
        return null;
    }
}

/**
 * Saves the tag cache to localStorage
 * @param cache - The cache data to save
 */
export function saveTagCache(cache: TagCache): void {
    try {
        cache.version = CACHE_VERSION;
        cache.lastModified = Date.now();
        
        const serialized = JSON.stringify(cache);
        
        // Check size before saving (localStorage typically has 5-10MB limit)
        const sizeInBytes = new Blob([serialized]).size;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        if (sizeInMB > 4) {
            console.warn(`[NotebookNavigator] Tag cache is large (${sizeInMB.toFixed(2)}MB), consider optimizing`);
        }
        
        localStorage.setItem(STORAGE_KEYS.tagCacheKey, serialized);
        
    } catch (error) {
        console.error('[NotebookNavigator] Error saving tag cache:', error);
        // If localStorage is full, try to clear the cache and continue without it
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            try {
                localStorage.removeItem(STORAGE_KEYS.tagCacheKey);
                console.warn('[NotebookNavigator] localStorage quota exceeded, cleared tag cache');
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
function findFileInCache(cache: CacheNode, filePath: string): FileData | null {
    const parts = filePath.split('/');
    let current = cache;
    
    // Navigate through folders
    for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        const next = current[folderName];
        
        if (!next || typeof next !== 'object' || 'm' in next) {
            // Folder not found or it's a file
            return null;
        }
        
        current = next as CacheNode;
    }
    
    // Check for the file
    const fileName = parts[parts.length - 1];
    const fileNode = current[fileName];
    
    if (fileNode && typeof fileNode === 'object' && 'm' in fileNode) {
        return fileNode as FileData;
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
        
        if (typeof value === 'object' && 'm' in value) {
            // It's a file
            paths.add(fullPath);
        } else {
            // It's a folder
            collectAllPaths(value as CacheNode, fullPath, paths);
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
export function calculateTagCacheDiff(
    cache: TagCache,
    currentFiles: TFile[],
    app: App
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
 * Builds tag tree from cached data
 * @param cache - The hierarchical cache structure
 * @returns Tag tree and untagged count
 */
export function buildTagTreeFromCache(
    cache: TagCache
): { tree: Map<string, TagTreeNode>, untagged: number } {
    const root = new Map<string, TagTreeNode>();
    const casingMap = new Map<string, string>();
    let untagged = 0;
    
    // Process files directly from hierarchical cache
    function processNode(node: CacheNode, path: string = ''): void {
        for (const [key, value] of Object.entries(node)) {
            const fullPath = path ? `${path}/${key}` : key;
            
            // Check if it's a file node (has 'm' property)
            if (typeof value === 'object' && 'm' in value && typeof value.m === 'number') {
                // It's a file
                const fileData = value as FileData;
                const tags = fileData.t ? fileData.t.split(',') : [];
                
                if (tags.length === 0) {
                    untagged++;
                    continue;
                }
                
                for (const tag of tags) {
                    // Skip empty or invalid tags
                    if (!tag || tag.length <= 1) continue;
                    
                    // Remove the # prefix and split by /
                    const parts = tag.substring(1).split('/');
                    let currentLevel = root;
                    let pathParts: string[] = [];

                    parts.forEach((part, index) => {
                        const lowerPart = part.toLowerCase();
                        
                        // Track first-seen casing
                        if (!casingMap.has(lowerPart)) {
                            casingMap.set(lowerPart, part);
                        }
                        
                        // Use the preserved casing
                        const displayPart = casingMap.get(lowerPart)!;
                        pathParts.push(displayPart);
                        
                        // Rebuild the full path up to this point with preserved casing
                        const currentPath = pathParts.join('/');

                        // Use lowercase key for case-insensitive lookup
                        let tagNode = currentLevel.get(lowerPart);
                        
                        if (!tagNode) {
                            tagNode = {
                                name: displayPart,
                                path: currentPath,
                                children: new Map(),
                                notesWithTag: new Set(),
                            };
                            currentLevel.set(lowerPart, tagNode);
                        }

                        // If this is the last part, add the file to this tag
                        if (index === parts.length - 1) {
                            tagNode.notesWithTag.add(fullPath);
                        }

                        currentLevel = tagNode.children;
                    });
                }
            } else {
                // It's a folder, recurse
                processNode(value as CacheNode, fullPath);
            }
        }
    }
    
    processNode(cache.root);
    
    return { tree: root, untagged };
}

/**
 * Counts total number of tags in the tree (including nested tags)
 * @param tree - The root tag tree
 * @returns Total number of unique tags
 */
export function countTotalTags(tree: Map<string, TagTreeNode>): number {
    let count = 0;
    
    function countNode(node: TagTreeNode): void {
        count++;
        for (const child of node.children.values()) {
            countNode(child);
        }
    }
    
    for (const node of tree.values()) {
        countNode(node);
    }
    
    return count;
}

/**
 * Parses a comma-separated string of patterns into an array
 * @param patternsString - Comma-separated patterns
 * @returns Array of trimmed, non-empty patterns
 */
export function parseTagPatterns(patternsString: string | undefined): string[] {
    if (!patternsString) return [];
    
    return patternsString
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

/**
 * Checks if a tag path matches a given pattern
 * @param tagPath - The tag path to check (without # prefix)
 * @param pattern - The pattern to match against
 * @returns true if the tag matches the pattern
 */
export function matchesTagPattern(tagPath: string, pattern: string): boolean {
    // Remove # if present
    const cleanTag = tagPath.startsWith('#') ? tagPath.slice(1) : tagPath;
    pattern = pattern.trim();
    
    // Empty pattern matches nothing
    if (!pattern) return false;
    
    // Regex pattern (wrapped in /)
    if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
        try {
            const regex = new RegExp(pattern.slice(1, -1));
            return regex.test(cleanTag);
        } catch (e) {
            // Invalid regex, treat as literal
            console.warn(`[NotebookNavigator] Invalid regex pattern: ${pattern}`);
            return false;
        }
    }
    
    // Wildcard pattern
    if (pattern.includes('*')) {
        // Escape special regex chars except *
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\*/g, '.*'); // Convert * to .*
        try {
            return new RegExp(`^${regexPattern}$`).test(cleanTag);
        } catch (e) {
            return false;
        }
    }
    
    // Exact match (case-insensitive)
    return cleanTag.toLowerCase() === pattern.toLowerCase();
}

/**
 * Filters a tag tree based on patterns
 * @param tree - The tag tree to filter
 * @param patterns - Array of patterns to match
 * @returns A new filtered tag tree containing only matching tags and their children
 */
export function filterTagTree(tree: Map<string, TagTreeNode>, patterns: string[]): Map<string, TagTreeNode> {
    if (!patterns || patterns.length === 0) {
        return tree;
    }
    
    const filteredTree = new Map<string, TagTreeNode>();
    
    // Helper function to check if a node or any of its descendants match
    function nodeMatchesOrHasMatchingDescendant(node: TagTreeNode): boolean {
        // Check if this node matches any pattern
        if (patterns.some(pattern => matchesTagPattern(node.path, pattern))) {
            return true;
        }
        
        // Check if any child matches
        for (const child of node.children.values()) {
            if (nodeMatchesOrHasMatchingDescendant(child)) {
                return true;
            }
        }
        
        return false;
    }
    
    // Helper function to clone a node with filtered children
    function cloneNodeWithFilteredChildren(node: TagTreeNode): TagTreeNode {
        const clone: TagTreeNode = {
            name: node.name,
            path: node.path,
            children: new Map(),
            notesWithTag: new Set(node.notesWithTag)
        };
        
        // Add children that match or have matching descendants
        for (const [key, child] of node.children) {
            if (nodeMatchesOrHasMatchingDescendant(child)) {
                clone.children.set(key, cloneNodeWithFilteredChildren(child));
            }
        }
        
        return clone;
    }
    
    // Process root level nodes
    for (const [key, node] of tree) {
        if (nodeMatchesOrHasMatchingDescendant(node)) {
            filteredTree.set(key, cloneNodeWithFilteredChildren(node));
        }
    }
    
    return filteredTree;
}

/**
 * Excludes tags from a tree based on patterns
 * @param tree - The tag tree to filter
 * @param patterns - Array of patterns to exclude
 * @returns A new tag tree excluding tags that match patterns
 */
export function excludeFromTagTree(tree: Map<string, TagTreeNode>, patterns: string[]): Map<string, TagTreeNode> {
    if (!patterns || patterns.length === 0) {
        return tree;
    }
    
    const excludedTree = new Map<string, TagTreeNode>();
    
    // Helper function to check if a node matches any pattern
    function nodeMatches(node: TagTreeNode): boolean {
        return patterns.some(pattern => matchesTagPattern(node.path, pattern));
    }
    
    // Helper function to clone a node with filtered children
    function cloneNodeWithFilteredChildren(node: TagTreeNode): TagTreeNode | null {
        // If this node matches, exclude it entirely
        if (nodeMatches(node)) {
            return null;
        }
        
        const clone: TagTreeNode = {
            name: node.name,
            path: node.path,
            children: new Map(),
            notesWithTag: new Set(node.notesWithTag)
        };
        
        // Process children, excluding those that match
        for (const [key, child] of node.children) {
            const clonedChild = cloneNodeWithFilteredChildren(child);
            if (clonedChild) {
                clone.children.set(key, clonedChild);
            }
        }
        
        return clone;
    }
    
    // Process root level nodes
    for (const [key, node] of tree) {
        const clonedNode = cloneNodeWithFilteredChildren(node);
        if (clonedNode) {
            excludedTree.set(key, clonedNode);
        }
    }
    
    return excludedTree;
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
            current = current[folderName] as CacheNode;
        }
        
        // Add file data
        const fileName = parts[parts.length - 1];
        const cache = app.metadataCache.getFileCache(file);
        const tags = cache ? getAllTags(cache) : [];
        
        current[fileName] = {
            m: file.stat.mtime,
            t: tags ? tags.join(',') : ''
        };
    }
    
    return root;
}

