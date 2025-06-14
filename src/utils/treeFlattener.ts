import { TFolder } from 'obsidian';
import type { FolderTreeItem, TagTreeItem } from '../types/virtualization';
import { TagTreeNode } from './tagUtils';
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
            console.warn(`Circular reference detected for folder: ${folder.path}`);
            return;
        }
        
        // Skip excluded folders
        if (excludePatterns.length > 0 && shouldExcludeFolder(folder.name, excludePatterns)) {
            return;
        }
        
        // Add the folder itself
        items.push({
            type: 'folder',
            data: folder,
            level,
            path: folder.path,
            key: folder.path
        });
        
        // Add children if expanded
        if (expandedFolders.has(folder.path) && folder.children.length > 0) {
            const childFolders = folder.children
                .filter(child => child instanceof TFolder) as TFolder[];
            
            if (childFolders.length > 0) {
                // Create a new set with the current path added
                const newVisitedPaths = new Set(visitedPaths);
                newVisitedPaths.add(folder.path);
                
                items.push(...flattenFolderTree(
                    childFolders,
                    expandedFolders,
                    excludePatterns,
                    level + 1,
                    newVisitedPaths
                ));
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
export function flattenTagTree(
    tagNodes: TagTreeNode[],
    expandedTags: Set<string>,
    level: number = 0
): TagTreeItem[] {
    const items: TagTreeItem[] = [];
    
    // Sort tags alphabetically
    const sortedNodes = tagNodes.slice().sort((a, b) => 
        a.name.localeCompare(b.name)
    );
    
    function addNode(node: TagTreeNode, currentLevel: number) {
        items.push({
            type: 'tag',
            data: node,
            level: currentLevel,
            path: node.path,
            key: node.path
        });
        
        // Add children if expanded and has children
        if (expandedTags.has(node.path) && node.children.size > 0) {
            const sortedChildren = Array.from(node.children.values())
                .sort((a, b) => a.name.localeCompare(b.name));
            
            sortedChildren.forEach(child => 
                addNode(child, currentLevel + 1)
            );
        }
    }
    
    sortedNodes.forEach(node => addNode(node, level));
    return items;
}

/**
 * Finds the index of a specific folder in a flattened folder list.
 * 
 * @param items - The flattened folder list
 * @param folderPath - The path of the folder to find
 * @returns The index of the folder, or -1 if not found
 */
export function findFolderIndex(
    items: FolderTreeItem[],
    folderPath: string | null
): number {
    if (!folderPath) return -1;
    
    return items.findIndex(item => 
        item.type === 'folder' && item.data.path === folderPath
    );
}

/**
 * Finds the index of a specific tag in a flattened tag list.
 * 
 * @param items - The flattened tag list
 * @param tagPath - The path of the tag to find
 * @returns The index of the tag, or -1 if not found
 */
export function findTagIndex(
    items: TagTreeItem[],
    tagPath: string | null
): number {
    if (!tagPath) return -1;
    
    return items.findIndex(item => {
        if (item.type !== 'tag') return false;
        const tagNode = item.data as TagTreeNode;
        return tagNode.path === tagPath;
    });
}