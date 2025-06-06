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
    ItemView, 
    WorkspaceLeaf, 
    TFile, 
    TFolder, 
    TAbstractFile,
    Menu,
    setIcon,
    Notice
} from 'obsidian';
import type NotebookNavigatorPlugin from '../main';
import { SortOption } from '../settings';
import { VIEW_TYPE_NOTEBOOK, NavigatorElementAttributes } from '../types';
import { DateUtils } from '../utils/DateUtils';
import { PreviewTextUtils } from '../utils/PreviewTextUtils';
import { KeyboardHandler } from '../handlers/KeyboardHandler';
import { FileSystemOperations } from '../operations/FileSystemOperations';
import { ViewStateManager } from './viewState';
import { DomRenderer } from './domRenderer';
import { EventManager } from './eventManager';
import { InteractionManager } from './interactionManager';
import { UiHelper } from './uiHelper';
/**
 * Main view class implementing the two-pane file navigator interface
 * Manages folder tree (left pane) and file list (right pane) with Notes-style UI
 * Handles all user interactions, state management, and rendering
 */
export class NotebookNavigatorView extends ItemView {
    plugin: NotebookNavigatorPlugin;
    public stateManager: ViewStateManager;
    public domRenderer: DomRenderer;
    public eventManager: EventManager;
    public interactionManager: InteractionManager;
    public uiHelper: UiHelper;
    public folderTree: HTMLElement;  // Left pane folder hierarchy
    public fileList: HTMLElement;    // Right pane file listing
    public selectedFolder: TFolder | null = null;  // Currently selected folder
    public previousFolder: TFolder | null = null;  // Previously selected folder for change detection
    public selectedFile: TFile | null = null;      // Currently selected file
    public expandedFolders: Set<string> = new Set();  // Tracks which folders are expanded
    public focusedPane: 'folders' | 'files' = 'folders';  // Which pane has keyboard focus
    public focusedFolderIndex: number = 0;  // Index of focused folder for keyboard navigation
    public focusedFileIndex: number = 0;    // Index of focused file for keyboard navigation
    public leftPane: HTMLElement;           // Container for folder tree
    public splitContainer: HTMLElement;     // Main container with both panes
    public resizing: boolean = false;       // Flag for resize operation in progress
    public eventRefs: Array<{ cleanup: () => void; type: 'persistent' | 'transient'; description?: string }> = [];  // Cleanup functions for event listeners
    public isLoading: boolean = true;       // Flag to track initial load state
    private fileListRefreshTimer?: NodeJS.Timeout;  // Debounce timer for file list updates
    private pendingCountUpdate: boolean = false;    // Flag for pending folder count updates
    public keyboardHandler: KeyboardHandler;       // Handles keyboard navigation logic
    public pendingFolderSelection: string | null = null;  // Path of folder to select after refresh
    public fileSystemOps: FileSystemOperations;    // Handles file/folder operations
    public contextMenuActive: boolean = false;  // Track if context menu is currently shown

    /**
     * Initializes the view with plugin reference and file system operations
     * @param leaf - The workspace leaf containing this view
     * @param plugin - Reference to the main plugin instance
     */
    constructor(leaf: WorkspaceLeaf, plugin: NotebookNavigatorPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.fileSystemOps = new FileSystemOperations(this.app);
        this.stateManager = new ViewStateManager(this);
        this.domRenderer = new DomRenderer(this);
        this.eventManager = new EventManager(this);
        this.interactionManager = new InteractionManager(this);
        this.uiHelper = new UiHelper(this);
    }

    /**
     * Returns the unique identifier for this view type
     * Used by Obsidian to register and manage view instances
     * @returns The view type identifier constant
     */
    getViewType() {
        return VIEW_TYPE_NOTEBOOK;
    }

    /**
     * Returns the display name shown in the view header
     * @returns Human-readable name for the view
     */
    getDisplayText() {
        return 'Notebook Navigator';
    }

    /**
     * Returns the icon identifier for the view
     * Displayed in tabs and view headers
     * @returns Icon identifier from Obsidian's icon set
     */
    getIcon() {
        return 'notebook';
    }

    /**
     * View initialization - creates the UI structure and sets up event handlers
     * Called when the view is opened or revealed
     * Builds the two-pane layout with folder tree and file list
     * Restores saved state and sets up keyboard navigation
     */
    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        this.domRenderer.createInitialDOM(container);
        
        // Register event listeners
        this.eventManager.registerViewEventListeners();
        this.eventManager.setupDOMEventListeners(container);

