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

import { 
    App, 
    TFile, 
    TFolder, 
    TAbstractFile,
    Menu,
    setIcon,
    Notice,
    normalizePath
} from 'obsidian';
import type { NotebookNavigatorView } from './NotebookNavigatorView';
import type NotebookNavigatorPlugin from '../main';
import { getInternalPlugin, executeCommand } from '../utils/typeGuards';

/**
 * InteractionManager handles all user interactions for the NotebookNavigatorView
 * Manages folder/file selection, creation, deletion, context menus, and more
 */
export class InteractionManager {
    private view: NotebookNavigatorView;
    private app: App;
    private plugin: NotebookNavigatorPlugin;

    constructor(view: NotebookNavigatorView) {
        this.view = view;
        this.app = view.app;
        this.plugin = view.plugin;
    }

    /**
     * Selects a folder and updates the file list to show its contents
     * Updates visual selection state and triggers file list refresh
     * Saves state unless currently loading to preserve user's selection
     * @param folder - The folder to select
     */
    selectFolder(folder: TFolder): void {
        // Remove previous selection
        const previousSelected = this.view.folderTree.querySelector('.nn-selected');
        if (previousSelected) {
            previousSelected.removeClass('nn-selected');
        }

        // Add new selection
        const folderEl = this.view.folderTree.querySelector(`[data-path="${CSS.escape(folder.path)}"]`);
        if (folderEl) {
            folderEl.addClass('nn-selected');
            
            // Update the focused folder index for keyboard navigation
            // Calculate the actual index based on current DOM position
            const allFolders = Array.from(this.view.folderTree.querySelectorAll('.nn-folder-item'));
            const actualIndex = allFolders.findIndex(el => el.getAttribute('data-path') === folder.path);
            if (actualIndex >= 0) {
                this.view.focusedFolderIndex = actualIndex;
            }
        }

        this.view.selectedFolder = folder;
        this.view.domRenderer.refreshFileList();
        
        // Save state after selecting folder
        if (!this.view.isLoading) {
            this.view.stateManager.saveState();
        }
    }

    /**
     * Updates DOM to show/hide child folders with smooth animation
     * Updates arrow icon direction and saves expansion state
     * @param folder - The folder to toggle
     */
    toggleFolder(folder: TFolder): void {
        const folderEl = this.view.folderTree.querySelector(`[data-path="${CSS.escape(folder.path)}"]`);
        if (!folderEl) return;

        // Get ignored folders
        const ignoredFolders = this.plugin.settings.ignoreFolders
            .split(',')
            .map(f => f.trim())
            .filter(f => f);

        const isExpanded = this.view.expandedFolders.has(folder.path);
        const arrow = folderEl.querySelector('.nn-folder-arrow');
        
        if (isExpanded) {
            // Collapse folder
            this.view.expandedFolders.delete(folder.path);
            const childrenContainer = folderEl.querySelector('.nn-folder-children') as HTMLElement;
            
            if (childrenContainer) {
                // Animate from current height to 0
                childrenContainer.style.maxHeight = childrenContainer.scrollHeight + 'px';
                childrenContainer.offsetHeight; // Force reflow
                
                childrenContainer.addClass('nn-animating');
                childrenContainer.removeClass('nn-expanded');
                childrenContainer.style.maxHeight = '0px';
                
                setTimeout(() => childrenContainer.remove(), 180);
            }
            
            if (arrow) setIcon(arrow as HTMLElement, 'chevron-right');
            
            // Update folder icon only if no custom icon
            const folderIcon = folderEl.querySelector('.nn-folder-icon');
            if (folderIcon && !this.plugin.settings.folderIcons?.[folder.path]) {
                setIcon(folderIcon as HTMLElement, 'folder-closed');
            }
        } else {
            // Expand folder
            this.view.expandedFolders.add(folder.path);
            
            if (arrow) setIcon(arrow as HTMLElement, 'chevron-down');
            
            // Update folder icon only if no custom icon
            const folderIcon = folderEl.querySelector('.nn-folder-icon');
            if (folderIcon && !this.plugin.settings.folderIcons?.[folder.path]) {
                setIcon(folderIcon as HTMLElement, 'folder-open');
            }
            
            // Create children container and render subfolders incrementally
            const childrenContainer = folderEl.createDiv('nn-folder-children');
            
            // Get current folder depth from the data attribute or padding
            const currentDepth = parseInt(folderEl.getAttribute('data-depth') || '0');
            
            // Get and sort subfolders
            const ignoredFoldersSet = new Set(ignoredFolders);
            const subfolders = folder.children
                .filter(child => child instanceof TFolder && !ignoredFoldersSet.has(child.name))
                .sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];
            
            // Render subfolders into the children container
            subfolders.forEach(subfolder => {
                this.view.domRenderer.renderFolderItem(subfolder, currentDepth + 1, childrenContainer, ignoredFoldersSet);
            });
            
            // Update folder counts for all folders except the one being expanded
            // The parent folder already has its count from initial render
            this.view.domRenderer.updateFolderCounts();
            
            // Animate from 0 to full height
            childrenContainer.style.maxHeight = '0px';
            childrenContainer.offsetHeight; // Force reflow
            
            childrenContainer.addClass('nn-animating');
            childrenContainer.addClass('nn-expanded');
            childrenContainer.style.maxHeight = childrenContainer.scrollHeight + 'px';
            
            setTimeout(() => {
                childrenContainer.removeClass('nn-animating');
                childrenContainer.style.maxHeight = '';
            }, 180);
        }
        
