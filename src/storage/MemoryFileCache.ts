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

import { FileData, FileDataCache } from './IndexedDBStorage';

// Creates a deep clone of FileData to prevent mutations from affecting the original
function cloneFileData(data: FileDataCache): FileDataCache {
    const cloneArray = <T>(arr: null|readonly T[]) => arr ? [...arr] : null;
    return {
        mtime: data.mtime,
        tags: cloneArray(data.tags),
        preview: data.preview,
        featureImage: data.featureImage,
        featureImageProvider: data.featureImageProvider,
        featureImageConsumers: cloneArray(data.featureImageConsumers),
        metadata: data.metadata ? { ...data.metadata } : null
    };
}

function isFileData(data: FileDataCache | FileData): data is FileData {
    return (data as FileData).featureImageResized !== undefined
}

function stripFileData(data: FileDataCache | FileData): data is FileDataCache {
    if (isFileData(data)) {
        delete data.featureImageResized
        return true
    }

    return false
}

/**
 * In-memory file cache that mirrors the IndexedDB storage for synchronous access.
 * This cache stores all file data in RAM to enable synchronous reads during rendering,
 * eliminating async operations in React components and fixing virtualizer height calculations.
 *
 * Memory usage is minimal - even 100k files at ~300 bytes each = 30MB RAM.
 */
export class MemoryFileCache {
    private memoryMap: Map<string, FileDataCache> = new Map();
    private isInitialized = false;

    /**
     * Initialize the cache by loading all data from IndexedDB.
     * This is called once during database initialization.
     */
    initialize(filesWithPaths: { path: string; data: FileData }[]): void {
        // Clear any existing data
        this.memoryMap.clear();

        // Load all files into memory
        for (const { path, data } of filesWithPaths) {
            this.memoryMap.set(path, data);
        }

        this.isInitialized = true;
    }

    /**
     * Get file data synchronously.
     */
    getFile(path: string): FileDataCache | null {
        return this.memoryMap.get(path) || null;
    }

    /**
     * Get multiple files synchronously.
     */
    getFiles(paths: readonly string[]): Map<string, FileDataCache> {
        const result = new Map<string, FileDataCache>();
        for (const path of paths) {
            const file = this.memoryMap.get(path);
            if (file) {
                result.set(path, file);
            }
        }
        return result;
    }

    /**
     * Check if a file has preview text.
     */
    hasPreview(path: string): boolean {
        const file = this.memoryMap.get(path);
        return !!file?.preview;
    }

    /**
     * Check if a file exists in the cache.
     */
    hasFile(path: string): boolean {
        return this.memoryMap.has(path);
    }

    /**
     * Get all files as an array (use sparingly).
     */
    getAllFiles(): FileDataCache[] {
        return Array.from(this.memoryMap.values());
    }

    /**
     * Get all files with their paths.
     */
    getAllFilesWithPaths(): { path: string; data: FileDataCache }[] {
        const result: { path: string; data: FileDataCache }[] = [];
        for (const [path, data] of this.memoryMap.entries()) {
            result.push({ path, data });
        }
        return result;
    }

    /**
     * Update or add a file in the cache.
     */
    updateFile(path: string, data: FileData): void {
        stripFileData(data)
        this.memoryMap.set(path, data);
    }

    // Sets a cloned copy of file data to prevent external modifications
    setClonedFile(path: string, data: FileDataCache): void {
        this.memoryMap.set(path, cloneFileData(data));
    }

    /**
     * Update specific file content fields.
     */
    updateFileContent(
        path: string,
        updates: {
            preview?: string;
            featureImage?: string;
            metadata?: FileData['metadata'];
        }
    ): void {
        const existing = this.memoryMap.get(path);
        if (existing) {
            // Update specific fields
            if (updates.preview !== undefined) existing.preview = updates.preview;
            if (updates.featureImage !== undefined) existing.featureImage = updates.featureImage;
            if (updates.metadata !== undefined) existing.metadata = updates.metadata;
        }
    }

    /**
     * Delete a file from the cache.
     */
    deleteFile(path: string): void {
        this.memoryMap.delete(path);
    }

    /**
     * Batch delete multiple files from the cache.
     */
    batchDelete(paths: string[]): void {
        for (const path of paths) {
            this.memoryMap.delete(path);
        }
    }

    /**
     * Batch update multiple files.
     */
    batchUpdate(updates: { path: string; data: FileDataCache }[]): void {
        for (const { path, data } of updates) {
            this.memoryMap.set(path, cloneFileData(data));
        }
    }

    /**
     * Batch update file content fields.
     */
    batchUpdateFileContent(
        updates: {
            path: string;
            preview?: string;
            featureImage?: string;
            metadata?: FileData['metadata'];
        }[]
    ): void {
        for (const update of updates) {
            this.updateFileContent(update.path, update);
        }
    }

    /**
     * Clear specific content type from all files.
     */
    clearAllFileContent(type: 'preview' | 'featureImage' | 'metadata' | 'all'): void {
        for (const file of this.memoryMap.values()) {
            if (type === 'all' || type === 'preview') file.preview = null;
            if (type === 'all' || type === 'featureImage') file.featureImage = null;
            if (type === 'all' || type === 'metadata') file.metadata = null;
        }
    }

    /**
     * Get cache statistics.
     */
    getStats(): { fileCount: number; memoryUsageEstimate: number } {
        const fileCount = this.memoryMap.size;

        // Rough estimate: 300 bytes per file
        const memoryUsageEstimate = fileCount * 300;

        return { fileCount, memoryUsageEstimate };
    }

    /**
     * Check if cache is initialized.
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Clear the entire cache (used during cleanup).
     */
    clear(): void {
        this.memoryMap.clear();
        this.isInitialized = false;
    }
}
