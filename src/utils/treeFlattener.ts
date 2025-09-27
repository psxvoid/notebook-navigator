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

import { TFolder } from 'obsidian';
import { naturalCompare } from './sortUtils';
import { NavigationPaneItemType } from '../types';
import { TagTreeNode } from '../types/storage';
import type { FolderTreeItem, TagTreeItem } from '../types/virtualization';
import { isFolderInExcludedFolder } from './fileFilters';
import { matchesHiddenTagPattern, HiddenTagMatcher } from './tagPrefixMatcher';

interface FlattenFolderTreeOptions {
    rootOrderMap?: Map<string, number>;
}

function compareWithOrderMap(a: TFolder, b: TFolder, orderMap: Map<string, number>): number {
    const orderA = orderMap.get(a.path);
    const orderB = orderMap.get(b.path);

    if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
    }
    if (orderA !== undefined) {
        return -1;
    }
    if (orderB !== undefined) {
        return 1;
    }
    return naturalCompare(a.name, b.name);
}

/**
 * Flattens a folder tree into a linear array for virtualization.
 * Only includes folders that are visible based on the expanded state.
 *
 * @param folders - Array of root folders to flatten
 * @param expandedFolders - Set of expanded folder paths
 * @param excludePatterns - Patterns for folders to exclude
 * @param level - Current nesting level (for indentation)
 * @returns Array of flattened folder items
 */
export function flattenFolderTree(
    folders: TFolder[],
    expandedFolders: Set<string>,
    excludePatterns: string[],
    level: number = 0,
    visitedPaths: Set<string> = new Set(),
    options: FlattenFolderTreeOptions = {}
): FolderTreeItem[] {
    const items: FolderTreeItem[] = [];
    const { rootOrderMap } = options;

    const foldersToProcess =
        level === 0 && rootOrderMap && rootOrderMap.size > 0
            ? folders.slice().sort((a, b) => compareWithOrderMap(a, b, rootOrderMap))
            : folders;

    foldersToProcess.forEach(folder => {
        // Skip folders already visited to prevent infinite loops
        if (visitedPaths.has(folder.path)) {
            return;
        }

        // Check if folder matches exclusion patterns or is within an excluded parent
        const isExcluded = excludePatterns.length > 0 && isFolderInExcludedFolder(folder, excludePatterns);

        // Create folder item for display
        const folderItem: FolderTreeItem = {
            type: NavigationPaneItemType.FOLDER,
            data: folder,
            level,
            path: folder.path,
            key: folder.path
        };

        // Add exclusion flag for visual indication
        if (isExcluded) {
            folderItem.isExcluded = true;
        }

        items.push(folderItem);

        // Process child folders if this folder is expanded
        if (expandedFolders.has(folder.path) && folder.children && folder.children.length > 0) {
            const childFolders = folder.children.filter((child): child is TFolder => child instanceof TFolder);

            if (rootOrderMap && rootOrderMap.size > 0 && folder.path === '/') {
                childFolders.sort((a, b) => compareWithOrderMap(a, b, rootOrderMap));
            } else {
                childFolders.sort((a, b) => naturalCompare(a.name, b.name));
            }

            if (childFolders.length > 0) {
                // Track visited paths to prevent circular references
                const newVisitedPaths = new Set(visitedPaths);
                newVisitedPaths.add(folder.path);

                items.push(...flattenFolderTree(childFolders, expandedFolders, excludePatterns, level + 1, newVisitedPaths, options));
            }
        }
    });

    return items;
}

/**
 * Flattens a tag tree into a linear array for virtualization.
 * Only includes tags that are visible based on the expanded state.
 *
 * @param tagNodes - Array of root tag nodes to flatten
 * @param expandedTags - Set of expanded tag paths
 * @param level - Current nesting level (for indentation)
 * @param context - Whether these are favorite or regular tags
 * @param hiddenMatcher - Compiled matcher for tags that are normally hidden
 * @returns Array of flattened tag items
 */
export function flattenTagTree(
    tagNodes: TagTreeNode[],
    expandedTags: Set<string>,
    level: number = 0,
    context?: 'favorites' | 'tags',
    hiddenMatcher?: HiddenTagMatcher
): TagTreeItem[] {
    const items: TagTreeItem[] = [];

    // Sort tags alphabetically by name
    const sortedNodes = tagNodes.slice().sort((a, b) => naturalCompare(a.name, b.name));

    function addNode(node: TagTreeNode, currentLevel: number, parentHidden: boolean = false) {
        const matchesRule = hiddenMatcher ? matchesHiddenTagPattern(node.path, node.name, hiddenMatcher) : false;
        const isHidden = parentHidden || matchesRule;

        const item: TagTreeItem = {
            type: NavigationPaneItemType.TAG,
            data: node,
            level: currentLevel,
            path: node.path,
            key: node.path,
            context
        };

        // Mark tags that match hidden patterns (shows eye icon when visible)
        if (isHidden) {
            item.isHidden = true;
        }

        items.push(item);

        // Add children if expanded and has children
        if (expandedTags.has(node.path) && node.children && node.children.size > 0) {
            const sortedChildren = Array.from(node.children.values()).sort((a, b) => naturalCompare(a.name, b.name));

            sortedChildren.forEach(child => addNode(child, currentLevel + 1, isHidden));
        }
    }

    sortedNodes.forEach(node => addNode(node, level));
    return items;
}
