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
 * Tokens extracted from a filter search query.
 * Tokens are normalized to lowercase for matching.
 */
export interface FilterSearchTokens {
    nameTokens: string[];
    tagTokens: string[];
    requireTagged: boolean;
}

const CONNECTOR_WORDS = new Set(['and']);

/**
 * Parse a filter search query into name and tag tokens.
 *
 * - Hash-prefixed tokens (e.g. #tag) are treated as tag tokens.
 * - Connector words such as "and" are ignored when other tokens exist.
 * - When only connector words are provided, they are treated as name tokens.
 *
 * @param query - Raw search query from the UI
 * @returns Lowercase token lists for name and tag matching
 */
export function parseFilterSearchTokens(query: string): FilterSearchTokens {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return { nameTokens: [], tagTokens: [], requireTagged: false };
    }

    const rawTokens = normalized.split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) {
        return { nameTokens: [], tagTokens: [], requireTagged: false };
    }

    const nameTokens: string[] = [];
    const tagTokens: string[] = [];
    const connectorCandidates: string[] = [];
    let requireTagged = false;

    rawTokens.forEach(token => {
        if (token.startsWith('#')) {
            const tagToken = token.slice(1);
            if (tagToken) {
                tagTokens.push(tagToken);
                requireTagged = true;
            } else {
                requireTagged = true;
            }
            return;
        }

        if (CONNECTOR_WORDS.has(token)) {
            connectorCandidates.push(token);
            return;
        }

        nameTokens.push(token);
    });

    if (nameTokens.length === 0 && tagTokens.length === 0 && connectorCandidates.length > 0) {
        nameTokens.push(...connectorCandidates);
    }

    return { nameTokens, tagTokens, requireTagged };
}

/**
 * Check if a file matches parsed filter search tokens.
 *
 * @param lowercaseName - File display name in lowercase
 * @param lowercaseTags - File tags in lowercase
 * @param tokens - Parsed query tokens
 * @returns True when the file satisfies both name and tag filters
 */
export function fileMatchesFilterTokens(lowercaseName: string, lowercaseTags: string[], tokens: FilterSearchTokens): boolean {
    if (tokens.nameTokens.length > 0) {
        const matchesName = tokens.nameTokens.every(token => lowercaseName.includes(token));
        if (!matchesName) {
            return false;
        }
    }

    if (tokens.requireTagged || tokens.tagTokens.length > 0) {
        if (lowercaseTags.length === 0) {
            return false;
        }
        if (tokens.tagTokens.length > 0) {
            const matchesTags = tokens.tagTokens.every(token => lowercaseTags.some(tag => tag.includes(token)));
            if (!matchesTags) {
                return false;
            }
        }
    }

    return true;
}
