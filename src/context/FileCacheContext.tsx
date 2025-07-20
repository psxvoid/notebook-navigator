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
 * File Cache System
 * 
 * The file cache stores file metadata in a hierarchical tree structure that mirrors
 * the vault's folder organization. This provides efficient storage and enables
 * fast startup and efficient tag tree building.
 * 
 * ## Cache Structure
 * ```
 * {
 *   "version": 3,
 *   "lastModified": 1704067200000,
 *   "untaggedCount": 42,
 *   "root": {
 *     "Daily Notes": {
 *       "2024": {
 *         "01": {
 *           "note1.md": { 
 *             "m": 1704067200000,        // mtime - last modified time
 *             "t": "journal,personal",   // tags - comma-separated
 *             "p": "Preview text...",    // preview - extracted text
 *             "f": "app://...",          // feature - image URL
 *             "g": 3                     // generated - 1=preview, 2=feature, 3=both
 *           }
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * ## Content Generation Strategy
 * 
 * ### When Content is Generated:
 * ```
 * ┌─────────────────────┐     ┌─────────────────────┐
 * │ Both Features OFF   │     │ At Least One ON     │
 * │                     │────▶│                     │ = REGENERATE ALL
 * │ Preview: ❌         │     │ Preview: ✓ or ❌    │
 * │ Feature: ❌         │     │ Feature: ✓ or ❌    │
 * └─────────────────────┘     └─────────────────────┘
 * 
 * File Changes:
 * ┌─────────────────────┐     ┌─────────────────────┐
 * │ File Edited         │     │ Content Regenerated │
 * │                     │────▶│                     │ = REGENERATE ONE
 * │ mtime changed       │     │ Preview + Feature   │
 * │ g flag → 0          │     │ g flag → 1          │
 * └─────────────────────┘     └─────────────────────┘
 * 
 * Settings Changes (while content enabled):
 * ┌─────────────────────┐     ┌─────────────────────┐
 * │ Processing Changed  │     │ Content Regenerated │
 * │                     │────▶│                     │ = REGENERATE ALL
 * │ • Skip headings     │     │ With new settings   │
 * │ • Image properties  │     │                     │
 * └─────────────────────┘     └─────────────────────┘
 * ```
 * 
 * ### Key Principles:
 * 1. **Selective Generation**: Only generate what's enabled and needed
 *    - Binary flags track what was generated (1=preview, 2=feature, 3=both)
 *    - Regenerate only missing features when settings change
 *    - Efficient cache usage by storing only enabled content
 * 
 * 2. **Space Optimization**: Only store content for enabled features
 *    - Preview text cleared when preview disabled
 *    - Feature image cleared when feature disabled
 *    - Reduces cache size for disabled features
 * 
 * 3. **Smart Regeneration**: Only regenerate what's needed
 *    - Enable preview when feature exists → Only generate preview
 *    - Enable feature when preview exists → Only generate feature
 *    - File edit → Clear flags for enabled features only
 *    - Processing settings change → Regenerate affected features
 * 
 * ## Performance Optimizations:
 * - Direct cache modification (no deep cloning)
 * - Background diff processing with requestIdleCallback
 * - 300ms debounce on file changes
 * - Binary flag for simple content tracking
 * - Batch processing with progress tracking
 */

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { App, TFile, debounce, getAllTags } from 'obsidian';
import { 
    buildTagTree, 
    clearNoteCountCache,
    loadFileCache,
    saveFileCache,
    calculateFileCacheDiff,
    buildTagTreeFromCache,
    buildCacheTree,
    findFileInCache,
    CACHE_VERSION
} from '../utils/fileCacheUtils';
import { TagTreeNode, FileCache, CacheNode, FileData as FileCacheData, isFileData, isCacheNode, GENERATED_FLAGS } from '../types/cache';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { useSettingsState } from './SettingsContext';
import { getCachedFileData } from '../utils/cacheUtils';
import { DateUtils } from '../utils/dateUtils';
import { getFileDisplayName as getDisplayName } from '../utils/fileNameUtils';
import { PreviewCacheService } from '../services/PreviewCacheService';
import { NotebookNavigatorSettings } from '../settings';

/**
 * Processed metadata from frontmatter
 */
interface ProcessedMetadata {
    fn?: string;  // frontmatter name
    fc?: number;  // frontmatter created timestamp
    fm?: number;  // frontmatter modified timestamp
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
interface FileCacheContextValue {
    fileData: FileData;
    cache: FileCache | null;
    // Methods to get file metadata with automatic cache lookup and frontmatter extraction
    getFileDisplayName: (file: TFile) => string;
    getFileCreatedTime: (file: TFile) => number;
    getFileModifiedTime: (file: TFile) => number;
    getFileMetadata: (file: TFile) => { name: string; created: number; modified: number };
}

const FileCacheContext = createContext<FileCacheContextValue | null>(null);

interface FileCacheProviderProps {
    app: App;
    children: ReactNode;
}

/**
 * Helper function to clear specific content flags from all files in cache
 */
function clearContentFlags(cache: FileCache, flagToClear: number): void {
    const clearNode = (node: CacheNode) => {
        for (const key in node) {
            const value = node[key];
            if (isFileData(value)) {
                // Clear the specified flag
                value.g = (value.g || 0) & ~flagToClear;
            } else if (isCacheNode(value)) {
                clearNode(value);
            }
        }
    };
    
    clearNode(cache.root);
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

/**
 * Provider component that manages the file cache and file data.
 * 
 * Responsibilities:
 * - Loads cache from localStorage on mount for instant UI
 * - Builds tag tree from cache for navigation
 * - Tracks file changes and updates cache accordingly
 * - Manages preview text and feature image generation
 * - Handles content settings changes with unified regeneration
 * 
 * Performance optimizations:
 * - Direct cache modification (no deep cloning)
 * - Background diff processing with requestIdleCallback
 * - Debounced file change handling (300ms)
 * - Unified content generation (preview + image together)
 */
export function FileCacheProvider({ app, children }: FileCacheProviderProps) {
    const settings = useSettingsState();
    const [fileData, setFileData] = useState<FileData>({ tree: new Map(), untagged: 0 });
    const [cache, setCache] = useState<FileCache | null>(null);

    // Preview cache service handles content generation (preview text + feature images)
    const previewCacheService = useRef<PreviewCacheService | null>(null);
    const isFirstLoad = useRef(true);
    
    useEffect(() => {
        // Only create service if it doesn't exist
        if (!previewCacheService.current) {
            // Create preview cache service that notifies us when content is generated
            previewCacheService.current = new PreviewCacheService(app, settings, (updatedCache) => {
                // When content is generated, save to localStorage and update React state
                saveFileCache(updatedCache);
                // Create new object reference to trigger React re-renders
                setCache({ ...updatedCache });
            }, (file: TFile) => extractMetadata(app, file, settings));
        }
        
        return () => {
            if (previewCacheService.current) {
                previewCacheService.current.stop();
                previewCacheService.current = null;
            }
        };
    }, [app]); // Only recreate when app changes, not settings

    // Main effect: manages cache updates and builds data structures
    useEffect(() => {
        // Process existing cache and handle updates
        const processExistingCache = (cache: FileCache, allFiles: TFile[]) => {
            // Simple cache stats logging - only on first load
            if (isFirstLoad.current) {
                const cacheStats = JSON.stringify(cache).length;
                console.log(`Loaded file cache (${(cacheStats / 1024 / 1024).toFixed(2)}MB)`);
                isFirstLoad.current = false;
            }
            
            // Use cached data immediately for instant UI
            clearNoteCountCache();
            const { tree: cachedTree, untagged: cachedUntagged } = buildTagTreeFromCache(cache);
            setFileData({ tree: cachedTree, untagged: settings.showTags && settings.showUntagged ? cachedUntagged : 0 });
            
            // Process changes in background to avoid blocking UI
            requestIdleCallback(async () => {
                try {
                    const { toAdd, toUpdate, toRemove } = calculateFileCacheDiff(
                        cache,
                        allFiles,
                        app
                    );
                    
                    if (toAdd.length > 0 || toUpdate.length > 0 || toRemove.length > 0) {
                        // Update the cache directly without cloning
                        cache.lastModified = Date.now();
                        
                        // Update only the changed files
                        for (const file of [...toAdd, ...toUpdate]) {
                            const parts = file.path.split('/');
                            let current = cache.root;
                            
                            // Navigate to the file location
                            for (let i = 0; i < parts.length - 1; i++) {
                                if (!current[parts[i]]) {
                                    current[parts[i]] = {};
                                }
                                const next = current[parts[i]];
                                if (!isCacheNode(next)) {
                                    throw new Error(`Expected folder but found file at ${parts[i]}`);
                                }
                                current = next;
                            }
                            
                            // Update file metadata
                            const fileName = parts[parts.length - 1];
                            const existingFile = current[fileName];
                            const metadata = app.metadataCache.getFileCache(file);
                            const tags = metadata ? getAllTags(metadata) : [];
                            
                            // For new files, start with empty content
                            // For existing files, preserve content but mark for regeneration if updated AND content is enabled
                            const isUpdated = toUpdate.includes(file);
                            const contentEnabled = settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata;
                            
                            // Determine the generated flag value
                            let generatedFlag = 0; // Default: not generated
                            if (isFileData(existingFile) && existingFile.g !== undefined) {
                                // Preserve existing flag
                                generatedFlag = existingFile.g;
                            }
                            
                            // For updated files, clear the flags for enabled features only
                            if (isUpdated && contentEnabled) {
                                // Clear flags for features that are currently enabled (will be regenerated)
                                if (settings.showFilePreview) {
                                    generatedFlag &= ~GENERATED_FLAGS.PREVIEW;
                                }
                                if (settings.showFeatureImage) {
                                    generatedFlag &= ~GENERATED_FLAGS.FEATURE;
                                }
                                if (settings.useFrontmatterMetadata) {
                                    generatedFlag &= ~GENERATED_FLAGS.METADATA;
                                }
                            }
                            
                            // Build the file data object
                            const fileData: FileCacheData = {
                                m: file.stat.mtime,
                                t: tags ? tags.join(',') : '',
                                p: (isFileData(existingFile) && settings.showFilePreview) ? existingFile.p : '',
                                f: (isFileData(existingFile) && settings.showFeatureImage) ? existingFile.f : '',
                                g: generatedFlag
                            };
                            
                            // Preserve metadata fields if they exist and feature is enabled
                            // BUT not for updated files - let them regenerate with fresh data
                            if (isFileData(existingFile) && settings.useFrontmatterMetadata && !isUpdated) {
                                if (existingFile.fn !== undefined) fileData.fn = existingFile.fn;
                                if (existingFile.fc !== undefined) fileData.fc = existingFile.fc;
                                if (existingFile.fm !== undefined) fileData.fm = existingFile.fm;
                            }
                            
                            current[fileName] = fileData;
                        }
                        
                        // Remove deleted files
                        for (const path of toRemove) {
                            const parts = path.split('/');
                            let current = cache.root;
                            
                            // Navigate to parent folder
                            for (let i = 0; i < parts.length - 1; i++) {
                                if (!current[parts[i]]) break;
                                if (i === parts.length - 2) {
                                    // We're at the parent folder, delete the file
                                    const parentFolder = current[parts[i]];
                                    if (isCacheNode(parentFolder)) {
                                        delete parentFolder[parts[parts.length - 1]];
                                    }
                                } else {
                                    const next = current[parts[i]];
                                    if (!isCacheNode(next)) {
                                        throw new Error(`Expected folder but found file at ${parts[i]}`);
                                    }
                                    current = next;
                                }
                            }
                        }
                        
                        // Rebuild tree with updated data
                        clearNoteCountCache();
                        const { tree: newTree, untagged: newUntagged } = buildTagTreeFromCache(cache);
                        cache.untaggedCount = newUntagged;
                        
                        // Update UI
                        setFileData({ tree: newTree, untagged: settings.showTags && settings.showUntagged ? newUntagged : 0 });
                        
                        // Save updated cache
                        saveFileCache(cache);
                        setCache({ ...cache }); // Create new reference to trigger re-render
                        
                        // Queue content generation
                        if (previewCacheService.current && (settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata)) {
                            // Always process new and updated files (but only if they need content)
                            let filesToProcess = [...toAdd, ...toUpdate].filter(file => {
                                const fileNode = findFileInCache(cache.root, file.path);
                                if (!fileNode) return false;
                                
                                // Check if any enabled feature needs generation
                                const g = fileNode.g || 0;
                                const hasPreview = (g & GENERATED_FLAGS.PREVIEW) !== 0;
                                const hasFeature = (g & GENERATED_FLAGS.FEATURE) !== 0;
                                const hasMetadata = (g & GENERATED_FLAGS.METADATA) !== 0;
                                
                                return (settings.showFilePreview && !hasPreview && file.extension === 'md') ||
                                       (settings.showFeatureImage && !hasFeature) ||
                                       (settings.useFrontmatterMetadata && !hasMetadata && file.extension === 'md');
                            });
                            
                            // If no changes, check if any existing files need content generation
                            // This handles the case where settings were enabled on another device
                            if (filesToProcess.length === 0) {
                                const filesNeedingContent = allFiles.filter(file => {
                                    const fileNode = findFileInCache(cache.root, file.path);
                                    if (!fileNode) return false;
                                    
                                    // Check if any enabled feature needs generation
                                    const g = fileNode.g || 0;
                                    const hasPreview = (g & GENERATED_FLAGS.PREVIEW) !== 0;
                                    const hasFeature = (g & GENERATED_FLAGS.FEATURE) !== 0;
                                    const hasMetadata = (g & GENERATED_FLAGS.METADATA) !== 0;
                                    
                                    return (settings.showFilePreview && !hasPreview && file.extension === 'md') ||
                                           (settings.showFeatureImage && !hasFeature) ||
                                           (settings.useFrontmatterMetadata && !hasMetadata && file.extension === 'md');
                                });
                                
                                if (filesNeedingContent.length > 0) {
                                    filesToProcess = filesNeedingContent;
                                }
                            }
                            
                            if (filesToProcess.length > 0) {
                                previewCacheService.current.queueContent(filesToProcess, cache);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing file cache diff:', error);
                }
            }, { timeout: 1000 });
        };

        // Build new cache from scratch
        const buildNewCache = (allFiles: TFile[]) => {
            console.log('Building file cache from scratch...');
            const startTime = performance.now();
            setFileData({ tree: new Map(), untagged: 0 });
            
            // Build data structures in background during idle time
            requestIdleCallback(async () => {
                try {
                    clearNoteCountCache();
                    const newTree = buildTagTree(allFiles, app);
                    
                    // Count untagged files
                    const newUntagged = settings.showUntagged ? 
                        allFiles.filter(file => {
                            const cache = app.metadataCache.getFileCache(file);
                            return !cache || !getAllTags(cache)?.length;
                        }).length : 0;
                    
                    // Update UI with built tree
                    setFileData({ tree: newTree, untagged: settings.showTags ? newUntagged : 0 });
                
                    // Build cache for next time
                    const newCache: FileCache = {
                        version: CACHE_VERSION,
                        lastModified: Date.now(),
                        root: buildCacheTree(allFiles, app),
                        untaggedCount: newUntagged,
                        contentGenerated: false
                    };
                    
                    saveFileCache(newCache);
                    setCache(newCache);
                    
                    // Log completion stats
                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                    const cacheSize = (JSON.stringify(newCache).length / 1024 / 1024).toFixed(2);
                    console.log(`Built file cache in ${elapsed}s (size: ${cacheSize}MB)`);
                    
                    // Queue content generation for all files
                    if (previewCacheService.current && (settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata)) {
                        previewCacheService.current.queueContent(allFiles, newCache, true); // isInitialBuild = true
                    }
                } catch (error) {
                    console.error('Error building file data:', error);
                }
            }, { timeout: 1000 });
        };

        // Main function that orchestrates the file cache building
        const buildFileCache = async () => {
            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault.getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            
            // Load cached file data
            const cache = loadFileCache();
            setCache(cache);
            
            if (cache && cache.root) {
                processExistingCache(cache, allFiles);
            } else {
                buildNewCache(allFiles);
            }
        };

        // Build immediately on mount
        buildFileCache();
        
        // Create debounced version for events
        const rebuildFileCache = debounce(buildFileCache, 300);

        // Listen to specific vault and metadata events
        const vaultEvents = [
            app.vault.on('create', rebuildFileCache),
            app.vault.on('delete', rebuildFileCache),
            app.vault.on('rename', rebuildFileCache)
        ];
        
        // Always rebuild on metadata changes - tags might have been added OR removed
        const metadataEvent = app.metadataCache.on('changed', (file) => {
            if (file && file.extension === 'md') {
                rebuildFileCache();
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
        };
    }, [app, settings.showUntagged, settings.excludedFiles]);

    // Track content settings to detect changes and regenerate when needed
    const prevContentSettings = useRef({
        enabled: settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata,
        previewSettings: `${settings.showFilePreview}-${settings.skipHeadingsInPreview}-${settings.skipTextBeforeFirstHeading}-${settings.skipNonTextInPreview}-${settings.previewRows}`,
        imageSettings: `${settings.showFeatureImage}-${JSON.stringify(settings.featureImageProperties)}`,
        metadataSettings: `${settings.useFrontmatterMetadata}-${settings.frontmatterNameField}-${settings.frontmatterCreatedField}-${settings.frontmatterModifiedField}-${settings.frontmatterDateFormat}`
    });
    
    
    // Update service settings when they change
    useEffect(() => {
        if (previewCacheService.current) {
            previewCacheService.current.updateSettings(settings);
        }
    }, [settings.showFilePreview, settings.showFeatureImage, settings.useFrontmatterMetadata,
        settings.frontmatterNameField, settings.frontmatterCreatedField, settings.frontmatterModifiedField,
        settings.frontmatterDateFormat, settings.skipHeadingsInPreview, settings.skipTextBeforeFirstHeading,
        settings.skipNonTextInPreview, settings.previewRows, settings.featureImageProperties]);
    
    // Unified handler for all content settings changes
    // When preview OR image settings change, regenerate both for consistency
    useEffect(() => {
        if (!previewCacheService.current || !cache) return;
        
        const currentContentSettings = {
            enabled: settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata,
            previewSettings: `${settings.showFilePreview}-${settings.skipHeadingsInPreview}-${settings.skipTextBeforeFirstHeading}-${settings.skipNonTextInPreview}-${settings.previewRows}`,
            imageSettings: `${settings.showFeatureImage}-${JSON.stringify(settings.featureImageProperties)}`,
            metadataSettings: `${settings.useFrontmatterMetadata}-${settings.frontmatterNameField}-${settings.frontmatterCreatedField}-${settings.frontmatterModifiedField}-${settings.frontmatterDateFormat}`
        };
        
        // Check if any content settings changed
        const settingsChanged = 
            prevContentSettings.current.enabled !== currentContentSettings.enabled ||
            prevContentSettings.current.previewSettings !== currentContentSettings.previewSettings ||
            prevContentSettings.current.imageSettings !== currentContentSettings.imageSettings ||
            prevContentSettings.current.metadataSettings !== currentContentSettings.metadataSettings;
        
        if (!settingsChanged) {
            return;
        }
        
        
        // Store a copy of the previous settings before updating
        const previousSettings = { ...prevContentSettings.current };
        prevContentSettings.current = currentContentSettings;
        
        // Process settings change immediately
        if (!previewCacheService.current || !cache) return;
        
            
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
        
        // Clear flags when features are disabled or preview settings change
        if (needsRegeneration && cache) {
            let flagsCleared = false;
            
            // If preview was disabled, clear preview flags
            if (prevPreviewEnabled && !currentPreviewEnabled) {
                clearContentFlags(cache, GENERATED_FLAGS.PREVIEW);
                flagsCleared = true;
            }
            
            // If preview settings changed (but preview is still enabled), clear preview flags to force regeneration
            if (currentPreviewEnabled && previousSettings.previewSettings !== currentContentSettings.previewSettings) {
                clearContentFlags(cache, GENERATED_FLAGS.PREVIEW);
                flagsCleared = true;
            }
            
            // If feature was disabled, clear feature flags
            if (prevImageEnabled && !currentImageEnabled) {
                clearContentFlags(cache, GENERATED_FLAGS.FEATURE);
                flagsCleared = true;
            }
            
            // If feature image settings changed (but feature is still enabled), clear feature flags to force regeneration
            if (currentImageEnabled && previousSettings.imageSettings !== currentContentSettings.imageSettings) {
                clearContentFlags(cache, GENERATED_FLAGS.FEATURE);
                flagsCleared = true;
            }
            
            // If metadata was disabled, clear metadata flags
            if (prevMetadataEnabled && !currentMetadataEnabled) {
                clearContentFlags(cache, GENERATED_FLAGS.METADATA);
                flagsCleared = true;
            }
            
            // If metadata settings changed (but metadata is still enabled), clear metadata flags to force regeneration
            if (currentMetadataEnabled && previousSettings.metadataSettings !== currentContentSettings.metadataSettings) {
                clearContentFlags(cache, GENERATED_FLAGS.METADATA);
                flagsCleared = true;
            }
            
            // Save cache if we cleared any flags
            if (flagsCleared) {
                saveFileCache(cache);
                setCache({ ...cache });
            }
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
            const currentProcessingSettings = currentContentSettings.previewSettings.slice(currentContentSettings.previewSettings.indexOf('-'));
            const processingSettingsChanged = prevProcessingSettings !== currentProcessingSettings && currentPreviewEnabled;
            
            // Check if image properties changed
            const imagePropertiesChanged = previousSettings.imageSettings.includes('[') && 
                currentContentSettings.imageSettings.includes('[') &&
                previousSettings.imageSettings.slice(previousSettings.imageSettings.indexOf('[')) !== 
                currentContentSettings.imageSettings.slice(currentContentSettings.imageSettings.indexOf('[')) &&
                currentImageEnabled;
            
            // Check if metadata fields changed
            const metadataFieldsChanged = previousSettings.metadataSettings !== currentContentSettings.metadataSettings && currentMetadataEnabled;
            
            // Regenerate if enabling any feature or if settings changed
            shouldRegenerate = enablingPreview || enablingFeature || enablingMetadata || processingSettingsChanged || imagePropertiesChanged || metadataFieldsChanged;
        }
        
        if (shouldRegenerate && (settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata)) {
            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault.getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            // Queue all files for regeneration after settings change
            previewCacheService.current.queueContent(allFiles, cache);
        }
    }, [app, cache, settings.showFilePreview, settings.skipHeadingsInPreview, settings.skipTextBeforeFirstHeading, settings.skipNonTextInPreview, settings.previewRows,
        settings.showFeatureImage, settings.featureImageProperties, settings.excludedFiles, settings.useFrontmatterMetadata, 
        settings.frontmatterNameField, settings.frontmatterCreatedField, settings.frontmatterModifiedField, settings.frontmatterDateFormat]);

    // Memoize the context value to prevent re-renders when fileData/cache haven't changed
    const contextValue = useMemo(() => {
        // Get file display name from cache or frontmatter, falling back to file basename
        const getFileDisplayName = (file: TFile): string => {
            // First try to get from cache
            const cachedData = cache ? getCachedFileData(cache, file.path) : null;
            if (cachedData?.fn) {
                return cachedData.fn;
            }
            
            // If not in cache but metadata is enabled, extract on-demand
            if (settings.useFrontmatterMetadata) {
                const metadata = extractMetadata(app, file, settings);
                if (metadata.fn) {
                    return metadata.fn;
                }
            }
            
            // Fall back to default display name
            return getDisplayName(file, cachedData || undefined, settings);
        };

        const getFileCreatedTime = (file: TFile): number => {
            // First try to get from cache
            const cachedData = cache ? getCachedFileData(cache, file.path) : null;
            if (cachedData?.fc !== undefined) {
                return cachedData.fc;
            }
            
            // If not in cache but metadata is enabled, extract on-demand
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
            // First try to get from cache
            const cachedData = cache ? getCachedFileData(cache, file.path) : null;
            if (cachedData?.fm !== undefined) {
                return cachedData.fm;
            }
            
            // If not in cache but metadata is enabled, extract on-demand
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
            // First try to get all from cache
            const cachedData = cache ? getCachedFileData(cache, file.path) : null;
            
            // If metadata is enabled and not fully cached, extract on-demand
            let extractedMetadata: ProcessedMetadata | null = null;
            if (settings.useFrontmatterMetadata && 
                (!cachedData || cachedData.fn === undefined || cachedData.fc === undefined || cachedData.fm === undefined)) {
                extractedMetadata = extractMetadata(app, file, settings);
            }
            
            return {
                name: cachedData?.fn || extractedMetadata?.fn || getDisplayName(file, cachedData || undefined, settings),
                created: cachedData?.fc !== undefined ? cachedData.fc : 
                         extractedMetadata?.fc !== undefined ? extractedMetadata.fc : file.stat.ctime,
                modified: cachedData?.fm !== undefined ? cachedData.fm : 
                          extractedMetadata?.fm !== undefined ? extractedMetadata.fm : file.stat.mtime
            };
        };

        return {
            fileData,
            cache,
            getFileDisplayName,
            getFileCreatedTime,
            getFileModifiedTime,
            getFileMetadata
        };
    }, [fileData, cache, settings, app]);
    
    return (
        <FileCacheContext.Provider value={contextValue}>
            {children}
        </FileCacheContext.Provider>
    );
}

/**
 * Hook to access file cache and file data
 * 
 * Returns:
 * - fileData: Contains the tag tree and untagged file count
 * - cache: The hierarchical file cache with metadata, preview text, and feature images
 */
export function useFileCache() {
    const context = useContext(FileCacheContext);
    if (!context) {
        throw new Error('useFileCache must be used within FileCacheProvider');
    }
    return context;
}