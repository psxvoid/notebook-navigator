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

import { TFolder } from 'obsidian';
import type { NotebookNavigatorView } from './NotebookNavigatorView';

/**
 * Handles UI update and scroll operations for the Notebook Navigator
 * Provides methods for focus updates, scrolling, and folder visibility
 */
export class UiHelper {
    private view: NotebookNavigatorView;

    constructor(view: NotebookNavigatorView) {
        this.view = view;
    }

    /**
     * Updates keyboard focus indicator between folder and file panes
     * Adds visual focus ring to current item and scrolls it into view
     * Updates container attribute for CSS styling of active pane
     * Handles smart scrolling to keep focused items visible
     */
    updateFocus() {
        this.view.containerEl.querySelectorAll('.nn-focused').forEach(el => {
            el.removeClass('nn-focused');
        });

        // Update the data attribute for CSS styling
        const container = this.view.containerEl.querySelector('.notebook-navigator') as HTMLElement;
        if (container) {
            container.setAttribute('data-focus-pane', this.view.focusedPane);
        }

        if (this.view.focusedPane === 'folders') {
            const folders = this.view.folderTree.querySelectorAll('.nn-folder-item');
            const focusedFolder = folders[this.view.focusedFolderIndex];
            if (focusedFolder) {
                focusedFolder.addClass('nn-focused');
                focusedFolder.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        } else {
            const files = this.view.fileList.querySelectorAll('.nn-file-item');
            const focusedFile = files[this.view.focusedFileIndex];
            if (focusedFile) {
                focusedFile.addClass('nn-focused');
                // For file list, use a more controlled scrolling approach
                const fileList = this.view.fileList;
                const fileRect = (focusedFile as HTMLElement).getBoundingClientRect();
                const listRect = fileList.getBoundingClientRect();
                
                // Check if element is outside visible area
                if (fileRect.top < listRect.top) {
                    // Scroll up - the CSS scroll-padding-top will handle the offset
                    (focusedFile as HTMLElement).scrollIntoView({ block: 'start', behavior: 'smooth' });
                } else if (fileRect.bottom > listRect.bottom) {
                    // Scroll down - put item at bottom with some padding
                    (focusedFile as HTMLElement).scrollIntoView({ block: 'end', behavior: 'smooth' });
                }
                // If already visible, don't scroll
            }
        }
    }

    /**
     * Scrolls the selected folder into view in the folder tree
     * Centers the folder in the viewport for better visibility
     * Used after folder selection or tree expansion
     */
    scrollSelectedFolderIntoView() {
        if (this.view.selectedFolder) {
            const folderEl = this.view.folderTree.querySelector(
                `[data-path="${CSS.escape(this.view.selectedFolder.path)}"]`
            );
            if (folderEl) {
                // Only scroll if the element is not visible
                const container = this.view.folderTree;
                const element = folderEl as HTMLElement;
                const containerRect = container.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();
                
                // Check if element is outside the visible area
                const isAbove = elementRect.top < containerRect.top;
                const isBelow = elementRect.bottom > containerRect.bottom;
                
                if (isAbove || isBelow) {
                    // Only scroll when truly necessary
                    element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                }
            }
        }
    }

    /**
     * Scrolls the selected file into view in the file list
     * Handles sticky date headers and centers file in viewport
     * Only scrolls if file is outside visible area
     * Accounts for sticky headers when calculating scroll position
     */
    scrollSelectedFileIntoView() {
        if (this.view.selectedFile) {
            const fileEl = this.view.fileList.querySelector(
                `[data-path="${CSS.escape(this.view.selectedFile.path)}"]`
            );
            if (fileEl) {
                const container = this.view.fileList;
                const fileElement = fileEl as HTMLElement;
                
                // Get container and file positions
                const containerRect = container.getBoundingClientRect();
                const fileRect = fileElement.getBoundingClientRect();
                
                // Calculate if we need to scroll
                const isAboveView = fileRect.top < containerRect.top;
                const isBelowView = fileRect.bottom > containerRect.bottom;
                
                if (isAboveView || isBelowView) {
                    // Calculate the file's position relative to the scrollable container
                    const fileOffsetTop = fileElement.offsetTop;
                    
                    // Find all sticky headers above this file
                    let stickyOffset = 0;
                    const allHeaders = container.querySelectorAll('.nn-date-group-header');
                    allHeaders.forEach(header => {
                        const headerEl = header as HTMLElement;
                        if (headerEl.offsetTop < fileOffsetTop) {
                            stickyOffset = headerEl.offsetHeight;
                        }
                    });
                    
                    // Calculate ideal scroll position (center the file in view)
                    const containerHeight = container.clientHeight;
                    const fileHeight = fileElement.offsetHeight;
                    const idealScrollTop = fileOffsetTop - (containerHeight / 2) + (fileHeight / 2) - stickyOffset;
                    
                    // Smooth scroll to position
                    container.scrollTo({
                        top: Math.max(0, idealScrollTop),
                        behavior: 'auto' // Use 'auto' for immediate scroll on load
                    });
                }
            }
        }
    }

    /**
     * Ensures a folder is visible by expanding all its parent folders
     * Used when revealing files or navigating to hidden folders
     * Builds path from child to root then expands in correct order
     * @param folder - The folder to make visible
     * @returns True if any folders were expanded, false otherwise
     */
    ensureFolderVisible(folder: TFolder): boolean {
        // Expand all parent folders to make this folder visible
        let parent = folder.parent;
        const foldersToExpand: TFolder[] = [];
        let expandedAny = false;
        
        while (parent && parent.path !== '') {
            foldersToExpand.unshift(parent);
            parent = parent.parent;
        }
        
        // Expand folders from root to target
        foldersToExpand.forEach(f => {
            if (!this.view.expandedFolders.has(f.path)) {
                this.view.expandedFolders.add(f.path);
                expandedAny = true;
            }
        });
        
        return expandedAny;
    }
}