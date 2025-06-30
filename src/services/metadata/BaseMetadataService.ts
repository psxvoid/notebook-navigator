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

import { NotebookNavigatorSettings, SortOption } from '../../settings';
import { ItemType } from '../../types';

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
        protected app: any,
        protected settings: NotebookNavigatorSettings,
        protected updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>
    ) {}
    
    /**
     * Saves settings and triggers UI update
     * Uses a queue to serialize updates and prevent race conditions
     */
    protected async saveAndUpdate(updater: (settings: NotebookNavigatorSettings) => void): Promise<void> {
        // Queue this update to run after any pending updates
        this.updateQueue = this.updateQueue.then(async () => {
            try {
                await this.updateSettings(updater);
            } catch (error) {
                // Failed to save settings, re-throw to propagate
                throw error;
            }
        });
        
        return this.updateQueue;
    }

    /**
     * Validates a CSS color format
     */
    protected validateColor(color: string): boolean {
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
        if (entityType === ItemType.FOLDER && this.settings.folderColors?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderColors![path];
            });
        } else if (entityType === ItemType.TAG && this.settings.tagColors?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.tagColors![path];
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
            return this.settings.folderColors?.[path];
        } else {
            return this.settings.tagColors?.[path];
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
            if (!settings.recentlyUsedIcons) {
                settings.recentlyUsedIcons = [];
            }
            
            // Remove if already exists and add to front
            settings.recentlyUsedIcons = [
                iconId,
                ...settings.recentlyUsedIcons.filter((id: string) => id !== iconId)
            ].slice(0, 10); // Keep only 10 most recent
        });
    }

    /**
     * Removes the custom icon from an entity
     * @param entityType - Type of entity ('folder' or 'tag')
     * @param path - Path of the entity
     */
    protected async removeEntityIcon(entityType: EntityType, path: string): Promise<void> {
        if (entityType === ItemType.FOLDER && this.settings.folderIcons?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderIcons![path];
            });
        } else if (entityType === ItemType.TAG && this.settings.tagIcons?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.tagIcons![path];
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
            return this.settings.folderIcons?.[path];
        } else {
            return this.settings.tagIcons?.[path];
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
        if (entityType === ItemType.FOLDER && this.settings.folderSortOverrides?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.folderSortOverrides![path];
            });
        } else if (entityType === ItemType.TAG && this.settings.tagSortOverrides?.[path]) {
            await this.saveAndUpdate(settings => {
                delete settings.tagSortOverrides![path];
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
            return this.settings.folderSortOverrides?.[path];
        } else {
            return this.settings.tagSortOverrides?.[path];
        }
    }
}