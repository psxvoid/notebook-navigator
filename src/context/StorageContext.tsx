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

/**
 * StorageContext - Central state management for storage system
 *
 * What it does:
 * - Monitors vault changes and syncs with database
 * - Builds and maintains the tag tree structure
 * - Coordinates content generation via ContentService
 * - Provides real-time content updates to UI components
 *
 * Relationships:
 * - Uses: Database, ContentService, FileOperations, DiffCalculator
 * - Provides: StorageContext to all child components
 * - Integrates with: Obsidian vault and metadata APIs
 *
 * Key responsibilities:
 * - Monitor file system events (create, delete, rename, modify)
 * - Calculate diffs and update database accordingly
 * - Rebuild tag tree when tags change
 * - Queue content generation for new/modified files
 * - Handle settings changes and trigger regeneration
 * - Provide metadata extraction methods with frontmatter fallback
 */

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { App, TFile, debounce } from 'obsidian';
import { clearNoteCountCache } from '../utils/tagTree';
import { initializeCache, updateFilesInCache, removeFilesFromCache, getDBInstance } from '../storage/fileOperations';
import { calculateFileDiff } from '../storage/diffCalculator';
import { buildTagTreeFromDatabase } from '../utils/tagTree';
import { TagTreeNode } from '../types/storage';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { useSettingsState } from './SettingsContext';
import { useServices } from './ServicesContext';
import { DateUtils } from '../utils/dateUtils';
import { getFileDisplayName as getDisplayName } from '../utils/fileNameUtils';
import { ContentService } from '../services/ContentService';
import { NotebookNavigatorSettings } from '../settings';
import { Database, FileData as DBFileData } from '../storage/database';

/**
 * Processed metadata from frontmatter
 */
interface ProcessedMetadata {
    fn?: string; // frontmatter name
    fc?: number; // frontmatter created timestamp
    fm?: number; // frontmatter modified timestamp
}

/**
 * Data structure containing the hierarchical tag tree and untagged file count
 */
interface FileData {
    tree: Map<string, TagTreeNode>;
    untagged: number;
}

/**
 * Context value providing both file data (tag tree) and the file cache
 */
interface StorageContextValue {
    fileData: FileData;
    // Methods to get file metadata with frontmatter extraction
    getFileDisplayName: (file: TFile) => string;
    getFileCreatedTime: (file: TFile) => number;
    getFileModifiedTime: (file: TFile) => number;
    getFileMetadata: (file: TFile) => { name: string; created: number; modified: number };
    // Database instance for FileItem to use
    getDB: () => Database;
    // Synchronous database access methods
    getFile: (path: string) => DBFileData | null;
    getFiles: (paths: string[]) => Map<string, DBFileData>;
    hasPreview: (path: string) => boolean;
    // Storage initialization state
    isStorageReady: boolean;
}

const StorageContext = createContext<StorageContextValue | null>(null);

interface StorageProviderProps {
    app: App;
    children: ReactNode;
}

/**
 * Extract metadata from frontmatter
 */
function extractMetadata(app: App, file: TFile, settings: NotebookNavigatorSettings): ProcessedMetadata {
    const metadata = app.metadataCache.getFileCache(file);
    const frontmatter = metadata?.frontmatter;

    if (!frontmatter || !settings.useFrontmatterMetadata) {
        return {};
    }

    const result: ProcessedMetadata = {};

    // Extract name if field is specified
    if (settings.frontmatterNameField && settings.frontmatterNameField.trim()) {
        const nameValue = frontmatter[settings.frontmatterNameField];
        if (nameValue && typeof nameValue === 'string' && nameValue.trim()) {
            result.fn = nameValue.trim();
        }
    }

    // Extract created date if field is specified
    if (settings.frontmatterCreatedField && settings.frontmatterCreatedField.trim()) {
        const createdValue = frontmatter[settings.frontmatterCreatedField];
        const createdTimestamp = DateUtils.parseFrontmatterDate(createdValue, settings.frontmatterDateFormat);
        if (createdTimestamp !== undefined) {
            result.fc = createdTimestamp;
        }
    }

    // Extract modified date if field is specified
    if (settings.frontmatterModifiedField && settings.frontmatterModifiedField.trim()) {
        const modifiedValue = frontmatter[settings.frontmatterModifiedField];
        const modifiedTimestamp = DateUtils.parseFrontmatterDate(modifiedValue, settings.frontmatterDateFormat);
        if (modifiedTimestamp !== undefined) {
            result.fm = modifiedTimestamp;
        }
    }

    return result;
}

