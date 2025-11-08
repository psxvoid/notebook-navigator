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

import { App, TFolder } from 'obsidian';
import { SortOption, type NotebookNavigatorSettings } from '../settings';
import { ISettingsProvider } from '../interfaces/ISettingsProvider';
import { ITagTreeProvider } from '../interfaces/ITagTreeProvider';
import { FolderMetadataService, TagMetadataService, FileMetadataService, type FileMetadataMigrationResult } from './metadata';
import { TagTreeNode } from '../types/storage';
import {  FileDataCache } from '../storage/IndexedDBStorage';
import { getDBInstance } from '../storage/fileOperations';
import { NavigatorContext } from '../types';

/**
 * Validators object containing all data needed for cleanup operations
 */
export interface CleanupValidators {
    dbFiles: { path: string; data: FileDataCache }[];
    tagTree: Map<string, TagTreeNode>;
    vaultFiles: Set<string>;
    vaultFolders: Set<string>; // Actual folder paths from vault
}

export interface MetadataCleanupSummary {
    folders: number;
    tags: number;
    files: number;
    pinnedNotes: number;
    total: number;
}

/**
 * Service for managing all folder, tag, and file metadata operations
 * Delegates to specialized sub-services for better organization
 * Provides a unified API for metadata operations
 */
export class MetadataService {
    private fileService: FileMetadataService;
    private folderService: FolderMetadataService;
    private tagService: TagMetadataService;
    private settingsProvider: ISettingsProvider;

    /**
     * Creates a new MetadataService instance
     * @param app - The Obsidian app instance
     * @param settingsProvider - Provider for accessing and saving settings
     * @param getTagTreeProvider - Function to get the tag tree provider
     */
    constructor(app: App, settingsProvider: ISettingsProvider, getTagTreeProvider: () => ITagTreeProvider | null) {
        this.settingsProvider = settingsProvider;
        // Initialize sub-services
        this.folderService = new FolderMetadataService(app, settingsProvider);
        this.tagService = new TagMetadataService(app, settingsProvider, getTagTreeProvider);
        this.fileService = new FileMetadataService(app, settingsProvider);
    }

    /**
     * Gets the settings provider for accessing and saving settings
     * @returns The settings provider instance
     */
    getSettingsProvider(): ISettingsProvider {
        return this.settingsProvider;
    }
    // ========== Folder Methods (delegated to FolderMetadataService) ==========

    async setFolderColor(folderPath: string, color: string): Promise<void> {
        return this.folderService.setFolderColor(folderPath, color);
    }

    async setFolderBackgroundColor(folderPath: string, color: string): Promise<void> {
        return this.folderService.setFolderBackgroundColor(folderPath, color);
    }

    async removeFolderColor(folderPath: string): Promise<void> {
        return this.folderService.removeFolderColor(folderPath);
    }

    async removeFolderBackgroundColor(folderPath: string): Promise<void> {
        return this.folderService.removeFolderBackgroundColor(folderPath);
    }

    getFolderColor(folderPath: string): string | undefined {
        return this.folderService.getFolderColor(folderPath);
    }

    getFolderBackgroundColor(folderPath: string): string | undefined {
        return this.folderService.getFolderBackgroundColor(folderPath);
    }

    async setFolderIcon(folderPath: string, iconId: string): Promise<void> {
        return this.folderService.setFolderIcon(folderPath, iconId);
    }

    async removeFolderIcon(folderPath: string): Promise<void> {
        return this.folderService.removeFolderIcon(folderPath);
    }

    getFolderIcon(folderPath: string): string | undefined {
        return this.folderService.getFolderIcon(folderPath);
    }

    async setFolderSortOverride(folderPath: string, sortOption: SortOption): Promise<void> {
        return this.folderService.setFolderSortOverride(folderPath, sortOption);
    }

    async removeFolderSortOverride(folderPath: string): Promise<void> {
        return this.folderService.removeFolderSortOverride(folderPath);
    }

    getFolderSortOverride(folderPath: string): SortOption | undefined {
        return this.folderService.getFolderSortOverride(folderPath);
    }

    async handleFolderRename(oldPath: string, newPath: string): Promise<void> {
        return this.folderService.handleFolderRename(oldPath, newPath);
    }

    async handleFolderDelete(folderPath: string): Promise<void> {
        return this.folderService.handleFolderDelete(folderPath);
    }

    // ========== Tag Methods (delegated to TagMetadataService) ==========

    async setTagColor(tagPath: string, color: string): Promise<void> {
        return this.tagService.setTagColor(tagPath, color);
    }

    async setTagBackgroundColor(tagPath: string, color: string): Promise<void> {
        return this.tagService.setTagBackgroundColor(tagPath, color);
    }

