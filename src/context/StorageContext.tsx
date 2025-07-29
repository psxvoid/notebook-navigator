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

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { App, TFile, TFolder, debounce } from 'obsidian';
import { ContentService, ProcessedMetadata } from '../services/ContentService';
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
import { parseExcludedProperties, shouldExcludeFile, parseExcludedFolders, shouldExcludeFolder } from '../utils/fileFilters';
import { getFileDisplayName as getDisplayName } from '../utils/fileNameUtils';
import { clearNoteCountCache } from '../utils/tagTree';
import { buildTagTreeFromDatabase } from '../utils/tagTree';
import { useServices } from './ServicesContext';
import { useSettingsState } from './SettingsContext';
import { NotebookNavigatorSettings } from '../settings';


/**
 * Types of content that can be generated
 */
type ContentType = 'preview' | 'featureImage' | 'metadata' | 'tags';

/**
 * Metadata for a content-related setting
 */
interface ContentSettingMetadata {
    key: keyof NotebookNavigatorSettings;
    contentType: ContentType;
    isToggle: boolean; // true for show/hide settings, false for property settings
}

/**
 * Registry of all settings that affect content generation
 * This is the single source of truth for content-related settings
 */
const CONTENT_SETTINGS_REGISTRY: ContentSettingMetadata[] = [
    // Toggle settings (enable/disable features)
    { key: 'showFilePreview', contentType: 'preview', isToggle: true },
    { key: 'showFeatureImage', contentType: 'featureImage', isToggle: true },
    { key: 'useFrontmatterMetadata', contentType: 'metadata', isToggle: true },
    { key: 'showTags', contentType: 'tags', isToggle: true },
    
    // Property settings (change how content is generated)
    { key: 'skipHeadingsInPreview', contentType: 'preview', isToggle: false },
    { key: 'previewProperties', contentType: 'preview', isToggle: false },
    { key: 'featureImageProperties', contentType: 'featureImage', isToggle: false },
    { key: 'frontmatterNameField', contentType: 'metadata', isToggle: false },
    { key: 'frontmatterCreatedField', contentType: 'metadata', isToggle: false },
    { key: 'frontmatterModifiedField', contentType: 'metadata', isToggle: false },
    { key: 'frontmatterDateFormat', contentType: 'metadata', isToggle: false },
];

/**
 * Type for the extracted content settings
 */
type ContentSettingsRecord = Record<keyof NotebookNavigatorSettings, unknown>;

/**
 * Represents a change in settings
 */
interface SettingChange {
    key: keyof NotebookNavigatorSettings;
    metadata: ContentSettingMetadata;
    oldValue: unknown;
    newValue: unknown;
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
 * Extracts content-related settings from the full settings object
 */
function extractContentSettings(settings: NotebookNavigatorSettings): ContentSettingsRecord {
    const contentSettings: ContentSettingsRecord = {} as ContentSettingsRecord;
    
    CONTENT_SETTINGS_REGISTRY.forEach(({ key }) => {
        contentSettings[key] = settings[key];
    });
    
    return contentSettings;
}

/**
 * Gets an array of content setting values for useEffect dependencies
 */
function getContentSettingsDependencies(settings: NotebookNavigatorSettings): unknown[] {
    return CONTENT_SETTINGS_REGISTRY.map(({ key }) => settings[key]);
}

/**
 * Detects changes in content settings
 */
function detectContentSettingsChanges(
    prevSettings: ContentSettingsRecord,
    currentSettings: NotebookNavigatorSettings
): SettingChange[] {
    const changes: SettingChange[] = [];
    
    CONTENT_SETTINGS_REGISTRY.forEach(metadata => {
        const prevValue = prevSettings[metadata.key];
        const currentValue = currentSettings[metadata.key];
        
        // Handle arrays and objects
        const hasChanged = typeof currentValue === 'object' 
            ? JSON.stringify(prevValue) !== JSON.stringify(currentValue)
            : prevValue !== currentValue;
            
        if (hasChanged) {
            changes.push({
                key: metadata.key,
                metadata,
                oldValue: prevValue,
                newValue: currentValue
            });
        }
    });
    
    return changes;
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
    const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);

