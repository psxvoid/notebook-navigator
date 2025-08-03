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

import { App, TFile, getAllTags, CachedMetadata } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { FileData, METADATA_SENTINEL } from '../storage/IndexedDBStorage';
import { getDBInstance } from '../storage/fileOperations';
import { TIMEOUTS } from '../types/obsidian-extended';
import { isImageFile } from '../utils/fileTypeUtils';
import { PreviewTextUtils } from '../utils/previewTextUtils';
import { DateUtils } from '../utils/dateUtils';

interface ContentJob {
    file: TFile;
    path: string[];
    needsTags: boolean;
    needsPreview: boolean;
    needsImage: boolean;
    needsMetadata: boolean;
}

/**
 * Processed metadata from frontmatter
 */
export interface ProcessedMetadata {
    fn?: string; // frontmatter name
    fc?: number; // frontmatter created timestamp
    fm?: number; // frontmatter modified timestamp
}

/**
 * ContentService - Asynchronous content generation engine
 *
 * What it does:
 * - Generates preview text, feature images, and metadata for vault files
 * - Processes files in batches to maintain UI responsiveness
 * - Handles settings changes by clearing and regenerating content
 *
 * Relationships:
 * - Used by: StorageContext (creates and manages the service)
 * - Uses: IndexedDBStorage (stores generated content), PreviewTextUtils (text extraction)
 * - Works with: Obsidian metadata cache for frontmatter extraction
 *
 * Key responsibilities:
 * - Queue and process files that need content generation
 * - Check database to determine what content is missing (null values)
 * - Extract preview text, feature images, and metadata in parallel
 * - Batch update database with generated content
 * - Clear content when settings change or features are disabled
 */
export class ContentService {
    // Configuration for batch processing
    private readonly QUEUE_BATCH_SIZE = 100; // Files to take from queue at once
    private readonly PARALLEL_LIMIT = 10; // Max concurrent file operations

    private abortController: AbortController | null = null;
    private app: App;
    private isProcessing = false;
    private queue: ContentJob[] = [];
    private queueDebounceTimer: number | null = null;
    private settingsChanged = false;
    private currentBatchSettings: NotebookNavigatorSettings | null = null;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Extract metadata from frontmatter
     * @param app - The Obsidian app instance
     * @param file - The file to extract metadata from
     * @param settings - Current plugin settings
     * @returns Processed metadata object
     */
    static extractMetadata(app: App, file: TFile, settings: NotebookNavigatorSettings): ProcessedMetadata {
        const metadata = app.metadataCache.getFileCache(file);
        return ContentService.extractMetadataFromCache(metadata, file, settings);
    }

    static extractMetadataFromCache(metadata: CachedMetadata | null, _file: TFile, settings: NotebookNavigatorSettings): ProcessedMetadata {
        const frontmatter = metadata?.frontmatter;

        if (!frontmatter || !settings.useFrontmatterMetadata) {
            return {};
        }

        const result: ProcessedMetadata = {};

        // Extract name if field is specified
        if (settings.frontmatterNameField && settings.frontmatterNameField.trim()) {
            const nameValue = frontmatter[settings.frontmatterNameField];
            if (nameValue && typeof nameValue === 'string' && nameValue.trim()) {
                result.fn = nameValue.trim();
            }
        } else {
            // Field is empty, don't set name field (leave undefined)
            result.fn = undefined;
        }

        // Extract created date if field is specified
        if (settings.frontmatterCreatedField && settings.frontmatterCreatedField.trim()) {
            const createdValue = frontmatter[settings.frontmatterCreatedField];

            if (createdValue !== undefined) {
                // Field exists, try to parse it
                const createdTimestamp = DateUtils.parseFrontmatterDate(createdValue, settings.frontmatterDateFormat);
                if (createdTimestamp !== undefined) {
                    result.fc = createdTimestamp;
                } else {
                    // Parsing failed, use sentinel value
                    result.fc = METADATA_SENTINEL.PARSE_FAILED;
                }
            }
        } else {
            // Field is empty, use sentinel value to clear the metadata
            result.fc = METADATA_SENTINEL.FIELD_NOT_CONFIGURED;
        }

        // Extract modified date if field is specified
        if (settings.frontmatterModifiedField && settings.frontmatterModifiedField.trim()) {
            const modifiedValue = frontmatter[settings.frontmatterModifiedField];

            if (modifiedValue !== undefined) {
                // Field exists, try to parse it
                const modifiedTimestamp = DateUtils.parseFrontmatterDate(modifiedValue, settings.frontmatterDateFormat);
                if (modifiedTimestamp !== undefined) {
                    result.fm = modifiedTimestamp;
                } else {
                    // Parsing failed, use sentinel value
                    result.fm = METADATA_SENTINEL.PARSE_FAILED;
                }
            }
        } else {
            // Field is empty, use sentinel value to clear the metadata
            result.fm = METADATA_SENTINEL.FIELD_NOT_CONFIGURED;
        }

        return result;
    }

