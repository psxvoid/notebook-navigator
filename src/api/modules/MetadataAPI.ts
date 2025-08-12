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
import type { FolderMetadata, TagMetadata, IconString, PinContext, PinnedFile } from '../types';
import type { NotebookNavigatorSettings } from '../../settings';
import { ItemType, PinnedNote } from '../../types';

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
        pinnedNotes: [] as PinnedNote[]
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
     * Helper to convert API context to internal ItemType constants
     */
    private toInternalContext(context: PinContext): typeof ItemType.FOLDER | typeof ItemType.TAG {
        return context === 'tag' ? ItemType.TAG : ItemType.FOLDER;
    }

    /**
     * Check if a file is pinned
     * @param file - File to check
     * @param context - Context to check (if not specified, returns true if pinned in any context)
     */
    isPinned(file: TFile, context?: PinContext): boolean {
        const pinnedNote = this.metadataState.pinnedNotes.find(p => p.path === file.path);

        if (!pinnedNote) {
            return false;
        }

        if (!context) {
            // No context - check if pinned in any context
            return pinnedNote.context[ItemType.FOLDER] || pinnedNote.context[ItemType.TAG] || false;
        } else if (context === 'all') {
            // Check if pinned in both contexts
            return (pinnedNote.context[ItemType.FOLDER] || false) && (pinnedNote.context[ItemType.TAG] || false);
        } else {
            // Check specific context
            const internalContext = this.toInternalContext(context);
            return pinnedNote.context[internalContext] || false;
        }
    }

    /**
     * Pin a file
     * @param file - File to pin
     * @param context - Context to pin in (defaults to 'all')
     */
    async pin(file: TFile, context: PinContext = 'all'): Promise<void> {
        const plugin = this.api.getPlugin();

        // Ensure metadataService exists
        if (!plugin.metadataService) {
            throw new Error('Metadata service not available');
        }

        let changed = false;

        // Find or create pinned note entry
        let pinnedNote = this.metadataState.pinnedNotes.find(p => p.path === file.path);
        if (!pinnedNote) {
            pinnedNote = {
                path: file.path,
                context: {
                    [ItemType.FOLDER]: false,
                    [ItemType.TAG]: false
                }
            };
            this.metadataState.pinnedNotes.push(pinnedNote);
        }

        if (context === 'all') {
            // Pin in both contexts
            pinnedNote.context[ItemType.FOLDER] = true;
            pinnedNote.context[ItemType.TAG] = true;
            changed = true;
        } else {
            // Pin in specific context
            const internalContext = this.toInternalContext(context);
            pinnedNote.context[internalContext] = true;
            changed = true;
        }

        // Save settings if anything changed
        if (changed) {
            // Update plugin settings to match cache
            plugin.settings.pinnedNotes = [...this.metadataState.pinnedNotes];
            await plugin.saveSettings();
        }
    }

    /**
     * Unpin a file
     * @param file - File to unpin
     * @param context - Context to unpin from (defaults to 'all')
     */
    async unpin(file: TFile, context: PinContext = 'all'): Promise<void> {
        const plugin = this.api.getPlugin();

        // Ensure metadataService exists
        if (!plugin.metadataService) {
            throw new Error('Metadata service not available');
        }

        // Find pinned note entry
        const pinnedNote = this.metadataState.pinnedNotes.find(p => p.path === file.path);
        if (!pinnedNote) {
            return;
        }

        let changed = false;

        if (context === 'all') {
            // Unpin from both contexts
            pinnedNote.context[ItemType.FOLDER] = false;
            pinnedNote.context[ItemType.TAG] = false;
            changed = true;
        } else {
            // Unpin from specific context
            const internalContext = this.toInternalContext(context);
            pinnedNote.context[internalContext] = false;
            changed = true;
        }

        // Remove from list if unpinned from all contexts
        if (!pinnedNote.context[ItemType.FOLDER] && !pinnedNote.context[ItemType.TAG]) {
            const index = this.metadataState.pinnedNotes.indexOf(pinnedNote);
            if (index >= 0) {
                this.metadataState.pinnedNotes.splice(index, 1);
                changed = true;
            }
        }

        // Save settings if anything changed
        if (changed) {
            // Update plugin settings to match cache
            plugin.settings.pinnedNotes = [...this.metadataState.pinnedNotes];
            await plugin.saveSettings();
        }
    }

    /**
     * Get all pinned files with their context information
     * @returns Array of PinnedFile objects
     */
    getPinned(): readonly PinnedFile[] {
        const plugin = this.api.getPlugin();
        const { app } = plugin;
        const result: PinnedFile[] = [];

        for (const pinnedNote of this.metadataState.pinnedNotes) {
            const file = app.vault.getFileByPath(pinnedNote.path);
            if (file) {
                result.push({
                    file,
                    context: {
                        folder: pinnedNote.context[ItemType.FOLDER] || false,
                        tag: pinnedNote.context[ItemType.TAG] || false
                    }
                });
            }
        }

        return result;
    }
}
