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
import { findTagNode, collectAllTagPaths } from '../utils/tagTree';
import { ITagTreeProvider } from '../interfaces/ITagTreeProvider';

/**
 * Service that provides access to the tag tree from StorageContext
 * Acts as a bridge between React (StorageContext) and non-React code
 */
export class TagTreeService implements ITagTreeProvider {
    private tagTree: Map<string, TagTreeNode> = new Map();
    private favoriteTree: Map<string, TagTreeNode> = new Map();
    private untaggedCount = 0;

    /**
     * Updates the tag tree data from StorageContext
     * Called whenever StorageContext rebuilds the tag tree
     */
    updateTagTree(tree: Map<string, TagTreeNode>, untagged: number, favoriteTree?: Map<string, TagTreeNode>): void {
        this.tagTree = tree;
        this.untaggedCount = untagged;
        if (favoriteTree) {
            this.favoriteTree = favoriteTree;
        }
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
     * Finds a tag node by its path, searching both favorite and regular trees
     */
    findTagNode(tagPath: string): TagTreeNode | null {
        // First check favorite tree
        const favoriteNode = findTagNode(this.favoriteTree, tagPath);
        if (favoriteNode) {
            return favoriteNode;
        }
        // Then check regular tree
        return findTagNode(this.tagTree, tagPath);
    }

    /**
     * Gets all tag paths in both trees
     */
    getAllTagPaths(): string[] {
        const allPaths: string[] = [];
        // Collect from favorite tree
        for (const rootNode of this.favoriteTree.values()) {
            const paths = collectAllTagPaths(rootNode);
            allPaths.push(...paths);
        }
        // Collect from regular tree
        for (const rootNode of this.tagTree.values()) {
            const paths = collectAllTagPaths(rootNode);
            allPaths.push(...paths);
        }
        return allPaths;
    }

    /**
     * Collects all tag paths from a specific node and its descendants
     */
    collectTagPaths(node: TagTreeNode): Set<string> {
        return collectAllTagPaths(node);
    }
}
