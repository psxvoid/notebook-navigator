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

// src/components/TagList.tsx
import React, { useMemo } from 'react';
import { getAllTags } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';

/**
 * Component that displays all tags in the vault as a selectable list.
 * Tags are fetched from Obsidian's metadata cache and sorted alphabetically.
 */
export function TagList() {
    const { app, appState, dispatch, plugin, refreshCounter } = useAppContext();

    // Don't render if tags are disabled in settings
    if (!plugin.settings.showTags) {
        return null;
    }

    // Memoize the tag list with counts for performance
    const tagsWithCounts = useMemo(() => {
        const tagMap = new Map<string, number>();
        const excludedProperties = parseExcludedProperties(plugin.settings.excludedFiles);
        
        // Iterate through all markdown files
        const files = app.vault.getMarkdownFiles();
        
        for (const file of files) {
            // Skip excluded files
            if (excludedProperties.length > 0 && shouldExcludeFile(file, excludedProperties, app)) {
                continue;
            }
            
            // Get cached metadata for the file
            const cache = app.metadataCache.getFileCache(file);
            
            if (cache) {
                // Get all tags from this file
                const fileTags = getAllTags(cache);
                
                if (fileTags) {
                    // Count each tag
                    fileTags.forEach(tag => {
                        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
                    });
                }
            }
        }
        
        // Convert to sorted array with counts
        return Array.from(tagMap.entries())
            .sort(([a], [b]) => a.substring(1).localeCompare(b.substring(1)))
            .map(([tag, count]) => ({ tag, count }));
    }, [app.vault, app.metadataCache, plugin.settings.excludedFiles, refreshCounter]); // Re-run on refresh

    // Don't render if there are no tags
    if (tagsWithCounts.length === 0) {
        return null;
    }

    const handleTagClick = (tag: string) => {
        dispatch({ type: 'SET_SELECTED_TAG', tag });
        // Keep focus on the left pane (tags/folders), don't switch to files
    };

    return (
        <div className="nn-tag-list-container">
            <div className="nn-section-header">Tags</div>
            <div className="nn-tag-list">
                {tagsWithCounts.map(({ tag, count }) => (
                    <div
                        key={tag}
                        className={`nn-tag-item ${appState.selectedTag === tag ? 'nn-selected' : ''}`}
                        onClick={() => handleTagClick(tag)}
                        data-tag={tag}
                    >
                        <span className="nn-tag-icon">#</span>
                        <span className="nn-tag-name">{tag.substring(1)}</span>
                        {plugin.settings.showFolderFileCount && (
                            <span className="nn-tag-count">{count}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}