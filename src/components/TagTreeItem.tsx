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

import React, { forwardRef } from 'react';
import { setIcon } from 'obsidian';
import { TagTreeNode } from '../utils/tagUtils';
import { ObsidianIcon } from './ObsidianIcon';
import { useContextMenu } from '../hooks/useContextMenu';
import { ItemType } from '../types';

/**
 * Props for the TagTreeItem component
 */
interface TagTreeItemProps {
    /** The tag node to render */
    tagNode: TagTreeNode;
    /** Nesting level for indentation */
    level: number;
    /** Whether this tag is expanded to show children */
    isExpanded: boolean;
    /** Whether this tag is currently selected */
    isSelected: boolean;
    /** Callback when the expand/collapse chevron is clicked */
    onToggle: () => void;
    /** Callback when the tag name is clicked */
    onClick: () => void;
    /** Total count of files with this tag (including children) */
    fileCount: number;
    /** Whether to show file counts */
    showFileCount: boolean;
    /** Custom icon for this tag (optional) */
    customIcon?: string;
    /** Custom color for this tag (optional) */
    customColor?: string;
}

/**
 * Component that renders a single tag in the hierarchical tag tree.
 * Handles indentation, expand/collapse state, and selection state.
 */
export const TagTreeItem = React.memo(forwardRef<HTMLDivElement, TagTreeItemProps>(function TagTreeItem({ 
    tagNode, 
    level, 
    isExpanded, 
    isSelected, 
    onToggle, 
    onClick, 
    fileCount,
    showFileCount,
    customIcon,
    customColor
}, ref) {
    const chevronRef = React.useRef<HTMLDivElement>(null);
    const itemRef = React.useRef<HTMLDivElement>(null);
    const hasChildren = tagNode.children.size > 0;
    
    // Set up forwarded ref
    React.useImperativeHandle(ref, () => itemRef.current as HTMLDivElement);
    
    // Add context menu (excluding untagged which doesn't support operations)
    useContextMenu(itemRef, tagNode.path === '__untagged__' ? null : {
        type: ItemType.TAG,
        item: tagNode.path
    });

    // Update chevron icon based on expanded state
    React.useEffect(() => {
        if (chevronRef.current && hasChildren) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded, hasChildren]);

    // Handle double-click to toggle expansion
    const handleDoubleClick = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (hasChildren) {
            onToggle();
        }
    }, [hasChildren, onToggle]);

    return (
        <div 
            ref={itemRef}
            className={`nn-tag-item ${isSelected ? 'nn-selected' : ''}`} 
            data-tag={tagNode.path}
            style={{ paddingInlineStart: `${level * 20}px` }}
        >
            <div 
                className="nn-tag-content"
                onClick={onClick}
                onDoubleClick={handleDoubleClick}
            >
                <div
                    ref={chevronRef}
                    className="nn-tag-arrow"
                    style={{ 
                        visibility: hasChildren ? 'visible' : 'hidden',
                        cursor: hasChildren ? 'pointer' : 'default',
                        width: '18px',
                        minWidth: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggle();
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                />
                <span className="nn-tag-icon" style={{ color: customColor }}>
                    <ObsidianIcon name={customIcon || 'hash'} />
                </span>
                <span className="nn-tag-name" style={customColor ? { color: customColor, fontWeight: 600 } : undefined}>
                    {tagNode.name}
                </span>
                <span className="nn-tag-spacer" />
                {showFileCount && fileCount > 0 && (
                    <span className="nn-tag-count">{fileCount}</span>
                )}
            </div>
        </div>
    );
}));