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

import { TFile, App } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { UNTAGGED_TAG_ID } from '../types';
import { IndexedDBStorage } from '../storage/IndexedDBStorage';

/**
 * Gets normalized tags for a file (without # prefix and in lowercase)
 */
export function getNormalizedTagsForFile(file: TFile, storage: IndexedDBStorage): string[] {
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
 * Checks if a file has a specific tag (case-insensitive)
 */
export function fileHasTag(file: TFile, tag: string, storage: IndexedDBStorage): boolean {
    const normalizedTags = getNormalizedTagsForFile(file, storage);
    const normalizedSearchTag = tag.toLowerCase();

    return normalizedTags.some(fileTag => fileTag === normalizedSearchTag);
}

/**
 * Finds the first tag from a file that matches any tag in the given list
 * Returns the original tag path (not normalized) or null if no match
 */
export function findFirstMatchingTag(file: TFile, availableTags: string[], storage: IndexedDBStorage): string | null {
    const fileTags = getNormalizedTagsForFile(file, storage);
    if (fileTags.length === 0) {
        return null;
    }

    // Create a map of normalized to original tags
    const normalizedToOriginal = new Map<string, string>();
    availableTags.forEach(tag => {
        normalizedToOriginal.set(tag.toLowerCase(), tag);
    });

    // Find first matching tag
    for (const fileTag of fileTags) {
        const original = normalizedToOriginal.get(fileTag);
        if (original) {
            return original;
        }
    }

    return null;
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

    // Check if file has the currently selected tag
    if (currentTag && currentTag !== UNTAGGED_TAG_ID) {
        if (fileHasTag(file, currentTag, storage)) {
            return currentTag; // Stay on current tag
        }
    }

    // File has different tags - find the first matching tag
    // First check favorite tags if configured
    if (settings.favoriteTags && settings.favoriteTags.length > 0) {
        const favoriteMatch = findFirstMatchingTag(file, settings.favoriteTags, storage);
        if (favoriteMatch) {
            return favoriteMatch;
        }
    }

    // If no favorite match, return the first tag of the file
    // Get the original tags from cache (they preserve case)
    const fileData = storage.getFile(file.path);
    const originalTags = fileData?.tags;
    if (originalTags && originalTags.length > 0) {
        // Tags in cache are already without # prefix
        return originalTags[0];
    }

    return null;
}
