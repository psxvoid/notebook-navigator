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

import { IndexedDBStorage } from '../storage/IndexedDBStorage';
import { TagTreeNode } from '../types/storage';
import { isPathInExcludedFolder } from './fileFilters';
import { parsePatterns, matchesPattern } from './tagPatternMatcher';

/**
 * Tag Tree Utilities
 *
 * This module provides functions for building and managing hierarchical tag trees
 * from various data sources (vault files, database).
 */

// Cache for note counts to avoid recalculation
let noteCountCache: WeakMap<TagTreeNode, number> | null = null;

/**
 * Clear the note count cache
 */
export function clearNoteCountCache(): void {
    noteCountCache = null;
}

/**
 * Get or create the note count cache
 */
function getNoteCountCache(): WeakMap<TagTreeNode, number> {
    if (!noteCountCache) {
        noteCountCache = new WeakMap();
    }
    return noteCountCache;
}

/**
 * Build a tag tree from database using streaming (scalable for large vaults)
 * @param db - IndexedDBStorage instance
 * @param excludedFolderPatterns - Optional array of folder patterns to exclude
 * @returns Object containing the tag tree and untagged file count
 */
export function buildTagTreeFromDatabase(
    db: IndexedDBStorage,
    excludedFolderPatterns?: string[]
): { tree: Map<string, TagTreeNode>; untagged: number } {
    const allNodes = new Map<string, TagTreeNode>(); // All nodes at all levels
    const tree = new Map<string, TagTreeNode>(); // Only root-level nodes
    let untaggedCount = 0;

    // Track which case variant we saw first for each lowercased tag
    const caseMap = new Map<string, string>();

    // Get all files from cache
    const allFiles = db.getAllFiles();

    for (const { path, data: fileData } of allFiles) {
        // Skip files in excluded folders if patterns provided
        if (excludedFolderPatterns && isPathInExcludedFolder(path, excludedFolderPatterns)) {
            continue;
        }

        const tags = fileData.tags;

        // Skip files with null tags (not extracted yet) or empty tags
        if (tags === null || tags.length === 0) {
            // Only count as untagged if tags were extracted (not null)
            if (tags !== null) {
                untaggedCount++;
            }
            continue;
        }

        // Process each tag
        for (const tag of tags) {
            // Remove the # prefix if present
            const tagPath = tag.startsWith('#') ? tag.substring(1) : tag;
            const lowerPath = tagPath.toLowerCase();

            // Determine the canonical casing for this tag
            let canonicalPath = caseMap.get(lowerPath);
            if (!canonicalPath) {
                canonicalPath = tagPath;
                caseMap.set(lowerPath, tagPath);
            }

            // Split the tag into parts
            const parts = canonicalPath.split('/');
            let currentPath = '';

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                currentPath = i === 0 ? part : `${currentPath}/${part}`;
                const lowerCurrentPath = currentPath.toLowerCase();

                // Get or create the node
                let node = allNodes.get(lowerCurrentPath);
                if (!node) {
                    node = {
                        name: part,
                        path: currentPath,
                        children: new Map(),
                        notesWithTag: new Set()
                    };
                    allNodes.set(lowerCurrentPath, node);

                    // Only add root-level tags to the tree Map
                    if (i === 0) {
                        tree.set(lowerCurrentPath, node);
                    }
                }

                // Only add the file to the leaf tag (the exact tag it's tagged with)
                if (i === parts.length - 1) {
                    node.notesWithTag.add(path);
                }

                // Link to parent
                if (i > 0) {
                    const parentPath = parts.slice(0, i).join('/').toLowerCase();
                    const parent = allNodes.get(parentPath);
                    if (parent && !parent.children.has(lowerCurrentPath)) {
                        parent.children.set(lowerCurrentPath, node);
                    }
                }
            }
        }
    }

    // Clear note count cache since tree structure has changed
    clearNoteCountCache();

    return { tree, untagged: untaggedCount };
}

/**
 * Get the total number of notes for a tag (including all descendants)
 * Results are memoized for performance
 */
export function getTotalNoteCount(node: TagTreeNode): number {
    const cache = getNoteCountCache();

    // Check cache first
    const cachedCount = cache.get(node);
    if (cachedCount !== undefined) {
        return cachedCount;
    }

    // Calculate count
    let count = node.notesWithTag.size;

    // Collect all unique files from this node and all descendants
    const allFiles = new Set(node.notesWithTag);

    // Helper to collect files from children
    function collectFromChildren(n: TagTreeNode): void {
        for (const child of n.children.values()) {
            child.notesWithTag.forEach(file => allFiles.add(file));
            collectFromChildren(child);
        }
    }

    collectFromChildren(node);
    count = allFiles.size;

    // Cache the result
    cache.set(node, count);

    return count;
}

/**
 * Collect all tag paths from a node and its descendants
 */
export function collectAllTagPaths(node: TagTreeNode, paths: Set<string> = new Set()): Set<string> {
    paths.add(node.path);
    for (const child of node.children.values()) {
        collectAllTagPaths(child, paths);
    }
    return paths;
}

/**
 * Find a tag node by its path
 */