        // Save state
        this.view.stateManager.saveState();
        
        // Update expand/collapse button state
        this.updateExpandCollapseButton();
        
        // Ensure folder selection is maintained
        this.view.updateFolderSelection();
        
        // Scroll to ensure expanded content is visible (only when expanding)
        if (!isExpanded) {
            setTimeout(() => {
                const folderEl = this.view.folderTree.querySelector(`[data-path="${CSS.escape(folder.path)}"]`);
                if (!folderEl) return;
                
                const childrenContainer = folderEl.querySelector('.nn-folder-children');
                if (!childrenContainer) return;
                
                // Scroll to ensure all subfolders are visible
                const container = this.view.folderTree;
                const folderRect = (folderEl as HTMLElement).getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const lastChild = childrenContainer.lastElementChild as HTMLElement;
                
                if (lastChild) {
                    const lastChildRect = lastChild.getBoundingClientRect();
                    
                    // Check if the last subfolder is below the visible area
                    if (lastChildRect.bottom > containerRect.bottom) {
                        // Calculate how much we need to scroll down to show the expanded content
                        const scrollAmount = lastChildRect.bottom - containerRect.bottom + 20; // 20px padding
                        container.scrollTop += scrollAmount;
                    }
                    // Only scroll up if the folder header is completely hidden AND we haven't already scrolled down
                    else if (folderRect.bottom < containerRect.top) {
                        // Scroll just enough to show the folder header, not to the top
                        const scrollAmount = containerRect.top - folderRect.top;
                        container.scrollTop -= scrollAmount;
                    }
                }
            }, 180); // Match animation timing
        }
    }

    /**
     * Previews a file without fully opening it
     * Updates selection state and optionally opens the file
     * @param file - The file to preview
     */
    previewFile(file: TFile): void {
        this.view.selectedFile = file;
        this.view.updateFileSelection();
        this.view.stateManager.saveState();
        
        // Update focused file index
        this.view.calculateFocusedFileIndex();
        this.view.uiHelper.updateFocus();
        
        // Open file in preview mode
        const leaf = this.app.workspace.getLeaf(false);
        leaf.openFile(file, { active: false });
        
        // Scroll the file into view
        setTimeout(() => {
            this.view.uiHelper.scrollSelectedFileIntoView();
        }, 50);
    }

    /**
     * Opens a file in the main editor pane
     * Used when user double-clicks a file or presses Enter
     * @param file - The file to open
     * @param newPane - Whether to open in a new pane
     */
    openFile(file: TFile, newPane: boolean = false): void {
        this.view.selectedFile = file;
        this.view.updateFileSelection();
        this.view.stateManager.saveState();
        this.app.workspace.getLeaf(newPane).openFile(file);
    }

    /**
     * Handles when the active file changes in the editor
     * Syncs navigator selection with active editor file
     * Respects autoRevealActiveFile setting for folder switching
     * Ignores changes from non-editor panes and ignored folders
     */
    async handleActiveFileChange(): Promise<void> {
        try {
            // Only process changes from the main editor area
            // Note: We specifically need activeLeaf here to check its location (rootSplit),
            // not to access a view. This ensures we don't react to files opened in popups/sidebars.
            const activeLeaf = this.app.workspace.activeLeaf;
            if (!activeLeaf || activeLeaf.getRoot() !== this.app.workspace.rootSplit) {
                return;
            }
            
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) return;
            
            // Skip if already selected
            if (this.view.selectedFile?.path === activeFile.path) return;
            
            // Check if file should be ignored
            const ignoredFolders = this.plugin.settings.ignoreFolders
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);
            
            const isIgnored = ignoredFolders.some(folder => {
                const folderPath = folder.endsWith('/') ? folder : folder + '/';
                return activeFile.path.startsWith(folderPath);
            });
            
            if (isIgnored) return;
            
            // If no folder is selected, always reveal the file
            if (!this.view.selectedFolder) {
                this.view.revealFile(activeFile);
                return;
            }
            
            // Check if auto-reveal is enabled
            if (this.plugin.settings.autoRevealActiveFile) {
                // Always reveal the file, switching folders if needed
                this.view.revealFile(activeFile);
            } else {
                // Original behavior - only select if visible in current view
                if (this.isFileInCurrentView(activeFile)) {
                    // For newly created files, the DOM might not be updated yet
                    const fileEl = this.view.fileList.querySelector(`[data-path="${CSS.escape(activeFile.path)}"]`);
                    if (!fileEl) {
                        // File list needs refresh first
                        await this.view.domRenderer.refreshFileList();
                        // Defer selection after DOM update
                        setTimeout(() => {
                            this.selectFileWithoutOpening(activeFile);
                        }, 50);
                    } else {
                        this.selectFileWithoutOpening(activeFile);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling active file change:', error);
            new Notice(`Failed to update file view: ${error.message}`);
        }
    }

    /**
     * Creates a new markdown file with user input for name
     * Delegates to FileSystemOperations for creation and opening
     * @param parent - Optional parent folder, defaults to selected folder or root
     */
    async createNewFile(parent?: TFolder): Promise<void> {
        const targetFolder = parent || this.view.selectedFolder || this.app.vault.getRoot();
        await this.view.fileSystemOps.createNewFile(targetFolder);
    }

    /**
     * Creates a new folder with user input for name
     * Expands parent folder and selects the new folder after creation
     * Uses FileSystemOperations for the actual creation logic
     * @param parent - Optional parent folder, defaults to selected folder or root
     */
    async createNewFolder(parent?: TFolder): Promise<void> {
        const targetFolder = parent || this.view.selectedFolder || this.app.vault.getRoot();
        
        // Ensure parent folder will be expanded BEFORE creating the new folder
        if (targetFolder.path) {
            this.view.expandedFolders.add(targetFolder.path);
        }
        
        await this.view.fileSystemOps.createNewFolder(targetFolder);
    }

    /**
     * Deletes a file with optional confirmation dialog
     * Respects user's confirmation preference from settings
     * Selects and opens the next file after deletion
     * @param file - The file to delete
     */
    async deleteFile(file: TFile): Promise<void> {
        // Store the current file index before deletion
        const fileItems = Array.from(this.view.fileList.querySelectorAll('.nn-file-item'));
        const currentIndex = fileItems.findIndex(el => el.getAttribute('data-path') === file.path);
        
        await this.view.fileSystemOps.deleteFile(file, this.plugin.settings.confirmBeforeDelete, () => {
            // After successful deletion, select the next file
            setTimeout(() => {
                const updatedFileItems = Array.from(this.view.fileList.querySelectorAll('.nn-file-item'));
                if (updatedFileItems.length > 0) {
                    // Try to select the file at the same index, or the last one if index is out of bounds
                    const newIndex = Math.min(currentIndex, updatedFileItems.length - 1);
                    const nextFileEl = updatedFileItems[newIndex];
                    const nextFilePath = nextFileEl?.getAttribute('data-path');
                    
                    if (nextFilePath) {
                        const nextFile = this.app.vault.getAbstractFileByPath(nextFilePath);
                        if (nextFile && nextFile instanceof TFile) {
                            this.view.selectedFile = nextFile;
                            this.view.focusedFileIndex = newIndex;
                            this.view.updateFileSelection();
                            this.openFile(nextFile);
                        }
                    }
                }
            }, 100); // Small delay to ensure file list has refreshed
        });
    }

    /**
     * Deletes a folder with optional confirmation dialog
     * Clears selection if the deleted folder was selected
     * Handles cleanup of UI state after deletion
     * @param folder - The folder to delete
     */
    async deleteFolder(folder: TFolder): Promise<void> {
        // Store the parent folder before deletion
        const parentFolder = folder.parent;
        const wasSelected = this.view.selectedFolder === folder;
        
        // Check if the currently selected folder will be deleted (is a descendant of the folder being deleted)
        const selectedFolderWillBeDeleted = this.view.selectedFolder && 
            (this.view.selectedFolder === folder || 
             this.view.fileSystemOps.isDescendant(folder, this.view.selectedFolder));
        
        await this.view.fileSystemOps.deleteFolder(folder, this.plugin.settings.confirmBeforeDelete, async () => {
            // Only switch focus AFTER the user confirms deletion
            if (selectedFolderWillBeDeleted && parentFolder) {
                this.selectFolder(parentFolder);
            } else if (wasSelected && parentFolder) {
                // Select the parent folder if the deleted folder was selected
                this.selectFolder(parentFolder);
            } else if (wasSelected) {
                // If no parent (shouldn't happen), clear selection
                this.view.selectedFolder = null;
                await this.view.domRenderer.refreshFileList();
            }
        });
    }

    /**
     * Shows context menu for folder operations
     * Provides options to create, rename, and delete folders/files
     * Root folder has limited options (no rename/delete)
     * @param folder - The folder to show context menu for
     * @param e - Mouse event for positioning the menu
     */
    showFolderContextMenu(folder: TFolder, e: MouseEvent): void {
        const menu = new Menu();

        // Creation items
        menu.addItem((item) =>
            item
                .setTitle('New note')
                .setIcon('create-new')
                .onClick(() => this.createNewFile(folder))
        );

        menu.addItem((item) =>
            item
                .setTitle('New folder')
                .setIcon('folder-plus')
                .onClick(() => this.createNewFolder(folder))
        );

        menu.addItem((item) =>
            item
                .setTitle('New canvas')
                .setIcon('layout-grid')
                .onClick(() => this.createNewCanvas(folder))
        );

        // Check if Bases plugin is enabled (core plugin in 1.9+)
        const basesPlugin = getInternalPlugin(this.app, 'bases');
        if (basesPlugin?.enabled) {
            menu.addItem((item) =>
                item
                    .setTitle('New base')
                    .setIcon('database')
                    .onClick(() => this.createNewBase(folder))
            );
        }

        menu.addSeparator();

        // Folder operations
        menu.addItem((item) =>
            item
                .setTitle('Duplicate folder')
                .setIcon('copy')
                .onClick(() => this.duplicateFolder(folder))
        );

        menu.addItem((item) =>
            item
                .setTitle('Search in folder')
                .setIcon('search')
                .onClick(() => this.searchInFolder(folder))
        );

        if (folder.path) {
            menu.addSeparator();

            // Icon management
            menu.addItem((item) =>
                item
                    .setTitle('Change icon')
                    .setIcon('palette')
                    .onClick(() => this.changeFolderIcon(folder))
            );
            
            // Only show remove option if folder has a custom icon
            const currentIcon = this.plugin.settings.folderIcons?.[folder.path];
            if (currentIcon) {
                menu.addItem((item) =>
                    item
                        .setTitle('Remove icon')
                        .setIcon('x')
                        .onClick(() => this.removeFolderIcon(folder))
                );
            }

            menu.addSeparator();

            menu.addItem((item) =>
                item
                    .setTitle('Rename folder')
                    .setIcon('pencil')
                    .onClick(() => this.renameFolder(folder))
            );

            menu.addItem((item) =>
                item
                    .setTitle('Delete folder')
                    .setIcon('trash')
                    .onClick(() => this.deleteFolder(folder))
            );
        }

        menu.showAtMouseEvent(e);
    }

    /**
     * Shows context menu for file operations
     * Provides options to open, pin/unpin, rename, and delete files
     * Pin option changes based on current pin state
     * @param file - The file to show context menu for
     * @param e - Mouse event for positioning the menu
     */
    showFileContextMenu(file: TFile, e: MouseEvent): void {
        const menu = new Menu();

        // Open options
        menu.addItem((item) =>
            item
                .setTitle('Open in new tab')
                .setIcon('plus')
                .onClick(() => this.app.workspace.getLeaf('tab').openFile(file))
        );

        menu.addItem((item) =>
            item
                .setTitle('Open to the right')
                .setIcon('separator-vertical')
                .onClick(() => this.app.workspace.getLeaf('split').openFile(file))
        );

        menu.addItem((item) =>
            item
                .setTitle('Open in new window')
                .setIcon('maximize')
                .onClick(() => this.app.workspace.getLeaf('window').openFile(file))
        );

        menu.addSeparator();
        
        // Add pin/unpin option
        if (this.view.selectedFolder) {
            const isPinned = this.isFilePinned(file, this.view.selectedFolder);
            menu.addItem((item) =>
                item
                    .setTitle(isPinned ? 'Unpin note' : 'Pin note')
                    .setIcon(isPinned ? 'pin-off' : 'pin')
                    .onClick(() => {
                        if (isPinned) {
                            this.unpinFile(file, this.view.selectedFolder!);
                        } else {
                            this.pinFile(file, this.view.selectedFolder!);
                        }
                    })
            );
        }

        menu.addSeparator();

        // File operations
        menu.addItem((item) =>
            item
                .setTitle('Duplicate note')
                .setIcon('copy')
                .onClick(() => this.duplicateFile(file))
        );

        // Check if Sync is enabled
        const syncPlugin = getInternalPlugin(this.app, 'sync');
        if (syncPlugin?.enabled) {
            menu.addItem((item) =>
                item
                    .setTitle('Open version history')
                    .setIcon('history')
                    .onClick(() => this.openVersionHistory(file))
            );
        }

        menu.addSeparator();

        menu.addItem((item) =>
            item
                .setTitle('Rename note')
                .setIcon('pencil')
                .onClick(() => this.renameFile(file))
        );

        menu.addItem((item) =>
            item
                .setTitle('Delete note')
                .setIcon('trash')
                .onClick(() => this.deleteFile(file))
        );

        menu.showAtMouseEvent(e);
    }

    /**
     * Creates a new canvas file in the specified folder
     * Canvas files are JSON-based drawing/diagram files in Obsidian
     * @param folder - The folder to create the canvas in
     */
    async createNewCanvas(folder: TFolder): Promise<void> {
        try {
            // Generate unique canvas name
            let canvasName = "Untitled Canvas";
            let counter = 1;
            let path = normalizePath(folder.path ? `${folder.path}/${canvasName}.canvas` : `${canvasName}.canvas`);
            
            // Check if canvas exists and increment counter
            while (this.app.vault.getAbstractFileByPath(path)) {
                canvasName = `Untitled Canvas ${counter}`;
                path = normalizePath(folder.path ? `${folder.path}/${canvasName}.canvas` : `${canvasName}.canvas`);
                counter++;
            }
            
            // Create empty canvas content
            const canvasContent = JSON.stringify({
                nodes: [],
                edges: []
            }, null, 2);
            
            const file = await this.app.vault.create(path, canvasContent);
            
            // Open the canvas
            this.app.workspace.getLeaf(false).openFile(file);
            
            // Select the parent folder and the new file
            await this.selectFolder(folder);
            this.view.selectedFile = file;
            await this.view.domRenderer.refreshFileList();
            
        } catch (error) {
            new Notice(`Failed to create canvas: ${error.message}`);
        }
    }

    /**
     * Creates a new base (database view) in the specified folder
     * Bases are a new feature in Obsidian 1.9+ that provide database-like functionality
     * @param folder - The folder to create the base in
     */
    async createNewBase(folder: TFolder): Promise<void> {
        try {
            // Generate unique base name
            let baseName = "Untitled Base";
            let counter = 1;
            let path = normalizePath(folder.path ? `${folder.path}/${baseName}.base` : `${baseName}.base`);
            
            // Check if base exists and increment counter
            while (this.app.vault.getAbstractFileByPath(path)) {
                baseName = `Untitled Base ${counter}`;
                path = normalizePath(folder.path ? `${folder.path}/${baseName}.base` : `${baseName}.base`);
                counter++;
            }
            
            // Create the base file - Obsidian will handle the base file format
            const file = await this.app.vault.create(path, '');
            
            // Open the base
            this.app.workspace.getLeaf(false).openFile(file);
            
            // Select the parent folder and the new file
            await this.selectFolder(folder);
            this.view.selectedFile = file;
            await this.view.domRenderer.refreshFileList();
            
        } catch (error) {
            new Notice(`Failed to create base: ${error.message}`);
        }
    }

    /**
     * Duplicates a folder and all its contents recursively
     * Uses Obsidian's naming convention: "foldername 1", "foldername 2", etc.
     * @param folder - The folder to duplicate
     */
    private async duplicateFolder(folder: TFolder): Promise<void> {
        try {
            if (!folder.parent) {
                new Notice("Cannot duplicate root folder");
                return;
            }
            
            // Generate unique folder name using Obsidian's naming convention
            let counter = 1;
            let newName = `${folder.name} ${counter}`;
            let newPath = normalizePath(`${folder.parent.path}/${newName}`);
            
            // Check if folder exists and increment counter
            while (this.app.vault.getAbstractFileByPath(newPath)) {
                counter++;
                newName = `${folder.name} ${counter}`;
                newPath = normalizePath(`${folder.parent.path}/${newName}`);
            }
            
            // Create the new folder
            await this.app.vault.createFolder(newPath);
            
            // Recursively copy contents
            await this.copyFolderContents(folder, newPath);
            
            // Select the new folder
            const newFolder = this.app.vault.getAbstractFileByPath(newPath);
            if (newFolder instanceof TFolder) {
                this.selectFolder(newFolder);
                this.view.pendingFolderSelection = newPath;
                this.view.refresh();
            }
            
            new Notice(`Folder duplicated as "${newName}"`);
        } catch (error) {
            new Notice(`Failed to duplicate folder: ${error.message}`);
        }
    }

    /**
     * Recursively copies folder contents to a new location
     * Helper method for duplicateFolder
     * @param sourceFolder - The source folder to copy from
     * @param targetPath - The target folder path to copy to
     */
    private async copyFolderContents(sourceFolder: TFolder, targetPath: string): Promise<void> {
        for (const child of sourceFolder.children) {
            if (child instanceof TFile) {
                const content = await this.app.vault.read(child);
                await this.app.vault.create(normalizePath(`${targetPath}/${child.name}`), content);
            } else if (child instanceof TFolder) {
                const newSubfolderPath = normalizePath(`${targetPath}/${child.name}`);
                await this.app.vault.createFolder(newSubfolderPath);
                await this.copyFolderContents(child, newSubfolderPath);
            }
        }
    }

    /**
     * Opens search with a query to search within a specific folder
     * Uses Obsidian's global search with path filter
     * @param folder - The folder to search within
     */
    private searchInFolder(folder: TFolder): void {
        // Build search query with path filter
        const searchQuery = `path:"${folder.path}/"`;
        
        // Open search
        const globalSearchPlugin = getInternalPlugin(this.app, 'global-search');
        if (globalSearchPlugin?.instance?.openGlobalSearch) {
            globalSearchPlugin.instance.openGlobalSearch(searchQuery);
        } else {
            // Use command palette
            executeCommand(this.app, 'global-search:open');
            // Set search query after a small delay
            setTimeout(() => {
                const searchView = this.app.workspace.getLeavesOfType('search')[0];
                if (searchView) {
                    const searchComponent = (searchView.view as any).searchComponent;
                    if (searchComponent) {
                        searchComponent.setValue(searchQuery);
                    }
                }
            }, 100);
        }
    }

    /**
     * Duplicates a file with a new name in the same folder
     * Uses Obsidian's naming convention: "filename 1", "filename 2", etc.
     * @param file - The file to duplicate
     */
    private async duplicateFile(file: TFile): Promise<void> {
        try {
            // Generate unique file name using Obsidian's naming convention
            const baseName = file.basename;
            const extension = file.extension;
            let counter = 1;
            let newName = `${baseName} ${counter}`;
            let newPath = normalizePath(file.parent ? `${file.parent.path}/${newName}.${extension}` : `${newName}.${extension}`);
            
            // Check if file exists and increment counter
            while (this.app.vault.getAbstractFileByPath(newPath)) {
                counter++;
                newName = `${baseName} ${counter}`;
                newPath = normalizePath(file.parent ? `${file.parent.path}/${newName}.${extension}` : `${newName}.${extension}`);
            }
            
            // Read original file content
            const content = await this.app.vault.read(file);
            
            // Create the duplicate
            const newFile = await this.app.vault.create(newPath, content);
            
            // Open the duplicated file
            await this.app.workspace.getLeaf(false).openFile(newFile);
            
            // Select the new file
            this.view.selectedFile = newFile;
            this.view.updateFileSelection();
            this.view.stateManager.saveState();
            
            new Notice(`Note duplicated as "${newName}"`);
        } catch (error) {
            new Notice(`Failed to duplicate note: ${error.message}`);
        }
    }

    /**
     * Opens version history for a file using Obsidian Sync
     * Only available when Sync plugin is enabled
     * @param file - The file to view version history for
     */
    private async openVersionHistory(file: TFile): Promise<void> {
        try {
            // Ensure the file is open and active first
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            // Wait a bit for the file to be fully loaded
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Try both possible command IDs
            const commandIds = ['sync:show-sync-history', 'sync:view-version-history'];
            let executed = false;
            
            for (const commandId of commandIds) {
                if (executeCommand(this.app, commandId)) {
                    executed = true;
                    break;
                }
            }
            
            if (!executed) {
                new Notice('Version history command not found. Ensure Obsidian Sync is enabled.');
            }
        } catch (error) {
            new Notice(`Failed to open version history: ${error.message}`);
        }
    }

    /**
     * Renames a folder with user input validation
     * Delegates to FileSystemOperations for the rename operation
     * @param folder - The folder to rename
     */
    private async renameFolder(folder: TFolder): Promise<void> {
        await this.view.fileSystemOps.renameFolder(folder);
    }

    /**
     * Renames a file with user input validation
     * Delegates to FileSystemOperations for the rename operation
     * @param file - The file to rename
     */
    private async renameFile(file: TFile): Promise<void> {
        await this.view.fileSystemOps.renameFile(file);
    }

    /**
     * Checks if a file is pinned in a specific folder
     * Used to determine pin/unpin menu option state
     * @param file - The file to check
     * @param folder - The folder context for pinning
     * @returns True if the file is pinned in this folder
     */
    isFilePinned(file: TFile, folder: TFolder): boolean {
        const pinnedFiles = this.getPinnedNotesForFolder(folder);
        return pinnedFiles.includes(file.path);
    }

    /**
     * Gets the list of pinned note paths for a specific folder
     * Returns empty array if no notes are pinned in the folder
     * @param folder - The folder to get pinned notes for
     * @returns Array of file paths that are pinned in this folder
     */
    getPinnedNotesForFolder(folder: TFolder): string[] {
        return this.plugin.settings.pinnedNotes[folder.path] || [];
    }

    /**
     * Pins a file to the top of its folder's file list
     * Adds file path to pinned notes settings and refreshes display
     * Auto-scrolls to show the newly pinned file at the top
     * @param file - The file to pin
     * @param folder - The folder to pin the file in
     */
    async pinFile(file: TFile, folder: TFolder): Promise<void> {
        const pinnedNotes = this.plugin.settings.pinnedNotes;
        if (!pinnedNotes[folder.path]) {
            pinnedNotes[folder.path] = [];
        }
        
        if (!pinnedNotes[folder.path].includes(file.path)) {
            pinnedNotes[folder.path].push(file.path);
            await this.plugin.saveSettings();
            await this.view.domRenderer.refreshFileList();
            
            // Auto-scroll to the newly pinned file
            this.view.selectedFile = file;
            this.view.updateFileSelection();
            setTimeout(() => {
                this.view.uiHelper.scrollSelectedFileIntoView();
            }, 100);
        }
    }

    /**
     * Unpins a file from the top of its folder's file list
     * Removes file path from pinned notes settings and refreshes display
     * Maintains scroll position if the unpinned file was selected
     * @param file - The file to unpin
     * @param folder - The folder to unpin the file from
     */
    async unpinFile(file: TFile, folder: TFolder): Promise<void> {
        const pinnedNotes = this.plugin.settings.pinnedNotes;
        if (pinnedNotes[folder.path]) {
            pinnedNotes[folder.path] = pinnedNotes[folder.path].filter(path => path !== file.path);
            if (pinnedNotes[folder.path].length === 0) {
                delete pinnedNotes[folder.path];
            }
            await this.plugin.saveSettings();
            await this.view.domRenderer.refreshFileList();
            
            // If the unpinned file is the selected file, scroll to it
            if (this.view.selectedFile?.path === file.path) {
                this.view.updateFileSelection();
                setTimeout(() => {
                    this.view.uiHelper.scrollSelectedFileIntoView();
                }, 100);
            }
        }
    }

    /**
     * Checks if a file is visible in the current folder view
     * Accounts for showNotesFromSubfolders setting
     * Used to determine if file selection should update
     * @param file - The file to check visibility for
     * @returns True if file is in current folder or subfolder view
     */
    private isFileInCurrentView(file: TFile): boolean {
        if (!this.view.selectedFolder) return false;
        
        if (this.plugin.settings.showNotesFromSubfolders) {
            // Check if file is within the folder tree
            let current = file.parent;
            while (current) {
                if (current.path === this.view.selectedFolder.path) return true;
                current = current.parent;
            }
            return false;
        } else {
            // Check if file is direct child
            return file.parent?.path === this.view.selectedFolder.path;
        }
    }

    /**
     * Selects a file in the navigator without opening it in editor
     * Updates visual selection and scrolls file into view if needed
     * Used when syncing with active editor to avoid circular updates
     * @param file - The file to select
     */
    private selectFileWithoutOpening(file: TFile): void {
        this.view.selectedFile = file;
        this.view.updateFileSelection();
        
        // Ensure file is visible in viewport
        const fileEl = this.view.fileList.querySelector(`[data-path="${CSS.escape(file.path)}"]`) as HTMLElement;
        if (fileEl) {
            const container = this.view.fileList;
            const containerRect = container.getBoundingClientRect();
            const fileRect = fileEl.getBoundingClientRect();
            
            if (fileRect.top < containerRect.top || fileRect.bottom > containerRect.bottom) {
                fileEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        
        // Save state
        localStorage.setItem(this.plugin.keys.selectedFileKey, file.path);
    }

    /**
     * Toggles between expanding all folders and collapsing all folders
     * If no root folders are expanded, expands all. Otherwise, collapses all.
     * Updates button icon and aria-label accordingly
     */
    async toggleAllFolders(): Promise<void> {
        const hasExpandedRootFolders = this.hasExpandedRootFolders();
        
        if (hasExpandedRootFolders) {
            // Collapse all folders
            this.view.expandedFolders.clear();
        } else {
            // Expand all folders
            await this.expandAllFolders(this.app.vault.getRoot());
        }
        
        // Save state
        this.view.stateManager.saveState();
        
        // Refresh the folder tree to show changes
        this.view.domRenderer.renderFolderTree();
        
        // Update button icon and aria-label
        this.updateExpandCollapseButton();
    }

    /**
     * Recursively expands all folders starting from the given folder
     * @param folder - The folder to start expanding from
     */
    private async expandAllFolders(folder: TFolder): Promise<void> {
        // Add all folders to expanded set
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                this.view.expandedFolders.add(child.path);
                await this.expandAllFolders(child);
            }
        }
    }

    /**
     * Updates the expand/collapse button icon and aria-label based on current state
     */
    updateExpandCollapseButton(): void {
        const button = this.view.containerEl.querySelector('.nn-expand-collapse-btn') as HTMLButtonElement;
        if (!button) return;
        
        const hasExpandedRootFolders = this.hasExpandedRootFolders();
        
        if (hasExpandedRootFolders) {
            // Show collapse icon
            setIcon(button, 'chevrons-down-up');
            button.setAttribute('aria-label', 'Collapse all folders');
        } else {
            // Show expand icon
            setIcon(button, 'chevrons-up-down');
            button.setAttribute('aria-label', 'Expand all folders');
        }
    }

    /**
     * Checks if any root-level folders are expanded
     * @returns True if at least one root folder is expanded
     */
    private hasExpandedRootFolders(): boolean {
        const rootFolder = this.app.vault.getRoot();
        const ignoredFoldersSet = new Set(
            this.plugin.settings.ignoreFolders
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0)
        );

        // Check if showing root folder and it's expanded
        if (this.plugin.settings.showRootFolder) {
            return this.view.expandedFolders.has(rootFolder.path);
        }

        // Otherwise check root-level folders
        for (const child of rootFolder.children) {
            if (child instanceof TFolder && 
                !ignoredFoldersSet.has(child.name) && 
                this.view.expandedFolders.has(child.path)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Opens the icon picker modal to change a folder's icon
     * @param folder - The folder to change the icon for
     */
    private async changeFolderIcon(folder: TFolder): Promise<void> {
        const { IconPickerModal } = await import('../modals/IconPickerModal');
        
        const modal = new IconPickerModal(this.app, this.plugin, folder.path);
        modal.onChooseIcon = (iconId: string | null) => {
            if (iconId) {
                // The modal already saves the icon to settings
                this.view.domRenderer.renderFolderTree();
            }
        };
        modal.open();
    }

    /**
     * Removes the custom icon from a folder
     * @param folder - The folder to remove the icon from
     */
    private async removeFolderIcon(folder: TFolder): Promise<void> {
        if (this.plugin.settings.folderIcons?.[folder.path]) {
            delete this.plugin.settings.folderIcons[folder.path];
            await this.plugin.saveSettings();
            this.view.domRenderer.renderFolderTree();
        }
    }
}