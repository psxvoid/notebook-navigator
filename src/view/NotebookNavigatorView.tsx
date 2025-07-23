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

// src/view/NotebookNavigatorView.tsx
import { ItemView, WorkspaceLeaf, TFile, Platform, ViewStateResult } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import React from 'react';
import NotebookNavigatorPlugin from '../main';
import { ServicesProvider } from '../context/ServicesContext';
import { SettingsProvider } from '../context/SettingsContext';
import { ExpansionProvider } from '../context/ExpansionContext';
import { SelectionProvider } from '../context/SelectionContext';
import { UIStateProvider } from '../context/UIStateContext';
import { StorageProvider } from '../context/StorageContext';
import { NotebookNavigatorComponent, NotebookNavigatorHandle } from '../components/NotebookNavigatorComponent';
import { VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT } from '../types';
import { strings } from '../i18n';

// State interface for view persistence - currently unused
// interface NotebookNavigatorViewState {
//     activeFilePath?: string;
// }

/**
 * Custom Obsidian view that hosts the React-based Notebook Navigator interface
 * Manages the lifecycle of the React application and provides integration between
 * Obsidian's view system and the React component tree
 */
export class NotebookNavigatorView extends ItemView {
    plugin: NotebookNavigatorPlugin;
    private root: Root | null = null;
    private componentRef = React.createRef<NotebookNavigatorHandle>();

    /**
     * Creates a new NotebookNavigatorView instance
     * @param leaf - The workspace leaf that contains this view
     * @param plugin - The plugin instance for accessing settings and methods
     */
    constructor(leaf: WorkspaceLeaf, plugin: NotebookNavigatorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    /**
     * Returns the unique identifier for this view type
     * @returns The view type constant used by Obsidian to manage this view
     */
    getViewType() {
        return VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT;
    }

    /**
     * Returns the display text shown in the view header
     * @returns The human-readable name of this view
     */
    getDisplayText() {
        return strings.plugin.viewName;
    }

    /**
     * Returns the icon identifier for this view
     * @returns The Obsidian icon name to display in tabs and headers
     */
    getIcon() {
        return 'notebook';
    }

    /**
     * Called when the view is opened/created
     * Initializes the React application within the Obsidian view container
     * Sets up the component hierarchy with necessary context providers
     */
    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty(); // Clear previous content
        container.classList.add('notebook-navigator');

        // Detect mobile environment and add mobile class
        const isMobile = Platform.isMobile;
        if (isMobile) {
            container.classList.add('notebook-navigator-mobile');
        }

        this.root = createRoot(container);
        this.root.render(
            <React.StrictMode>
                <SettingsProvider plugin={this.plugin}>
                    <ServicesProvider plugin={this.plugin}>
                        <StorageProvider app={this.plugin.app}>
                            <ExpansionProvider>
                                <SelectionProvider app={this.plugin.app} plugin={this.plugin} isMobile={isMobile}>
                                    <UIStateProvider isMobile={isMobile}>
                                        <NotebookNavigatorComponent ref={this.componentRef} />
                                    </UIStateProvider>
                                </SelectionProvider>
                            </ExpansionProvider>
                        </StorageProvider>
                    </ServicesProvider>
                </SettingsProvider>
            </React.StrictMode>
        );
    }

    /**
     * Called when the view is closed/destroyed
     * Properly unmounts the React application to prevent memory leaks
     * Cleans up any view-specific classes and resources
     */
    async onClose() {
        // Unmount the React app when the view is closed to prevent memory leaks
        const container = this.containerEl.children[1];
        container.classList.remove('notebook-navigator');
        this.root?.unmount();
        this.root = null;
    }

    /**
     * Navigates to a file in the navigator by selecting it and its parent folder
     */
    navigateToFile(file: TFile) {
        this.componentRef.current?.navigateToFile(file);
    }

    /**
     * Moves focus to the file pane for keyboard navigation
     */
    focusFilePane() {
        this.componentRef.current?.focusFilePane();
    }

    /**
     * Refreshes the UI by triggering a settings version update
     */
    refresh() {
        this.componentRef.current?.refresh();
    }

    /**
     * Deletes the currently active file using smart selection
     */
    deleteActiveFile() {
        this.componentRef.current?.deleteActiveFile();
    }

    /**
     * Creates a new note in the currently selected folder
     */
    async createNoteInSelectedFolder(): Promise<void> {
        await this.componentRef.current?.createNoteInSelectedFolder();
    }

    /**
     * Moves selected files to another folder using the folder suggest modal
     */
    async moveSelectedFiles(): Promise<void> {
        await this.componentRef.current?.moveSelectedFiles();
    }

    /**
     * Navigate to a folder by showing the folder suggest modal
     */
    async navigateToFolderWithModal(): Promise<void> {
        this.componentRef.current?.navigateToFolderWithModal();
    }

    /**
     * Navigate to a tag by showing the tag suggest modal
     */
    async navigateToTagWithModal(): Promise<void> {
        this.componentRef.current?.navigateToTagWithModal();
    }

    /**
     * Gets the current view state for persistence
     * Called by Obsidian when saving workspace state (e.g., when switching layouts)
     * Currently returns empty state as the view doesn't persist any specific data
     */
    getState(): Record<string, unknown> {
        return {};
    }

    /**
     * Restores the view state from persistence
     * Called by Obsidian when restoring workspace state (e.g., on startup or layout change)
     * The result parameter indicates what actions Obsidian will take:
     * - history: true = navigation history will be preserved
     * - layout: true = view layout will be preserved
     * - close: false = view won't be closed
     * Currently no-op as the view doesn't persist any specific state
     */
    async setState(_state: unknown, _result: ViewStateResult): Promise<void> {}

    /**
     * Called when view is resized
     * Triggered when the view dimensions change, including:
     * - Mobile drawer animations (swipe to show/hide)
     * - Desktop pane resizing
     * - Window size changes
     *
     * Mobile visibility detection:
     * On mobile, when the plugin drawer is hidden (display: none), dimensions are 0x0.
     * When the drawer becomes visible again, dimensions become > 0.
     * We use this as a visibility lifecycle event (similar to iOS/Android's viewDidAppear)
     * to trigger auto-scroll to the selected file, ensuring users see their current file
     * when returning to the navigator after it was hidden.
     *
     * This solves the issue where users:
     * 1. Have the navigator open with a file selected
     * 2. Swipe away to edit files in the editor
     * 3. Open different files while navigator is hidden
     * 4. Swipe back to the navigator
     * 5. Expect to see the currently active file (but without this, the virtualizer wouldn't scroll at all
     *    because the file selection changed while the component was hidden/display:none)
     */
    onResize() {
        if (!Platform.isMobile) return;

        const rect = this.containerEl.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
            window.dispatchEvent(new CustomEvent('notebook-navigator-visible'));
        }
    }
}
