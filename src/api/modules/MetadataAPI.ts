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

/**
 * Metadata API - Manage folder and tag appearance, icons, colors, and pinned files
 */
export class MetadataAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    // ===================================================================
    // Folder Metadata
    // ===================================================================

    /**
     * Get folder metadata
     * @param folder - Folder to get metadata for
     */
    getFolderMetadata(folder: TFolder): FolderMetadata {
        const plugin = this.api.getPlugin();
        const settings = plugin.settings;
        const path = folder.path;

        return {
            color: settings.folderColors[path],
            icon: settings.folderIcons[path],
            appearance: settings.folderAppearances[path]
        };
    }

    /**
     * Set folder color
     * @param folder - Folder to set color for
     * @param color - Hex color string or null to remove
     */
    async setFolderColor(folder: TFolder, color: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        if (color) {
            plugin.settings.folderColors[folder.path] = color;
        } else {
            delete plugin.settings.folderColors[folder.path];
        }
        await plugin.saveSettings();
    }

    /**
     * Set folder icon
     * @param folder - Folder to set icon for
     * @param icon - Icon identifier (e.g., 'lucide:folder', 'emoji:📁') or null to remove
     */
    async setFolderIcon(folder: TFolder, icon: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        if (icon) {
            plugin.settings.folderIcons[folder.path] = icon;
        } else {
            delete plugin.settings.folderIcons[folder.path];
        }
        await plugin.saveSettings();
    }

    // ===================================================================
    // Tag Metadata
    // ===================================================================

    /**
     * Get tag metadata
     * @param tag - Tag string (e.g., '#work')
     */
    getTagMetadata(tag: string): TagMetadata | null {
        const plugin = this.api.getPlugin();
        const settings = plugin.settings;

        // Ensure tag starts with #
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        return {
            color: settings.tagColors[normalizedTag],
            icon: settings.tagIcons[normalizedTag],
            appearance: settings.tagAppearances[normalizedTag],
            isFavorite: settings.favoriteTags?.includes(normalizedTag)
        };
    }

    /**
     * Set tag color
     * @param tag - Tag string (e.g., '#work')
     * @param color - Hex color string or null to remove
     */
    async setTagColor(tag: string, color: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        if (color) {
            plugin.settings.tagColors[normalizedTag] = color;
        } else {
            delete plugin.settings.tagColors[normalizedTag];
        }
        await plugin.saveSettings();
    }

    /**
     * Set tag icon
     * @param tag - Tag string (e.g., '#work')
     * @param icon - Icon identifier or null to remove
     */
    async setTagIcon(tag: string, icon: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

        if (icon) {
            plugin.settings.tagIcons[normalizedTag] = icon;
        } else {
            delete plugin.settings.tagIcons[normalizedTag];
        }
        await plugin.saveSettings();
    }

    // ===================================================================
    // Pinned Files
    // ===================================================================

    /**
     * Get all pinned files
     * @returns Array of TFile objects that are pinned
     */
    getPinnedFiles(): TFile[] {
        const plugin = this.api.getPlugin();
        const pinnedPaths = plugin.settings.pinnedNotes || [];

        return pinnedPaths.map(path => this.api.app.vault.getFileByPath(path)).filter((file): file is TFile => file !== null);
    }

    /**
     * Check if a file is pinned
     * @param file - File to check
     */
    isPinned(file: TFile): boolean {
        const plugin = this.api.getPlugin();
        const pinnedPaths = plugin.settings.pinnedNotes || [];
        return pinnedPaths.includes(file.path);
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
