import { ProcessResult } from 'src/services/content/BaseContentProvider';
import { STORAGE_KEYS } from '../types';
import { localStorage } from '../utils/localStorage';
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

import { MemoryFileCache } from './MemoryFileCache';

const STORE_NAME = 'keyvaluepairs';
const DB_SCHEMA_VERSION = 1; // IndexedDB structure version
const DB_CONTENT_VERSION = 4.2; // Data format version

/**
 * Sentinel values for metadata date fields
 */
export const METADATA_SENTINEL = {
    /** Indicates that the frontmatter field name is empty/not configured */
    FIELD_NOT_CONFIGURED: 0,
    /** Indicates that parsing the date value failed */
    PARSE_FAILED: -1
} as const;

export interface FileData {
    mtime: number;
    tags: readonly string[] | null; // null = not extracted yet (e.g. when tags disabled)
    preview: string | null; // null = not generated yet
    featureImage: string | null; // null = not generated yet
    featureImageProvider: string | null; // null = not generated yet
    featureImageConsumers: readonly string[] | null; // null = this file isn't used as a featured image
    metadata: {
        name?: string;
        created?: number; // Valid timestamp, 0 = field not configured, -1 = parse failed
        modified?: number; // Valid timestamp, 0 = field not configured, -1 = parse failed
        icon?: string;
        color?: string;
    } | null; // null = not generated yet
}

function emptyFileData(): FileData {
    return {
        mtime: 0,
        tags:  null,
        preview: null,
        featureImage: null,
        featureImageProvider: null,
        featureImageConsumers: null,
        metadata: null,
    }
}

export interface FileContentChange {
    path: string;
    changes: {
        preview?: string | null;
        featureImage?: string | null;
        featureImageProvider?: string | null;
        featureImageConsumers?: readonly string[] | null;
        metadata?: FileData['metadata'] | null;
        tags?: readonly string[] | null;
    };
    changeType?: 'metadata' | 'content' | 'both';
}

/**
 * IndexedDBStorage - Browser's IndexedDB wrapper for persistent file storage
 *
 * What it does:
 * - Stores file metadata and generated content (previews, images, frontmatter) in browser IndexedDB
 * - Provides efficient batch operations for large vaults
 * - Emits real-time change notifications for UI updates
 *
 * Relationships:
 * - Used by: StorageContext, ContentProviders, FileOperations, Statistics
 * - Core persistent storage layer that all other components depend on
 *
 * Key responsibilities:
 * - Manage IndexedDB connection lifecycle
 * - CRUD operations for file records (single and batch)
 * - Stream large datasets without loading into memory
 * - Track and notify about content changes
 * - Provide indexed queries (by tag, by content type)
 */
export class IndexedDBStorage {
    private cache: MemoryFileCache = new MemoryFileCache();
    private changeListeners = new Set<(changes: FileContentChange[]) => void>();
    private db: IDBDatabase | null = null;
    private dbName: string;
    private fileChangeListeners = new Map<string, Set<(changes: FileContentChange['changes']) => void>>();
    private initPromise: Promise<void> | null = null;

    constructor(appId: string) {
        this.dbName = `notebooknavigator/cache/${appId}`;
    }

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

        // Emit to global listeners
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