    /**
     * Queue files for content generation (preview text, feature images, and metadata).
     * Files are processed in batches to avoid blocking the UI. The service checks what
     * content needs to be generated based on current settings and existing data.
     *
     * @param files - Array of files to process
     * @param settings - Current plugin settings
     */
    public async queueContent(files: TFile[], settings: NotebookNavigatorSettings): Promise<void> {
        // Clear any pending debounce timer
        if (this.queueDebounceTimer !== null) {
            window.clearTimeout(this.queueDebounceTimer);
            this.queueDebounceTimer = null;
        }

        // Don't clear the queue - we want to preserve already queued files
        // Only clear on settings changes
        if (this.settingsChanged) {
            this.queue.length = 0;
        }

        // Reset settingsChanged flag after using it
        if (this.settingsChanged) {
            this.settingsChanged = false;
        }

        // Check if content generation is enabled
        if (!settings.showTags && !settings.showFilePreview && !settings.showFeatureImage && !settings.useFrontmatterMetadata) {
            return;
        }

        // Get file data from database to check what needs generation
        const db = getDBInstance();
        const paths = files.map(f => f.path);
        let fileDataMap: Map<string, FileData>;

        try {
            // Only get the specific files we need to check
            fileDataMap = db.getFiles(paths);
        } catch (error) {
            console.error('Failed to get files from database:', error);
            return;
        }

        // Build job queue - check what content needs generation
        const jobs: ContentJob[] = files.map(file => {
            const fileData = fileDataMap.get(file.path);

            // For modified files, always regenerate content
            const fileModified = fileData && fileData.mtime !== file.stat.mtime;

            // Check what needs generation based on null values OR file modification
            // IMPORTANT: We check for === null specifically, not falsy values
            // Empty string '' means preview was generated but file has no content
            const needsTags = !!(settings.showTags && (!fileData || fileData.tags === null || fileModified) && file.extension === 'md');
            const needsPreview = !!(
                settings.showFilePreview &&
                (!fileData || fileData.preview === null || fileModified) &&
                file.extension === 'md'
            );
            const needsImage = !!(settings.showFeatureImage && (!fileData || fileData.featureImage === null || fileModified));
            const needsMetadata = !!(
                settings.useFrontmatterMetadata &&
                (!fileData || fileData.metadata === null || fileModified) &&
                file.extension === 'md'
            );

            return {
                file,
                path: file.path.split('/'),
                needsTags,
                needsPreview,
                needsImage,
                needsMetadata
            };
        });

        // Filter out jobs that don't need any processing
        const activeJobs = jobs.filter(job => job.needsTags || job.needsPreview || job.needsImage || job.needsMetadata);

        if (activeJobs.length === 0) {
            return;
        }

        // Add jobs to existing queue array
        // Simple approach: just add the jobs, the debounce timer will handle duplicates
        this.queue.push(...activeJobs);

        // If already processing, stop and restart with new settings
        if (this.isProcessing) {
            this.stop();
        }

        // Debounce the start of processing to avoid race conditions
        this.queueDebounceTimer = window.setTimeout(() => {
            this.queueDebounceTimer = null;
            this.startProcessing(settings);
        }, TIMEOUTS.DEBOUNCE_CONTENT);
    }

    /**
     * Clear all preview text from the IndexedDB storage.
     * Uses an efficient cursor-based method to clear content without loading all data into memory.
     */
    public async clearPreviews(): Promise<void> {
        // Clear previews in database using efficient cursor-based method
        const db = getDBInstance();
        await db.batchClearAllFileContent('preview');
    }

