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

// Import sub-APIs
import { NavigationAPI } from './modules/NavigationAPI';
import { MetadataAPI } from './modules/MetadataAPI';
import { SelectionAPI } from './modules/SelectionAPI';

// Import versioning
import { API_VERSION } from './version';

/**
 * Public API for the Notebook Navigator plugin
 * Allows other plugins to interact with notebook navigation features
 */
export class NotebookNavigatorAPI {
    private plugin: NotebookNavigatorPlugin;
    public app: App;
    private events: Events;
    private storageReady = false;

    // Sub-APIs
    public navigation: NavigationAPI;
    public metadata: MetadataAPI;
    public selection: SelectionAPI;

    constructor(plugin: NotebookNavigatorPlugin, app: App) {
        this.plugin = plugin;
        this.app = app;
        this.events = new Events();

        // Initialize sub-APIs
        this.navigation = new NavigationAPI(this);
        this.metadata = new MetadataAPI(this);
        this.selection = new SelectionAPI(this);
    }

    /**
     * Get the current API version
     */
    getVersion(): string {
        return API_VERSION.toString();
    }

    /**
     * Check if storage system is ready for metadata operations
     * @returns true if storage is ready, false otherwise
     */
    isStorageReady(): boolean {
        return this.storageReady;
    }

    /**
     * Mark storage as ready (internal use only)
     * @internal
     */
    setStorageReady(ready: boolean): void {
        this.storageReady = ready;
        if (ready) {
            this.trigger('storage-ready');
        }
    }

    /**
     * Subscribe to Notebook Navigator events with type safety
     */
    on<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void): EventRef {
        return this.events.on(event, callback);
    }

    /**
     * Subscribe to an event only once - automatically unsubscribes after first trigger
     */
    once<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void): EventRef {
        const ref = this.events.on(event, (data: NotebookNavigatorEvents[T]) => {
            this.events.offref(ref);
            callback(data);
        });
        return ref;
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
    trigger<T extends NotebookNavigatorEventType>(
        event: T,
        ...args: NotebookNavigatorEvents[T] extends void ? [] : [data: NotebookNavigatorEvents[T]]
    ): void {
        // For void events, don't pass any data; for others, pass the data
        const data = args.length > 0 ? args[0] : undefined;
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
