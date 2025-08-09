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

import { App, EventRef, Events, TFile, TFolder } from 'obsidian';
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
    private static readonly apiVersion = API_VERSION;

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
     * Get the current API version
     */
    getVersion(): string {
        return API_VERSION.toString();
    }

    /**
     * Check compatibility with a client version
     */
    checkCompatibility(clientVersion: string): VersionNegotiation {
        return negotiateVersion(clientVersion);
    }

    /**
     * Create a compatibility-wrapped API for a specific client version
     */
    getCompatibleAPI(clientVersion: string): NotebookNavigatorAPI {
        const negotiation = this.checkCompatibility(clientVersion);

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
     * Get available features for the current API
     */
    getAvailableFeatures(): string[] {
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

    // ===================================================================
    // Simple getters for common operations (for inline JS/Templater)
    // ===================================================================

    /**
     * Get the file at cursor position (focused file in the list)
     * @returns The currently focused TFile or null
     */
    getFileAtCursor(): TFile | null {
        const selection = this.selection.getSelection();
        if (selection.files.length > 0) {
            return this.app.vault.getFileByPath(selection.files[0]);
        }
        return null;
    }

    /**
     * Get all currently selected files
     * @returns Array of selected TFile objects
     */
    getSelectedFiles(): TFile[] {
        const selection = this.selection.getSelection();
        return selection.files.map(path => this.app.vault.getFileByPath(path)).filter((file): file is TFile => file !== null);
    }

    /**
     * Get the currently selected folder
     * @returns The currently selected TFolder or null
     */
    getSelectedFolder(): TFolder | null {
        const selection = this.selection.getSelection();
        if (selection.folder) {
            const folder = this.app.vault.getAbstractFileByPath(selection.folder);
            if (folder instanceof TFolder) {
                return folder;
            }
        }
        return null;
    }

    /**
     * Get the currently selected tag
     * @returns The currently selected tag string or null
     */
    getSelectedTag(): string | null {
        const selection = this.selection.getSelection();
        return selection.tag;
    }

    /**
     * Check if a file is pinned
     * @param file - TFile object or path string
     * @returns True if the file is pinned
     */
    isPinned(file: TFile | string): boolean {
        const path = typeof file === 'string' ? file : file.path;
        return this.metadata.isPinned(path);
    }

    /**
     * Get folder color
     * @param folder - TFolder object or path string
     * @returns Hex color string or null
     */
    getFolderColor(folder: TFolder | string): string | null {
        const path = typeof folder === 'string' ? folder : folder.path;
        const metadata = this.metadata.getFolderMetadata(path);
        return metadata?.color || null;
    }

    /**
     * Get tag color
     * @param tagPath - Tag path (e.g., '#work')
     * @returns Hex color string or null
     */
    getTagColor(tagPath: string): string | null {
        const metadata = this.metadata.getTagMetadata(tagPath);
        return metadata?.color || null;
    }

    /**
     * Quick check if the navigator view is open
     * @returns True if the navigator view is open
     */
    isNavigatorOpen(): boolean {
        return this.view.isOpen();
    }
}
