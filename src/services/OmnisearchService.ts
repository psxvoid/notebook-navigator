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

import { App, TFile, TAbstractFile } from 'obsidian';
import { ExtendedApp } from '../types/obsidian-extended';

/**
 * Raw match data structure from the Omnisearch plugin API.
 * Represents a single text match within a file.
 */
interface SearchMatchApi {
    match: string;
    offset: number;
}

/**
 * Raw search result structure from the Omnisearch plugin API.
 * Represents a complete search hit for a single file.
 */
interface ResultNoteApi {
    score: number;
    vault: string;
    path: string;
    basename: string;
    foundWords: string[];
    matches: SearchMatchApi[];
    excerpt: string;
}

/**
 * Expected shape of the Omnisearch plugin's public API.
 * This interface defines the contract we depend on for integration.
 */
interface OmnisearchApi {
    search: (query: string) => Promise<ResultNoteApi[]>;
    refreshIndex: () => Promise<void>;
    registerOnIndexed: (callback: () => void) => void;
    unregisterOnIndexed: (callback: () => void) => void;
}

/**
 * Type guard to verify that a file is a regular file (TFile) and not a folder.
 * @param file - The file to check, may be null
 * @returns true if the file is a TFile instance, false otherwise
 */
function isTFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile;
}

/**
 * Validates that an unknown object matches the expected Omnisearch API shape.
 * Uses structural typing to ensure all required methods are present.
 * @param candidate - The object to validate
 * @returns true if the object has all required API methods, false otherwise
 */
function isOmnisearchApi(candidate: unknown): candidate is OmnisearchApi {
    if (!candidate || typeof candidate !== 'object') {
        return false;
    }
    const api = candidate as Partial<OmnisearchApi>;
    return (
        typeof api.search === 'function' &&
        typeof api.refreshIndex === 'function' &&
        typeof api.registerOnIndexed === 'function' &&
        typeof api.unregisterOnIndexed === 'function'
    );
}

/**
 * Validates that a search result object matches the expected structure from Omnisearch.
 * Ensures all required properties are present with correct types.
 * @param candidate - The object to validate
 * @returns true if the object is a valid search result, false otherwise
 */
function isResultNoteApi(candidate: unknown): candidate is ResultNoteApi {
    if (!candidate || typeof candidate !== 'object') {
        return false;
    }
    const note = candidate as Partial<ResultNoteApi>;
    return (
        typeof note.path === 'string' &&
        typeof note.score === 'number' &&
        Array.isArray(note.matches) &&
        Array.isArray(note.foundWords) &&
        typeof note.basename === 'string'
    );
}

/**
 * Normalized match data for internal use within Notebook Navigator.
 * Provides a stable interface independent of Omnisearch's internal structure.
 */
export interface OmnisearchMatch {
    text: string;
    offset: number;
    length: number;
}

/**
 * Complete search result with resolved file reference.
 * Combines raw search data with actual Obsidian file objects for easy consumption.
 */
export interface OmnisearchHit {
    file: TFile;
    path: string;
    basename: string;
    score: number;
    excerpt: string;
    matches: OmnisearchMatch[];
    foundWords: string[];
}

/**
 * Converts raw match data from the Omnisearch API to normalized format with calculated lengths.
 * @param matches - Array of raw match data from Omnisearch API
 * @returns Array of normalized matches with text, offset, and length properties
 */
function normalizeMatches(matches: SearchMatchApi[]): OmnisearchMatch[] {
    return matches
        .filter(match => typeof match.match === 'string' && typeof match.offset === 'number')
        .map(match => ({
            text: match.match,
            offset: match.offset,
            length: match.match.length
        }));
}

/**
 * Service wrapper around the Omnisearch community plugin API.
 * Provides type-safe access to Omnisearch functionality with automatic fallback handling.
 *
 * When Omnisearch is not available, all methods gracefully degrade:
 * - isAvailable() returns false
 * - search() returns empty results
 * - Event registration methods become no-ops
 *
 * This allows Notebook Navigator to optionally enhance search with full-text capabilities
 * while maintaining core functionality when the plugin is not installed.
 */
export class OmnisearchService {
    constructor(private readonly app: App) {}

    /**
     * Locates the Omnisearch API through plugin manager or global scope.
     * Tries multiple access paths to maximize compatibility:
     * 1. First checks the official plugin registry
     * 2. Falls back to global scope (for older versions or custom installations)
     *
     * @returns The Omnisearch API if available and valid, null otherwise
     * @private
     */
    private resolveApi(): OmnisearchApi | null {
        const extended = this.app as ExtendedApp;

        // Try plugin manager first
        const pluginManager = extended.plugins;
        const plugin = pluginManager?.plugins?.omnisearch as { api?: unknown } | undefined;
        if (plugin && plugin.api && isOmnisearchApi(plugin.api)) {
            return plugin.api;
        }

        // Fallback to global scope
        const globalApi = (globalThis as { omnisearch?: unknown }).omnisearch;
        if (globalApi && isOmnisearchApi(globalApi)) {
            return globalApi;
        }

        return null;
    }

    /**
     * Indicates whether the Omnisearch plugin is currently available and functional.
     * Use this to conditionally enable full-text search features in the UI.
     *
     * @returns true if Omnisearch is installed and accessible, false otherwise
     */
    public isAvailable(): boolean {
        return this.resolveApi() !== null;
    }

    /**
     * Executes a full-text search through the Omnisearch API.
     *
     * @param query - The search query string to execute
     * @returns Promise resolving to an array of search hits with file references and match data.
     *          Returns empty array if Omnisearch is unavailable or if an error occurs.
     *
     * @remarks
     * - Invalid or non-file results are filtered out silently
     * - Results include match excerpts and highlighted segments
     * - Files that no longer exist in the vault are automatically excluded
     */
    public async search(query: string): Promise<OmnisearchHit[]> {
        const api = this.resolveApi();
        if (!api) {
            return [];
        }

        const rawResults = await api.search(query);
        const hits: OmnisearchHit[] = [];

        for (const raw of rawResults) {
            if (!isResultNoteApi(raw)) {
                continue;
            }
            const file = this.app.vault.getAbstractFileByPath(raw.path);
            if (!isTFile(file)) {
                continue;
            }

            hits.push({
                file,
                path: raw.path,
                basename: raw.basename,
                score: raw.score,
                excerpt: raw.excerpt,
                matches: normalizeMatches(raw.matches),
                foundWords: Array.isArray(raw.foundWords) ? raw.foundWords.filter(word => typeof word === 'string') : []
            });
        }

        return hits;
    }

    /**
     * Registers a callback to be invoked when Omnisearch completes indexing.
     * Use this to refresh UI or trigger dependent operations after index updates.
     *
     * @param callback - Function to call when indexing completes
     *
     * @remarks
     * If Omnisearch is not available, this method becomes a no-op.
     * Remember to unregister callbacks when components unmount to prevent memory leaks.
     */
    public registerOnIndexed(callback: () => void): void {
        const api = this.resolveApi();
        if (!api) {
            return;
        }
        api.registerOnIndexed(callback);
    }

    /**
     * Unregisters a previously registered indexing callback.
     * Call this when components unmount to prevent memory leaks.
     *
     * @param callback - The exact callback function that was previously registered
     *
     * @remarks
     * If Omnisearch is not available, this method becomes a no-op.
     * The callback must be the same function reference that was registered.
     */
    public unregisterOnIndexed(callback: () => void): void {
        const api = this.resolveApi();
        if (!api) {
            return;
        }
        api.unregisterOnIndexed(callback);
    }
}
