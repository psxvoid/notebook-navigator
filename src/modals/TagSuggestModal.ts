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

import { App } from 'obsidian';
import { buildTagTree, getTotalNoteCount } from '../utils/tagTree';
import { TagTreeNode } from '../types/storage';
import { strings } from '../i18n';
import { BaseSuggestModal } from './BaseSuggestModal';

/**
 * Modal for selecting a tag to navigate to
 * Uses Obsidian's FuzzySuggestModal for fuzzy search and familiar UI
 */
export class TagSuggestModal extends BaseSuggestModal<TagTreeNode> {
    private includeUntagged: boolean;
    private untaggedNode: TagTreeNode;

    /**
     * Creates a new TagSuggestModal
     * @param app - The Obsidian app instance
     * @param onChooseTag - Callback when a tag is selected
     * @param placeholderText - Placeholder text for the search input
     * @param actionText - Action text for the enter key instruction
     * @param includeUntagged - Whether to include "Untagged" option
     */
    constructor(
        app: App,
        onChooseTag: (tag: string) => void,
        placeholderText: string,
        actionText: string,
        includeUntagged: boolean = true
    ) {
        // Pass tag node to base, but store the string callback separately
        super(app, (tagNode: TagTreeNode) => onChooseTag(tagNode.path), placeholderText, {
            navigate: strings.modals.tagSuggest.instructions.navigate,
            action: actionText,
            dismiss: strings.modals.tagSuggest.instructions.dismiss
        });
        this.includeUntagged = includeUntagged;

        // Create special untagged node
        this.untaggedNode = {
            name: strings.common.untagged,
            path: '__untagged__',
            children: new Map(),
            notesWithTag: new Set()
        };
    }

    /**
     * Gets all tags in the vault as a flat list
     * @returns Array of tag nodes available for selection
     */
    getItems(): TagTreeNode[] {
        const tags: TagTreeNode[] = [];

        // Add untagged option if enabled
        if (this.includeUntagged) {
            tags.push(this.untaggedNode);
        }

        // Build tag tree from all files
        const allFiles = this.app.vault.getMarkdownFiles();
        const { tree: tagTree } = buildTagTree(allFiles, this.app);

        // Flatten the tree into a list
        const flattenTree = (nodes: Map<string, TagTreeNode>) => {
            for (const node of nodes.values()) {
                tags.push(node);
                if (node.children.size > 0) {
                    flattenTree(node.children);
                }
            }
        };

        flattenTree(tagTree);

        // Sort tags alphabetically by path
        tags.sort((a, b) => {
            // Keep untagged at the top
            if (a.path === '__untagged__') return -1;
            if (b.path === '__untagged__') return 1;
            return a.path.localeCompare(b.path);
        });

        return tags;
    }

    /**
     * Gets the display text for a tag
     * Shows the full path with # prefix and note count
     * @param tag - The tag node to get text for
     * @returns The display text
     */
    getItemText(tag: TagTreeNode): string {
        if (tag.path === '__untagged__') {
            return tag.name;
        }
        // Return full path with # prefix for fuzzy matching
        return `#${tag.path}`;
    }

    /**
     * Gets the display path for a tag
     * @param tag - The tag to get display path for
     * @returns The path to display
     */
    protected getDisplayPath(tag: TagTreeNode): string {
        if (tag.path === '__untagged__') {
            return tag.name;
        }
        // Show tag with # prefix
        return `#${tag.path}`;
    }

    /**
     * Gets the CSS class for tag items
     * @returns The CSS class name
     */
    protected getItemClass(): string {
        return 'nn-tag-suggest-item';
    }

    /**
     * Renders additional content for a tag
     * @param tag - The tag being rendered
     * @param itemEl - The container element
     */
    protected renderAdditionalContent(tag: TagTreeNode, itemEl: HTMLElement): void {
        // Special class for untagged
        if (tag.path === '__untagged__') {
            itemEl.addClass('nn-tag-suggest-untagged');
        }

        // Add note count
        const noteCount = getTotalNoteCount(tag);
        if (noteCount > 0) {
            itemEl.createSpan({
                text: ` (${noteCount})`,
                cls: 'nn-tag-suggest-count'
            });
        }
    }
}
