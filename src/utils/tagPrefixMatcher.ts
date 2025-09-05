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
 * Cleans a tag path by removing # prefix and trimming slashes.
 * Assumes the input string is already lowercase.
 */
function cleanTagPath(tag: string): string {
    const cleaned = tag.startsWith('#') ? tag.substring(1) : tag;
    return cleaned.replace(/^\/+|\/+$/g, ''); // Trim leading/trailing slashes
}

/**
 * Checks if a tag matches a specific prefix. Assumes lowercase inputs.
 * @param tagPath - The tag path to check (e.g., "photo/camera/fuji") - must be lowercase
 * @param prefix - The prefix to match against (e.g., "photo/camera") - must be lowercase
 * @returns true if the tag starts with the prefix
 */
function matchesPrefix(tagPath: string, prefix: string): boolean {
    const cleanedTag = cleanTagPath(tagPath);
    // prefix from settings is already clean and lowercase

    // Check both exact match and prefix match in one expression
    return cleanedTag === prefix || cleanedTag.startsWith(`${prefix}/`);
}

/**
 * Checks if a tag matches any of the given prefixes. Assumes lowercase inputs.
 * @param tagPath - The tag path to check - must be lowercase
 * @param prefixes - Array of prefixes to match against - must be lowercase
 * @returns true if the tag matches any prefix
 */
export function matchesAnyPrefix(tagPath: string, prefixes: string[]): boolean {
    return prefixes.some(prefix => matchesPrefix(tagPath, prefix));
}

/**
 * Finds all prefixes that would match a given tag
 * Used for "Remove from favorites" to find which favorite entries to remove
 * Assumes lowercase inputs.
 *
 * @param tagPath - The tag path to check - must be lowercase
 * @param prefixes - Array of prefixes to check against - must be lowercase
 * @returns Array of prefixes that match this tag
 */
export function findMatchingPrefixes(tagPath: string, prefixes: string[]): string[] {
    const cleanedTag = cleanTagPath(tagPath);
    const matchingPrefixes: string[] = [];

    for (const prefix of prefixes) {
        // prefixes from settings are already clean and lowercase

        // Check if this prefix would match the tag
        if (cleanedTag === prefix || cleanedTag.startsWith(`${prefix}/`)) {
            matchingPrefixes.push(prefix);
        }
        // Also check if the tag is an ancestor of the prefix
        // (e.g., clicking "photo" when "photo/camera" is favorited)
        else if (prefix.startsWith(`${cleanedTag}/`)) {
            matchingPrefixes.push(prefix);
        }
    }

    return matchingPrefixes;
}

/**
 * Cleans up redundant tag patterns when adding a new pattern.
 * Removes existing patterns that would be covered by the new pattern.
 *
 * Example: When adding "photo", removes "photo/camera", "photo/camera/fuji"
 *
 * @param existingPatterns - Current list of tag patterns
 * @param newPattern - The new pattern being added
 * @returns Cleaned list with the new pattern added and redundant ones removed
 */
export function cleanupTagPatterns(existingPatterns: string[], newPattern: string): string[] {
    const cleanedNew = cleanTagPath(newPattern);

    // Filter out patterns that would be made redundant by the new pattern
    const cleanedPatterns = existingPatterns.filter(existing => {
        const cleanedExisting = cleanTagPath(existing);

        // Remove if the existing pattern is a child of the new pattern
        // Example: new="photo" removes existing="photo/camera"
        return !cleanedExisting.startsWith(`${cleanedNew}/`);
    });

    // Add the new pattern
    cleanedPatterns.push(cleanedNew);

    return cleanedPatterns;
}
