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

import { useRef, useEffect, useCallback } from 'react';
import { App } from 'obsidian';
import { MetadataService } from '../services/MetadataService';
import { getDBInstance } from '../storage/fileOperations';
import { TagTreeNode } from '../types/storage';

interface UseInitialCleanupProps {
    app: App;
    metadataService: MetadataService | null;
    isStorageReady: boolean;
    showTags: boolean;
}

/**
 * Hook to handle deferred metadata cleanup after initial tag extraction.
 *
 * This solves the issue where tag colors were being deleted on startup because
 * cleanup ran before tags were extracted from files. The hook:
 * 1. Waits for metadata cache to be ready
 * 2. Tracks tag extraction progress
 * 3. Runs cleanup only after all tags are extracted
 */
export function useInitialCleanup({ app, metadataService, isStorageReady, showTags }: UseInitialCleanupProps) {
    const hasPerformedCleanup = useRef(false);
    const filesNeedingTags = useRef(0);
    const filesWithTagsExtracted = useRef(0);

    /**
     * Start tracking files that need tag extraction
     */
    const startTracking = useCallback(
        (fileCount: number) => {
            if (!hasPerformedCleanup.current && showTags && fileCount > 0) {
                filesNeedingTags.current = fileCount;
                filesWithTagsExtracted.current = 0;
            }
        },
        [showTags]
    );

    /**
     * Handle tag extraction progress
     */
    const handleTagsExtracted = useCallback(
        (count: number, tagTree: Map<string, TagTreeNode>, favoriteTree: Map<string, TagTreeNode>) => {
            if (hasPerformedCleanup.current || filesNeedingTags.current === 0) {
                return;
            }

            filesWithTagsExtracted.current += count;

            // Check if all files have been processed
            if (filesWithTagsExtracted.current >= filesNeedingTags.current) {
                hasPerformedCleanup.current = true;

                // Run cleanup with the complete tag tree
                if (metadataService) {
                    const combinedTree = new Map([...favoriteTree, ...tagTree]);
                    const db = getDBInstance();

                    // Get all necessary data for cleanup
                    const allFiles = db.getAllFiles();
                    const vaultFiles = new Set(app.vault.getMarkdownFiles().map(f => f.path));

                    const validators = {
                        dbFiles: allFiles,
                        tagTree: combinedTree,
                        vaultFiles
                    };

                    // Run cleanup asynchronously
                    metadataService.runUnifiedCleanup(validators).catch(error => {
                        console.error('Failed to run metadata cleanup:', error);
                    });
                }

                // Reset tracking
                filesNeedingTags.current = 0;
                filesWithTagsExtracted.current = 0;
            }
        },
        [app, metadataService]
    );

    /**
     * Wait for metadata cache to be ready before allowing tag extraction
     */
    const waitForMetadataCache = useCallback(
        (callback: () => void) => {
            // Check if metadata cache is resolved
            // Obsidian's metadata cache is ready when it has processed at least some files
            const checkCache = () => {
                const files = app.vault.getMarkdownFiles();
                if (files.length === 0) {
                    callback();
                    return;
                }

                // Check a sample of files to see if metadata is available
                const sampleSize = Math.min(10, files.length);
                let hasMetadata = false;

                for (let i = 0; i < sampleSize; i++) {
                    if (app.metadataCache.getFileCache(files[i])) {
                        hasMetadata = true;
                        break;
                    }
                }

                if (hasMetadata) {
                    callback();
                } else {
                    // Try again in a moment
                    setTimeout(checkCache, 100);
                }
            };

            // Start checking after a brief delay to let Obsidian initialize
            setTimeout(checkCache, 500);
        },
        [app]
    );

    // Reset when storage becomes ready
    useEffect(() => {
        if (isStorageReady) {
            hasPerformedCleanup.current = false;
            filesNeedingTags.current = 0;
            filesWithTagsExtracted.current = 0;
        }
    }, [isStorageReady]);

    return {
        startTracking,
        handleTagsExtracted,
        waitForMetadataCache
    };
}
