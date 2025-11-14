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
import type { FolderMetadata, TagMetadata, IconString, PinContext, Pinned } from '../types';
import type { NotebookNavigatorSettings } from '../../settings';
import { PinnedNotes } from '../../types';
import { normalizeCanonicalIconId } from '../../utils/iconizeFormat';

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
        folderBackgroundColors: {} as Record<string, string>,
        folderIcons: {} as Record<string, string>,

        // Tag metadata
        tagColors: {} as Record<string, string>,
        tagBackgroundColors: {} as Record<string, string>,
        tagIcons: {} as Record<string, string>,

        // File metadata
        fileIcons: {} as Record<string, string>,
        fileColors: {} as Record<string, string>,

        // Pinned files
        pinnedNotes: {} as PinnedNotes
    };

    /**
     * Previous state for change detection
     */
    private previousState: {
        folderColors: Record<string, string>;
        folderBackgroundColors: Record<string, string>;
        folderIcons: Record<string, string>;
        tagColors: Record<string, string>;
        tagBackgroundColors: Record<string, string>;
        tagIcons: Record<string, string>;
        fileIcons: Record<string, string>;
        fileColors: Record<string, string>;
        pinnedNotes: PinnedNotes;
        initialized: boolean;
    } = {
        folderColors: {},
        folderBackgroundColors: {},
        folderIcons: {},
        tagColors: {},
        tagBackgroundColors: {},
        tagIcons: {},
        fileIcons: {},
        fileColors: {},
        pinnedNotes: {},
        initialized: false
    };

    constructor(private api: NotebookNavigatorAPI) {
        this.initializeFromSettings();
    }

    /**
     * Normalizes a tag key by removing leading "#" and converting to lowercase
     * @param tag - Tag string that may or may not have "#" prefix
     * @returns Normalized tag key for internal storage
     */
    private normalizeTagKey(tag: string): string {
        // Strip single leading "#" if present and lowercase
        const normalized = tag.startsWith('#') ? tag.slice(1) : tag;
        return normalized.toLowerCase();
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
     * Deep compare two objects to find changed keys
     * @internal
     */
    private findChangedKeys(oldObj: Record<string, string>, newObj: Record<string, string>): Set<string> {
        const changed = new Set<string>();

        // Check for added or modified
        for (const [key, value] of Object.entries(newObj)) {
            if (oldObj[key] !== value) {
                changed.add(key);
            }
        }

        // Check for deleted
        for (const key of Object.keys(oldObj)) {
            if (!(key in newObj)) {
                changed.add(key);
            }
        }

        return changed;
    }

    /**
     * Deep compare pinned notes objects
     * @internal
     */
    private pinnedNotesChanged(oldNotes: PinnedNotes, newNotes: PinnedNotes): boolean {
        const oldKeys = Object.keys(oldNotes);
        const newKeys = Object.keys(newNotes);

        if (oldKeys.length !== newKeys.length) return true;

        // Check each note
        for (const path of newKeys) {
            const oldContext = oldNotes[path];
            if (!oldContext) return true; // New note added

            const newContext = newNotes[path];
            if (oldContext.folder !== newContext.folder || oldContext.tag !== newContext.tag) {
                return true;
            }
        }

        return false;
    }

    /**
     * Update internal cache when settings change and trigger events
     * Called by the plugin when settings are modified
     * @internal
     */
    updateFromSettings(settings: NotebookNavigatorSettings): void {
        const current = {
            folderColors: settings.folderColors || {},
            folderBackgroundColors: settings.folderBackgroundColors || {},
            folderIcons: settings.folderIcons || {},
            tagColors: settings.tagColors || {},
            tagBackgroundColors: settings.tagBackgroundColors || {},
            tagIcons: settings.tagIcons || {},
            fileIcons: settings.fileIcons || {},
            fileColors: settings.fileColors || {},
            pinnedNotes: settings.pinnedNotes || {}
        };

        // Update the cache first
        this.metadataState = {
            folderColors: { ...current.folderColors },
            folderBackgroundColors: { ...current.folderBackgroundColors },
            folderIcons: { ...current.folderIcons },
            tagColors: { ...current.tagColors },
            tagBackgroundColors: { ...current.tagBackgroundColors },
            tagIcons: { ...current.tagIcons },
            fileIcons: { ...current.fileIcons },
            fileColors: { ...current.fileColors },
            pinnedNotes: { ...current.pinnedNotes }
        };

        // Skip comparison on first run (just initialize state)
        if (!this.previousState.initialized) {
            this.previousState = {
                folderColors: { ...current.folderColors },
                folderBackgroundColors: { ...current.folderBackgroundColors },
                folderIcons: { ...current.folderIcons },
                tagColors: { ...current.tagColors },
                tagBackgroundColors: { ...current.tagBackgroundColors },
                tagIcons: { ...current.tagIcons },
                fileIcons: { ...current.fileIcons },
                fileColors: { ...current.fileColors },
                pinnedNotes: { ...current.pinnedNotes },
                initialized: true
            };
            return;
        }

        // Find changed folders
        const changedFolderColors = this.findChangedKeys(this.previousState.folderColors, current.folderColors);
        const changedFolderBackgrounds = this.findChangedKeys(this.previousState.folderBackgroundColors, current.folderBackgroundColors);
        const changedFolderIcons = this.findChangedKeys(this.previousState.folderIcons, current.folderIcons);
        const changedFolders = new Set([...changedFolderColors, ...changedFolderBackgrounds, ...changedFolderIcons]);

        // Fire events for changed folders
        for (const folderPath of changedFolders) {
            const folder = this.api.getApp().vault.getFolderByPath(folderPath);
            if (folder) {
                const metadata = this.getFolderMeta(folder);
                this.api.trigger('folder-changed', {
                    folder,
                    metadata: metadata || { color: undefined, backgroundColor: undefined, icon: undefined }
                });
            }
        }

        // Find changed tags
        const changedTagColors = this.findChangedKeys(this.previousState.tagColors, current.tagColors);
        const changedTagBackgrounds = this.findChangedKeys(this.previousState.tagBackgroundColors, current.tagBackgroundColors);
        const changedTagIcons = this.findChangedKeys(this.previousState.tagIcons, current.tagIcons);
        const changedTags = new Set([...changedTagColors, ...changedTagBackgrounds, ...changedTagIcons]);

        // Fire events for changed tags
        for (const tag of changedTags) {
            const metadata = this.getTagMeta(tag);
            this.api.trigger('tag-changed', {
                tag,
                metadata: metadata || { color: undefined, backgroundColor: undefined, icon: undefined }
            });
        }

        // Check pinned notes
        if (this.pinnedNotesChanged(this.previousState.pinnedNotes, current.pinnedNotes)) {
            const pinnedMap = this.getPinned();
            this.api.trigger('pinned-files-changed', { files: pinnedMap });
        }

        // Update previous state for next comparison
        this.previousState = {
            folderColors: { ...current.folderColors },
            folderBackgroundColors: { ...current.folderBackgroundColors },
            folderIcons: { ...current.folderIcons },
            tagColors: { ...current.tagColors },
            tagBackgroundColors: { ...current.tagBackgroundColors },
            tagIcons: { ...current.tagIcons },
            fileIcons: { ...current.fileIcons },
            fileColors: { ...current.fileColors },
            pinnedNotes: { ...current.pinnedNotes },
            initialized: true
        };
    }

    // ===================================================================
    // Generic Metadata Helper
    // ===================================================================

    /**
     * Generic helper to update metadata in settings
     * @internal
     */
    private async updateMetadata(
        key: string,
        meta: Partial<FolderMetadata | TagMetadata>,
        colorStore: Record<string, string>,
        iconStore: Record<string, string>,
        backgroundStore: Record<string, string>
    ): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        let changed = false;

        // Update color if provided
        if (meta.color !== undefined) {
            if (meta.color === null) {
                // Clear color
                delete colorStore[key];
            } else {
                // Set color
                colorStore[key] = meta.color;
            }
            changed = true;
        }

        // Update background color if provided
        if (meta.backgroundColor !== undefined) {
            if (meta.backgroundColor === null) {
                delete backgroundStore[key];
            } else {
                backgroundStore[key] = meta.backgroundColor;
            }
            changed = true;
        }

        // Update icon if provided
        if (meta.icon !== undefined) {
            if (meta.icon === null) {
                delete iconStore[key];
                changed = true;
            } else if (typeof meta.icon === 'string') {
                const normalizedIcon = normalizeCanonicalIconId(meta.icon);
                if (normalizedIcon) {
                    iconStore[key] = normalizedIcon;
                    changed = true;
                }
            }
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettingsAndUpdate();
        }
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
        const backgroundColor = this.metadataState.folderBackgroundColors[path];
        const icon = this.metadataState.folderIcons[path];

        if (!color && !backgroundColor && !icon) {
            return null;
        }

        return {
            color,
            backgroundColor,
            icon: icon as IconString | undefined
        };
    }

    /**
     * Set folder metadata (color and/or icon)
     * @param folder - Folder to set metadata for
     * @param meta - Partial metadata object with properties to update
     */
    async setFolderMeta(folder: TFolder, meta: Partial<FolderMetadata>): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        await this.updateMetadata(
            folder.path,
            meta,
            plugin.settings.folderColors,
            plugin.settings.folderIcons,
            plugin.settings.folderBackgroundColors
        );
    }

    // ===================================================================
    // Tag Metadata
    // ===================================================================

    /**
     * Get tag metadata
     * @param tag - Tag string (with or without '#' prefix)
     */
    getTagMeta(tag: string): TagMetadata | null {
        // Normalize tag key for lookup
        const normalizedTag = this.normalizeTagKey(tag);

        const color = this.metadataState.tagColors[normalizedTag];
        const backgroundColor = this.metadataState.tagBackgroundColors[normalizedTag];
        const icon = this.metadataState.tagIcons[normalizedTag];

        if (!color && !backgroundColor && !icon) {
            return null;
        }

        return {
            color,
            backgroundColor,
            icon: icon as IconString | undefined
        };
    }

    /**
     * Set tag metadata (color and/or icon)
     * @param tag - Tag string (with or without '#' prefix)
     * @param meta - Partial metadata object with properties to update
     */
    async setTagMeta(tag: string, meta: Partial<TagMetadata>): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        const normalizedTag = this.normalizeTagKey(tag);
        await this.updateMetadata(
            normalizedTag,
            meta,
            plugin.settings.tagColors,
            plugin.settings.tagIcons,
            plugin.settings.tagBackgroundColors
        );
    }

    // ===================================================================
    // Pinned Files
    // ===================================================================

    /**
     * Check if a file is pinned
     * @param file - File to check
     * @param context - Context to check (if not specified, returns true if pinned in any context)
     */
    isPinned(file: TFile, context?: PinContext): boolean {
        const contexts = this.metadataState.pinnedNotes[file.path];
        if (!contexts) return false;

        if (!context) {
            // No context - check if pinned in any context
            return contexts.folder || contexts.tag;
        } else if (context === 'all') {
            // Check if pinned in both contexts
            return contexts.folder && contexts.tag;
        } else if (context === 'folder') {
            return contexts.folder;
        }
        return contexts.tag;
    }

    /**
     * Pin a file
     * @param file - File to pin
     * @param context - Context to pin in (defaults to 'all')
     */
    async pin(file: TFile, context: PinContext = 'all'): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin?.metadataService) return;

        if (!plugin.settings.pinnedNotes) {
            plugin.settings.pinnedNotes = {};
        }

        if (!plugin.settings.pinnedNotes[file.path]) {
            plugin.settings.pinnedNotes[file.path] = { folder: false, tag: false };
        }

        let changed = false;
        const contexts = plugin.settings.pinnedNotes[file.path];

        if (context === 'all') {
            // Pin in both contexts
            if (!contexts.folder || !contexts.tag) {
                contexts.folder = true;
                contexts.tag = true;
                changed = true;
            }
        } else if (context === 'folder') {
            if (!contexts.folder) {
                contexts.folder = true;
                changed = true;
            }
        } else if (context === 'tag') {
            if (!contexts.tag) {
                contexts.tag = true;
                changed = true;
            }
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettingsAndUpdate();
        }
    }

    /**
     * Unpin a file
     * @param file - File to unpin
     * @param context - Context to unpin from (defaults to 'all')
     */
    async unpin(file: TFile, context: PinContext = 'all'): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin?.metadataService) return;

        const contexts = plugin.settings.pinnedNotes?.[file.path];
        if (!contexts) return;

        let changed = false;

        if (context === 'all') {
            // Unpin from all contexts - remove entirely
            delete plugin.settings.pinnedNotes[file.path];
            changed = true;
        } else if (context === 'folder') {
            if (contexts.folder) {
                contexts.folder = false;
                changed = true;
            }
        } else if (context === 'tag') {
            if (contexts.tag) {
                contexts.tag = false;
                changed = true;
            }
        }

        // Remove if unpinned from all contexts
        if (changed && contexts && !contexts.folder && !contexts.tag) {
            delete plugin.settings.pinnedNotes[file.path];
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettingsAndUpdate();
        }
    }

    /**
     * Get all pinned files with their context information
     * @returns Map of file paths to PinnedContext objects
     */
    getPinned(): Readonly<Pinned> {
        return new Map(Object.entries(this.metadataState.pinnedNotes));
    }
}
