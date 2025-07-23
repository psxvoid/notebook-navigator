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

import { getDBInstance } from './fileOperations';
import { FileData } from './database';

/**
 * Statistics - Cache analytics and monitoring
 *
 * What it does:
 * - Calculates statistics about cached content for user insights
 * - Counts files with preview text, feature images, and metadata
 * - Estimates total cache size in megabytes
 *
 * Relationships:
 * - Used by: Settings UI (displays cache statistics)
 * - Uses: Database (streams file data for analysis)
 *
 * Key responsibilities:
 * - Stream through all cached files without loading into memory
 * - Count content types (previews, images, metadata)
 * - Calculate total storage size using JSON serialization
 * - Return statistics for display in settings
 */

export interface CacheStatistics {
    totalItems: number;
    itemsWithPreview: number;
    itemsWithFeature: number;
    itemsWithMetadata: number;
    totalSizeMB: number;
}

/**
 * Calculate statistics from the database.
 * Streams through all files to count items and estimate storage size.
 *
 * @returns Cache statistics or null on error
 */
export function calculateCacheStatistics(): CacheStatistics | null {
    try {
        const db = getDBInstance();

        const stats: CacheStatistics = {
            totalItems: 0,
            itemsWithPreview: 0,
            itemsWithFeature: 0,
            itemsWithMetadata: 0,
            totalSizeMB: 0
        };

        let totalSize = 0;

        // Get all files from cache
        const allFiles = db.getAllFiles();

        for (const fileData of allFiles) {
            stats.totalItems++;

            // Check for preview text (not null and not empty)
            if (fileData.preview && fileData.preview.length > 0) {
                stats.itemsWithPreview++;
            }

            // Check for feature image (not null and not empty)
            if (fileData.featureImage && fileData.featureImage.length > 0) {
                stats.itemsWithFeature++;
            }

            // Check for metadata (not null)
            if (fileData.metadata) {
                stats.itemsWithMetadata++;
            }

            // Estimate size
            totalSize += JSON.stringify(fileData).length;
        }

        // Calculate cache size in MB
        stats.totalSizeMB = totalSize / 1024 / 1024;

        return stats;
    } catch (error) {
        console.error('Failed to calculate cache statistics:', error);
        return null;
    }
}
