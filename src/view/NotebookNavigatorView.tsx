// src/view/NotebookNavigatorView.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import React from 'react';
import NotebookNavigatorPlugin from '../main';
import { AppProvider } from '../context/AppContext';
import { NotebookNavigatorComponent } from '../components/NotebookNavigatorComponent';

// A new, unique identifier for our React-based view
export const VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT = 'notebook-navigator-react-view';

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
    }
}