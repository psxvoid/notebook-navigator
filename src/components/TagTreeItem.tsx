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
 * OPTIMIZATIONS:
 *
 * 1. React.memo with forwardRef - Component only re-renders when props change
 *
 * 2. Props-based data flow:
 *    - All data comes from NavigationPane via props (no direct cache access)
 *    - color: Custom tag color from MetadataService (via NavigationPane)
 *    - icon: Custom tag icon from MetadataService (via NavigationPane)
 *    - fileCount: Pre-computed in NavigationPane from RAM cache
 *    - tagNode: Tag tree structure from StorageContext (via NavigationPane)
 *
 * 3. Memoized values:
 *    - hasChildren: Cached check using tagNode.children.size
 *    - className: Cached CSS class string construction
 *    - tagNameClassName: Cached tag name styling classes
 *
 * 4. Stable callbacks:
 *    - handleDoubleClick: Memoized expansion handler
 *    - handleChevronClick: Memoized with Alt+click support for bulk operations
 *    - handleChevronDoubleClick: Prevents unwanted event propagation
 *
 * 5. Icon optimization:
 *    - Icons rendered via useEffect to avoid blocking
 *    - Chevron icon updates based on expansion state
 *    - Custom tag icons support with color inheritance
 *
 * 6. Data source hierarchy:
 *    - NavigationPane fetches all data from services/contexts
 *    - TagTreeItem is purely presentational with no service dependencies
 *    - Enables efficient re-rendering only when specific props change
 */

import React, { forwardRef, useMemo, useCallback } from 'react';
import { setIcon } from 'obsidian';
import { useSettingsState } from '../context/SettingsContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { getIconService } from '../services/icons';
import { ItemType } from '../types';
import { TagTreeNode } from '../types/storage';

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
    /** Callback when all sibling tags should be toggled */
    onToggleAllSiblings?: () => void;
    /** Total count of files with this tag (including children) - computed by NavigationPane from RAM cache */
    fileCount: number;
    /** Whether to show file counts */
    showFileCount: boolean;
    /** Context indicating which section this tag is in */
    context?: 'favorites' | 'tags';
    /** Custom color for the tag - fetched by NavigationPane from MetadataService */
    color?: string;
    /** Custom icon for the tag - fetched by NavigationPane from MetadataService */
    icon?: string;
    /** Whether this tag is normally hidden but being shown */
    isHidden?: boolean;
}

/**
 * Component that renders a single tag in the hierarchical tag tree.
 * Handles indentation, expand/collapse state, and selection state.
 * All data is passed via props from NavigationPane - no direct service access.
 */
export const TagTreeItem = React.memo(
    forwardRef<HTMLDivElement, TagTreeItemProps>(function TagTreeItem(
        {
            tagNode,
            level,
            isExpanded,
            isSelected,
            isHidden,
            onToggle,
            onClick,
            onToggleAllSiblings,
            fileCount,
            showFileCount,
            context,
            color,
            icon
        },
        ref
    ) {
        const settings = useSettingsState();
        const chevronRef = React.useRef<HTMLDivElement>(null);
        const iconRef = React.useRef<HTMLSpanElement>(null);
        const itemRef = React.useRef<HTMLDivElement>(null);

        // Memoize computed values
        const hasChildren = useMemo(() => tagNode.children.size > 0, [tagNode.children.size]);

        // Use color and icon from props (fetched by NavigationPane from MetadataService)
        const tagColor = color;
        const tagIcon = icon;

        // Memoize className to avoid string concatenation on every render
        const className = useMemo(() => {
            const classes = ['nn-navitem', 'nn-tag'];
            if (isSelected) classes.push('nn-selected');
            if (isHidden) classes.push('nn-excluded');
            return classes.join(' ');
        }, [isSelected, isHidden]);

        const tagNameClassName = useMemo(() => {
            const classes = ['nn-navitem-name'];
            if (tagColor) classes.push('nn-has-custom-color');
            return classes.join(' ');
        }, [tagColor]);

        // Stable event handlers
        const handleDoubleClick = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                if (hasChildren) {
                    onToggle();
                }
            },
            [hasChildren, onToggle]
        );

        const handleChevronClick = useCallback(
            (e: React.MouseEvent) => {
                e.stopPropagation();
                if (hasChildren) {
                    if (e.altKey && onToggleAllSiblings) {
                        onToggleAllSiblings();
                    } else {
                        onToggle();
                    }
                }
            },
            [hasChildren, onToggle, onToggleAllSiblings]
        );

        const handleChevronDoubleClick = useCallback((e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
        }, []);

        // Update chevron icon based on expanded state
        React.useEffect(() => {
            if (chevronRef.current && hasChildren) {
                setIcon(chevronRef.current, isExpanded ? 'lucide-chevron-down' : 'lucide-chevron-right');
            }
        }, [isExpanded, hasChildren]);

        // Update tag icon
        React.useEffect(() => {
            if (iconRef.current && settings.showIcons) {
                getIconService().renderIcon(iconRef.current, tagIcon || 'lucide-tags');
            }
        }, [tagIcon, settings.showIcons]);

        // Set up forwarded ref
        React.useImperativeHandle(ref, () => itemRef.current as HTMLDivElement);

        // Add context menu
        useContextMenu(itemRef, {
            type: ItemType.TAG,
            item: tagNode.path
        });

        return (
            <div
                ref={itemRef}
                className={className}
                data-tag={tagNode.path}
                data-drop-zone="tag"
                data-drop-path={tagNode.displayPath}
                data-tag-context={context}
                data-level={level}
                style={{ '--level': level } as React.CSSProperties}
                role="treeitem"
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-level={level + 1}
            >
                <div className="nn-navitem-content" onClick={onClick} onDoubleClick={handleDoubleClick}>
                    <div
                        ref={chevronRef}
                        className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                        onClick={handleChevronClick}
                        onDoubleClick={handleChevronDoubleClick}
                        tabIndex={-1}
                    />
                    {settings.showIcons && (
                        <span className="nn-navitem-icon" ref={iconRef} style={tagColor ? { color: tagColor } : undefined} />
                    )}
                    <span className={tagNameClassName} style={tagColor ? { color: tagColor } : undefined}>
                        {tagNode.name}
                    </span>
                    <span className="nn-navitem-spacer" />
                    {showFileCount && fileCount > 0 && <span className="nn-navitem-count">{fileCount}</span>}
                </div>
            </div>
        );
    })
);
