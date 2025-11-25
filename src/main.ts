/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad, modifications by Pavel Sapehin
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

import { Plugin, TFile, FileView, TFolder, WorkspaceLeaf } from 'obsidian';
import { NotebookNavigatorSettings, DEFAULT_SETTINGS, NotebookNavigatorSettingTab, updateFeatureImageSize } from './settings';
import {
    LocalStorageKeys,
    NOTEBOOK_NAVIGATOR_VIEW,
    STORAGE_KEYS,
    type DualPaneOrientation,
    type UXPreferences,
    type VisibilityPreferences
} from './types';
import { ISettingsProvider } from './interfaces/ISettingsProvider';
import { MetadataService, type MetadataCleanupSummary } from './services/MetadataService';
import { TagOperations } from './services/TagOperations';
import { TagTreeService } from './services/TagTreeService';
import { CommandQueueService } from './services/CommandQueueService';
import { OmnisearchService } from './services/OmnisearchService';
import { FileSystemOperations } from './services/FileSystemService';
import { getIconService } from './services/icons';
import { RecentNotesService } from './services/RecentNotesService';
import RecentDataManager from './services/recent/RecentDataManager';
import { ExternalIconProviderController } from './services/icons/external/ExternalIconProviderController';
import { ExternalIconProviderId } from './services/icons/external/providerRegistry';
import type { NavigateToFolderOptions } from './hooks/useNavigatorReveal';
import ReleaseCheckService, { type ReleaseUpdateNotice } from './services/ReleaseCheckService';
import { NotebookNavigatorView } from './view/NotebookNavigatorView';
import { getDefaultDateFormat, getDefaultTimeFormat } from './i18n';
import { localStorage, LOCALSTORAGE_VERSION } from './utils/localStorage';
import { NotebookNavigatorAPI } from './api/NotebookNavigatorAPI';
import { initializeDatabase, shutdownDatabase } from './storage/fileOperations';
import { ExtendedApp } from './types/obsidian-extended';
import { getLeafSplitLocation } from './utils/workspaceSplit';
import { sanitizeKeyboardShortcuts } from './utils/keyboardShortcuts';
import { normalizeCanonicalIconId } from './utils/iconizeFormat';
import { isBooleanRecordValue, isPlainObjectRecordValue, isStringRecordValue, sanitizeRecord } from './utils/recordUtils';
import { isRecord } from './utils/typeGuards';
import { runAsyncAction } from './utils/async';
import { resetHiddenToggleIfNoSources } from './utils/exclusionUtils';
import {
    applyActiveVaultProfileToSettings,
    applyVaultProfileValues,
    ensureVaultProfiles,
    syncVaultProfileFromSettings,
    DEFAULT_VAULT_PROFILE_ID,
    cloneShortcuts
} from './utils/vaultProfiles';
import WorkspaceCoordinator from './services/workspace/WorkspaceCoordinator';
import HomepageController from './services/workspace/HomepageController';
import registerNavigatorCommands from './services/commands/registerNavigatorCommands';
import registerWorkspaceEvents from './services/workspace/registerWorkspaceEvents';
import type { RevealFileOptions } from './hooks/useNavigatorReveal';
import { ShortcutType, type ShortcutEntry } from './types/shortcuts';
import type { FolderAppearance } from './hooks/useListPaneAppearance';
import { isSortOption, type SortOption } from './settings/types';

import { AssertId, assertNever } from './utils/asserts';

const DEFAULT_UX_PREFERENCES: UXPreferences = {
    searchActive: false,
    includeDescendantNotes: true,
    showHiddenItems: false,
    pinShortcuts: false
};

export const enum CacheRebuildMode {
    DropDatabaseSlow,
    RefreshFast,
}

const UX_PREFERENCE_KEYS: (keyof UXPreferences)[] = ['searchActive', 'includeDescendantNotes', 'showHiddenItems', 'pinShortcuts'];

interface LegacyVisibilityMigration {
    hiddenFolders: string[];
    hiddenFiles: string[];
    hiddenTags: string[];
    navigationBanner: string | null;
    shouldApplyToProfiles: boolean;
}

type ToolbarVisibilitySnapshot = NotebookNavigatorSettings['toolbarVisibility'];

function mergeButtonVisibility<T extends string>(defaults: Record<T, boolean>, stored: unknown): Record<T, boolean> {
    const next: Record<T, boolean> = { ...defaults };
    if (!stored || typeof stored !== 'object') {
        return next;
    }

    const entries = stored as Partial<Record<T, unknown>>;
    (Object.keys(defaults) as T[]).forEach(key => {
        const value = entries[key];
        if (typeof value === 'boolean') {
            next[key] = value;
        }
    });

    return next;
}

