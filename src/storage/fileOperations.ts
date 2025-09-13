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
 * - Used by: StorageContext, ContentProviders, DiffCalculator, Statistics
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
let isInitializing = false;
let isShuttingDown = false;

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
export async function initializeDatabase(appIdParam: string): Promise<void> {
    // Idempotent: if already initialized or in progress, skip
    if (isInitializing) return;
    const existing = dbInstance;
    if (existing && existing.isInitialized()) return;

    isInitializing = true;
    try {
        appId = appIdParam;
        const db = getDBInstance();
        await db.init();
    } finally {
        isInitializing = false;
    }
}

/**
 * Dispose the global database instance and clear module singletons.
 * Called on plugin unload to release IndexedDB connection and memory cache.
 */
export function shutdownDatabase(): void {
    // Idempotent: if already shut down or in progress, skip
    if (!dbInstance) {
        appId = null;
        return;
    }
    if (isShuttingDown) return;

    isShuttingDown = true;
    try {
        try {
            dbInstance.close();
        } catch (e) {
            console.error('Failed to close database on shutdown:', e);
        }
    } finally {
        dbInstance = null;
        appId = null;
        isShuttingDown = false;
    }
}

/**
 * Record file changes in the database.
 *
 * Behavior:
 * - New files: Initialize with null content fields for content generation
 * - Modified files: Skip update entirely, letting content providers detect mtime mismatch
 * - Unchanged files: Update the record (useful for sync scenarios)
 *
 * When files are modified, the database mtime is intentionally not updated.
 * This creates an mtime mismatch that content providers use to trigger regeneration.
 * Existing content remains visible until regeneration completes, avoiding UI flicker.
 *
 * @param files - Array of Obsidian files to record
 * @param existingData - Pre-fetched map of existing file data
 */
export async function recordFileChanges(files: TFile[], existingData: Map<string, FileData>): Promise<void> {
    const db = getDBInstance();
    const updates: { path: string; data: FileData }[] = [];

    for (const file of files) {
        const existing = existingData.get(file.path);

        if (!existing) {
            // New file - initialize with null content
            const fileData: FileData = {
                mtime: file.stat.mtime,
                tags: null, // TagContentProvider will extract these
                preview: null, // PreviewContentProvider will generate these
                featureImage: null, // FeatureImageContentProvider will generate these
                metadata: null // MetadataContentProvider will extract these
            };
            updates.push({ path: file.path, data: fileData });
        }
        // If file was actually modified (existing.mtime !== file.stat.mtime),
        // we intentionally skip the update. Content providers will detect
        // the mtime mismatch and regenerate content as needed.
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
 * - Updating mtime would make content providers think the file was modified
 * - We want to regenerate content with new settings, not because file changed
 *
 * When we DO update mtime:
 * - recordFileChanges(): When files are actually modified/added/renamed
 * - Content providers update mtime after generation to prevent re-processing
 *
 * @param files - Array of Obsidian files to mark for regeneration
 */
export async function markFilesForRegeneration(files: TFile[]): Promise<void> {
    const db = getDBInstance();
    const paths = files.map(f => f.path);
    const existingData = db.getFiles(paths);
    const updates: { path: string; data: FileData }[] = [];
    const mtimeOnlyUpdates: { path: string; mtime: number }[] = [];

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
            // Force regeneration by setting mtime to 0, without overwriting other fields
            mtimeOnlyUpdates.push({ path: file.path, mtime: 0 });
        }
    }

    if (updates.length > 0) {
        await db.setFiles(updates);
    }
    if (mtimeOnlyUpdates.length > 0) {
        await db.updateMtimes(mtimeOnlyUpdates);
    }
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
