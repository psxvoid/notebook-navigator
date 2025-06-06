// src/view/NotebookNavigatorView.tsx
import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import React from 'react';
import NotebookNavigatorPlugin from '../main';
import { AppProvider } from '../context/AppContext';
import { ServicesProvider } from '../context/ServicesContext';
import { NotebookNavigatorComponent, NotebookNavigatorHandle } from '../components/NotebookNavigatorComponent';
import { VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT } from '../types';

export class NotebookNavigatorView extends ItemView {
    plugin: NotebookNavigatorPlugin;
    private root: Root | null = null;
    private componentRef = React.createRef<NotebookNavigatorHandle>();

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
                <ServicesProvider app={this.plugin.app}>
                    <AppProvider plugin={this.plugin}>
                        <NotebookNavigatorComponent ref={this.componentRef} />
                    </AppProvider>
                </ServicesProvider>
            </React.StrictMode>
        );
    }

    async onClose() {
        // Unmount the React app when the view is closed to prevent memory leaks
        this.root?.unmount();
    }
    
    /**
     * Reveals a file in the navigator by selecting it and its parent folder
     */
    revealFile(file: TFile) {
        this.componentRef.current?.revealFile(file);
    }
    
    /**
     * Refreshes the navigator view (e.g., after settings change)
     */
    refresh() {
        this.componentRef.current?.refresh();
    }
}