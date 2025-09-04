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

import { Plugin, WorkspaceLeaf, TFile, TFolder } from 'obsidian';
import { NotebookNavigatorSettings, DEFAULT_SETTINGS, NotebookNavigatorSettingTab } from './settings';
import { LocalStorageKeys, VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT, STORAGE_KEYS } from './types';
import { ISettingsProvider } from './interfaces/ISettingsProvider';
import { MetadataService } from './services/MetadataService';
import { TagOperations } from './services/TagOperations';
import { TagTreeService } from './services/TagTreeService';
import { CommandQueueService } from './services/CommandQueueService';
import { FileSystemOperations } from './services/FileSystemService';
import { NotebookNavigatorView } from './view/NotebookNavigatorView';
import { strings, getDefaultDateFormat, getDefaultTimeFormat } from './i18n';
import { localStorage, LOCALSTORAGE_VERSION } from './utils/localStorage';
import { NotebookNavigatorAPI } from './api/NotebookNavigatorAPI';
import { ItemType, PinnedNotes } from './types';

/**
 * Polyfill for requestIdleCallback
 *
 * The requestIdleCallback API allows scheduling non-critical work to be performed
 * when the browser is idle, improving performance by not blocking user interactions.
 *
 * Browser Support Issues:
 * - Not supported in Safari (both desktop and iOS)
 * - Not supported in older browsers
 *
 * This polyfill provides a fallback implementation using setTimeout:
 * - Executes the callback after the specified timeout (or immediately if no timeout)
 * - Provides a mock IdleDeadline object with timeRemaining() returning 50ms
 * - The 50ms value is a reasonable estimate for available idle time
 *
 * Usage in the plugin:
 * - Deferred metadata cleanup after plugin initialization
 * - Background tag tree diff calculations
 * - Other non-critical startup operations
 */
if (typeof window !== 'undefined' && !window.requestIdleCallback) {
    console.log('requestIdleCallback not supported, using polyfill');

    window.requestIdleCallback = function (callback: IdleRequestCallback, options?: { timeout?: number }) {
        const timeout = options?.timeout || 0;

        // setTimeout returns a number in browser environments
        const timeoutId = window.setTimeout(() => {
            // Create a mock IdleDeadline object
            const deadline: IdleDeadline = {
                didTimeout: timeout > 0,
                timeRemaining: () => 50 // Conservative estimate of available time
            };

            callback(deadline);
        }, timeout);

        // Cast is safe because we're in a browser environment
        return timeoutId;
    };

    window.cancelIdleCallback = function (id: number) {
        window.clearTimeout(id);
    };
}

/**
 * Main plugin class for Notebook Navigator
 * Provides a Notes-style file explorer for Obsidian with two-pane layout
 * Manages plugin lifecycle, settings, and view registration
 */
export default class NotebookNavigatorPlugin extends Plugin implements ISettingsProvider {
    settings: NotebookNavigatorSettings;
    ribbonIconEl: HTMLElement | undefined = undefined;
    metadataService: MetadataService | null = null;
    tagOperations: TagOperations | null = null;
    tagTreeService: TagTreeService | null = null;
    commandQueue: CommandQueueService | null = null;
    fileSystemOps: FileSystemOperations | null = null;
    api: NotebookNavigatorAPI | null = null;
    // A map of callbacks to notify open React views of changes
    private settingsUpdateListeners = new Map<string, () => void>();
    // A map of callbacks to notify open React views of file renames
    private fileRenameListeners = new Map<string, (oldPath: string, newPath: string) => void>();
    // Track if we're in the process of unloading
    private isUnloading = false;

    // LocalStorage keys for state persistence
    // These keys are used to save and restore the plugin's state between sessions
    keys: LocalStorageKeys = STORAGE_KEYS;

    /**
     * Called when external changes to settings are detected (e.g., from sync)
     * This method is called automatically by Obsidian when the data.json file
     * is modified externally while the plugin is running
     */
    async onExternalSettingsChange() {
        if (!this.isUnloading) {
            await this.loadSettings();
            this.onSettingsUpdate();
        }
    }

