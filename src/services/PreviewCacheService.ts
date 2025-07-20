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
import { PreviewTextUtils } from '../utils/PreviewTextUtils';
import { findFileInCache } from '../utils/fileCacheUtils';
import { FileCache, CacheNode, isFileData, GENERATED_FLAGS } from '../types/cache';
import { isImageFile } from '../utils/fileTypeUtils';

interface ContentJob {
    file: TFile;
    path: string[];
    needsPreview: boolean;
    needsImage: boolean;
    needsMetadata: boolean;
}


export class PreviewCacheService {
    private app: App;
    private settings: NotebookNavigatorSettings;
    private queue: ContentJob[] = [];
    private isProcessing = false;
    // private currentBatch = 0; // TODO: Use for progress tracking
    private totalFiles = 0;
    private startTime = 0;
    private abortController: AbortController | null = null;
    private onCacheUpdated: (cache: FileCache) => void;
    private extractMetadata: (file: TFile) => { fn?: string; fc?: number; fm?: number };
    private cache: FileCache | null = null;
    private queueDebounceTimer: number | null = null;
    private settingsChanged = false;
    private shouldLogCurrentBatch = true;

    constructor(
        app: App, 
        settings: NotebookNavigatorSettings, 
        onCacheUpdated: (cache: FileCache) => void,
        extractMetadata: (file: TFile) => { fn?: string; fc?: number; fm?: number }
    ) {
        this.app = app;
        this.settings = settings;
        this.onCacheUpdated = onCacheUpdated;
        this.extractMetadata = extractMetadata;
    }
    
    /**
     * Update settings without recreating the service
     */
    public updateSettings(settings: NotebookNavigatorSettings): void {
        this.settings = settings;
    }