    // Track if we've already built the initial cache
    const hasBuiltInitialCache = useRef(false);

    // Track previous content settings to detect changes
    const prevContentSettings = useRef<ContentSettingsRecord | null>(null);

    // Memoize the context value to prevent re-renders when fileData/cache haven't changed
    const contextValue = useMemo(() => {
        // Get file display name from frontmatter, falling back to file basename
        const getFileDisplayName = (file: TFile): string => {
            // If metadata is enabled, extract on-demand
            if (settings.useFrontmatterMetadata) {
                const metadata = ContentService.extractMetadata(app, file, settings);
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
                const metadata = ContentService.extractMetadata(app, file, settings);
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
                const metadata = ContentService.extractMetadata(app, file, settings);
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
                extractedMetadata = ContentService.extractMetadata(app, file, settings);
            }

            return {
                name: extractedMetadata?.fn || getDisplayName(file, undefined, settings),
                created: extractedMetadata?.fc !== undefined && extractedMetadata.fc !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED ? extractedMetadata.fc : file.stat.ctime,
                modified: extractedMetadata?.fm !== undefined && extractedMetadata.fm !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED ? extractedMetadata.fm : file.stat.mtime
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
    const rebuildTagTree = useCallback(() => {
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
    }, [metadataService, settings.showTags, settings.showUntagged]);

    // Helper function to get markdown files filtered by excluded properties and folders
    const getFilteredMarkdownFiles = useCallback((): TFile[] => {
        const excludedProperties = parseExcludedProperties(settings.excludedFiles);
        const excludedFolderPatterns = parseExcludedFolders(settings.excludedFolders);
        
        return app.vault
            .getMarkdownFiles()
            .filter(file => {
                // Filter by excluded properties
                if (excludedProperties.length > 0 && shouldExcludeFile(file, excludedProperties, app)) {
                    return false;
                }
                
                // Filter by excluded folders
                if (excludedFolderPatterns.length > 0 && file.parent) {
                    let currentFolder: TFolder | null = file.parent;
                    while (currentFolder) {
                        if (shouldExcludeFolder(currentFolder.name, excludedFolderPatterns)) {
                            return false;
                        }
                        currentFolder = currentFolder.parent;
                    }
                }
                
                return true;
            });
    }, [app, settings.excludedFiles, settings.excludedFolders]);

    /**
     * Centralized handler for all content-related settings changes
     * 
     * This function processes setting changes and determines what content needs to be:
     * 1. Cleared from the database (when features are disabled or settings change)
     * 2. Regenerated (when features are enabled or settings change)
     * 
     * The logic follows these patterns:
     * - Toggle settings (show/hide): Clear when disabled, regenerate when enabled
     * - Property changes: Always clear and regenerate to ensure fresh content
     */
    const handleSettingsChanges = useCallback(async (changes: SettingChange[]) => {
        const db = getDBInstance();
        
        // Collect all clear operations to run in parallel
        const clearPromises: Promise<void>[] = [];
        
        // Track which content types need regeneration
        const needsRegeneration = new Set<ContentType>();
        
        // Process each change
        for (const change of changes) {
            const { metadata, newValue } = change;
            
            if (metadata.isToggle) {
                // Toggle settings: clear when disabled, regenerate when enabled
                if (!newValue) {
                    // Feature disabled: clear content from DB
                    clearPromises.push(db.batchClearAllFileContent(metadata.contentType));
                } else {
                    // Feature enabled: mark for regeneration
                    needsRegeneration.add(metadata.contentType);
                }
            } else {
                // Property settings: always clear and regenerate
                clearPromises.push(db.batchClearAllFileContent(metadata.contentType));
                needsRegeneration.add(metadata.contentType);
            }
        }
        
        // Execute all clear operations in parallel for better performance
        await Promise.all(clearPromises);
        
        // Regenerate content if needed
        if (needsRegeneration.size > 0 && contentService.current) {
            // Get all files that should be processed (respects exclusion settings)
            const allFiles = getFilteredMarkdownFiles();
            
            // Queue content generation for all files
            // The content service will determine what actually needs to be generated
            // based on current settings and what's already in the database
            contentService.current.queueContent(allFiles, settings);
        }
    }, [settings, getFilteredMarkdownFiles]);

    // ==================== Effects ====================

    // Initialize content service
    useEffect(() => {
        // Only create service if it doesn't exist
        if (!contentService.current) {
            // Create content service
            contentService.current = new ContentService(app);
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
        // @ts-expect-error - appId exists on app but not in type definition
        const appId = app.appId as string;
        initializeCache(appId)
            .then(() => {
                setIsIndexedDBReady(true);
            })
            .catch(error => {
                console.error('Failed to initialize IndexedDB cache:', error);
            });
    }, [app]);

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
    }, [isStorageReady, settings.showTags, settings.showUntagged, rebuildTagTree]);

    // Main initialization and vault monitoring effect
    useEffect(() => {
        
        // Process existing files and handle updates
        const processExistingCache = async (allFiles: TFile[], isInitialLoad: boolean = false) => {
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
            }

            // Build tag tree only on initial load
            if (isInitialLoad) {
                try {
                    rebuildTagTree();
                    // Now that initial data is loaded, mark storage as ready
                    setIsStorageReady(true);
                } catch (error) {
                    console.error('Failed to build tag tree from IndexedDB:', error);
                }
            }

            // Process changes in background to avoid blocking UI
            requestIdleCallback(
                async () => {
                    try {
                        const { toAdd, toUpdate, toRemove } = await calculateFileDiff(allFiles);

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

                            const contentEnabled =
                                settings.showTags ||
                                settings.showFilePreview ||
                                settings.showFeatureImage ||
                                settings.useFrontmatterMetadata;

                            if (contentService.current && contentEnabled) {
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
                                    contentService.current.queueContent(filesToProcess, settings);
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
            const allFiles = getFilteredMarkdownFiles();
            await processExistingCache(allFiles, isInitialLoad);
        };

        // Create debounced version for events (increased to 500ms to reduce duplicate processing)
        const rebuildFileCache = debounce(() => buildFileCache(false), 500);

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
                    // Record the file change - this sets all content to null
                    await recordFileChanges([file]);

                    // ContentService will detect the null content and regenerate
                    if (contentService.current) {
                        contentService.current.queueContent([file], settings);
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
                if (contentService.current) {
                    contentService.current.queueContent([file], settings);
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
    }, [app, isIndexedDBReady, getFilteredMarkdownFiles, rebuildTagTree, settings]);

    // Single effect to handle ALL content-related settings changes
    useEffect(() => {
        // Extract current content settings
        const contentSettings = extractContentSettings(settings);
        
        // Skip on initial mount
        if (!prevContentSettings.current) {
            prevContentSettings.current = contentSettings;
            return;
        }
        
        // Detect what changed
        const changes = detectContentSettingsChanges(prevContentSettings.current, settings);
        
        // Handle changes if any
        if (changes.length > 0) {
            handleSettingsChanges(changes);
            prevContentSettings.current = contentSettings;
        }
    }, [
        // Use the registry to track all content settings dynamically
        // We intentionally use a spread here to avoid manually maintaining a list of dependencies.
        // The registry ensures we track all content-related settings automatically.
        // ESLint flags this because it can't statically analyze what's inside the spread,
        // but our usage is safe since the registry is constant and deterministic.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ...getContentSettingsDependencies(settings),
        handleSettingsChanges,
        settings
    ]);

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
