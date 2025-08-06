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

import { TFile, getAllTags, CachedMetadata } from 'obsidian';
import { ContentType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';
import { FileData } from '../../storage/IndexedDBStorage';
import { getDBInstance } from '../../storage/fileOperations';
import { BaseContentProvider } from './BaseContentProvider';

/**
 * Content provider for extracting tags from files
 */
export class TagContentProvider extends BaseContentProvider {
    getContentType(): ContentType {
        return 'tags';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return ['showTags'];
    }

    shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean {
        // Clear if tags are disabled
        if (!newSettings.showTags && oldSettings.showTags) {
            return true;
        }

        // Regenerate if tags are enabled and weren't before
        if (newSettings.showTags && !oldSettings.showTags) {
            return true;
        }

        return false;
    }

    async clearContent(): Promise<void> {
        const db = getDBInstance();
        await db.batchClearAllFileContent('tags');
    }

    protected needsProcessing(fileData: FileData | null, file: TFile, settings: NotebookNavigatorSettings): boolean {
        if (!settings.showTags) {
            return false;
        }

        const fileModified = fileData !== null && fileData.mtime !== file.stat.mtime;
        return !fileData || fileData.tags === null || fileModified;
    }

    protected async processFile(
        job: { file: TFile; path: string[] },
        fileData: FileData | null,
        settings: NotebookNavigatorSettings
    ): Promise<{
        path: string;
        tags?: string[] | null;
        preview?: string;
        featureImage?: string;
        metadata?: FileData['metadata'];
    } | null> {
        if (!settings.showTags) {
            return null;
        }

        try {
            const metadata = this.app.metadataCache.getFileCache(job.file);
            const tags = this.extractTagsFromMetadata(metadata);

            // Only return update if tags changed
            if (fileData && this.tagsEqual(fileData.tags, tags)) {
                return null;
            }

            return {
                path: job.file.path,
                tags
            };
        } catch (error) {
            console.error(`Error extracting tags for ${job.file.path}:`, error);
            return null;
        }
    }

    /**
     * Extract tags from cached metadata.
     *
     * Tags are returned with their original casing as found in the vault,
     * without the # prefix. For example, "#ToDo" becomes "ToDo".
     *
     * The tag tree building process will later normalize these to lowercase
     * for the `path` property while preserving the original casing in `displayPath`.
     *
     * @param metadata - Cached metadata from Obsidian's metadata cache
     * @returns Array of tag strings without # prefix, in original casing
     */
    private extractTagsFromMetadata(metadata: CachedMetadata | null): string[] {
        const rawTags = metadata ? getAllTags(metadata) : [];
        // Remove # prefix for consistency with how we store tags
        return rawTags?.map(tag => (tag.startsWith('#') ? tag.slice(1) : tag)) || [];
    }

    /**
     * Check if two tag arrays are equal.
     * Handles null values properly.
     *
     * @param tags1 - First tag array (can be null)
     * @param tags2 - Second tag array (can be null)
     * @returns True if tags are equal
     */
    private tagsEqual(tags1: string[] | null, tags2: string[] | null): boolean {
        if (tags1 === tags2) return true; // Both null or same reference
        if (tags1 === null || tags2 === null) return false; // One is null
        if (tags1.length !== tags2.length) return false;
        return tags1.every((tag, i) => tag === tags2[i]);
    }
}
