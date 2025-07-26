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
import { Database, FileData } from './database';

/**
 * FileOperations - Database access layer and cache management
 *
 * What it does:
 * - Manages singleton database instance
 * - Provides simplified API for file operations
 * - Handles content invalidation when files change
 *
 * Relationships:
 * - Uses: Database (maintains singleton instance)
 * - Used by: StorageContext, ContentService, DiffCalculator, Statistics
 *
 * Key responsibilities:
 * - Initialize and provide database access
 * - Extract tags from Obsidian metadata
 * - Detect file modifications and clear stale content
 * - Batch update files efficiently
 * - Clear content when mtime or tags change
 */

// Global database instance
let dbInstance: Database | null = null;

/**
 * Get the singleton database instance.
 * Creates the instance on first call.
 *
 * @returns The global database instance
 */
export function getDBInstance(): Database {
    if (!dbInstance) {
        dbInstance = new Database();
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
 * Add or update multiple files in the database.
 * More efficient than multiple updateFileInCache calls.
 * Clears content for modified files or files with changed tags.
 *
 * @param files - Array of Obsidian files to update
 * @param app - The Obsidian app instance
 */
export async function updateFilesInCache(files: TFile[], app: App): Promise<void> {
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
        const tagsChanged = existing && (existing.tags.length !== tags.length || !existing.tags.every(tag => tags.includes(tag)));

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
            mtime: file.stat.mtime,
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
