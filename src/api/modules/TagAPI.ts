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

import { TFile } from 'obsidian';
import type { NotebookNavigatorAPI } from '../NotebookNavigatorAPI';
import type { BatchOperationResult } from '../types';
import type { TagTreeNode } from '../../types/storage';

/**
 * Tag API - Query and manage tags
 */
export class TagAPI {
    constructor(private api: NotebookNavigatorAPI) {}

    /**
     * Get the complete tag tree
     */
    getTagTree(): Map<string, TagTreeNode> {
        const plugin = this.api.getPlugin();
        if (!plugin.tagTreeService) return new Map();

        return plugin.tagTreeService.getTagTree();
    }

    /**
     * Find a specific tag node
     */
    findTagNode(tagPath: string): TagTreeNode | null {
        const plugin = this.api.getPlugin();
        if (!plugin.tagTreeService) return null;

        return plugin.tagTreeService.findTagNode(tagPath);
    }

    /**
     * Get all tag paths
     */
    getAllTagPaths(): string[] {
        const plugin = this.api.getPlugin();
        if (!plugin.tagTreeService) return [];

        return plugin.tagTreeService.getAllTagPaths();
    }

    /**
     * Get files with a specific tag
     */
    async getFilesWithTag(tagPath: string): Promise<TFile[]> {
        const tagNode = this.findTagNode(tagPath);
        if (!tagNode) return [];

        const files: TFile[] = [];
        for (const filePath of tagNode.notesWithTag) {
            const file = this.api.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                files.push(file);
            }
        }

        return files;
    }

    /**
     * Get count of untagged files
     */
    getUntaggedCount(): number {
        const plugin = this.api.getPlugin();
        if (!plugin.tagTreeService) return 0;

        return plugin.tagTreeService.getUntaggedCount();
    }

    /**
     * Add tag to files
     */
    async addTagToFiles(tag: string, filePaths: string[]): Promise<BatchOperationResult> {
        const plugin = this.api.getPlugin();
        if (!plugin.tagOperations) {
            return { success: 0, failed: filePaths.length, errors: [] };
        }

        const files: TFile[] = [];
        const errors: Array<{ path: string; error: string }> = [];

        for (const path of filePaths) {
            const file = this.api.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                files.push(file);
            } else {
                errors.push({ path, error: 'File not found' });
            }
        }

        const result = await plugin.tagOperations.addTagToFiles(tag, files);

        return {
            success: result.added,
            failed: result.skipped + errors.length,
            errors
        };
    }

    /**
     * Remove tag from files
     */
    async removeTagFromFiles(tag: string, filePaths: string[]): Promise<BatchOperationResult> {
        const plugin = this.api.getPlugin();
        if (!plugin.tagOperations) {
            return { success: 0, failed: filePaths.length, errors: [] };
        }

        const files: TFile[] = [];
        const errors: Array<{ path: string; error: string }> = [];

        for (const path of filePaths) {
            const file = this.api.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                files.push(file);
            } else {
                errors.push({ path, error: 'File not found' });
            }
        }

        const removed = await plugin.tagOperations.removeTagFromFiles(tag, files);

        return {
            success: removed,
            failed: files.length - removed + errors.length,
            errors
        };
    }

    /**
     * Toggle favorite status for a tag
     */
    async toggleFavoriteTag(tagPath: string): Promise<void> {
        const plugin = this.api.getPlugin();
        const settings = plugin.settings;

        const index = settings.favoriteTags.indexOf(tagPath);
        if (index === -1) {
            settings.favoriteTags.push(tagPath);
        } else {
            settings.favoriteTags.splice(index, 1);
        }

        await plugin.saveSettings();
        this.api.trigger('metadata-changed', { type: 'tag', path: tagPath });
    }

    /**
     * Get favorite tags
     */
    getFavoriteTags(): string[] {
        const plugin = this.api.getPlugin();
        return [...plugin.settings.favoriteTags];
    }
}
