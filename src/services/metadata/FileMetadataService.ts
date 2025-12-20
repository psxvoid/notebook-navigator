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
import { BaseMetadataService } from './BaseMetadataService';
import type { CleanupValidators } from '../MetadataService';
import { ItemType, NavigatorContext } from '../../types';
import { isNoteShortcut } from '../../types/shortcuts';
import type { NotebookNavigatorSettings } from '../../settings';
import { getDBInstance } from '../../storage/fileOperations';
import { normalizeCanonicalIconId, serializeIconForFrontmatter } from '../../utils/iconizeFormat';

/**
 * Service for managing file-specific metadata operations
 * Handles pinned notes and file-related cleanup operations
 */

/**
 * Result object returned by metadata migration operations
 */
export interface FileMetadataMigrationResult {
    iconsBefore: number;
    colorsBefore: number;
    migratedIcons: number;
    migratedColors: number;
    filesUpdated: number;
    failures: number;
}

export class FileMetadataService extends BaseMetadataService {
    /**
     * Gets a TFile instance from a file path
     * @param filePath - Path to the file
     * @returns TFile instance or null if not found or not a file
     */
    private getFile(filePath: string): TFile | null {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        return file instanceof TFile ? file : null;
    }

    /**
     * Checks if frontmatter storage is enabled for file metadata
     * @returns True if both frontmatter metadata reading and saving are enabled
     */
    private shouldUseFrontmatterForFiles(): boolean {
        const settings = this.settingsProvider.settings;
        return settings.useFrontmatterMetadata && settings.saveMetadataToFrontmatter;
    }

