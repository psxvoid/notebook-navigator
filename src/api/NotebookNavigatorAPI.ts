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

// Import versioning and compatibility
import { API_VERSION, negotiateVersion, VersionNegotiation, CompatibilityLevel } from './version';
import { CompatibilityAdapter, FeatureDetector } from './compatibility';
import { APIError, APIErrorCode } from './errors';

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
     * Negotiate version compatibility with a client
     */
    negotiateVersion(clientVersion: string): VersionNegotiation {
        return negotiateVersion(clientVersion);
    }

    /**
     * Create a compatibility-wrapped API for a specific client version
     */
    getCompatibleAPI(clientVersion: string): NotebookNavigatorAPI {
        const negotiation = this.negotiateVersion(clientVersion);

        if (negotiation.compatibility === CompatibilityLevel.INCOMPATIBLE) {
            throw new APIError(
                APIErrorCode.INCOMPATIBLE_VERSION,
                `API version ${clientVersion} is incompatible with plugin API ${API_VERSION.toString()}`,
                { negotiation }
            );
        }

        const adapter = new CompatibilityAdapter(this, clientVersion);
        return adapter.wrapAPI();
    }

    /**
     * List available features for the current API
     */
    listFeatures(): string[] {
        return FeatureDetector.getAvailableFeatures(this);
    }

    /**
     * Check if a specific feature is available
     */
    hasFeature(feature: string): boolean {
        return FeatureDetector.hasFeature(this, feature);
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