    /**
     * Clear all feature images from the IndexedDB storage.
     * Uses an efficient cursor-based method to clear content without loading all data into memory.
     */
    public async clearFeatureImages(): Promise<void> {
        // Clear feature images in database using efficient cursor-based method
        const db = getDBInstance();
        await db.batchClearAllFileContent('featureImage');
    }

    /**
     * Clear all tags from the IndexedDB storage.
     * Uses an efficient cursor-based method to clear content without loading all data into memory.
     */
    public async clearTags(): Promise<void> {
        // Clear tags in database using efficient cursor-based method
        const db = getDBInstance();
        await db.batchClearAllFileContent('tags');
    }

    /**
     * Clear all metadata from the IndexedDB storage.
     * Uses an efficient cursor-based method to clear content without loading all data into memory.
     */
    public async clearMetadata(): Promise<void> {
        // Clear metadata in database using efficient cursor-based method
        const db = getDBInstance();
        await db.batchClearAllFileContent('metadata');
    }

    /**
     * Stop the current content generation process.
     * Clears the queue, cancels any pending operations, and resets the processing state.
     */
    public stop(): void {
        // Clear any pending debounce timer
        if (this.queueDebounceTimer !== null) {
            window.clearTimeout(this.queueDebounceTimer);
            this.queueDebounceTimer = null;
        }

        this.queue.length = 0; // Clear array contents without changing reference
        this.isProcessing = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Start processing the content generation queue.
     * Processes files in batches to maintain UI responsiveness.
     * Only logs progress for initial builds or settings changes, not for regular file updates.
     * @param settings - Current plugin settings
     */
    private async startProcessing(settings: NotebookNavigatorSettings): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        this.abortController = new AbortController();
        this.currentBatchSettings = settings;

        // Start processing asynchronously
        await this.processNextBatch();
    }

