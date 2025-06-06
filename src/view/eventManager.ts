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
    WorkspaceLeaf, 
    TFile, 
    TFolder, 
    TAbstractFile,
    Menu,
    Notice
} from 'obsidian';
import type { NotebookNavigatorView } from './NotebookNavigatorView';
import type NotebookNavigatorPlugin from '../main';

/**
 * EventManager handles all event registration and management for the NotebookNavigatorView
 * Manages vault events, workspace events, DOM events, and event delegation
 */
export class EventManager {
    private view: NotebookNavigatorView;
    private app: App;
    private plugin: NotebookNavigatorPlugin;

    constructor(view: NotebookNavigatorView) {
        this.view = view;
        this.app = view.app;
        this.plugin = view.plugin;
    }

    /**
     * Registers Obsidian vault and workspace event listeners
     * Called during view initialization
     */
    registerViewEventListeners(): void {
        // Vault events
        this.view.registerEvent(
            this.app.vault.on('create', (file) => this.handleVaultChange(file, 'create'))
        );
        this.view.registerEvent(
            this.app.vault.on('delete', (file) => this.handleVaultChange(file, 'delete'))
        );
        this.view.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => this.handleVaultChange(file, 'rename', oldPath))
        );
        this.view.registerEvent(
            this.app.vault.on('modify', (file) => this.handleVaultChange(file, 'modify'))
        );

        // Workspace events
        this.view.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => this.handleActiveLeafChange(leaf))
        );
    }

    /**
     * Sets up DOM event listeners after initial DOM creation
     * Handles buttons, resize handle, keyboard, and event delegation
     * 
     * Memory leak prevention: This method cleans up transient listeners before
     * adding new ones. While currently the DOM structure persists and this method
     * is only called once, this pattern ensures no memory leaks if the implementation
     * changes in the future to support dynamic DOM updates.
     */
    setupDOMEventListeners(container: HTMLElement): void {
        // Clean up any existing transient listeners before adding new ones
        this.view.cleanupTransientListeners();
        
        // New folder button
        const newFolderBtn = container.querySelector('.nn-header-actions button[aria-label="New Folder"]') as HTMLElement;
        if (newFolderBtn) {
            const newFolderClickHandler = () => this.view.interactionManager.createNewFolder(this.app.vault.getRoot());
            newFolderBtn.addEventListener('click', newFolderClickHandler);
            this.view.eventRefs.push({
                cleanup: () => newFolderBtn.removeEventListener('click', newFolderClickHandler),
                type: 'transient',
                description: 'New folder button'
            });
        }
        
        // New file button
        const newFileBtn = container.querySelector('.nn-header-actions button[aria-label="New File"]') as HTMLElement;
        if (newFileBtn) {
            const newFileClickHandler = () => this.view.interactionManager.createNewFile();
            newFileBtn.addEventListener('click', newFileClickHandler);
            this.view.eventRefs.push({
                cleanup: () => newFileBtn.removeEventListener('click', newFileClickHandler),
                type: 'transient',
                description: 'New file button'
            });
        }
        
        // Expand/Collapse all button
        const expandCollapseBtn = container.querySelector('.nn-expand-collapse-btn') as HTMLElement;
        if (expandCollapseBtn) {
            const expandCollapseClickHandler = () => this.view.interactionManager.toggleAllFolders();
            expandCollapseBtn.addEventListener('click', expandCollapseClickHandler);
            this.view.eventRefs.push({
                cleanup: () => expandCollapseBtn.removeEventListener('click', expandCollapseClickHandler),
                type: 'transient',
                description: 'Expand/collapse all button'
            });
        }
        
        // Resize handle
        const resizeHandle = container.querySelector('.nn-resize-handle') as HTMLElement;
        if (resizeHandle) {
            this.setupResizeHandle(resizeHandle);
        }

        // Keyboard handler
        const keydownHandler = (e: KeyboardEvent) => {
            this.view.keyboardHandler.handleKeyboardNavigation(e);
        };
        container.addEventListener('keydown', keydownHandler);
        this.view.eventRefs.push({
            cleanup: () => container.removeEventListener('keydown', keydownHandler),
            type: 'persistent',
            description: 'Keyboard navigation handler'
        });

        // Event delegation
        this.setupEventDelegation();
        
        // Mouseover handler to remove context menu highlights
        const mousemoveHandler = () => {
            // Only remove highlights if no context menu is active
            if (!this.view.contextMenuActive) {
                container.querySelectorAll('.nn-context-menu-active').forEach(el => {
                    el.removeClass('nn-context-menu-active');
                });
            }
        };
        container.addEventListener('mousemove', mousemoveHandler);
        this.view.eventRefs.push({
            cleanup: () => container.removeEventListener('mousemove', mousemoveHandler),
            type: 'persistent',
            description: 'Context menu highlight handler'
        });
    }

    /**
     * Handles vault changes (create, delete, rename, modify)
     * Determines appropriate refresh strategy based on change type
     */
    private handleVaultChange(file: TAbstractFile, type: string, oldPath?: string): void {
        if (type === 'create' || type === 'delete' || type === 'rename') {
            if (file instanceof TFolder) {
                this.view.refresh(); // Full refresh for folder changes
            } else {
                this.view.debouncedFileListRefresh(); // Only refresh file list for files
            }
        } else if (type === 'modify') {
            this.view.debouncedFileListRefresh();
        }
    }

    /**
     * Handles active leaf changes in the workspace
     * Syncs navigator with active file and ensures visibility
     */
    private handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
        this.view.interactionManager.handleActiveFileChange();
        
        // If this view just became active, ensure selected items are visible
        if (leaf === this.view.leaf && (this.view.selectedFile || this.view.selectedFolder)) {
            setTimeout(() => {
                if (this.view.selectedFolder) {
                    this.view.uiHelper.scrollSelectedFolderIntoView();
                }
                if (this.view.selectedFile) {
                    this.view.uiHelper.scrollSelectedFileIntoView();
                }
            }, 100);
        }
    }

    /**
     * Sets up drag-to-resize functionality for the divider between panes
     * Allows users to adjust the width of the folder tree pane
     */
    private setupResizeHandle(handle: HTMLElement): void {
        const mouseDownHandler = (e: MouseEvent) => {
            this.view.resizing = true;
            const startX = e.clientX;
            const startWidth = this.view.leftPane.offsetWidth;
            
            const mouseMoveHandler = (e: MouseEvent) => {
                if (!this.view.resizing) return;
                
                const deltaX = e.clientX - startX;
                const newWidth = Math.max(150, Math.min(600, startWidth + deltaX));
                this.view.leftPane.style.width = `${newWidth}px`;
            };

            const mouseUpHandler = async (e: MouseEvent) => {
                if (!this.view.resizing) return;
                
                this.view.resizing = false;
                
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                
                // Save the new width
                const newWidth = parseInt(this.view.leftPane.style.width);
                this.plugin.settings.leftPaneWidth = newWidth;
                await this.plugin.saveSettings();
                
                // Also save to localStorage for immediate persistence
                localStorage.setItem(this.plugin.keys.leftPaneWidthKey, newWidth.toString());
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            e.preventDefault();
        };

        handle.addEventListener('mousedown', mouseDownHandler);
        this.view.eventRefs.push({
            cleanup: () => handle.removeEventListener('mousedown', mouseDownHandler),
            type: 'transient',
            description: 'Resize handle'
        });
    }

    /**
     * Sets up event delegation for all interactive elements
     * Uses container-level listeners for memory efficiency
     */
    private setupEventDelegation(): void {
        const container = this.view.containerEl;
        
        // Helper function to find draggable element
        const findDraggableElement = (target: EventTarget | null): HTMLElement | null => {
            if (!target || !(target instanceof HTMLElement)) return null;
            return target.closest('[data-draggable="true"]') as HTMLElement | null;
        };
        
        // Helper function to find drop zone
        const findDropZone = (target: EventTarget | null): HTMLElement | null => {
            if (!target || !(target instanceof HTMLElement)) return null;
            return target.closest('[data-drop-zone="folder"]') as HTMLElement | null;
        };
        
        // Dragstart handler
        this.view.registerDomEvent(container, 'dragstart', (e: DragEvent) => {
            const draggable = findDraggableElement(e.target);
            if (!draggable) return;
            
            e.stopPropagation();
            
            const path = draggable.getAttribute('data-drag-path');
            const type = draggable.getAttribute('data-drag-type');
            if (!path) return;
            
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', path);
            }
            
            // Add dragging class
            if (type === 'folder' && draggable.hasAttribute('data-drag-handle')) {
                const folderEl = draggable.closest('.nn-folder-item') as HTMLElement;
                if (folderEl) folderEl.addClass('nn-dragging');
            } else {
                draggable.addClass('nn-dragging');
            }
        });
        
        // Dragend handler
        this.view.registerDomEvent(container, 'dragend', (e: DragEvent) => {
            const draggable = findDraggableElement(e.target);
            if (!draggable) return;
            
            const type = draggable.getAttribute('data-drag-type');
            
            // Remove dragging class
            if (type === 'folder' && draggable.hasAttribute('data-drag-handle')) {
                const folderEl = draggable.closest('.nn-folder-item') as HTMLElement;
                if (folderEl) folderEl.removeClass('nn-dragging');
            } else {
                draggable.removeClass('nn-dragging');
            }
            
            // Clean up any remaining drag-over highlights
            container.querySelectorAll('.nn-drag-over').forEach(el => {
                el.removeClass('nn-drag-over');
            });
        });
        
        // Dragover handler
        this.view.registerDomEvent(container, 'dragover', (e: DragEvent) => {
            const dropZone = findDropZone(e.target);
            if (!dropZone) return;
            
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            
            // Clear all existing highlights except for this element
            container.querySelectorAll('.nn-drag-over').forEach(el => {
                if (el !== dropZone) {
                    el.removeClass('nn-drag-over');
                }
            });
            
            // Add highlight to current drop zone
            dropZone.addClass('nn-drag-over');
        });
        
        // Dragleave handler
        this.view.registerDomEvent(container, 'dragleave', (e: DragEvent) => {
            e.stopPropagation();
        });
        
        // Drop handler
        this.view.registerDomEvent(container, 'drop', async (e: DragEvent) => {
            const dropZone = findDropZone(e.target);
            if (!dropZone) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            // Remove all drag-over highlights
            container.querySelectorAll('.nn-drag-over').forEach(el => {
                el.removeClass('nn-drag-over');
            });
            
            const targetPath = dropZone.getAttribute('data-drop-path');
            if (!targetPath) return;
            
            const sourcePath = e.dataTransfer?.getData('text/plain');
            if (!sourcePath) return;
            
            const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
            const targetFolder = this.app.vault.getAbstractFileByPath(targetPath);
            
            if (!sourceFile || !targetFolder || !(targetFolder instanceof TFolder)) return;
            
            // Validate the move
            if (sourceFile === targetFolder || this.view.fileSystemOps.isDescendant(sourceFile, targetFolder)) {
                if (sourceFile instanceof TFolder && this.view.fileSystemOps.isDescendant(sourceFile, targetFolder)) {
                    new Notice(`Cannot move a folder into its own subfolder`);
                }
                return;
            }
            
            try {
                // Check if source already exists in target
                const newPath = `${targetFolder.path}/${sourceFile.name}`;
                const existingFile = this.app.vault.getAbstractFileByPath(newPath);
                
                if (existingFile) {
                    new Notice(`A file or folder named "${sourceFile.name}" already exists in the target location`);
                    return;
                }
                
                await this.app.fileManager.renameFile(sourceFile, newPath);
            } catch (error) {
                new Notice(`Failed to move: ${error.message}`);
            }
        });
        
        // Click handler for files and folders
        this.view.registerDomEvent(container, 'click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            // Check if clicking on folder arrow first
            const arrow = target.closest('[data-folder-arrow]') as HTMLElement;
            if (arrow) {
                e.stopPropagation();
                const arrowPath = arrow.getAttribute('data-folder-arrow');
                if (arrowPath) {
                    const folder = this.app.vault.getAbstractFileByPath(arrowPath);
                    if (folder instanceof TFolder) {
                        this.view.interactionManager.toggleFolder(folder);
                    }
                }
                return;
            }
            
            const clickable = target.closest('[data-clickable]') as HTMLElement | null;
            if (!clickable) return;
            
            const type = clickable.getAttribute('data-clickable');
            const path = clickable.getAttribute('data-click-path');
            if (!path) return;
            
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file) return;
            
            if (type === 'folder' && file instanceof TFolder) {
                // Handle folder click
                this.view.interactionManager.selectFolder(file);
                // Find the actual index of this folder in the current tree
                const allFolders = Array.from(this.view.folderTree.querySelectorAll('.nn-folder-item'));
                const clickedIndex = allFolders.findIndex(el => el.getAttribute('data-path') === file.path);
                if (clickedIndex >= 0) {
                    this.view.focusedFolderIndex = clickedIndex;
                }
                this.view.focusedPane = 'folders';
                this.view.uiHelper.updateFocus();
            } else if (type === 'file' && file instanceof TFile) {
                // Handle file click
                e.preventDefault();
                const fileEl = clickable.closest('.nn-file-item') as HTMLElement;
                const index = parseInt(fileEl?.getAttribute('data-index') || '0');
                
                this.view.selectedFile = file;
                this.view.focusedFileIndex = index;
                this.view.focusedPane = 'files';
                this.view.updateFileSelection();
                this.view.uiHelper.updateFocus();
                
                // Preview the file when clicked
                this.view.interactionManager.previewFile(file);
                
                // Save state after selecting file
                if (!this.view.isLoading) {
                    this.view.stateManager.saveState();
                }
                
                // Keep focus on the navigator
                setTimeout(() => {
                    const navContainer = this.view.containerEl.querySelector('.notebook-navigator') as HTMLElement;
                    if (navContainer) navContainer.focus();
                }, 10);
            }
        });
        
        // Double-click handler for folders
        this.view.registerDomEvent(container, 'dblclick', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const clickable = target.closest('[data-clickable="folder"]') as HTMLElement | null;
            if (!clickable) return;
            
            const path = clickable.getAttribute('data-click-path');
            if (!path) return;
            
            const folder = this.app.vault.getAbstractFileByPath(path);
            if (folder instanceof TFolder) {
                // Get ignored folders from settings
                const ignoredFolders = this.plugin.settings.ignoreFolders
                    .split(',')
                    .map(f => f.trim())
                    .filter(f => f);
                
                // Only toggle if folder has non-ignored subfolders
                const hasVisibleSubfolders = folder.children.some(child => 
                    child instanceof TFolder && !ignoredFolders.includes(child.name)
                );
                
                if (hasVisibleSubfolders) {
                    this.view.interactionManager.toggleFolder(folder);
                }
            }
        });
        
        // Context menu handler
        this.view.registerDomEvent(container, 'contextmenu', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const contextEl = target.closest('[data-context-menu]') as HTMLElement | null;
            if (!contextEl) return;
            
            e.preventDefault();
            
            const type = contextEl.getAttribute('data-context-menu');
            const path = contextEl.getAttribute('data-click-path') || contextEl.getAttribute('data-path');
            if (!path) return;
            
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file) return;
            
            // Find the actual element to highlight (folder-item or file-item)
            let elementToHighlight: HTMLElement | null = null;
            if (type === 'folder') {
                elementToHighlight = contextEl.closest('.nn-folder-item') as HTMLElement;
            } else if (type === 'file') {
                elementToHighlight = contextEl.closest('.nn-file-item') as HTMLElement;
            }
            
            // Remove any existing context menu highlights first
            container.querySelectorAll('.nn-context-menu-active').forEach(el => {
                el.removeClass('nn-context-menu-active');
            });
            
            // Add context menu active class
            if (elementToHighlight) {
                elementToHighlight.addClass('nn-context-menu-active');
            }
            
            // Set context menu active flag
            this.view.contextMenuActive = true;
            
            // Set up listener to detect when menu closes
            const detectMenuClose = () => {
                setTimeout(() => {
                    this.view.contextMenuActive = false;
                }, 100);
                document.removeEventListener('mousedown', detectMenuClose);
                document.removeEventListener('keydown', detectMenuClose);
            };
            
            // Listen for clicks or key presses that would close the menu
            setTimeout(() => {
                document.addEventListener('mousedown', detectMenuClose);
                document.addEventListener('keydown', detectMenuClose);
            }, 0);
            
            if (type === 'folder' && file instanceof TFolder) {
                this.view.interactionManager.showFolderContextMenu(file, e);
            } else if (type === 'file' && file instanceof TFile) {
                this.view.interactionManager.showFileContextMenu(file, e);
            }
        });
    }

    /**
     * Cleanup global event listeners on view close
     * Prevents memory leaks from document-level listeners
     */
    cleanupGlobalListeners(): void {
        // No global listeners to clean up in current implementation
        // Event listeners are properly cleaned up via eventRefs
    }
}