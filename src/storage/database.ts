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

import { DatabaseCache } from './DatabaseCache';

const DB_NAME = 'notebook-navigator-db-v1';
const STORE_NAME = 'files';

export interface FileData {
    path: string; // File path (primary key)
    mtime: number;
    tags: string[];
    preview: string | null; // null = not generated yet
    featureImage: string | null; // null = not generated yet
    metadata: {
        name?: string;
        created?: number;
        modified?: number;
    } | null; // null = not generated yet
}

export interface FileContentChange {
    path: string;
    changes: {
        preview?: string | null;
        featureImage?: string | null;
        metadata?: FileData['metadata'] | null;
        tags?: string[];
    };
    changeType?: 'metadata' | 'content' | 'both';
}

/**
 * Database - IndexedDB wrapper for persistent file storage
 *
 * What it does:
 * - Stores file metadata and generated content (previews, images, frontmatter)
 * - Provides efficient batch operations for large vaults
 * - Emits real-time change notifications for UI updates
 *
 * Relationships:
 * - Used by: StorageContext, ContentService, FileOperations, Statistics
 * - Core storage layer that all other components depend on
 *
 * Key responsibilities:
 * - Manage IndexedDB connection lifecycle
 * - CRUD operations for file records (single and batch)
 * - Stream large datasets without loading into memory
 * - Track and notify about content changes
 * - Provide indexed queries (by tag, by content type)
 */
export class Database {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    private changeListeners = new Set<(changes: FileContentChange[]) => void>();
    private fileChangeListeners = new Map<string, Set<(changes: FileContentChange['changes']) => void>>();
    private cache: DatabaseCache = new DatabaseCache();

    /**
     * Subscribe to content change notifications.
     * Listeners are called whenever file content (preview, image, metadata) is updated.
     *
     * @param listener - Function to call with content changes
     * @returns Unsubscribe function
     */
    onContentChange(listener: (changes: FileContentChange[]) => void): () => void {
        this.changeListeners.add(listener);
        return () => this.changeListeners.delete(listener);
    }

