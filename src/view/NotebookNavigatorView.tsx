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
import { ItemView, WorkspaceLeaf, TFile, Platform } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import React from 'react';
import NotebookNavigatorPlugin from '../main';
import { ServicesProvider } from '../context/ServicesContext';
import { SettingsProvider } from '../context/SettingsContext';
import { ExpansionProvider } from '../context/ExpansionContext';
import { SelectionProvider } from '../context/SelectionContext';
import { UIStateProvider } from '../context/UIStateContext';
import { TagCacheProvider } from '../context/TagCacheContext';
import { NotebookNavigatorComponent, NotebookNavigatorHandle } from '../components/NotebookNavigatorComponent';
import { VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT } from '../types';
import { strings } from '../i18n';

/**
 * State interface for view persistence
 */
interface NotebookNavigatorViewState {
    activeFilePath?: string;
}

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
                        <TagCacheProvider app={this.plugin.app}>
                            <ExpansionProvider>
                                <SelectionProvider app={this.plugin.app} plugin={this.plugin} isMobile={isMobile}>
                                    <UIStateProvider isMobile={isMobile}>
                                        <NotebookNavigatorComponent ref={this.componentRef} />
                                    </UIStateProvider>
                                </SelectionProvider>
                            </ExpansionProvider>
                        </TagCacheProvider>
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
     * Reveals a file in the navigator by selecting it and its parent folder
     */
    revealFile(file: TFile, isManualReveal?: boolean) {
        this.componentRef.current?.revealFile(file, isManualReveal);
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
     * Toggles the visibility of the navigation pane
     */
    toggleNavigationPane() {
        this.componentRef.current?.toggleNavigationPane();
    }
    
    /**
     * Deletes the currently active file using smart selection
     */
    deleteActiveFile() {
        this.componentRef.current?.deleteActiveFile();
    }
    
    /**
     * Handles when the view becomes active (e.g., when returning from editor)
     */
    public handleViewBecomeActive() {
        this.componentRef.current?.handleBecomeActive();
    }

    /**
     * Gets the current view state for persistence
     * 
     * This is called when swiping away on mobile or saving workspace on desktop.
     * Despite being called, it's effectively useless on mobile because setState 
     * is NEVER called when returning to the view.
     * 
     * Mobile lifecycle when swiping away:
     * 1. active-leaf-change event fires (leaf: "markdown")
     * 2. getState called on navigator view
     * 3. Navigator focus changes from true to false
     * 4. View becomes inactive
     */
    getState(): Record<string, unknown> {
        // Return empty state as setState is never called on mobile anyway
        return {};
    }
    
    /**
     * Restores the view state from persistence
     * 
     * This is NEVER called on mobile when returning to the view.
     * This is a critical limitation that prevents any state restoration.
     * 
     * Mobile lifecycle when returning to navigator from editor:
     * 1. Navigator view became active
     * 2. handleViewBecomeActive called
     * 3. getState called (multiple times)
     * 4. active-leaf-change event fires (leaf: "notebook-navigator-react-view")
     * 5. Auto-reveal logic triggers
     * 
     * Notice setState is NOT in this list - it's simply never called on mobile.
     */
    async setState(state: NotebookNavigatorViewState, result: any): Promise<void> {
        // No implementation as this is never called on mobile where we need it most
    }
}