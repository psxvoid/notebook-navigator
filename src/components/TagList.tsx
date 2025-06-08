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
import { useAppContext } from '../context/AppContext';
import { buildTagTree, TagTreeNode, getTotalNoteCount } from '../utils/tagUtils';
import { TagTreeItem } from './TagTreeItem';
import { parseExcludedProperties, shouldExcludeFile } from '../utils/fileFilters';

/**
 * Component that displays all tags in the vault as a hierarchical tree.
 * Tags are organized by their path structure (e.g., #inbox/processing).
 */
export function TagList() {
    const { app, appState, dispatch, plugin, refreshCounter } = useAppContext();

    // Don't render if tags are disabled in settings
    if (!plugin.settings.showTags) {
        return null;
    }

    // Build the tag tree from all vault files
    const tagTree = useMemo(() => {
        const excludedProperties = parseExcludedProperties(plugin.settings.excludedFiles);
        const allFiles = app.vault.getMarkdownFiles().filter(file => {
            return !excludedProperties.length || !shouldExcludeFile(file, excludedProperties, app);
        });
        return buildTagTree(allFiles, app);
    }, [app.vault, app.metadataCache, plugin.settings.excludedFiles, refreshCounter]);

    // Recursive render function for tag nodes
    const renderTagNode = (tagNode: TagTreeNode, level: number = 0): React.ReactNode => {
        const isExpanded = appState.expandedTags.has(tagNode.path);
        const isSelected = appState.selectionType === 'tag' && appState.selectedTag === tagNode.path;
        const fileCount = getTotalNoteCount(tagNode);

        return (
            <React.Fragment key={tagNode.path}>
                <TagTreeItem
                    tagNode={tagNode}
                    level={level}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    fileCount={fileCount}
                    showFileCount={plugin.settings.showFolderFileCount}
                    onClick={() => dispatch({ type: 'SET_SELECTED_TAG', tag: tagNode.path })}
                    onToggle={() => dispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tagNode.path })}
                />
                <div className={`nn-tag-children ${isExpanded ? 'nn-expanded' : ''}`}>
                    <div className="nn-tag-children-inner">
                        {isExpanded && Array.from(tagNode.children.values())
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(child => renderTagNode(child, level + 1))}
                    </div>
                </div>
            </React.Fragment>
        );
    };

    // Get root nodes and sort them
    const rootNodes = Array.from(tagTree.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Don't render if there are no tags
    if (rootNodes.length === 0) {
        return null;
    }

    return (
        <div className="nn-tag-list-container">
            <div className="nn-section-header">Tags</div>
            <div className="nn-tag-list">
                {rootNodes.map(node => renderTagNode(node, 0))}
            </div>
        </div>
    );
}