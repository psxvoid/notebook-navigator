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

import { App, EventRef, Events } from 'obsidian';
import type NotebookNavigatorPlugin from '../main';
import type { NotebookNavigatorEventType, NotebookNavigatorEvents } from './types';

// Import all sub-APIs
import { NavigationAPI } from './modules/NavigationAPI';
import { SelectionAPI } from './modules/SelectionAPI';
import { MetadataAPI } from './modules/MetadataAPI';
import { TagAPI } from './modules/TagAPI';
import { StorageAPI } from './modules/StorageAPI';
import { ViewAPI } from './modules/ViewAPI';
import { FileSystemAPI } from './modules/FileSystemAPI';

/**
 * Public API for the Notebook Navigator plugin
 * Allows other plugins to interact with notebook navigation features
 */
export class NotebookNavigatorAPI {
    private plugin: NotebookNavigatorPlugin;
    public app: App;
    private events: Events;

    // Sub-APIs
    public navigation: NavigationAPI;
    public selection: SelectionAPI;
    public metadata: MetadataAPI;
    public tags: TagAPI;
    public storage: StorageAPI;
    public view: ViewAPI;
    public fileSystem: FileSystemAPI;

    constructor(plugin: NotebookNavigatorPlugin, app: App) {
        this.plugin = plugin;
        this.app = app;
        this.events = new Events();

        // Initialize sub-APIs
        this.navigation = new NavigationAPI(this);
        this.selection = new SelectionAPI(this);
        this.metadata = new MetadataAPI(this);
        this.tags = new TagAPI(this);
        this.storage = new StorageAPI(this);
        this.view = new ViewAPI(this);
        this.fileSystem = new FileSystemAPI(this);
    }

    /**
     * Subscribe to Notebook Navigator events
     */
    on<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void): EventRef {
        return this.events.on(event, callback);
    }

    /**
     * Unsubscribe from events
     */
    off(ref: EventRef): void {
        this.events.offref(ref);
    }

    /**
     * Trigger an event (internal use)
     */
    trigger<T extends NotebookNavigatorEventType>(event: T, data: NotebookNavigatorEvents[T]): void {
        this.events.trigger(event, data);
    }

    /**
     * Get the plugin instance
     */
    getPlugin(): NotebookNavigatorPlugin {
        return this.plugin;
    }

    /**
     * Get the app instance
     */
    getApp(): App {
        return this.app;
    }
}
