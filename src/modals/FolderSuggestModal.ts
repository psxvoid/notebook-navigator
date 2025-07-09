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

import { App, FuzzySuggestModal, TFolder, FuzzyMatch, renderMatches } from 'obsidian';
import { isTFolder } from '../utils/typeGuards';
import { strings } from '../i18n';

/**
 * Modal for selecting a folder to move files to
 * Uses Obsidian's FuzzySuggestModal for fuzzy search and familiar UI
 */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
    private onChooseFolderCallback: (folder: TFolder) => void;
    private excludeFolders: Set<string>;

    /**
     * Creates a new FolderSuggestModal
     * @param app - The Obsidian app instance
     * @param onChooseFolder - Callback when a folder is selected
     * @param excludePaths - Optional set of folder paths to exclude from selection
     */
    constructor(
        app: App, 
        onChooseFolder: (folder: TFolder) => void,
        excludePaths?: Set<string>
    ) {
        super(app);
        this.onChooseFolderCallback = onChooseFolder;
        this.excludeFolders = excludePaths || new Set();
        
        // Set placeholder text
        this.setPlaceholder(strings.modals.folderSuggest.placeholder);
        
        // Set instructions
        this.setInstructions([
            { command: '↑↓', purpose: strings.modals.folderSuggest.instructions.navigate },
            { command: '↵', purpose: strings.modals.folderSuggest.instructions.move },
            { command: 'esc', purpose: strings.modals.folderSuggest.instructions.dismiss }
        ]);
    }

    /**
     * Gets all folders in the vault, excluding the ones that should be hidden
     * @returns Array of folders available for selection
     */
    getItems(): TFolder[] {
        const folders: TFolder[] = [];
        
        // Recursively collect all folders
        const collectFolders = (folder: TFolder) => {
            if (!this.excludeFolders.has(folder.path)) {
                folders.push(folder);
            }
            for (const child of folder.children) {
                if (isTFolder(child)) {
                    collectFolders(child);
                }
            }
        };
        
        // Start from root folder
        collectFolders(this.app.vault.getRoot());
        
        // Sort folders by path for consistent ordering
        folders.sort((a, b) => a.path.localeCompare(b.path));
        
        return folders;
    }

    /**
     * Gets the display text for a folder
     * Shows the full path to help distinguish folders with the same name
     * @param folder - The folder to get text for
     * @returns The display text
     */
    getItemText(folder: TFolder): string {
        // Show full path for clarity
        return folder.path || folder.name;
    }

    /**
     * Renders a folder item in the suggestion list
     * @param item - The fuzzy match result containing the folder
     * @param el - The element to render into
     */
    renderSuggestion(item: FuzzyMatch<TFolder>, el: HTMLElement): void {
        const folder = item.item;
        
        // Show full path in single line format
        // Root folder shows as "/"
        const displayPath = folder.path || '/';
        
        // Create a container div
        const itemEl = el.createDiv({ cls: 'nn-folder-suggest-item' });
        
        // Use renderMatches to render the text with highlights
        renderMatches(itemEl, displayPath, item.match.matches);
    }

    /**
     * Called when a folder is selected
     * @param folder - The selected folder
     * @param evt - The triggering event
     */
    onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
        this.onChooseFolderCallback(folder);
    }
}