        // Create the keyboard handler with a context that provides access to current state
        const self = this;
        const keyboardContext = {
            get folderTree() { return self.folderTree; },
            get fileList() { return self.fileList; },
            get focusedPane() { return self.focusedPane; },
            set focusedPane(value: 'folders' | 'files') { self.focusedPane = value; },
            get focusedFolderIndex() { return self.focusedFolderIndex; },
            set focusedFolderIndex(value: number) { self.focusedFolderIndex = value; },
            get focusedFileIndex() { return self.focusedFileIndex; },
            set focusedFileIndex(value: number) { self.focusedFileIndex = value; },
            get expandedFolders() { return self.expandedFolders; },
            get selectedFile() { return self.selectedFile; },
            set selectedFile(value: TFile | null) { self.selectedFile = value; },
            selectFolder: (folder: TFolder) => self.interactionManager.selectFolder(folder),
            toggleFolder: (folder: TFolder) => self.interactionManager.toggleFolder(folder),
            updateFocus: () => self.uiHelper.updateFocus(),
            updateFileSelection: () => self.updateFileSelection(),
            previewFile: (file: TFile) => self.interactionManager.previewFile(file),
            saveState: () => self.stateManager.saveState(),
            openFile: (file: TFile) => self.interactionManager.openFile(file),
            refreshFileList: () => { self.domRenderer.refreshFileList(); },
            deleteFolder: (folder: TFolder) => self.interactionManager.deleteFolder(folder),
            deleteFile: (file: TFile) => self.interactionManager.deleteFile(file),
            app: self.app
        };

        this.keyboardHandler = new KeyboardHandler(keyboardContext);

        // Load saved state before refresh
        await this.stateManager.loadState();
        
        // First render the folder tree
        if (this.selectedFolder) {
            // Make sure parent folders are expanded before rendering
            this.uiHelper.ensureFolderVisible(this.selectedFolder);
        }
        this.domRenderer.renderFolderTree();
        
        // After folder tree is rendered, restore folder navigation state
        if (this.selectedFolder) {
            // Calculate the focused folder index
            this.calculateFocusedFolderIndex();
            // Scroll selected folder into view after a small delay for DOM to settle
            setTimeout(() => {
                this.uiHelper.scrollSelectedFolderIntoView();
            }, 50);
        }
        
        // Then render the file list
        await this.domRenderer.refreshFileList();
        
        // After file list is rendered, restore file navigation state and scroll
        if (this.selectedFile) {
            setTimeout(() => {
                this.calculateFocusedFileIndex();
                this.uiHelper.scrollSelectedFileIntoView();
            }, 150); // Increased delay to ensure async content is loaded
        }
        
        // Mark loading as complete
        this.isLoading = false;
        