    /**
     * Plugin initialization - called when plugin is enabled
     * Sets up views, commands, event handlers, and UI elements
     * Ensures proper initialization order for all plugin components
     */
    async onload() {
        // Initialize localStorage with app instance for vault-specific storage
        // Must be done before loadSettings() which may call clearAllLocalStorage()
        localStorage.init(this.app);

        await this.loadSettings();

        // Clear old recentIcons format if it's still an array
        if (Array.isArray(this.settings.recentIcons)) {
            this.settings.recentIcons = {};
            await this.saveSettings();
        }

        // Set localStorage version if not present
        if (!localStorage.get(STORAGE_KEYS.localStorageVersionKey)) {
            localStorage.set(STORAGE_KEYS.localStorageVersionKey, LOCALSTORAGE_VERSION);
        }

        // Initialize icon service
        const { initializeIconService } = await import('./services/icons');
        initializeIconService();

        // Initialize metadata service for managing folder/tag colors, icons, and sort overrides
        this.metadataService = new MetadataService(this.app, this, () => this.tagTreeService);

        // Initialize tag operations service
        this.tagOperations = new TagOperations(this.app);

        // Initialize tag tree service
        this.tagTreeService = new TagTreeService();

        // Initialize command queue service
        this.commandQueue = new CommandQueueService(this.app);

        // Initialize file system operations service
        this.fileSystemOps = new FileSystemOperations(
            this.app,
            () => this.tagTreeService,
            () => this.commandQueue
        );

        // Initialize public API
        this.api = new NotebookNavigatorAPI(this, this.app);

        this.registerView(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT, leaf => {
            return new NotebookNavigatorView(leaf, this);
        });

        // View & Navigation commands
        this.addCommand({
            id: 'open-view',
            name: strings.commands.open,
            callback: async () => {
                // Check if navigator is already open
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                if (navigatorLeaves.length > 0) {
                    // Navigator exists - reveal it and focus the file pane
                    const leaf = navigatorLeaves[0];
                    this.app.workspace.revealLeaf(leaf);
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        view.focusFilePane();
                    }
                } else {
                    // Navigator is not open - open it
                    await this.activateView();
                }
            }
        });

