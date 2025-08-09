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

import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import type { FolderMetadata, TagMetadata } from '../types';
import type { SortOption } from '../../settings';

/**
 * Metadata API - Manage folder and tag metadata
 */
export class MetadataAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Get folder metadata
     */
    getFolderMetadata(folderPath: string): FolderMetadata {
        const plugin = this.api.getPlugin();
        const settings = plugin.settings;

        return {
            path: folderPath,
            color: settings.folderColors[folderPath],
            icon: settings.folderIcons[folderPath],
            sortOverride: settings.folderSortOverrides[folderPath],
            appearance: settings.folderAppearances[folderPath],
            pinnedNotes: settings.pinnedNotes
        };
    }

    /**
     * Set folder color
     */
    async setFolderColor(folderPath: string, color: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return;

        if (color === null) {
            await plugin.metadataService.removeFolderColor(folderPath);
        } else {
            await plugin.metadataService.setFolderColor(folderPath, color);
        }
        this.api.trigger('metadata-changed', { type: 'folder', path: folderPath });
    }

    /**
     * Set folder icon
     */
    async setFolderIcon(folderPath: string, iconId: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return;

        if (iconId === null) {
            await plugin.metadataService.removeFolderIcon(folderPath);
        } else {
            await plugin.metadataService.setFolderIcon(folderPath, iconId);
        }
        this.api.trigger('metadata-changed', { type: 'folder', path: folderPath });
    }

    /**
     * Set folder sort override
     */
    async setFolderSortOverride(folderPath: string, sortOption: SortOption | null): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return;

        if (sortOption === null) {
            await plugin.metadataService.removeFolderSortOverride(folderPath);
        } else {
            await plugin.metadataService.setFolderSortOverride(folderPath, sortOption);
        }
        this.api.trigger('metadata-changed', { type: 'folder', path: folderPath });
    }

    /**
     * Get tag metadata
     */
    getTagMetadata(tagPath: string): TagMetadata {
        const plugin = this.api.getPlugin();
        const settings = plugin.settings;

        return {
            path: tagPath,
            color: settings.tagColors[tagPath],
            icon: settings.tagIcons[tagPath],
            sortOverride: settings.tagSortOverrides[tagPath],
            appearance: settings.tagAppearances[tagPath],
            isFavorite: settings.favoriteTags.includes(tagPath)
        };
    }

    /**
     * Set tag color
     */
    async setTagColor(tagPath: string, color: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return;

        if (color === null) {
            await plugin.metadataService.removeTagColor(tagPath);
        } else {
            await plugin.metadataService.setTagColor(tagPath, color);
        }
        this.api.trigger('metadata-changed', { type: 'tag', path: tagPath });
    }

    /**
     * Set tag icon
     */
    async setTagIcon(tagPath: string, iconId: string | null): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return;

        if (iconId === null) {
            await plugin.metadataService.removeTagIcon(tagPath);
        } else {
            await plugin.metadataService.setTagIcon(tagPath, iconId);
        }
        this.api.trigger('metadata-changed', { type: 'tag', path: tagPath });
    }

    /**
     * Toggle pin status for a file
     * Pinned files appear at the top of lists in both folder and tag views
     */
    async togglePin(filePath: string): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return;

        await plugin.metadataService.togglePin(filePath);
        this.api.trigger('metadata-changed', { type: 'file', path: filePath });
    }

    /**
     * Check if a file is pinned
     */
    isPinned(filePath: string): boolean {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return false;

        return plugin.metadataService.isFilePinned(filePath);
    }

    /**
     * Get all pinned file paths
     */
    getPinnedFiles(): string[] {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) return [];

        return plugin.metadataService.getPinnedNotes();
    }
}
