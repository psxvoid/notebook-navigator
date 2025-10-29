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

import { TFile, CachedMetadata, App } from 'obsidian';
import { ContentType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';
import { FileData } from '../../storage/IndexedDBStorage';
import { getDBInstance } from '../../storage/fileOperations';
import { isExcalidrawAttachment, isImageFile } from '../../utils/fileTypeUtils';
import { BaseContentProvider, ProcessResult } from './BaseContentProvider';
import { autoCrop, blobToBase64Url, readSourceImageBlob } from './feature-image-preview-generators/ImageCropUtils';
import { EMPTY_STRING } from 'src/utils/empty';
import { generatePdfPreview } from './feature-image-preview-generators/providers/PdfPreviewGenerator';
import { cacheFilePath, generatePreview, GeneratePreviewResult, isCachePath } from './feature-image-preview-generators/PreviewGenerator';
import { generateExcalidrawPreview } from './feature-image-preview-generators/providers/ExcalidrawPreviewGenerator';

/**
 * Content provider for finding and storing feature images
 */
export class FeatureImageContentProvider extends BaseContentProvider {
    public static Instance?: FeatureImageContentProvider;
    private forceUpdateSet: Set<string> = new Set();
    private deletedFeatureProviders: Map<string, string> = new Map(); // (1) = consumer, (2) = provider

    constructor(app: App) {
        super(app);

        // Review: Refactoring: use service provider 
        FeatureImageContentProvider.Instance = this;
    }

    enqueueExcalidrawConsumers(files: TFile[]): void {
        for (const file of files) {
            this.forceUpdateSet.add(file.path);
        }

        this.queueFiles(files);
    }

    markFeatureProviderAsDeleted(providerPath: string, consumerPaths: readonly string[]): void {
        for (const consumer of consumerPaths) {
            this.forceUpdateSet.add(consumer)
            this.deletedFeatureProviders.set(consumer, providerPath)
        }
    }

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

        const isForceUpdate = this.forceUpdateSet.has(file.path);
        const fileModified = fileData !== null && (fileData.mtime !== file.stat.mtime || isForceUpdate);
        return !fileData || fileData.featureImage === null || fileModified;
    }

    protected async processFile(
        job: { file: TFile; path: string[] },
        fileData: FileData | null,
        settings: NotebookNavigatorSettings
    ): Promise<ProcessResult | (ProcessResult | null)[] | null> {
        if (!settings.showFeatureImage) {
            return null;
        }

        try {
            const metadata = this.app.metadataCache.getFileCache(job.file);

            const result = await this.getFeatureImageUrlFromMetadata(job.file, metadata, settings)
            const imageUrl = result?.featurePath;
            const consumerTargetPath = result?.consumerTargetPath;
            const imageUrlStr = imageUrl || '';

            if (this.forceUpdateSet.has(job.file.path)) {
                this.forceUpdateSet.delete(job.file.path)
            }

            // Only return update if feature image changed
            if (fileData && fileData.featureImage === imageUrlStr) {
                return null;
            }

            const nonEmptyString = (str?: string | null): str is string => typeof str === 'string' && str.length > 0;

            let featureImageResized: string = EMPTY_STRING

            let selfPreview = false
            if (nonEmptyString(imageUrlStr)) {
                const maxSizeSquarePx = settings.featureImageSize;

                let previewBlob: Blob | undefined = result?.previewBlob

                if (previewBlob == null && isImageFile(this.app.vault.getFileByPath(imageUrlStr))) {
                    previewBlob = await readSourceImageBlob(imageUrlStr, this.app)
                }

                if (previewBlob == null) {
                    throw new Error("Preview blob is missing from the preview provider result.")
                }

                const resizedBlob = await autoCrop(previewBlob, maxSizeSquarePx)
                featureImageResized = await blobToBase64Url(resizedBlob)
                if (result?.featureProviderPath === job.file.path) {
                    selfPreview = true
                }
            }

            let featureCleanupRequest: ProcessResult | null = null

            if (nonEmptyString(fileData?.featureImage)
                && nonEmptyString(fileData?.featureImageProvider)
                && fileData.featureImageProvider !== result?.featureProviderPath
            ) {
                const previousFeatureProvider = getDBInstance().getFile(fileData.featureImageProvider)

                featureCleanupRequest = {
                    path: fileData.featureImageProvider,
                    featureImageConsumers: [
                        ...(previousFeatureProvider?.featureImageConsumers ?? []).filter(x => x !== job.file.path),
                    ]
                }
            }

            return [
                {
                    path: job.file.path,
                    featureImage: imageUrlStr,
                    featureImageResized: featureImageResized,
                    ...nonEmptyString(result?.featureProviderPath) ? {
                        featureImageProvider: result.featureProviderPath,
                    } : {}
                },
                isCachePath(imageUrlStr) && !selfPreview ? {
                    path: consumerTargetPath as string,
                    featureImageConsumers: [
                        ...(fileData?.featureImageConsumers ?? []).filter(x => x !== job.file.path),
                        job.file.path,
                    ],
                    forceUpdate: true,
                } : null,
                featureCleanupRequest
            ];
        } catch (error) {
            console.error(`Error finding feature image for ${job.file.path}:`, error);
            return null;
        }
    }

    /**
     * Extract feature image URL from file metadata
     * Checks frontmatter properties defined in settings
     */
    private async getFeatureImageUrlFromMetadata(
        file: TFile,
        metadata: CachedMetadata | null,
        settings: NotebookNavigatorSettings
    ): Promise<GeneratePreviewResult | null> {
        // Only process markdown files for feature images
        if (file.extension !== 'md') {
            return null;
        }

        const cleanupFeatureProviderEmbed = async (embedFile: TFile): Promise<void> => {
            const providerPath = this.deletedFeatureProviders.get(file.path)

            if (providerPath === embedFile.path) {
                const imagePath = cacheFilePath(embedFile)

                if (settings && isCachePath(imagePath) && await this.app.vault.adapter.exists(imagePath)) {
                    const toDelete = this.app.vault.getFileByPath(imagePath)
                    if (toDelete != null) {
                        // Review: Refactoring: now delete is also in ExcalidrawPreviewGenerator, handle deletion in a single place
                        // Review: Resiliency: handle exception?
                        // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file
                        await this.app.vault.delete(toDelete)
                    }
                }

                this.deletedFeatureProviders.delete(file.path)
            }
        }

        // self preview
        if (isExcalidrawAttachment(file, metadata)) {
            return generatePreview(file, this.app, file, generateExcalidrawPreview, settings)
        }

        // Try each property in order until we find an image
        for (const property of settings.featureImageProperties) {
            const imagePath = metadata?.frontmatter?.[property];

            if (!imagePath) {
                continue;
            }

            const resolvedPath = this.normalizeLinkPath(imagePath);

            if (!resolvedPath) {
                continue;
            }

            const imageFile = this.app.metadataCache.getFirstLinkpathDest(resolvedPath, file.path);

            if (imageFile) {
                if (imageFile.extension === 'md') {
                    const metadata = this.app.metadataCache.getFileCache(imageFile);

                    await cleanupFeatureProviderEmbed(imageFile)

                    if (isExcalidrawAttachment(imageFile, metadata)) {
                        return generatePreview(imageFile, this.app, file, generateExcalidrawPreview, settings)
                    }
                }

                // Store just the path, not the full app:// URL
                return { featurePath: imageFile.path };
            }
        }

        // Check embedded images as fallback
        if (settings.useEmbeddedImageFallback && metadata?.embeds && metadata.embeds.length > 0) {
            for (const embed of metadata.embeds) {
                const embedPath = embed.link;
                const embedFile = this.app.metadataCache.getFirstLinkpathDest(embedPath, file.path);

                if (embedFile) {
                    if (isImageFile(embedFile)) {
                        // Store just the path, not the full app:// URL
                        return { featurePath: embedFile.path };
                    }
                    
                    const providerPath = this.deletedFeatureProviders.get(file.path)

                    if (providerPath === embedFile.path) {
                        this.deletedFeatureProviders.delete(file.path)
                        // continue; // do not use "continue" statement because on delete
                        // this block wont be executed due to if(embedFile) check above
                        // the embedFile file will be undefined (because it's deleted)
                        // it means that this block will only be executed on restore
                    }

                    const embedMetadata = this.app.metadataCache.getFileCache(embedFile);

                    if (isExcalidrawAttachment(embedFile, embedMetadata)) {
                        return generatePreview(embedFile, this.app, file, generateExcalidrawPreview, settings)
                    }

                    if (settings.featureImageForPDF && embedFile.extension === 'pdf') {
                        return generatePreview(embedFile, this.app, file, generatePdfPreview, settings)
                    }

                    return null;
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
