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
let appId: string | null = null;

/**
 * Get the singleton IndexedDB storage instance.
 * Creates the instance on first call.
 *
 * @returns The global IndexedDB storage instance
 */
export function getDBInstance(): IndexedDBStorage {
    if (!dbInstance) {
        if (!appId) {
            throw new Error('Database not initialized. Call initializeCache with appId first.');
        }
        dbInstance = new IndexedDBStorage(appId);
    }
    return dbInstance;
}

/**
 * Initialize the database connection.
 * Must be called before using any other file operations.
 *
 * @param appIdParam - The app ID to use for database naming
 */
export async function initializeCache(appIdParam: string): Promise<void> {
    appId = appIdParam;
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
 * @param existingData - Pre-fetched map of existing file data
 */
export async function recordFileChanges(files: TFile[], existingData: Map<string, FileData>): Promise<void> {
    const db = getDBInstance();
    const updates: Array<{ path: string; data: FileData }> = [];

    for (const file of files) {
        const existing = existingData.get(file.path);

        if (!existing) {
            // New file - initialize with null content
            const fileData: FileData = {
                mtime: file.stat.mtime,
                tags: null, // ContentService will extract these
                preview: null, // ContentService will generate these
                featureImage: null, // ContentService will generate these
                metadata: null // ContentService will extract these
            };
            updates.push({ path: file.path, data: fileData });
        } else {
            // Existing file - check if actually modified
            const fileModified = existing.mtime !== file.stat.mtime;

            if (fileModified) {
                // File was modified - clear all content to trigger regeneration
                const fileData: FileData = {
                    mtime: file.stat.mtime, // Update to new mtime
                    tags: null, // Clear tags to regenerate
                    preview: null, // Clear preview to regenerate
                    featureImage: null, // Clear image to regenerate
                    metadata: null // Clear metadata to regenerate
                };
                updates.push({ path: file.path, data: fileData });
            } else {
                // File not modified (e.g., just a rename) - preserve content
                const fileData: FileData = {
                    mtime: file.stat.mtime,
                    tags: existing.tags,
                    preview: existing.preview,
                    featureImage: existing.featureImage,
                    metadata: existing.metadata
                };
                updates.push({ path: file.path, data: fileData });
            }
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
    const updates: Array<{ path: string; data: FileData }> = [];

    for (const file of files) {
        const existing = existingData.get(file.path);
        if (!existing) {
            // File not in database yet, record it
            updates.push({
                path: file.path,
                data: {
                    mtime: file.stat.mtime,
                    tags: null,
                    preview: null,
                    featureImage: null,
                    metadata: null
                }
            });
        } else {
            // For settings changes, we need a way to trigger regeneration
            // Update mtime to 0 to force ContentService to regenerate
            // This is better than clearing content as it avoids the double render
            updates.push({
                path: file.path,
                data: {
                    mtime: 0, // Force regeneration by setting mtime to 0
                    tags: existing.tags, // Keep existing tags
                    preview: existing.preview, // Keep existing preview
                    featureImage: existing.featureImage, // Keep existing image
                    metadata: existing.metadata // Keep existing metadata
                }
            });
        }
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
