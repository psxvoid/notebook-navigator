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

import { SortOption, type NotebookNavigatorSettings } from '../../settings';
import { ItemType } from '../../types';
import { isFolderShortcut } from '../../types/shortcuts';
import { BaseMetadataService } from './BaseMetadataService';
import type { CleanupValidators } from '../MetadataService';
import { getFolderNote, type FolderNoteDetectionSettings } from '../../utils/folderNotes';
import { getDBInstance } from '../../storage/fileOperations';
import { normalizeCanonicalIconId } from '../../utils/iconizeFormat';

/**
 * Service for managing folder-specific metadata operations
 * Handles folder colors, icons, sort overrides, and cleanup operations
 */
type SettingsMutation = (settings: NotebookNavigatorSettings) => boolean;

export class FolderMetadataService extends BaseMetadataService {
    /**
     * Validates that a folder exists in the vault
     */
    private validateFolder(folderPath: string): boolean {
        return this.app.vault.getFolderByPath(folderPath) !== null;
    }

    /**
     * Sets a custom color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderColor(folderPath: string, color: string): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntityColor(ItemType.FOLDER, folderPath, color);
    }

    /**
     * Sets a custom background color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderBackgroundColor(folderPath: string, color: string): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntityBackgroundColor(ItemType.FOLDER, folderPath, color);
    }

    /**
     * Removes the custom color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderColor(folderPath: string): Promise<void> {
        return this.removeEntityColor(ItemType.FOLDER, folderPath);
    }

    /**
     * Removes the custom background color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderBackgroundColor(folderPath: string): Promise<void> {
        return this.removeEntityBackgroundColor(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the custom color for a folder, checking ancestors if inheritance is enabled
     * @param folderPath - Path of the folder
     * @returns The color value or undefined
     */
    getFolderColor(folderPath: string): string | undefined {
        // First check if this folder has a color directly set
        const directColor = this.getEntityColor(ItemType.FOLDER, folderPath);
        if (directColor) return directColor;

        const folderNoteColor = this.getFolderNoteMetadata(folderPath)?.color;
        if (folderNoteColor) return folderNoteColor;

        // If no direct color and inheritance is enabled, check ancestors
        if (this.settingsProvider.settings.inheritFolderColors) {
            const pathParts = folderPath.split('/');
            for (let i = pathParts.length - 1; i > 0; i--) {
                const ancestorPath = pathParts.slice(0, i).join('/');
                const ancestorColor = this.getEntityColor(ItemType.FOLDER, ancestorPath);
                if (ancestorColor) return ancestorColor;
            }
        }

        return undefined;
    }

    /**
     * Gets the custom background color for a folder, checking ancestors if inheritance is enabled
     * @param folderPath - Path of the folder
     * @returns The background color value or undefined
     */
    getFolderBackgroundColor(folderPath: string): string | undefined {
        const directBackground = this.getEntityBackgroundColor(ItemType.FOLDER, folderPath);
        if (directBackground) return directBackground;

        if (this.settingsProvider.settings.inheritFolderColors) {
            const pathParts = folderPath.split('/');
            for (let i = pathParts.length - 1; i > 0; i--) {
                const ancestorPath = pathParts.slice(0, i).join('/');
                const ancestorBackground = this.getEntityBackgroundColor(ItemType.FOLDER, ancestorPath);
                if (ancestorBackground) return ancestorBackground;
            }
        }

        return undefined;
    }

