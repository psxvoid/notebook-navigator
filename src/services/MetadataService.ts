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

import { App } from 'obsidian';
import { SortOption } from '../settings';
import { ISettingsProvider } from '../interfaces/ISettingsProvider';
import { ITagTreeProvider } from '../interfaces/ITagTreeProvider';
import { FolderMetadataService, TagMetadataService, FileMetadataService } from './metadata';
import { TagTreeNode } from '../types/storage';
import { FileData } from '../storage/IndexedDBStorage';

/**
 * Validators object containing all data needed for cleanup operations
 */
export interface CleanupValidators {
    dbFiles: Array<{ path: string; data: FileData }>;
    tagTree: Map<string, TagTreeNode>;
    vaultFiles: Set<string>;
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

    /**
     * Creates a new MetadataService instance
     * @param app - The Obsidian app instance
     * @param settingsProvider - Provider for accessing and saving settings
     * @param getTagTreeProvider - Function to get the tag tree provider
     */
    constructor(app: App, settingsProvider: ISettingsProvider, getTagTreeProvider: () => ITagTreeProvider | null) {
        // Initialize sub-services
        this.folderService = new FolderMetadataService(app, settingsProvider);
        this.tagService = new TagMetadataService(app, settingsProvider, getTagTreeProvider);
        this.fileService = new FileMetadataService(app, settingsProvider);
    }
    // ========== Folder Methods (delegated to FolderMetadataService) ==========

    async setFolderColor(folderPath: string, color: string): Promise<void> {
        return this.folderService.setFolderColor(folderPath, color);
    }

    async removeFolderColor(folderPath: string): Promise<void> {
        return this.folderService.removeFolderColor(folderPath);
    }

    getFolderColor(folderPath: string): string | undefined {
        return this.folderService.getFolderColor(folderPath);
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

    async removeTagColor(tagPath: string): Promise<void> {
        return this.tagService.removeTagColor(tagPath);
    }

    getTagColor(tagPath: string): string | undefined {
        return this.tagService.getTagColor(tagPath);
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

    async togglePinnedNote(folderPath: string, filePath: string): Promise<void> {
        return this.fileService.togglePinnedNote(folderPath, filePath);
    }

    isPinned(folderPath: string, filePath: string): boolean {
        return this.fileService.isPinned(folderPath, filePath);
    }

    getPinnedNotes(folderPath: string): string[] {
        return this.fileService.getPinnedNotes(folderPath);
    }

    async handleFileDelete(filePath: string): Promise<void> {
        return this.fileService.handleFileDelete(filePath);
    }

    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        return this.fileService.handleFileRename(oldPath, newPath);
    }

    // ========== Cleanup Operations ==========

    /**
     * Cleanup metadata for files and folders only
     * Called on plugin startup to remove references to deleted files and folders
     * Note: Tag cleanup is intentionally excluded and handled separately after tag tree building
     * @returns True if any changes were made
     */
    async cleanupAllMetadata(): Promise<boolean> {
        // Run cleanup for folders and files only
        // Tag cleanup is handled separately in StorageProvider after tag tree is built
        // This ensures parent tags are properly identified before cleanup
        const [folderChanges, fileChanges] = await Promise.all([
            this.folderService.cleanupFolderMetadata(),
            this.fileService.cleanupPinnedNotes()
        ]);

        return folderChanges || fileChanges;
    }

    /**
     * Cleanup tag metadata for tags that no longer exist in the vault
     * Called by StorageProvider after tag tree is successfully built
     * This ensures the metadata cache is ready and all parent tags are identified
     * @returns True if any changes were made
     */
    async cleanupTagMetadata(): Promise<boolean> {
        return this.tagService.cleanupTagMetadata();
    }

    /**
     * Run unified cleanup using pre-loaded data from StorageContext
     * This avoids multiple file iterations during startup
     * @param validators - Object containing database files, tag tree, and vault files
     * @returns true if any changes were made
     */
    async runUnifiedCleanup(validators: CleanupValidators): Promise<boolean> {
        let hasChanges = false;

        // Run all cleanup operations in parallel using the provided data
        const [folderChanges, fileChanges, tagChanges] = await Promise.all([
            this.folderService.cleanupWithValidators(validators),
            this.fileService.cleanupWithValidators(validators),
            this.tagService.cleanupWithValidators(validators)
        ]);

        hasChanges = folderChanges || fileChanges || tagChanges;

        return hasChanges;
    }
}
