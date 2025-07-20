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
import { TagTreeNode, FileCache, CacheNode, isFileData, isCacheNode } from '../types/cache';

/**
 * Tag Tree Utilities
 * 
 * This module contains all functions related to building and managing
 * the hierarchical tag tree structure used in the navigation pane.
 * 
 * Key concepts:
 * - Tags are case-insensitive but preserve first-seen casing
 * - Hierarchical tags (e.g., #inbox/processing) create nested nodes
 * - Tag counts include all descendant notes
 * - Pattern matching supports wildcards and regex
 */

// Global cache for total note counts to avoid recalculation
let globalNoteCountCache: WeakMap<TagTreeNode, number> | undefined;

/**
 * Clears the note count cache. Should be called when rebuilding the tag tree
 * to prevent memory accumulation from old TagTreeNode references.
 */
export function clearNoteCountCache(): void {
    globalNoteCountCache = new WeakMap<TagTreeNode, number>();
}

// Get or create the note count cache
function getNoteCountCache(): WeakMap<TagTreeNode, number> {
    if (!globalNoteCountCache) {
        globalNoteCountCache = new WeakMap<TagTreeNode, number>();
    }
    return globalNoteCountCache;
}

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

/**
 * Builds tag tree from cached data
 * @param cache - The hierarchical cache structure
 * @returns Tag tree and untagged count
 */
export function buildTagTreeFromCache(
    cache: FileCache
): { tree: Map<string, TagTreeNode>, untagged: number } {
    const root = new Map<string, TagTreeNode>();
    const casingMap = new Map<string, string>();
    let untagged = 0;
    
    // Process files directly from hierarchical cache
    function processNode(node: CacheNode, path: string = ''): void {
        for (const [key, value] of Object.entries(node)) {
            const fullPath = path ? `${path}/${key}` : key;
            
            // Check if it's a file node
            if (isFileData(value)) {
                // It's a file
                const fileData = value;
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
            } else if (isCacheNode(value)) {
                // It's a folder, recurse
                processNode(value, fullPath);
            }
        }
    }
    
    processNode(cache.root);
    
    return { tree: root, untagged };
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
 * Filters tag patterns array to remove empty entries
 * @param patterns - Array of patterns
 * @returns Array of trimmed, non-empty patterns
 */
export function parseTagPatterns(patterns: string[] | undefined): string[] {
    if (!patterns) return [];
    return patterns.filter(p => p && p.trim());
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
            console.warn(`Invalid regex pattern: ${pattern}`);
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
        
        // If the node has no children and no notes after filtering, exclude it
        if (clone.children.size === 0 && clone.notesWithTag.size === 0) {
            return null;
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