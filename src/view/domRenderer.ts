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

import { App, TFile, TFolder, setIcon } from 'obsidian';
import type { NotebookNavigatorView } from './NotebookNavigatorView';
import type NotebookNavigatorPlugin from '../main';
import { DateUtils } from '../utils/DateUtils';
import { PreviewTextUtils } from '../utils/PreviewTextUtils';
import { SortOption } from '../settings';
import { NavigatorElementAttributes } from '../types';

/**
 * DomRenderer handles all DOM rendering operations for the NotebookNavigatorView
 * Manages folder tree rendering, file list rendering, and initial DOM structure
 */
export class DomRenderer {
    private view: NotebookNavigatorView;
    private app: App;
    private plugin: NotebookNavigatorPlugin;
    private globalFolderIndexCounter: number = 0;
    private previewGeneration: number = 0;

    constructor(view: NotebookNavigatorView) {
        this.view = view;
        this.app = view.app;
        this.plugin = view.plugin;
    }

    /**
     * Creates the initial DOM structure for the navigator view
     * Sets up split container, panes, headers, and action buttons
     */
    createInitialDOM(container: HTMLElement): void {
        container.empty();
        container.addClass('notebook-navigator');
        container.tabIndex = 0;
        container.setAttribute('data-focus-pane', this.view.focusedPane);

        // Create split container
        const splitContainer = container.createDiv('nn-split-container');
        this.view.splitContainer = splitContainer;

        // Create left pane (folder tree)
        const leftPane = splitContainer.createDiv('nn-left-pane');
        leftPane.style.width = `${this.plugin.settings.leftPaneWidth}px`;
        this.view.leftPane = leftPane;

        // Create header for folder tree
        const folderHeader = leftPane.createDiv('nn-pane-header');

        const folderActions = folderHeader.createDiv('nn-header-actions');
        
        // Add expand/collapse all button first
        const expandCollapseBtn = folderActions.createEl('button', {
            cls: 'nn-icon-button nn-expand-collapse-btn',
            attr: { 'aria-label': 'Expand all folders' }
        });
        setIcon(expandCollapseBtn, 'chevrons-up-down');
        
        // Then add new folder button
        const newFolderBtn = folderActions.createEl('button', { 
            cls: 'nn-icon-button',
            attr: { 'aria-label': 'New folder' }
        });
        setIcon(newFolderBtn, 'folder-plus');

        // Note: Don't add click handler here - EventManager will handle it

        // Create folder tree container
        const folderTree = leftPane.createDiv('nn-folder-tree');
        this.view.folderTree = folderTree;

        // Create resize handle
        const resizeHandle = splitContainer.createDiv('nn-resize-handle');

        // Create right pane (file list)
        const rightPane = splitContainer.createDiv('nn-right-pane');

        // Create header for file list
        const fileHeader = rightPane.createDiv('nn-pane-header');

        const fileActions = fileHeader.createDiv('nn-header-actions');

        const newFileBtn = fileActions.createEl('button', { 
            cls: 'nn-icon-button',
            attr: { 'aria-label': 'New file' }
        });
        setIcon(newFileBtn, 'create-new');

        // Note: Don't add click handler here - EventManager will handle it

        // Create file list container
        const fileList = rightPane.createDiv('nn-file-list');
        this.view.fileList = fileList;
    }

    /**
     * Renders the complete folder tree structure
     * Handles root folder visibility and initiates recursive rendering
     */
    renderFolderTree(): void {
        if (!this.view.folderTree) return;

        this.view.folderTree.empty();
        this.globalFolderIndexCounter = 0; // Reset counter for each render

        const rootFolder = this.app.vault.getRoot();
        const ignoredFoldersSet = new Set(
            this.plugin.settings.ignoreFolders
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0)
        );

        if (this.plugin.settings.showRootFolder) {
            this.renderFolderItem(rootFolder, 0, this.view.folderTree, ignoredFoldersSet);
        } else {
            // Sort root folders alphabetically
            const rootFolders = rootFolder.children
                .filter(child => child instanceof TFolder && !this.isFolderIgnored(child, ignoredFoldersSet))
                .sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];
            
