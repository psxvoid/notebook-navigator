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

import { App } from 'obsidian';
import { NotebookNavigatorSettings, SortOption } from '../../settings';
import { ItemType } from '../../types';
import { ISettingsProvider } from '../../interfaces/ISettingsProvider';
import { FolderAppearance, TagAppearance } from '../../hooks/useListPaneAppearance';

/**
 * Type helper for metadata fields in settings
 * All metadata fields are Record<string, T> objects
 */
type MetadataFields = {
    folderIcons: Record<string, string>;
    folderColors: Record<string, string>;
    folderSortOverrides: Record<string, SortOption>;
    folderAppearances: Record<string, FolderAppearance>;
    tagColors: Record<string, string>;
    tagIcons: Record<string, string>;
    tagSortOverrides: Record<string, SortOption>;
    tagAppearances: Record<string, TagAppearance>;
};

type MetadataKey = keyof MetadataFields;

/**
 * Type for entity that can have metadata (folder or tag)
 */
export type EntityType = typeof ItemType.FOLDER | typeof ItemType.TAG;

/**
 * Base class for metadata services
 * Provides shared functionality for managing colors, icons, and sort overrides
 */
export abstract class BaseMetadataService {
    protected updateQueue: Promise<void> = Promise.resolve();

    constructor(
        protected app: App,
        protected settingsProvider: ISettingsProvider
    ) {}

    /**
     * Saves settings and triggers UI update
     * Uses a queue to serialize updates and prevent race conditions
     */
    protected async saveAndUpdate(updater: (settings: NotebookNavigatorSettings) => void): Promise<void> {
        // Queue this update to run after any pending updates
        this.updateQueue = this.updateQueue
            .then(async () => {
                // Update settings
                updater(this.settingsProvider.settings);
                // Save settings
                await this.settingsProvider.saveSettings();
            })
            .catch(error => {
                // Log error but don't break the queue for subsequent updates
                console.error('Failed to save metadata:', error);
                // Re-throw to propagate to caller
                throw error;
            });

        return this.updateQueue;
    }

