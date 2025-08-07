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
import { TagTreeNode } from '../types/storage';

interface UseDeferredMetadataCleanupProps {
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
export function useDeferredMetadataCleanup({ app, metadataService, isStorageReady, showTags }: UseDeferredMetadataCleanupProps) {
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
                    const validators = MetadataService.prepareCleanupValidators(app, combinedTree);

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
            // If no files in vault, proceed immediately
            const files = app.vault.getMarkdownFiles();
            if (files.length === 0) {
                callback();
                return;
            }

            // Check if metadata cache already has data (plugin reload scenario)
            const hasExistingCache = files.some(file => app.metadataCache.getFileCache(file) !== null);
            if (hasExistingCache) {
                callback();
                return;
            }

            // Set up a one-time listener for the 'resolved' event
            let hasResolved = false;

            // Fallback timeout in case resolved never fires (shouldn't happen but better safe)
            const timeoutId = window.setTimeout(() => {
                if (!hasResolved) {
                    hasResolved = true;
                    app.metadataCache.offref(eventRef);
                    callback();
                }
            }, 5000); // 5 second fallback

            const eventRef = app.metadataCache.on('resolved', () => {
                if (!hasResolved) {
                    hasResolved = true;
                    app.metadataCache.offref(eventRef);
                    window.clearTimeout(timeoutId);
                    callback();
                }
            });
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
