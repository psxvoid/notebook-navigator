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

import { TFile } from 'obsidian';
import { ContentType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';
import { FileData } from '../../storage/IndexedDBStorage';
import { getDBInstance } from '../../storage/fileOperations';
import { extractMetadataFromCache } from '../../utils/metadataExtractor';
import { shouldExcludeFile } from '../../utils/fileFilters';
import { BaseContentProvider } from './BaseContentProvider';
import { getFileDisplayName } from 'src/utils/fileNameUtils';
import { parseReplacer, TitleReplacer } from './common/TextReplacer';

// Compares two arrays for same members regardless of order
function haveSameMembers(left: string[], right: string[]): boolean {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.every((value, index) => value === sortedRight[index]);
}


const replacerCache = new Map<string, TitleReplacer>()

export function transformTitle<T extends string | undefined | null>(sourceTitle: T, settings: NotebookNavigatorSettings): T {
    if (sourceTitle == null || settings.noteTitleTransform.length === 0) {
        return sourceTitle
    }

    for (const { pattern, replacement } of settings.noteTitleTransform) {
        let replacer = replacerCache.get(pattern)

        if (replacer == null) {
            const newReplacer = parseReplacer(pattern)

            replacerCache.set(pattern, newReplacer)

            replacer = newReplacer
        }

        // @ts-ignore
        const transformedTitle: string = replacer.isGlobal && typeof String.prototype.replaceAll === 'function' ? sourceTitle.replaceAll(replacer.regex, replacement) : sourceTitle.replace(replacer.regex, replacement)

        if (transformedTitle.length === 0) {
            continue
        }

        if (sourceTitle != null && transformedTitle.length !== sourceTitle.length || transformedTitle !== sourceTitle) {
            sourceTitle = transformedTitle as T
        }
    }

    return sourceTitle
}

/**
 * Content provider for extracting metadata from frontmatter
 */
export class MetadataContentProvider extends BaseContentProvider {
    // Cache of computed hidden states during needsProcessing checks to avoid redundant frontmatter reads
    private pendingHiddenStates = new Map<string, boolean>();

    // Clears cached hidden states when no longer needed
    private clearPendingHiddenStates(): void {
        if (this.pendingHiddenStates.size > 0) {
            this.pendingHiddenStates.clear();
        }
    }

    getContentType(): ContentType {
        return 'metadata';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return [
            'useFrontmatterMetadata',
            'frontmatterNameField',
            'frontmatterIconField',
            'frontmatterColorField',
            'frontmatterCreatedField',
            'frontmatterModifiedField',
            'frontmatterDateFormat',
            'excludedFiles'
        ];
    }

    shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean {
        const excludedFilesChanged = !haveSameMembers(oldSettings.excludedFiles, newSettings.excludedFiles);
        if (excludedFilesChanged) {
            return true;
        }

        // Clear if metadata extraction is disabled
        if (!newSettings.useFrontmatterMetadata && oldSettings.useFrontmatterMetadata) {
            return true;
        }

        // Regenerate if metadata extraction is enabled and settings changed
        if (newSettings.useFrontmatterMetadata) {
            return (
                oldSettings.useFrontmatterMetadata !== newSettings.useFrontmatterMetadata ||
                oldSettings.frontmatterNameField !== newSettings.frontmatterNameField ||
                oldSettings.frontmatterIconField !== newSettings.frontmatterIconField ||
                oldSettings.frontmatterColorField !== newSettings.frontmatterColorField ||
                oldSettings.frontmatterCreatedField !== newSettings.frontmatterCreatedField ||
                oldSettings.frontmatterModifiedField !== newSettings.frontmatterModifiedField ||
                oldSettings.frontmatterDateFormat !== newSettings.frontmatterDateFormat
            );
        }

        return false;
    }

    async clearContent(): Promise<void> {
        this.clearPendingHiddenStates();
        const db = getDBInstance();
        await db.batchClearAllFileContent('metadata');
    }

    onSettingsChanged(settings: NotebookNavigatorSettings): void {
        super.onSettingsChanged(settings);
        if (settings.excludedFiles.length === 0) {
            this.clearPendingHiddenStates();
        }
    }

    stopProcessing(): void {
        super.stopProcessing();
        this.clearPendingHiddenStates();
    }

    protected needsProcessing(fileData: FileData | null, file: TFile, settings: NotebookNavigatorSettings): boolean {
        const requiresMetadata = settings.useFrontmatterMetadata || settings.excludedFiles.length > 0;
        if (!requiresMetadata) {
            return false;
        }

        const shouldTrackHidden = settings.excludedFiles.length > 0 && file.extension === 'md';
        // Lazy computation pattern - only check frontmatter when actually needed
        let hiddenStateComputed = false;
        let hiddenState = false;
        // Computes hidden state by checking frontmatter against exclusion patterns
        const computeHiddenState = (): void => {
            if (hiddenStateComputed || !shouldTrackHidden) {
                return;
            }
            hiddenState = shouldExcludeFile(file, settings.excludedFiles, this.app);
            hiddenStateComputed = true;
        };
        // Saves computed hidden state to cache for later retrieval in processFile
        const storeHiddenState = (): void => {
            if (hiddenStateComputed) {
                this.pendingHiddenStates.set(file.path, hiddenState);
            }
        };

        const fileModified = fileData !== null && fileData.mtime !== file.stat.mtime;
        if (!fileData || fileData.metadata === null) {
            computeHiddenState();
            storeHiddenState();
            return true;
        }

        if (fileModified) {
            computeHiddenState();
            storeHiddenState();
            return true;
        }

        if (shouldTrackHidden) {
            computeHiddenState();
            const recordedState = fileData.metadata?.hidden;
            if (recordedState !== hiddenState) {
                storeHiddenState();
                return true;
            }
        }

        return false;
    }

    protected async processFile(
        job: { file: TFile; path: string[] },
        fileData: FileData | null,
        settings: NotebookNavigatorSettings
    ): Promise<{
        path: string;
        tags?: string[] | null;
        preview?: string;
        featureImage?: string;
        metadata?: FileData['metadata'];
    } | null> {
        const shouldExtractMetadata = settings.useFrontmatterMetadata;
        const shouldTrackHidden = settings.excludedFiles.length > 0;
        if (!shouldExtractMetadata && !shouldTrackHidden) {
            return null;
        }

        try {
            const cachedMetadata = this.app.metadataCache.getFileCache(job.file);
            const processedMetadata = shouldExtractMetadata ? extractMetadataFromCache(cachedMetadata, settings) : {};

            const fileMetadata: FileData['metadata'] = {};
            if (shouldExtractMetadata) {
                if (processedMetadata.fn) fileMetadata.name = processedMetadata.fn;
                if (processedMetadata.fc !== undefined) fileMetadata.created = processedMetadata.fc;
                if (processedMetadata.fm !== undefined) fileMetadata.modified = processedMetadata.fm;
                if (processedMetadata.icon) fileMetadata.icon = processedMetadata.icon;
                if (processedMetadata.color) fileMetadata.color = processedMetadata.color;
            } else {
                fileMetadata.name = getFileDisplayName(job.file, undefined, settings)
            }

            fileMetadata.name = transformTitle(fileMetadata.name, settings)

            if (shouldTrackHidden && job.file.extension === 'md') {
                let hiddenValue: boolean;
                if (this.pendingHiddenStates.has(job.file.path)) {
                    hiddenValue = this.pendingHiddenStates.get(job.file.path) as boolean;
                    this.pendingHiddenStates.delete(job.file.path);
                } else {
                    hiddenValue = shouldExcludeFile(job.file, settings.excludedFiles, this.app);
                }
                fileMetadata.hidden = hiddenValue;
            }

            const newMetadata = Object.keys(fileMetadata).length > 0 ? fileMetadata : {};

            // Only return update if metadata changed
            if (fileData && this.metadataEqual(fileData.metadata, newMetadata)) {
                return null;
            }

            return {
                path: job.file.path,
                metadata: newMetadata
            };
        } catch (error) {
            console.error(`Error extracting metadata for ${job.file.path}:`, error);
            return null;
        }
    }

    /**
     * Check if two metadata objects are equal
     * @param meta1 - First metadata object
     * @param meta2 - Second metadata object
     * @returns True if metadata are equal
     */
    private metadataEqual(meta1: FileData['metadata'] | null, meta2: FileData['metadata'] | null): boolean {
        // Handle null cases
        if (!meta1 && !meta2) return true; // Both null/empty
        if (!meta1 && meta2 && Object.keys(meta2).length === 0) return true; // First null, second empty
        if (meta1 && Object.keys(meta1).length === 0 && !meta2) return true; // First empty, second null
        if (!meta1 || !meta2) return false; // One is null but not the other

        // Check if all keys and values match
        const keys1 = Object.keys(meta1);
        const keys2 = Object.keys(meta2);

        if (keys1.length !== keys2.length) return false;

        return keys1.every(key => {
            const k = key as keyof FileData['metadata'];
            return meta1[k] === meta2[k];
        });
    }
}