    /**
     * Process the next batch of files in the queue.
     * Processes up to BATCH_SIZE files in parallel for efficiency.
     * Generates preview text, feature images, and metadata as needed.
     * Updates the database in batch to minimize notification overhead.
     */
    private async processNextBatch(): Promise<void> {
        if (!this.isProcessing || this.queue.length === 0 || !this.currentBatchSettings) {
            this.completeProcessing();
            return;
        }

        const settings = this.currentBatchSettings;

        // Take files from queue for processing
        const batch = this.queue.splice(0, Math.min(this.QUEUE_BATCH_SIZE, this.queue.length));

        try {
            // Process files in chunks to limit concurrent I/O operations
            const results = [];

            for (let i = 0; i < batch.length; i += this.PARALLEL_LIMIT) {
                const chunk = batch.slice(i, i + this.PARALLEL_LIMIT);

                // Process this chunk in parallel
                const chunkResults = await Promise.all(
                    chunk.map(async job => {
                        try {
                            // Get metadata once for all operations
                            const metadata = this.app.metadataCache.getFileCache(job.file);

                            // Only read file content if we need preview text
                            const needsFileRead = job.needsPreview && job.file.extension === 'md';
                            const content = needsFileRead ? await this.app.vault.cachedRead(job.file) : null;

                            // Process all operations with shared metadata and content
                            const tags = job.needsTags ? this.extractTagsFromMetadata(metadata) : null;
                            const preview =
                                job.needsPreview && content
                                    ? PreviewTextUtils.extractPreviewText(content, settings, metadata?.frontmatter)
                                    : '';
                            const imageUrl = job.needsImage ? this.getFeatureImageUrlFromMetadata(job.file, metadata, settings) : '';
                            const metadataResult = job.needsMetadata
                                ? ContentService.extractMetadataFromCache(metadata, job.file, settings)
                                : {};

                            return {
                                job,
                                tags,
                                preview,
                                imageUrl,
                                metadata: metadataResult as { fn?: string; fc?: number; fm?: number },
                                success: true
                            };
                        } catch (error) {
                            console.log(`Error processing ${job.file.path}:`, error);
                            return {
                                job,
                                tags: null,
                                preview: '',
                                imageUrl: '',
                                metadata: {} as { fn?: string; fc?: number; fm?: number },
                                success: false
                            };
                        }
                    })
                );

                results.push(...chunkResults);
            }

            // Collect all updates for batch processing
            const batchUpdates: Array<{
                path: string;
                tags?: string[] | null;
                preview?: string;
                featureImage?: string;
                metadata?: { name?: string; created?: number; modified?: number };
            }> = [];

            const db = getDBInstance();

            for (const result of results) {
                if (!result.success) continue;

                const update: {
                    path: string;
                    tags?: string[] | null;
                    preview?: string;
                    featureImage?: string;
                    metadata?: { name?: string; created?: number; modified?: number };
                } = { path: result.job.file.path };

                let hasUpdates = false;

                // Get existing file data for comparison
                const existingFile = db.getFile(result.job.file.path);

                // Update tags if we processed them AND they changed
                if (result.job.needsTags) {
                    if (!existingFile || !this.tagsEqual(existingFile.tags, result.tags)) {
                        update.tags = result.tags;
                        hasUpdates = true;
                    }
                }

                // Update preview if we processed it AND it changed
                if (result.job.needsPreview) {
                    if (!existingFile || existingFile.preview !== result.preview) {
                        update.preview = result.preview;
                        hasUpdates = true;
                    }
                }

                // Update feature image if we processed it AND it changed
                if (result.job.needsImage) {
                    if (!existingFile || existingFile.featureImage !== result.imageUrl) {
                        update.featureImage = result.imageUrl;
                        hasUpdates = true;
                    }
                }

                // Update metadata if we processed it
                if (result.job.needsMetadata && result.metadata) {
                    update.metadata = {
                        name: result.metadata.fn,
                        created: result.metadata.fc,
                        modified: result.metadata.fm
                    };
                    hasUpdates = true;
                }

                // Add to batch if there are updates
                if (hasUpdates) {
                    batchUpdates.push(update);
                }
            }

            // Update database in batch to avoid multiple notifications
            // Note: batchUpdateFileContent emits change notifications so UI updates immediately
            if (batchUpdates.length > 0) {
                await db.batchUpdateFileContent(batchUpdates);
            }

            // Update mtimes for successfully processed files
            // This is done after content generation to prevent race conditions
            // Note: updateMtimes does NOT emit notifications - it's internal bookkeeping only
            // The UI already updated from batchUpdateFileContent above
            const mtimeUpdates: Array<{ path: string; mtime: number }> = [];
            for (const result of results) {
                if (result.success) {
                    mtimeUpdates.push({
                        path: result.job.file.path,
                        mtime: result.job.file.stat.mtime
                    });
                }
            }

            if (mtimeUpdates.length > 0) {
                await db.updateMtimes(mtimeUpdates);
            }

            // Process next batch if there are more files
            if (this.queue.length > 0 && !this.abortController?.signal.aborted) {
                // Use setImmediate/setTimeout to avoid blocking
                setTimeout(() => this.processNextBatch(), TIMEOUTS.YIELD_TO_EVENT_LOOP);
            } else {
                this.completeProcessing();
            }
        } catch (error) {
            console.error('Error in batch processing:', error);
            this.completeProcessing();
        }
    }

    /**
     * Complete the content generation process.
     * Resets processing state and logs completion stats for non-regular updates.
     */
    private completeProcessing(): void {
        this.isProcessing = false;
        this.abortController = null;
        this.currentBatchSettings = null;
        // No need to notify - database will emit change events
    }

    private getFeatureImageUrlFromMetadata(file: TFile, metadata: CachedMetadata | null, settings: NotebookNavigatorSettings): string {
        // Only process markdown files for feature images
        if (file.extension !== 'md') {
            return '';
        }

        // Try each property in order until we find an image
        for (const property of settings.featureImageProperties) {
            const imagePath = metadata?.frontmatter?.[property];

            if (!imagePath) {
                continue;
            }

            // Handle wikilinks e.g., [[image.png]]
            const resolvedPath = imagePath.startsWith('[[') && imagePath.endsWith(']]') ? imagePath.slice(2, -2) : imagePath;

            const imageFile = this.app.metadataCache.getFirstLinkpathDest(resolvedPath, file.path);

            if (imageFile) {
                // Store just the path, not the full app:// URL
                return imageFile.path;
            }
        }

        // Check embedded images as fallback
        if (metadata?.embeds && metadata.embeds.length > 0) {
            for (const embed of metadata.embeds) {
                const embedPath = embed.link;
                const embedFile = this.app.metadataCache.getFirstLinkpathDest(embedPath, file.path);
                if (embedFile && isImageFile(embedFile)) {
                    // Store just the path, not the full app:// URL
                    return embedFile.path;
                }
            }
        }

        return '';
    }

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