        // Focus the container after a short delay to ensure it's ready
        setTimeout(() => {
            (container as HTMLElement).focus();
        }, 100);
    }

    /**
     * View cleanup - called when view is closed
     * Removes all event listeners to prevent memory leaks
     * Saves current state for restoration on next open
     * Ensures proper cleanup of all view resources
     */
    async onClose() {
        // Clean up stored event listeners
        this.eventRefs.forEach(ref => ref.cleanup());
        this.eventRefs = [];
        
        // Clean up global listeners
        this.eventManager.cleanupGlobalListeners();
        
        // Save state before closing
        await this.stateManager.saveState();
        
        // No plugin reference to clear anymore
    }

    /**
     * Cleans up transient event listeners before DOM updates
     * Preserves persistent listeners like keyboard and container-level handlers
     * Prevents memory leaks from accumulated listeners on refresh
     */
    cleanupTransientListeners(): void {
        // Execute cleanup for transient listeners
        const transientRefs = this.eventRefs.filter(ref => ref.type === 'transient');
        transientRefs.forEach(ref => ref.cleanup());
        
        // Keep only persistent listeners
        this.eventRefs = this.eventRefs.filter(ref => ref.type === 'persistent');
    }



    /**
     * Refreshes both folder tree and file list displays
     * Handles pending folder selections (e.g., after creating new folder)
     * Updates focus and scrolls to newly selected items
     * Called when settings change or file system is modified
     */
    async refresh() {
        this.domRenderer.renderFolderTree();
        await this.domRenderer.refreshFileList();
        
        // Update folder counts after refresh (needed for drag and drop operations)
        this.domRenderer.updateFolderCounts();
        
        // Handle pending folder selection after refresh
        if (this.pendingFolderSelection) {
            const folder = this.app.vault.getAbstractFileByPath(this.pendingFolderSelection);
            if (folder instanceof TFolder) {
                // Select the newly created folder
                this.interactionManager.selectFolder(folder);
                
                // Calculate and update the focused folder index
                const allFolders = Array.from(this.folderTree.querySelectorAll('.nn-folder-item'));
                const folderIndex = allFolders.findIndex(el => 
                    el.getAttribute('data-path') === folder.path
                );
                if (folderIndex >= 0) {
                    this.focusedFolderIndex = folderIndex;
                    this.focusedPane = 'folders';
                    this.uiHelper.updateFocus();
                }
                
                // Scroll the folder into view
                setTimeout(() => {
                    this.uiHelper.scrollSelectedFolderIntoView();
                }, 50);
            }
            // Clear the pending selection
            this.pendingFolderSelection = null;
        }
    }

    /**
     * Debounced file list refresh to prevent excessive updates
     * Batches multiple rapid changes into a single refresh
     * Updates folder file counts if enabled in settings
     * Uses 100ms delay to balance responsiveness and performance
     */
    public debouncedFileListRefresh() {
        // Clear any existing timer
        if (this.fileListRefreshTimer) {
            clearTimeout(this.fileListRefreshTimer);
        }
        
        // Mark that we need to update counts
        this.pendingCountUpdate = true;
        
        // Set a new timer
        this.fileListRefreshTimer = setTimeout(async () => {
            await this.domRenderer.refreshFileList();
            if (this.pendingCountUpdate) {
                this.domRenderer.updateFolderCounts();
                this.pendingCountUpdate = false;
            }
        }, 100); // 100ms debounce
    }










    
    























    /**
     * Scrolls the selected folder into view in the folder tree
    
    
    

    /**
     * Calculates the index of the currently selected folder
     * Used to restore keyboard navigation position after tree updates
     * Updates focusedFolderIndex for keyboard navigation state
     */
    private calculateFocusedFolderIndex() {
        if (this.selectedFolder) {
            const allFolders = Array.from(this.folderTree.querySelectorAll('.nn-folder-item'));
            const selectedIndex = allFolders.findIndex(el => 
                el.getAttribute('data-path') === this.selectedFolder!.path
            );
            if (selectedIndex >= 0) {
                this.focusedFolderIndex = selectedIndex;
            }
        }
    }
    
    /**
     * Calculates the index of the currently selected file
     * Used to restore keyboard navigation position after list updates
     * Updates focusedFileIndex for keyboard navigation state
     */
    public calculateFocusedFileIndex() {
        if (this.selectedFile) {
            const allFiles = Array.from(this.fileList.querySelectorAll('.nn-file-item'));
            const selectedIndex = allFiles.findIndex(el => 
                el.getAttribute('data-path') === this.selectedFile!.path
            );
            if (selectedIndex >= 0) {
                this.focusedFileIndex = selectedIndex;
            }
        }
    }

    /**
     * Updates visual selection state in the folder tree
     * Removes previous selection and highlights current folder
     * Called after folder tree is rendered
     */
    public updateFolderSelection() {
        // Remove previous selection
        this.folderTree.querySelectorAll('.nn-selected').forEach(el => {
            el.removeClass('nn-selected');
        });

        // Add selection to the current folder
        if (this.selectedFolder) {
            const folderEl = this.folderTree.querySelector(`[data-path="${CSS.escape(this.selectedFolder.path)}"]`);
            if (folderEl) {
                folderEl.addClass('nn-selected');
            }
        }
    }

    /**
     * Updates visual selection state in the file list
     * Removes previous selection and highlights current file
     * Called when file selection changes via keyboard or mouse
     */
    public updateFileSelection() {
        // Remove previous selection
        this.fileList.querySelectorAll('.nn-selected').forEach(el => {
            el.removeClass('nn-selected');
        });

        // Add selection to the current file
        if (this.selectedFile) {
            const fileEl = this.fileList.querySelector(`[data-path="${CSS.escape(this.selectedFile.path)}"]`);
            if (fileEl) {
                fileEl.addClass('nn-selected');
            }
        }
    }




    /**
     * Reveals a file in the navigator by expanding folders and selecting it
     * Switches to the file's parent folder if needed
     * Scrolls both folder tree and file list to show the revealed items
     * Public method called by plugin commands and context menus
     * @param file - The file to reveal in the navigator
     */
    async revealFile(file: TFile) {
        // Ensure parent folders are expanded
        if (file.parent) {
            const needsTreeRefresh = this.uiHelper.ensureFolderVisible(file.parent);
            
            // If we expanded any folders, we need to refresh the tree to show them
            if (needsTreeRefresh) {
                this.domRenderer.renderFolderTree();
            }
            
            await this.interactionManager.selectFolder(file.parent);
            this.selectedFile = file;
            
            // Only refresh file list, not the entire folder tree
            await this.domRenderer.refreshFileList();
            
            // Scroll to the selected folder and file
            setTimeout(() => {
                // First scroll to the folder in the tree
                this.uiHelper.scrollSelectedFolderIntoView();
                
                // Then find and focus the file in the list
                const fileEls = this.fileList.querySelectorAll('.nn-file-item');
                fileEls.forEach((el, index) => {
                    if (el.getAttribute('data-path') === file.path) {
                        this.focusedFileIndex = index;
                        this.focusedPane = 'files';
                        this.uiHelper.updateFocus();
                    }
                });
                
                // Scroll to the file as well
                this.uiHelper.scrollSelectedFileIntoView();
            }, 100);
        }
    }
}