        this.initPromise = this.checkSchemaAndInit().catch(error => {
            console.error('Failed to initialize database:', error);
            this.initPromise = null;
            throw error;
        });
        return this.initPromise;
    }

    private async checkSchemaAndInit(): Promise<void> {
        const storedSchemaVersion = localStorage.get<string>(STORAGE_KEYS.databaseSchemaVersionKey);
        const storedContentVersion = localStorage.get<string>(STORAGE_KEYS.databaseContentVersionKey);
        const currentSchemaVersion = DB_SCHEMA_VERSION.toString();
        const currentContentVersion = DB_CONTENT_VERSION.toString();

        // Check version changes
        const schemaChanged = storedSchemaVersion && storedSchemaVersion !== currentSchemaVersion;
        const contentChanged = storedContentVersion && storedContentVersion !== currentContentVersion;

        // Only schema changes require database recreation
        if (schemaChanged) {
            console.log(`Database schema version changed from ${storedSchemaVersion} to ${currentSchemaVersion}. Recreating database.`);
            await this.deleteDatabase();
        }

        localStorage.set(STORAGE_KEYS.databaseSchemaVersionKey, currentSchemaVersion);
        localStorage.set(STORAGE_KEYS.databaseContentVersionKey, currentContentVersion);

        const needsRebuild = !!(schemaChanged || contentChanged);
        await this.openDatabase(needsRebuild);

        // Clear and rebuild content if either version changed
        if (needsRebuild) {
            if (contentChanged && !schemaChanged) {
                console.log(`Content version changed from ${storedContentVersion} to ${currentContentVersion}. Rebuilding content.`);
            }
            // Clear all data to force rebuild
            await this.clear();
        }
    }

    private async deleteDatabase(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        return new Promise((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(this.dbName);

            deleteReq.onsuccess = () => {
                resolve();
            };

            deleteReq.onerror = () => {
                console.error('Failed to delete database:', deleteReq.error);
                reject(deleteReq.error);
            };

            deleteReq.onblocked = () => {
                console.error('Database deletion blocked');
                reject(new Error('Database deletion blocked'));
            };
        });
    }

    private async openDatabase(skipCacheLoad: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, DB_SCHEMA_VERSION);

            request.onerror = () => {
                console.error('Database open error:', request.error);
                reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
            };

            request.onblocked = () => {
                console.error('Database open blocked');
                reject(new Error('Database open blocked'));
            };

            request.onsuccess = async () => {
                this.db = request.result;

                // Close this connection if a version change is requested elsewhere
                if (this.db) {
                    this.db.onversionchange = () => {
                        try {
                            this.db?.close();
                        } catch {
                            // noop
                        }
                        this.db = null;
                    };
                }

                // Initialize the cache with all data from IndexedDB
                if (skipCacheLoad) {
                    this.cache.initialize([]);
                } else {
                    try {
                        // Use getAll() for much faster bulk loading
                        const transaction = this.db.transaction([STORE_NAME], 'readonly');
                        const store = transaction.objectStore(STORE_NAME);

                        // Use openCursor to get both keys and values
                        const request = store.openCursor();
                        const filesWithPaths: { path: string; data: FileData }[] = [];

                        await new Promise<void>((resolve, reject) => {
                            request.onsuccess = event => {
                                const cursor = (event.target as IDBRequest).result;
                                if (cursor) {
                                    filesWithPaths.push({
                                        path: cursor.key as string,
                                        data: cursor.value as FileData
                                    });
                                    cursor.continue();
                                } else {
                                    // Done iterating
                                    this.cache.initialize(filesWithPaths);
                                    resolve();
                                }
                            };

                            request.onerror = () => reject(request.error);
                        });
                    } catch (error) {
                        console.error('[DB Cache] Failed to initialize cache:', error);
                        // Continue without cache - database will still work
                    }
                }

                resolve();
            };

            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Use out-of-line keys since we removed path from FileData
                    const store = db.createObjectStore(STORE_NAME);

                    store.createIndex('mtime', 'mtime', { unique: false });
                    store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
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
            const op = 'clear';
            let lastRequestError: DOMException | Error | null = null;
            const request = store.clear();
            request.onerror = () => {
                lastRequestError = request.error || null;
                console.error('[IndexedDB] clear failed', {
                    store: STORE_NAME,
                    name: request.error?.name,
                    message: request.error?.message
                });
            };
            transaction.oncomplete = () => {
                this.cache.clear();
                this.cache.initialize([]);
                resolve();
            };
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
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
     * Seed the in-memory cache for a path without writing to IndexedDB.
     * Used to keep UI responsive when files are renamed and we already
     * have complete metadata under the old path.
     */
    seedMemoryFile(path: string, data: FileData): void {
        if (!this.cache.isReady()) {
            return;
        }
        this.cache.setClonedFile(path, data);
    }

    /**
     * Store or update a single file in the database.
     *
     * @param path - File path (key)
     * @param data - File data to store
     */
    async setFile(path: string, data: FileData): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const op = 'put';
            let lastRequestError: DOMException | Error | null = null;
            const request = store.put(data, path);
            request.onerror = () => {
                lastRequestError = request.error || null;
                console.error('[IndexedDB] put failed', {
                    store: STORE_NAME,
                    path,
                    name: request.error?.name,
                    message: request.error?.message
                });
            };
            transaction.oncomplete = () => {
                this.cache.updateFile(path, data);
                resolve();
            };
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
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
            const op = 'delete';
            let lastRequestError: DOMException | Error | null = null;
            const request = store.delete(path);
            request.onerror = () => {
                lastRequestError = request.error || null;
                console.error('[IndexedDB] delete failed', {
                    store: STORE_NAME,
                    path,
                    name: request.error?.name,
                    message: request.error?.message
                });
            };
            transaction.oncomplete = () => {
                this.cache.deleteFile(path);
                resolve();
            };
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
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
     * @param files - Array of file data with paths to store
     */
    async setFiles(files: { path: string; data: FileData }[]): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const op = 'put:batch';
            let lastRequestError: DOMException | Error | null = null;
            if (files.length === 0) {
                resolve();
                return;
            }

            files.forEach(({ path, data }) => {
                const request = store.put(data, path);
                request.onerror = () => {
                    lastRequestError = request.error || null;
                    console.error('[IndexedDB] put failed', {
                        store: STORE_NAME,
                        path,
                        name: request.error?.name,
                        message: request.error?.message
                    });
                };
            });

            transaction.oncomplete = () => {
                this.cache.batchUpdate(files);
                resolve();
            };
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
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
            const op = 'delete:batch';
            let lastRequestError: DOMException | Error | null = null;
            if (paths.length === 0) {
                resolve();
                return;
            }

            paths.forEach(path => {
                const request = store.delete(path);
                request.onerror = () => {
                    lastRequestError = request.error || null;
                    console.error('[IndexedDB] delete failed', {
                        store: STORE_NAME,
                        path,
                        name: request.error?.name,
                        message: request.error?.message
                    });
                };
            });

            transaction.oncomplete = () => {
                this.cache.batchDelete(paths);
                resolve();
            };
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
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
     * Get all files with their paths.
     * Returns array of objects containing path and file data.
     *
     * @returns Array of files with paths
     */
    getAllFiles(): { path: string; data: FileData }[] {
        if (!this.cache.isReady()) {
            return [];
        }
        return this.cache.getAllFilesWithPaths();
    }

    /**
     * Get files that need content generation.
     * Returns paths of files where the specified content type is null.
     *
     * @param type - Type of content to check for
     * @returns Set of file paths needing content
     */
    getFilesNeedingContent(type: 'tags' | 'preview' | 'featureImage' | 'metadata'): Set<string> {
        if (!this.cache.isReady()) {
            return new Set();
        }
        const result = new Set<string>();
        const allFiles = this.cache.getAllFilesWithPaths();
        for (const { path, data } of allFiles) {
            if (
                (type === 'tags' && data.tags === null) ||
                (type === 'preview' && data.preview === null) ||
                (type === 'featureImage' && data.featureImage === null) ||
                (type === 'metadata' && data.metadata === null)
            ) {
                result.add(path);
            }
        }
        return result;
    }

    /**
     * Get current database statistics.
     * Returns the number of items and total size in MB.
     *
     * @returns Object with item count and size in MB
     */
    getDatabaseStats(): { itemCount: number; sizeMB: number } {
        const itemCount = this.cache.getAllFilesWithPaths().length;
        let totalSize = 0;
        for (const { path, data } of this.cache.getAllFilesWithPaths()) {
            totalSize += path.length + JSON.stringify(data).length;
        }
        const sizeMB = totalSize / 1024 / 1024;
        return { itemCount, sizeMB };
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
    async updateFileContent(data: ProcessResult): Promise<void> {
        const path = data.path;
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const changes: FileContentChange['changes'] = {};
        let updated: FileData | null = null;
        const opUpdate = 'updateFileContent';
        let lastRequestErrorUpdate: DOMException | Error | null = null;

        await new Promise<void>((resolve, reject) => {
            const getReq = store.get(path);
            getReq.onsuccess = () => {
                const existing = (getReq.result as FileData | undefined) || null;
                if (!existing && data.forceUpdate !== true) {
                    resolve();
                    return;
                }
                const next: FileData = { ...existing ?? emptyFileData() };
                if (data.preview !== undefined) {
                    next.preview = data.preview;
                    changes.preview = data.preview;
                }
                if (data.featureImage !== undefined) {
                    next.featureImage = data.featureImage;
                    changes.featureImage = data.featureImage;
                }
                if (data.featureImageProvider !== undefined) {
                    next.featureImageProvider = data.featureImageProvider;
                    changes.featureImageProvider = data.featureImageProvider;
                }
                if (data.featureImageConsumers !== undefined) {
                    next.featureImageConsumers = data.featureImageConsumers;
                    changes.featureImageConsumers = data.featureImageConsumers;
                }
                if (data.metadata !== undefined) {
                    next.metadata = data.metadata;
                    changes.metadata = data.metadata;
                }
                updated = next;
                const putReq = store.put(next, path);
                putReq.onerror = () => {
                    lastRequestErrorUpdate = putReq.error || null;
                    console.error('[IndexedDB] put failed', {
                        store: STORE_NAME,
                        op: opUpdate,
                        path,
                        name: putReq.error?.name,
                        message: putReq.error?.message
                    });
                };
            };
            getReq.onerror = () => {
                lastRequestErrorUpdate = getReq.error || null;
                console.error('[IndexedDB] get failed', {
                    store: STORE_NAME,
                    op: opUpdate,
                    path,
                    name: getReq.error?.name,
                    message: getReq.error?.message
                });
                try {
                    transaction.abort();
                } catch (e) {
                    void e;
                }
            };
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op: opUpdate,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestErrorUpdate?.message
                });
                reject(transaction.error || lastRequestErrorUpdate || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op: opUpdate,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestErrorUpdate?.message
                });
                reject(transaction.error || lastRequestErrorUpdate || new Error('Transaction error'));
            };
        });

        if (updated) {
            this.cache.updateFile(path, updated);
            if (Object.keys(changes).length > 0) {
                const hasContentChanges = changes.preview !== undefined || changes.featureImage !== undefined;
                const hasMetadataChanges = changes.metadata !== undefined;
                const changeType = hasContentChanges && hasMetadataChanges ? 'both' : hasContentChanges ? 'content' : 'metadata';
                if (hasContentChanges || hasMetadataChanges) {
                    this.emitChanges([{ path, changes, changeType }]);
                }
            }
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
    async updateFileMetadata(
        path: string,
        metadata: {
            name?: string;
            created?: number;
            modified?: number;
            icon?: string;
            color?: string;
        }
    ): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        let updated: FileData | null = null;
        const opMeta = 'updateFileMetadata';
        let lastRequestErrorMeta: DOMException | Error | null = null;

        await new Promise<void>((resolve, reject) => {
            const getReq = store.get(path);
            getReq.onsuccess = () => {
                const existing = (getReq.result as FileData | undefined) || null;
                if (!existing) {
                    resolve();
                    return;
                }
                const newMeta = { ...(existing.metadata || {}), ...metadata };
                updated = { ...existing, metadata: newMeta };
                const putReq = store.put(updated, path);
                putReq.onerror = () => {
                    lastRequestErrorMeta = putReq.error || null;
                    console.error('[IndexedDB] put failed', {
                        store: STORE_NAME,
                        op: opMeta,
                        path,
                        name: putReq.error?.name,
                        message: putReq.error?.message
                    });
                };
            };
            getReq.onerror = () => {
                lastRequestErrorMeta = getReq.error || null;
                console.error('[IndexedDB] get failed', {
                    store: STORE_NAME,
                    op: opMeta,
                    path,
                    name: getReq.error?.name,
                    message: getReq.error?.message
                });
                try {
                    transaction.abort();
                } catch (e) {
                    void e;
                }
            };
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op: opMeta,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestErrorMeta?.message
                });
                reject(transaction.error || lastRequestErrorMeta || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op: opMeta,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestErrorMeta?.message
                });
                reject(transaction.error || lastRequestErrorMeta || new Error('Transaction error'));
            };
        });

        if (updated) {
            const updatedRecord: FileData = updated;
            this.cache.updateFile(path, updatedRecord);
            this.emitChanges([{ path, changes: { metadata: updatedRecord.metadata }, changeType: 'metadata' }]);
        }
    }

    /**
     * Update modification times for multiple files in batch.
     * Used by content providers after successfully generating content.
     * Does NOT emit change notifications as this is an internal update.
     *
     * @param updates - Array of path and mtime pairs to update
     */
    async updateMtimes(updates: { path: string; mtime: number }[]): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        if (updates.length === 0) return;

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const cacheUpdates: { path: string; data: FileData }[] = [];

        await new Promise<void>((resolve, reject) => {
            const op = 'updateMtimes';
            let lastRequestError: DOMException | Error | null = null;
            updates.forEach(({ path, mtime }) => {
                const getReq = store.get(path);
                getReq.onsuccess = () => {
                    const existing = (getReq.result as FileData | undefined) || null;
                    if (!existing) return;
                    const updated: FileData = { ...existing, mtime };
                    cacheUpdates.push({ path, data: updated });
                    const putReq = store.put(updated, path);
                    putReq.onerror = () => {
                        lastRequestError = putReq.error || null;
                        console.error('[IndexedDB] put failed', {
                            store: STORE_NAME,
                            op,
                            path,
                            name: putReq.error?.name,
                            message: putReq.error?.message
                        });
                    };
                };
                getReq.onerror = () => {
                    lastRequestError = getReq.error || null;
                    console.error('[IndexedDB] get failed', {
                        store: STORE_NAME,
                        op,
                        path,
                        name: getReq.error?.name,
                        message: getReq.error?.message
                    });
                    try {
                        transaction.abort();
                    } catch (e) {
                        void e;
                    }
                };
            });
            transaction.oncomplete = () => {
                if (cacheUpdates.length > 0) {
                    this.cache.batchUpdate(cacheUpdates);
                }
                resolve();
            };
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
        });
    }

    /**
     * Clear content for a file by path (set to null).
     * Used when content needs to be regenerated.
     * Emits change notifications.
     *
     * @param path - File path to clear content for
     * @param type - Type of content to clear or 'all'
     */
    async clearFileContent(path: string, type: keyof ProcessResult | 'all'): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const changes: FileContentChange['changes'] = {};
        let updated: FileData | null = null;
        const op = 'clearFileContent';
        let lastRequestError: DOMException | Error | null = null;

        await new Promise<void>((resolve, reject) => {
            const getReq = store.get(path);
            getReq.onsuccess = () => {
                const existing = (getReq.result as FileData | undefined) || null;
                if (!existing) {
                    resolve();
                    return;
                }
                const file = { ...existing };
                if (type === 'preview' || type === 'all') {
                    if (file.preview !== null) {
                        file.preview = null;
                        changes.preview = null;
                    }
                }
                if (type === 'featureImageProvider' || type === 'all') {
                    if (file.featureImageProvider !== null) {
                        file.featureImageProvider = null;
                        changes.featureImageProvider = null;
                    }
                }
                if (type === 'featureImageConsumers' || type === 'all') {
                    if (file.featureImageConsumers !== null) {
                        file.featureImageConsumers = null;
                        changes.featureImageConsumers = null;
                    }
                }
                if (type === 'featureImage' || type === 'all') {
                    if (file.featureImage !== null) {
                        file.featureImage = null;
                        changes.featureImage = null;
                    }
                }
                if (type === 'metadata' || type === 'all') {
                    if (file.metadata !== null) {
                        file.metadata = null;
                        changes.metadata = null;
                    }
                }
                updated = file;
                const putReq = store.put(file, path);
                putReq.onerror = () => {
                    lastRequestError = putReq.error || null;
                    console.error('[IndexedDB] put failed', {
                        store: STORE_NAME,
                        op,
                        path,
                        name: putReq.error?.name,
                        message: putReq.error?.message
                    });
                };
            };
            getReq.onerror = () => {
                lastRequestError = getReq.error || null;
                console.error('[IndexedDB] get failed', {
                    store: STORE_NAME,
                    op,
                    path,
                    name: getReq.error?.name,
                    message: getReq.error?.message
                });
                try {
                    transaction.abort();
                } catch (e) {
                    void e;
                }
            };
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    path,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
        });

        if (updated) {
            this.cache.updateFile(path, updated);
            if (Object.keys(changes).length > 0) {
                const hasContentCleared = changes.preview === null || changes.featureImage === null;
                const hasMetadataCleared = changes.metadata === null;
                const changeType = hasContentCleared && hasMetadataCleared ? 'both' : hasContentCleared ? 'content' : 'metadata';
                if (hasContentCleared || hasMetadataCleared) {
                    this.emitChanges([{ path, changes, changeType }]);
                }
            }
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
    async batchClearAllFileContent(type: keyof ProcessResult | 'all'): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const changeNotifications: FileContentChange[] = [];
        const cacheUpdates: { path: string; data: FileData }[] = [];
        const op = 'batchClearAllFileContent';
        let lastRequestError: DOMException | Error | null = null;

        return new Promise((resolve, reject) => {
            const request = store.openCursor();

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const current = cursor.value as FileData;
                    const updated: FileData = { ...current };
                    const changes: FileContentChange['changes'] = {};
                    let hasChanges = false;

                    if ((type === 'preview' || type === 'all') && updated.preview !== null) {
                        updated.preview = null;
                        changes.preview = null;
                        hasChanges = true;
                    }
                    if ((type === 'featureImage' || type === 'all') && updated.featureImage !== null) {
                        updated.featureImage = null;
                        changes.featureImage = null;
                        hasChanges = true;
                    }
                    if ((type === 'featureImageProvider' || type === 'all') && updated.featureImageProvider !== null) {
                        updated.featureImageProvider = null;
                        changes.featureImageProvider = null;
                        hasChanges = true;
                    }
                    if ((type === 'featureImageConsumers' || type === 'all') && updated.featureImageConsumers !== null) {
                        updated.featureImageConsumers = null;
                        changes.featureImageConsumers = null;
                        hasChanges = true;
                    }
                    if ((type === 'metadata' || type === 'all') && updated.metadata !== null) {
                        updated.metadata = null;
                        changes.metadata = null;
                        hasChanges = true;
                    }
                    if ((type === 'tags' || type === 'all') && updated.tags !== null) {
                        updated.tags = null;
                        changes.tags = null;
                        hasChanges = true;
                    }

                    if (hasChanges) {
                        const updateReq = cursor.update(updated);
                        updateReq.onerror = () => {
                            lastRequestError = updateReq.error || null;
                            console.error('[IndexedDB] cursor.update failed', {
                                store: STORE_NAME,
                                op,
                                path,
                                name: updateReq.error?.name,
                                message: updateReq.error?.message
                            });
                            try {
                                transaction.abort();
                            } catch (e) {
                                void e;
                            }
                        };
                        const path = cursor.key as string;
                        cacheUpdates.push({ path, data: updated });
                        const hasContentCleared = changes.preview === null || changes.featureImage === null;
                        const hasMetadataCleared = changes.metadata === null || changes.tags !== undefined;
                        const clearType = hasContentCleared && hasMetadataCleared ? 'both' : hasContentCleared ? 'content' : 'metadata';
                        if (hasContentCleared || hasMetadataCleared) {
                            changeNotifications.push({ path, changes, changeType: clearType });
                        }
                    }

                    cursor.continue();
                }
            };

            request.onerror = () => {
                lastRequestError = request.error || null;
                console.error('[IndexedDB] openCursor failed', {
                    store: STORE_NAME,
                    op,
                    name: request.error?.name,
                    message: request.error?.message
                });
                reject(request.error);
            };

            transaction.oncomplete = () => {
                if (cacheUpdates.length > 0) {
                    this.cache.batchUpdate(cacheUpdates);
                    this.emitChanges(changeNotifications);
                }
                resolve();
            };
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
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
    async batchClearFileContent(paths: string[], type: keyof ProcessResult | 'all'): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const updates: { path: string; data: FileData }[] = [];
        const changeNotifications: FileContentChange[] = [];
        const op = 'batchClearFileContent';
        let lastRequestError: DOMException | Error | null = null;

        await new Promise<void>((resolve, reject) => {
            if (paths.length === 0) {
                resolve();
                return;
            }

            paths.forEach(path => {
                const getReq = store.get(path);
                getReq.onsuccess = () => {
                    const existing = (getReq.result as FileData | undefined) || null;
                    if (!existing) {
                        return;
                    }
                    const file = { ...existing };
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
                    if ((type === 'featureImageProvider' || type === 'all') && file.featureImageProvider !== null) {
                        file.featureImageProvider = null;
                        changes.featureImageProvider = null;
                        hasChanges = true;
                    }
                    if ((type === 'featureImageConsumers' || type === 'all') && file.featureImageConsumers !== null) {
                        file.featureImageConsumers = null;
                        changes.featureImageConsumers = null;
                        hasChanges = true;
                    }
                    if ((type === 'metadata' || type === 'all') && file.metadata !== null) {
                        file.metadata = null;
                        changes.metadata = null;
                        hasChanges = true;
                    }
                    if ((type === 'tags' || type === 'all') && file.tags !== null) {
                        file.tags = null;
                        changes.tags = null;
                        hasChanges = true;
                    }
                    if (hasChanges) {
                        const putReq = store.put(file, path);
                        putReq.onerror = () => {
                            lastRequestError = putReq.error || null;
                            console.error('[IndexedDB] put failed', {
                                store: STORE_NAME,
                                op,
                                path,
                                name: putReq.error?.name,
                                message: putReq.error?.message
                            });
                        };
                        updates.push({ path, data: file });
                        const hasContentCleared = changes.preview === null || changes.featureImage === null;
                        const hasMetadataCleared = changes.metadata === null || changes.tags !== undefined;
                        const clearType = hasContentCleared && hasMetadataCleared ? 'both' : hasContentCleared ? 'content' : 'metadata';
                        if (hasContentCleared || hasMetadataCleared) {
                            changeNotifications.push({ path, changes, changeType: clearType });
                        }
                    }
                    // noop
                };
                getReq.onerror = () => {
                    lastRequestError = getReq.error || null;
                    console.error('[IndexedDB] get failed', {
                        store: STORE_NAME,
                        op,
                        path,
                        name: getReq.error?.name,
                        message: getReq.error?.message
                    });
                    try {
                        transaction.abort();
                    } catch (e) {
                        void e;
                    }
                };
            });

            transaction.oncomplete = () => resolve();
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
        });

        if (updates.length > 0) {
            this.cache.batchUpdate(updates);
            this.emitChanges(changeNotifications);
        }
    }

    /**
     * Update content for multiple files in batch.
     * More efficient than multiple updateFileContent calls.
     * Emits change notifications for all updates so UI components can react.
     * This is the primary method for notifying the UI about content changes.
     *
     * @param updates - Array of content updates to apply
     */
    async batchUpdateFileContent(
        updates: {
            path: string;
            tags?: readonly string[] | null;
            preview?: string;
            featureImage?: string;
            featureImageProvider?: string;
            featureImageConsumers?: readonly string[] | null;
            metadata?: FileData['metadata'];
            forceUpdate?: boolean
        }[]
    ): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        if (updates.length === 0) return;

        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const filesToUpdate: { path: string; data: FileData }[] = [];
        const changeNotifications: FileContentChange[] = [];

        await new Promise<void>((resolve, reject) => {
            const op = 'batchUpdateFileContent';
            let lastRequestError: DOMException | Error | null = null;
            updates.forEach(update => {
                const getReq = store.get(update.path);
                getReq.onsuccess = () => {
                    const existing = (getReq.result as FileData | undefined) || null;
                    if (!existing && update.forceUpdate !== true) {
                        return;
                    }
                    const newData: FileData = { ...(existing ?? emptyFileData()) };
                    const changes: FileContentChange['changes'] = {};
                    let hasChanges = false;
                    if (update.tags !== undefined) {
                        newData.tags = update.tags;
                        changes.tags = update.tags;
                        hasChanges = true;
                    }
                    if (update.preview !== undefined) {
                        newData.preview = update.preview;
                        changes.preview = update.preview;
                        hasChanges = true;
                    }
                    if (update.featureImage !== undefined) {
                        newData.featureImage = update.featureImage;
                        changes.featureImage = update.featureImage;
                        hasChanges = true;
                    }
                    if (update.featureImageProvider !== undefined) {
                        newData.featureImageProvider = update.featureImageProvider;
                        changes.featureImageProvider = update.featureImageProvider;
                        hasChanges = true;
                    }
                    if (update.featureImageConsumers !== undefined) {
                        newData.featureImageConsumers = update.featureImageConsumers;
                        changes.featureImageConsumers = update.featureImageConsumers;
                        hasChanges = true;
                    }
                    if (update.metadata !== undefined) {
                        newData.metadata = update.metadata;
                        changes.metadata = update.metadata;
                        hasChanges = true;
                    }
                    if (hasChanges) {
                        const putReq = store.put(newData, update.path);
                        putReq.onerror = () => {
                            lastRequestError = putReq.error || null;
                            console.error('[IndexedDB] put failed', {
                                store: STORE_NAME,
                                op,
                                path: update.path,
                                name: putReq.error?.name,
                                message: putReq.error?.message
                            });
                        };
                        filesToUpdate.push({ path: update.path, data: newData });
                        const hasContentUpdates = changes.preview !== undefined || changes.featureImage !== undefined;
                        const hasMetadataUpdates = changes.metadata !== undefined || changes.tags !== undefined;

                        if (hasContentUpdates || hasMetadataUpdates) {
                            const updateType = hasContentUpdates && hasMetadataUpdates ? 'both' : hasContentUpdates ? 'content' : 'metadata';
                            changeNotifications.push({ path: update.path, changes, changeType: updateType });
                        }
                    }
                    // noop
                };
                getReq.onerror = () => {
                    lastRequestError = getReq.error || null;
                    console.error('[IndexedDB] get failed', {
                        store: STORE_NAME,
                        op,
                        path: update.path,
                        name: getReq.error?.name,
                        message: getReq.error?.message
                    });
                    try {
                        transaction.abort();
                    } catch (e) {
                        void e;
                    }
                };
            });
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => {
                console.error('[IndexedDB] transaction aborted', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction aborted'));
            };
            transaction.onerror = () => {
                console.error('[IndexedDB] transaction error', {
                    store: STORE_NAME,
                    op,
                    txError: transaction.error?.message,
                    reqError: lastRequestError?.message
                });
                reject(transaction.error || lastRequestError || new Error('Transaction error'));
            };
        });

        if (filesToUpdate.length > 0) {
            this.cache.batchUpdate(filesToUpdate);
            this.emitChanges(changeNotifications);
        }
    }

    /**
     * Batch update or add multiple files in the database.
     * More efficient than multiple setFile calls.
     * Updates cache after successful database writes.
     *
     * @param files - Array of file data with paths to store
     */
    async batchUpdate(files: { path: string; data: FileData }[]): Promise<void> {
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
     * Get preview text from memory cache, returning empty string if null.
     * Helper method for UI components that need non-null strings.
     *
     * @param path - File path to get preview for
     * @returns Preview text or empty string
     */
    getCachedPreviewText(path: string): string {
        const file = this.getFile(path);
        return file?.preview || '';
    }

    /**
     * Get feature image URL from memory cache, returning empty string if null.
     * Helper method for UI components that need non-null strings.
     *
     * @param path - File path to get image for
     * @returns Feature image URL or empty string
     */
    getCachedFeatureImageUrl(path: string): string {
        const file = this.getFile(path);
        return file?.featureImage || '';
    }

    /**
     * Get tags from memory cache, returning empty array if none.
     * Helper method for UI components that need tag data.
     *
     * @param path - File path to get tags for
     * @returns Array of tag strings
     */
    getCachedTags(path: string): readonly string[] {
        const file = this.getFile(path);
        // Return empty array if file doesn't exist or tags are null/not extracted yet
        if (!file || file.tags === null) return [];
        return file.tags;
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
