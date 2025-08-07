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

import { App, TFolder } from 'obsidian';
import { CleanupValidators } from '../services/MetadataService';
import { TagTreeNode } from '../types/storage';
import { getDBInstance } from '../storage/fileOperations';

/**
 * Collects all existing vault paths (files and folders) for metadata cleanup validation
 * This ensures that metadata for empty folders is preserved during cleanup
 */
export function collectVaultPaths(app: App): Set<string> {
    // Get all markdown files
    const vaultPaths = new Set(app.vault.getMarkdownFiles().map(f => f.path));

    // Recursively add all folder paths
    const collectAllFolderPaths = (folder: TFolder) => {
        // Add the folder itself as a "file" so cleanup knows it exists
        // The FolderMetadataService will extract the folder path from this
        vaultPaths.add(folder.path + '/.placeholder');
        folder.children.forEach(child => {
            if (child instanceof TFolder) {
                collectAllFolderPaths(child);
            }
        });
    };
    collectAllFolderPaths(app.vault.getRoot());

    return vaultPaths;
}

/**
 * Prepares validators for metadata cleanup
 * @param app - Obsidian app instance
 * @param tagTree - Tag tree for tag metadata validation (empty Map if tags disabled)
 * @returns Validators object for cleanup
 */
export function prepareCleanupValidators(app: App, tagTree: Map<string, TagTreeNode> = new Map()): CleanupValidators {
    const db = getDBInstance();

    return {
        dbFiles: db.getAllFiles(),
        tagTree,
        vaultFiles: collectVaultPaths(app)
    };
}
