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

import { TFile } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { UNTAGGED_TAG_ID } from '../types';
import { IndexedDBStorage } from '../storage/IndexedDBStorage';
import { normalizeTagPathValue } from './tagPrefixMatcher';
import { findTagNode } from './tagTree';
import type { TagTreeNode } from '../types/storage';

/**
 * Normalizes tag paths for internal lookups.
 * Removes leading # when present and returns lowercase path.
 */
export function normalizeTagPath(tagPath: string | null | undefined): string | null {
    if (!tagPath) {
        return null;
    }

    const trimmed = tagPath.trim();
    if (trimmed === '') {
        return null;
    }

    const normalized = normalizeTagPathValue(trimmed);
    return normalized === '' ? null : normalized;
}

/**
 * Resolves the canonical lowercase tag path used across state stores.
 * Returns the node path when available, otherwise the normalized string.
 */
export function resolveCanonicalTagPath(tagPath: string | null | undefined, tagTree?: Map<string, TagTreeNode>): string | null {
    if (tagPath === UNTAGGED_TAG_ID) {
        return UNTAGGED_TAG_ID;
    }

    const normalized = normalizeTagPath(tagPath);
    if (!tagTree || !normalized) {
        return normalized;
    }

    const node = findTagNode(tagTree, normalized);
    return node?.path ?? normalized;
}

/**
 * Gets normalized tags for a file (without # prefix and in lowercase)
 */
function getNormalizedTagsForFile(file: TFile, storage: IndexedDBStorage): string[] {
    if (file.extension !== 'md') {
        return [];
    }

    // Get tags from memory cache
    const fileData = storage.getFile(file.path);
    const fileTags = fileData?.tags;

    if (!fileTags || fileTags.length === 0) {
        return [];
    }

    // Tags in cache are already without # prefix, just normalize to lowercase
    return fileTags.map((tag: string) => tag.toLowerCase());
}

/**
 * Checks if a file has a specific tag - exact match only, no ancestor checking.
 * Comparison is case-insensitive (e.g., "TODO" matches "todo").
 */
function fileHasExactTag(file: TFile, tag: string, storage: IndexedDBStorage): boolean {
    const normalizedTags = getNormalizedTagsForFile(file, storage);
    const normalizedSearchTag = tag.toLowerCase();

    return normalizedTags.some(fileTag => fileTag === normalizedSearchTag);
}

/**
 * Determines which tag to reveal for a file based on current selection and settings
 */
export function determineTagToReveal(
    file: TFile,
    currentTag: string | null,
    settings: NotebookNavigatorSettings,
    storage: IndexedDBStorage
): string | null {
    // Check if file has no tags
    const fileTags = getNormalizedTagsForFile(file, storage);
    if (fileTags.length === 0) {
        // If untagged is shown, reveal it
        return settings.showUntagged ? UNTAGGED_TAG_ID : null;
    }

    // Check if we should stay on the current tag
    if (currentTag && currentTag !== UNTAGGED_TAG_ID) {
        // First check exact match
        if (fileHasExactTag(file, currentTag, storage)) {
            return currentTag; // Stay on current tag
        }

        // For auto-reveals (which tag reveals always are), check if current tag is a parent
        // This is similar to how folder auto-reveals preserve parent folders with includeDescendantNotes
        const currentTagLower = currentTag.toLowerCase();
        const currentTagPrefix = `${currentTagLower}/`;

        // Check if any of the file's tags are children of the current tag
        for (const fileTag of fileTags) {
            if (fileTag.startsWith(currentTagPrefix)) {
                return currentTag; // Stay on parent tag (shortest path)
            }
        }
    }

    // File has different tags - return the first tag of the file
    // Get the original tags from cache (they preserve case)
    const fileData = storage.getFile(file.path);
    const originalTags = fileData?.tags;
    if (originalTags && originalTags.length > 0) {
        // Tags in cache are already without # prefix
        return originalTags[0];
    }

    return null;
}

function isTagVisible(tagPath: string, expandedTags: Set<string>): boolean {
    if (!tagPath || tagPath === UNTAGGED_TAG_ID) {
        return true;
    }

    const parts = tagPath.split('/');
    let currentPath = '';

    for (let index = 0; index < parts.length - 1; index++) {
        currentPath = currentPath ? `${currentPath}/${parts[index]}` : parts[index];
        if (!expandedTags.has(currentPath)) {
            return false;
        }
    }

    return true;
}

export function findNearestVisibleTagAncestor(tagPath: string, expandedTags: Set<string>): string {
    if (!tagPath || tagPath === UNTAGGED_TAG_ID) {
        return tagPath;
    }

    const segments = tagPath.split('/');

    for (let length = segments.length; length > 0; length--) {
        const candidate = segments.slice(0, length).join('/');
        if (isTagVisible(candidate, expandedTags)) {
            return candidate;
        }
    }

    return tagPath;
}