export function StorageProvider({ app, children }: StorageProviderProps) {
    const settings = useSettingsState();
    const { metadataService } = useServices();
    const [fileData, setFileData] = useState<FileData>({ tree: new Map(), untagged: 0 });

    // Content service handles content generation (preview text + feature images)
    const contentService = useRef<ContentService | null>(null);
    const isFirstLoad = useRef(true);

    // Helper function to rebuild tag tree and clean up metadata
    const rebuildTagTree = () => {
        const db = getDBInstance();
        const { tree: newTree, untagged: newUntagged } = buildTagTreeFromDatabase(db);
        clearNoteCountCache();
        setFileData({ tree: newTree, untagged: settings.showTags && settings.showUntagged ? newUntagged : 0 });

        // Clean up tag metadata now that we have the complete tag tree
        if (metadataService) {
            metadataService.cleanupTagMetadata().catch(error => {
                console.error('Error during tag metadata cleanup:', error);
            });
        }
    };

    useEffect(() => {
        // Only create service if it doesn't exist
        if (!contentService.current) {
            // Create content service that notifies us when content is generated
            contentService.current = new ContentService(
                app,
                settings,
                () => {
                    // No longer need this callback - using database notifications instead
                },
                (file: TFile) => extractMetadata(app, file, settings)
            );
        }

        return () => {
            if (contentService.current) {
                contentService.current.stop();
                contentService.current = null;
            }
        };
    }, [app]); // Only recreate when app changes, not settings

    // Track storage initialization state
    const [isStorageReady, setIsStorageReady] = useState(false);

    // Initialize IndexedDB on mount
    useEffect(() => {
        initializeCache()
            .then(() => {
                setIsStorageReady(true);
            })
            .catch(error => {
                console.error('Failed to initialize IndexedDB cache:', error);
            });
    }, []);

    // Listen for tag changes to rebuild tag tree
    useEffect(() => {
        if (!isStorageReady) return;

        const db = getDBInstance();
        const unsubscribe = db.onContentChange(changes => {
            // Check if any changes include tags
            const hasTagChanges = changes.some(change => change.changes.tags !== undefined);

            if (hasTagChanges && settings.showTags) {
                // Rebuild tag tree when tags change
                rebuildTagTree();
            }
        });

        return unsubscribe;
    }, [isStorageReady, settings.showTags, settings.showUntagged]);

    // Track if we've already built the initial cache
    const hasBuiltInitialCache = useRef(false);

    // Main effect: manages cache updates and builds data structures
    useEffect(() => {
        // Process existing files and handle updates
        const processExistingCache = async (allFiles: TFile[], isInitialLoad: boolean = false) => {
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
            }

            // Build tag tree only on initial load and when storage is ready
            if (isInitialLoad && isStorageReady) {
                try {
                    rebuildTagTree();
                } catch (error) {
                    console.error('Failed to build tag tree from IndexedDB:', error);
                }
            }

            // Process changes in background to avoid blocking UI
            requestIdleCallback(
                async () => {
                    try {
                        const { toAdd, toUpdate, toRemove, cachedFiles: diffCachedFiles } = await calculateFileDiff(allFiles);

                        if (toAdd.length > 0 || toUpdate.length > 0 || toRemove.length > 0) {
                            // Update only the changed files in IndexedDB
                            try {
                                const filesToUpdate = [...toAdd, ...toUpdate];
                                await updateFilesInCache(filesToUpdate, app);

                                // Check if tags actually changed by comparing before/after
                                let tagsChanged = false;

                                // For removed files, check if any had tags BEFORE removing
                                if (toRemove.length > 0) {
                                    // Check if any removed files had tags
                                    const db = getDBInstance();
                                    const removedFiles = db.getFiles(toRemove);
                                    for (const [, fileData] of removedFiles) {
                                        if (fileData.tags && fileData.tags.length > 0) {
                                            tagsChanged = true;
                                            break;
                                        }
                                    }
                                }

                                // Remove deleted files from IndexedDB after checking tags
                                if (toRemove.length > 0) {
                                    await removeFilesFromCache(toRemove);
                                }

                                // For added/updated files, check if tags differ from cached version
                                // Note: This must check the OLD cached data before we update it
                                if (!tagsChanged && filesToUpdate.length > 0) {
                                    // For new files (toAdd), they always represent a tag change if they have tags
                                    for (const file of toAdd) {
                                        if (file.extension === 'md') {
                                            const metadata = app.metadataCache.getFileCache(file);
                                            const currentTags = metadata?.tags?.map(t => t.tag) || [];
                                            if (currentTags.length > 0) {
                                                tagsChanged = true;
                                                break;
                                            }
                                        }
                                    }

                                    // For updated files, compare with the diff calculator's cached data
                                    if (!tagsChanged && toUpdate.length > 0) {
                                        for (const file of toUpdate) {
                                            if (file.extension === 'md') {
                                                const metadata = app.metadataCache.getFileCache(file);
                                                const currentTags = metadata?.tags?.map(t => t.tag) || [];
                                                const cachedFile = diffCachedFiles.get(file.path);
                                                const cachedTags = cachedFile?.tags || [];

                                                // Compare tag arrays
                                                if (
                                                    currentTags.length !== cachedTags.length ||
                                                    !currentTags.every(tag => cachedTags.includes(tag))
                                                ) {
                                                    tagsChanged = true;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }

                                // Only rebuild tag tree if tags actually changed
                                if (tagsChanged) {
                                    rebuildTagTree();
                                } else {
                                    // Just update untagged count if needed
                                    const untaggedAdded = toAdd.filter(f => f.extension === 'md').length;
                                    if (untaggedAdded > 0) {
                                        setFileData(prev => ({
                                            ...prev,
                                            untagged: prev.untagged + untaggedAdded
                                        }));
                                    }
                                }
                            } catch (error) {
                                console.error('Failed to update IndexedDB cache:', error);
                            }

                            // Queue content generation

                            if (
                                contentService.current &&
                                (settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata)
                            ) {
                                // Always process new and updated files (but only if they need content)
                                // Check IndexedDB to see what content is needed
                                const db = getDBInstance();
                                let filesToProcess: TFile[] = [];

                                try {
                                    const filesToCheck = [...toAdd, ...toUpdate];
                                    const paths = filesToCheck.map(f => f.path);
                                    const indexedFiles = db.getFiles(paths);

                                    filesToProcess = filesToCheck.filter(file => {
                                        const fileData = indexedFiles.get(file.path);
                                        if (!fileData) {
                                            return true; // New file, needs all content
                                        }

                                        const needsContent =
                                            (settings.showFilePreview && fileData.preview === null && file.extension === 'md') ||
                                            (settings.showFeatureImage && fileData.featureImage === null) ||
                                            (settings.useFrontmatterMetadata && fileData.metadata === null && file.extension === 'md');

                                        return needsContent;
                                    });

                                    // If no changes, check if any existing files need content generation
                                    // This handles the case where settings were enabled on another device
                                    // Skip on initial load to avoid unnecessary processing
                                    if (filesToProcess.length === 0 && !isInitialLoad) {
                                        // Get files needing content from database
                                        const filesNeedingPreview = settings.showFilePreview
                                            ? db.getFilesNeedingContent('preview')
                                            : new Set<string>();
                                        const filesNeedingImage = settings.showFeatureImage
                                            ? db.getFilesNeedingContent('featureImage')
                                            : new Set<string>();
                                        const filesNeedingMetadata = settings.useFrontmatterMetadata
                                            ? db.getFilesNeedingContent('metadata')
                                            : new Set<string>();

                                        // Combine all paths that need any content
                                        const pathsNeedingContent = new Set([
                                            ...filesNeedingPreview,
                                            ...filesNeedingImage,
                                            ...filesNeedingMetadata
                                        ]);

                                        // Filter vault files to only those needing content
                                        if (pathsNeedingContent.size > 0) {
                                            filesToProcess = allFiles.filter(file => pathsNeedingContent.has(file.path));
                                        }
                                    }
                                } catch (error) {
                                    console.error('Failed to check content needs from IndexedDB:', error);
                                }

                                if (filesToProcess.length > 0) {
                                    contentService.current.queueContent(filesToProcess, null);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error processing file cache diff:', error);
                    }
                },
                { timeout: 1000 }
            );
        };

        // The initial build is handled by processExistingCache with isInitialLoad=true

        // Main function that orchestrates the file cache building
        const buildFileCache = async (isInitialLoad: boolean = false) => {
            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault
                .getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));

            await processExistingCache(allFiles, isInitialLoad);
        };

        // Create debounced version for events (increased to 500ms to reduce duplicate processing)
        const rebuildFileCache = debounce(() => buildFileCache(false), 500);

        // Only build initial cache if storage is ready and we haven't built it yet
        if (isStorageReady && !hasBuiltInitialCache.current) {
            hasBuiltInitialCache.current = true;
            buildFileCache(true);
        }

        // Listen to specific vault and metadata events
        const vaultEvents = [
            app.vault.on('create', rebuildFileCache),
            app.vault.on('delete', rebuildFileCache),
            app.vault.on('rename', rebuildFileCache),
            app.vault.on('modify', async file => {
                // Check if it's a TFile (not a folder)
                if (file instanceof TFile && file.extension === 'md') {
                    // Queue content regeneration BEFORE updating cache
                    // This ensures ContentService can detect the mtime change
                    if (contentService.current) {
                        contentService.current.queueContent([file], null);
                    }

                    // Update file in cache after queuing
                    await updateFilesInCache([file], app);
                }
            })
        ];

        // Listen to metadata changes for non-tag updates
        // Tags are already handled by the modify event above
        const metadataEvent = app.metadataCache.on('changed', async file => {
            if (file && file.extension === 'md') {
                // Get existing data before updating
                const db = getDBInstance();
                const existingFile = db.getFile(file.path);

                // Update tags and metadata in the database
                await updateFilesInCache([file], app);

                // Check if this metadata change includes feature image properties
                const metadata = app.metadataCache.getFileCache(file);
                const featureImageProperties = ['featureResized', 'feature'];

                // Only queue if feature image properties changed (not just exist)
                if (metadata?.frontmatter && contentService.current && existingFile) {
                    const hadFeatureImage = existingFile.featureImage !== null;
                    const hasFeatureImageProps = featureImageProperties.some(prop => metadata.frontmatter![prop] !== undefined);

                    // Queue only if we need to generate a feature image
                    if (hasFeatureImageProps && !hadFeatureImage) {
                        // Queue content regeneration for feature image
                        contentService.current.queueContent([file], null);
                    }
                }
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
        };
    }, [app, settings.showUntagged, settings.excludedFiles, isStorageReady, settings.showTags]);

    // Track content settings to detect changes and regenerate when needed
    const prevContentSettings = useRef({
        enabled: settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata,
        previewSettings: `${settings.showFilePreview}-${settings.skipHeadingsInPreview}`, // Removed previewRows - it's just display
        imageSettings: `${settings.showFeatureImage}-${JSON.stringify(settings.featureImageProperties)}`,
        metadataSettings: `${settings.useFrontmatterMetadata}-${settings.frontmatterNameField}-${settings.frontmatterCreatedField}-${settings.frontmatterModifiedField}-${settings.frontmatterDateFormat}`
    });
    const isFirstSettingsCheck = useRef(true);

    // Update service settings when they change
    useEffect(() => {
        if (contentService.current) {
            contentService.current.updateSettings(settings);
        }
    }, [
        settings.showFilePreview,
        settings.showFeatureImage,
        settings.useFrontmatterMetadata,
        settings.frontmatterNameField,
        settings.frontmatterCreatedField,
        settings.frontmatterModifiedField,
        settings.frontmatterDateFormat,
        settings.skipHeadingsInPreview,
        settings.featureImageProperties,
        settings.previewProperties
    ]);

    // Unified handler for all content settings changes
    // When preview OR image settings change, regenerate both for consistency
    useEffect(() => {
        const handleContentSettingsChange = async () => {
            if (!contentService.current) return;

            const currentContentSettings = {
                enabled: settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata,
                previewSettings: `${settings.showFilePreview}-${settings.skipHeadingsInPreview}-${JSON.stringify(settings.previewProperties)}`, // Removed previewRows - it's just display
                imageSettings: `${settings.showFeatureImage}-${JSON.stringify(settings.featureImageProperties)}`,
                metadataSettings: `${settings.useFrontmatterMetadata}-${settings.frontmatterNameField}-${settings.frontmatterCreatedField}-${settings.frontmatterModifiedField}-${settings.frontmatterDateFormat}`
            };

            // Check if any content settings changed
            const settingsChanged =
                prevContentSettings.current.enabled !== currentContentSettings.enabled ||
                prevContentSettings.current.previewSettings !== currentContentSettings.previewSettings ||
                prevContentSettings.current.imageSettings !== currentContentSettings.imageSettings ||
                prevContentSettings.current.metadataSettings !== currentContentSettings.metadataSettings;

            // Skip the first run to avoid clearing content on mount
            if (isFirstSettingsCheck.current) {
                isFirstSettingsCheck.current = false;
                prevContentSettings.current = currentContentSettings;
                return;
            }

            if (!settingsChanged) {
                return;
            }

            // Store a copy of the previous settings before updating
            const previousSettings = { ...prevContentSettings.current };
            prevContentSettings.current = currentContentSettings;

            // Process settings change immediately
            if (!contentService.current) return;

            // Only clear and regenerate if settings that affect content have changed
            let needsRegeneration = false;

            // Check if preview settings changed (including enabled/disabled)
            const prevPreviewEnabled = previousSettings.previewSettings.startsWith('true');
            const currentPreviewEnabled = currentContentSettings.previewSettings.startsWith('true');

            if (previousSettings.previewSettings !== currentContentSettings.previewSettings) {
                needsRegeneration = true;
            }

            // Check if image settings changed (including enabled/disabled)
            const prevImageEnabled = previousSettings.imageSettings.startsWith('true');
            const currentImageEnabled = currentContentSettings.imageSettings.startsWith('true');

            if (previousSettings.imageSettings !== currentContentSettings.imageSettings) {
                needsRegeneration = true;
            }

            // Check if metadata settings changed (including enabled/disabled)
            const prevMetadataEnabled = previousSettings.metadataSettings.startsWith('true');
            const currentMetadataEnabled = currentContentSettings.metadataSettings.startsWith('true');

            if (previousSettings.metadataSettings !== currentContentSettings.metadataSettings) {
                needsRegeneration = true;
            }

            // Clear content in IndexedDB when features are disabled or settings change
            if (needsRegeneration) {
                const db = getDBInstance();
                const clearPromises: Promise<void>[] = [];

                // Use efficient cursor-based clearing when disabling features or changing settings
                if (
                    (prevPreviewEnabled && !currentPreviewEnabled) ||
                    (currentPreviewEnabled && previousSettings.previewSettings !== currentContentSettings.previewSettings)
                ) {
                    clearPromises.push(db.batchClearAllFileContent('preview'));
                }
                if (
                    (prevImageEnabled && !currentImageEnabled) ||
                    (currentImageEnabled && previousSettings.imageSettings !== currentContentSettings.imageSettings)
                ) {
                    clearPromises.push(db.batchClearAllFileContent('featureImage'));
                }
                if (
                    (prevMetadataEnabled && !currentMetadataEnabled) ||
                    (currentMetadataEnabled && previousSettings.metadataSettings !== currentContentSettings.metadataSettings)
                ) {
                    clearPromises.push(db.batchClearAllFileContent('metadata'));
                }

                await Promise.all(clearPromises);
            }

            // Determine if we should regenerate content
            let shouldRegenerate = false;
            let enablingPreview = false;
            let enablingFeature = false;
            let enablingMetadata = false;

            if (needsRegeneration) {
                // Check if we're enabling a feature that was previously disabled
                enablingPreview = !prevPreviewEnabled && currentPreviewEnabled;
                enablingFeature = !prevImageEnabled && currentImageEnabled;
                enablingMetadata = !prevMetadataEnabled && currentMetadataEnabled;

                // Check if actual processing settings changed (not just enabled/disabled)
                const prevProcessingSettings = previousSettings.previewSettings.slice(previousSettings.previewSettings.indexOf('-'));
                const currentProcessingSettings = currentContentSettings.previewSettings.slice(
                    currentContentSettings.previewSettings.indexOf('-')
                );
                const processingSettingsChanged = prevProcessingSettings !== currentProcessingSettings && currentPreviewEnabled;

                // Check if image properties changed
                const imagePropertiesChanged =
                    previousSettings.imageSettings.includes('[') &&
                    currentContentSettings.imageSettings.includes('[') &&
                    previousSettings.imageSettings.slice(previousSettings.imageSettings.indexOf('[')) !==
                        currentContentSettings.imageSettings.slice(currentContentSettings.imageSettings.indexOf('[')) &&
                    currentImageEnabled;

                // Check if metadata fields changed
                const metadataFieldsChanged =
                    previousSettings.metadataSettings !== currentContentSettings.metadataSettings && currentMetadataEnabled;

                // Regenerate if enabling any feature or if settings changed
                shouldRegenerate =
                    enablingPreview ||
                    enablingFeature ||
                    enablingMetadata ||
                    processingSettingsChanged ||
                    imagePropertiesChanged ||
                    metadataFieldsChanged;
            }

            if (shouldRegenerate && (settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata)) {
                const excludedProperties = parseExcludedProperties(settings.excludedFiles);
                const allFiles = app.vault
                    .getMarkdownFiles()
                    .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
                // Queue all files for regeneration after settings change
                contentService.current.queueContent(allFiles, null);
            }
        };

        handleContentSettingsChange();
    }, [
        app,
        settings.showFilePreview,
        settings.skipHeadingsInPreview,
        settings.showFeatureImage,
        settings.featureImageProperties,
        settings.excludedFiles,
        settings.useFrontmatterMetadata,
        settings.frontmatterNameField,
        settings.frontmatterCreatedField,
        settings.frontmatterModifiedField,
        settings.frontmatterDateFormat
    ]);

    // Memoize the context value to prevent re-renders when fileData/cache haven't changed
    const contextValue = useMemo(() => {
        // Get file display name from frontmatter, falling back to file basename
        const getFileDisplayName = (file: TFile): string => {
            // If metadata is enabled, extract on-demand
            if (settings.useFrontmatterMetadata) {
                const metadata = extractMetadata(app, file, settings);
                if (metadata.fn) {
                    return metadata.fn;
                }
            }

            // Fall back to default display name
            return getDisplayName(file, undefined, settings);
        };

        const getFileCreatedTime = (file: TFile): number => {
            // If metadata is enabled, extract on-demand
            if (settings.useFrontmatterMetadata) {
                const metadata = extractMetadata(app, file, settings);
                if (metadata.fc !== undefined) {
                    return metadata.fc;
                }
            }

            // Fall back to file system timestamp
            return file.stat.ctime;
        };

        const getFileModifiedTime = (file: TFile): number => {
            // If metadata is enabled, extract on-demand
            if (settings.useFrontmatterMetadata) {
                const metadata = extractMetadata(app, file, settings);
                if (metadata.fm !== undefined) {
                    return metadata.fm;
                }
            }

            // Fall back to file system timestamp
            return file.stat.mtime;
        };

        const getFileMetadata = (file: TFile): { name: string; created: number; modified: number } => {
            // If metadata is enabled, extract on-demand
            let extractedMetadata: ProcessedMetadata | null = null;
            if (settings.useFrontmatterMetadata) {
                extractedMetadata = extractMetadata(app, file, settings);
            }

            return {
                name: extractedMetadata?.fn || getDisplayName(file, undefined, settings),
                created: extractedMetadata?.fc !== undefined ? extractedMetadata.fc : file.stat.ctime,
                modified: extractedMetadata?.fm !== undefined ? extractedMetadata.fm : file.stat.mtime
            };
        };

        return {
            fileData,
            getFileDisplayName,
            getFileCreatedTime,
            getFileModifiedTime,
            getFileMetadata,
            getDB: getDBInstance,
            getFile: (path: string) => getDBInstance().getFile(path),
            getFiles: (paths: string[]) => getDBInstance().getFiles(paths),
            hasPreview: (path: string) => getDBInstance().hasPreview(path),
            isStorageReady
        };
    }, [fileData, settings, app, isStorageReady]);

    return <StorageContext.Provider value={contextValue}>{children}</StorageContext.Provider>;
}

/**
 * Hook to access file cache and file data
 *
 * Returns:
 * - fileData: Contains the tag tree and untagged file count
 * - Methods to get file metadata from frontmatter
 */
export function useFileCache() {
    const context = useContext(StorageContext);
    if (!context) {
        throw new Error('useFileCache must be used within StorageProvider');
    }
    return context;
}