function mergeToolbarVisibility(stored: unknown): ToolbarVisibilitySnapshot {
    const defaults = DEFAULT_SETTINGS.toolbarVisibility;
    const record = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : undefined;

    return {
        navigation: mergeButtonVisibility(defaults.navigation, record?.navigation),
        list: mergeButtonVisibility(defaults.list, record?.list)
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
    omnisearchService: OmnisearchService | null = null;
    externalIconController: ExternalIconProviderController | null = null;
    api: NotebookNavigatorAPI | null = null;
    recentNotesService: RecentNotesService | null = null;
    releaseCheckService: ReleaseCheckService | null = null;
    // Map of callbacks to notify open React views when settings change
    private settingsUpdateListeners = new Map<string, () => void>();
    // Map of callbacks to notify open React views when files are renamed
    private fileRenameListeners = new Map<string, (oldPath: string, newPath: string) => void>();
    private recentDataListeners = new Map<string, () => void>();
    private updateNoticeListeners = new Map<string, (notice: ReleaseUpdateNotice | null) => void>();
    // Flag indicating plugin is being unloaded to prevent operations during shutdown
    private isUnloading = false;
    // User preference for dual-pane mode (persisted in localStorage, not settings)
    private dualPanePreference = true;
    // User preference for dual-pane orientation (persisted in localStorage)
    private dualPaneOrientationPreference: DualPaneOrientation = 'horizontal';
    // Manages recent notes and icons data persistence
    private recentDataManager: RecentDataManager | null = null;
    // Coordinates workspace interactions with the navigator view
    private workspaceCoordinator: WorkspaceCoordinator | null = null;
    // Handles homepage file opening and startup behavior
    private homepageController: HomepageController | null = null;
    private pendingUpdateNotice: ReleaseUpdateNotice | null = null;
    private uxPreferences: UXPreferences = { ...DEFAULT_UX_PREFERENCES };
    private uxPreferenceListeners = new Map<string, () => void>();

    // Keys used for persisting UI state in browser localStorage
    keys: LocalStorageKeys = STORAGE_KEYS;

    /**
     * Called when external changes to settings are detected (e.g., from sync)
     * This method is called automatically by Obsidian when the data.json file
     * is modified externally while the plugin is running
     */
    async onExternalSettingsChange() {
        if (!this.isUnloading) {
            await this.loadSettings();
            this.initializeRecentDataManager();
            this.onSettingsUpdate();
        }
    }

    /**
     * Loads plugin settings from Obsidian's data storage
     * Returns true if this is the first launch (no saved data)
     */
    async loadSettings(): Promise<boolean> {
        // Load raw data and validate it is a plain object before treating as settings
        const rawData: unknown = await this.loadData();
        const storedData: Record<string, unknown> | null = isRecord(rawData) ? rawData : null;
        const storedSettings = storedData as Partial<NotebookNavigatorSettings> | null;
        const isFirstLaunch = storedData === null; // No saved data means first launch

        // Start with default settings
        this.settings = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) };
        // Validate and normalize keyboard shortcuts to use standard modifier names
        this.settings.keyboardShortcuts = sanitizeKeyboardShortcuts(this.settings.keyboardShortcuts);
        this.settings.toolbarVisibility = mergeToolbarVisibility(storedSettings?.toolbarVisibility);

        // Remove deprecated fields from settings object
        const mutableSettings = this.settings as unknown as Record<string, unknown>;
        delete mutableSettings.recentNotes;
        delete mutableSettings.recentIcons;
        delete mutableSettings.searchActive;
        delete mutableSettings.includeDescendantNotes;
        delete mutableSettings.showHiddenItems;

        const storedNoteGrouping = storedData ? storedData['noteGrouping'] : undefined;

        // Migrates legacy showIcons boolean to separate icon settings for sections, folders, tags, and pinned items
        const legacyShowIcons = mutableSettings.showIcons;
        if (typeof legacyShowIcons === 'boolean') {
            if (typeof storedData?.['showSectionIcons'] === 'undefined') {
                this.settings.showSectionIcons = legacyShowIcons;
            }
            if (typeof storedData?.['showFolderIcons'] === 'undefined') {
                this.settings.showFolderIcons = legacyShowIcons;
            }
            if (typeof storedData?.['showTagIcons'] === 'undefined') {
                this.settings.showTagIcons = legacyShowIcons;
            }
            if (typeof storedData?.['showPinnedIcon'] === 'undefined') {
                this.settings.showPinnedIcon = legacyShowIcons;
            }
        }
        delete mutableSettings.showIcons;

        // Migrate legacy parent folder visibility flag
        const legacyShowParentFolderNames = mutableSettings['showParentFolderNames'];
        if (typeof legacyShowParentFolderNames === 'boolean' && typeof storedData?.['showParentFolder'] === 'undefined') {
            this.settings.showParentFolder = legacyShowParentFolderNames;
        }
        delete mutableSettings['showParentFolderNames'];

        // Migrate legacy parent folder color toggle
        const legacyShowParentFolderColors = mutableSettings['showParentFolderColors'];
        if (typeof legacyShowParentFolderColors === 'boolean' && typeof storedData?.['showParentFolderColor'] === 'undefined') {
            this.settings.showParentFolderColor = legacyShowParentFolderColors;
        }
        delete mutableSettings['showParentFolderColors'];

        // Migrate legacy groupByDate boolean to noteGrouping dropdown
        const legacyGroupByDate = mutableSettings.groupByDate;
        if (typeof legacyGroupByDate === 'boolean' && typeof storedNoteGrouping === 'undefined') {
            this.settings.noteGrouping = legacyGroupByDate ? 'date' : 'none';
        }
        delete mutableSettings.groupByDate;

        // Validate noteGrouping value and reset to default if invalid
        if (this.settings.noteGrouping !== 'none' && this.settings.noteGrouping !== 'date' && this.settings.noteGrouping !== 'folder') {
            this.settings.noteGrouping = DEFAULT_SETTINGS.noteGrouping;
        }

        type LegacyAppearance = FolderAppearance & {
            showDate?: boolean;
            showPreview?: boolean;
            showImage?: boolean;
        };

        const migrateLegacyAppearanceMode = (appearance: LegacyAppearance | undefined): FolderAppearance | undefined => {
            if (!appearance) {
                return appearance;
            }

            const isLegacyCompact =
                appearance.mode === undefined &&
                appearance.showDate === false &&
                appearance.showPreview === false &&
                appearance.showImage === false;

            if (isLegacyCompact) {
                const migrated: FolderAppearance = { ...appearance, mode: 'compact' };
                delete (migrated as LegacyAppearance).showDate;
                delete (migrated as LegacyAppearance).showPreview;
                delete (migrated as LegacyAppearance).showImage;
                return migrated;
            }

            return appearance;
        };

        const migrateLegacyAppearances = (collection: Record<string, FolderAppearance> | undefined) => {
            if (!collection) {
                return;
            }

            Object.entries(collection).forEach(([key, appearance]) => {
                const migratedAppearance = migrateLegacyAppearanceMode(appearance);
                if (migratedAppearance) {
                    collection[key] = migratedAppearance;
                }
            });
        };

        migrateLegacyAppearances(this.settings.folderAppearances);
        migrateLegacyAppearances(this.settings.tagAppearances);

        const legacyColorFileTags = mutableSettings['applyTagColorsToFileTags'];
        if (typeof legacyColorFileTags === 'boolean') {
            this.settings.colorFileTags = legacyColorFileTags;
        }
        delete mutableSettings['applyTagColorsToFileTags'];

        const legacySlimItemHeight = mutableSettings['slimItemHeight'];
        if (typeof legacySlimItemHeight === 'number' && Number.isFinite(legacySlimItemHeight)) {
            if (typeof storedData?.['compactItemHeight'] === 'undefined') {
                this.settings.compactItemHeight = legacySlimItemHeight;
            }
        }
        delete mutableSettings['slimItemHeight'];

        const legacySlimItemHeightScaleText = mutableSettings['slimItemHeightScaleText'];
        if (typeof legacySlimItemHeightScaleText === 'boolean') {
            if (typeof storedData?.['compactItemHeightScaleText'] === 'undefined') {
                this.settings.compactItemHeightScaleText = legacySlimItemHeightScaleText;
            }
        }
        delete mutableSettings['slimItemHeightScaleText'];

        const legacyShowFileTagsInSlimMode = mutableSettings['showFileTagsInSlimMode'];
        if (typeof legacyShowFileTagsInSlimMode === 'boolean') {
            if (typeof storedData?.['showFileTagsInCompactMode'] === 'undefined') {
                this.settings.showFileTagsInCompactMode = legacyShowFileTagsInSlimMode;
            }
        }
        delete mutableSettings['showFileTagsInSlimMode'];

        this.sanitizeSettingsRecords();

        // Set language-specific date/time formats if not already set
        if (!this.settings.dateFormat) {
            this.settings.dateFormat = getDefaultDateFormat();
        }
        if (!this.settings.timeFormat) {
            this.settings.timeFormat = getDefaultTimeFormat();
        }

        if (typeof this.settings.recentNotesCount !== 'number' || this.settings.recentNotesCount <= 0) {
            this.settings.recentNotesCount = DEFAULT_SETTINGS.recentNotesCount;
        }

        if (!Array.isArray(this.settings.rootFolderOrder)) {
            this.settings.rootFolderOrder = [];
        }

        if (!Array.isArray(this.settings.rootTagOrder)) {
            this.settings.rootTagOrder = [];
        }

        const normalizeFolderNoteBlock = (input: string): string =>
            input
                .replace(/\r\n/g, '\n')
                .replace(/^---\s*\n?/, '')
                .replace(/\n?---\s*$/, '')
                .trim();

        const folderNotePropertiesSetting = this.settings.folderNoteProperties;
        if (Array.isArray(folderNotePropertiesSetting)) {
            const migratedProperties = folderNotePropertiesSetting
                .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
                .filter(entry => entry.length > 0)
                .map(entry => `${entry}: true`)
                .join('\n');
            this.settings.folderNoteProperties = normalizeFolderNoteBlock(migratedProperties);
        } else if (typeof folderNotePropertiesSetting === 'string') {
            this.settings.folderNoteProperties = normalizeFolderNoteBlock(folderNotePropertiesSetting);
        } else {
            this.settings.folderNoteProperties = DEFAULT_SETTINGS.folderNoteProperties;
        }

        // Initialize update check setting with default value for existing users
        if (typeof this.settings.checkForUpdatesOnStart !== 'boolean') {
            this.settings.checkForUpdatesOnStart = true;
        }

        updateFeatureImageSize(this.settings.featureImageSize)

        this.registerSettingsUpdateListener('featured-image-size', () => {
            updateFeatureImageSize(this.settings.featureImageSize)
        })

        // Load saved orientation preference for this device
        const storedOrientation = localStorage.get<unknown>(this.keys.dualPaneOrientationKey);
        const parsedOrientation = this.parseDualPaneOrientation(storedOrientation);
        this.dualPaneOrientationPreference = parsedOrientation ?? 'horizontal';

        // Extract legacy exclusion settings and migrate to vault profile system
        const legacyVisibility = this.extractLegacyVisibilitySettings(storedData);
        const legacyShortcuts = this.extractLegacyShortcuts(storedData);

        // Initialize vault profiles and apply legacy settings to the active profile
        ensureVaultProfiles(this.settings);
        this.applyLegacyVisibilityMigration(legacyVisibility);
        this.applyLegacyShortcutsMigration(legacyShortcuts);
        this.normalizeIconSettings(this.settings);
        applyActiveVaultProfileToSettings(this.settings);

        return isFirstLaunch;
    }

    /**
     * Sets up the recent data manager and loads persisted data.
     */
    private initializeRecentDataManager(): void {
        // Create manager instance on first call
        if (!this.recentDataManager) {
            this.recentDataManager = new RecentDataManager({
                settings: this.settings,
                keys: this.keys,
                onRecentDataChange: () => this.notifyRecentDataUpdate()
            });
        }

        // Load recent notes and icons from local storage
        this.recentDataManager.initialize();
    }

    /**
     * Returns the list of recent note paths from local storage
     */
    public getRecentNotes(): string[] {
        return this.recentDataManager?.getRecentNotes() ?? [];
    }

    /**
     * Stores the list of recent note paths to local storage
     */
    public setRecentNotes(recentNotes: string[]): void {
        this.recentDataManager?.setRecentNotes(recentNotes);
    }

    /**
     * Trims the recent notes list to the configured maximum count
     */
    public applyRecentNotesLimit(): void {
        this.recentDataManager?.applyRecentNotesLimit();
    }

    /**
     * Registers a listener to be notified when recent data changes
     */
    public registerRecentDataListener(id: string, callback: () => void): void {
        this.recentDataListeners.set(id, callback);
    }

    /**
     * Unregisters a recent data change listener
     */
    public unregisterRecentDataListener(id: string): void {
        this.recentDataListeners.delete(id);
    }

    /**
     * Registers a listener that will be notified when release update notices change.
     */
    public registerUpdateNoticeListener(id: string, callback: (notice: ReleaseUpdateNotice | null) => void): void {
        this.updateNoticeListeners.set(id, callback);
    }

    /**
     * Removes an update notice listener.
     */
    public unregisterUpdateNoticeListener(id: string): void {
        this.updateNoticeListeners.delete(id);
    }

    /**
     * Returns the current pending update notice, if any.
     */
    public getPendingUpdateNotice(): ReleaseUpdateNotice | null {
        return this.pendingUpdateNotice;
    }

    /**
     * Marks the update notice as shown so it will not display again.
     */
    public async markUpdateNoticeAsDisplayed(version: string): Promise<void> {
        if (this.settings.lastAnnouncedRelease === version) {
            return;
        }

        this.settings.lastAnnouncedRelease = version;

        if (this.pendingUpdateNotice && this.pendingUpdateNotice.version === version) {
            this.setPendingUpdateNotice(null);
        }

        await this.saveSettingsAndUpdate();
    }

    /**
     * Returns the map of recent icon IDs per provider from local storage
     */
    public getRecentIcons(): Record<string, string[]> {
        return this.recentDataManager?.getRecentIcons() ?? {};
    }

    /**
     * Stores the map of recent icon IDs per provider to local storage
     */
    public setRecentIcons(recentIcons: Record<string, string[]>): void {
        this.recentDataManager?.setRecentIcons(recentIcons);
    }

    /**
     * Checks if the given file is open in the right sidebar
     */
    public isFileInRightSidebar(file: TFile): boolean {
        if (!this.settings.autoRevealIgnoreRightSidebar) {
            return false;
        }

        const view = this.app.workspace.getActiveViewOfType(FileView);
        if (!view?.file || view.file.path !== file.path) {
            return false;
        }

        const split = getLeafSplitLocation(this.app, view.leaf ?? null);
        return split === 'right-sidebar';
    }

    /**
     * Plugin initialization - called when plugin is enabled
     */
    async onload() {
        // Initialize localStorage before database so version checks work
        localStorage.init(this.app);

        // Initialize database early for StorageContext consumers
        try {
            const appId = (this.app as ExtendedApp).appId || '';
            await initializeDatabase(appId);
        } catch (e) {
            console.error('Failed to initialize database during plugin load:', e);
            // Fail fast: abort plugin load if database cannot initialize
            throw e instanceof Error ? e : new Error(String(e));
        }

        // Load settings and check if this is first launch
        const isFirstLaunch = await this.loadSettings();
        const storedDualPane = localStorage.get<unknown>(this.keys.dualPaneKey);
        const parsedDualPane = this.parseDualPanePreference(storedDualPane);
        this.dualPanePreference = parsedDualPane ?? true;
        const storedLocalStorageVersion = localStorage.get<number>(STORAGE_KEYS.localStorageVersionKey);
        this.loadUXPreferences();

        // Handle first launch initialization
        if (isFirstLaunch) {
            // Normalize all tag settings to lowercase
            this.normalizeTagSettings();

            // Clear all localStorage data (if plugin was reinstalled)
            this.clearAllLocalStorage();

            // Reset dual-pane preference to default on fresh install
            this.dualPanePreference = true;
            this.dualPaneOrientationPreference = 'horizontal';
            this.uxPreferences = { ...DEFAULT_UX_PREFERENCES };
            this.persistUXPreferences(false);

            // Ensure root folder is expanded on first launch (default is enabled)
            if (this.settings.showRootFolder) {
                const expandedFolders = ['/'];
                localStorage.set(STORAGE_KEYS.expandedFoldersKey, expandedFolders);
            }

            // Set localStorage version
            localStorage.set(STORAGE_KEYS.localStorageVersionKey, LOCALSTORAGE_VERSION);
        } else {
            // Check localStorage version for potential migrations
            const versionNumber =
                typeof storedLocalStorageVersion === 'number' ? storedLocalStorageVersion : Number(storedLocalStorageVersion ?? Number.NaN);
            if (!versionNumber || versionNumber !== LOCALSTORAGE_VERSION) {
                // Future localStorage migration logic can go here
                localStorage.set(STORAGE_KEYS.localStorageVersionKey, LOCALSTORAGE_VERSION);
            }
        }

        // Initialize recent data management
        this.initializeRecentDataManager();

        this.recentNotesService = new RecentNotesService(this);

        // Initialize workspace and homepage coordination
        this.workspaceCoordinator = new WorkspaceCoordinator(this);
        this.homepageController = new HomepageController(this, this.workspaceCoordinator);

        // Initialize services
        this.tagTreeService = new TagTreeService();
        this.metadataService = new MetadataService(this.app, this, () => this.tagTreeService);
        this.tagOperations = new TagOperations(
            this.app,
            () => this.settings,
            () => this.tagTreeService,
            () => this.metadataService
        );
        this.commandQueue = new CommandQueueService(this.app);
        this.fileSystemOps = new FileSystemOperations(
            this.app,
            () => this.tagTreeService,
            () => this.commandQueue,
            (): VisibilityPreferences => ({
                includeDescendantNotes: this.uxPreferences.includeDescendantNotes,
                showHiddenItems: this.uxPreferences.showHiddenItems
            }),
            this
        );
        this.omnisearchService = new OmnisearchService(this.app);
        this.api = new NotebookNavigatorAPI(this, this.app);
        this.releaseCheckService = new ReleaseCheckService(this);

        const iconService = getIconService();
        this.externalIconController = new ExternalIconProviderController(this.app, iconService, this);
        await this.externalIconController.initialize();
        // Sync icon settings with external providers without blocking
        const iconController = this.externalIconController;
        if (iconController) {
            runAsyncAction(() => iconController.syncWithSettings());
        }

        // Re-sync icon settings when settings update
        this.registerSettingsUpdateListener('external-icon-controller', () => {
            const controller = this.externalIconController;
            if (controller) {
                runAsyncAction(() => controller.syncWithSettings());
            }
        });

        // Register view
        this.registerView(NOTEBOOK_NAVIGATOR_VIEW, leaf => {
            return new NotebookNavigatorView(leaf, this);
        });

        // Register commands
        registerNavigatorCommands(this);

        // ==== Settings tab ====
        this.addSettingTab(new NotebookNavigatorSettingTab(this.app, this));

        // Register editor context menu
        registerWorkspaceEvents(this);

        // Handle Obsidian quit events to flush state before shutdown
        this.registerEvent(
            this.app.workspace.on('quit', () => {
                // Obsidian is closing the window; flush critical state promptly
                this.handleWorkspaceQuit();
            })
        );

        // Post-layout initialization
        // Only auto-create the navigator view on first launch; upgrades restore existing leaves themselves
        const shouldActivateOnStartup = isFirstLaunch;

        this.app.workspace.onLayoutReady(() => {
            // Execute startup tasks asynchronously to avoid blocking the layout
            runAsyncAction(async () => {
                if (this.isUnloading) {
                    return;
                }

                await this.homepageController?.handleWorkspaceReady({ shouldActivateOnStartup });

                // Check for version updates
                await this.checkForVersionUpdate();

                // Trigger Style Settings plugin to parse our settings
                this.app.workspace.trigger('parse-style-settings');

                // Check for new GitHub releases if enabled, without blocking startup
                if (this.settings.checkForUpdatesOnStart) {
                    runAsyncAction(() => this.runReleaseUpdateCheck());
                }
            });
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
     * Returns whether dual-pane mode is enabled
     */
    public useDualPane(): boolean {
        return this.dualPanePreference;
    }

    public isShuttingDown(): boolean {
        return this.isUnloading;
    }

    /**
     * Updates the dual-pane preference and persists to local storage
     */
    public setDualPanePreference(enabled: boolean): void {
        if (this.dualPanePreference === enabled) {
            return;
        }

        this.dualPanePreference = enabled;
        localStorage.set(this.keys.dualPaneKey, enabled ? '1' : '0');
        this.notifySettingsUpdate();
    }

    /**
     * Toggles the dual-pane preference between enabled and disabled
     */
    public toggleDualPanePreference(): void {
        this.setDualPanePreference(!this.dualPanePreference);
    }

    /**
     * Returns the active dual-pane orientation for this device
     */
    public getDualPaneOrientation(): DualPaneOrientation {
        return this.dualPaneOrientationPreference;
    }

    /**
     * Updates the dual-pane orientation and persists to vault-scoped local storage.
     */
    public async setDualPaneOrientation(orientation: DualPaneOrientation): Promise<void> {
        // Normalize value to valid orientation
        const normalized: DualPaneOrientation = orientation === 'vertical' ? 'vertical' : 'horizontal';
        if (this.dualPaneOrientationPreference === normalized) {
            return;
        }

        // Update in-memory preference and persist
        this.dualPaneOrientationPreference = normalized;
        localStorage.set(this.keys.dualPaneOrientationKey, normalized);
        this.notifySettingsUpdate();
    }

    /**
     * Sets the active vault profile and synchronizes hidden folder, tag, and note patterns.
     */
    public async setVaultProfile(profileId: string): Promise<void> {
        ensureVaultProfiles(this.settings);
        const nextProfile =
            this.settings.vaultProfiles.find(profile => profile.id === profileId) ??
            this.settings.vaultProfiles.find(profile => profile.id === DEFAULT_VAULT_PROFILE_ID) ??
            this.settings.vaultProfiles[0];

        if (!nextProfile) {
            return;
        }

        this.settings.vaultProfile = nextProfile.id;
        applyVaultProfileValues(this.settings, nextProfile);

        resetHiddenToggleIfNoSources({
            settings: this.settings,
            showHiddenItems: this.getUXPreferences().showHiddenItems,
            setShowHiddenItems: value => this.setShowHiddenItems(value)
        });

        await this.saveSettingsAndUpdate();
    }

    public getUXPreferences(): UXPreferences {
        return { ...this.uxPreferences };
    }

    public registerUXPreferencesListener(id: string, callback: () => void): void {
        this.uxPreferenceListeners.set(id, callback);
    }

    public unregisterUXPreferencesListener(id: string): void {
        this.uxPreferenceListeners.delete(id);
    }

    public setSearchActive(value: boolean): void {
        this.updateUXPreference('searchActive', value);
    }

    public setIncludeDescendantNotes(value: boolean): void {
        this.updateUXPreference('includeDescendantNotes', value);
    }

    public toggleIncludeDescendantNotes(): void {
        this.setIncludeDescendantNotes(!this.uxPreferences.includeDescendantNotes);
    }

    public setShowHiddenItems(value: boolean): void {
        this.updateUXPreference('showHiddenItems', value);
    }

    public toggleShowHiddenItems(): void {
        this.setShowHiddenItems(!this.uxPreferences.showHiddenItems);
    }

    public setPinShortcuts(value: boolean): void {
        this.updateUXPreference('pinShortcuts', value);
    }

    private updateUXPreference(key: keyof UXPreferences, value: boolean): void {
        if (this.uxPreferences[key] === value) {
            return;
        }

        this.uxPreferences = {
            ...this.uxPreferences,
            [key]: value
        };
        this.persistUXPreferences();
    }

    private loadUXPreferences(): void {
        const stored = localStorage.get<unknown>(this.keys.uxPreferencesKey);
        if (this.isUXPreferencesRecord(stored)) {
            this.uxPreferences = {
                ...DEFAULT_UX_PREFERENCES,
                ...stored
            };

            const hasAllKeys = UX_PREFERENCE_KEYS.every(key => {
                return typeof stored[key] === 'boolean';
            });

            if (!hasAllKeys) {
                this.persistUXPreferences(false);
            }
        } else {
            this.uxPreferences = { ...DEFAULT_UX_PREFERENCES };
            this.persistUXPreferences(false);
        }
    }

    private persistUXPreferences(notify = true): void {
        localStorage.set(this.keys.uxPreferencesKey, this.uxPreferences);
        if (notify) {
            this.notifyUXPreferencesUpdate();
        }
    }

    private isUXPreferencesRecord(value: unknown): value is Partial<UXPreferences> {
        if (value === null || typeof value !== 'object') {
            return false;
        }

        const record = value as Record<string, unknown>;
        for (const key of UX_PREFERENCE_KEYS) {
            const entry = record[key];
            if (typeof entry !== 'undefined' && typeof entry !== 'boolean') {
                return false;
            }
        }
        return true;
    }

    private notifyUXPreferencesUpdate(): void {
        if (this.uxPreferenceListeners.size === 0) {
            return;
        }

        for (const [id, listener] of this.uxPreferenceListeners) {
            try {
                listener();
            } catch (error) {
                console.error(`Failed to notify UX preferences listener "${id}"`, error);
            }
        }
    }

    /**
     * Parses dual-pane preference from local storage string value
     */
    private parseDualPanePreference(raw: unknown): boolean | null {
        if (typeof raw === 'string') {
            return raw === '1';
        }

        return false;
    }

    /**
     * Parses dual-pane orientation from local storage
     */
    private parseDualPaneOrientation(raw: unknown): DualPaneOrientation | null {
        if (raw === 'vertical') {
            return 'vertical';
        }
        if (raw === 'horizontal') {
            return 'horizontal';
        }
        return null;
    }

    /**
     * Unregister a settings update callback
     * Called when React views unmount to prevent memory leaks
     */
    public unregisterSettingsUpdateListener(id: string): void {
        this.settingsUpdateListeners.delete(id);
    }

    /**
     * Rebuilds the entire Notebook Navigator cache.
     * Activates the view if needed and delegates to the view's rebuild method.
     * Throws if plugin is unloading or view is not available.
     */
    public async rebuildCache(mode: CacheRebuildMode): Promise<void> {
        const view = await this.getActivatedView()

        switch (mode) {
            case CacheRebuildMode.DropDatabaseSlow:
                await view.rebuildCache()
                return
            case CacheRebuildMode.RefreshFast:
                await view.rebuildCacheFast()
                return
            default:
                assertNever(AssertId.RebuildCacheUnknown, mode)
        }
    }

    public isExternalIconProviderInstalled(providerId: ExternalIconProviderId): boolean {
        return this.externalIconController?.isProviderInstalled(providerId) ?? false;
    }

    public isExternalIconProviderDownloading(providerId: ExternalIconProviderId): boolean {
        return this.externalIconController?.isProviderDownloading(providerId) ?? false;
    }

    public getExternalIconProviderVersion(providerId: ExternalIconProviderId): string | null {
        return this.externalIconController?.getProviderVersion(providerId) ?? null;
    }

    public async downloadExternalIconProvider(providerId: ExternalIconProviderId): Promise<void> {
        if (!this.externalIconController) {
            throw new Error('External icon controller not initialized');
        }
        await this.externalIconController.installProvider(providerId);
    }

    public async removeExternalIconProvider(providerId: ExternalIconProviderId): Promise<void> {
        if (!this.externalIconController) {
            throw new Error('External icon controller not initialized');
        }
        await this.externalIconController.removeProvider(providerId);
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

    public notifyFileRenameListeners(oldPath: string, newPath: string): void {
        this.fileRenameListeners.forEach(callback => {
            try {
                callback(oldPath, newPath);
            } catch (error) {
                console.error('Error in file rename listener:', error);
            }
        });
    }

    /**
     * Handles Obsidian's quit event. Performs a best-effort synchronous cleanup
     * so pending preferences, caches, and database handles close before exit.
     */
    private handleWorkspaceQuit(): void {
        this.initiateShutdown();
    }

    /**
     * Guards against duplicate teardown and flushes critical services before
     * either Obsidian quits or the plugin unloads.
     */
    private initiateShutdown(): void {
        if (this.isUnloading) {
            return;
        }

        this.isUnloading = true;

        try {
            // Ensure recent notes/icons hit disk before the process exits
            this.recentDataManager?.flushPendingPersists();
        } catch (error) {
            console.error('Failed to flush recent data during shutdown:', error);
        }

        if (this.commandQueue) {
            // Drop any queued operations so listeners stop reacting
            this.commandQueue.clearAllOperations();
        }

        this.stopNavigatorContentProcessing();

        shutdownDatabase();
    }

    /**
     * Stops background processing inside every mounted navigator view to avoid
     * running content providers while shutdown is in progress.
     */
    private stopNavigatorContentProcessing(): void {
        try {
            const leaves = this.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of leaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    // Halt preview/tag generation loops inside each React view
                    view.stopContentProcessing();
                }
            }
        } catch (error) {
            console.error('Failed stopping content processing during shutdown:', error);
        }
    }

    /**
     * Plugin cleanup - called when plugin is disabled or updated
     * Removes ribbon icon but preserves open views to maintain user workspace
     * Per Obsidian guidelines: leaves should not be detached in onunload
     */
    onunload() {
        this.initiateShutdown();

        this.recentDataManager?.dispose();

        // Clear all listeners first to prevent any callbacks during cleanup
        this.settingsUpdateListeners.clear();
        this.fileRenameListeners.clear();
        this.recentDataListeners.clear();

        if (this.externalIconController) {
            this.externalIconController.dispose();
            this.externalIconController = null;
        }

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
            this.commandQueue = null;
        }

        // Clean up the ribbon icon
        this.ribbonIconEl?.remove();
        this.ribbonIconEl = undefined;

        this.omnisearchService = null;
        this.recentDataManager = null;
    }

    /**
     * Clears all localStorage data for the plugin
     * Called on fresh install to ensure a clean start
     */
    private clearAllLocalStorage() {
        // Clear all known localStorage keys
        // Get key names to enable proper TypeScript typing and avoid losing type information
        const storageKeyNames = Object.keys(STORAGE_KEYS) as (keyof LocalStorageKeys)[];
        storageKeyNames.forEach(storageKey => {
            const key = STORAGE_KEYS[storageKey];
            localStorage.remove(key);
        });
    }

    // Extracts legacy shortcuts from old settings format for migration to vault profiles
    private extractLegacyShortcuts(storedData: Record<string, unknown> | null): ShortcutEntry[] | null {
        if (!storedData) {
            return null;
        }

        const raw = storedData['shortcuts'];
        if (!Array.isArray(raw)) {
            return null;
        }

        const entries: ShortcutEntry[] = [];
        raw.forEach(value => {
            if (!value || typeof value !== 'object') {
                return;
            }
            const typed = value as ShortcutEntry;
            const shortcutType = (typed as { type?: unknown }).type;
            // Validates that shortcut type is one of the recognized types
            if (
                shortcutType !== ShortcutType.FOLDER &&
                shortcutType !== ShortcutType.NOTE &&
                shortcutType !== ShortcutType.TAG &&
                shortcutType !== ShortcutType.SEARCH
            ) {
                return;
            }
            entries.push({ ...typed });
        });

        if (entries.length === 0) {
            return [];
        }

        return entries;
    }

    // Migrates legacy shortcuts to vault profile system
    private applyLegacyShortcutsMigration(legacyShortcuts: ShortcutEntry[] | null): void {
        // Removes legacy shortcuts property from settings object
        const settingsRecord = this.settings as unknown as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(settingsRecord, 'shortcuts')) {
            delete settingsRecord['shortcuts'];
        }

        if (!legacyShortcuts || legacyShortcuts.length === 0) {
            return;
        }

        // Copies legacy shortcuts to all vault profiles that don't have shortcuts yet
        const template = cloneShortcuts(legacyShortcuts);
        this.settings.vaultProfiles.forEach(profile => {
            if (Array.isArray(profile.shortcuts) && profile.shortcuts.length > 0) {
                return;
            }
            profile.shortcuts = cloneShortcuts(template);
        });
    }

    // Rebuilds all settings records with null prototypes to prevent prototype pollution attacks
    private sanitizeSettingsRecords(): void {
        // Type-specific sanitizers that validate values match expected types
        const sanitizeStringMap = (record?: Record<string, string>): Record<string, string> => sanitizeRecord(record, isStringRecordValue);
        const sanitizeSortMap = (record?: Record<string, SortOption>): Record<string, SortOption> => sanitizeRecord(record, isSortOption);
        const isAppearanceValue = (value: unknown): value is FolderAppearance => isPlainObjectRecordValue(value);
        const sanitizeAppearanceMap = (record?: Record<string, FolderAppearance>): Record<string, FolderAppearance> =>
            sanitizeRecord(record, isAppearanceValue);
        const sanitizeBooleanMap = (record?: Record<string, boolean>): Record<string, boolean> =>
            sanitizeRecord(record, isBooleanRecordValue);

        // Rebuild maps with null prototypes so keys like "constructor" never resolve to Object.prototype
        this.settings.folderColors = sanitizeStringMap(this.settings.folderColors);
        this.settings.folderBackgroundColors = sanitizeStringMap(this.settings.folderBackgroundColors);
        this.settings.fileColors = sanitizeStringMap(this.settings.fileColors);
        this.settings.tagColors = sanitizeStringMap(this.settings.tagColors);
        this.settings.tagBackgroundColors = sanitizeStringMap(this.settings.tagBackgroundColors);
        this.settings.folderSortOverrides = sanitizeSortMap(this.settings.folderSortOverrides);
        this.settings.tagSortOverrides = sanitizeSortMap(this.settings.tagSortOverrides);
        this.settings.folderAppearances = sanitizeAppearanceMap(this.settings.folderAppearances);
        this.settings.tagAppearances = sanitizeAppearanceMap(this.settings.tagAppearances);
        this.settings.navigationSeparators = sanitizeBooleanMap(this.settings.navigationSeparators);
        this.settings.externalIconProviders = sanitizeBooleanMap(this.settings.externalIconProviders);
    }

    private normalizeIconSettings(settings: NotebookNavigatorSettings): void {
        const normalizeRecord = (record?: Record<string, string>): Record<string, string> => {
            const sanitized = sanitizeRecord(record, isStringRecordValue);
            Object.keys(sanitized).forEach(key => {
                const canonical = normalizeCanonicalIconId(sanitized[key]);
                if (!canonical) {
                    delete sanitized[key];
                    return;
                }
                sanitized[key] = canonical;
            });
            return sanitized;
        };

        settings.folderIcons = normalizeRecord(settings.folderIcons);
        settings.tagIcons = normalizeRecord(settings.tagIcons);
        settings.fileIcons = normalizeRecord(settings.fileIcons);
    }

    // Extracts legacy exclusion settings from old format and prepares them for migration to vault profiles
    private extractLegacyVisibilitySettings(storedData: Record<string, unknown> | null): LegacyVisibilityMigration {
        // Converts unknown value to a deduplicated list of non-empty strings
        const toUniqueStringList = (value: unknown): string[] => {
            if (!Array.isArray(value)) {
                return [];
            }
            const sanitized = value.map(entry => (typeof entry === 'string' ? entry.trim() : '')).filter(entry => entry.length > 0);
            return Array.from(new Set(sanitized));
        };

        const mutableSettings = this.settings as unknown as Record<string, unknown>;
        const legacyHiddenFolders = toUniqueStringList(mutableSettings['excludedFolders']);
        const legacyHiddenFiles = toUniqueStringList(mutableSettings['excludedFiles']);
        delete mutableSettings['excludedFolders'];
        delete mutableSettings['excludedFiles'];

        const storedHiddenTags = toUniqueStringList(storedData?.['hiddenTags']);
        if (storedHiddenTags.length > 0) {
            this.settings.hiddenTags = [...storedHiddenTags];
        }

        const rawNavigationBanner = mutableSettings['navigationBanner'];
        const legacyNavigationBanner = typeof rawNavigationBanner === 'string' ? rawNavigationBanner : null;
        const storedNavigationBannerPath = storedData?.['navigationBannerPath'];
        const legacyBannerPath = typeof storedNavigationBannerPath === 'string' ? storedNavigationBannerPath : null;
        const navigationBanner =
            legacyNavigationBanner && legacyNavigationBanner.length > 0
                ? legacyNavigationBanner
                : legacyBannerPath && legacyBannerPath.length > 0
                  ? legacyBannerPath
                  : null;

        delete mutableSettings['navigationBanner'];
        delete mutableSettings['navigationBannerPath'];

        return {
            hiddenFolders: legacyHiddenFolders,
            hiddenFiles: legacyHiddenFiles,
            hiddenTags: storedHiddenTags,
            navigationBanner,
            shouldApplyToProfiles: !Array.isArray(storedData?.['vaultProfiles'])
        };
    }

    // Applies legacy hidden folder, file, and tag settings to the active vault profile
    private applyLegacyVisibilityMigration(migration: LegacyVisibilityMigration): void {
        const hasNavigationBanner = typeof migration.navigationBanner === 'string' && migration.navigationBanner.length > 0;

        if (
            !migration.shouldApplyToProfiles ||
            (!hasNavigationBanner &&
                migration.hiddenFolders.length === 0 &&
                migration.hiddenFiles.length === 0 &&
                migration.hiddenTags.length === 0)
        ) {
            return;
        }

        const targetProfile =
            this.settings.vaultProfiles.find(profile => profile.id === this.settings.vaultProfile) ??
            this.settings.vaultProfiles.find(profile => profile.id === DEFAULT_VAULT_PROFILE_ID) ??
            this.settings.vaultProfiles[0];

        if (!targetProfile) {
            return;
        }

        if (migration.hiddenFolders.length > 0) {
            targetProfile.hiddenFolders = [...migration.hiddenFolders];
        }

        if (migration.hiddenFiles.length > 0) {
            targetProfile.hiddenFiles = [...migration.hiddenFiles];
        }

        if (migration.hiddenTags.length > 0) {
            targetProfile.hiddenTags = [...migration.hiddenTags];
            this.settings.hiddenTags = [...migration.hiddenTags];
        }

        if (hasNavigationBanner) {
            targetProfile.navigationBanner = migration.navigationBanner;
        }
    }

    /**
     * Normalizes tag-related settings to use lowercase keys
     * Ensures consistency regardless of manual edits or external changes
     * Preserves values while standardizing keys to lowercase
     */
    private normalizeTagSettings() {
        const normalizeRecord = <T>(record: Record<string, T> | undefined): Record<string, T> => {
            if (!record) return Object.create(null) as Record<string, T>;

            const normalized = Object.create(null) as Record<string, T>;
            // Remove inherited properties before normalizing to lowercase
            const sanitized = sanitizeRecord(record);
            for (const [key, value] of Object.entries(sanitized)) {
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

        if (this.settings.tagBackgroundColors) {
            this.settings.tagBackgroundColors = normalizeRecord(this.settings.tagBackgroundColors);
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

        if (this.settings.hiddenTags) {
            this.settings.hiddenTags = normalizeArray(this.settings.hiddenTags);
        }
    }

    /**
     * Saves current plugin settings to Obsidian's data storage and notifies listeners
     * Persists user preferences between sessions and triggers UI updates
     * Called whenever settings are modified
     */
    async saveSettingsAndUpdate() {
        ensureVaultProfiles(this.settings);
        syncVaultProfileFromSettings(this.settings);
        await this.saveData(this.settings);
        // Notify all listeners that settings have been updated
        this.onSettingsUpdate();
    }

    /**
     * Notifies all registered listeners that settings have changed
     */
    public notifySettingsUpdate(): void {
        this.onSettingsUpdate();
    }

    /**
     * Removes unused metadata entries from settings and saves
     */
    public async runMetadataCleanup(): Promise<boolean> {
        if (!this.metadataService || this.isUnloading) {
            return false;
        }

        const changesMade = await this.metadataService.cleanupAllMetadata();
        if (changesMade) {
            await this.saveSettingsAndUpdate();
        }

        return changesMade;
    }

    /**
     * Returns a summary of how many unused metadata entries exist
     */
    public async getMetadataCleanupSummary(): Promise<MetadataCleanupSummary> {
        if (!this.metadataService || this.isUnloading) {
            return { folders: 0, tags: 0, files: 0, pinnedNotes: 0, separators: 0, total: 0 };
        }

        return this.metadataService.getCleanupSummary();
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
     * Notifies all registered listeners about recent data changes
     */
    private notifyRecentDataUpdate(): void {
        if (this.isUnloading) {
            return;
        }

        // Call each registered listener callback
        const listeners = Array.from(this.recentDataListeners.values());
        listeners.forEach(callback => {
            try {
                callback();
            } catch {
                // Silently ignore errors from recent data callbacks
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
        return this.workspaceCoordinator?.activateNavigatorView() ?? null;
    }

    /**
     * Gets all workspace leaves containing the navigator view
     */
    public getNavigatorLeaves(): WorkspaceLeaf[] {
        return this.workspaceCoordinator?.getNavigatorLeaves() ?? this.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
    }

    /**
     * Opens the navigator view, focuses the navigation pane, and selects the given folder
     * @param folder - Folder instance to highlight
     */
    async navigateToFolder(folder: TFolder, options?: NavigateToFolderOptions): Promise<void> {
        await this.activateView();

        const navigatorLeaves = this.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
        if (navigatorLeaves.length === 0) {
            return;
        }

        const leaf = navigatorLeaves[0];
        const view = leaf.view;
        if (view instanceof NotebookNavigatorView) {
            view.navigateToFolder(folder, options);
        }
    }

    /**
     * Navigates to a specific file in the navigator
     * Expands parent folders and scrolls to make the file visible
     * Note: This does NOT activate/show the view - callers must do that if needed
     * @param file - The file to navigate to in the navigator
     */
    async revealFileInActualFolder(file: TFile, options?: RevealFileOptions) {
        this.workspaceCoordinator?.revealFileInActualFolder(file, options);
    }

    /**
     * Reveals a file while preserving the nearest visible folder/tag context
     * @param file - File to surface in the navigator
     * @param options - Reveal behavior options
     */
    async revealFileInNearestFolder(file: TFile, options?: RevealFileOptions) {
        this.workspaceCoordinator?.revealFileInNearestFolder(file, options);
    }

    public resolveHomepageFile(): TFile | null {
        return this.homepageController?.resolveHomepageFile() ?? null;
    }

    public async openHomepage(trigger: 'startup' | 'command'): Promise<boolean> {
        return this.homepageController?.open(trigger) ?? false;
    }

    public async cmdJumpTop(): Promise<void> {
        const view = await this.getActivatedView()

        view.paneJumpTop()
    }

    public async cmdJumpBottom(): Promise<void> {
        const view = await this.getActivatedView()

        view.paneJumpBottom()
    }

    /**
     * Checks for new GitHub releases and updates the pending notice if a newer version is found.
     * @param force - If true, bypasses the minimum check interval
     */
    public async runReleaseUpdateCheck(force = false): Promise<void> {
        await this.evaluateReleaseUpdates(force);
    }

    /**
     * Clears the pending update notice without marking it as displayed.
     */
    public dismissPendingUpdateNotice(): void {
        this.setPendingUpdateNotice(null);
    }

    private async getActivatedView(): Promise<NotebookNavigatorView> {
        if (this.isUnloading) {
            throw new Error('Plugin is unloading');
        }

        await this.activateView();

        // Find the Navigator view leaf in the workspace
        const leaf = this.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW)[0];

        if (!leaf) {
            throw new Error('Notebook Navigator view not available');
        }

        const { view } = leaf;

        if (!(view instanceof NotebookNavigatorView)) {
            throw new Error('Notebook Navigator view not found');
        }

        return view
    }


    /**
     * Performs the actual release check and updates the pending notice.
     */
    private async evaluateReleaseUpdates(force = false): Promise<void> {
        if (!this.releaseCheckService || this.isUnloading) {
            return;
        }

        if (!this.settings.checkForUpdatesOnStart && !force) {
            return;
        }

        try {
            const notice = await this.releaseCheckService.checkForUpdates(force);
            this.setPendingUpdateNotice(notice ?? null);
        } catch {
            // Ignore release check failures silently
        }
    }

    /**
     * Updates the pending notice and notifies all listeners.
     * Skips notification if the notice hasn't actually changed.
     */
    private setPendingUpdateNotice(notice: ReleaseUpdateNotice | null): void {
        const currentVersion = this.pendingUpdateNotice?.version ?? null;
        const incomingVersion = notice?.version ?? null;
        const hasNotice = !!notice;
        const hadNotice = !!this.pendingUpdateNotice;

        // Skip if notice hasn't changed
        if (currentVersion === incomingVersion && hasNotice === hadNotice) {
            return;
        }

        this.pendingUpdateNotice = notice;

        if (!notice) {
            this.releaseCheckService?.clearPendingNotice();
        }

        this.notifyUpdateNoticeListeners();
    }

    /**
     * Notifies all registered listeners about the current update notice state.
     */
    private notifyUpdateNoticeListeners(): void {
        if (this.isUnloading) {
            return;
        }

        const listeners = Array.from(this.updateNoticeListeners.values());
        listeners.forEach(callback => {
            try {
                callback(this.pendingUpdateNotice);
            } catch {
                // Ignore listener errors to avoid breaking notification flow
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
            return;
        }

        // Check if version has changed
        if (lastShownVersion !== currentVersion) {
            // Import release notes helpers dynamically
            const { getReleaseNotesBetweenVersions, getLatestReleaseNotes, compareVersions, isReleaseAutoDisplayEnabled } = await import(
                './releaseNotes'
            );

            if (!isReleaseAutoDisplayEnabled(currentVersion)) {
                return;
            }

            const { WhatsNewModal } = await import('./modals/WhatsNewModal');

            // Get release notes between versions
            let releaseNotes;
            if (compareVersions(currentVersion, lastShownVersion) > 0) {
                // Show notes from last shown to current
                releaseNotes = getReleaseNotesBetweenVersions(lastShownVersion, currentVersion);
            } else {
                // Downgraded or same version - just show latest 5 releases
                releaseNotes = getLatestReleaseNotes();
            }

            // Show the info modal when version changes
            new WhatsNewModal(this.app, releaseNotes, this.settings.dateFormat, () => {
                // Save version after 1 second delay when user closes the modal
                setTimeout(() => {
                    // Wrap in runAsyncAction to handle async without blocking callback
                    runAsyncAction(async () => {
                        this.settings.lastShownVersion = currentVersion;
                        await this.saveSettingsAndUpdate();
                    });
                }, 1000);
            }).open();
        }
    }
}
