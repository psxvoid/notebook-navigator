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

/**
 * File cache system type definitions
 * These types support the hierarchical cache structure used for tags and previews
 */

/**
 * Binary flags for tracking generated content
 */
export const GENERATED_FLAGS = {
    PREVIEW: 1,    // 0001
    FEATURE: 2,    // 0010
    METADATA: 4    // 0100
} as const;

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

/**
 * Represents file data in the hierarchical cache
 * Uses short property names to minimize localStorage usage
 */
export interface FileData {
    /** Last modification time (m for mtime) */
    m: number;
    /** Tags as comma-separated string (t for tags) */
    t: string;
    /** Preview text (p for preview) */
    p: string;
    /** Feature image URL (f for feature) */
    f: string;
    /** Frontmatter name (fn for frontmatter name) */
    fn?: string;
    /** Frontmatter created timestamp in ms (fc for frontmatter created) */
    fc?: number;
    /** Frontmatter modified timestamp in ms (fm for frontmatter modified) */
    fm?: number;
    /** 
     * Generated flag (g for generated) - binary flags indicating what was generated
     * 0 = nothing generated
     * 1 = preview generated (PREVIEW flag)
     * 2 = feature image generated (FEATURE flag)
     * 4 = metadata generated (METADATA flag)
     * 7 = all generated (PREVIEW | FEATURE | METADATA)
     */
    g?: number;
}

/**
 * Represents a node in the hierarchical cache structure
 * Can contain either folders (more CacheNodes) or files (FileData)
 */
export interface CacheNode {
    [key: string]: CacheNode | FileData;
}

/**
 * Structure for the file cache stored in localStorage
 */
export interface FileCache {
    /** Version number for cache format migrations */
    version: number;
    /** Timestamp when cache was last updated */
    lastModified: number;
    /** Hierarchical tree structure of the cache */
    root: CacheNode;
    /** Number of untagged files */
    untaggedCount: number;
    /** Whether content (preview/images) has been generated */
    contentGenerated: boolean;
}

/**
 * Type guard to check if a cache node is file data
 */
export function isFileData(node: unknown): node is FileData {
    return node !== null && 
           typeof node === 'object' && 
           'm' in node &&
           typeof (node as any).m === 'number' &&
           't' in node &&
           typeof (node as any).t === 'string' &&
           'p' in node &&
           typeof (node as any).p === 'string' &&
           'f' in node &&
           typeof (node as any).f === 'string';
}

/**
 * Type guard to check if a cache node is a folder (contains other nodes)
 */
export function isCacheNode(node: unknown): node is CacheNode {
    return node !== null && 
           typeof node === 'object' && 
           !isFileData(node);
}