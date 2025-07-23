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
 * Utility functions for emoji handling.
 *
 * This module provides functions for validating and extracting emojis from text,
 * supporting the emoji icon provider's functionality. The validation is intentionally
 * permissive to support a wide range of emoji variations and combinations.
 */

/**
 * Tests if a string contains only emoji characters.
 *
 * This is a permissive check that:
 * - Allows any string that contains high Unicode characters typical of emojis
 * - Rejects strings containing basic ASCII letters or numbers
 * - Handles emoji variations, skin tones, and composite emojis
 *
 * @param str - The string to test
 * @returns True if the string appears to be an emoji
 */
export function isValidEmoji(str: string): boolean {
    if (!str || str.length === 0) {
        return false;
    }

    // Remove whitespace
    const trimmed = str.trim();
    if (trimmed.length === 0) {
        return false;
    }

    // Check if the string contains basic text characters (a-z, A-Z, 0-9)
    // If it does, it's probably not just an emoji
    const hasText = /[a-zA-Z0-9]/.test(trimmed);
    if (hasText) {
        return false;
    }

    // More permissive check: if it doesn't contain regular text and has some Unicode,
    // we'll assume it's an emoji. This handles edge cases and newer emojis better.
    // The actual rendering will validate if it's truly an emoji
    const hasHighUnicode = /[\u{1F000}-\u{1FAFF}\u{2000}-\u{3300}\u{FE00}-\u{FE0F}]/u.test(trimmed);

    return hasHighUnicode;
}

/**
 * Extracts the first valid emoji from a string.
 *
 * Useful for handling paste events that might contain extra characters.
 * The function attempts to isolate emoji characters from the beginning
 * of the input string, handling composite emojis and modifiers.
 *
 * @param str - The string to extract from
 * @returns The first emoji found, or null if no emoji is present
 */
export function extractFirstEmoji(str: string): string | null {
    if (!str) return null;

    // Trim the string
    const trimmed = str.trim();

    // If the whole string is valid emoji, return it
    if (isValidEmoji(trimmed)) {
        return trimmed;
    }

    // Try to extract emoji-like characters from the beginning
    // This regex is intentionally broad to catch various emoji formats
    const match = trimmed.match(/^[\u{1F000}-\u{1FAFF}\u{2000}-\u{3300}\u{FE00}-\u{FE0F}\u{200D}]+/u);

    if (match && match[0].length > 0) {
        return match[0];
    }

    return null;
}
