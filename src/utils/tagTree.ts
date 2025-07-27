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

import { App, TFile, getAllTags } from 'obsidian';
import { FileData, Database } from '../storage/database';
import { TagTreeNode } from '../types/storage';

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
 * Build a tag tree from an array of files
 * @param files - Array of TFile objects to process
 * @param app - Obsidian app instance
 * @returns Object containing the tag tree and untagged file count
 */
export function buildTagTree(files: TFile[], app: App): { tree: Map<string, TagTreeNode>; untagged: number } {
    const allNodes = new Map<string, TagTreeNode>(); // All nodes at all levels
    const tree = new Map<string, TagTreeNode>(); // Only root-level nodes
    let untaggedCount = 0;

    // Track which case variant we saw first for each lowercased tag
    const caseMap = new Map<string, string>();

    for (const file of files) {
        const metadata = app.metadataCache.getFileCache(file);
        const tags = metadata ? getAllTags(metadata) : [];

        if (!tags || tags.length === 0) {
            untaggedCount++;
            continue;
        }

        // Process each tag
        for (const tag of tags) {
            // Remove the # prefix
            const tagPath = tag.startsWith('#') ? tag.substring(1) : tag;
            const lowerPath = tagPath.toLowerCase();

            // Determine the canonical casing for this tag
            if (!caseMap.has(lowerPath)) {
                caseMap.set(lowerPath, tagPath);
            }
            const canonicalPath = caseMap.get(lowerPath)!;

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

                // Add the file to this node
                // For leaf tags, the file is directly tagged with this tag
                // For parent tags, we only add if it's the exact tag (not just an ancestor)
                if (i === parts.length - 1) {
                    node.notesWithTag.add(file.path);
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

    return { tree, untagged: untaggedCount };
}

/**
 * Build a tag tree from database using streaming (scalable for large vaults)
 * @param db - Database instance
 * @returns Object containing the tag tree and untagged file count
 */
export function buildTagTreeFromDatabase(db: Database): { tree: Map<string, TagTreeNode>; untagged: number } {
    const allNodes = new Map<string, TagTreeNode>(); // All nodes at all levels
    const tree = new Map<string, TagTreeNode>(); // Only root-level nodes
    let untaggedCount = 0;

    // Track which case variant we saw first for each lowercased tag
    const caseMap = new Map<string, string>();

    // Get all files from cache
    const allFiles = db.getAllFiles();

    for (const fileData of allFiles) {
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
            if (!caseMap.has(lowerPath)) {
                caseMap.set(lowerPath, tagPath);
            }
            const canonicalPath = caseMap.get(lowerPath)!;

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
                    node.notesWithTag.add(fileData.path);
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
    if (cache.has(node)) {
        return cache.get(node)!;
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
 * Parse tag patterns from a comma-separated string
 */
export function parseTagPatterns(patterns: string): string[] {
    return patterns
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

/**
 * Check if a tag matches a pattern (supports wildcards and regex)
 */
function matchesTagPattern(tagPath: string, pattern: string): boolean {
    // Remove # prefix from both if present
    const cleanTag = tagPath.startsWith('#') ? tagPath.substring(1) : tagPath;
    const cleanPattern = pattern.startsWith('#') ? pattern.substring(1) : pattern;

    // Check for regex pattern (starts and ends with /)
    if (cleanPattern.startsWith('/') && cleanPattern.endsWith('/')) {
        try {
            const regex = new RegExp(cleanPattern.slice(1, -1), 'i');
            return regex.test(cleanTag);
        } catch (e) {
            console.error('Invalid regex pattern:', cleanPattern, e);
            return false;
        }
    }

    // Convert wildcard pattern to regex
    // Escape special regex characters except *
    const escapedPattern = cleanPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escapedPattern}$`, 'i');
    return regex.test(cleanTag);
}

/**
 * Filter tag tree based on inclusion patterns
 */
export function filterTagTree(tree: Map<string, TagTreeNode>, includePatterns: string[]): Map<string, TagTreeNode> {
    if (includePatterns.length === 0) return tree;

    const filtered = new Map<string, TagTreeNode>();
    const patterns = parseTagPatterns(includePatterns.join(','));

    for (const [key, node] of tree) {
        // Check if this tag or any ancestor matches the patterns
        let shouldInclude = false;
        const pathParts = node.path.split('/');

        for (let i = pathParts.length; i > 0; i--) {
            const partialPath = pathParts.slice(0, i).join('/');
            if (patterns.some(pattern => matchesTagPattern(partialPath, pattern))) {
                shouldInclude = true;
                break;
            }
        }

        if (shouldInclude) {
            filtered.set(key, node);
        }
    }

    return filtered;
}

/**
 * Exclude tags from tree based on exclusion patterns
 */
export function excludeFromTagTree(tree: Map<string, TagTreeNode>, excludePatterns: string[]): Map<string, TagTreeNode> {
    if (excludePatterns.length === 0) return tree;

    const filtered = new Map<string, TagTreeNode>();
    const patterns = parseTagPatterns(excludePatterns.join(','));

    for (const [key, node] of tree) {
        // Check if this tag matches any exclusion pattern
        const shouldExclude = patterns.some(pattern => matchesTagPattern(node.path, pattern));

        if (!shouldExclude) {
            filtered.set(key, node);
        }
    }

    return filtered;
}
