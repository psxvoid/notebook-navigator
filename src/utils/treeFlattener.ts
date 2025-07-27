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
import { getCurrentLanguage } from '../i18n';
import { NavigationPaneItemType } from '../types';
import { TagTreeNode } from '../types/storage';
import type { FolderTreeItem, TagTreeItem } from '../types/virtualization';
import { shouldExcludeFolder } from './fileFilters';

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
    visitedPaths: Set<string> = new Set()
): FolderTreeItem[] {
    const items: FolderTreeItem[] = [];

    // Folders are already sorted by the caller
    folders.forEach(folder => {
        // Prevent circular references
        if (visitedPaths.has(folder.path)) {
            // Circular reference detected, skip this folder
            return;
        }

        // Skip excluded folders
        if (excludePatterns.length > 0 && shouldExcludeFolder(folder.name, excludePatterns)) {
            return;
        }

        // Add the folder itself
        items.push({
            type: NavigationPaneItemType.FOLDER,
            data: folder,
            level,
            path: folder.path,
            key: folder.path
        });

        // Add children if expanded
        if (expandedFolders.has(folder.path) && folder.children && folder.children.length > 0) {
            const childFolders = folder.children.filter((child): child is TFolder => child instanceof TFolder);

            // Get the current language from Obsidian to sort correctly for that locale.
            const locale = getCurrentLanguage();
            // Sort the child folders alphabetically using the detected locale.
            childFolders.sort((a, b) => a.name.localeCompare(b.name, locale));

            if (childFolders.length > 0) {
                // Create a new set with the current path added
                const newVisitedPaths = new Set(visitedPaths);
                newVisitedPaths.add(folder.path);

                items.push(...flattenFolderTree(childFolders, expandedFolders, excludePatterns, level + 1, newVisitedPaths));
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
 * @returns Array of flattened tag items
 */
export function flattenTagTree(tagNodes: TagTreeNode[], expandedTags: Set<string>, level: number = 0): TagTreeItem[] {
    const items: TagTreeItem[] = [];

    // Sort tags alphabetically
    const sortedNodes = tagNodes.slice().sort((a, b) => a.name.localeCompare(b.name));

    function addNode(node: TagTreeNode, currentLevel: number) {
        items.push({
            type: NavigationPaneItemType.TAG,
            data: node,
            level: currentLevel,
            path: node.path,
            key: node.path
        });

        // Add children if expanded and has children
        if (expandedTags.has(node.path) && node.children && node.children.size > 0) {
            const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));

            sortedChildren.forEach(child => addNode(child, currentLevel + 1));
        }
    }

    sortedNodes.forEach(node => addNode(node, level));
    return items;
}