    /**
     * Subscribe to content change notifications for a specific file.
     * More efficient than onContentChange as it only receives changes for the specified file.
     *
     * @param path - File path to listen for changes
     * @param listener - Function to call with content changes for this file
     * @returns Unsubscribe function
     */
    onFileContentChange(path: string, listener: (changes: FileContentChange['changes']) => void): () => void {
        let fileListeners = this.fileChangeListeners.get(path);
        if (!fileListeners) {
            fileListeners = new Set();
            this.fileChangeListeners.set(path, fileListeners);
        }
        fileListeners.add(listener);

        return () => {
            const listeners = this.fileChangeListeners.get(path);
            if (listeners) {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    this.fileChangeListeners.delete(path);
                }
            }
        };
    }

    /**
     * Emit content changes to all registered listeners.
     * Catches and logs any errors in listeners to prevent cascading failures.
     *
     * @param changes - Array of content changes to emit
     */
    private emitChanges(changes: FileContentChange[]): void {
        if (changes.length === 0) return;
        // Only log batch operations or errors
        if (changes.length > 1) {
        }

        // Emit to global listeners (for backward compatibility)
        this.changeListeners.forEach(listener => {
            try {
                listener(changes);
            } catch (error) {
                console.error('Error in change listener:', error);
            }
        });

        // Emit to file-specific listeners
        for (const change of changes) {
            const fileListeners = this.fileChangeListeners.get(change.path);
            if (fileListeners) {
                fileListeners.forEach(listener => {
                    try {
                        listener(change.changes);
                    } catch (error) {
                        console.error('Error in file change listener:', error);
                    }
                });
            }
        }
    }

    /**
     * Check if the database connection is initialized and ready.
     *
     * @returns True if database is connected and ready
     */
    isInitialized(): boolean {
        return this.db !== null;
    }

    /**
     * Initialize the database connection.
     * Creates the database and object stores if they don't exist.
     * Safe to call multiple times - returns existing connection if already initialized.
     */
    async init(): Promise<void> {
        if (this.db) {
            return;
        }
        if (this.initPromise) {
            // Don't log during normal operation to reduce noise
            return this.initPromise;
        }

        this.initPromise = this.openDatabase().catch(error => {
            console.error('Failed to initialize database:', error);
            this.initPromise = null;
            throw error;
        });
        return this.initPromise;
    }

    private async openDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            const request = indexedDB.open(DB_NAME);

            request.onerror = () => {
                console.error('Database open error:', request.error);
                reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
            };

            request.onsuccess = async () => {
                this.db = request.result;

                // Initialize the cache with all data from IndexedDB
                try {
                    // Use getAll() for much faster bulk loading
                    const transaction = this.db.transaction([STORE_NAME], 'readonly');
                    const store = transaction.objectStore(STORE_NAME);

                    const request = store.getAll();

                    await new Promise<void>((resolve, reject) => {
                        request.onsuccess = () => {
                            const allFiles = request.result as FileData[];
                            this.cache.initialize(allFiles);
                            resolve();
                        };

                        request.onerror = () => reject(request.error);
                    });

                    const totalTime = (performance.now() - startTime).toFixed(2);
                    console.log(`Database fully initialized in ${totalTime}ms`);
                } catch (error) {
                    console.error('Failed to initialize cache:', error);
                    // Continue without cache - database will still work
                }

                resolve();
            };

            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'path' });

                    store.createIndex('mtime', 'mtime', { unique: false });
                    store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                } else {
                }
            };
        });
    }

    /**
     * Clear all data from the database.
     * Removes all file records but preserves the database structure.
     */
    async clear(): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => {
                // Clear cache after successful database clear
                this.cache.clear();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a single file synchronously from the cache.
     *
     * @param path - File path to retrieve
     * @returns File data or null if not found
     */
    getFile(path: string): FileData | null {
        if (!this.cache.isReady()) {
            return null;
        }
        return this.cache.getFile(path);
    }

    /**
     * Store or update a single file in the database.
     *
     * @param data - File data to store
     */
    async setFile(data: FileData): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => {
                // Update cache after successful database write
                this.cache.updateFile(data);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a single file from the database by path.
     *
     * @param path - File path to delete
     */
    async deleteFile(path: string): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.delete(path);
            request.onsuccess = () => {
                // Update cache after successful database delete
                this.cache.deleteFile(path);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get multiple files synchronously from the cache.
     * More efficient than multiple getFile calls.
     *
     * @param paths - Array of file paths to retrieve
     * @returns Map of path to file data (only includes found files)
     */
    getFiles(paths: string[]): Map<string, FileData> {
        if (!this.cache.isReady()) {
            return new Map();
        }
        return this.cache.getFiles(paths);
    }

    /**
     * Store or update multiple files in the database.
     * More efficient than multiple setFile calls.
     *
     * @param files - Array of file data to store
     */
    async setFiles(files: FileData[]): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        // Get existing data to check for tag changes
        const existingData = this.getFiles(files.map(f => f.path));
        const tagChanges: FileContentChange[] = [];

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            let completed = 0;
            let hasError = false;

            if (files.length === 0) {
                resolve();
                return;
            }

            files.forEach(data => {
                // Check if tags changed
                const existing = existingData.get(data.path);
                const tagsChanged =
                    !existing || existing.tags.length !== data.tags.length || !existing.tags.every((tag, i) => tag === data.tags[i]);

                if (tagsChanged) {
                    tagChanges.push({
                        path: data.path,
                        changes: { tags: data.tags },
                        changeType: 'metadata'
                    });
                }

                const request = store.put(data);

                request.onsuccess = () => {
                    completed++;
                    if (completed === files.length && !hasError) {
                        // Update cache after all successful database writes
                        this.cache.batchUpdate(files);

                        // Emit tag changes after transaction completes
                        if (tagChanges.length > 0) {
                            setTimeout(() => this.emitChanges(tagChanges), 0);
                        }

                        resolve();
                    }
                };

                request.onerror = () => {
                    hasError = true;
                    reject(request.error);
                };
            });
        });
    }

    /**
     * Delete multiple files from the database by paths.
     * More efficient than multiple deleteFile calls.
     *
     * @param paths - Array of file paths to delete
     */
    async deleteFiles(paths: string[]): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            let completed = 0;
            let hasError = false;

            if (paths.length === 0) {
                resolve();
                return;
            }

            paths.forEach(path => {
                const request = store.delete(path);

                request.onsuccess = () => {
                    completed++;
                    if (completed === paths.length && !hasError) {
                        // Update cache after all successful database deletes
                        paths.forEach(p => this.cache.deleteFile(p));
                        resolve();
                    }
                };

                request.onerror = () => {
                    hasError = true;
                    reject(request.error);
                };
            });
        });
    }

    /**
     * Get files with content synchronously.
     * Returns files that have the specified content type generated.
     *
     * @param type - Type of content to check for
     * @returns Array of files with content
     */
    getFilesWithContent(type: 'preview' | 'featureImage' | 'metadata'): FileData[] {
        if (!this.cache.isReady()) {
            return [];
        }
        return this.cache.getAllFiles().filter(file => {
            if (type === 'preview') return file.preview !== null;
            if (type === 'featureImage') return file.featureImage !== null;
            if (type === 'metadata') return file.metadata !== null;
            return false;
        });
    }

    /**
     * Count files synchronously.
     * Returns the total number of files in the database.
     *
     * @returns Number of files
     */
    getFileCount(): number {
        if (!this.cache.isReady()) {
            return 0;
        }
        return this.cache.getAllFiles().length;
    }

    /**
     * Get files that need content generation.
     * Returns paths of files where the specified content type is null.
     *
     * @param type - Type of content to check for
     * @returns Set of file paths needing content
     */
    getFilesNeedingContent(type: 'preview' | 'featureImage' | 'metadata'): Set<string> {
        if (!this.cache.isReady()) {
            return new Set();
        }
        const result = new Set<string>();
        const allFiles = this.cache.getAllFiles();
        for (const file of allFiles) {
            if (
                (type === 'preview' && file.preview === null) ||
                (type === 'featureImage' && file.featureImage === null) ||
                (type === 'metadata' && file.metadata === null)
            ) {
                result.add(file.path);
            }
        }
        return result;
    }

    /**
     * Update file content (preview, image, and/or metadata) by path.
     * Only updates provided fields, preserves others.
     * Emits change notifications.
     *
     * @param path - File path to update
     * @param preview - New preview text (optional)
     * @param image - New feature image URL (optional)
     * @param metadata - New metadata (optional)
     */
    async updateFileContent(path: string, preview?: string, image?: string, metadata?: FileData['metadata']): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const file = this.getFile(path);
        if (!file) return;

        const changes: FileContentChange['changes'] = {};

        if (preview !== undefined) {
            file.preview = preview;
            changes.preview = preview;
        }
        if (image !== undefined) {
            file.featureImage = image;
            changes.featureImage = image;
        }
        if (metadata !== undefined) {
            file.metadata = metadata;
            changes.metadata = metadata;
        }

        await this.setFile(file);

        // Emit change notification
        if (Object.keys(changes).length > 0) {
            // Determine change type
            const hasContentChanges = changes.preview !== undefined || changes.featureImage !== undefined;
            const hasMetadataChanges = changes.metadata !== undefined;
            const changeType = hasContentChanges && hasMetadataChanges ? 'both' : hasContentChanges ? 'content' : 'metadata';

            this.emitChanges([{ path, changes, changeType }]);
        }
    }

    /**
     * Update file metadata by path.
     * Merges with existing metadata rather than replacing.
     * Emits change notifications.
     *
     * @param path - File path to update
     * @param metadata - Metadata fields to update
     */
    async updateFileMetadata(path: string, metadata: { name?: string; created?: number; modified?: number }): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const file = this.getFile(path);
        if (!file) return;

        file.metadata = { ...(file.metadata || {}), ...metadata };

        await this.setFile(file);

        // Emit change notification
        this.emitChanges([{ path, changes: { metadata: file.metadata }, changeType: 'metadata' }]);
    }

    /**
     * Clear content for a file by path (set to null).
     * Used when content needs to be regenerated.
     * Emits change notifications.
     *
     * @param path - File path to clear content for
     * @param type - Type of content to clear or 'all'
     */
    async clearFileContent(path: string, type: 'preview' | 'featureImage' | 'metadata' | 'all'): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const file = this.getFile(path);
        if (!file) return;

        const changes: FileContentChange['changes'] = {};

        if (type === 'preview' || type === 'all') {
            file.preview = null;
            changes.preview = null;
        }
        if (type === 'featureImage' || type === 'all') {
            file.featureImage = null;
            changes.featureImage = null;
        }
        if (type === 'metadata' || type === 'all') {
            file.metadata = null;
            changes.metadata = null;
        }

        await this.setFile(file);

        // Emit change notification
        if (Object.keys(changes).length > 0) {
            // Determine change type for clear operations
            const hasContentCleared = changes.preview === null || changes.featureImage === null;
            const hasMetadataCleared = changes.metadata === null;
            const changeType = hasContentCleared && hasMetadataCleared ? 'both' : hasContentCleared ? 'content' : 'metadata';

            this.emitChanges([{ path, changes, changeType }]);
        }
    }

    /**
     * Clear content for ALL files in batch using cursor.
     * Very efficient for clearing content when settings change.
     * Only clears content that is not already null.
     * Emits change notifications for all affected files.
     *
     * @param type - Type of content to clear or 'all'
     */
    async batchClearAllFileContent(type: 'preview' | 'featureImage' | 'metadata' | 'all'): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const changeNotifications: FileContentChange[] = [];

        return new Promise((resolve, reject) => {
            const request = store.openCursor();

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const file = cursor.value as FileData;
                    const changes: FileContentChange['changes'] = {};
                    let hasChanges = false;

                    if ((type === 'preview' || type === 'all') && file.preview !== null) {
                        file.preview = null;
                        changes.preview = null;
                        hasChanges = true;
                    }
                    if ((type === 'featureImage' || type === 'all') && file.featureImage !== null) {
                        file.featureImage = null;
                        changes.featureImage = null;
                        hasChanges = true;
                    }
                    if ((type === 'metadata' || type === 'all') && file.metadata !== null) {
                        file.metadata = null;
                        changes.metadata = null;
                        hasChanges = true;
                    }

                    if (hasChanges) {
                        cursor.update(file); // Update in-place
                        // Update cache immediately
                        this.cache.updateFile(file);
                        // Determine change type for batch clear
                        const clearType = changes.preview === null || changes.featureImage === null ? 'content' : 'metadata';
                        changeNotifications.push({ path: file.path, changes, changeType: clearType });
                    }

                    cursor.continue();
                } else {
                    // Cursor iteration complete
                    transaction.oncomplete = () => {
                        // Emit all changes at once after transaction completes
                        this.emitChanges(changeNotifications);
                        resolve();
                    };
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear content for specific files in batch.
     * More efficient than multiple clearFileContent calls.
     * Only clears content that is not already null.
     * Emits change notifications for all affected files.
     *
     * @param paths - Array of file paths to clear content for
     * @param type - Type of content to clear or 'all'
     */
    async batchClearFileContent(paths: string[], type: 'preview' | 'featureImage' | 'metadata' | 'all'): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const files = this.getFiles(paths);
        const updates: FileData[] = [];
        const changeNotifications: FileContentChange[] = [];

        for (const [path, file] of files) {
            const changes: FileContentChange['changes'] = {};
            let hasChanges = false;

            if ((type === 'preview' || type === 'all') && file.preview !== null) {
                file.preview = null;
                changes.preview = null;
                hasChanges = true;
            }
            if ((type === 'featureImage' || type === 'all') && file.featureImage !== null) {
                file.featureImage = null;
                changes.featureImage = null;
                hasChanges = true;
            }
            if ((type === 'metadata' || type === 'all') && file.metadata !== null) {
                file.metadata = null;
                changes.metadata = null;
                hasChanges = true;
            }

            if (hasChanges) {
                updates.push(file);
                // Determine change type for batch clear
                const clearType = changes.preview === null || changes.featureImage === null ? 'content' : 'metadata';
                changeNotifications.push({ path, changes, changeType: clearType });
            }
        }

        // Update all files in batch
        if (updates.length > 0) {
            await this.setFiles(updates);
            // Emit all changes at once
            this.emitChanges(changeNotifications);
        }
    }

    /**
     * Update content for multiple files in batch.
     * More efficient than multiple updateFileContent calls.
     * Emits a single change notification for all updates.
     *
     * @param updates - Array of content updates to apply
     */
    async batchUpdateFileContent(
        updates: Array<{
            path: string;
            preview?: string;
            featureImage?: string;
            metadata?: FileData['metadata'];
        }>
    ): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const paths = updates.map(u => u.path);
        const existingFiles = this.getFiles(paths);
        const filesToUpdate: FileData[] = [];
        const changeNotifications: FileContentChange[] = [];

        for (const update of updates) {
            const file = existingFiles.get(update.path);
            if (!file) continue;

            const changes: FileContentChange['changes'] = {};
            let hasChanges = false;

            if (update.preview !== undefined) {
                file.preview = update.preview;
                changes.preview = update.preview;
                hasChanges = true;
            }
            if (update.featureImage !== undefined) {
                file.featureImage = update.featureImage;
                changes.featureImage = update.featureImage;
                hasChanges = true;
            }
            if (update.metadata !== undefined) {
                file.metadata = update.metadata;
                changes.metadata = update.metadata;
                hasChanges = true;
            }

            if (hasChanges) {
                filesToUpdate.push(file);
                // Determine change type for batch update
                const hasContentUpdates = changes.preview !== undefined || changes.featureImage !== undefined;
                const hasMetadataUpdates = changes.metadata !== undefined;
                const updateType = hasContentUpdates && hasMetadataUpdates ? 'both' : hasContentUpdates ? 'content' : 'metadata';

                changeNotifications.push({ path: update.path, changes, changeType: updateType });
            }
        }

        // Update all files in batch
        if (filesToUpdate.length > 0) {
            await this.setFiles(filesToUpdate);
            // Emit all changes at once
            this.emitChanges(changeNotifications);
        }
    }

    /**
     * Get all files that have a specific tag.
     * Uses the cache for synchronous retrieval.
     *
     * @param tag - Tag to search for (with or without #)
     * @returns Map of path to file data for files with the tag
     */
    getFilesByTag(tag: string): Map<string, FileData> {
        if (!this.cache.isReady()) {
            return new Map();
        }
        const result = new Map<string, FileData>();
        const allFiles = this.cache.getAllFiles();
        for (const file of allFiles) {
            if (file.tags.includes(tag)) {
                result.set(file.path, file);
            }
        }
        return result;
    }

    // Removed getFileByPath as it's redundant now that path is the primary key

    /**
     * Batch update or add multiple files in the database.
     * More efficient than multiple setFile calls.
     * Updates cache after successful database writes.
     *
     * @param files - Array of file data to store
     */
    async batchUpdate(files: FileData[]): Promise<void> {
        await this.setFiles(files);
    }

    /**
     * Clear database and reinitialize.
     * Used when vault structure changes significantly.
     */
    async clearDatabase(): Promise<void> {
        await this.clear();
    }

    /**
     * Check if a file has preview text synchronously.
     *
     * @param path - File path to check
     * @returns True if the file has preview text
     */
    hasPreview(path: string): boolean {
        if (!this.cache.isReady()) {
            return false;
        }
        return this.cache.hasPreview(path);
    }

    /**
     * Check if a file exists in the database.
     *
     * @param path - File path to check
     * @returns True if the file exists
     */
    hasFile(path: string): boolean {
        if (!this.cache.isReady()) {
            return false;
        }
        return this.cache.hasFile(path);
    }

    /**
     * Get all files synchronously from the cache.
     * Use sparingly as this returns all files in memory.
     *
     * @returns Array of all file data
     */
    getAllFiles(): FileData[] {
        if (!this.cache.isReady()) {
            return [];
        }
        return this.cache.getAllFiles();
    }

    /**
     * Get preview text for display, returning empty string if null.
     * Helper method for UI components that need non-null strings.
     *
     * @param path - File path to get preview for
     * @returns Preview text or empty string
     */
    getDisplayPreviewText(path: string): string {
        const file = this.getFile(path);
        return file?.preview || '';
    }

    /**
     * Get feature image URL for display, returning empty string if null.
     * Helper method for UI components that need non-null strings.
     *
     * @param path - File path to get image for
     * @returns Feature image URL or empty string
     */
    getDisplayFeatureImageUrl(path: string): string {
        const file = this.getFile(path);
        return file?.featureImage || '';
    }

    /**
     * Get tags for display, returning empty array if none.
     * Helper method for UI components that need tag data.
     *
     * @param path - File path to get tags for
     * @returns Array of tag strings
     */
    getDisplayTags(path: string): string[] {
        const file = this.getFile(path);
        return file?.tags || [];
    }

    /**
     * Close the database connection.
     * Should be called when the plugin is unloaded.
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.initPromise = null;
        this.cache.clear();
    }
}
