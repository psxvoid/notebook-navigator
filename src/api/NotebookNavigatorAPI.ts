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
import { FileAPI } from './modules/FileAPI';
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

    // Sub-APIs
    public navigation: NavigationAPI;
    public metadata: MetadataAPI;
    public file: FileAPI;
    public selection: SelectionAPI;

    constructor(plugin: NotebookNavigatorPlugin, app: App) {
        this.plugin = plugin;
        this.app = app;
        this.events = new Events();

        // Initialize sub-APIs
        this.navigation = new NavigationAPI(this);
        this.metadata = new MetadataAPI(this);
        this.file = new FileAPI(this);
        this.selection = new SelectionAPI(this);
    }

    /**
     * Get the current API version
     */
    getVersion(): string {
        return API_VERSION.toString();
    }

    /**
     * Subscribe to Notebook Navigator events with type safety
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
