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
     * @param color - Hex color string
     */
    async setFolderColor(folder: TFolder, color: string): Promise<void> {
        const path = folder.path;

        // Update internal cache
        this.metadataState.folderColors[path] = color;

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            plugin.settings.folderColors[path] = color;
            await plugin.saveSettings();
        }
    }

    /**
     * Clear folder color
     * @param folder - Folder to clear color from
     */
    async clearFolderColor(folder: TFolder): Promise<void> {
        const path = folder.path;

        // Update internal cache
        delete this.metadataState.folderColors[path];

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            delete plugin.settings.folderColors[path];
            await plugin.saveSettings();
        }
    }

    /**
     * Set folder icon
     * @param folder - Folder to set icon for
     * @param icon - Icon identifier (e.g., 'lucide:folder', 'emoji:📁')
     */
    async setFolderIcon(folder: TFolder, icon: string): Promise<void> {
        const path = folder.path;

        // Update internal cache
        this.metadataState.folderIcons[path] = icon;

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            plugin.settings.folderIcons[path] = icon;
            await plugin.saveSettings();
        }
    }

    /**
     * Clear folder icon
     * @param folder - Folder to clear icon from
     */
    async clearFolderIcon(folder: TFolder): Promise<void> {
        const path = folder.path;

        // Update internal cache
        delete this.metadataState.folderIcons[path];

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            delete plugin.settings.folderIcons[path];
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
     * @param color - Hex color string
     */
    async setTagColor(tag: string, color: string): Promise<void> {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        // Update internal cache
        this.metadataState.tagColors[normalizedTag] = color;

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            plugin.settings.tagColors[normalizedTag] = color;
            await plugin.saveSettings();
        }
    }

    /**
     * Clear tag color
     * @param tag - Tag string (e.g., '#work')
     */
    async clearTagColor(tag: string): Promise<void> {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        // Update internal cache
        delete this.metadataState.tagColors[normalizedTag];

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            delete plugin.settings.tagColors[normalizedTag];
            await plugin.saveSettings();
        }
    }

    /**
     * Set tag icon
     * @param tag - Tag string (e.g., '#work')
     * @param icon - Icon identifier
     */
    async setTagIcon(tag: string, icon: string): Promise<void> {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        // Update internal cache
        this.metadataState.tagIcons[normalizedTag] = icon;

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            plugin.settings.tagIcons[normalizedTag] = icon;
            await plugin.saveSettings();
        }
    }

    /**
     * Clear tag icon
     * @param tag - Tag string (e.g., '#work')
     */
    async clearTagIcon(tag: string): Promise<void> {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        // Update internal cache
        delete this.metadataState.tagIcons[normalizedTag];

        // Update plugin settings
        const plugin = this.api.getPlugin();
        if (plugin) {
            delete plugin.settings.tagIcons[normalizedTag];
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
    listPinnedFiles(): TFile[] {
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