        this.addCommand({
            id: 'reveal-file',
            name: strings.commands.revealFile,
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.parent) {
                    if (!checking) {
                        (async () => {
                            // Ensure navigator is open and visible
                            await this.activateView();

                            // Navigate to file
                            await this.revealFileInActualFolder(activeFile);
                        })();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'navigate-to-folder',
            name: strings.commands.navigateToFolder,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Show folder navigation modal
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        await view.navigateToFolderWithModal();
                        break;
                    }
                }
            }
        });

        this.addCommand({
            id: 'navigate-to-tag',
            name: strings.commands.navigateToTag,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Show tag navigation modal
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        await view.navigateToTagWithModal();
                        break;
                    }
                }
            }
        });

        this.addCommand({
            id: 'search',
            name: strings.commands.search,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Open search or focus it if already open
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        view.toggleSearch();
                        break;
                    }
                }
            }
        });

        // Layout & Display commands
        this.addCommand({
            id: 'toggle-dual-pane',
            name: strings.commands.toggleDualPane,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Toggle the dual pane setting
                this.settings.dualPane = !this.settings.dualPane;
                await this.saveSettings();
            }
        });

        this.addCommand({
            id: 'toggle-show-notes-from-subfolders',
            name: strings.commands.toggleSubfolders,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                this.settings.showNotesFromSubfolders = !this.settings.showNotesFromSubfolders;
                await this.saveSettings();
                this.onSettingsUpdate();
            }
        });

        // File Operations commands
        this.addCommand({
            id: 'create-new-note',
            name: strings.commands.createNewNote,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Create new note in selected folder
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        await view.createNoteInSelectedFolder();
                        break;
                    }
                }
            }
        });

        this.addCommand({
            id: 'move-files',
            name: strings.commands.moveFiles,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Move selected files
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        await view.moveSelectedFiles();
                        break;
                    }
                }
            }
        });

        this.addCommand({
            id: 'delete-file',
            name: strings.commands.deleteFile,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Find and trigger delete in all navigator views
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                navigatorLeaves.forEach(leaf => {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        view.deleteActiveFile();
                    }
                });
            }
        });

        // Tag Operations commands
        this.addCommand({
            id: 'add-tag',
            name: strings.commands.addTag,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Add tag to selected files
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        await view.addTagToSelectedFiles();
                        break;
                    }
                }
            }
        });

        this.addCommand({
            id: 'remove-tag',
            name: strings.commands.removeTag,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Remove tag from selected files
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        await view.removeTagFromSelectedFiles();
                        break;
                    }
                }
            }
        });

        this.addCommand({
            id: 'remove-all-tags',
            name: strings.commands.removeAllTags,
            callback: async () => {
                // Ensure navigator is open and visible
                await this.activateView();

                // Remove all tags from selected files
                const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
                for (const leaf of navigatorLeaves) {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        await view.removeAllTagsFromSelectedFiles();
                        break;
                    }
                }
            }
        });

        this.addSettingTab(new NotebookNavigatorSettingTab(this.app, this));

        // Register editor context menu
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, _, view) => {
                const file = view.file;
                if (file) {
                    menu.addSeparator();
                    menu.addItem(item => {
                        item.setTitle(strings.plugin.revealInNavigator)
                            .setIcon('lucide-folder-open')
                            .onClick(async () => {
                                // Ensure navigator is open and visible
                                await this.activateView();

                                // Navigate to file
                                await this.revealFileInActualFolder(file);
                            });
                    });
                }
            })
        );

        // Ribbon Icon For Opening
        this.ribbonIconEl = this.addRibbonIcon('lucide-notebook', strings.plugin.ribbonTooltip, async () => {
            await this.activateView();
        });

        // Register rename event handler to update folder metadata and notify file renames
        //
        // ARCHITECTURAL NOTE: Why folders and files are handled differently
        //
        // FOLDERS: Don't need a listener system because:
        // 1. React components hold references to Obsidian's TFolder objects
        // 2. When renamed, Obsidian automatically updates the TFolder's properties
        // 3. handleFolderRename updates settings (colors, icons, etc.) to the new path
        // 4. Settings update triggers re-render via SettingsContext version increment
        // 5. During re-render, components get fresh TFolder objects with updated names
        //
        // FILES: Need a listener system because:
        // 1. SelectionContext stores file paths in state (selectedFiles Set, selectedFile)
        // 2. These paths become stale after rename and must be manually updated
        // 3. Without updating, the selection would reference non-existent files
        // 4. The listener notifies SelectionContext to update stored paths
        //
        this.registerEvent(
            this.app.vault.on('rename', async (file, oldPath) => {
                if (this.isUnloading) return;

                if (file instanceof TFolder && this.metadataService) {
                    await this.metadataService.handleFolderRename(oldPath, file.path);
                    // The metadata service saves settings which triggers reactive updates
                } else if (file instanceof TFile && this.metadataService) {
                    // Update pinned files metadata
                    await this.metadataService.handleFileRename(oldPath, file.path);

                    // Check if file moved to a different folder
                    const getParentPath = (path: string): string => {
                        const lastSlash = path.lastIndexOf('/');
                        return lastSlash > 0 ? path.substring(0, lastSlash) : '/';
                    };

                    const oldParent = getParentPath(oldPath);
                    const newParent = getParentPath(file.path);
                    const movedToDifferentFolder = oldParent !== newParent;

                    // If the active file moved to a different folder, reveal it
                    // UNLESS it was moved from within the Navigator (drag-drop or context menu)
                    if (movedToDifferentFolder && file === this.app.workspace.getActiveFile()) {
                        if (this.commandQueue && !this.commandQueue.isMovingFile()) {
                            await this.revealFileInActualFolder(file);
                        }
                    }

                    // Notify all listeners about the file rename
                    this.fileRenameListeners.forEach(callback => {
                        try {
                            callback(oldPath, file.path);
                        } catch (error) {
                            console.error('Error in file rename listener:', error);
                        }
                    });
                }
            })
        );

        // Register delete event handler to clean up folder metadata
        this.registerEvent(
            this.app.vault.on('delete', async file => {
                if (!this.metadataService || this.isUnloading) return;

                if (file instanceof TFolder) {
                    await this.metadataService.handleFolderDelete(file.path);
                } else if (file instanceof TFile) {
                    await this.metadataService.handleFileDelete(file.path);
                }
                // The metadata service saves settings which triggers reactive updates
            })
        );

        // Use onLayoutReady for reliable initialization
        this.app.workspace.onLayoutReady(async () => {
            // Always open the view if it doesn't exist
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
            if (leaves.length === 0 && !this.isUnloading) {
                await this.activateView();
            }

            // Check for version updates
            await this.checkForVersionUpdate();

            // Trigger Style Settings plugin to parse our settings
            this.app.workspace.trigger('parse-style-settings');
        });
    }

    /**
     * Register a callback to be notified when settings are updated
     * Used by React views to trigger re-renders
     */
    public registerSettingsUpdateListener(id: string, callback: () => void): void {
        this.settingsUpdateListeners.set(id, callback);
    }

    /**
     * Unregister a settings update callback
     * Called when React views unmount to prevent memory leaks
     */
    public unregisterSettingsUpdateListener(id: string): void {
        this.settingsUpdateListeners.delete(id);
    }

    /**
     * Register a callback to be notified when files are renamed
     * Used by React views to update selection state
     */
    public registerFileRenameListener(id: string, callback: (oldPath: string, newPath: string) => void): void {
        this.fileRenameListeners.set(id, callback);
    }

    /**
     * Unregister a file rename callback
     * Called when React views unmount to prevent memory leaks
     */
    public unregisterFileRenameListener(id: string): void {
        this.fileRenameListeners.delete(id);
    }

    /**
     * Plugin cleanup - called when plugin is disabled or updated
     * Removes ribbon icon but preserves open views to maintain user workspace
     * Per Obsidian guidelines: leaves should not be detached in onunload
     */
    onunload() {
        // Set unloading flag to prevent any new operations
        this.isUnloading = true;

        // Clear all listeners first to prevent any callbacks during cleanup
        this.settingsUpdateListeners.clear();
        this.fileRenameListeners.clear();

        // Clean up the metadata service
        if (this.metadataService) {
            // Clear the reference to break circular dependencies
            this.metadataService = null;
        }

        // Clean up the tag operations service
        if (this.tagOperations) {
            this.tagOperations = null;
        }

        // Clean up the command queue service
        if (this.commandQueue) {
            this.commandQueue.clearAllOperations();
            this.commandQueue = null;
        }

        // Clean up the ribbon icon
        this.ribbonIconEl?.remove();
        this.ribbonIconEl = undefined;
    }

    /**
     * Clears all localStorage data for the plugin
     * Called on fresh install to ensure a clean start
     */
    private clearAllLocalStorage() {
        // Clear all known localStorage keys
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.remove(key);
        });
    }

    /**
     * Normalizes tag-related settings to use lowercase keys
     * Ensures consistency regardless of manual edits or external changes
     * Preserves values while standardizing keys to lowercase
     */
    private normalizeTagSettings() {
        const normalizeRecord = <T>(record: Record<string, T> | undefined): Record<string, T> => {
            if (!record) return {};

            const normalized: Record<string, T> = {};
            for (const [key, value] of Object.entries(record)) {
                const lowerKey = key.toLowerCase();
                // If there's a conflict (e.g., both "TODO" and "todo"), last one wins
                normalized[lowerKey] = value;
            }
            return normalized;
        };

        const normalizeArray = (array: string[] | undefined): string[] => {
            if (!array) return [];
            // Use Set to deduplicate in case of "TODO" and "todo" both present
            return [...new Set(array.map(s => s.toLowerCase()))];
        };

        if (this.settings.tagColors) {
            this.settings.tagColors = normalizeRecord(this.settings.tagColors);
        }

        if (this.settings.tagIcons) {
            this.settings.tagIcons = normalizeRecord(this.settings.tagIcons);
        }

        if (this.settings.tagSortOverrides) {
            this.settings.tagSortOverrides = normalizeRecord(this.settings.tagSortOverrides);
        }

        if (this.settings.tagAppearances) {
            this.settings.tagAppearances = normalizeRecord(this.settings.tagAppearances);
        }

        if (this.settings.favoriteTags) {
            this.settings.favoriteTags = normalizeArray(this.settings.favoriteTags);
        }

        if (this.settings.hiddenTags) {
            this.settings.hiddenTags = normalizeArray(this.settings.hiddenTags);
        }
    }

    /**
     * Loads plugin settings from Obsidian's data storage
     * Merges saved settings with default settings to ensure all required fields exist
     * Called during plugin initialization and when external changes are detected
     */
    async loadSettings() {
        const data = await this.loadData();
        const isFirstLaunch = !data; // No saved data means first launch

        // Clear localStorage on fresh install/reinstall
        if (isFirstLaunch) {
            this.clearAllLocalStorage();
        }

        // Start with default settings
        this.settings = { ...DEFAULT_SETTINGS, ...(data || {}) };

        // On first launch, set language-specific date/time formats
        if (isFirstLaunch || !data?.dateFormat) {
            this.settings.dateFormat = getDefaultDateFormat();
        }
        if (isFirstLaunch || !data?.timeFormat) {
            this.settings.timeFormat = getDefaultTimeFormat();
        }

        // On first launch, if showRootFolder is enabled by default,
        // ensure the root folder is in the expanded folders list
        if (isFirstLaunch && this.settings.showRootFolder) {
            const oldExpanded = localStorage.get<string[]>(STORAGE_KEYS.expandedFoldersKey);
            const expandedFolders = oldExpanded || [];

            if (!expandedFolders.includes('/')) {
                expandedFolders.push('/');
                localStorage.set(STORAGE_KEYS.expandedFoldersKey, expandedFolders);
            }
        }

        this.normalizeTagSettings();

        // Migrate pinnedNotes to new object format if needed
        this.migratePinnedNotesToObject();
    }

    /**
     * Migrates pinnedNotes from array format to object format
     */
    private migratePinnedNotesToObject() {
        // Check if pinnedNotes is in array format
        if (Array.isArray(this.settings.pinnedNotes)) {
            console.log('Migrating pinnedNotes from array to object format');

            const arrayFormat = this.settings.pinnedNotes as { path: string; context: Record<string, boolean> }[];
            const objectFormat: PinnedNotes = {};

            for (const note of arrayFormat) {
                if (note.path && note.context) {
                    objectFormat[note.path] = {
                        folder: note.context[ItemType.FOLDER] || note.context['folder'] || false,
                        tag: note.context[ItemType.TAG] || note.context['tag'] || false
                    };
                }
            }

            this.settings.pinnedNotes = objectFormat;
            console.log(`Migrated ${Object.keys(objectFormat).length} pinned notes to object format`);

            // Save immediately
            this.saveData(this.settings);
        } else if (!this.settings.pinnedNotes) {
            // Initialize as empty object
            this.settings.pinnedNotes = {};
        }
    }

    /**
     * Saves current plugin settings to Obsidian's data storage
     * Persists user preferences between sessions
     * Called whenever settings are modified
     */
    async saveSettings() {
        await this.saveData(this.settings);
        // Notify all listeners that settings have been updated
        this.onSettingsUpdate();
    }

    /**
     * Notifies all running views that the settings have been updated.
     * This triggers a re-render in the React components.
     */
    public onSettingsUpdate() {
        if (this.isUnloading) return;

        // Update API caches with new settings
        if (this.api) {
            if (this.api.metadata) {
                this.api.metadata.updateFromSettings(this.settings);
            }
        }

        // Create a copy of listeners to avoid issues if a callback modifies the map
        const listeners = Array.from(this.settingsUpdateListeners.values());
        listeners.forEach(callback => {
            try {
                callback();
            } catch {
                // Silently ignore errors from settings update callbacks
            }
        });
    }

    /**
     * Activates or creates the Notebook Navigator view
     * Reuses existing view if available, otherwise creates new one in left sidebar
     * Always reveals the view to ensure it's visible
     * @returns The workspace leaf containing the view, or null if creation failed
     */
    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);

        if (leaves.length > 0) {
            // View already exists - just reveal it
            leaf = leaves[0];
            workspace.revealLeaf(leaf);
        } else {
            // Create new leaf only if none exists
            leaf = workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT, active: true });
                workspace.revealLeaf(leaf);
            }
        }

        return leaf;
    }

    /**
     * Navigates to a specific file in the navigator
     * Expands parent folders and scrolls to make the file visible
     * Note: This does NOT activate/show the view - callers must do that if needed
     * @param file - The file to navigate to in the navigator
     */
    async revealFileInActualFolder(file: TFile) {
        // Find all navigator views and reveal the file
        const navigatorLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOK_NAVIGATOR_REACT);
        navigatorLeaves.forEach(leaf => {
            const view = leaf.view;
            if (view instanceof NotebookNavigatorView) {
                view.navigateToFile(file);
            }
        });
    }

    /**
     * Check if the plugin has been updated and show release notes if needed
     */
    private async checkForVersionUpdate(): Promise<void> {
        // Get current version from manifest
        const currentVersion = this.manifest.version;

        // Get last shown version from settings
        const lastShownVersion = this.settings.lastShownVersion;

        // Don't show on first install (when lastShownVersion is empty)
        if (!lastShownVersion) {
            this.settings.lastShownVersion = currentVersion;
            await this.saveSettings();
            return;
        }

        // Check if version has changed
        if (lastShownVersion !== currentVersion) {
            // Import the release notes modules dynamically
            const { WhatsNewModal } = await import('./modals/WhatsNewModal');
            const { getReleaseNotesBetweenVersions, getLatestReleaseNotes, compareVersions, shouldShowReleaseNotesForVersion } =
                await import('./releaseNotes');

            // Get release notes between versions
            let releaseNotes;
            if (compareVersions(currentVersion, lastShownVersion) > 0) {
                // Upgraded - show notes from last shown to current
                releaseNotes = getReleaseNotesBetweenVersions(lastShownVersion, currentVersion);
            } else {
                // Downgraded or same version - just show latest 5 releases
                releaseNotes = getLatestReleaseNotes();
            }

            // Update version before showing modal so it doesn't show again
            this.settings.lastShownVersion = currentVersion;
            await this.saveSettings();

            // Show the modal only if the current version doesn't have skipAutoShow
            if (shouldShowReleaseNotesForVersion(currentVersion)) {
                new WhatsNewModal(this.app, releaseNotes, this.settings.dateFormat).open();
            }
        }
    }
}
