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

import { TFile, TFolder } from 'obsidian';
import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import type { FolderMetadata, TagMetadata, IconString } from '../types';
import type { NotebookNavigatorSettings } from '../../settings';

/**
 * Metadata API - Manage folder and tag appearance, icons, colors, and pinned files
 */
export class MetadataAPI {
    /**
     * Internal state cache for metadata
     */
    private metadataState = {
        // Folder metadata
        folderColors: {} as Record<string, string>,
        folderIcons: {} as Record<string, string>,

        // Tag metadata
        tagColors: {} as Record<string, string>,
        tagIcons: {} as Record<string, string>,

        // Pinned files
        pinnedNotes: [] as string[]
    };

    constructor(private api: NotebookNavigatorAPI) {
        this.initializeFromSettings();
    }

    /**
     * Initialize internal cache from plugin settings
     */
    private initializeFromSettings(): void {
        const plugin = this.api.getPlugin();
        if (plugin && plugin.settings) {
            this.updateFromSettings(plugin.settings);
        }
    }

    /**
     * Update internal cache when settings change
     * Called by the plugin when settings are modified
     * @internal
     */
    updateFromSettings(settings: NotebookNavigatorSettings): void {
        this.metadataState = {
            // Copy folder metadata
            folderColors: { ...settings.folderColors },
            folderIcons: { ...settings.folderIcons },

            // Copy tag metadata
            tagColors: { ...settings.tagColors },
            tagIcons: { ...settings.tagIcons },

            // Copy pinned files
            pinnedNotes: [...(settings.pinnedNotes || [])]
        };
    }

    // ===================================================================
    // Folder Metadata
    // ===================================================================

    /**
     * Get folder metadata
     * @param folder - Folder to get metadata for
     */
    getFolderMeta(folder: TFolder): FolderMetadata | null {
        const path = folder.path;
        const color = this.metadataState.folderColors[path];
        const icon = this.metadataState.folderIcons[path];

        if (!color && !icon) {
            return null;
        }

        return {
            color,
            icon: icon as IconString | undefined
        };
    }

    /**
     * Set folder metadata (color and/or icon)
     * @param folder - Folder to set metadata for
     * @param meta - Partial metadata object with properties to update
     */
    async setFolderMeta(folder: TFolder, meta: Partial<FolderMetadata>): Promise<void> {
        const path = folder.path;
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        let changed = false;

        // Update color if provided
        if (meta.color !== undefined) {
            if (meta.color === null) {
                // Clear color
                delete this.metadataState.folderColors[path];
                delete plugin.settings.folderColors[path];
            } else {
                // Set color
                this.metadataState.folderColors[path] = meta.color;
                plugin.settings.folderColors[path] = meta.color;
            }
            changed = true;
        }

        // Update icon if provided
        if (meta.icon !== undefined) {
            if (meta.icon === null) {
                // Clear icon
                delete this.metadataState.folderIcons[path];
                delete plugin.settings.folderIcons[path];
            } else {
                // Set icon
                this.metadataState.folderIcons[path] = meta.icon;
                plugin.settings.folderIcons[path] = meta.icon;
            }
            changed = true;
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettings();
        }
    }

    // ===================================================================
    // Tag Metadata
    // ===================================================================

    /**
     * Get tag metadata
     * @param tag - Tag string (e.g., '#work')
     */
    getTagMeta(tag: string): TagMetadata | null {
        // Ensure tag starts with #
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        const color = this.metadataState.tagColors[normalizedTag];
        const icon = this.metadataState.tagIcons[normalizedTag];

        if (!color && !icon) {
            return null;
        }

        return {
            color,
            icon: icon as IconString | undefined
        };
    }

    /**
     * Set tag metadata (color and/or icon)
     * @param tag - Tag string (e.g., '#work')
     * @param meta - Partial metadata object with properties to update
     */
    async setTagMeta(tag: string, meta: Partial<TagMetadata>): Promise<void> {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        let changed = false;

        // Update color if provided
        if (meta.color !== undefined) {
            if (meta.color === null) {
                // Clear color
                delete this.metadataState.tagColors[normalizedTag];
                delete plugin.settings.tagColors[normalizedTag];
            } else {
                // Set color
                this.metadataState.tagColors[normalizedTag] = meta.color;
                plugin.settings.tagColors[normalizedTag] = meta.color;
            }
            changed = true;
        }

        // Update icon if provided
        if (meta.icon !== undefined) {
            if (meta.icon === null) {
                // Clear icon
                delete this.metadataState.tagIcons[normalizedTag];
                delete plugin.settings.tagIcons[normalizedTag];
            } else {
                // Set icon
                this.metadataState.tagIcons[normalizedTag] = meta.icon;
                plugin.settings.tagIcons[normalizedTag] = meta.icon;
            }
            changed = true;
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettings();
        }
    }

    // ===================================================================
    // Pinned Files
    // ===================================================================

    /**
     * List all pinned files
     * @returns Array of TFile objects that are pinned
     */
    getPinned(): readonly TFile[] {
        return this.metadataState.pinnedNotes
            .map(path => this.api.app.vault.getFileByPath(path))
            .filter((file): file is TFile => file instanceof TFile);
    }

    /**
     * Check if a file is pinned
     * @param file - File to check
     */
    isPinned(file: TFile): boolean {
        return this.metadataState.pinnedNotes.includes(file.path);
    }

    /**
     * Pin a file
     * @param file - File to pin
     */
    async pin(file: TFile): Promise<void> {
        const plugin = this.api.getPlugin();

        // Ensure metadataService exists
        if (!plugin.metadataService) {
            throw new Error('Metadata service not available');
        }

        // Only pin if not already pinned
        if (!this.isPinned(file)) {
            await plugin.metadataService.togglePin(file.path);
        }
    }

    /**
     * Unpin a file
     * @param file - File to unpin
     */
    async unpin(file: TFile): Promise<void> {
        const plugin = this.api.getPlugin();

        // Ensure metadataService exists
        if (!plugin.metadataService) {
            throw new Error('Metadata service not available');
        }

        // Only unpin if currently pinned
        if (this.isPinned(file)) {
            await plugin.metadataService.togglePin(file.path);
        }
    }

    /**
     * Toggle pin status for a file
     * @param file - File to pin/unpin
     */
    async togglePin(file: TFile): Promise<void> {
        const plugin = this.api.getPlugin();

        // Ensure metadataService exists
        if (!plugin.metadataService) {
            throw new Error('Metadata service not available');
        }

        await plugin.metadataService.togglePin(file.path);
    }
}
