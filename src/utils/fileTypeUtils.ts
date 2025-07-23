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

import { App, TFile } from 'obsidian';
import { ExtendedApp } from '../types/obsidian-extended';

/**
 * File visibility options for the navigator
 */
export const FILE_VISIBILITY = {
    MARKDOWN: 'markdown',
    SUPPORTED: 'supported',
    ALL: 'all'
} as const;

/**
 * Type derived from FILE_VISIBILITY values
 */
export type FileVisibility = (typeof FILE_VISIBILITY)[keyof typeof FILE_VISIBILITY];

/**
 * Core file types that Obsidian supports natively
 * This is a fallback list in case we can't access the view registry
 */
const CORE_OBSIDIAN_EXTENSIONS = new Set([
    'md', // Markdown
    'canvas', // Obsidian Canvas
    'pdf' // PDF viewer
]);

/**
 * Common image extensions that can be displayed as feature images
 * Limited to formats with reliable cross-platform support
 */
export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

/**
 * Check if a file should be displayed based on the visibility setting
 */
export function shouldDisplayFile(file: TFile, visibility: FileVisibility, app: App): boolean {
    // Validate inputs
    if (!file || !file.extension) {
        return false;
    }

    switch (visibility) {
        case FILE_VISIBILITY.MARKDOWN:
            return file.extension === 'md';

        case FILE_VISIBILITY.SUPPORTED:
            // Get supported extensions inline
            const extensions = new Set<string>(CORE_OBSIDIAN_EXTENSIONS);

            try {
                // Try to get registered view types from Obsidian's view registry
                const extendedApp = app as ExtendedApp;

                if (extendedApp.viewRegistry?.typeByExtension) {
                    const typeByExtension = extendedApp.viewRegistry.typeByExtension;
                    if (typeByExtension && typeof typeByExtension === 'object') {
                        for (const ext of Object.keys(typeByExtension)) {
                            if (typeof ext === 'string') {
                                extensions.add(ext);
                            }
                        }
                    }
                }

                // Also check for registered extensions in the metadataTypeManager
                // This catches some additional file types that plugins might register
                if (extendedApp.metadataTypeManager?.registeredExtensions) {
                    const registeredExtensions = extendedApp.metadataTypeManager.registeredExtensions;
                    if (Array.isArray(registeredExtensions)) {
                        for (const ext of registeredExtensions) {
                            if (typeof ext === 'string') {
                                extensions.add(ext);
                            }
                        }
                    }
                }
            } catch (e) {
                // If we can't access internal APIs, just use the core extensions
            }

            return extensions.has(file.extension);

        case FILE_VISIBILITY.ALL:
            return true;

        default:
            // Default to markdown for safety
            return file.extension === 'md';
    }
}

/**
 * Check if a file is an image that can be displayed as a feature image
 */
export function isImageFile(file: TFile): boolean {
    if (!file || !file.extension) {
        return false;
    }
    return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}
