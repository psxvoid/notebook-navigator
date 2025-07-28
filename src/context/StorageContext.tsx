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
 * - Uses: IndexedDBStorage, ContentService, FileOperations, DiffCalculator
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
import { ContentService } from '../services/ContentService';
import { NotebookNavigatorSettings } from '../settings';
import { IndexedDBStorage, FileData as DBFileData } from '../storage/IndexedDBStorage';
import { calculateFileDiff } from '../storage/diffCalculator';
import {
    initializeCache,
    recordFileChanges,
    markFilesForRegeneration,
    removeFilesFromCache,
    getDBInstance
} from '../storage/fileOperations';
import { TagTreeNode } from '../types/storage';
import { DateUtils } from '../utils/dateUtils';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { getFileDisplayName as getDisplayName } from '../utils/fileNameUtils';
import { clearNoteCountCache } from '../utils/tagTree';
import { buildTagTreeFromDatabase } from '../utils/tagTree';
import { useServices } from './ServicesContext';
import { useSettingsState } from './SettingsContext';

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
    // IndexedDB storage instance for FileItem to use
    getDB: () => IndexedDBStorage;
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

    // Track storage initialization state
    const [isStorageReady, setIsStorageReady] = useState(false);

    // Track if we've already built the initial cache
    const hasBuiltInitialCache = useRef(false);

    // Track previous values for each setting type to detect changes
    const prevShowFilePreview = useRef(settings.showFilePreview);
    const prevShowFeatureImage = useRef(settings.showFeatureImage);
    const prevShowMetadata = useRef(settings.useFrontmatterMetadata);
    const prevShowTags = useRef(settings.showTags);

    // Track previous values for settings that trigger content regeneration
    const prevSkipHeadingsInPreview = useRef<boolean | null>(null);
    const prevPreviewProperties = useRef<string[] | null>(null);
    const prevFeatureImageProperties = useRef<string[] | null>(null);
    const prevFrontmatterFields = useRef<{
        name: string | null;
        created: string | null;
        modified: string | null;
        dateFormat: string | null;
    } | null>(null);

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

    // ==================== Effects ====================

    // Initialize content service
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
                                if (filesToUpdate.length > 0) {
                                    await recordFileChanges(filesToUpdate);
                                }

                                // Remove deleted files from IndexedDB
                                if (toRemove.length > 0) {
                                    await removeFilesFromCache(toRemove);
                                }

                                // Note: Tag change detection is no longer needed here
                                // Tags are now extracted by ContentService and will trigger
                                // tag tree rebuild via database change notifications
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
                                        const filesNeedingTags = settings.showTags ? db.getFilesNeedingContent('tags') : new Set<string>();
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
                                            ...filesNeedingTags,
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
                { timeout: 500 }
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
                    // Record the file change - this sets all content to null
                    await recordFileChanges([file]);

                    // ContentService will detect the null content and regenerate
                    if (contentService.current) {
                        contentService.current.queueContent([file], null);
                    }
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

                // Mark file for regeneration - metadata changes might not update mtime
                await markFilesForRegeneration([file]);

                // Queue content regeneration for the file
                if (contentService.current) {
                    contentService.current.queueContent([file], null);
                }

                // Note: We already queued content regeneration above
                // No need to check for specific feature image changes
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
        };
    }, [app, settings.showUntagged, settings.excludedFiles, isStorageReady, settings.showTags]);

    // Update service settings when they change
    useEffect(() => {
        if (contentService.current) {
            contentService.current.updateSettings(settings);
        }
    }, [
        settings.showTags,
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

    // Handle preview settings changes
    useEffect(() => {
        if (prevShowFilePreview.current === settings.showFilePreview) return;

        const wasEnabled = prevShowFilePreview.current;
        prevShowFilePreview.current = settings.showFilePreview;

        if (!contentService.current) return;

        const db = getDBInstance();

        // Clear preview data when disabling
        if (wasEnabled && !settings.showFilePreview) {
            db.batchClearAllFileContent('preview');
        }
        // Regenerate when enabling
        else if (!wasEnabled && settings.showFilePreview) {
            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault
                .getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            contentService.current.queueContent(allFiles, null);
        }
    }, [settings.showFilePreview, settings.excludedFiles, app]);

    // Handle preview processing settings changes (skip headings, properties)
    useEffect(() => {
        if (!settings.showFilePreview || !contentService.current) return;

        // Skip on initial mount
        if (prevSkipHeadingsInPreview.current === null || prevPreviewProperties.current === null) {
            prevSkipHeadingsInPreview.current = settings.skipHeadingsInPreview;
            prevPreviewProperties.current = settings.previewProperties;
            return;
        }

        // Check if settings actually changed
        const skipHeadingsChanged = prevSkipHeadingsInPreview.current !== settings.skipHeadingsInPreview;
        const previewPropsChanged = JSON.stringify(prevPreviewProperties.current) !== JSON.stringify(settings.previewProperties);

        if (skipHeadingsChanged || previewPropsChanged) {
            prevSkipHeadingsInPreview.current = settings.skipHeadingsInPreview;
            prevPreviewProperties.current = settings.previewProperties;

            // Clear and regenerate preview content when processing settings change
            const db = getDBInstance();
            db.batchClearAllFileContent('preview').then(() => {
                const excludedProperties = parseExcludedProperties(settings.excludedFiles);
                const allFiles = app.vault
                    .getMarkdownFiles()
                    .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
                contentService.current!.queueContent(allFiles, null);
            });
        }
    }, [settings.skipHeadingsInPreview, settings.previewProperties, settings.showFilePreview, settings.excludedFiles, app]);

    // Handle feature image settings changes
    useEffect(() => {
        if (prevShowFeatureImage.current === settings.showFeatureImage) return;

        const wasEnabled = prevShowFeatureImage.current;
        prevShowFeatureImage.current = settings.showFeatureImage;

        if (!contentService.current) return;

        const db = getDBInstance();

        // Clear feature image data when disabling
        if (wasEnabled && !settings.showFeatureImage) {
            db.batchClearAllFileContent('featureImage');
        }
        // Regenerate when enabling
        else if (!wasEnabled && settings.showFeatureImage) {
            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault
                .getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            contentService.current.queueContent(allFiles, null);
        }
    }, [settings.showFeatureImage, settings.excludedFiles, app]);

    // Handle feature image properties changes
    useEffect(() => {
        if (!settings.showFeatureImage || !contentService.current) return;

        // Skip on initial mount
        if (prevFeatureImageProperties.current === null) {
            prevFeatureImageProperties.current = settings.featureImageProperties;
            return;
        }

        // Check if properties actually changed
        const propertiesChanged = JSON.stringify(prevFeatureImageProperties.current) !== JSON.stringify(settings.featureImageProperties);

        if (propertiesChanged) {
            prevFeatureImageProperties.current = settings.featureImageProperties;

            // Clear and regenerate feature images when properties change
            const db = getDBInstance();
            db.batchClearAllFileContent('featureImage').then(() => {
                const excludedProperties = parseExcludedProperties(settings.excludedFiles);
                const allFiles = app.vault
                    .getMarkdownFiles()
                    .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
                contentService.current!.queueContent(allFiles, null);
            });
        }
    }, [settings.featureImageProperties, settings.showFeatureImage, settings.excludedFiles, app]);

    // Handle metadata settings changes
    useEffect(() => {
        if (prevShowMetadata.current === settings.useFrontmatterMetadata) return;

        const wasEnabled = prevShowMetadata.current;
        prevShowMetadata.current = settings.useFrontmatterMetadata;

        if (!contentService.current) return;

        const db = getDBInstance();

        // Clear metadata when disabling
        if (wasEnabled && !settings.useFrontmatterMetadata) {
            db.batchClearAllFileContent('metadata');
        }
        // Regenerate when enabling
        else if (!wasEnabled && settings.useFrontmatterMetadata) {
            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault
                .getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            contentService.current.queueContent(allFiles, null);
        }
    }, [settings.useFrontmatterMetadata, settings.excludedFiles, app]);

    // Handle metadata field changes
    useEffect(() => {
        if (!settings.useFrontmatterMetadata || !contentService.current) return;

        // Skip on initial mount
        if (prevFrontmatterFields.current === null) {
            prevFrontmatterFields.current = {
                name: settings.frontmatterNameField,
                created: settings.frontmatterCreatedField,
                modified: settings.frontmatterModifiedField,
                dateFormat: settings.frontmatterDateFormat
            };
            return;
        }

        // Check if any field actually changed
        const fieldsChanged =
            prevFrontmatterFields.current.name !== settings.frontmatterNameField ||
            prevFrontmatterFields.current.created !== settings.frontmatterCreatedField ||
            prevFrontmatterFields.current.modified !== settings.frontmatterModifiedField ||
            prevFrontmatterFields.current.dateFormat !== settings.frontmatterDateFormat;

        if (fieldsChanged) {
            prevFrontmatterFields.current = {
                name: settings.frontmatterNameField,
                created: settings.frontmatterCreatedField,
                modified: settings.frontmatterModifiedField,
                dateFormat: settings.frontmatterDateFormat
            };

            // Clear and regenerate metadata when fields change
            const db = getDBInstance();
            db.batchClearAllFileContent('metadata').then(() => {
                const excludedProperties = parseExcludedProperties(settings.excludedFiles);
                const allFiles = app.vault
                    .getMarkdownFiles()
                    .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
                contentService.current!.queueContent(allFiles, null);
            });
        }
    }, [
        settings.frontmatterNameField,
        settings.frontmatterCreatedField,
        settings.frontmatterModifiedField,
        settings.frontmatterDateFormat,
        settings.useFrontmatterMetadata,
        settings.excludedFiles,
        app
    ]);

    // Handle tags on/off - unified with other content types!
    useEffect(() => {
        if (prevShowTags.current === settings.showTags) return;

        const wasEnabled = prevShowTags.current;
        prevShowTags.current = settings.showTags;

        const db = getDBInstance();

        // Clear tags when disabling
        if (wasEnabled && !settings.showTags) {
            db.batchClearAllFileContent('tags');
        }
        // Regenerate tags when enabling
        else if (!wasEnabled && settings.showTags && contentService.current) {
            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault
                .getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            // Mark files for regeneration (preserves mtime)
            markFilesForRegeneration(allFiles).then(() => {
                // Queue content generation for tags
                contentService.current!.queueContent(allFiles, null);
            });
        }
    }, [settings.showTags, settings.excludedFiles, app]);

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