    /**
     * Validates CSS color format (hex, rgb, rgba, hsl, hsla, named colors)
     */
    protected validateColor(color: string): boolean {
        // Basic validation for common CSS color formats
        // Accepts: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba(), hsl(), hsla(), named colors
        const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-zA-Z]+)$/;
        return colorRegex.test(color);
    }

    // ========== Generic Color Management ==========

    /**
     * Sets a custom color for an entity (folder or tag)
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @param color - CSS color value
     */
    protected async setEntityColor(entityType: EntityType, path: string, color: string): Promise<void> {
        // Validate color format
        if (!this.validateColor(color)) {
            return;
        }

        await this.saveAndUpdate(settings => {
            if (entityType === ItemType.FOLDER) {
                if (!settings.folderColors) {
                    settings.folderColors = {};
                }
                settings.folderColors[path] = color;
            } else {
                if (!settings.tagColors) {
                    settings.tagColors = {};
                }
                settings.tagColors[path] = color;
            }
        });
    }

    /**
     * Removes the custom color from an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     */
    protected async removeEntityColor(entityType: EntityType, path: string): Promise<void> {
        if (entityType === ItemType.FOLDER && this.settingsProvider.settings.folderColors?.[path]) {
            await this.saveAndUpdate(settings => {
                if (settings.folderColors) {
                    delete settings.folderColors[path];
                }
            });
        } else if (entityType === ItemType.TAG && this.settingsProvider.settings.tagColors?.[path]) {
            await this.saveAndUpdate(settings => {
                if (settings.tagColors) {
                    delete settings.tagColors[path];
                }
            });
        }
    }

    /**
     * Gets the custom color for an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @returns The color value or undefined
     */
    protected getEntityColor(entityType: EntityType, path: string): string | undefined {
        if (entityType === ItemType.FOLDER) {
            return this.settingsProvider.settings.folderColors?.[path];
        } else {
            return this.settingsProvider.settings.tagColors?.[path];
        }
    }

    // ========== Generic Icon Management ==========

    /**
     * Sets a custom icon for an entity (folder or tag)
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @param iconId - Lucide icon identifier
     */
    protected async setEntityIcon(entityType: EntityType, path: string, iconId: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (entityType === ItemType.FOLDER) {
                if (!settings.folderIcons) {
                    settings.folderIcons = {};
                }
                settings.folderIcons[path] = iconId;
            } else {
                if (!settings.tagIcons) {
                    settings.tagIcons = {};
                }
                settings.tagIcons[path] = iconId;
            }

            // Update recently used icons
            if (!settings.recentIcons) {
                settings.recentIcons = [];
            }

            // Remove if already exists and add to front
            settings.recentIcons = [iconId, ...settings.recentIcons.filter((id: string) => id !== iconId)].slice(0, 10); // Keep only 10 most recent
        });
    }

    /**
     * Removes the custom icon from an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     */
    protected async removeEntityIcon(entityType: EntityType, path: string): Promise<void> {
        if (entityType === ItemType.FOLDER && this.settingsProvider.settings.folderIcons?.[path]) {
            await this.saveAndUpdate(settings => {
                if (settings.folderIcons) {
                    delete settings.folderIcons[path];
                }
            });
        } else if (entityType === ItemType.TAG && this.settingsProvider.settings.tagIcons?.[path]) {
            await this.saveAndUpdate(settings => {
                if (settings.tagIcons) {
                    delete settings.tagIcons[path];
                }
            });
        }
    }

    /**
     * Gets the custom icon for an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @returns The icon ID or undefined
     */
    protected getEntityIcon(entityType: EntityType, path: string): string | undefined {
        if (entityType === ItemType.FOLDER) {
            return this.settingsProvider.settings.folderIcons?.[path];
        } else {
            return this.settingsProvider.settings.tagIcons?.[path];
        }
    }

    // ========== Generic Sort Override Management ==========

    /**
     * Sets a custom sort order for an entity (folder or tag)
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @param sortOption - Sort option to apply
     */
    protected async setEntitySortOverride(entityType: EntityType, path: string, sortOption: SortOption): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (entityType === ItemType.FOLDER) {
                if (!settings.folderSortOverrides) {
                    settings.folderSortOverrides = {};
                }
                settings.folderSortOverrides[path] = sortOption;
            } else {
                if (!settings.tagSortOverrides) {
                    settings.tagSortOverrides = {};
                }
                settings.tagSortOverrides[path] = sortOption;
            }
        });
    }

    /**
     * Removes the custom sort order from an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     */
    protected async removeEntitySortOverride(entityType: EntityType, path: string): Promise<void> {
        if (entityType === ItemType.FOLDER && this.settingsProvider.settings.folderSortOverrides?.[path]) {
            await this.saveAndUpdate(settings => {
                if (settings.folderSortOverrides) {
                    delete settings.folderSortOverrides[path];
                }
            });
        } else if (entityType === ItemType.TAG && this.settingsProvider.settings.tagSortOverrides?.[path]) {
            await this.saveAndUpdate(settings => {
                if (settings.tagSortOverrides) {
                    delete settings.tagSortOverrides[path];
                }
            });
        }
    }

    /**
     * Gets the sort override for an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     * @returns The sort option or undefined
     */
    protected getEntitySortOverride(entityType: EntityType, path: string): SortOption | undefined {
        if (entityType === ItemType.FOLDER) {
            return this.settingsProvider.settings.folderSortOverrides?.[path];
        } else {
            return this.settingsProvider.settings.tagSortOverrides?.[path];
        }
    }

    // ========== Generic Metadata Cleanup Utilities ==========

    /**
     * Generic cleanup for metadata objects
     * Removes entries that fail validation
     */
    protected async cleanupMetadata<K extends MetadataKey>(
        settings: NotebookNavigatorSettings,
        metadataKey: K,
        validator: (path: string) => boolean
    ): Promise<boolean> {
        // Since we only need to delete properties, we can treat the metadata
        // as a generic object without caring about the specific value type
        const metadata = settings[metadataKey];

        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
            return false;
        }

        let hasChanges = false;
        // We know metadata is an object with string keys
        const metadataObj = metadata as Record<string, unknown>;

        for (const path in metadataObj) {
            if (!validator(path)) {
                delete metadataObj[path];
                hasChanges = true;
            }
        }
        return hasChanges;
    }

    /**
     * Updates nested paths when a parent is renamed
     * Handles both direct matches and nested children
     */
    protected updateNestedPaths<T>(metadata: Record<string, T> | undefined, oldPath: string, newPath: string): boolean {
        if (!metadata) return false;

        const oldPrefix = oldPath + '/';
        const updates: Array<{ oldPath: string; newPath: string; value: T }> = [];

        // First, handle direct path match
        if (oldPath in metadata) {
            updates.push({
                oldPath: oldPath,
                newPath: newPath,
                value: metadata[oldPath]
            });
        }

        // Then handle nested paths
        for (const path in metadata) {
            if (path.startsWith(oldPrefix)) {
                const newNestedPath = newPath + '/' + path.slice(oldPrefix.length);
                updates.push({
                    oldPath: path,
                    newPath: newNestedPath,
                    value: metadata[path]
                });
            }
        }

        // Apply all updates
        for (const update of updates) {
            metadata[update.newPath] = update.value;
            delete metadata[update.oldPath];
        }

        return updates.length > 0;
    }

    /**
     * Deletes nested paths when a parent is deleted
     * Removes both the exact match and all children
     */
    protected deleteNestedPaths<T>(metadata: Record<string, T> | undefined, pathPrefix: string): boolean {
        if (!metadata) return false;

        let hasChanges = false;
        for (const path in metadata) {
            if (path === pathPrefix || path.startsWith(pathPrefix + '/')) {
                delete metadata[path];
                hasChanges = true;
            }
        }
        return hasChanges;
    }
}
