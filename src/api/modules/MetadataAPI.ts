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
import type { FolderMetadata, TagMetadata } from '../types';
import type { NotebookNavigatorSettings, SortOption } from '../../settings';
import type { FolderAppearance, TagAppearance } from '../../hooks/useListPaneAppearance';

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
        folderAppearances: {} as Record<string, FolderAppearance>,
        folderSortOverrides: {} as Record<string, SortOption>,

        // Tag metadata
        tagColors: {} as Record<string, string>,
        tagIcons: {} as Record<string, string>,
        tagAppearances: {} as Record<string, TagAppearance>,
        tagSortOverrides: {} as Record<string, SortOption>,
        favoriteTags: [] as string[],
        hiddenTags: [] as string[],

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
            folderAppearances: { ...settings.folderAppearances },
            folderSortOverrides: { ...settings.folderSortOverrides },

            // Copy tag metadata
            tagColors: { ...settings.tagColors },
            tagIcons: { ...settings.tagIcons },
            tagAppearances: { ...settings.tagAppearances },
            tagSortOverrides: { ...settings.tagSortOverrides },
            favoriteTags: [...(settings.favoriteTags || [])],
            hiddenTags: [...(settings.hiddenTags || [])],

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
    getFolderMetadata(folder: TFolder): FolderMetadata {
        const path = folder.path;
        return {
            color: this.metadataState.folderColors[path],
            icon: this.metadataState.folderIcons[path],
            appearance: this.metadataState.folderAppearances[path]
        };
    }

    /**
     * Set folder color
     * @param folder - Folder to set color for
     * @param color - Hex color string or null to remove
     */
    async setFolderColor(folder: TFolder, color: string | null): Promise<void> {
        const path = folder.path;

        // Update internal cache
        if (color) {
            this.metadataState.folderColors[path] = color;
        } else {
            delete this.metadataState.folderColors[path];
        }

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            if (color) {
                plugin.settings.folderColors[path] = color;
            } else {
                delete plugin.settings.folderColors[path];
            }
            await plugin.saveSettings();
        }
    }

    /**
     * Set folder icon
     * @param folder - Folder to set icon for
     * @param icon - Icon identifier (e.g., 'lucide:folder', 'emoji:📁') or null to remove
     */
    async setFolderIcon(folder: TFolder, icon: string | null): Promise<void> {
        const path = folder.path;

        // Update internal cache
        if (icon) {
            this.metadataState.folderIcons[path] = icon;
        } else {
            delete this.metadataState.folderIcons[path];
        }

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            if (icon) {
                plugin.settings.folderIcons[path] = icon;
            } else {
                delete plugin.settings.folderIcons[path];
            }
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
    getTagMetadata(tag: string): TagMetadata | null {
        // Ensure tag starts with #
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        return {
            color: this.metadataState.tagColors[normalizedTag],
            icon: this.metadataState.tagIcons[normalizedTag],
            appearance: this.metadataState.tagAppearances[normalizedTag],
            isFavorite: this.metadataState.favoriteTags.includes(normalizedTag)
        };
    }

    /**
     * Set tag color
     * @param tag - Tag string (e.g., '#work')
     * @param color - Hex color string or null to remove
     */
    async setTagColor(tag: string, color: string | null): Promise<void> {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        // Update internal cache
        if (color) {
            this.metadataState.tagColors[normalizedTag] = color;
        } else {
            delete this.metadataState.tagColors[normalizedTag];
        }

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            if (color) {
                plugin.settings.tagColors[normalizedTag] = color;
            } else {
                delete plugin.settings.tagColors[normalizedTag];
            }
            await plugin.saveSettings();
        }
    }

    /**
     * Set tag icon
     * @param tag - Tag string (e.g., '#work')
     * @param icon - Icon identifier or null to remove
     */
    async setTagIcon(tag: string, icon: string | null): Promise<void> {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        // Update internal cache
        if (icon) {
            this.metadataState.tagIcons[normalizedTag] = icon;
        } else {
            delete this.metadataState.tagIcons[normalizedTag];
        }

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            if (icon) {
                plugin.settings.tagIcons[normalizedTag] = icon;
            } else {
                delete plugin.settings.tagIcons[normalizedTag];
            }
            await plugin.saveSettings();
        }
    }

    // ===================================================================
    // Pinned Files
    // ===================================================================

    /**
     * Get all pinned files
     * @returns Array of TFile objects that are pinned
     */
    getPinnedFiles(): TFile[] {
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
