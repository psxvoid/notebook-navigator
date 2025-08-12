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

    /**
     * Previous state for change detection
     */
    private previousState: {
        folderColors: Record<string, string>;
        folderIcons: Record<string, string>;
        tagColors: Record<string, string>;
        tagIcons: Record<string, string>;
        pinnedNotes: PinnedNote[];
        initialized: boolean;
    } = {
        folderColors: {},
        folderIcons: {},
        tagColors: {},
        tagIcons: {},
        pinnedNotes: [],
        initialized: false
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
     * Deep compare pinned notes arrays
     * @internal
     */
    private pinnedNotesChanged(oldNotes: PinnedNote[], newNotes: PinnedNote[]): boolean {
        if (oldNotes.length !== newNotes.length) return true;

        // Create a map of old notes for efficient lookup
        const oldMap = new Map<string, PinnedNote['context']>();
        for (const note of oldNotes) {
            oldMap.set(note.path, note.context);
        }

        // Check each new note against the old ones
        for (const newNote of newNotes) {
            const oldContext = oldMap.get(newNote.path);
            if (!oldContext) return true; // New note added

            // Compare contexts
            const oldFolder = oldContext[ItemType.FOLDER] ?? false;
            const newFolder = newNote.context[ItemType.FOLDER] ?? false;
            const oldTag = oldContext[ItemType.TAG] ?? false;
            const newTag = newNote.context[ItemType.TAG] ?? false;

            if (oldFolder !== newFolder || oldTag !== newTag) {
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
            folderIcons: settings.folderIcons || {},
            tagColors: settings.tagColors || {},
            tagIcons: settings.tagIcons || {},
            pinnedNotes: settings.pinnedNotes || []
        };

        // Update the cache first
        this.metadataState = {
            folderColors: { ...current.folderColors },
            folderIcons: { ...current.folderIcons },
            tagColors: { ...current.tagColors },
            tagIcons: { ...current.tagIcons },
            pinnedNotes: [...current.pinnedNotes]
        };

        // Skip comparison on first run (just initialize state)
        if (!this.previousState.initialized) {
            this.previousState = {
                folderColors: { ...current.folderColors },
                folderIcons: { ...current.folderIcons },
                tagColors: { ...current.tagColors },
                tagIcons: { ...current.tagIcons },
                pinnedNotes: current.pinnedNotes.map(n => ({
                    path: n.path,
                    context: { ...n.context }
                })),
                initialized: true
            };
            return;
        }

        // Find changed folders
        const changedFolderColors = this.findChangedKeys(this.previousState.folderColors, current.folderColors);
        const changedFolderIcons = this.findChangedKeys(this.previousState.folderIcons, current.folderIcons);
        const changedFolders = new Set([...changedFolderColors, ...changedFolderIcons]);

        // Fire events for changed folders
        for (const folderPath of changedFolders) {
            const folder = this.api.getApp().vault.getAbstractFileByPath(folderPath);
            if (folder instanceof TFolder) {
                const metadata = this.getFolderMeta(folder);
                this.api.trigger('folder-changed', {
                    folder,
                    metadata: metadata || { color: undefined, icon: undefined }
                });
            }
        }

        // Find changed tags
        const changedTagColors = this.findChangedKeys(this.previousState.tagColors, current.tagColors);
        const changedTagIcons = this.findChangedKeys(this.previousState.tagIcons, current.tagIcons);
        const changedTags = new Set([...changedTagColors, ...changedTagIcons]);

        // Fire events for changed tags
        for (const tag of changedTags) {
            const metadata = this.getTagMeta(tag);
            this.api.trigger('tag-changed', {
                tag,
                metadata: metadata || { color: undefined, icon: undefined }
            });
        }

        // Check pinned notes
        if (this.pinnedNotesChanged(this.previousState.pinnedNotes, current.pinnedNotes)) {
            const pinnedFiles = this.getPinned();
            this.api.trigger('pinned-files-changed', { files: pinnedFiles });
        }

        // Update previous state for next comparison
        this.previousState = {
            folderColors: { ...current.folderColors },
            folderIcons: { ...current.folderIcons },
            tagColors: { ...current.tagColors },
            tagIcons: { ...current.tagIcons },
            pinnedNotes: current.pinnedNotes.map(n => ({
                path: n.path,
                context: { ...n.context }
            })),
            initialized: true
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
                delete plugin.settings.folderColors[path];
            } else {
                // Set color
                plugin.settings.folderColors[path] = meta.color;
            }
            changed = true;
        }

        // Update icon if provided
        if (meta.icon !== undefined) {
            if (meta.icon === null) {
                // Clear icon
                delete plugin.settings.folderIcons[path];
            } else {
                // Set icon
                plugin.settings.folderIcons[path] = meta.icon;
            }
            changed = true;
        }

        // Save settings if anything changed
        // The cache will be updated via the settings update callback
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
                delete plugin.settings.tagColors[normalizedTag];
            } else {
                // Set color
                plugin.settings.tagColors[normalizedTag] = meta.color;
            }
            changed = true;
        }

        // Update icon if provided
        if (meta.icon !== undefined) {
            if (meta.icon === null) {
                // Clear icon
                delete plugin.settings.tagIcons[normalizedTag];
            } else {
                // Set icon
                plugin.settings.tagIcons[normalizedTag] = meta.icon;
            }
            changed = true;
        }

        // Save settings if anything changed
        // The cache will be updated via the settings update callback
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

        // Find or create pinned note entry in settings
        let pinnedNote = plugin.settings.pinnedNotes.find(p => p.path === file.path);
        if (!pinnedNote) {
            pinnedNote = {
                path: file.path,
                context: {
                    [ItemType.FOLDER]: false,
                    [ItemType.TAG]: false
                }
            };
            plugin.settings.pinnedNotes.push(pinnedNote);
        }

        let changed = false;

        if (context === 'all') {
            // Pin in both contexts
            if (!pinnedNote.context[ItemType.FOLDER] || !pinnedNote.context[ItemType.TAG]) {
                pinnedNote.context[ItemType.FOLDER] = true;
                pinnedNote.context[ItemType.TAG] = true;
                changed = true;
            }
        } else {
            // Pin in specific context
            const internalContext = this.toInternalContext(context);
            if (!pinnedNote.context[internalContext]) {
                pinnedNote.context[internalContext] = true;
                changed = true;
            }
        }

        // Save settings if anything changed
        // The cache will be updated via the settings update callback
        if (changed) {
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

        // Find pinned note entry in settings
        const pinnedNote = plugin.settings.pinnedNotes.find(p => p.path === file.path);
        if (!pinnedNote) {
            return;
        }

        let changed = false;

        if (context === 'all') {
            // Unpin from both contexts
            if (pinnedNote.context[ItemType.FOLDER] || pinnedNote.context[ItemType.TAG]) {
                pinnedNote.context[ItemType.FOLDER] = false;
                pinnedNote.context[ItemType.TAG] = false;
                changed = true;
            }
        } else {
            // Unpin from specific context
            const internalContext = this.toInternalContext(context);
            if (pinnedNote.context[internalContext]) {
                pinnedNote.context[internalContext] = false;
                changed = true;
            }
        }

        // Remove from list if unpinned from all contexts
        if (changed && !pinnedNote.context[ItemType.FOLDER] && !pinnedNote.context[ItemType.TAG]) {
            const index = plugin.settings.pinnedNotes.indexOf(pinnedNote);
            if (index >= 0) {
                plugin.settings.pinnedNotes.splice(index, 1);
            }
        }

        // Save settings if anything changed
        // The cache will be updated via the settings update callback
        if (changed) {
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
