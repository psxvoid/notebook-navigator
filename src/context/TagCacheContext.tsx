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
 * Tag Cache System
 * 
 * The tag cache stores file metadata in a hierarchical tree structure that mirrors
 * the vault's folder organization. This provides efficient storage by eliminating
 * path duplication and enables fast tag tree building on startup.
 * 
 * Cache Structure Example:
 * ```
 * {
 *   "version": 1,
 *   "lastModified": 1704067200000,
 *   "untaggedCount": 42,
 *   "root": {
 *     "Daily Notes": {
 *       "2024": {
 *         "01": {
 *           "note1.md": { "m": 1704067200000, "t": "journal,personal" },
 *           "note2.md": { "m": 1704067300000, "t": "work" }
 *         }
 *       }
 *     },
 *     "Projects": {
 *       "WebApp": {
 *         "README.md": { "m": 1704067400000, "t": "documentation,project" },
 *         "tasks.md": { "m": 1704067500000, "t": "" }
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * Key Features:
 * - Hierarchical structure matches vault folder organization
 * - Files are identified by having "m" (mtime) and "t" (tags) properties
 * - Folders are objects without these properties
 * - Tags are stored as comma-separated strings (empty string if no tags)
 * - Path segments are stored only once, reducing storage by 30-70%
 * - Cache is stored in localStorage for instant startup
 * - Background diff processing updates only changed files
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { App, debounce, getAllTags } from 'obsidian';
import { 
    TagTreeNode, 
    buildTagTree, 
    clearNoteCountCache,
    loadTagCache,
    saveTagCache,
    calculateTagCacheDiff,
    buildTagTreeFromCache,
    countTotalTags,
    TagCache,
    buildCacheTree
} from '../utils/tagUtils';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';
import { useSettingsState } from './SettingsContext';
import { STORAGE_KEYS } from '../types';

/**
 * Tag data structure containing the tree and untagged count
 */
interface TagData {
    tree: Map<string, TagTreeNode>;
    untagged: number;
}

/**
 * Context value providing tag data
 */
interface TagCacheContextValue {
    tagData: TagData;
}

const TagCacheContext = createContext<TagCacheContextValue | null>(null);

interface TagCacheProviderProps {
    app: App;
    children: ReactNode;
}

/**
 * Provider component that manages tag cache and tree building
 * Loads immediately on mount to ensure tags are ready when needed
 */
export function TagCacheProvider({ app, children }: TagCacheProviderProps) {
    const settings = useSettingsState();
    const [tagData, setTagData] = useState<TagData>({ tree: new Map(), untagged: 0 });
    const [hasLoggedInitialLoad, setHasLoggedInitialLoad] = useState(false);

    useEffect(() => {
        // Function to build tag tree with caching
        const buildTags = async () => {
            if (!settings.showTags) {
                // Clear tag cache when tags are disabled
                console.log('[NotebookNavigator] Tags disabled, clearing tag cache');
                localStorage.removeItem(STORAGE_KEYS.tagCacheKey);
                setTagData({ tree: new Map(), untagged: 0 });
                return;
            }


            const excludedProperties = parseExcludedProperties(settings.excludedFiles);
            const allFiles = app.vault.getMarkdownFiles()
                .filter(file => excludedProperties.length === 0 || !shouldExcludeFile(file, excludedProperties, app));
            
            // Load cached tag data
            const cache = loadTagCache();
            
            if (cache && cache.root) {
                // Use cached data immediately for instant UI
                clearNoteCountCache();
                const { tree: cachedTree, untagged: cachedUntagged } = buildTagTreeFromCache(cache);
                setTagData({ tree: cachedTree, untagged: settings.showUntagged ? cachedUntagged : 0 });
                
                if (!hasLoggedInitialLoad) {
                    console.log(`[NotebookNavigator] Loaded tag cache (${cachedTree.size} tag nodes, ${cachedUntagged} untagged)`);
                    setHasLoggedInitialLoad(true);
                }
                
                // Calculate diff in background
                requestIdleCallback(async () => {
                    try {
                        const { toAdd, toUpdate, toRemove } = calculateTagCacheDiff(
                            cache,
                            allFiles,
                            app
                        );
                    
                    // Only update if there are changes
                    if (toAdd.length > 0 || toUpdate.length > 0 || toRemove.length > 0) {
                        // Build a completely new cache tree with all current files
                        const updatedCache: TagCache = {
                            version: 1,
                            lastModified: Date.now(),
                            root: buildCacheTree(allFiles, app),
                            untaggedCount: 0
                        };
                        
                        // Rebuild tree with updated data
                        clearNoteCountCache();
                        const { tree: newTree, untagged: newUntagged } = buildTagTreeFromCache(updatedCache);
                        updatedCache.untaggedCount = newUntagged;
                        
                        // Update UI
                        setTagData({ tree: newTree, untagged: settings.showUntagged ? newUntagged : 0 });
                        
                        // Save updated cache
                        saveTagCache(updatedCache);
                        
                    }
                    
                    } catch (error) {
                        console.error('[NotebookNavigator] Error processing tag cache diff:', error);
                    }
                }, { timeout: 1000 });
            } else {
                // No cache or invalid cache - show empty UI immediately and build in background
                setTagData({ tree: new Map(), untagged: 0 });
                
                // Build tag tree in background during idle time
                requestIdleCallback(async () => {
                    try {
                        const startTime = performance.now();
                        console.log('[NotebookNavigator] No cache found, starting background tag tree build...');
                        
                        clearNoteCountCache();
                        const newTree = buildTagTree(allFiles, app);
                    
                    let newUntagged = 0;
                    if (settings.showUntagged) {
                        newUntagged = allFiles.filter(file => {
                            const cache = app.metadataCache.getFileCache(file);
                            return !cache || !getAllTags(cache)?.length;
                        }).length;
                    }
                    
                    // Update UI with built tree
                    setTagData({ tree: newTree, untagged: newUntagged });
                    
                    // Build cache for next time
                    const newCache: TagCache = {
                        version: 1,
                        lastModified: Date.now(),
                        root: buildCacheTree(allFiles, app),
                        untaggedCount: newUntagged
                    };
                    
                    saveTagCache(newCache);
                    
                    const elapsed = performance.now() - startTime;
                    const tagCount = countTotalTags(newTree);
                    console.log(`[NotebookNavigator] Tag tree built from scratch in ${elapsed.toFixed(2)}ms (${tagCount} tags, ${newUntagged} untagged)`);
                    } catch (error) {
                        console.error('[NotebookNavigator] Error building tag tree:', error);
                        // Keep empty tag data on error
                    }
                }, { timeout: 1000 });
            }
        };

        // Build immediately on mount
        buildTags();
        
        // Create debounced version for events
        const rebuildTagTree = debounce(buildTags, 300);

        // Listen to specific vault and metadata events
        const vaultEvents = [
            app.vault.on('create', rebuildTagTree),
            app.vault.on('delete', rebuildTagTree),
            app.vault.on('rename', rebuildTagTree)
        ];
        
        // Always rebuild on metadata changes - tags might have been added OR removed
        const metadataEvent = app.metadataCache.on('changed', (file) => {
            if (file && file.extension === 'md') {
                rebuildTagTree();
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
        };
    }, [app, settings.showTags, settings.showUntagged, settings.excludedFiles]);

    return (
        <TagCacheContext.Provider value={{ tagData }}>
            {children}
        </TagCacheContext.Provider>
    );
}

/**
 * Hook to access tag data from the context
 */
export function useTagCache() {
    const context = useContext(TagCacheContext);
    if (!context) {
        throw new Error('useTagCache must be used within TagCacheProvider');
    }
    return context;
}