    /**
     * Writes or deletes an icon/color value in a file's frontmatter and syncs to IndexedDB
     * @param file - The file to update
     * @param field - Frontmatter field name to write to
     * @param value - Value to write, or null to delete the field
     * @param metadataKey - Type of metadata being written ('icon' or 'color')
     * @returns Object with success status and the normalized value that was written
     */
    private async writeFrontmatterValue(
        file: TFile,
        field: string,
        value: string | null,
        metadataKey: 'icon' | 'color'
    ): Promise<{ success: boolean; normalized: string | null }> {
        const trimmedField = field.trim();
        if (!trimmedField) {
            return { success: false, normalized: null };
        }

        let canonicalValue: string | null = null;
        let frontmatterValue: string | null = null;

        if (value !== null) {
            if (metadataKey === 'icon') {
                const normalizedIcon = normalizeCanonicalIconId(value.trim());
                canonicalValue = normalizedIcon && normalizedIcon.length > 0 ? normalizedIcon : null;
                if (canonicalValue) {
                    frontmatterValue = serializeIconForFrontmatter(canonicalValue) ?? canonicalValue;
                }
            } else {
                const trimmedColor = value.trim();
                canonicalValue = trimmedColor.length > 0 ? trimmedColor : null;
                frontmatterValue = canonicalValue;
            }
        }

        const normalizedFrontmatterValue = frontmatterValue === null ? null : frontmatterValue.trim();

        try {
            // Update the frontmatter in the file
            await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                if (normalizedFrontmatterValue && normalizedFrontmatterValue.length > 0) {
                    frontmatter[trimmedField] = normalizedFrontmatterValue;
                    return;
                }

                // Remove the field if it exists and new value is empty
                if (Reflect.has(frontmatter, trimmedField)) {
                    delete frontmatter[trimmedField];
                }
            });
            // Sync the change to IndexedDB cache using canonical format
            const db = getDBInstance();
            const metadataUpdate: { icon?: string; color?: string } = {};
            if (metadataKey === 'icon') {
                // Store canonical icon format in cache for consistency
                metadataUpdate.icon = canonicalValue && canonicalValue.length > 0 ? canonicalValue : undefined;
            } else {
                metadataUpdate.color = canonicalValue && canonicalValue.length > 0 ? canonicalValue : undefined;
            }
            await db.updateFileMetadata(file.path, metadataUpdate);
            return { success: true, normalized: normalizedFrontmatterValue ?? null };
        } catch (error: unknown) {
            console.error('Failed to update frontmatter metadata', {
                path: file.path,
                field: trimmedField,
                error
            });
            return { success: false, normalized: null };
        }
    }

    /**
     * Removes an icon or color entry from settings storage for a specific file
     * Used after successfully migrating metadata to frontmatter
     * @param key - The settings property to clear ('fileIcons' or 'fileColors')
     * @param filePath - Path to the file whose entry should be removed
     */
    private async clearSettingsEntry(key: 'fileIcons' | 'fileColors', filePath: string): Promise<void> {
        const record = this.settingsProvider.settings[key];
        if (!record || record[filePath] === undefined) {
            return;
        }

        await this.saveAndUpdate(settings => {
            const target = settings[key];
            if (target) {
                delete target[filePath];
            }
        });
    }

    /**
     * Toggles the pinned state of a note in a specific context
     * @param filePath - Path of the file to pin/unpin
     * @param context - Context to toggle ('folder' or 'tag')
     */
    async togglePinnedNote(filePath: string, context: NavigatorContext): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (!settings.pinnedNotes) {
                settings.pinnedNotes = {};
            }

            if (!settings.pinnedNotes[filePath]) {
                // Create new pin with only specified context
                settings.pinnedNotes[filePath] = {
                    folder: context === 'folder',
                    tag: context === 'tag'
                };
            } else {
                // Toggle the specific context
                settings.pinnedNotes[filePath][context] = !settings.pinnedNotes[filePath][context];

                // Remove if unpinned from all contexts
                if (!settings.pinnedNotes[filePath].folder && !settings.pinnedNotes[filePath].tag) {
                    delete settings.pinnedNotes[filePath];
                }
            }
        });
    }

    /**
     * Pins multiple notes in a single settings update.
     * @param filePaths - Paths of files to pin
     * @param context - Context to pin ('folder' or 'tag')
     * @returns Number of notes newly pinned in the given context
     */
    async pinNotes(filePaths: string[], context: NavigatorContext): Promise<number> {
        const uniquePaths = Array.from(new Set(filePaths)).filter(path => path.length > 0);
        if (uniquePaths.length === 0) {
            return 0;
        }

        let pinnedCount = 0;
        await this.saveAndUpdate(settings => {
            if (!settings.pinnedNotes) {
                settings.pinnedNotes = {};
            }

            let changed = false;
            for (const filePath of uniquePaths) {
                const existing = settings.pinnedNotes[filePath];
                if (!existing) {
                    settings.pinnedNotes[filePath] = {
                        folder: context === 'folder',
                        tag: context === 'tag'
                    };
                    changed = true;
                    pinnedCount += 1;
                    continue;
                }

                if (!existing[context]) {
                    existing[context] = true;
                    changed = true;
                    pinnedCount += 1;
                }
            }

            return changed;
        });

        return pinnedCount;
    }

    /**
     * Checks if a note is pinned
     * @param filePath - Path of the file to check
     * @param context - Optional context to check ('folder' or 'tag')
     * @returns True if the note is pinned (in any context or specified context)
     */
    isPinned(filePath: string, context?: NavigatorContext): boolean {
        const contexts = this.settingsProvider.settings.pinnedNotes?.[filePath];
        if (!contexts) return false;

        if (!context) {
            return contexts.folder || contexts.tag;
        }

        return contexts[context] || false;
    }

    /**
     * Gets all pinned notes
     * @param context - Optional context filter ('folder' or 'tag')
     * @returns Array of pinned file paths
     */
    getPinnedNotes(context?: NavigatorContext): string[] {
        const pinnedNotes = this.settingsProvider.settings.pinnedNotes || {};

        if (!context) {
            return Object.keys(pinnedNotes);
        }

        return Object.entries(pinnedNotes)
            .filter(([_, contexts]) => contexts[context])
            .map(([path]) => path);
    }

    /**
     * Handles file deletion by removing it from pinned notes
     * @param filePath - Path of the deleted file
     */
    async handleFileDelete(filePath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes?.[filePath]) {
                delete settings.pinnedNotes[filePath];
            }
            if (settings.fileIcons?.[filePath]) {
                delete settings.fileIcons[filePath];
            }
            if (settings.fileColors?.[filePath]) {
                delete settings.fileColors[filePath];
            }

            this.updateShortcuts(settings, shortcut => {
                if (!isNoteShortcut(shortcut)) {
                    return undefined;
                }
                return shortcut.path === filePath ? null : undefined;
            });
        });
    }

    /**
     * Handles file rename by updating pinned notes
     * @param oldPath - Original file path
     * @param newPath - New file path
     */
    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        await this.saveAndUpdate(settings => {
            if (settings.pinnedNotes?.[oldPath]) {
                // Save contexts and delete old entry
                const contexts = settings.pinnedNotes[oldPath];
                delete settings.pinnedNotes[oldPath];
                // Add with new path
                settings.pinnedNotes[newPath] = contexts;
            }

            this.updateNestedPaths(settings.fileIcons, oldPath, newPath);
            this.updateNestedPaths(settings.fileColors, oldPath, newPath);

            this.updateShortcuts(settings, shortcut => {
                if (!isNoteShortcut(shortcut)) {
                    return undefined;
                }
                if (shortcut.path !== oldPath) {
                    return undefined;
                }

                return {
                    ...shortcut,
                    path: newPath
                };
            });
        });
    }

    /**
     * Sets an icon for a file, storing in frontmatter if enabled, otherwise in settings
     * @param filePath - Path to the file
     * @param iconId - Icon identifier to set
     */
    async setFileIcon(filePath: string, iconId: string): Promise<void> {
        const file = this.getFile(filePath);
        if (!file) {
            return;
        }

        // Try to save to frontmatter first if enabled and file is markdown
        if (this.shouldUseFrontmatterForFiles() && file.extension === 'md') {
            const field = this.settingsProvider.settings.frontmatterIconField;
            const { success } = await this.writeFrontmatterValue(file, field, iconId, 'icon');
            if (success) {
                // Remove from settings to avoid duplication
                await this.clearSettingsEntry('fileIcons', filePath);
                return;
            }
        }

        // Fall back to settings-based storage
        await this.setEntityIcon(ItemType.FILE, filePath, iconId);
    }

    /**
     * Removes an icon from a file, clearing from frontmatter if enabled, otherwise from settings
     * @param filePath - Path to the file
     */
    async removeFileIcon(filePath: string): Promise<void> {
        const file = this.getFile(filePath);
        // Try to remove from frontmatter first if enabled and file is markdown
        if (file && this.shouldUseFrontmatterForFiles() && file.extension === 'md') {
            const field = this.settingsProvider.settings.frontmatterIconField;
            const { success } = await this.writeFrontmatterValue(file, field, null, 'icon');
            if (success) {
                // Also clear from settings in case it was stored there
                await this.clearSettingsEntry('fileIcons', filePath);
                return;
            }
        }

        // Fall back to settings-based storage
        await this.removeEntityIcon(ItemType.FILE, filePath);
    }

    /**
     * Gets the icon for a file from settings storage
     * @param filePath - Path to the file
     * @returns Icon identifier or undefined if no icon is set
     */
    getFileIcon(filePath: string): string | undefined {
        return this.getEntityIcon(ItemType.FILE, filePath);
    }

    /**
     * Sets a color for a file, storing in frontmatter if enabled, otherwise in settings
     * @param filePath - Path to the file
     * @param color - Color value to set
     */
    async setFileColor(filePath: string, color: string): Promise<void> {
        if (!this.validateColor(color)) {
            return;
        }

        const file = this.getFile(filePath);
        if (!file) {
            return;
        }

        // Try to save to frontmatter first if enabled and file is markdown
        if (this.shouldUseFrontmatterForFiles() && file.extension === 'md') {
            const field = this.settingsProvider.settings.frontmatterColorField;
            const { success } = await this.writeFrontmatterValue(file, field, color, 'color');
            if (success) {
                // Remove from settings to avoid duplication
                await this.clearSettingsEntry('fileColors', filePath);
                return;
            }
        }

        // Fall back to settings-based storage
        await this.setEntityColor(ItemType.FILE, filePath, color);
    }

    /**
     * Removes a color from a file, clearing from frontmatter if enabled, otherwise from settings
     * @param filePath - Path to the file
     */
    async removeFileColor(filePath: string): Promise<void> {
        const file = this.getFile(filePath);
        // Try to remove from frontmatter first if enabled and file is markdown
        if (file && this.shouldUseFrontmatterForFiles() && file.extension === 'md') {
            const field = this.settingsProvider.settings.frontmatterColorField;
            const { success } = await this.writeFrontmatterValue(file, field, null, 'color');
            if (success) {
                // Also clear from settings in case it was stored there
                await this.clearSettingsEntry('fileColors', filePath);
                return;
            }
        }

        // Fall back to settings-based storage
        await this.removeEntityColor(ItemType.FILE, filePath);
    }

    /**
     * Migrates all file icons and colors from settings storage to frontmatter
     * Only processes markdown files and only when frontmatter storage is enabled
     * @returns Statistics about the migration including successes and failures
     */
    async migrateSettingsToFrontmatter(): Promise<FileMetadataMigrationResult> {
        const settings = this.settingsProvider.settings;
        const iconsBefore = Object.keys(settings.fileIcons || {}).length;
        const colorsBefore = Object.keys(settings.fileColors || {}).length;

        // Early return if frontmatter storage is not enabled
        if (!this.shouldUseFrontmatterForFiles()) {
            return {
                iconsBefore,
                colorsBefore,
                migratedIcons: 0,
                migratedColors: 0,
                filesUpdated: 0,
                failures: 0
            };
        }

        const iconEntries = Object.entries(settings.fileIcons || {});
        const colorEntries = Object.entries(settings.fileColors || {});
        const migratedFiles = new Set<string>();
        let migratedIcons = 0;
        let migratedColors = 0;
        let failures = 0;

        const iconField = settings.frontmatterIconField.trim();
        const colorField = settings.frontmatterColorField.trim();
        const canMigrateIcons = iconField.length > 0;
        const canMigrateColors = colorField.length > 0;

        // Migrate all icons
        if (canMigrateIcons) {
            for (const [path, iconId] of iconEntries) {
                const file = this.getFile(path);
                if (!file || file.extension !== 'md') {
                    failures += 1;
                    continue;
                }

                const { success } = await this.writeFrontmatterValue(file, iconField, iconId, 'icon');
                if (success) {
                    await this.clearSettingsEntry('fileIcons', path);
                    migratedFiles.add(path);
                    migratedIcons += 1;
                } else {
                    failures += 1;
                }
            }
        }

        // Migrate all colors
        if (canMigrateColors) {
            for (const [path, color] of colorEntries) {
                const file = this.getFile(path);
                if (!file || file.extension !== 'md') {
                    failures += 1;
                    continue;
                }

                const { success } = await this.writeFrontmatterValue(file, colorField, color, 'color');
                if (success) {
                    await this.clearSettingsEntry('fileColors', path);
                    migratedFiles.add(path);
                    migratedColors += 1;
                } else {
                    failures += 1;
                }
            }
        }

        return {
            iconsBefore,
            colorsBefore,
            migratedIcons,
            migratedColors,
            filesUpdated: migratedFiles.size,
            failures
        };
    }

    /**
     * Gets the color for a file from settings storage
     * @param filePath - Path to the file
     * @returns Color value or undefined if no color is set
     */
    getFileColor(filePath: string): string | undefined {
        return this.getEntityColor(ItemType.FILE, filePath) ?? undefined;
    }

    /**
     * Clean up pinned notes using pre-loaded validators
     * @param validators - Pre-loaded data containing vault files
     * @returns True if any metadata was removed/changed
     */
    async cleanupWithValidators(
        validators: CleanupValidators,
        targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings
    ): Promise<boolean> {
        let hasChanges = false;
        const pinnedNotes = targetSettings.pinnedNotes;
        if (pinnedNotes && Object.keys(pinnedNotes).length > 0) {
            const invalidPaths = Object.keys(pinnedNotes).filter(path => !validators.vaultFiles.has(path));

            if (invalidPaths.length > 0) {
                if (targetSettings === this.settingsProvider.settings) {
                    await this.saveAndUpdate(settings => {
                        invalidPaths.forEach(path => {
                            if (settings.pinnedNotes) {
                                delete settings.pinnedNotes[path];
                            }
                        });
                    });
                } else {
                    invalidPaths.forEach(path => {
                        if (targetSettings.pinnedNotes) {
                            delete targetSettings.pinnedNotes[path];
                        }
                    });
                }

                hasChanges = true;
            }
        }

        const fileIconCleanup = await this.cleanupMetadata(targetSettings, 'fileIcons', path => validators.vaultFiles.has(path));
        const fileColorCleanup = await this.cleanupMetadata(targetSettings, 'fileColors', path => validators.vaultFiles.has(path));

        return hasChanges || fileIconCleanup || fileColorCleanup;
    }

    /**
     * Clean up pinned notes for files that don't exist
     * @returns True if any changes were made
     */
    async cleanupPinnedNotes(targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings): Promise<boolean> {
        const vaultFiles = new Set(this.app.vault.getFiles().map(f => f.path));
        return this.cleanupWithValidators(
            {
                vaultFiles,
                vaultFolders: new Set(),
                dbFiles: [],
                tagTree: new Map()
            },
            targetSettings
        );
    }
}
