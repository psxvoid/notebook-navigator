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

import { App, TFile } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { PreviewTextUtils } from '../utils/previewTextUtils';
import { isImageFile } from '../utils/fileTypeUtils';
import { getDBInstance } from '../storage/fileOperations';
import { FileData } from '../storage/database';

interface ContentJob {
    file: TFile;
    path: string[];
    needsPreview: boolean;
    needsImage: boolean;
    needsMetadata: boolean;
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
 * - Uses: Database (stores generated content), PreviewTextUtils (text extraction)
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
    private app: App;
    private settings: NotebookNavigatorSettings;
    private queue: ContentJob[] = [];
    private isProcessing = false;
    private totalFiles = 0;
    private startTime = 0;
    private abortController: AbortController | null = null;
    // Removed onCacheUpdated as it's no longer used with the new database notification system
    private extractMetadata: (file: TFile) => { fn?: string; fc?: number; fm?: number };
    private queueDebounceTimer: number | null = null;
    private settingsChanged = false;
    private shouldLogCurrentBatch = true;

    constructor(
        app: App,
        settings: NotebookNavigatorSettings,
        onCacheUpdated: () => void,
        extractMetadata: (file: TFile) => { fn?: string; fc?: number; fm?: number }
    ) {
        this.app = app;
        this.settings = settings;
        // onCacheUpdated parameter kept for backwards compatibility but not used
        this.extractMetadata = extractMetadata;
    }

    /**
     * Update settings without recreating the service.
     * This allows the service to adapt to setting changes without losing its queue or state.
     *
     * @param settings - The new settings to apply
     */
    public updateSettings(settings: NotebookNavigatorSettings): void {
        this.settings = settings;
    }

    /**
     * Queue files for content generation (preview text, feature images, and metadata).
     * Files are processed in batches to avoid blocking the UI. The service checks what
     * content needs to be generated based on current settings and existing data.
     *
     * @param files - Array of files to process
     * @param _cache - Unused parameter (kept for backwards compatibility)
     * @param isInitialBuild - Whether this is the initial vault scan
     */
    public async queueContent(files: TFile[], _cache: unknown, isInitialBuild: boolean = false): Promise<void> {
        // Clear any pending debounce timer
        if (this.queueDebounceTimer !== null) {
            window.clearTimeout(this.queueDebounceTimer);
            this.queueDebounceTimer = null;
        }

        // Determine if this is a regular file update (not initial build or settings change)
        const isRegularFileUpdate = !isInitialBuild && !this.settingsChanged;

        // Set whether we should log for this batch
        this.shouldLogCurrentBatch = !isRegularFileUpdate;

        // Reset settingsChanged flag after using it to determine logging
        // This prevents it from persisting and causing logs for subsequent file edits
        if (this.settingsChanged) {
            this.settingsChanged = false;
        }

        // Always clear the queue to re-evaluate what needs processing with new settings
        this.queue.length = 0;

        // Check if content generation is enabled
        if (!this.settings.showFilePreview && !this.settings.showFeatureImage && !this.settings.useFrontmatterMetadata) {
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

            // Check what needs generation based on null values
            const needsPreview = this.settings.showFilePreview && (!fileData || fileData.preview === null) && file.extension === 'md';
            const needsImage = this.settings.showFeatureImage && (!fileData || fileData.featureImage === null);
            const needsMetadata =
                this.settings.useFrontmatterMetadata && (!fileData || fileData.metadata === null) && file.extension === 'md';

            if (needsPreview || needsImage || needsMetadata) {
            }

            return {
                file,
                path: file.path.split('/'),
                needsPreview,
                needsImage,
                needsMetadata
            };
        });

        // Filter out jobs that don't need any processing
        const activeJobs = jobs.filter(job => job.needsPreview || job.needsImage || job.needsMetadata);

        if (activeJobs.length === 0) {
            return;
        }

        // Add jobs to existing queue array instead of replacing it
        this.queue.push(...activeJobs);
        this.totalFiles = this.queue.length;

        // If already processing, stop and restart with new settings
        if (this.isProcessing) {
            this.stop();
        }

