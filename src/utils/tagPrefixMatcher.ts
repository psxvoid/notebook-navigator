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
 * Simple tag prefix matching utilities
 *
 * This module provides prefix-based matching for favorite and hidden tags.
 * Tags are matched from left to right only.
 *
 * Examples:
 * - Prefix "photo/camera" matches: "photo/camera", "photo/camera/fuji"
 * - Prefix "photo/camera" does NOT match: "photo", "hobbies/photo/camera"
 * - Prefix "photo" matches: "photo", "photo/camera", "photo/editing"
 * - Prefix "photo" does NOT match: "hobbies/photo"
 */

/**
 * Normalizes a tag path by removing # prefix, trimming slashes, and converting to lowercase
 */
function normalizeTag(tag: string): string {
    let cleaned = tag.startsWith('#') ? tag.substring(1) : tag;
    cleaned = cleaned.replace(/^\/+|\/+$/g, ''); // Trim leading/trailing slashes
    return cleaned.toLowerCase();
}

/**
 * Checks if a tag matches a specific prefix
 * @param tagPath - The tag path to check (e.g., "photo/camera/fuji")
 * @param prefix - The prefix to match against (e.g., "photo/camera")
 * @returns true if the tag starts with the prefix
 */
function matchesPrefix(tagPath: string, prefix: string): boolean {
    const normalizedTag = normalizeTag(tagPath);
    const normalizedPrefix = normalizeTag(prefix);

    // Check both exact match and prefix match in one expression
    return normalizedTag === normalizedPrefix || normalizedTag.startsWith(normalizedPrefix + '/');
}

/**
 * Checks if a tag matches any of the given prefixes
 * @param tagPath - The tag path to check
 * @param prefixes - Array of prefixes to match against
 * @returns true if the tag matches any prefix
 */
export function matchesAnyPrefix(tagPath: string, prefixes: string[]): boolean {
    return prefixes.some(prefix => matchesPrefix(tagPath, prefix));
}

/**
 * Finds all prefixes that would match a given tag
 * Used for "Remove from favorites" to find which favorite entries to remove
 *
 * @param tagPath - The tag path to check
 * @param prefixes - Array of prefixes to check against
 * @returns Array of prefixes that match this tag (preserving original casing)
 */
export function findMatchingPrefixes(tagPath: string, prefixes: string[]): string[] {
    const normalizedTag = normalizeTag(tagPath);
    const matchingPrefixes: string[] = [];

    for (const prefix of prefixes) {
        const normalizedPrefix = normalizeTag(prefix);

        // Check if this prefix would match the tag
        if (normalizedTag === normalizedPrefix || normalizedTag.startsWith(normalizedPrefix + '/')) {
            matchingPrefixes.push(prefix);
        }
        // Also check if the tag is an ancestor of the prefix
        // (e.g., clicking "photo" when "photo/camera" is favorited)
        else if (normalizedPrefix.startsWith(normalizedTag + '/')) {
            matchingPrefixes.push(prefix);
        }
    }

    return matchingPrefixes;
}
