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
import { IContentProvider, ContentType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';
import { FileData, FileDataCache } from '../../storage/IndexedDBStorage';
import { getDBInstance, isShutdownInProgress } from '../../storage/fileOperations';
import { TIMEOUTS } from '../../types/obsidian-extended';

export interface ContentJob {
    file: TFile;
    path: string[];
}

// Review: Refactoring: reuse everywhere
export interface ProcessResult {
    path: string;
    tags?: readonly string[] | null;
    preview?: string;
    featureImage?: string;
    featureImageResized?: string;
    featureImageProvider?: string;
    featureImageConsumers?: readonly string[];
    metadata?: FileData['metadata'];
    forceUpdate?: boolean;
}

/**
 * Base class for content providers
 * Provides common functionality for queue management and batch processing
 */
export abstract class BaseContentProvider implements IContentProvider {
    protected readonly QUEUE_BATCH_SIZE = 100;
    protected readonly PARALLEL_LIMIT = 10;

    protected queue: ContentJob[] = [];
    protected isProcessing = false;
    protected abortController: AbortController | null = null;
    protected queueDebounceTimer: number | null = null;
    protected currentBatchSettings: NotebookNavigatorSettings | null = null;
    // Track files currently being processed to prevent duplicate processing
    // when multiple events fire for the same file in quick succession
    protected processingFiles: Set<string> = new Set();
    // Track files already queued to avoid unbounded duplicate enqueues
    protected queuedFiles: Set<string> = new Set();

    // Track provider stop state to prevent any post-stop scheduling or enqueues
    protected stopped = false;

    constructor(protected app: App) {}

    abstract getContentType(): ContentType;
    abstract getRelevantSettings(): (keyof NotebookNavigatorSettings)[];
    abstract shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean;
    abstract clearContent(): Promise<void>;

    /**
     * Process a single file to generate content
     * @param job - The job to process
     * @param fileData - Existing file data from database
     * @param settings - Current settings
     * @returns Updated file data or null if no update needed
     */
    protected abstract processFile(
        job: ContentJob,
        fileData: FileDataCache | null,
        settings: NotebookNavigatorSettings
    ): Promise<ProcessResult | (ProcessResult | null) [] | null>;

    /**
     * Checks if a file needs processing
     * @param fileData - Existing file data
     * @param file - The file to check
     * @param settings - Current settings
     * @returns True if the file needs processing
     */
    protected abstract needsProcessing(fileData: FileDataCache | null, file: TFile, settings: NotebookNavigatorSettings): boolean;

    queueFiles(files: TFile[]): void {
        if (this.stopped) return;
        // Filter out files that are currently being processed or already queued
        const newJobs: ContentJob[] = [];
        for (const file of files) {
            const p = file.path;
            if (this.processingFiles.has(p) || this.queuedFiles.has(p)) continue;
            newJobs.push({ file, path: p.split('/') });
            this.queuedFiles.add(p);
        }

        if (newJobs.length > 0) {
            this.queue.push(...newJobs);
        }
    }

    startProcessing(settings: NotebookNavigatorSettings): void {
        // Allow restarting after a stop
        this.stopped = false;
        this.currentBatchSettings = settings;

        if (this.queueDebounceTimer !== null) {
            window.clearTimeout(this.queueDebounceTimer);
        }

        this.queueDebounceTimer = window.setTimeout(() => {
            this.queueDebounceTimer = null;
            if (!this.stopped && !this.isProcessing && this.queue.length > 0) {
                this.processNextBatch();
            }
        }, TIMEOUTS.DEBOUNCE_CONTENT);
    }

    onSettingsChanged(settings: NotebookNavigatorSettings): void {
        this.currentBatchSettings = settings;
    }

    protected async processNextBatch(): Promise<void> {
        if (this.stopped || this.isProcessing || this.queue.length === 0 || !this.currentBatchSettings) {
            return;
        }

        this.isProcessing = true;
        this.abortController = new AbortController();
        const settings = this.currentBatchSettings;

        // Declare activeJobs outside try block so it's accessible in finally
        let activeJobs: { job: ContentJob; fileData: FileDataCache | null; needsProcessing: boolean }[] = [];

        try {
            const db = getDBInstance();
            const batch = this.queue.splice(0, this.QUEUE_BATCH_SIZE);
            // Remove from queued set now that they're moving to evaluation/processing
            batch.forEach(job => this.queuedFiles.delete(job.file.path));

            // Filter jobs based on current settings and database state
            const jobsWithData = await Promise.all(
                batch.map(async job => {
                    const fileData = await db.getFile(job.file.path);
                    const needsProcessing = this.needsProcessing(fileData, job.file, settings);
                    return { job, fileData, needsProcessing };
                })
            );

            activeJobs = jobsWithData.filter(item => item.needsProcessing);

            if (activeJobs.length === 0) {
                this.isProcessing = false;
                if (this.queue.length > 0) {
                    this.processNextBatch();
                }
                return;
            }

            // Mark files as being processed
            activeJobs.forEach(({ job }) => {
                this.processingFiles.add(job.file.path);
            });

            // Process files in parallel batches
            const updates: {
                path: string;
                tags?: readonly string[] | null;
                preview?: string;
                featureImage?: string;
                featureImageProvider?: string;
                featureImageConsumers?: readonly string[] | null;
                metadata?: FileData['metadata'];
            }[] = [];

            for (let i = 0; i < activeJobs.length; i += this.PARALLEL_LIMIT) {
                if (this.stopped || this.abortController?.signal.aborted) break;

                const parallelBatch = activeJobs.slice(i, i + this.PARALLEL_LIMIT);
                const results = await Promise.all(
                    parallelBatch.map(async ({ job, fileData }) => {
                        try {
                            return await this.processFile(job, fileData, settings);
                        } catch (error) {
                            console.error(`Error processing ${job.file.path}:`, error);
                            return null;
                        }
                    })
                );

                updates.push(
                    ...results.flat().filter(
                        (
                            r
                        ): r is ProcessResult => r !== null
                    )
                );
            }

            // Batch update database
            if (updates.length > 0 && !(this.stopped || this.abortController?.signal.aborted)) {
                // During plugin shutdown, skip writes to avoid benign transaction errors
                if (!isShutdownInProgress()) {
                    await db.batchUpdateFileContent(updates);

                    // Update mtimes for successfully processed files
                    // This is done after content generation to prevent race conditions
                    // Note: updateMtimes does NOT emit notifications - it's internal bookkeeping only
                    // The UI already updated from batchUpdateFileContent above
                    const mtimeUpdates: { path: string; mtime: number }[] = [];
                    for (const { job } of activeJobs) {
                        if (updates.some(u => u.path === job.file.path)) {
                            mtimeUpdates.push({
                                path: job.file.path,
                                mtime: job.file.stat.mtime
                            });
                        }
                    }

                    if (mtimeUpdates.length > 0) {
                        await db.updateMtimes(mtimeUpdates);
                    }
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error processing batch:', error);
            }
        } finally {
            // Remove processed files from tracking set
            activeJobs.forEach(({ job }) => {
                this.processingFiles.delete(job.file.path);
            });

            this.isProcessing = false;

            if (this.queue.length > 0 && !(this.stopped || this.abortController?.signal.aborted)) {
                // Process next batch
                requestAnimationFrame(() => this.processNextBatch());
            }
        }
    }

    stopProcessing(): void {
        // Mark stopped first so any in-flight logic can observe it
        this.stopped = true;

        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        if (this.queueDebounceTimer !== null) {
            window.clearTimeout(this.queueDebounceTimer);
            this.queueDebounceTimer = null;
        }

        this.isProcessing = false;
        this.queue = [];
        this.processingFiles.clear();
        this.queuedFiles.clear();
    }
}
