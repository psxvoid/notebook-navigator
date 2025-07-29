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

import { App, TFile, getAllTags } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { FileData } from '../storage/IndexedDBStorage';
import { getDBInstance } from '../storage/fileOperations';
import { isImageFile } from '../utils/fileTypeUtils';
import { PreviewTextUtils } from '../utils/previewTextUtils';

interface ContentJob {
    file: TFile;
    path: string[];
    needsTags: boolean;
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
    private abortController: AbortController | null = null;
    private app: App;
    // Removed onCacheUpdated as it's no longer used with the new database notification system
    private extractMetadata: (file: TFile) => { fn?: string; fc?: number; fm?: number };
    private isProcessing = false;
    private queue: ContentJob[] = [];
    private queueDebounceTimer: number | null = null;
    private settings: NotebookNavigatorSettings;
    private settingsChanged = false;
    private shouldLogCurrentBatch = true;
    private startTime = 0;
    private totalFiles = 0;

    constructor(
        app: App,
        settings: NotebookNavigatorSettings,
        extractMetadata: (file: TFile) => { fn?: string; fc?: number; fm?: number }
    ) {
        this.app = app;
        this.settings = settings;
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
     */
    public async queueContent(files: TFile[]): Promise<void> {
        // Clear any pending debounce timer
        if (this.queueDebounceTimer !== null) {
            window.clearTimeout(this.queueDebounceTimer);
            this.queueDebounceTimer = null;
        }

        // Determine if this is a regular file update (not settings change)
        const isRegularFileUpdate = !this.settingsChanged;

        // Set whether we should log for this batch
        this.shouldLogCurrentBatch = !isRegularFileUpdate;

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
        if (
            !this.settings.showTags &&
            !this.settings.showFilePreview &&
            !this.settings.showFeatureImage &&
            !this.settings.useFrontmatterMetadata
        ) {
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
            const needsTags = !!(
                this.settings.showTags &&
                (!fileData || fileData.tags === null || fileModified) &&
                file.extension === 'md'
            );
            const needsPreview = !!(
                this.settings.showFilePreview &&
                (!fileData || fileData.preview === null || fileModified) &&
                file.extension === 'md'
            );
            const needsImage = !!(this.settings.showFeatureImage && (!fileData || fileData.featureImage === null || fileModified));
            const needsMetadata = !!(
                this.settings.useFrontmatterMetadata &&
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
            console.log(`[${new Date().toISOString()}] ContentService: Starting batch processing of ${this.totalFiles} files`);
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
                        // Process tags, preview, image and metadata in parallel
                        const [tags, preview, imageUrl, metadata] = await Promise.all([
                            job.needsTags ? this.extractTags(job.file) : Promise.resolve(null),
                            job.needsPreview ? this.generatePreviewOptimized(job.file) : Promise.resolve(''),
                            job.needsImage ? Promise.resolve(this.getFeatureImageUrl(job.file)) : Promise.resolve(''),
                            job.needsMetadata ? Promise.resolve(this.extractMetadata(job.file)) : Promise.resolve({})
                        ]);

                        return {
                            job,
                            tags,
                            preview,
                            imageUrl,
                            metadata: metadata as { fn?: string; fc?: number; fm?: number },
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
        // Note: settingsChanged is already reset in queueContent after determining shouldLogCurrentBatch
        // No need to notify - database will emit change events
        if (this.shouldLogCurrentBatch) {
            const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(2);
            console.log(`[${new Date().toISOString()}] ContentService: Completed processing ${this.totalFiles} files in ${elapsed}s`);
        }
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
        }

        return '';
    }

    /**
     * Extract tags from a file's metadata.
     * Returns tags without the # prefix for consistency with the database.
     *
     * @param file - The file to extract tags from
     * @returns Array of tag strings without # prefix
     */
    private extractTags(file: TFile): string[] {
        const metadata = this.app.metadataCache.getFileCache(file);
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
