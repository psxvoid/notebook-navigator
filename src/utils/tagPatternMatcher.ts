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
 * Centralized tag pattern matching utilities
 *
 * This module provides a single source of truth for all tag pattern matching logic.
 *
 * Pattern Types:
 * 1. EXACT: "foto/kamera" → matches ONLY "foto/kamera", NOT "foto/kamera/fuji"
 * 2. WILDCARD:
 *    - "foto/*" → matches "foto/kamera", "foto/video" (direct children)
 *    - "foto/kamera/*" → matches "foto/kamera/fuji", "foto/kamera/sony"
 *    - "foto/kamera*" → matches "foto/kamera", "foto/kamera2", "foto/kamera/fuji"
 * 3. REGEX: "/foto\/.+/" → matches based on regex pattern
 *
 * Key Functions:
 * - matchesPattern(): Core matching - checks if tag matches pattern
 * - tagOrAncestorMatchesPatterns(): Used for highlighting favorites (if "foto" is favorite, "foto/kamera/fuji" shows star)
 * - tagOrDescendantMatchesPatterns(): Used for context menu (if "foto/kamera" is favorite, "foto" shows "Remove from favorites")
 * - findMatchingPatterns(): Used when removing - finds all patterns that match a tag
 *
 * Important: Exact matches are truly exact. Adding "foto/kamera" to favorites will NOT include its children.
 * To include children, use wildcards: "foto/kamera/*" or "foto/kamera*"
 */

export enum PatternType {
    EXACT = 'exact',
    WILDCARD = 'wildcard',
    REGEX = 'regex'
}

export interface ParsedPattern {
    original: string;
    type: PatternType;
    regex?: RegExp;
    normalized: string;
}

// Cache for compiled patterns to avoid repeated regex compilation
const patternCache = new Map<string, ParsedPattern>();

/**
 * Clears the pattern cache (useful for testing or when patterns change significantly)
 */
export function clearPatternCache(): void {
    patternCache.clear();
}

/**
 * Normalizes a tag path by removing # prefix and converting to lowercase
 */
function normalizeTag(tag: string): string {
    const cleaned = tag.startsWith('#') ? tag.substring(1) : tag;
    return cleaned.toLowerCase();
}

/**
 * Parses a single pattern string into a ParsedPattern object
 */
