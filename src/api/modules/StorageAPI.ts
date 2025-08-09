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

import { TFile } from 'obsidian';
import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import type { CachedFileData, FileQueryOptions } from '../types';

/**
 * Storage API - Access cached file data
 */
export class StorageAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Get cached data for a file
     */
    async getFileData(_filePath: string): Promise<CachedFileData | null> {
        // This would need access to the IndexedDB storage
        // For now, return null - would need to expose storage through plugin
        return null;
    }

    /**
     * Query files with specific criteria
     */
    async queryFiles(options: FileQueryOptions): Promise<TFile[]> {
        const files: TFile[] = [];
        const vault = this.api.app.vault;

        // Get all markdown files
        const allFiles = vault.getMarkdownFiles();

        for (const file of allFiles) {
            let matches = true;

            // Check folder
            if (options.folder) {
                const folder = file.parent;
                if (!folder || !folder.path.startsWith(options.folder)) {
                    matches = false;
                }
            }

            // Check tags
            if (matches && options.tag) {
                const cache = this.api.app.metadataCache.getFileCache(file);
                const tags = cache?.tags?.map(t => t.tag) || [];
                if (!tags.includes(options.tag)) {
                    matches = false;
                }
            }

            if (matches) {
                files.push(file);
            }

            // Apply limit
            if (options.limit && files.length >= options.limit) {
                break;
            }
        }

        return files;
    }

    /**
     * Force regeneration of cached content for files
     */
    async regenerateContent(_filePaths: string[]): Promise<void> {
        // This would trigger content regeneration
        // Would need to expose ContentProviderRegistry through plugin
    }

    /**
     * Check if storage is ready
     */
    isStorageReady(): boolean {
        // Would need to check storage context state
        return true;
    }
}
