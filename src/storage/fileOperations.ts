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
import { IndexedDBStorage, FileData } from './IndexedDBStorage';

/**
 * FileOperations - IndexedDB storage access layer and cache management
 *
 * What it does:
 * - Manages singleton IndexedDB storage instance
 * - Provides simplified API for file operations
 * - Handles content invalidation when files change
 *
 * Relationships:
 * - Uses: IndexedDBStorage (maintains singleton instance)
 * - Used by: StorageContext, ContentService, DiffCalculator, Statistics
 *
 * Key responsibilities:
 * - Initialize and provide database access
 * - Extract tags from Obsidian metadata
 * - Detect file modifications and clear stale content
 * - Batch update files efficiently
 * - Clear content when mtime or tags change
 */

// Global IndexedDB storage instance
let dbInstance: IndexedDBStorage | null = null;

/**
 * Get the singleton IndexedDB storage instance.
 * Creates the instance on first call.
 *
 * @returns The global IndexedDB storage instance
 */
export function getDBInstance(): IndexedDBStorage {
    if (!dbInstance) {
        dbInstance = new IndexedDBStorage();
    }
    return dbInstance;
}

/**
 * Initialize the database connection.
 * Must be called before using any other file operations.
 */
export async function initializeCache(): Promise<void> {
    const db = getDBInstance();
    await db.init();
}

/**
 * Record file changes in the database.
 * Sets all content fields to null to trigger regeneration by ContentService.
 * This is used when files are added, modified, or renamed.
 *
 * Updates mtime to match the file's actual modification time because:
 * - The file content has actually changed
 * - We use mtime to detect future changes (compare DB mtime vs file mtime)
 * - ContentService will update mtime again after generation to prevent loops
 *
 * @param files - Array of Obsidian files to record
 */
export async function recordFileChanges(files: TFile[]): Promise<void> {
    const db = getDBInstance();
    const updates: FileData[] = [];

    // Get existing data to preserve content for modified files
    const paths = files.map(f => f.path);
    const existingData = db.getFiles(paths);

    for (const file of files) {
        const existing = existingData.get(file.path);

        if (!existing) {
            // New file - initialize with null content
            const fileData: FileData = {
                path: file.path,
                mtime: file.stat.mtime,
                tags: null, // ContentService will extract these
                preview: null, // ContentService will generate these
                featureImage: null, // ContentService will generate these
                metadata: null // ContentService will extract these
            };
            updates.push(fileData);
        } else {
            // Existing file - preserve content, update mtime
            // ContentService will detect the mtime change and regenerate content
            const fileData: FileData = {
                path: file.path,
                mtime: file.stat.mtime, // Update to new mtime
                tags: existing.tags, // Keep existing tags until regenerated
                preview: existing.preview, // Keep existing preview
                featureImage: existing.featureImage, // Keep existing image
                metadata: existing.metadata // Keep existing metadata
            };
            updates.push(fileData);
        }
    }

    await db.setFiles(updates);
}

/**
 * Mark files for content regeneration without updating mtime.
 * This preserves existing file data but clears content fields.
 * Used when settings change and content needs to be regenerated.
 *
 * Why we preserve mtime:
 * - The file hasn't actually changed, only our settings have
 * - Updating mtime would make ContentService think the file was modified
 * - We want to regenerate content with new settings, not because file changed
 *
 * When we DO update mtime:
 * - recordFileChanges(): When files are actually modified/added/renamed
 * - ContentService.updateMtimes(): After content generation to prevent re-processing
 *
 * @param files - Array of Obsidian files to mark for regeneration
 */
export async function markFilesForRegeneration(files: TFile[]): Promise<void> {
    const db = getDBInstance();
    const paths = files.map(f => f.path);
    const existingData = db.getFiles(paths);
    const updates: FileData[] = [];

    for (const file of files) {
        const existing = existingData.get(file.path);
        if (!existing) {
            // File not in database yet, record it
            updates.push({
                path: file.path,
                mtime: file.stat.mtime,
                tags: null,
                preview: null,
                featureImage: null,
                metadata: null
            });
        } else {
            // For settings changes, we need a way to trigger regeneration
            // Update mtime to 0 to force ContentService to regenerate
            // This is better than clearing content as it avoids the double render
            updates.push({
                path: existing.path,
                mtime: 0, // Force regeneration by setting mtime to 0
                tags: existing.tags, // Keep existing tags
                preview: existing.preview, // Keep existing preview
                featureImage: existing.featureImage, // Keep existing image
                metadata: existing.metadata // Keep existing metadata
            });
        }
    }

    await db.setFiles(updates);
}

/**
 * @deprecated Use recordFileChanges or markFilesForRegeneration instead
 *
 * Add or update multiple files in the database.
 * More efficient than multiple updateFileInCache calls.
 * Clears content for modified files or files with changed tags.
 *
 * @param files - Array of Obsidian files to update
 * @param app - The Obsidian app instance
 * @param preserveMtime - If true, preserves existing mtime to prevent race conditions during content generation
 */
export async function updateFilesInCache(files: TFile[], app: App, preserveMtime: boolean = false): Promise<void> {
    const db = getDBInstance();
    const updates: FileData[] = [];

    // Get existing data for all files
    const paths = files.map(f => f.path);
    const existingData = db.getFiles(paths);

    // Get feature image properties from settings (we need to import settings)
    const featureImageProperties = ['featureResized', 'feature']; // Default from settings

    for (const file of files) {
        const metadata = app.metadataCache.getFileCache(file);
        // getAllTags returns tags with # prefix, but we store them without it for consistency
        const rawTags = metadata ? getAllTags(metadata) : [];
        const tags = rawTags?.map(tag => (tag.startsWith('#') ? tag.slice(1) : tag)) || [];
        const existing = existingData.get(file.path);

        // Check if file was modified (mtime changed) or tags changed
        const wasModified = existing && existing.mtime !== file.stat.mtime;
        const tagsChanged =
            existing && existing.tags !== null && (existing.tags.length !== tags.length || !existing.tags.every(tag => tags.includes(tag)));

        // Check if feature image properties changed or were added
        // We need to detect both: when properties are first added and when they change
        let featureImageChanged = false;
        if (metadata?.frontmatter) {
            // Check if any feature image properties exist in frontmatter
            const hasFeatureImageProps = featureImageProperties.some(prop => metadata.frontmatter![prop] !== undefined);

            if (hasFeatureImageProps) {
                // If we have feature image properties and either:
                // 1. File was modified (properties might have changed)
                // 2. We don't have a feature image yet (properties were just added)
                if (wasModified || !existing?.featureImage) {
                    featureImageChanged = true;
                }
            }
        }

        const fileData: FileData = {
            path: file.path,
            // Use existing mtime if preserveMtime is true, otherwise use current mtime
            mtime: preserveMtime && existing ? existing.mtime : file.stat.mtime,
            tags: tags || [],
            // Always preserve existing preview - regeneration handled by ContentService
            preview: existing?.preview ?? null,
            // Clear feature image if properties changed so it gets regenerated
            featureImage: featureImageChanged ? null : (existing?.featureImage ?? null),
            metadata: existing?.metadata ?? null
        };

        updates.push(fileData);
    }

    await db.setFiles(updates);
}

/**
 * Remove files from the database.
 *
 * @param paths - Array of file paths to remove
 */
export async function removeFilesFromCache(paths: string[]): Promise<void> {
    const db = getDBInstance();
    await db.deleteFiles(paths);
}
