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

/**
 * Represents a node in the hierarchical tag tree.
 * Each node contains information about a tag and its nested children.
 */
export interface TagTreeNode {
    /** The name of this part of the tag (e.g., "processing" for "#inbox/processing") */
    name: string;
    /** The full path of the tag (e.g., "#inbox/processing") */
    path: string;
    /** Map of child tag nodes, keyed by their name */
    children: Map<string, TagTreeNode>;
    /** Set of file paths that have this exact tag */
    notesWithTag: Set<string>;
}

/**
 * Builds a hierarchical tree structure from flat tags.
 * Tags like "#inbox/processing" will create nested nodes.
 * 
 * @param allFiles - Array of markdown files to process
 * @param app - Obsidian app instance for metadata access
 * @returns Map of root-level tag nodes
 */
export function buildTagTree(allFiles: TFile[], app: App): Map<string, TagTreeNode> {
    const root = new Map<string, TagTreeNode>();
    
    // Early return for empty file list
    if (!allFiles || allFiles.length === 0) {
        return root;
    }
    
    const allTagsCache = new Map<string, Set<string>>();

    // First pass: collect all tags and their associated files
    for (const file of allFiles) {
        const cache = app.metadataCache.getFileCache(file);
        if (!cache) continue;
        
        const tags = getAllTags(cache);
        if (!tags || tags.length === 0) continue;
        
        for (const tag of tags) {
            // Skip empty or invalid tags
            if (!tag || tag.length <= 1) continue;
            
            if (!allTagsCache.has(tag)) {
                allTagsCache.set(tag, new Set());
            }
            allTagsCache.get(tag)!.add(file.path);
        }
    }

    // Second pass: build the tree structure
    allTagsCache.forEach((notes, tag) => {
        // Remove the # prefix and split by /
        const parts = tag.substring(1).split('/');
        let currentLevel = root;

        parts.forEach((part, index) => {
            // Rebuild the full path up to this point
            const currentPath = '#' + parts.slice(0, index + 1).join('/');

            if (!currentLevel.has(part)) {
                currentLevel.set(part, {
                    name: part,
                    path: currentPath,
                    children: new Map(),
                    notesWithTag: new Set(),
                });
            }

            const node = currentLevel.get(part)!;

            // If this is the last part, it's the actual tag with notes
            if (index === parts.length - 1) {
                node.notesWithTag = notes;
            }

            currentLevel = node.children;
        });
    });

    return root;
}

// Cache for total note counts to avoid recalculation
const noteCountCache = new WeakMap<TagTreeNode, number>();

/**
 * Gets the total count of notes for a tag node including all its children.
 * This is useful for showing aggregate counts in parent tags.
 * Uses memoization to improve performance.
 * 
 * @param node - The tag node to count
 * @returns Total number of notes with this tag or any child tags
 */
export function getTotalNoteCount(node: TagTreeNode): number {
    // Check cache first
    const cached = noteCountCache.get(node);
    if (cached !== undefined) {
        return cached;
    }
    
    let count = node.notesWithTag.size;
    
    for (const child of node.children.values()) {
        count += getTotalNoteCount(child);
    }
    
    // Cache the result
    noteCountCache.set(node, count);
    
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
 * 
 * @param path - The tag path to find (e.g., "#inbox/processing")
 * @param tree - The root tree to search in
 * @returns The tag node if found, null otherwise
 */
export function findTagNode(path: string, tree: Map<string, TagTreeNode>): TagTreeNode | null {
    // Validate input
    if (!path || path.length <= 1 || !path.startsWith('#')) {
        return null;
    }
    
    const parts = path.substring(1).split('/').filter(part => part.length > 0);
    if (parts.length === 0) {
        return null;
    }
    
    let currentLevel = tree;
    let currentNode: TagTreeNode | undefined;

    for (const part of parts) {
        currentNode = currentLevel.get(part);
        if (!currentNode) return null;
        currentLevel = currentNode.children;
    }

    return currentNode || null;
}