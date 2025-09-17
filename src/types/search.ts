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
 * Represents a highlighted segment returned by a search provider.
 * Used to indicate which parts of text should be highlighted in the UI.
 */
export interface SearchMatchRange {
    /** Zero-based character offset where the match starts */
    offset: number;
    /** Length of the matched text in characters */
    length: number;
    /** The actual matched text content */
    text: string;
}

/**
 * Metadata attached to files when search results are provided by Omnisearch.
 * Contains all information needed to display search results with context and highlights.
 *
 * @remarks
 * This metadata is attached to file items in the list view when Omnisearch is active.
 * When Omnisearch is not available, file items will not have this metadata and
 * the UI falls back to simple filename filtering.
 */
export interface SearchResultMeta {
    /** Relevance score from the search engine (higher is more relevant) */
    score: number;
    /** Search terms that were found in this file */
    terms: string[];
    /** Specific text segments to highlight in the file name or content */
    matches: SearchMatchRange[];
    /** Optional text excerpt showing the match in context */
    excerpt?: string;
}
