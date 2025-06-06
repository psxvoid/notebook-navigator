// src/view/NotebookNavigatorView.tsx
import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import React from 'react';
import NotebookNavigatorPlugin from '../main';
import { AppProvider } from '../context/AppContext';
import { NotebookNavigatorComponent } from '../components/NotebookNavigatorComponent';

// A new, unique identifier for our React-based view
export const VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT = 'notebook-navigator-react-view';

// Global reference to reveal file in the navigator
let revealFileCallback: ((file: TFile) => void) | null = null;
let refreshCallback: (() => void) | null = null;

export function setRevealFileCallback(callback: (file: TFile) => void) {
    revealFileCallback = callback;
}

export function setRefreshCallback(callback: () => void) {
    refreshCallback = callback;
}

export class NotebookNavigatorView extends ItemView {
    plugin: NotebookNavigatorPlugin;
    private root: Root | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: NotebookNavigatorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT;
    }

    getDisplayText() {
        return 'Notebook Navigator';
    }

    getIcon() {
        return 'notebook';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty(); // Clear previous content

        this.root = createRoot(container);
        this.root.render(
            <React.StrictMode>
                <AppProvider plugin={this.plugin}>
                    <NotebookNavigatorComponent />
                </AppProvider>
            </React.StrictMode>
        );
    }

    async onClose() {
        // Unmount the React app when the view is closed to prevent memory leaks
        this.root?.unmount();
        revealFileCallback = null;
        refreshCallback = null;
    }
    
    /**
     * Reveals a file in the navigator by selecting it and its parent folder
     */
    revealFile(file: TFile) {
        if (revealFileCallback) {
            revealFileCallback(file);
        }
    }
    
    /**
     * Refreshes the navigator view (e.g., after settings change)
     */
    refresh() {
        if (refreshCallback) {
            refreshCallback();
        }
    }
}