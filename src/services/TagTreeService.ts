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

import { TagTreeNode } from '../types/storage';
import { findTagNode, collectAllTagPaths, collectTagFilePaths } from '../utils/tagTree';
import { ITagTreeProvider } from '../interfaces/ITagTreeProvider';
import { naturalCompare } from '../utils/sortUtils';

/**
 * Service that provides access to the tag tree from StorageContext
 * Acts as a bridge between React (StorageContext) and non-React code
 */
export class TagTreeService implements ITagTreeProvider {
    private tagTree: Map<string, TagTreeNode> = new Map();
    private taggedCount = 0;
    private untaggedCount = 0;
    private flattenedTags: TagTreeNode[] = [];
    private cachedTagPaths: string[] | null = null;

    /**
     * Updates the tag tree data from StorageContext
     * Called whenever StorageContext rebuilds the tag tree
     */
    updateTagTree(tree: Map<string, TagTreeNode>, tagged: number, untagged: number): void {
        this.tagTree = tree;
        this.taggedCount = tagged;
        this.untaggedCount = untagged;
        this.flattenedTags = this.flattenTagTree(tree);
        this.cachedTagPaths = null;
    }

    /**
     * Gets the current tag tree
     */
    getTagTree(): Map<string, TagTreeNode> {
        return this.tagTree;
    }

    /**
     * Gets the count of untagged files
     */
    getUntaggedCount(): number {
        return this.untaggedCount;
    }

    /**
     * Finds a tag node by its path within the tag tree
     */
    findTagNode(tagPath: string): TagTreeNode | null {
        return findTagNode(this.tagTree, tagPath);
    }

    /**
     * Gets all tag paths in the tree
     */
    getAllTagPaths(): string[] {
        if (!this.cachedTagPaths) {
            this.cachedTagPaths = this.flattenedTags.map(node => node.path);
        }
        return this.cachedTagPaths;
    }

    /**
     * Gets all tag nodes in a flattened array, sorted alphabetically
     */
    getFlattenedTagNodes(): readonly TagTreeNode[] {
        return this.flattenedTags;
    }

    /**
     * Collects all tag paths from a specific node and its descendants
     */
    collectTagPaths(node: TagTreeNode): Set<string> {
        return collectAllTagPaths(node);
    }

    /**
     * Collects file paths for the specified tag and its descendants.
     */
    collectTagFilePaths(tagPath: string): string[] {
        const node = this.findTagNode(tagPath);
        if (!node) {
            return [];
        }
        const files = collectTagFilePaths(node);
        return Array.from(files);
    }
    /**
     * Gets the count of tagged files
     */
    getTaggedCount(): number {
        return this.taggedCount;
    }

    /**
     * Flattens the tag tree into a sorted array of all tag nodes
     * Traverses the tree depth-first and collects all nodes with valid display paths
     */
    private flattenTagTree(tree: Map<string, TagTreeNode>): TagTreeNode[] {
        if (tree.size === 0) {
            return [];
        }

        const nodes: TagTreeNode[] = [];
        const stack: TagTreeNode[] = [];
        const visited = new Set<TagTreeNode>();
        // Initialize stack with all root nodes
        for (const rootNode of tree.values()) {
            stack.push(rootNode);
        }

        // Depth-first traversal to collect all nodes
        while (stack.length > 0) {
            const node = stack.pop();
            if (!node) {
                continue;
            }
            if (visited.has(node)) {
                continue;
            }
            visited.add(node);
            // Only include nodes with valid display paths
            if (node.displayPath && node.displayPath.length > 0) {
                nodes.push(node);
            }
            // Add children to stack for processing
            node.children.forEach(child => {
                stack.push(child);
            });
        }

        // Sort all collected nodes alphabetically by display path
        nodes.sort((a, b) => naturalCompare(a.displayPath, b.displayPath));
        return nodes;
    }
}
