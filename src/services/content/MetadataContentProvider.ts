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
import { BaseContentProvider } from './BaseContentProvider';

/**
 * Content provider for extracting metadata from frontmatter
 */
export class MetadataContentProvider extends BaseContentProvider {
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
            'frontmatterDateFormat'
        ];
    }

    shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean {
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
        const db = getDBInstance();
        await db.batchClearAllFileContent('metadata');
    }

    protected needsProcessing(fileData: FileData | null, file: TFile, settings: NotebookNavigatorSettings): boolean {
        if (!settings.useFrontmatterMetadata) {
            return false;
        }

        const fileModified = fileData !== null && fileData.mtime !== file.stat.mtime;
        return !fileData || fileData.metadata === null || fileModified;
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
        if (!settings.useFrontmatterMetadata) {
            return null;
        }

        try {
            const cachedMetadata = this.app.metadataCache.getFileCache(job.file);
            const processedMetadata = extractMetadataFromCache(cachedMetadata, settings);

            const fileMetadata: FileData['metadata'] = {};
            if (processedMetadata.fn) fileMetadata.name = processedMetadata.fn;
            if (processedMetadata.fc !== undefined) fileMetadata.created = processedMetadata.fc;
            if (processedMetadata.fm !== undefined) fileMetadata.modified = processedMetadata.fm;
            if (processedMetadata.icon) fileMetadata.icon = processedMetadata.icon;
            if (processedMetadata.color) fileMetadata.color = processedMetadata.color;

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
