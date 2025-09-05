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
 * - Coordinates content generation via ContentProviderRegistry
 * - Provides real-time content updates to UI components
 *
 * Relationships:
 * - Uses: IndexedDBStorage, ContentProviderRegistry, FileOperations, DiffCalculator
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

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { App, TFile } from 'obsidian';
import { TIMEOUTS, ExtendedApp } from '../types/obsidian-extended';
import { ProcessedMetadata, extractMetadata } from '../utils/metadataExtractor';
import { ContentProviderRegistry } from '../services/content/ContentProviderRegistry';
import { PreviewContentProvider } from '../services/content/PreviewContentProvider';
import { FeatureImageContentProvider } from '../services/content/FeatureImageContentProvider';
import { MetadataContentProvider } from '../services/content/MetadataContentProvider';
import { TagContentProvider } from '../services/content/TagContentProvider';
import { IndexedDBStorage, FileData as DBFileData, METADATA_SENTINEL } from '../storage/IndexedDBStorage';
import { calculateFileDiff } from '../storage/diffCalculator';
import {
    initializeCache,
    recordFileChanges,
    markFilesForRegeneration,
    removeFilesFromCache,
    getDBInstance
} from '../storage/fileOperations';
import { TagTreeNode } from '../types/storage';
import { getFilteredMarkdownFiles } from '../utils/fileFilters';
import { getFileDisplayName as getDisplayName } from '../utils/fileNameUtils';
import { clearNoteCountCache } from '../utils/tagTree';
import { buildTagTreeFromDatabase, findTagNode, collectAllTagPaths } from '../utils/tagTree';
import { leadingEdgeDebounce } from '../utils/leadingEdgeDebounce';
import { useServices } from './ServicesContext';
import { useSettingsState } from './SettingsContext';
import { NotebookNavigatorSettings } from '../settings';
import { useDeferredMetadataCleanup } from '../hooks/useDeferredMetadataCleanup';
import { MetadataService } from '../services/MetadataService';
import type { NotebookNavigatorAPI } from '../api/NotebookNavigatorAPI';

/**
 * Data structure containing the hierarchical tag trees and untagged file count
 */
interface FileData {
    favoriteTree: Map<string, TagTreeNode>;
    tagTree: Map<string, TagTreeNode>;
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
    // Tag tree access methods
    getTagTree: () => Map<string, TagTreeNode>;
    getFavoriteTree: () => Map<string, TagTreeNode>;
    findTagInTree: (tagPath: string) => TagTreeNode | null;
    findTagInFavoriteTree: (tagPath: string) => TagTreeNode | null;
    getAllTagPaths: () => string[];
    getTagDisplayPath: (path: string) => string;
    getFiles: (paths: string[]) => Map<string, DBFileData>;
    hasPreview: (path: string) => boolean;
    // Storage initialization state
    isStorageReady: boolean;
}

const StorageContext = createContext<StorageContextValue | null>(null);

interface StorageProviderProps {
    app: App;
    api: NotebookNavigatorAPI | null;
    children: ReactNode;
}