    /**
     * Sets a custom icon for a folder
     * @param folderPath - Path of the folder
     * @param iconId - Lucide icon identifier
     */
    async setFolderIcon(folderPath: string, iconId: string): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntityIcon(ItemType.FOLDER, folderPath, iconId);
    }

    /**
     * Removes the custom icon from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderIcon(folderPath: string): Promise<void> {
        return this.removeEntityIcon(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the custom icon for a folder
     * @param folderPath - Path of the folder
     * @returns The icon ID or undefined
     */
    getFolderIcon(folderPath: string): string | undefined {
        const directIcon = this.getEntityIcon(ItemType.FOLDER, folderPath);
        if (directIcon) {
            return directIcon;
        }

        return this.getFolderNoteMetadata(folderPath)?.icon;
    }

    /**
     * Sets a custom sort order for a folder
     * @param folderPath - Path of the folder
     * @param sortOption - Sort option to apply
     */
    async setFolderSortOverride(folderPath: string, sortOption: SortOption): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntitySortOverride(ItemType.FOLDER, folderPath, sortOption);
    }

    /**
     * Removes the custom sort order from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderSortOverride(folderPath: string): Promise<void> {
        return this.removeEntitySortOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the sort override for a folder
     * @param folderPath - Path of the folder
     * @returns The sort option or undefined
     */
    getFolderSortOverride(folderPath: string): SortOption | undefined {
        return this.getEntitySortOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Handles folder rename by updating all associated metadata
     * @param oldPath - Previous folder path
     * @param newPath - New folder path
     */
    async handleFolderRename(oldPath: string, newPath: string, extraMutation?: SettingsMutation): Promise<void> {
        await this.saveAndUpdate(settings => {
            let changed = false;

            changed = this.updateNestedPaths(settings.folderColors, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderBackgroundColors, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderIcons, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderSortOverrides, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderAppearances, oldPath, newPath) || changed;

            const shortcutsChanged = this.updateShortcuts(settings, shortcut => {
                if (!isFolderShortcut(shortcut) || shortcut.path !== oldPath) {
                    return undefined;
                }

                return {
                    ...shortcut,
                    path: newPath
                };
            });
            changed = shortcutsChanged || changed;

            if (extraMutation) {
                changed = extraMutation(settings) || changed;
            }

            return changed;
        });
    }

    /**
     * Handles folder deletion by removing all associated metadata
     * @param folderPath - Path of the deleted folder
     */
    async handleFolderDelete(folderPath: string, extraMutation?: SettingsMutation): Promise<void> {
        await this.saveAndUpdate(settings => {
            let changed = false;

            changed = this.deleteNestedPaths(settings.folderColors, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderBackgroundColors, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderIcons, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderSortOverrides, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderAppearances, folderPath) || changed;

            const shortcutsChanged = this.updateShortcuts(settings, shortcut => {
                if (!isFolderShortcut(shortcut)) {
                    return undefined;
                }
                return shortcut.path === folderPath ? null : undefined;
            });
            changed = shortcutsChanged || changed;

            if (extraMutation) {
                changed = extraMutation(settings) || changed;
            }

            return changed;
        });
    }

    /**
     * Clean up folder metadata for non-existent folders
     * @returns True if any changes were made
     */
    async cleanupFolderMetadata(targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings): Promise<boolean> {
        const validator = (path: string) => this.app.vault.getFolderByPath(path) !== null;

        const results = await Promise.all([
            this.cleanupMetadata(targetSettings, 'folderColors', validator),
            this.cleanupMetadata(targetSettings, 'folderBackgroundColors', validator),
            this.cleanupMetadata(targetSettings, 'folderIcons', validator),
            this.cleanupMetadata(targetSettings, 'folderSortOverrides', validator),
            this.cleanupMetadata(targetSettings, 'folderAppearances', validator)
        ]);

        return results.some(changed => changed);
    }

    /**
     * Clean up folder metadata using pre-loaded validators.
     *
     * This method is called during plugin startup as part of a unified cleanup process
     * to avoid multiple iterations over vault files. Instead of each metadata type
     * (colors, icons, sort overrides, appearances) separately checking if folders exist,
     * this method uses pre-loaded data for better performance.
     *
     * The cleanup process:
     * 1. Called from StorageContext during initial sync after all files are processed
     * 2. Uses validators object that contains:
     *    - dbFiles: All files from IndexedDB cache
     *    - tagTree: Complete tag hierarchy
     *    - vaultFiles: Set of all file paths in the vault
     *    - vaultFolders: Set of all actual folder paths from the vault
     * 3. Uses the vaultFolders set directly to validate folder existence
     * 4. Removes metadata for any folders that no longer exist in the vault
     *
     * @param validators - Pre-loaded data containing vault files, folders, database files, and tag tree
     * @returns True if any metadata was removed/changed
     */
    async cleanupWithValidators(
        validators: CleanupValidators,
        targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings
    ): Promise<boolean> {
        // Use the actual folder paths directly from the validators
        const validator = (path: string) => validators.vaultFolders.has(path);

        const results = await Promise.all([
            this.cleanupMetadata(targetSettings, 'folderColors', validator),
            this.cleanupMetadata(targetSettings, 'folderBackgroundColors', validator),
            this.cleanupMetadata(targetSettings, 'folderIcons', validator),
            this.cleanupMetadata(targetSettings, 'folderSortOverrides', validator),
            this.cleanupMetadata(targetSettings, 'folderAppearances', validator)
        ]);

        return results.some(changed => changed);
    }

    /**
     * Returns icon/color metadata extracted from the folder's folder note (if any)
     */
    private getFolderNoteMetadata(folderPath: string): { icon?: string; color?: string } | null {
        const settings = this.settingsProvider.settings;
        if (!settings.enableFolderNotes) {
            return null;
        }

        const folder = this.app.vault.getFolderByPath(folderPath);
        if (!folder) {
            return null;
        }

        const detectionSettings: FolderNoteDetectionSettings = {
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName
        };

        const folderNote = getFolderNote(folder, detectionSettings);
        if (!folderNote) {
            return null;
        }

        const db = getDBInstance();
        const fileData = db.getFile(folderNote.path);
        if (!fileData || !fileData.metadata) {
            return null;
        }

        const iconValue = typeof fileData.metadata.icon === 'string' ? normalizeCanonicalIconId(fileData.metadata.icon.trim()) : undefined;
        const colorValue = typeof fileData.metadata.color === 'string' ? fileData.metadata.color.trim() : undefined;

        if (!iconValue && !colorValue) {
            return null;
        }

        return {
            icon: iconValue || undefined,
            color: colorValue || undefined
        };
    }
}