    /**
     * Queue files for content generation (always generates both preview text and feature images)
     */
    public queueContent(files: TFile[], cache: FileCache, isInitialBuild: boolean = false): void {
        
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

        // Store cache reference
        this.cache = cache;

        // Build job queue - check what content needs generation
        const jobs: ContentJob[] = files.map(file => {
            const fileNode = findFileInCache(cache.root, file.path);
            const g = fileNode?.g || 0;
            
            
            // Check what needs generation based on current settings vs what was generated
            const hasPreview = (g & GENERATED_FLAGS.PREVIEW) !== 0;
            const hasFeature = (g & GENERATED_FLAGS.FEATURE) !== 0;
            const hasMetadata = (g & GENERATED_FLAGS.METADATA) !== 0;
            
            const needsPreview = this.settings.showFilePreview && !hasPreview && file.extension === 'md';
            const needsImage = this.settings.showFeatureImage && !hasFeature;
            const needsMetadata = this.settings.useFrontmatterMetadata && !hasMetadata && file.extension === 'md';
            
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
        // this.currentBatch = 0;
        
        
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
     * Clear all preview text from cache
     */
    public async clearPreviews(cache: FileCache): Promise<void> {
        if (!cache) return;

        let cleared = 0;
        
        const clearNode = (node: CacheNode) => {
            for (const key in node) {
                const value = node[key];
                if (isFileData(value)) {
                    // It's a file node
                    value.p = '';
                    // Clear the preview flag
                    value.g = (value.g || 0) & ~GENERATED_FLAGS.PREVIEW;
                    cleared++;
                } else if (typeof value === 'object' && value !== null) {
                    // It's a folder, recurse
                    clearNode(value);
                }
            }
        };

        clearNode(cache.root);
        
        if (cleared > 0 && cache) {
            this.onCacheUpdated(cache);
        }
    }

    /**
     * Clear all feature images from cache
     */
    public async clearFeatureImages(cache: FileCache): Promise<void> {
        if (!cache) return;

        let cleared = 0;
        
        const clearNode = (node: CacheNode) => {
            for (const key in node) {
                const value = node[key];
                if (isFileData(value)) {
                    // It's a file node
                    value.f = '';
                    // Clear the feature flag
                    value.g = (value.g || 0) & ~GENERATED_FLAGS.FEATURE;
                    cleared++;
                } else if (typeof value === 'object' && value !== null) {
                    // It's a folder, recurse
                    clearNode(value);
                }
            }
        };

        clearNode(cache.root);
        
        if (cleared > 0 && cache) {
            this.onCacheUpdated(cache);
        }
    }

    /**
     * Clear all metadata from cache
     */
    public async clearMetadata(cache: FileCache): Promise<void> {
        if (!cache) return;

        let cleared = 0;
        
        const clearNode = (node: CacheNode) => {
            for (const key in node) {
                const value = node[key];
                if (isFileData(value)) {
                    // It's a file node
                    value.fn = undefined;
                    value.fc = undefined;
                    value.fm = undefined;
                    // Clear the metadata flag
                    value.g = (value.g || 0) & ~GENERATED_FLAGS.METADATA;
                    cleared++;
                } else if (typeof value === 'object' && value !== null) {
                    // It's a folder, recurse
                    clearNode(value);
                }
            }
        };

        clearNode(cache.root);
        
        if (cleared > 0 && cache) {
            this.onCacheUpdated(cache);
        }
    }

    /**
     * Stop the current processing job
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
     * Start processing the queue
     */
    private async startProcessing(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        this.startTime = performance.now();
        this.abortController = new AbortController();
        
        // Only log if we should (not for regular file updates)
        if (this.shouldLogCurrentBatch) {
            console.log(`Starting processing of ${this.totalFiles} files`);
        }
        
        // Start processing asynchronously
        await this.processNextBatch();
    }

    /**
     * Process the next batch of files with parallel processing
     */
    private async processNextBatch(): Promise<void> {
        if (!this.isProcessing || this.queue.length === 0) {
            this.completeProcessing();
            return;
        }

        if (!this.cache) {
            this.completeProcessing();
            return;
        }

        // Take a larger batch for parallel processing
        const BATCH_SIZE = 100;
        const batch = this.queue.splice(0, Math.min(BATCH_SIZE, this.queue.length));
        // const batchStartTime = performance.now(); // TODO: Use for performance monitoring
        
        
        try {
            // Process all files in parallel
            const results = await Promise.all(
                batch.map(async (job) => {
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
                        console.debug(`Error processing ${job.file.path}:`, error);
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
            
            // Batch update the cache
            for (const result of results) {
                if (!result.success) continue;
                
                // Navigate to file in cache
                let current: CacheNode = this.cache.root;
                for (let i = 0; i < result.job.path.length - 1; i++) {
                    const next = current[result.job.path[i]];
                    if (!next || typeof next !== 'object' || 'm' in next) {
                        break;
                    }
                    current = next as CacheNode;
                }
                
                const fileName = result.job.path[result.job.path.length - 1];
                const fileNode = current[fileName];
                
                if (isFileData(fileNode)) {
                    // Update generated flags based on what we processed
                    let updatedFlags = fileNode.g || 0;
                    
                    // Update preview if we processed it
                    if (result.job.needsPreview) {
                        fileNode.p = result.preview;
                        updatedFlags |= GENERATED_FLAGS.PREVIEW;
                    }
                    
                    // Update feature image if we processed it
                    if (result.job.needsImage) {
                        fileNode.f = result.imageUrl;
                        updatedFlags |= GENERATED_FLAGS.FEATURE;
                    }
                    
                    // Update metadata if we processed it
                    if (result.job.needsMetadata && result.metadata) {
                        if (result.metadata.fn !== undefined) {
                            fileNode.fn = result.metadata.fn;
                            }
                        if (result.metadata.fc !== undefined) {
                            fileNode.fc = result.metadata.fc;
                            }
                        if (result.metadata.fm !== undefined) {
                            fileNode.fm = result.metadata.fm;
                            }
                        updatedFlags |= GENERATED_FLAGS.METADATA;
                    }
                    
                    // Clear content for disabled features to save space
                    if (!this.settings.showFilePreview && fileNode.p) {
                        fileNode.p = '';
                        updatedFlags &= ~GENERATED_FLAGS.PREVIEW;
                    }
                    
                    if (!this.settings.showFeatureImage && fileNode.f) {
                        fileNode.f = '';
                        updatedFlags &= ~GENERATED_FLAGS.FEATURE;
                    }
                    
                    if (!this.settings.useFrontmatterMetadata) {
                        if (fileNode.fn !== undefined || fileNode.fc !== undefined || fileNode.fm !== undefined) {
                            fileNode.fn = undefined;
                            fileNode.fc = undefined;
                            fileNode.fm = undefined;
                            updatedFlags &= ~GENERATED_FLAGS.METADATA;
                            }
                    }
                    
                    // Update the generated flag
                    fileNode.g = updatedFlags;
                }
            }
            
            // Update progress
            // this.currentBatch += batch.length;
            
            
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
     * Generate preview for a single file with optimized metadata usage
     */
    private async generatePreviewOptimized(file: TFile): Promise<string> {
        const metadata = this.app.metadataCache.getFileCache(file);
        
        // Fast Excalidraw detection using metadata
        if (file.name.endsWith('.excalidraw.md') || 
            metadata?.frontmatter?.['excalidraw-plugin'] ||
            (metadata?.frontmatter?.tags && 
             (Array.isArray(metadata.frontmatter.tags) 
                ? metadata.frontmatter.tags.includes('excalidraw')
                : metadata.frontmatter.tags === 'excalidraw'))) {
            return 'EXCALIDRAW';
        }
        
        // Note: In the future, we could extract preview from metadata without file read
        // if Obsidian exposes section text content in metadata cache
        
        // Fall back to file read only if necessary
        const content = await this.app.vault.cachedRead(file);
        return PreviewTextUtils.extractPreviewText(content, this.settings);
    }
    

    /**
     * Complete the processing job
     */
    private completeProcessing(): void {
        this.isProcessing = false;
        this.abortController = null;
        
        if (this.totalFiles > 0) {
            const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(2);
            
            // Calculate cache size if available
            let cacheSize = '';
            if (this.cache) {
                const cacheSizeBytes = JSON.stringify(this.cache).length;
                cacheSize = ` (cache size: ${(cacheSizeBytes / 1024 / 1024).toFixed(2)}MB)`;
            }
            
            // Only log if we should (not for regular file updates)
            if (this.shouldLogCurrentBatch) {
                console.log(`Completed processing ${this.totalFiles} files in ${elapsed}s${cacheSize}`);
            }
        }
        
        // Notify parent once at the end with the fully updated cache
        if (this.cache) {
            this.onCacheUpdated(this.cache);
        }
        
        this.cache = null;
        
        // Note: settingsChanged is already reset in queueContent after determining shouldLogCurrentBatch
    }



    /**
     * Get feature image URL for a file
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
                const resolvedPath = imagePath.startsWith('[[') && imagePath.endsWith(']]')
                    ? imagePath.slice(2, -2)
                    : imagePath;

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