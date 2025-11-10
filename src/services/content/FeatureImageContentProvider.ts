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

import { TFile, CachedMetadata } from 'obsidian';
import { ContentType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';
import { FileData } from '../../storage/IndexedDBStorage';
import { getDBInstance } from '../../storage/fileOperations';
import { isImageFile } from '../../utils/fileTypeUtils';
import { BaseContentProvider } from './BaseContentProvider';

/**
 * Content provider for finding and storing feature images
 */
export class FeatureImageContentProvider extends BaseContentProvider {
    getContentType(): ContentType {
        return 'featureImage';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return ['showFeatureImage', 'featureImageProperties', 'useEmbeddedImageFallback'];
    }

    shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean {
        // Clear if feature image is disabled
        if (!newSettings.showFeatureImage && oldSettings.showFeatureImage) {
            return true;
        }

        // Regenerate if feature image is enabled and settings changed
        if (newSettings.showFeatureImage) {
            return (
                oldSettings.showFeatureImage !== newSettings.showFeatureImage ||
                JSON.stringify(oldSettings.featureImageProperties) !== JSON.stringify(newSettings.featureImageProperties) ||
                oldSettings.useEmbeddedImageFallback !== newSettings.useEmbeddedImageFallback
            );
        }

        return false;
    }

    async clearContent(): Promise<void> {
        const db = getDBInstance();
        await db.batchClearAllFileContent('featureImage');
    }

    protected needsProcessing(fileData: FileData | null, file: TFile, settings: NotebookNavigatorSettings): boolean {
        if (!settings.showFeatureImage) {
            return false;
        }

        const fileModified = fileData !== null && fileData.mtime !== file.stat.mtime;
        return !fileData || fileData.featureImage === null || fileModified;
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
        if (!settings.showFeatureImage) {
            return null;
        }

        try {
            const metadata = this.app.metadataCache.getFileCache(job.file);
            const imageUrl = this.getFeatureImageUrlFromMetadata(job.file, metadata, settings);
            const imageUrlStr = imageUrl || '';

            // Only return update if feature image changed
            if (fileData && fileData.featureImage === imageUrlStr) {
                return null;
            }

            return {
                path: job.file.path,
                featureImage: imageUrlStr
            };
        } catch (error) {
            console.error(`Error finding feature image for ${job.file.path}:`, error);
            return null;
        }
    }

    /**
     * Extract feature image URL from file metadata
     * Checks frontmatter properties defined in settings
     */
    private getFeatureImageUrlFromMetadata(
        file: TFile,
        metadata: CachedMetadata | null,
        settings: NotebookNavigatorSettings
    ): string | null {
        // Only process markdown files for feature images
        if (file.extension !== 'md') {
            return null;
        }

        // Try each property in order until we find an image
        for (const property of settings.featureImageProperties) {
            // Extract property value from frontmatter with unknown type
            const imageValue: unknown = metadata?.frontmatter?.[property];

            // Skip non-string values (arrays, objects, numbers, etc.)
            if (typeof imageValue !== 'string') {
                continue;
            }

            // Remove leading/trailing whitespace from the path
            const imagePath = imageValue.trim();

            if (!imagePath) {
                continue;
            }

            const resolvedPath = this.normalizeLinkPath(imagePath);

            if (!resolvedPath) {
                continue;
            }

            const imageFile = this.app.metadataCache.getFirstLinkpathDest(resolvedPath, file.path);

            if (imageFile) {
                // Store just the path, not the full app:// URL
                return imageFile.path;
            }
        }

        // Check embedded images as fallback
        if (settings.useEmbeddedImageFallback && metadata?.embeds && metadata.embeds.length > 0) {
            for (const embed of metadata.embeds) {
                const embedPath = embed.link;
                const embedFile = this.app.metadataCache.getFirstLinkpathDest(embedPath, file.path);
                if (embedFile && isImageFile(embedFile)) {
                    // Store just the path, not the full app:// URL
                    return embedFile.path;
                }
            }
        }

        return null;
    }

    private normalizeLinkPath(rawPath: string): string {
        let normalized = rawPath.trim();

        if (normalized.startsWith('!')) {
            normalized = normalized.slice(1).trim();
        }

        if (normalized.startsWith('[[') && normalized.endsWith(']]')) {
            normalized = normalized.slice(2, -2).trim();
        }

        const aliasSeparatorIndex = normalized.indexOf('|');

        if (aliasSeparatorIndex !== -1) {
            normalized = normalized.slice(0, aliasSeparatorIndex).trim();
        }

        return normalized;
    }
}