export function findTagNode(tree: Map<string, TagTreeNode>, tagPath: string): TagTreeNode | null {
    // Remove # prefix if present
    const cleanPath = tagPath.startsWith('#') ? tagPath.substring(1) : tagPath;
    const lowerPath = cleanPath.toLowerCase();

    // Helper function to search recursively
    function searchNode(nodes: Map<string, TagTreeNode>): TagTreeNode | null {
        for (const [key, node] of nodes) {
            if (key === lowerPath) {
                return node;
            }
            // Search in children
            const found = searchNode(node.children);
            if (found) {
                return found;
            }
        }
        return null;
    }

    return searchNode(tree);
}

/**
 * Filter tag tree based on inclusion patterns
 *
 * This function creates a new tree containing only tags that match the given patterns.
 * Key behaviors:
 * 1. Each tag is evaluated individually against all patterns
 * 2. Parent tags are included if they match OR if any descendant matches
 * 3. When a tag matches, its children are still evaluated individually (no automatic inclusion)
 *
 * Examples:
 * - Pattern "foto/kamera" → includes only "foto/kamera", not its children
 * - Pattern "foto/kamera/*" → includes "foto/kamera/fuji", "foto/kamera/sony", etc.
 * - Pattern "foto/*" → includes all direct children of "foto"
 *
 * @param tree - The original tag tree to filter
 * @param includePatterns - Array of pattern strings (exact, wildcard, or regex)
 * @returns A new filtered tree containing only matching tags and their ancestors
 */
export function filterTagTree(tree: Map<string, TagTreeNode>, includePatterns: string[]): Map<string, TagTreeNode> {
    if (includePatterns.length === 0) return tree;

    const filtered = new Map<string, TagTreeNode>();
    const parsedPatterns = parsePatterns(includePatterns);

    // Helper to check if a specific tag path matches any pattern
    function nodeMatchesPatterns(tagPath: string): boolean {
        return parsedPatterns.some(pattern => matchesPattern(tagPath, pattern));
    }

    // Helper to clone a node with filtered children
    // Key behavior: When a node matches, we still check each child individually
    // This prevents "foto/kamera" from automatically including "foto/kamera/fuji"
    function cloneNodeWithFilteredChildren(node: TagTreeNode): TagTreeNode | null {
        // Check if this specific node matches any pattern
        const nodeMatches = nodeMatchesPatterns(node.path);

        if (nodeMatches) {
            // IMPORTANT: Even though this node matches, we still check each child
            // Example: "foto/kamera" matches exact pattern "foto/kamera"
            //          but "foto/kamera/fuji" must be checked separately
            const filteredChildren = new Map<string, TagTreeNode>();

            for (const [childKey, child] of node.children) {
                const filteredChild = cloneNodeWithFilteredChildren(child);
                if (filteredChild) {
                    filteredChildren.set(childKey, filteredChild);
                }
            }

            return {
                name: node.name,
                path: node.path,
                children: filteredChildren,
                notesWithTag: node.notesWithTag
            };
        }

        // Node doesn't match, but check if any children should be included
        const filteredChildren = new Map<string, TagTreeNode>();
        for (const [childKey, child] of node.children) {
            const filteredChild = cloneNodeWithFilteredChildren(child);
            if (filteredChild) {
                filteredChildren.set(childKey, filteredChild);
            }
        }

        // If we have filtered children, include this node as their parent
        if (filteredChildren.size > 0) {
            return {
                name: node.name,
                path: node.path,
                children: filteredChildren,
                notesWithTag: node.notesWithTag
            };
        }

        return null;
    }

    // Process each root node
    for (const [key, node] of tree) {
        const filteredNode = cloneNodeWithFilteredChildren(node);
        if (filteredNode) {
            filtered.set(key, filteredNode);
        }
    }

    return filtered;
}

/**
 * Exclude tags from tree based on exclusion patterns
 *
 * Removes tags that match the patterns and all their descendants.
 * This is used for the "hidden tags" feature.
 *
 * Example: Pattern "private/*" removes "private/diary", "private/notes", etc.
 *
 * @param tree - The original tag tree
 * @param excludePatterns - Array of patterns to exclude
 * @returns A new tree with excluded tags removed
 */
export function excludeFromTagTree(tree: Map<string, TagTreeNode>, excludePatterns: string[]): Map<string, TagTreeNode> {
    if (excludePatterns.length === 0) return tree;

    const filtered = new Map<string, TagTreeNode>();
    const parsedPatterns = parsePatterns(excludePatterns);

    // Helper to recursively check and filter nodes
    // Returns null if node should be excluded, otherwise returns node with filtered children
    function shouldIncludeNode(node: TagTreeNode): TagTreeNode | null {
        // Check if this tag matches any exclusion pattern
        const shouldExclude = parsedPatterns.some(pattern => matchesPattern(node.path, pattern));

        if (shouldExclude) {
            return null;
        }

        // Process children
        const filteredChildren = new Map<string, TagTreeNode>();
        for (const [childKey, child] of node.children) {
            const filteredChild = shouldIncludeNode(child);
            if (filteredChild) {
                filteredChildren.set(childKey, filteredChild);
            }
        }

        // Return node with filtered children
        return {
            name: node.name,
            path: node.path,
            children: filteredChildren,
            notesWithTag: node.notesWithTag
        };
    }

    // Process each root node
    for (const [key, node] of tree) {
        const filteredNode = shouldIncludeNode(node);
        if (filteredNode) {
            filtered.set(key, filteredNode);
        }
    }

    return filtered;
}