    async removeTagColor(tagPath: string): Promise<void> {
        return this.tagService.removeTagColor(tagPath);
    }

    async removeTagBackgroundColor(tagPath: string): Promise<void> {
        return this.tagService.removeTagBackgroundColor(tagPath);
    }

    getTagColor(tagPath: string): string | undefined {
        return this.tagService.getTagColor(tagPath);
    }

    getTagBackgroundColor(tagPath: string): string | undefined {
        return this.tagService.getTagBackgroundColor(tagPath);
    }

    async setTagIcon(tagPath: string, iconId: string): Promise<void> {
        return this.tagService.setTagIcon(tagPath, iconId);
    }

    async removeTagIcon(tagPath: string): Promise<void> {
        return this.tagService.removeTagIcon(tagPath);
    }

    getTagIcon(tagPath: string): string | undefined {
        return this.tagService.getTagIcon(tagPath);
    }

    /**
     * Updates tag metadata when a tag is renamed, optionally preserving existing overrides at the new path
     */
    async handleTagRename(oldPath: string, newPath: string, preserveExisting = false): Promise<void> {
        return this.tagService.handleTagRename(oldPath, newPath, preserveExisting);
    }

    /**
     * Removes all metadata associated with a tag and its descendants
     */
    async handleTagDelete(tagPath: string): Promise<void> {
        return this.tagService.handleTagDelete(tagPath);
    }

    async setTagSortOverride(tagPath: string, sortOption: SortOption): Promise<void> {
        return this.tagService.setTagSortOverride(tagPath, sortOption);
    }

    async removeTagSortOverride(tagPath: string): Promise<void> {
        return this.tagService.removeTagSortOverride(tagPath);
    }

    getTagSortOverride(tagPath: string): SortOption | undefined {
        return this.tagService.getTagSortOverride(tagPath);
    }

    // ========== File/Pinned Notes Methods (delegated to FileMetadataService) ==========

    async togglePin(filePath: string, context: NavigatorContext): Promise<void> {
        return this.fileService.togglePinnedNote(filePath, context);
    }

    isFilePinned(filePath: string, context?: NavigatorContext): boolean {
        return this.fileService.isPinned(filePath, context);
    }

    getPinnedNotes(context?: NavigatorContext): string[] {
        return this.fileService.getPinnedNotes(context);
    }

    async setFileIcon(filePath: string, iconId: string): Promise<void> {
        return this.fileService.setFileIcon(filePath, iconId);
    }

    async removeFileIcon(filePath: string): Promise<void> {
        return this.fileService.removeFileIcon(filePath);
    }

    /**
     * Gets the icon for a file, checking frontmatter first if enabled
     * @param filePath - Path to the file
     * @returns Icon ID if found, undefined otherwise
     */
    getFileIcon(filePath: string): string | undefined {
        const settings = this.settingsProvider.settings;
        // Check frontmatter metadata first if enabled
        if (settings.useFrontmatterMetadata) {
            const db = getDBInstance();
            const record = db.getFile(filePath);
            const frontmatterIcon = record?.metadata?.icon?.trim();
            if (frontmatterIcon) {
                return frontmatterIcon;
            }
        }
        // Fall back to settings-based storage
        return this.fileService.getFileIcon(filePath);
    }

    async setFileColor(filePath: string, color: string): Promise<void> {
        return this.fileService.setFileColor(filePath, color);
    }

    async removeFileColor(filePath: string): Promise<void> {
        return this.fileService.removeFileColor(filePath);
    }

    /**
     * Gets the color for a file, checking frontmatter first if enabled
     * @param filePath - Path to the file
     * @returns Color value if found, undefined otherwise
     */
    getFileColor(filePath: string): string | undefined {
        const settings = this.settingsProvider.settings;
        // Check frontmatter metadata first if enabled
        if (settings.useFrontmatterMetadata) {
            const db = getDBInstance();
            const record = db.getFile(filePath);
            const frontmatterColor = record?.metadata?.color?.trim();
            if (frontmatterColor) {
                return frontmatterColor;
            }
        }
        // Fall back to settings-based storage
        return this.fileService.getFileColor(filePath);
    }

    async migrateFileMetadataToFrontmatter(): Promise<FileMetadataMigrationResult> {
        return this.fileService.migrateSettingsToFrontmatter();
    }

