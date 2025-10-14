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

import { App, TFile, CachedMetadata } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { METADATA_SENTINEL } from '../storage/IndexedDBStorage';
import { DateUtils } from './dateUtils';
import { convertIconizeToIconId } from './iconizeFormat';
import { extractFirstEmoji } from './emojiUtils';

/**
 * Processed metadata from frontmatter
 */
export interface ProcessedMetadata {
    fn?: string; // frontmatter name
    fc?: number; // frontmatter created timestamp
    fm?: number; // frontmatter modified timestamp
    icon?: string; // frontmatter icon
    color?: string; // frontmatter color
}

/**
 * Extract metadata from a file using the metadata cache
 * @param app - The Obsidian app instance
 * @param file - The file to extract metadata from
 * @param settings - Current plugin settings
 * @returns Processed metadata object
 */
export function extractMetadata(app: App, file: TFile, settings: NotebookNavigatorSettings): ProcessedMetadata {
    const metadata = app.metadataCache.getFileCache(file);
    return extractMetadataFromCache(metadata, settings);
}

/**
 * Extract metadata from cached metadata
 * @param metadata - Cached metadata from Obsidian
 * @param settings - Current plugin settings
 * @returns Processed metadata object
 */
export function extractMetadataFromCache(metadata: CachedMetadata | null, settings: NotebookNavigatorSettings): ProcessedMetadata {
    const frontmatter = metadata?.frontmatter;

    if (!frontmatter || !settings.useFrontmatterMetadata) {
        return {};
    }

    const result: ProcessedMetadata = {};

    // Extract name if field is specified
    if (settings.frontmatterNameField && settings.frontmatterNameField.trim()) {
        const nameValue = frontmatter[settings.frontmatterNameField];

        if (typeof nameValue === 'string') {
            const trimmedName = nameValue.trim();
            if (trimmedName) {
                result.fn = trimmedName;
            }
        } else if (Array.isArray(nameValue)) {
            const firstValue = nameValue[0];
            if (typeof firstValue === 'string') {
                const trimmedName = firstValue.trim();
                if (trimmedName) {
                    result.fn = trimmedName;
                }
            }
        }
    } else {
        // Field is empty, don't set name field (leave undefined)
        result.fn = undefined;
    }

    // Extract icon if field is specified
    // Extract icon from frontmatter field
    if (settings.frontmatterIconField && settings.frontmatterIconField.trim()) {
        const iconValue = frontmatter[settings.frontmatterIconField];

        // Helper to extract and convert icon value from Iconize format to canonical format
        const extractIconValue = (value: unknown): string | undefined => {
            if (typeof value !== 'string') {
                return undefined;
            }
            const trimmed = value.trim();
            if (!trimmed) {
                return undefined;
            }
            // Convert from Iconize format (e.g. LiHome) to canonical format (e.g. home)
            const converted = convertIconizeToIconId(trimmed);
            if (converted) {
                return converted;
            }

            // Normalize plain emoji values (🔭 -> emoji:🔭)
            const emojiOnly = extractFirstEmoji(trimmed);
            if (emojiOnly && emojiOnly === trimmed) {
                return `emoji:${emojiOnly}`;
            }

            return trimmed;
        };

        if (typeof iconValue === 'string') {
            const normalizedIcon = extractIconValue(iconValue);
            if (normalizedIcon) {
                result.icon = normalizedIcon;
            }
        } else if (Array.isArray(iconValue)) {
            // Handle array values - use first valid icon
            for (const entry of iconValue) {
                const normalizedIcon = extractIconValue(entry);
                if (normalizedIcon) {
                    result.icon = normalizedIcon;
                    break;
                }
            }
        }
    }

    // Extract color if field is specified
    if (settings.frontmatterColorField && settings.frontmatterColorField.trim()) {
        const colorValue = frontmatter[settings.frontmatterColorField];

        if (typeof colorValue === 'string') {
            const trimmedColor = colorValue.trim();
            if (trimmedColor) {
                result.color = trimmedColor;
            }
        } else if (Array.isArray(colorValue)) {
            const firstValue = colorValue[0];
            if (typeof firstValue === 'string') {
                const trimmedColor = firstValue.trim();
                if (trimmedColor) {
                    result.color = trimmedColor;
                }
            }
        }
    }

    // Extract created date if field is specified
    if (settings.frontmatterCreatedField && settings.frontmatterCreatedField.trim()) {
        const createdValue = frontmatter[settings.frontmatterCreatedField];

        if (createdValue !== undefined) {
            // Field exists, try to parse it
            const createdTimestamp = DateUtils.parseFrontmatterDate(createdValue, settings.frontmatterDateFormat);
            if (createdTimestamp !== undefined) {
                result.fc = createdTimestamp;
            } else {
                // Parsing failed, use sentinel value
                result.fc = METADATA_SENTINEL.PARSE_FAILED;
            }
        }
    } else {
        // Field is empty, use sentinel value to clear the metadata
        result.fc = METADATA_SENTINEL.FIELD_NOT_CONFIGURED;
    }

    // Extract modified date if field is specified
    if (settings.frontmatterModifiedField && settings.frontmatterModifiedField.trim()) {
        const modifiedValue = frontmatter[settings.frontmatterModifiedField];

        if (modifiedValue !== undefined) {
            // Field exists, try to parse it
            const modifiedTimestamp = DateUtils.parseFrontmatterDate(modifiedValue, settings.frontmatterDateFormat);
            if (modifiedTimestamp !== undefined) {
                result.fm = modifiedTimestamp;
            } else {
                // Parsing failed, use sentinel value
                result.fm = METADATA_SENTINEL.PARSE_FAILED;
            }
        }
    } else {
        // Field is empty, use sentinel value to clear the metadata
        result.fm = METADATA_SENTINEL.FIELD_NOT_CONFIGURED;
    }

    return result;
}
