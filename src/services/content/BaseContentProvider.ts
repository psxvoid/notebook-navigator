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
import { FileData } from '../../storage/IndexedDBStorage';
import { getDBInstance } from '../../storage/fileOperations';
import { TIMEOUTS } from '../../types/obsidian-extended';

interface ContentJob {
    file: TFile;
    path: string[];
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
        fileData: FileData | null,
        settings: NotebookNavigatorSettings
    ): Promise<{
        path: string;
        tags?: string[] | null;
        preview?: string;
        featureImage?: string;
        metadata?: FileData['metadata'];
    } | null>;

    /**
     * Checks if a file needs processing
     * @param fileData - Existing file data
     * @param file - The file to check
     * @param settings - Current settings
     * @returns True if the file needs processing
     */
    protected abstract needsProcessing(fileData: FileData | null, file: TFile, settings: NotebookNavigatorSettings): boolean;

    queueFiles(files: TFile[]): void {
        const newJobs = files.map(file => ({
            file,
            path: file.path.split('/')
        }));

        this.queue.push(...newJobs);
    }

    startProcessing(settings: NotebookNavigatorSettings): void {
        this.currentBatchSettings = settings;

        if (this.queueDebounceTimer !== null) {
            window.clearTimeout(this.queueDebounceTimer);
        }

        this.queueDebounceTimer = window.setTimeout(() => {
            this.queueDebounceTimer = null;
            if (!this.isProcessing && this.queue.length > 0) {
                this.processNextBatch();
            }
        }, TIMEOUTS.DEBOUNCE_CONTENT);
    }

    stopProcessing(): void {
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
    }

    onSettingsChanged(settings: NotebookNavigatorSettings): void {
        this.currentBatchSettings = settings;
    }

    protected async processNextBatch(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0 || !this.currentBatchSettings) {
            return;
        }

        this.isProcessing = true;
        this.abortController = new AbortController();

        try {
            const db = getDBInstance();
            const batch = this.queue.splice(0, this.QUEUE_BATCH_SIZE);

            // Filter jobs based on current settings and database state
            const jobsWithData = await Promise.all(
                batch.map(async job => {
                    const fileData = await db.getFile(job.file.path);
                    const needsProcessing = this.needsProcessing(fileData, job.file, this.currentBatchSettings!);
                    return { job, fileData, needsProcessing };
                })
            );

            const activeJobs = jobsWithData.filter(item => item.needsProcessing);

            if (activeJobs.length === 0) {
                this.isProcessing = false;
                if (this.queue.length > 0) {
                    this.processNextBatch();
                }
                return;
            }

            // Process files in parallel batches
            const updates: Array<{
                path: string;
                tags?: string[] | null;
                preview?: string;
                featureImage?: string;
                metadata?: FileData['metadata'];
            }> = [];

            for (let i = 0; i < activeJobs.length; i += this.PARALLEL_LIMIT) {
                if (this.abortController.signal.aborted) break;

                const parallelBatch = activeJobs.slice(i, i + this.PARALLEL_LIMIT);
                const results = await Promise.all(
                    parallelBatch.map(async ({ job, fileData }) => {
                        try {
                            return await this.processFile(job, fileData, this.currentBatchSettings!);
                        } catch (error) {
                            console.error(`Error processing ${job.file.path}:`, error);
                            return null;
                        }
                    })
                );

                updates.push(
                    ...results.filter(
                        (
                            r
                        ): r is {
                            path: string;
                            tags?: string[] | null;
                            preview?: string;
                            featureImage?: string;
                            metadata?: FileData['metadata'];
                        } => r !== null
                    )
                );
            }

            // Batch update database
            if (updates.length > 0 && !this.abortController.signal.aborted) {
                await db.batchUpdateFileContent(updates);

                // Update mtimes for successfully processed files
                // This is done after content generation to prevent race conditions
                // Note: updateMtimes does NOT emit notifications - it's internal bookkeeping only
                // The UI already updated from batchUpdateFileContent above
                const mtimeUpdates: Array<{ path: string; mtime: number }> = [];
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
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error processing batch:', error);
            }
        } finally {
            this.isProcessing = false;

            if (this.queue.length > 0 && !this.abortController?.signal.aborted) {
                // Process next batch
                requestAnimationFrame(() => this.processNextBatch());
            }
        }
    }
}