        // Debounce the start of processing to avoid race conditions
        this.queueDebounceTimer = window.setTimeout(() => {
            this.queueDebounceTimer = null;
            this.startProcessing();
        }, 300); // 300ms debounce
    }

    /**
     * Clear all preview text from the database cache.
     * Uses an efficient cursor-based method to clear content without loading all data into memory.
     */
    public async clearPreviews(): Promise<void> {
        // Clear previews in database using efficient cursor-based method
        const db = getDBInstance();
        await db.batchClearAllFileContent('preview');
    }

    /**
     * Clear all feature images from the database cache.
     * Uses an efficient cursor-based method to clear content without loading all data into memory.
     */
    public async clearFeatureImages(): Promise<void> {
        // Clear feature images in database using efficient cursor-based method
        const db = getDBInstance();
        await db.batchClearAllFileContent('featureImage');
    }

    /**
     * Clear all metadata from the database cache.
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
     */
    private async startProcessing(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        this.startTime = performance.now();
        this.abortController = new AbortController();

        // Only log if we should (not for regular file updates)
        if (this.shouldLogCurrentBatch) {
        } else {
        }

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
        if (!this.isProcessing || this.queue.length === 0) {
            this.completeProcessing();
            return;
        }

        // Take a larger batch for parallel processing
        const BATCH_SIZE = 100;
        const batch = this.queue.splice(0, Math.min(BATCH_SIZE, this.queue.length));

        try {
            // Process all files in parallel
            const results = await Promise.all(
                batch.map(async job => {
                    try {
                        // Process preview, image and metadata in parallel
                        const [preview, imageUrl, metadata] = await Promise.all([
                            job.needsPreview ? this.generatePreviewOptimized(job.file) : Promise.resolve(''),
                            job.needsImage ? Promise.resolve(this.getFeatureImageUrl(job.file)) : Promise.resolve(''),
                            job.needsMetadata ? Promise.resolve(this.extractMetadata(job.file)) : Promise.resolve({})
                        ]);

                        return {
                            job,
                            preview,
                            imageUrl,
                            metadata: metadata as { fn?: string; fc?: number; fm?: number },
                            success: true
                        };
                    } catch (error) {
                        console.log(`Error processing ${job.file.path}:`, error);
                        return {
                            job,
                            preview: '',
                            imageUrl: '',
                            metadata: {} as { fn?: string; fc?: number; fm?: number },
                            success: false
                        };
                    }
                })
            );

            // Collect all updates for batch processing
            const batchUpdates: Array<{
                path: string;
                preview?: string;
                featureImage?: string;
                metadata?: { name?: string; created?: number; modified?: number };
            }> = [];

            for (const result of results) {
                if (!result.success) continue;

                const update: {
                    path: string;
                    preview?: string;
                    featureImage?: string;
                    metadata?: { name?: string; created?: number; modified?: number };
                } = { path: result.job.file.path };

                let hasUpdates = false;

                // Update preview if we processed it
                if (result.job.needsPreview) {
                    update.preview = result.preview;
                    hasUpdates = true;
                }

                // Update feature image if we processed it
                if (result.job.needsImage) {
                    update.featureImage = result.imageUrl;
                    hasUpdates = true;
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
            if (batchUpdates.length > 0) {
                const db = getDBInstance();
                await db.batchUpdateFileContent(batchUpdates);
            }

            // Don't notify on every batch - wait until completion
            // This prevents saving intermediate states to localStorage

            // Process next batch if there are more files
            if (this.queue.length > 0 && !this.abortController?.signal.aborted) {
                // Use setImmediate/setTimeout to avoid blocking
                setTimeout(() => this.processNextBatch(), 0);
            } else {
                this.completeProcessing();
            }
        } catch (error) {
            console.error('Error in batch processing:', error);
            this.completeProcessing();
        }
    }

    /**
     * Generate preview text for a single file.
     * Handles special cases like Excalidraw files and respects skipHeadingsInPreview setting.
     *
     * @param file - The file to generate preview for
     * @returns Preview text string, or 'EXCALIDRAW' for Excalidraw files
     */
    private async generatePreviewOptimized(file: TFile): Promise<string> {
        const metadata = this.app.metadataCache.getFileCache(file);

        // Fast Excalidraw detection using metadata
        if (
            file.name.endsWith('.excalidraw.md') ||
            metadata?.frontmatter?.['excalidraw-plugin'] ||
            (metadata?.frontmatter?.tags &&
                (Array.isArray(metadata.frontmatter.tags)
                    ? metadata.frontmatter.tags.includes('excalidraw')
                    : metadata.frontmatter.tags === 'excalidraw'))
        ) {
            return 'EXCALIDRAW';
        }

        // Note: In the future, we could extract preview from metadata without file read
        // if Obsidian exposes section text content in metadata cache

        // Fall back to file read only if necessary
        const content = await this.app.vault.cachedRead(file);
        return PreviewTextUtils.extractPreviewText(content, this.settings, metadata?.frontmatter);
    }

    /**
     * Complete the content generation process.
     * Resets processing state and logs completion stats for non-regular updates.
     */
    private completeProcessing(): void {
        this.isProcessing = false;
        this.abortController = null;

        if (this.totalFiles > 0) {
            // Only calculate elapsed time when logging is enabled
            if (this.shouldLogCurrentBatch) {
                const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(2);
                // Logging handled elsewhere
            }
        }

        // Note: settingsChanged is already reset in queueContent after determining shouldLogCurrentBatch
        // No need to notify - database will emit change events
    }

    /**
     * Extract feature image URL from a file's frontmatter or embedded images.
     * Checks frontmatter properties in order specified by settings.
     * Falls back to first embedded image if no frontmatter image found.
     *
     * @param file - The file to extract image from
     * @returns Image URL string, or empty string if no image found
     */
    private getFeatureImageUrl(file: TFile): string {
        // Only process markdown files for feature images
        if (file.extension === 'md') {
            const metadata = this.app.metadataCache.getFileCache(file);

            // Try each property in order until we find an image
            for (const property of this.settings.featureImageProperties) {
                const imagePath = metadata?.frontmatter?.[property];

                if (!imagePath) {
                    continue;
                }

                // Handle wikilinks e.g., [[image.png]]
                const resolvedPath = imagePath.startsWith('[[') && imagePath.endsWith(']]') ? imagePath.slice(2, -2) : imagePath;

                const imageFile = this.app.metadataCache.getFirstLinkpathDest(resolvedPath, file.path);

                if (imageFile) {
                    try {
                        const resourcePath = this.app.vault.getResourcePath(imageFile);
                        // Validate that the resource path is valid before returning
                        // This helps prevent broken cached URLs
                        if (resourcePath && !resourcePath.includes('undefined')) {
                            return resourcePath;
                        }
                    } catch (e) {
                        // Image file might have been deleted or moved
                        continue;
                    }
                }
            }

            // Check embedded images as fallback
            if (metadata?.embeds && metadata.embeds.length > 0) {
                for (const embed of metadata.embeds) {
                    const embedPath = embed.link;
                    const embedFile = this.app.metadataCache.getFirstLinkpathDest(embedPath, file.path);
                    if (embedFile && isImageFile(embedFile)) {
                        try {
                            return this.app.vault.getResourcePath(embedFile);
                        } catch (e) {
                            continue;
                        }
                    }
                }
            }
        }

        return '';
    }
}