            rootFolders.forEach(child => {
                this.renderFolderItem(child, 0, this.view.folderTree, ignoredFoldersSet);
            });
        }

        this.view.updateFolderSelection();
        
        // Update expand/collapse button state
        this.view.interactionManager.updateExpandCollapseButton();
    }

    /**
     * Renders a single folder item and its children recursively
     * Creates DOM elements for folder with toggle, name, and file count
     */
    public renderFolderItem(
        folder: TFolder, 
        depth: number, 
        parentEl: HTMLElement, 
        ignoredFoldersSet: Set<string>
    ): void {
        const isExpanded = this.view.expandedFolders.has(folder.path);
        const hasCustomIcon = this.plugin.settings.folderIcons?.[folder.path] ? true : false;
        const folderItem = parentEl.createDiv({
            cls: 'nn-folder-item',
            attr: {
                'data-path': folder.path,
                'data-clickable': 'folder',
                'data-click-path': folder.path,
                'data-drop-zone': 'folder',
                'data-drop-path': folder.path,
                'data-context-menu': 'folder',
                'data-index': this.globalFolderIndexCounter.toString(),
                'data-depth': depth.toString(),
                'data-has-custom-icon': hasCustomIcon ? 'true' : 'false'
            }
        });
        this.globalFolderIndexCounter++;

        // Folder content container (includes arrow, icon, name)
        const folderContent = folderItem.createDiv({
            cls: 'nn-folder-content',
            attr: { 
                'data-draggable': 'true', 
                'data-drag-type': 'folder', 
                'data-drag-path': folder.path,
                'data-drag-handle': 'true',
                'data-clickable': 'folder',
                'data-click-path': folder.path,
                'data-context-menu': 'folder',
                'draggable': 'true'
            }
        });
        folderContent.style.paddingLeft = `${depth * 20}px`;

        // Check if folder has visible subfolders
        const hasVisibleChildren = folder.children.some(child => 
            child instanceof TFolder && !this.isFolderIgnored(child, ignoredFoldersSet)
        );

        // Arrow icon (inside folderContent)
        if (hasVisibleChildren) {
            const arrow = folderContent.createDiv('nn-folder-arrow');
            setIcon(arrow, isExpanded ? 'chevron-down' : 'chevron-right');
            // Add data attribute for arrow clicks
            arrow.setAttribute('data-folder-arrow', folder.path);
        } else {
            folderContent.createDiv('nn-folder-arrow nn-no-children');
        }

        const folderIcon = folderContent.createDiv('nn-folder-icon');
        
        // Check for custom icon
        const customIcon = this.plugin.settings.folderIcons?.[folder.path];
        if (customIcon) {
            // Use custom icon - it stays the same regardless of expanded state
            setIcon(folderIcon, customIcon);
        } else {
            // Use default folder icon that changes based on expanded state
            const shouldShowOpen = hasVisibleChildren && this.view.expandedFolders.has(folder.path);
            setIcon(folderIcon, shouldShowOpen ? 'folder-open' : 'folder-closed');
        }

        const folderName = folderContent.createDiv('nn-folder-name');
        folderName.textContent = folder.name || 'Vault';

        // Add file count if enabled
        if (this.plugin.settings.showFolderFileCount) {
            const count = this.getFileCount(folder);
            if (count > 0) {
                const fileCount = folderContent.createDiv('nn-folder-count');
                fileCount.textContent = count.toString();
            }
        }

        // Render children if expanded
        if (isExpanded) {
            // Create children container
            const childrenContainer = folderItem.createDiv('nn-folder-children');
            childrenContainer.addClass('nn-expanded');
            
            // Get and sort subfolders
            const subfolders = folder.children
                .filter(child => child instanceof TFolder && !this.isFolderIgnored(child, ignoredFoldersSet))
                .sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];
            
            // Render sorted subfolders into the children container
            subfolders.forEach(subfolder => {
                this.renderFolderItem(subfolder, depth + 1, childrenContainer, ignoredFoldersSet);
            });
        }
    }

    /**
     * Checks if a folder should be ignored based on settings
     */
    private isFolderIgnored(folder: TFolder, ignoredFoldersSet: Set<string>): boolean {
        return ignoredFoldersSet.has(folder.name);
    }

    /**
     * Counts the number of markdown files in a folder (direct children only)
     */
    private getFileCount(folder: TFolder): number {
        const excludedProperties = this.plugin.settings.excludedFiles
            .split(',')
            .map(p => p.trim())
            .filter(p => p);
        
        return folder.children.filter(child => {
            if (!(child instanceof TFile && this.isDisplayableFile(child))) {
                return false;
            }
            
            // Check if file should be excluded based on frontmatter
            if (excludedProperties.length > 0 && this.shouldExcludeFile(child, excludedProperties)) {
                return false;
            }
            
            return true;
        }).length;
    }

    /**
     * Checks if a file should be displayed based on its extension
     */
    private isDisplayableFile(file: TFile): boolean {
        const supportedExtensions = ['.md', '.canvas', '.base'];
        return supportedExtensions.some(ext => file.extension === ext.substring(1));
    }

    /**
     * Updates file counts for all visible folders
     */
    updateFolderCounts(): void {
        if (!this.plugin.settings.showFolderFileCount) return;

        const folderElements = this.view.folderTree.querySelectorAll('.nn-folder-item');
        folderElements.forEach(el => {
            const path = el.getAttribute('data-path');
            if (path) {
                const folder = this.app.vault.getAbstractFileByPath(path);
                if (folder instanceof TFolder) {
                    const count = this.getFileCount(folder);
                    // Use a more specific selector to avoid selecting within child folders
                    const countEl = el.querySelector(':scope > .nn-folder-content > .nn-folder-count') as HTMLElement;
                    
                    if (count > 0) {
                        if (countEl) {
                            countEl.textContent = count.toString();
                        } else {
                            const folderContent = el.querySelector(':scope > .nn-folder-content');
                            if (folderContent) {
                                const newCountEl = folderContent.createDiv('nn-folder-count');
                                newCountEl.textContent = count.toString();
                            }
                        }
                    } else if (countEl) {
                        countEl.remove();
                    }
                }
            }
        });
    }

    /**
     * Refreshes the file list for the currently selected folder
     * Handles pinned notes, sorting, and empty folder messages
     */
    async refreshFileList(): Promise<void> {
        if (!this.view.fileList) return;

        this.view.fileList.empty();

        if (!this.view.selectedFolder) {
            this.view.fileList.createDiv('nn-empty-state').setText('Select a folder to view files');
            this.view.updateFileSelection();
            return;
        }

        // Get ignored folders
        const ignoredFolders = this.plugin.settings.ignoreFolders
            .split(',')
            .map(f => f.trim())
            .filter(f => f);

        let files: TFile[];
        if (this.plugin.settings.showNotesFromSubfolders) {
            files = this.collectFilesRecursively(this.view.selectedFolder, ignoredFolders);
        } else {
            files = this.view.selectedFolder.children
                .filter(child => child instanceof TFile && this.isDisplayableFile(child)) as TFile[];
        }

        // Filter out files based on frontmatter properties
        const excludedProperties = this.plugin.settings.excludedFiles
            .split(',')
            .map(p => p.trim())
            .filter(p => p);

        if (excludedProperties.length > 0) {
            files = files.filter(file => !this.shouldExcludeFile(file, excludedProperties));
        }

        // Separate pinned and unpinned files
        const pinnedPaths = this.plugin.settings.showNotesFromSubfolders
            ? this.getPinnedNotesRecursively(this.view.selectedFolder, ignoredFolders)
            : this.plugin.settings.pinnedNotes[this.view.selectedFolder.path] || [];
        const pinnedFiles: TFile[] = [];
        const unpinnedFiles: TFile[] = [];

        files.forEach(file => {
            if (pinnedPaths.includes(file.path)) {
                pinnedFiles.push(file);
            } else {
                unpinnedFiles.push(file);
            }
        });

        // Check if folder changed before setting previousFolder
        const folderChanged = this.view.selectedFolder !== this.view.previousFolder;
        this.view.previousFolder = this.view.selectedFolder;

        // Sort files based on current sort option
        this.sortFiles(pinnedFiles);
        this.sortFiles(unpinnedFiles);

        // Render pinned files first if any exist
        let globalIndex = 0;
        if (pinnedFiles.length > 0) {
            // Create pinned group header
            const pinnedHeader = this.view.fileList.createDiv('nn-date-group-header');
            pinnedHeader.setText('📌 Pinned');
            
            // Render pinned files
            for (const file of pinnedFiles) {
                this.renderFileItem(file, globalIndex, true);
                globalIndex++;
            }
        }

        // Now render unpinned files with proper selection
        if (this.plugin.settings.groupByDate && this.plugin.settings.sortOption !== 'title') {
            this.renderUnpinnedFilesWithDateGroups(unpinnedFiles, globalIndex);
        } else {
            for (const file of unpinnedFiles) {
                this.renderFileItem(file, globalIndex, false);
                globalIndex++;
            }
        }

        if (pinnedFiles.length === 0 && unpinnedFiles.length === 0) {
            const emptyMessage = this.view.fileList.createDiv('nn-empty-state');
            emptyMessage.textContent = 'No files in this folder';
        }

        // Auto-selection logic
        const allFiles = [...pinnedFiles, ...unpinnedFiles];
        
        // When loading, restore the previously selected file if it exists
        if (this.view.isLoading && this.view.selectedFile && allFiles.some(f => f.path === this.view.selectedFile!.path)) {
            // Find the index of the selected file
            const selectedIndex = allFiles.findIndex(f => f.path === this.view.selectedFile!.path);
            if (selectedIndex >= 0) {
                this.view.focusedFileIndex = selectedIndex;
            }
            this.view.interactionManager.previewFile(this.view.selectedFile);
        }
        // Otherwise, auto-select and preview the first file when folder changes
        else if (allFiles.length > 0 && folderChanged && !this.view.isLoading) {
            this.view.selectedFile = allFiles[0];
            this.view.focusedFileIndex = 0;
            this.view.interactionManager.previewFile(allFiles[0]);
            this.view.stateManager.saveState();
        }

        this.view.updateFileSelection();
        this.view.calculateFocusedFileIndex();
    }


    /**
     * Renders a single file item in the file list
     * Creates file display with name, date, preview/path, and optional feature image
     * Sets up click handlers for selection and preview
     * Handles both normal and subfolder display modes
     * @param file - The file to render
     * @param index - Index for keyboard navigation
     * @param isPinned - Whether the file is pinned
     */
    private renderFileItem(file: TFile, index: number, isPinned: boolean): void {
        // Prepare file element attributes
        const fileAttrs: NavigatorElementAttributes = {
            'data-path': file.path,
            'data-index': index.toString(),
            'data-draggable': 'true',
            'data-drag-type': 'file',
            'data-drag-path': file.path,
            'data-clickable': 'file',
            'data-click-path': file.path,
            'data-context-menu': 'file',
            'draggable': 'true'
        };
        
        const fileEl = this.view.fileList.createDiv({
            cls: 'nn-file-item',
            attr: fileAttrs as any
        });

        if (this.view.focusedPane === 'files' && index === this.view.focusedFileIndex) {
            fileEl.addClass('nn-focused');
        }

        const fileContent = fileEl.createDiv('nn-file-content');
        
        // Create text content container
        const textContent = fileContent.createDiv('nn-file-text-content');
        
        // File name only
        const fileName = textContent.createDiv('nn-file-name');
        fileName.textContent = file.basename;

        // Create second line with date and either preview or parent folder
        const secondLine = textContent.createDiv('nn-file-second-line');
        
        // Show date based on sort option
        const fileDate = secondLine.createDiv('nn-file-date');
        const sortOption = this.plugin.settings.sortOption;
        if (sortOption === 'created') {
            fileDate.textContent = DateUtils.formatDate(file.stat.ctime, this.plugin.settings.dateFormat);
        } else {
            fileDate.textContent = DateUtils.formatDate(file.stat.mtime, this.plugin.settings.dateFormat);
        }
        
        if (this.plugin.settings.showNotesFromSubfolders) {
            // Show parent folder for files in subfolders, preview for files in current folder
            const relativePath = this.getRelativePath(file, this.view.selectedFolder!);
            if (relativePath) {
                // File is in a subfolder - show parent folder
                const parentFolder = secondLine.createDiv('nn-file-parent-folder');
                parentFolder.textContent = relativePath;
            } else if (this.plugin.settings.showFilePreview) {
                // File is in current folder - show preview or file type
                const preview = secondLine.createDiv('nn-file-preview');
                if (file.extension === 'canvas') {
                    preview.textContent = 'CANVAS';
                } else if (file.extension === 'base') {
                    preview.textContent = 'BASE';
                } else {
                    // Show preview text for markdown files
                    const generation = ++this.previewGeneration;
                    this.app.vault.cachedRead(file).then(content => {
                        // Only update if this is still the current request
                        if (generation === this.previewGeneration) {
                            const previewText = PreviewTextUtils.extractPreviewText(content, this.plugin.settings);
                            if (previewText && preview.parentElement) {
                                preview.textContent = previewText;
                            }
                        }
                    });
                }
            }
        } else if (this.plugin.settings.showFilePreview) {
            // Normal mode - show preview text or file type
            const preview = secondLine.createDiv('nn-file-preview');
            if (file.extension === 'canvas') {
                preview.textContent = 'CANVAS';
            } else if (file.extension === 'base') {
                preview.textContent = 'BASE';
            } else {
                // Show preview text for markdown files
                const generation = ++this.previewGeneration;
                this.app.vault.cachedRead(file).then(content => {
                    // Only update if this is still the current request
                    if (generation === this.previewGeneration) {
                        const previewText = PreviewTextUtils.extractPreviewText(content, this.plugin.settings);
                        if (previewText && preview.parentElement) {
                            preview.textContent = previewText;
                        }
                    }
                });
            }
        }

        // Add feature image if enabled
        if (this.plugin.settings.showFeatureImage) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.[this.plugin.settings.featureImageProperty]) {
                const imagePath = metadata.frontmatter[this.plugin.settings.featureImageProperty];
                this.renderFeatureImage(fileContent, imagePath, file);
            }
        }

        if (this.view.selectedFile === file) {
            fileEl.addClass('nn-selected');
        }
    }

    /**
     * Sorts an array of files based on current sort settings
     */
    private sortFiles(files: TFile[]): void {
        const sortOption = this.plugin.settings.sortOption;
        
        files.sort((a, b) => {
            switch (sortOption) {
                case 'modified':
                    return b.stat.mtime - a.stat.mtime;
                case 'created':
                    return b.stat.ctime - a.stat.ctime;
                case 'title':
                    return a.basename.localeCompare(b.basename);
                default:
                    return 0;
            }
        });
    }

    /**
     * Wrapper method to render files grouped by date
     * Delegates to renderUnpinnedFilesWithDateGroups with starting index 0
     * @param files - Array of files to render with date grouping
     */
    private renderFilesWithDateGroups(files: TFile[]) {
        this.renderUnpinnedFilesWithDateGroups(files, 0);
    }

    /**
     * Renders files grouped by date categories (Today, Yesterday, This Week, etc.)
     * Creates sticky headers for each date group with files listed below
     * Groups are based on file modification or creation date per sort settings
     * @param files - Array of files to render
     * @param startIndex - Starting index for keyboard navigation
     */
    private renderUnpinnedFilesWithDateGroups(files: TFile[], startIndex: number) {
        const groups = new Map<string, TFile[]>();
        const groupOrder: string[] = [];
        
        // Group files by date
        files.forEach((file) => {
            const timestamp = this.plugin.settings.sortOption === 'modified' 
                ? file.stat.mtime 
                : file.stat.ctime;
            const group = DateUtils.getDateGroup(timestamp);
            
            if (!groups.has(group)) {
                groups.set(group, []);
                groupOrder.push(group);
            }
            groups.get(group)!.push(file);
        });
        
        // Render each group
        let globalIndex = startIndex;
        for (const groupName of groupOrder) {
            // Create group header
            const groupHeader = this.view.fileList.createDiv('nn-date-group-header');
            groupHeader.setText(groupName);
            
            // Render files in this group
            const groupFiles = groups.get(groupName)!;
            for (const file of groupFiles) {
                this.renderFileItem(file, globalIndex, false);
                globalIndex++;
            }
        }
    }

    /**
     * Recursively collects all markdown files from a folder and its subfolders
     * Respects ignored folders setting and only includes .md files
     * Used when showNotesFromSubfolders setting is enabled
     * @param folder - Root folder to start collection from
     * @param ignoredFolders - List of folder names to skip
     * @returns Array of all markdown files found
     */
    private collectFilesRecursively(folder: TFolder, ignoredFolders: string[]): TFile[] {
        let files: TFile[] = [];
        
        folder.children.forEach(child => {
            if (child instanceof TFile && this.isDisplayableFile(child)) {
                files.push(child);
            } else if (child instanceof TFolder && !ignoredFolders.includes(child.name)) {
                // Recursively collect from subfolders
                files = files.concat(this.collectFilesRecursively(child, ignoredFolders));
            }
        });
        
        return files;
    }

    /**
     * Checks if a file should be excluded based on its frontmatter properties
     * Files are excluded if they contain any of the properties listed in excludedFiles setting
     * @param file - The file to check
     * @param excludedProperties - Array of property names that should cause exclusion
     * @returns True if the file should be excluded
     */
    private shouldExcludeFile(file: TFile, excludedProperties: string[]): boolean {
        if (excludedProperties.length === 0) return false;
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter) return false;
        
        // Check if any excluded property exists in the frontmatter
        return excludedProperties.some(prop => prop in metadata.frontmatter!);
    }

    /**
     * Recursively collects paths of all pinned notes in folder hierarchy
     * Includes pinned notes from current folder and all subfolders
     * Used when showNotesFromSubfolders is enabled to gather all pins
     * @param folder - Root folder to start collection from
     * @param ignoredFolders - List of folder names to skip
     * @returns Array of file paths for all pinned notes
     */
    private getPinnedNotesRecursively(folder: TFolder, ignoredFolders: string[]): string[] {
        let pinnedPaths: string[] = [];
        
        // Get pinned notes from current folder
        const currentPinned = this.plugin.settings.pinnedNotes[folder.path] || [];
        pinnedPaths = pinnedPaths.concat(currentPinned);
        
        // Recursively get from subfolders
        folder.children.forEach(child => {
            if (child instanceof TFolder && !ignoredFolders.includes(child.name)) {
                pinnedPaths = pinnedPaths.concat(
                    this.getPinnedNotesRecursively(child, ignoredFolders)
                );
            }
        });
        
        return pinnedPaths;
    }

    /**
     * Calculates the relative path from a base folder to a file's parent
     * Used to display parent folder path for files in subfolders
     * Returns empty string if file is directly in the base folder
     * @param file - The file to get relative path for
     * @param baseFolder - The base folder to calculate path from
     * @returns Relative path string (e.g., "subfolder/nested")
     */
    private getRelativePath(file: TFile, baseFolder: TFolder): string {
        if (file.parent === baseFolder) {
            return '';
        }
        
        // Build path from file's parent up to base folder
        let path = '';
        let current = file.parent;
        
        while (current && current !== baseFolder && current.path !== '/') {
            path = current.name + (path ? '/' + path : '');
            current = current.parent;
        }
        
        return path;
    }

    /**
     * Renders a feature image thumbnail for a file
     * Supports both standard paths and wiki-style links [[image.png]]
     * Resolves image paths relative to the file's location
     * @param container - Container element to add the image to
     * @param imagePath - Path to the image from frontmatter
     * @param file - The file that contains the image reference
     */
    private renderFeatureImage(container: HTMLElement, imagePath: string, file: TFile) {
        const imageContainer = container.createDiv('nn-feature-image');
        const img = imageContainer.createEl('img');
        
        // Resolve the image path relative to the file
        let resolvedPath = imagePath;
        
        // Handle wiki-style links
        if (imagePath.startsWith('[[') && imagePath.endsWith(']]')) {
            resolvedPath = imagePath.slice(2, -2);
        }
        
        // Get the absolute path
        const linkPath = this.app.metadataCache.getFirstLinkpathDest(resolvedPath, file.path);
        if (linkPath) {
            const resourcePath = this.app.vault.getResourcePath(linkPath);
            if (resourcePath) {
                img.src = resourcePath;
                img.alt = 'Feature image';
                img.addClass('nn-feature-image-img');
            }
        }
    }
}