    async handleFileDelete(filePath: string): Promise<void> {
        return this.fileService.handleFileDelete(filePath);
    }

    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        return this.fileService.handleFileRename(oldPath, newPath);
    }

    // ========== Cleanup Operations ==========

    /**
     * Cleanup metadata for folders, tags, and files
     * Called on plugin startup to remove references to deleted items
     * @returns True if any changes were made
     */
    async cleanupAllMetadata(targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings): Promise<boolean> {
        const [folderChanges, tagChanges, fileChanges] = await Promise.all([
            this.folderService.cleanupFolderMetadata(targetSettings),
            this.tagService.cleanupTagMetadata(targetSettings),
            this.fileService.cleanupPinnedNotes(targetSettings)
        ]);

        return folderChanges || tagChanges || fileChanges;
    }

    /**
     * Cleanup tag metadata for tags that no longer exist in the vault
     * Called by StorageProvider after tag tree is successfully built
     * This ensures the metadata cache is ready and all parent tags are identified
     * @returns True if any changes were made
     */
    async cleanupTagMetadata(targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings): Promise<boolean> {
        return this.tagService.cleanupTagMetadata(targetSettings);
    }

    /**
     * Run unified cleanup using pre-loaded data from StorageContext
     * This avoids multiple file iterations during startup
     *
     * @param validators - Object containing database files, tag tree, and vault files
     * @returns true if any changes were made
     */
    async runUnifiedCleanup(
        validators: CleanupValidators,
        targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings
    ): Promise<boolean> {
        const [folderChanges, tagChanges, fileChanges] = await Promise.all([
            this.folderService.cleanupWithValidators(validators, targetSettings),
            this.tagService.cleanupWithValidators(validators, targetSettings),
            this.fileService.cleanupWithValidators(validators, targetSettings)
        ]);

        return folderChanges || tagChanges || fileChanges;
    }

    async getCleanupSummary(): Promise<MetadataCleanupSummary> {
        const clonedSettings = MetadataService.cloneSettings(this.settingsProvider.settings);
        const before = MetadataService.computeMetadataCounts(clonedSettings);
        await this.cleanupAllMetadata(clonedSettings);
        const after = MetadataService.computeMetadataCounts(clonedSettings);

        const folders = Math.max(0, before.folders - after.folders);
        const tags = Math.max(0, before.tags - after.tags);
        const files = Math.max(0, before.files - after.files);
        const pinnedNotes = Math.max(0, before.pinnedNotes - after.pinnedNotes);
        const total = folders + tags + files + pinnedNotes;

        return { folders, tags, files, pinnedNotes, total };
    }

    private static cloneSettings(settings: NotebookNavigatorSettings): NotebookNavigatorSettings {
        return JSON.parse(JSON.stringify(settings)) as NotebookNavigatorSettings;
    }

    private static computeMetadataCounts(settings: NotebookNavigatorSettings) {
        const folderKeys = MetadataService.collectUniqueKeys([
            settings.folderColors,
            settings.folderBackgroundColors,
            settings.folderIcons,
            settings.folderSortOverrides,
            settings.folderAppearances
        ]);

        const tagKeys = MetadataService.collectUniqueKeys([
            settings.tagColors,
            settings.tagBackgroundColors,
            settings.tagIcons,
            settings.tagSortOverrides,
            settings.tagAppearances
        ]);

        const fileKeys = MetadataService.collectUniqueKeys([settings.fileIcons, settings.fileColors]);

        const pinnedNotes = settings.pinnedNotes ? Object.keys(settings.pinnedNotes).length : 0;

        return {
            folders: folderKeys.size,
            tags: tagKeys.size,
            files: fileKeys.size,
            pinnedNotes
        };
    }

    private static collectUniqueKeys(records: (Record<string, unknown> | undefined)[]): Set<string> {
        const result = new Set<string>();
        records.forEach(record => {
            if (!record) {
                return;
            }
            Object.keys(record).forEach(key => {
                result.add(key);
            });
        });
        return result;
    }

    /**
     * Prepares validators for metadata cleanup by collecting current vault state
     * @param app - Obsidian app instance
     * @param tagTree - Tag tree for tag metadata validation (empty Map if tags disabled)
     * @returns Validators object for cleanup
     */
    static prepareCleanupValidators(app: App, tagTree: Map<string, TagTreeNode> = new Map()): CleanupValidators {
        const db = getDBInstance();

        // Collect all files in vault
        const vaultFiles = new Set(app.vault.getFiles().map(f => f.path));

        // Recursively collect all folder paths
        const vaultFolders = new Set<string>();
        const collectAllFolderPaths = (folder: TFolder) => {
            vaultFolders.add(folder.path);
            folder.children.forEach(child => {
                if (child instanceof TFolder) {
                    collectAllFolderPaths(child);
                }
            });
        };
        collectAllFolderPaths(app.vault.getRoot());

        return {
            dbFiles: db.getAllFiles(),
            tagTree,
            vaultFiles,
            vaultFolders
        };
    }
}