export function StorageProvider({ app, api, children }: StorageProviderProps) {
    const settings = useSettingsState();
    const { metadataService, tagTreeService } = useServices();
    const [fileData, setFileData] = useState<FileData>({ favoriteTree: new Map(), tagTree: new Map(), untagged: 0 });

    // Content provider registry handles content generation (preview text, feature images, metadata, tags)
    const contentRegistry = useRef<ContentProviderRegistry | null>(null);
    const isFirstLoad = useRef(true);

    // Track storage initialization state
    const [isStorageReady, setIsStorageReady] = useState(false);
    const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);

    // Track if we've already built the initial cache
    const hasBuiltInitialCache = useRef(false);

    // Track previous settings to detect changes
    const prevSettings = useRef<NotebookNavigatorSettings | null>(null);

    // Track previous favoriteTags to detect changes
    const prevFavoriteTags = useRef<string[]>(settings.favoriteTags);

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
                if (metadata.fc !== undefined && metadata.fc !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED) {
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
                if (metadata.fm !== undefined && metadata.fm !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED) {
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
                created:
                    extractedMetadata?.fc !== undefined && extractedMetadata.fc !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED
                        ? extractedMetadata.fc
                        : file.stat.ctime,
                modified:
                    extractedMetadata?.fm !== undefined && extractedMetadata.fm !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED
                        ? extractedMetadata.fm
                        : file.stat.mtime
            };
        };

        // Tag tree accessor methods
        const getTagTree = () => fileData.tagTree;
        const getFavoriteTree = () => fileData.favoriteTree;

        const findTagInTree = (tagPath: string) => {
            return findTagNode(fileData.tagTree, tagPath);
        };

        const findTagInFavoriteTree = (tagPath: string) => {
            return findTagNode(fileData.favoriteTree, tagPath);
        };

        const getAllTagPaths = () => {
            const allPaths: string[] = [];
            // Collect from both trees
            for (const rootNode of fileData.favoriteTree.values()) {
                const paths = collectAllTagPaths(rootNode);
                allPaths.push(...paths);
            }
            for (const rootNode of fileData.tagTree.values()) {
                const paths = collectAllTagPaths(rootNode);
                allPaths.push(...paths);
            }
            return allPaths;
        };

        const getTagDisplayPath = (path: string): string => {
            // Try to find the tag in either tree to get its displayPath
            const tagNode = findTagNode(fileData.favoriteTree, path) || findTagNode(fileData.tagTree, path);
            return tagNode?.displayPath ?? path;
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
            isStorageReady,
            getTagTree,
            getFavoriteTree,
            findTagInTree,
            findTagInFavoriteTree,
            getAllTagPaths,
            getTagDisplayPath
        };
    }, [fileData, settings, app, isStorageReady]);

    // Helper function to get markdown files filtered by excluded properties and folders
    const getFilteredMarkdownFilesCallback = useCallback((): TFile[] => {
        return getFilteredMarkdownFiles(app, settings);
    }, [app, settings]);

    // Helper function to rebuild tag tree
    const rebuildTagTree = useCallback(() => {
        const db = getDBInstance();
        const excludedFolderPatterns = settings.excludedFolders;
        const {
            favoriteTree,
            tagTree,
            untagged: newUntagged
        } = buildTagTreeFromDatabase(db, excludedFolderPatterns, settings.favoriteTags);
        clearNoteCountCache();
        const untaggedCount = newUntagged;
        setFileData({ favoriteTree, tagTree, untagged: untaggedCount });

        // Update the TagTreeService with both trees
        if (tagTreeService) {
            tagTreeService.updateTagTree(tagTree, untaggedCount, favoriteTree);
        }

        return { favoriteTree, tagTree };
    }, [settings.excludedFolders, settings.favoriteTags, tagTreeService]);

    // Hook for handling deferred cleanup after tag extraction
    const { startTracking, handleTagsExtracted, waitForMetadataCache } = useDeferredMetadataCleanup({
        app,
        metadataService,
        isStorageReady,
        showTags: settings.showTags
    });

    /**
     * Run metadata cleanup without tags (for when tags are disabled)
     * This cleans up folder metadata and pinned notes only
     */
    const runMetadataCleanupWithoutTags = useCallback(async () => {
        if (!metadataService) return;

        const validators = MetadataService.prepareCleanupValidators(app);
        await metadataService.runUnifiedCleanup(validators);
    }, [app, metadataService]);

    /**
     * Run metadata cleanup with tags (for when tags are enabled and extracted)
     * This cleans up folder, tag, and file metadata
     */
    const runMetadataCleanupWithTags = useCallback(async () => {
        if (!metadataService) return;

        const { favoriteTree, tagTree } = rebuildTagTree();
        const combinedTree = new Map([...favoriteTree, ...tagTree]);
        const validators = MetadataService.prepareCleanupValidators(app, combinedTree);

        await metadataService.runUnifiedCleanup(validators);
    }, [app, metadataService, rebuildTagTree]);

    /**
     * Centralized handler for all content-related settings changes
     * Delegates to the ContentProviderRegistry to determine what needs regeneration
     */
    const handleSettingsChanges = useCallback(
        async (oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings) => {
            if (!contentRegistry.current) return;

            // Let the registry handle settings changes
            await contentRegistry.current.handleSettingsChange(oldSettings, newSettings);

            // Queue content generation for all files if needed
            const allFiles = getFilteredMarkdownFilesCallback();
            contentRegistry.current.queueFilesForAllProviders(allFiles, newSettings);
        },
        [getFilteredMarkdownFilesCallback]
    );

    // ==================== Effects ====================

    // Initialize content service
    useEffect(() => {
        // Only create registry if it doesn't exist
        if (!contentRegistry.current) {
            // Create content provider registry and register providers
            contentRegistry.current = new ContentProviderRegistry();
            contentRegistry.current.registerProvider(new PreviewContentProvider(app));
            contentRegistry.current.registerProvider(new FeatureImageContentProvider(app));
            contentRegistry.current.registerProvider(new MetadataContentProvider(app));
            contentRegistry.current.registerProvider(new TagContentProvider(app));
        }

        return () => {
            if (contentRegistry.current) {
                contentRegistry.current.stopAllProcessing();
                contentRegistry.current = null;
            }
        };
    }, [app]); // Only recreate when app changes, not settings

    // Initialize IndexedDB on mount
    useEffect(() => {
        const appId = (app as ExtendedApp).appId || '';
        initializeCache(appId)
            .then(() => {
                setIsIndexedDBReady(true);
            })
            .catch(error => {
                console.error('Failed to initialize IndexedDB cache:', error);
            });
    }, [app]);

    // Listen for tag changes to rebuild tag tree and trigger initial cleanup
    useEffect(() => {
        if (!isStorageReady) return;

        const db = getDBInstance();
        const unsubscribe = db.onContentChange(changes => {
            // Check if any changes include tags
            const hasTagChanges = changes.some(change => change.changes.tags !== undefined);

            if (hasTagChanges && settings.showTags) {
                // Rebuild tag tree when tags change
                const { favoriteTree, tagTree } = rebuildTagTree();

                // Handle initial cleanup tracking
                const tagChanges = changes.filter(change => change.changes.tags !== undefined);
                if (tagChanges.length > 0) {
                    handleTagsExtracted(tagChanges.length, tagTree, favoriteTree);
                }
            }
        });

        return unsubscribe;
    }, [isStorageReady, settings.showTags, rebuildTagTree, handleTagsExtracted]);

    // Main initialization and vault monitoring effect
    useEffect(() => {
        // Process existing files and handle updates
        const processExistingCache = async (allFiles: TFile[], isInitialLoad: boolean = false) => {
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
            }

            if (isInitialLoad) {
                try {
                    // Step 1: Process file changes to sync the database
                    // This MUST happen first to ensure the database reflects the current vault state
                    const { toAdd, toUpdate, toRemove, cachedFiles } = await calculateFileDiff(allFiles);

                    // Step 2: Update database with changes
                    if (toRemove.length > 0) {
                        await removeFilesFromCache(toRemove);
                    }

                    if (toAdd.length > 0 || toUpdate.length > 0) {
                        await recordFileChanges([...toAdd, ...toUpdate], cachedFiles);
                    }

                    // Step 3: Build tag tree from the now-synced database
                    // This ensures the tag tree accurately reflects the current vault state
                    rebuildTagTree();

                    // Step 4: Mark storage as ready
                    setIsStorageReady(true);

                    // Notify API that storage is ready
                    // The API will trigger the storage-ready event internally
                    if (api) {
                        api.setStorageReady(true);
                    }

                    // Step 5: Handle metadata cleanup and content generation
                    if (settings.showTags) {
                        // With tags enabled, determine which files need tag extraction
                        const filesNeedingTags = allFiles.filter(file => {
                            const fileData = getDBInstance().getFile(file.path);
                            return fileData && fileData.tags === null;
                        });

                        if (filesNeedingTags.length > 0) {
                            // Track and queue files for tag extraction
                            startTracking(filesNeedingTags.length);
                            waitForMetadataCache(() => {
                                if (contentRegistry.current) {
                                    contentRegistry.current.queueFilesForAllProviders(filesNeedingTags, settings);
                                }
                            });
                        } else {
                            // No tags to extract, run cleanup immediately
                            await runMetadataCleanupWithTags();
                        }
                    } else {
                        // Tags disabled - run cleanup immediately
                        await runMetadataCleanupWithoutTags();
                    }

                    // Step 6: Queue remaining content generation for new/modified files
                    const contentEnabled = settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata;

                    if (contentRegistry.current && contentEnabled && (toAdd.length > 0 || toUpdate.length > 0)) {
                        // Queue non-tag content generation (preview, images, metadata)
                        // Tags are already handled above if enabled
                        contentRegistry.current.queueFilesForAllProviders([...toAdd, ...toUpdate], settings);
                    }
                } catch (error) {
                    console.error('Failed during initial load sequence:', error);
                }
            } else {
                // Non-initial loads still process in background
                requestIdleCallback(
                    async () => {
                        try {
                            const { toAdd, toUpdate, toRemove, cachedFiles } = await calculateFileDiff(allFiles);

                            if (toAdd.length > 0 || toUpdate.length > 0 || toRemove.length > 0) {
                                // Update only the changed files in IndexedDB
                                try {
                                    const filesToUpdate = [...toAdd, ...toUpdate];
                                    if (filesToUpdate.length > 0) {
                                        await recordFileChanges(filesToUpdate, cachedFiles);
                                    }

                                    // Remove deleted files from IndexedDB
                                    if (toRemove.length > 0) {
                                        await removeFilesFromCache(toRemove);
                                        // Rebuild tag tree after removing files
                                        if (settings.showTags) {
                                            rebuildTagTree();
                                        }
                                    }

                                    // Note: Tag change detection is no longer needed here
                                    // Tags are now extracted by TagContentProvider and will trigger
                                    // tag tree rebuild via database change notifications
                                } catch (error) {
                                    console.error('Failed to update IndexedDB cache:', error);
                                }

                                // Queue content generation

                                const contentEnabled =
                                    settings.showTags ||
                                    settings.showFilePreview ||
                                    settings.showFeatureImage ||
                                    settings.useFrontmatterMetadata;

                                if (contentRegistry.current && contentEnabled) {
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
                                        // Also check on initial load to ensure content is generated on fresh install
                                        if (filesToProcess.length === 0) {
                                            // Get files needing content from database
                                            const filesNeedingTags = settings.showTags
                                                ? db.getFilesNeedingContent('tags')
                                                : new Set<string>();
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
                                        contentRegistry.current.queueFilesForAllProviders(filesToProcess, settings);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('Error processing file cache diff:', error);
                        }
                    },
                    { timeout: 500 }
                );
            }
        };

        // The initial build is handled by processExistingCache with isInitialLoad=true

        // Main function that orchestrates the file cache building
        const buildFileCache = async (isInitialLoad: boolean = false) => {
            const allFiles = getFilteredMarkdownFilesCallback();
            await processExistingCache(allFiles, isInitialLoad);
        };

        // Create debounced version for events with leading edge execution
        // This ensures files are added to database immediately on first event
        const rebuildFileCache = leadingEdgeDebounce(() => buildFileCache(false), TIMEOUTS.DEBOUNCE_CONTENT);

        // Only build initial cache if IndexedDB is ready and we haven't built it yet
        if (isIndexedDBReady && !hasBuiltInitialCache.current) {
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
                    // Get existing data for the file
                    const db = getDBInstance();
                    const existingData = db.getFiles([file.path]);

                    // Record the file change (only does something for new files)
                    await recordFileChanges([file], existingData);

                    // Content providers will detect the mtime mismatch (db.mtime != file.mtime) and regenerate
                    if (contentRegistry.current) {
                        contentRegistry.current.queueFilesForAllProviders([file], settings);
                    }
                }
            })
        ];

        // Listen to metadata changes for non-tag updates
        // Tags are already handled by the modify event above
        const metadataEvent = app.metadataCache.on('changed', async file => {
            if (file && file.extension === 'md') {
                // Mark file for regeneration - metadata changes might not update mtime
                await markFilesForRegeneration([file]);

                // Queue content regeneration for the file
                if (contentRegistry.current) {
                    contentRegistry.current.queueFilesForAllProviders([file], settings);
                }

                // Note: We already queued content regeneration above
                // No need to check for specific feature image changes
            }
        });

        // Cleanup
        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
        };
    }, [
        app,
        api,
        isIndexedDBReady,
        getFilteredMarkdownFilesCallback,
        rebuildTagTree,
        settings,
        metadataService,
        startTracking,
        waitForMetadataCache,
        runMetadataCleanupWithoutTags,
        runMetadataCleanupWithTags
    ]);

    // Single effect to handle ALL content-related settings changes
    useEffect(() => {
        // Skip on initial mount
        if (!prevSettings.current) {
            prevSettings.current = settings;
            return;
        }

        // Let content providers handle settings changes
        handleSettingsChanges(prevSettings.current, settings);
        prevSettings.current = settings;

        // Check for favoriteTags changes separately (not a content setting)
        const favoriteTagsChanged = JSON.stringify(prevFavoriteTags.current) !== JSON.stringify(settings.favoriteTags);
        if (favoriteTagsChanged && settings.showTags) {
            rebuildTagTree();
            prevFavoriteTags.current = settings.favoriteTags;
        }
    }, [settings, handleSettingsChanges, rebuildTagTree]);

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
