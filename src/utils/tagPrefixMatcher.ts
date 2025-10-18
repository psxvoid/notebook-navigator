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
 * This module provides prefix-based matching for hidden tag rules.
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
function matchesAnyPrefix(tagPath: string, prefixes: string[]): boolean {
    return prefixes.some(prefix => matchesPrefix(tagPath, prefix));
}

/**
 * Hidden tag pattern handling
 *
 * Rules:
 * - Entries without wildcards act as prefix matchers against full tag paths
 * - Entries with a single wildcard at the start (`*tag`) or end (`tag*`) act on tag names only
 * - Entries containing slashes alongside wildcards are ignored
 * - Entries containing more than one wildcard character are ignored
 *
 * Examples:
 * - "archive" -> hides archive, archive/2024, archive/2024/docs (prefix match)
 * - "temp*" -> hides temp, temp-file, temporary (name starts with)
 * - "*draft" -> hides draft, my-draft, first-draft (name ends with)
 * - "archive/*" -> IGNORED (contains slash with wildcard)
 * - "*temp*" -> IGNORED (multiple wildcards)
 */
export interface HiddenTagMatcher {
    prefixes: string[]; // Full path prefix matchers (e.g., "archive", "internal/private")
    startsWithNames: string[]; // Tag name prefix matchers (e.g., "temp" from "temp*")
    endsWithNames: string[]; // Tag name suffix matchers (e.g., "draft" from "*draft")
}

const EMPTY_HIDDEN_TAG_MATCHER: HiddenTagMatcher = {
    prefixes: [],
    startsWithNames: [],
    endsWithNames: []
};

/**
 * Removes # prefix, trims slashes, and converts to lowercase.
 */
function sanitizePattern(pattern: string): string {
    return normalizeTagPathValue(pattern);
}

/**
 * Normalizes a tag path or pattern by trimming slashes, removing # prefix, and lowercasing.
 */
export function normalizeTagPathValue(tag: string): string {
    return cleanTagPath(tag).toLowerCase();
}

/**
 * Parses patterns and categorizes them into prefix matchers or wildcard name matchers.
 *
 * @param patterns - Array of patterns from settings (e.g., ["archive", "temp*", "*draft"])
 * @returns Matcher with categorized patterns
 */
export function createHiddenTagMatcher(patterns: string[]): HiddenTagMatcher {
    if (patterns.length === 0) {
        return EMPTY_HIDDEN_TAG_MATCHER;
    }

    const prefixes = new Set<string>();
    const startsWithNames = new Set<string>();
    const endsWithNames = new Set<string>();

    for (const rawPattern of patterns) {
        const normalized = sanitizePattern(rawPattern);
        if (normalized.length === 0) {
            continue;
        }

        // Patterns without wildcards become prefix matchers
        if (!normalized.includes('*')) {
            prefixes.add(normalized);
            continue;
        }

        const firstIndex = normalized.indexOf('*');
        const lastIndex = normalized.lastIndexOf('*');

        if (firstIndex !== lastIndex) {
            // Ignore patterns with multiple wildcards (e.g., "*temp*")
            continue;
        }

        // Wildcard must be at start/end AND pattern must not contain slashes
        if ((firstIndex === 0 || firstIndex === normalized.length - 1) && !normalized.includes('/')) {
            if (firstIndex === 0) {
                // Pattern like "*draft"
                const suffix = normalized.substring(1);
                if (suffix.length > 0) {
                    endsWithNames.add(suffix);
                }
            } else {
                // Pattern like "temp*"
                const prefix = normalized.substring(0, normalized.length - 1);
                if (prefix.length > 0) {
                    startsWithNames.add(prefix);
                }
            }
        }
        // Patterns like "archive/*" are ignored (wildcards don't work with paths)
    }

    return {
        prefixes: Array.from(prefixes),
        startsWithNames: Array.from(startsWithNames),
        endsWithNames: Array.from(endsWithNames)
    };
}

/**
 * Checks if a tag matches any hidden tag pattern.
 *
 * @param tagPath - Full tag path (e.g., "archive/2024/docs")
 * @param tagName - Just the tag name (e.g., "docs")
 * @param matcher - Matcher from createHiddenTagMatcher
 * @returns true if tag matches a pattern
 */
export function matchesHiddenTagPattern(tagPath: string, tagName: string, matcher: HiddenTagMatcher): boolean {
    if (!matcher.prefixes.length && !matcher.startsWithNames.length && !matcher.endsWithNames.length) {
        return false;
    }

    const normalizedPath = sanitizePattern(tagPath);

    // Check prefix matchers (e.g., "archive" matches "archive/2024")
    if (matcher.prefixes.length > 0 && matchesAnyPrefix(normalizedPath, matcher.prefixes)) {
        return true;
    }

    const normalizedName = tagName.toLowerCase();

    // Check name starts with (e.g., "temp*" matches "temp-file")
    if (matcher.startsWithNames.some(prefix => normalizedName.startsWith(prefix))) {
        return true;
    }

    // Check name ends with (e.g., "*draft" matches "my-draft")
    if (matcher.endsWithNames.some(suffix => normalizedName.endsWith(suffix))) {
        return true;
    }

    return false;
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
    const normalizedNew = sanitizePattern(newPattern);
    if (normalizedNew.length === 0) {
        return existingPatterns;
    }

    const hasWildcard = normalizedNew.includes('*');
    const result: string[] = [];
    const seen = new Set<string>();

    for (const existing of existingPatterns) {
        const normalizedExisting = sanitizePattern(existing);
        if (normalizedExisting.length === 0) {
            continue;
        }

        if (seen.has(normalizedExisting)) {
            continue;
        }

        if (!hasWildcard && !normalizedExisting.includes('*') && normalizedExisting.startsWith(`${normalizedNew}/`)) {
            continue;
        }

        result.push(normalizedExisting);
        seen.add(normalizedExisting);
    }

    if (!seen.has(normalizedNew)) {
        result.push(normalizedNew);
    }

    return result;
}