export function parsePattern(pattern: string): ParsedPattern {
    // Check cache first
    const cached = patternCache.get(pattern);
    if (cached) {
        return cached;
    }

    // Remove # prefix if present
    const cleanPattern = pattern.startsWith('#') ? pattern.substring(1) : pattern;

    let parsed: ParsedPattern;

    // Check for regex pattern (starts and ends with /)
    if (cleanPattern.startsWith('/') && cleanPattern.endsWith('/') && cleanPattern.length > 2) {
        try {
            const regexStr = cleanPattern.slice(1, -1);
            const regex = new RegExp(regexStr, 'i');
            parsed = {
                original: pattern,
                type: PatternType.REGEX,
                regex: regex,
                normalized: cleanPattern.toLowerCase()
            };
        } catch (e) {
            console.error('Invalid regex pattern:', cleanPattern, e);
            // Fallback to exact match for invalid regex
            parsed = {
                original: pattern,
                type: PatternType.EXACT,
                normalized: cleanPattern.toLowerCase()
            };
        }
    }
    // Check for wildcard pattern (contains *)
    else if (cleanPattern.includes('*')) {
        // Convert wildcard pattern to regex
        // Escape special regex characters except *
        const escapedPattern = cleanPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const regexPattern = escapedPattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`, 'i');

        parsed = {
            original: pattern,
            type: PatternType.WILDCARD,
            regex: regex,
            normalized: cleanPattern.toLowerCase()
        };
    }
    // Otherwise it's an exact match
    else {
        parsed = {
            original: pattern,
            type: PatternType.EXACT,
            normalized: cleanPattern.toLowerCase()
        };
    }

    // Cache the parsed pattern
    patternCache.set(pattern, parsed);
    return parsed;
}

/**
 * Parses multiple patterns from an array of strings
 */
export function parsePatterns(patterns: string[]): ParsedPattern[] {
    return patterns.map(p => parsePattern(p));
}

/**
 * Checks if a tag matches a parsed pattern
 *
 * Examples:
 * - Exact: "foto/kamera" only matches "foto/kamera", NOT "foto/kamera/fuji"
 * - Wildcard: "foto/kamera/*" matches "foto/kamera/fuji", "foto/kamera/sony", etc.
 * - Wildcard: "foto/kamera*" matches "foto/kamera", "foto/kamera2", "foto/kamera/fuji", etc.
 * - Regex: Matches based on the provided regex pattern
 */
export function matchesPattern(tagPath: string, pattern: ParsedPattern): boolean {
    const normalizedTag = normalizeTag(tagPath);

    switch (pattern.type) {
        case PatternType.EXACT:
            // Exact match - must be exactly the same, no descendants
            return normalizedTag === pattern.normalized;

        case PatternType.WILDCARD:
        case PatternType.REGEX:
            return pattern.regex ? pattern.regex.test(normalizedTag) : false;

        default:
            return false;
    }
}

/**
 * Checks if a tag matches any of the given patterns
 */
export function matchesAnyPattern(tagPath: string, patterns: ParsedPattern[]): boolean {
    return patterns.some(pattern => matchesPattern(tagPath, pattern));
}

/**
 * Checks if a tag or any of its ancestors matches the given patterns
 * Example: "foto/kamera/fuji" matches if "foto" or "foto/kamera" is in patterns
 */
export function tagOrAncestorMatchesPatterns(tagPath: string, patterns: ParsedPattern[]): boolean {
    const normalizedTag = normalizeTag(tagPath);
    const pathParts = normalizedTag.split('/');

    // Check from most specific to least specific
    for (let i = pathParts.length; i > 0; i--) {
        const partialPath = pathParts.slice(0, i).join('/');
        if (matchesAnyPattern(partialPath, patterns)) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if a tag or any of its descendants matches the given patterns
 * Example: "foto" matches if "foto/kamera" is in patterns
 */
export function tagOrDescendantMatchesPatterns(tagPath: string, patterns: ParsedPattern[]): boolean {
    const normalizedTag = normalizeTag(tagPath);

    for (const pattern of patterns) {
        // Check exact match first
        if (matchesPattern(tagPath, pattern)) {
            return true;
        }

        // For exact patterns, check if they are descendants
        if (pattern.type === PatternType.EXACT) {
            // Check if pattern is a descendant of this tag
            // e.g., pattern "foto/kamera" starts with "foto/"
            if (pattern.normalized.startsWith(normalizedTag + '/')) {
                return true;
            }
        }
        // For wildcard/regex patterns, we need to check if they could match descendants
        else if (pattern.regex) {
            // Create a test pattern for potential descendants
            const testDescendant = normalizedTag + '/test';
            if (pattern.regex.test(testDescendant)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Finds all patterns that match a given tag (including ancestor/descendant matches)
 * Used for "Remove from favorites" to remove all relevant patterns
 */
export function findMatchingPatterns(tagPath: string, patterns: ParsedPattern[]): ParsedPattern[] {
    const normalizedTag = normalizeTag(tagPath);
    const matchingPatterns: ParsedPattern[] = [];

    for (const pattern of patterns) {
        let matches = false;

        // Check direct match
        if (matchesPattern(tagPath, pattern)) {
            matches = true;
        }
        // For exact patterns, check ancestor/descendant relationships
        else if (pattern.type === PatternType.EXACT) {
            // Check if pattern is an ancestor (tag is more specific)
            if (normalizedTag.startsWith(pattern.normalized + '/')) {
                matches = true;
            }
            // Check if pattern is a descendant (tag is less specific)
            else if (pattern.normalized.startsWith(normalizedTag + '/')) {
                matches = true;
            }
        }

        if (matches && !matchingPatterns.includes(pattern)) {
            matchingPatterns.push(pattern);
        }
    }

    return matchingPatterns;
}
