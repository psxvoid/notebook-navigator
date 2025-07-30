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

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import NotebookNavigatorPlugin from './main';
import { strings } from './i18n';
import { FileVisibility, FILE_VISIBILITY } from './utils/fileTypeUtils';
import { calculateCacheStatistics, CacheStatistics } from './storage/statistics';
import { ISO_DATE_FORMAT } from './utils/dateUtils';

/**
 * Available sort options for file listing
 */
export type SortOption =
    | 'modified-desc' // Date edited (newest first)
    | 'modified-asc' // Date edited (oldest first)
    | 'created-desc' // Date created (newest first)
    | 'created-asc' // Date created (oldest first)
    | 'title-asc' // Title (A first)
    | 'title-desc'; // Title (Z first)

/**
 * Collapse button behavior options
 */
export type CollapseButtonBehavior =
    | 'all' // Collapse/expand both folders and tags
    | 'folders-only' // Collapse/expand only folders
    | 'tags-only'; // Collapse/expand only tags

/**
 * Plugin settings interface defining all configurable options
 * These settings control the appearance and behavior of the navigator
 */
export interface NotebookNavigatorSettings {
    // Top level settings (no category)
    dualPane: boolean;
    autoRevealActiveFile: boolean;
    showTooltips: boolean;
    fileVisibility: FileVisibility;
    excludedFolders: string[];
    excludedFiles: string[];
    // Navigation pane
    autoSelectFirstFileOnFocusChange: boolean;
    autoExpandFoldersTags: boolean;
    showNoteCount: boolean;
    showIcons: boolean;
    collapseButtonBehavior: CollapseButtonBehavior;
    // Folders
    showRootFolder: boolean;
    enableFolderNotes: boolean;
    folderNoteName: string;
    hideFolderNoteInList: boolean;
    // Tags
    showTags: boolean;
    showTagsAboveFolders: boolean;
    showFavoriteTagsFolder: boolean;
    showAllTagsFolder: boolean;
    showUntagged: boolean;
    showUntaggedInFavorites: boolean;
    favoriteTags: string[];
    hiddenTags: string[];
    // List pane
    defaultFolderSort: SortOption;
    groupByDate: boolean;
    showNotesFromSubfolders: boolean;
    showParentFolderNames: boolean;
    dateFormat: string;
    timeFormat: string;
    // Notes
    useFrontmatterMetadata: boolean;
    frontmatterNameField: string;
    frontmatterCreatedField: string;
    frontmatterModifiedField: string;
    frontmatterDateFormat: string;
    fileNameRows: number;
    showFileDate: boolean;
    showFileTags: boolean;
    showFilePreview: boolean;
    skipHeadingsInPreview: boolean;
    previewProperties: string[];
    previewRows: number;
    showFeatureImage: boolean;
    featureImageProperties: string[];
    // Advanced
    confirmBeforeDelete: boolean;
    // Internal
    pinnedNotes: Record<string, string[]>;
    folderIcons: Record<string, string>;
    folderColors: Record<string, string>;
    folderSortOverrides: Record<string, SortOption>;
    tagIcons: Record<string, string>;
    tagColors: Record<string, string>;
    tagSortOverrides: Record<string, SortOption>;
    recentlyUsedIcons: string[];
    lastShownVersion: string;
}

/**
 * Default settings for the plugin
 * Used when plugin is first installed or settings are reset
 */
export const DEFAULT_SETTINGS: NotebookNavigatorSettings = {
    // Top level settings (no category)
    dualPane: true,
    autoRevealActiveFile: true,
    showTooltips: true,
    fileVisibility: FILE_VISIBILITY.SUPPORTED,
    excludedFolders: [],
    excludedFiles: [],
    // Navigation pane
    autoSelectFirstFileOnFocusChange: true,
    autoExpandFoldersTags: false,
    showNoteCount: true,
    showIcons: true,
    collapseButtonBehavior: 'all',
    // Folders
    showRootFolder: true,
    enableFolderNotes: false,
    folderNoteName: '',
    hideFolderNoteInList: true,
    // Tags
    showTags: true,
    showTagsAboveFolders: false,
    showFavoriteTagsFolder: true,
    showAllTagsFolder: true,
    showUntagged: false,
    showUntaggedInFavorites: false,
    favoriteTags: [],
    hiddenTags: [],
    // List pane
    defaultFolderSort: 'modified-desc',
    groupByDate: true,
    showNotesFromSubfolders: true,
    showParentFolderNames: true,
    dateFormat: 'MMM d, yyyy',
    timeFormat: 'h:mm a',
    // Notes
    useFrontmatterMetadata: false,
    frontmatterNameField: '',
    frontmatterCreatedField: '',
    frontmatterModifiedField: '',
    frontmatterDateFormat: '',
    fileNameRows: 1,
    showFileDate: true,
    showFileTags: true,
    showFilePreview: true,
    skipHeadingsInPreview: false,
    previewProperties: [],
    previewRows: 2,
    showFeatureImage: true,
    featureImageProperties: ['featureResized', 'feature'],
    // Advanced
    confirmBeforeDelete: true,
    // Internal
    pinnedNotes: {},
    folderIcons: {},
    folderColors: {},
    folderSortOverrides: {},
    tagIcons: {},
    tagColors: {},
    tagSortOverrides: {},
    recentlyUsedIcons: [],
    lastShownVersion: ''
};

/**
 * Settings tab for configuring the Notebook Navigator plugin
 * Provides organized sections for different aspects of the plugin
 * Implements debounced text inputs to prevent excessive updates
 */
export class NotebookNavigatorSettingTab extends PluginSettingTab {
    plugin: NotebookNavigatorPlugin;
    // Map of active debounce timers for text inputs
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    // Reference to stats element and update interval
    private statsTextEl: HTMLElement | null = null;
    private statsUpdateInterval: number | null = null;
    // Reference to metadata parsing info element
    private metadataInfoEl: HTMLElement | null = null;

    /**
     * Creates a new settings tab
     * @param app - The Obsidian app instance
     * @param plugin - The plugin instance to configure
     */
    constructor(app: App, plugin: NotebookNavigatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Creates a text setting with debounced onChange handler
     * Prevents excessive updates while user is typing
     * Supports optional validation before applying changes
     * @param container - Container element for the setting
     * @param name - Setting display name
     * @param desc - Setting description
     * @param placeholder - Placeholder text for the input
     * @param getValue - Function to get current value
     * @param setValue - Function to set new value
     * @param refreshView - Whether to refresh the navigator view on change
     * @param validator - Optional validation function
     * @returns The created Setting instance
     */
    private createDebouncedTextSetting(
        container: HTMLElement,
        name: string,
        desc: string,
        placeholder: string,
        getValue: () => string,
        setValue: (value: string) => void,
        _refreshView: boolean = true,
        validator?: (value: string) => boolean
    ): Setting {
        return new Setting(container)
            .setName(name)
            .setDesc(desc)
            .addText(text =>
                text
                    .setPlaceholder(placeholder)
                    .setValue(getValue())
                    .onChange(async value => {
                        // Clear existing timer for this setting
                        const timerId = `setting-${name}`;
                        const existingTimer = this.debounceTimers.get(timerId);
                        if (existingTimer !== undefined) {
                            clearTimeout(existingTimer);
                        }

                        // Set new timer
                        const timer = setTimeout(async () => {
                            // Validate if validator provided
                            if (!validator || validator(value)) {
                                setValue(value);
                                await this.plugin.saveSettings();

                                // Add this line to trigger the refresh:
                                this.plugin.onSettingsUpdate();
                            }

                            this.debounceTimers.delete(timerId);
                        }, 1000);

                        this.debounceTimers.set(timerId, timer);
                    })
            );
    }

    /**
     * Helper to save settings
     * Settings changes are automatically propagated through context providers
     */
    private async saveAndRefresh(): Promise<void> {
        await this.plugin.saveSettings();
        // Now, explicitly tell the plugin UI to update itself.
        this.plugin.onSettingsUpdate();
    }

    /**
     * Generate statistics text from cache stats
     */
    private generateStatisticsText(stats: CacheStatistics): string {
        if (!stats) return '';

        const sizeText = `${stats.totalSizeMB.toFixed(1)} MB`;

        return `${strings.settings.items.cacheStatistics.localCache}: ${stats.totalItems} ${strings.settings.items.cacheStatistics.items}. ${stats.itemsWithTags} ${strings.settings.items.cacheStatistics.withTags}, ${stats.itemsWithPreview} ${strings.settings.items.cacheStatistics.withPreviewText}, ${stats.itemsWithFeature} ${strings.settings.items.cacheStatistics.withFeatureImage}, ${stats.itemsWithMetadata} ${strings.settings.items.cacheStatistics.withMetadata}. ${sizeText}`;
    }

    /**
     * Generate metadata parsing info text
     */
    private generateMetadataInfoText(stats: CacheStatistics): {
        infoText: string;
        failedText: string | null;
        hasFailures: boolean;
        failurePercentage: number;
    } {
        if (!stats) return { infoText: '', failedText: null, hasFailures: false, failurePercentage: 0 };

        const nameCount = stats.itemsWithMetadataName || 0;
        const createdCount = stats.itemsWithMetadataCreated || 0;
        const modifiedCount = stats.itemsWithMetadataModified || 0;
        const failedCreatedCount = stats.itemsWithFailedCreatedParse || 0;
        const failedModifiedCount = stats.itemsWithFailedModifiedParse || 0;

        const infoText = `${strings.settings.items.metadataInfo.successfullyParsed}: ${nameCount} ${strings.settings.items.metadataInfo.itemsWithName}, ${createdCount} ${strings.settings.items.metadataInfo.withCreatedDate}, ${modifiedCount} ${strings.settings.items.metadataInfo.withModifiedDate}.`;

        // Calculate failure percentage
        const totalCreatedAttempts = createdCount + failedCreatedCount;
        const totalModifiedAttempts = modifiedCount + failedModifiedCount;
        const totalAttempts = totalCreatedAttempts + totalModifiedAttempts;
        const totalFailures = failedCreatedCount + failedModifiedCount;
        const failurePercentage = totalAttempts > 0 ? (totalFailures / totalAttempts) * 100 : 0;

        // Show failed parse counts if any
        let failedText = null;
        if (failedCreatedCount > 0 || failedModifiedCount > 0) {
            failedText = `${strings.settings.items.metadataInfo.failedToParse}: ${failedCreatedCount} ${strings.settings.items.metadataInfo.createdDates}, ${failedModifiedCount} ${strings.settings.items.metadataInfo.modifiedDates}.`;
            // Only add suggestion if more than 70% failed
            if (failurePercentage > 70) {
                failedText += ' ' + strings.settings.items.metadataInfo.checkTimestampFormat;
            }
        }

        return { infoText, failedText, hasFailures: failedCreatedCount > 0 || failedModifiedCount > 0, failurePercentage };
    }

    /**
     * Update the statistics display
     */
    private updateStatistics(): void {
        const stats = calculateCacheStatistics();
        if (!stats) return;

        // Update bottom statistics
        if (this.statsTextEl) {
            this.statsTextEl.setText(this.generateStatisticsText(stats));
        }

        // Update metadata parsing info
        if (this.metadataInfoEl && this.plugin.settings.useFrontmatterMetadata) {
            const { infoText, failedText, hasFailures, failurePercentage } = this.generateMetadataInfoText(stats);

            // Clear previous content
            this.metadataInfoEl.empty();

            // Create a flex container for the entire metadata info
            const metadataContainer = this.metadataInfoEl.createEl('div', {
                cls: 'nn-metadata-info-row'
            });

            // Left side: text content
            const textContainer = metadataContainer.createEl('div', {
                cls: 'nn-metadata-info-text'
            });

            // Add info text
            textContainer.createSpan({ text: infoText });

            if (failedText) {
                // Add line break and failed parse message
                textContainer.createEl('br');
                // Only apply error styling if failure percentage > 70%
                const shouldHighlight = failurePercentage > 70;
                textContainer.createSpan({
                    text: failedText,
                    cls: shouldHighlight ? 'nn-metadata-error-text' : undefined
                });
            }

            // Right side: export button (only if there are failures)
            if (hasFailures) {
                const exportButton = metadataContainer.createEl('button', {
                    text: strings.settings.items.metadataInfo.exportFailed,
                    cls: 'nn-metadata-export-button'
                });
                exportButton.onclick = () => this.exportFailedMetadataReport(stats);
            }
        }
    }

    /**
     * Renders the settings tab UI
     * Organizes settings into logical sections:
     * - Top level (no header)
     * - Navigation pane
     * - Folders
     * - Tags
     * - File list
     * - Notes
     * - Advanced
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Top level settings (no category header)

        new Setting(containerEl)
            .setName(strings.settings.items.dualPane.name)
            .setDesc(strings.settings.items.dualPane.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.dualPane).onChange(async value => {
                    this.plugin.settings.dualPane = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.autoRevealActiveNote.name)
            .setDesc(strings.settings.items.autoRevealActiveNote.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.autoRevealActiveFile).onChange(async value => {
                    this.plugin.settings.autoRevealActiveFile = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showTooltips.name)
            .setDesc(strings.settings.items.showTooltips.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showTooltips).onChange(async value => {
                    this.plugin.settings.showTooltips = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.fileVisibility.name)
            .setDesc(strings.settings.items.fileVisibility.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption(FILE_VISIBILITY.MARKDOWN, strings.settings.items.fileVisibility.options.markdownOnly)
                    .addOption(FILE_VISIBILITY.SUPPORTED, strings.settings.items.fileVisibility.options.supported)
                    .addOption(FILE_VISIBILITY.ALL, strings.settings.items.fileVisibility.options.all)
                    .setValue(this.plugin.settings.fileVisibility)
                    .onChange(async (value: FileVisibility) => {
                        this.plugin.settings.fileVisibility = value;
                        await this.saveAndRefresh();
                    })
            );

        const excludedFoldersSetting = this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.excludedFolders.name,
            strings.settings.items.excludedFolders.desc,
            strings.settings.items.excludedFolders.placeholder,
            () => this.plugin.settings.excludedFolders.join(', '),
            value => {
                this.plugin.settings.excludedFolders = value
                    .split(',')
                    .map(folder => folder.trim())
                    .filter(folder => folder.length > 0);
            }
        );
        excludedFoldersSetting.controlEl.addClass('nn-setting-wide-input');

        const excludedFilesSetting = this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.excludedNotes.name,
            strings.settings.items.excludedNotes.desc,
            strings.settings.items.excludedNotes.placeholder,
            () => this.plugin.settings.excludedFiles.join(', '),
            value => {
                this.plugin.settings.excludedFiles = value
                    .split(',')
                    .map(file => file.trim())
                    .filter(file => file.length > 0);
            }
        );
        excludedFilesSetting.controlEl.addClass('nn-setting-wide-input');

        // Section 1: Navigation pane
        new Setting(containerEl).setName(strings.settings.sections.navigationPane).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.autoSelectFirstFileOnFocusChange.name)
            .setDesc(strings.settings.items.autoSelectFirstFileOnFocusChange.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.autoSelectFirstFileOnFocusChange).onChange(async value => {
                    this.plugin.settings.autoSelectFirstFileOnFocusChange = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.autoExpandFoldersTags.name)
            .setDesc(strings.settings.items.autoExpandFoldersTags.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.autoExpandFoldersTags).onChange(async value => {
                    this.plugin.settings.autoExpandFoldersTags = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showNoteCount.name)
            .setDesc(strings.settings.items.showNoteCount.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showNoteCount).onChange(async value => {
                    this.plugin.settings.showNoteCount = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showIcons.name)
            .setDesc(strings.settings.items.showIcons.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showIcons).onChange(async value => {
                    this.plugin.settings.showIcons = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.collapseButtonBehavior.name)
            .setDesc(strings.settings.items.collapseButtonBehavior.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('all', strings.settings.items.collapseButtonBehavior.options.all)
                    .addOption('folders-only', strings.settings.items.collapseButtonBehavior.options.foldersOnly)
                    .addOption('tags-only', strings.settings.items.collapseButtonBehavior.options.tagsOnly)
                    .setValue(this.plugin.settings.collapseButtonBehavior)
                    .onChange(async (value: CollapseButtonBehavior) => {
                        this.plugin.settings.collapseButtonBehavior = value;
                        await this.saveAndRefresh();
                    })
            );

        // Section 2: Folders
        new Setting(containerEl).setName(strings.settings.sections.folders).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.showRootFolder.name)
            .setDesc(strings.settings.items.showRootFolder.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showRootFolder).onChange(async value => {
                    this.plugin.settings.showRootFolder = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.enableFolderNotes.name)
            .setDesc(strings.settings.items.enableFolderNotes.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.enableFolderNotes).onChange(async value => {
                    this.plugin.settings.enableFolderNotes = value;
                    await this.saveAndRefresh();
                    // Update folder notes sub-settings visibility
                    folderNotesSettingsEl.toggle(value);
                })
            );

        // Container for folder notes sub-settings
        const folderNotesSettingsEl = containerEl.createDiv('nn-sub-settings');

        this.createDebouncedTextSetting(
            folderNotesSettingsEl,
            strings.settings.items.folderNoteName.name,
            strings.settings.items.folderNoteName.desc,
            strings.settings.items.folderNoteName.placeholder,
            () => this.plugin.settings.folderNoteName,
            value => {
                this.plugin.settings.folderNoteName = value;
            }
        );

        new Setting(folderNotesSettingsEl)
            .setName(strings.settings.items.hideFolderNoteInList.name)
            .setDesc(strings.settings.items.hideFolderNoteInList.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.hideFolderNoteInList).onChange(async value => {
                    this.plugin.settings.hideFolderNoteInList = value;
                    await this.saveAndRefresh();
                })
            );

        // Store reference to showFileTagsSetting for later use (defined here to be available in Tags section)
        let showFileTagsSetting: Setting | null = null;

        // Section 3: Tags
        new Setting(containerEl).setName(strings.settings.sections.tags).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.showTags.name)
            .setDesc(strings.settings.items.showTags.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showTags).onChange(async value => {
                    this.plugin.settings.showTags = value;
                    await this.saveAndRefresh();
                    // Update tag sub-settings visibility
                    tagSubSettingsEl.toggle(value);
                    // Update visibility of "Show tags" setting in Notes section
                    if (showFileTagsSetting) {
                        showFileTagsSetting.settingEl.toggle(value);
                    }
                })
            );

        // Container for tag sub-settings
        const tagSubSettingsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(tagSubSettingsEl)
            .setName(strings.settings.items.showTagsAboveFolders.name)
            .setDesc(strings.settings.items.showTagsAboveFolders.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showTagsAboveFolders).onChange(async value => {
                    this.plugin.settings.showTagsAboveFolders = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(tagSubSettingsEl)
            .setName(strings.settings.items.showFavoriteTagsFolder.name)
            .setDesc(strings.settings.items.showFavoriteTagsFolder.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFavoriteTagsFolder).onChange(async value => {
                    this.plugin.settings.showFavoriteTagsFolder = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(tagSubSettingsEl)
            .setName(strings.settings.items.showAllTagsFolder.name)
            .setDesc(strings.settings.items.showAllTagsFolder.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showAllTagsFolder).onChange(async value => {
                    this.plugin.settings.showAllTagsFolder = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(tagSubSettingsEl)
            .setName(strings.settings.items.showUntagged.name)
            .setDesc(strings.settings.items.showUntagged.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showUntagged).onChange(async value => {
                    this.plugin.settings.showUntagged = value;
                    untaggedInFavoritesEl.style.display = value ? 'block' : 'none';
                    await this.saveAndRefresh();
                })
            );

        // Sub-setting for untagged in favorites - only show if showUntagged is enabled
        const untaggedInFavoritesEl = tagSubSettingsEl.createDiv();
        untaggedInFavoritesEl.style.display = this.plugin.settings.showUntagged ? 'block' : 'none';
        untaggedInFavoritesEl.style.marginLeft = '20px';

        new Setting(untaggedInFavoritesEl)
            .setName(strings.settings.items.showUntaggedInFavorites.name)
            .setDesc(strings.settings.items.showUntaggedInFavorites.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showUntaggedInFavorites).onChange(async value => {
                    this.plugin.settings.showUntaggedInFavorites = value;
                    await this.saveAndRefresh();
                })
            );

        const favoriteTagsSetting = this.createDebouncedTextSetting(
            tagSubSettingsEl,
            strings.settings.items.favoriteTags.name,
            strings.settings.items.favoriteTags.desc,
            strings.settings.items.favoriteTags.placeholder,
            () => this.plugin.settings.favoriteTags.join(', '),
            value => {
                this.plugin.settings.favoriteTags = value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);
            }
        );

        // Add a custom class to make the input wider
        favoriteTagsSetting.controlEl.addClass('nn-setting-wide-input');

        const hiddenTagsSetting = this.createDebouncedTextSetting(
            tagSubSettingsEl,
            strings.settings.items.hiddenTags.name,
            strings.settings.items.hiddenTags.desc,
            strings.settings.items.hiddenTags.placeholder,
            () => this.plugin.settings.hiddenTags.join(', '),
            value => {
                this.plugin.settings.hiddenTags = value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);
            }
        );

        // Add a custom class to make the input wider
        hiddenTagsSetting.controlEl.addClass('nn-setting-wide-input');

        // Section 4: List pane
        new Setting(containerEl).setName(strings.settings.sections.listPane).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.sortNotesBy.name)
            .setDesc(strings.settings.items.sortNotesBy.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('modified-desc', strings.settings.items.sortNotesBy.options['modified-desc'])
                    .addOption('modified-asc', strings.settings.items.sortNotesBy.options['modified-asc'])
                    .addOption('created-desc', strings.settings.items.sortNotesBy.options['created-desc'])
                    .addOption('created-asc', strings.settings.items.sortNotesBy.options['created-asc'])
                    .addOption('title-asc', strings.settings.items.sortNotesBy.options['title-asc'])
                    .addOption('title-desc', strings.settings.items.sortNotesBy.options['title-desc'])
                    .setValue(this.plugin.settings.defaultFolderSort)
                    .onChange(async (value: SortOption) => {
                        this.plugin.settings.defaultFolderSort = value;
                        await this.saveAndRefresh();
                    })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.groupByDate.name)
            .setDesc(strings.settings.items.groupByDate.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.groupByDate).onChange(async value => {
                    this.plugin.settings.groupByDate = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showNotesFromSubfolders.name)
            .setDesc(strings.settings.items.showNotesFromSubfolders.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showNotesFromSubfolders).onChange(async value => {
                    this.plugin.settings.showNotesFromSubfolders = value;
                    await this.saveAndRefresh();
                    // Update subfolder names visibility
                    subfolderNamesEl.toggle(value);
                })
            );

        // Container for conditional subfolder names setting
        const subfolderNamesEl = containerEl.createDiv('nn-sub-settings');

        new Setting(subfolderNamesEl)
            .setName(strings.settings.items.showParentFolderNames.name)
            .setDesc(strings.settings.items.showParentFolderNames.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showParentFolderNames).onChange(async value => {
                    this.plugin.settings.showParentFolderNames = value;
                    await this.saveAndRefresh();
                })
            );

        // Set initial visibility
        subfolderNamesEl.toggle(this.plugin.settings.showNotesFromSubfolders);

        this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.dateFormat.name,
            strings.settings.items.dateFormat.desc,
            strings.settings.items.dateFormat.placeholder,
            () => this.plugin.settings.dateFormat,
            value => {
                this.plugin.settings.dateFormat = value || 'MMM d, yyyy';
            }
        ).addExtraButton(button =>
            button
                .setIcon('help')
                .setTooltip(strings.settings.items.dateFormat.helpTooltip)
                .onClick(() => {
                    new Notice(strings.settings.items.dateFormat.help, 10000);
                })
        );

        this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.timeFormat.name,
            strings.settings.items.timeFormat.desc,
            strings.settings.items.timeFormat.placeholder,
            () => this.plugin.settings.timeFormat,
            value => {
                this.plugin.settings.timeFormat = value || 'h:mm a';
            }
        ).addExtraButton(button =>
            button
                .setIcon('help')
                .setTooltip(strings.settings.items.timeFormat.helpTooltip)
                .onClick(() => {
                    new Notice(strings.settings.items.timeFormat.help, 10000);
                })
        );

        // Section 5: Notes
        new Setting(containerEl).setName(strings.settings.sections.notes).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.useFrontmatterDates.name)
            .setDesc(strings.settings.items.useFrontmatterDates.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.useFrontmatterMetadata).onChange(async value => {
                    this.plugin.settings.useFrontmatterMetadata = value;
                    await this.saveAndRefresh();
                    frontmatterSettingsEl.toggle(value);
                })
            );

        // Container for frontmatter settings
        const frontmatterSettingsEl = containerEl.createDiv('nn-sub-settings');

        this.createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterNameField.name,
            strings.settings.items.frontmatterNameField.desc,
            strings.settings.items.frontmatterNameField.placeholder,
            () => this.plugin.settings.frontmatterNameField,
            value => {
                this.plugin.settings.frontmatterNameField = value || '';
            }
        );

        this.createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterCreatedField.name,
            strings.settings.items.frontmatterCreatedField.desc,
            strings.settings.items.frontmatterCreatedField.placeholder,
            () => this.plugin.settings.frontmatterCreatedField,
            value => {
                this.plugin.settings.frontmatterCreatedField = value;
            }
        );

        this.createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterModifiedField.name,
            strings.settings.items.frontmatterModifiedField.desc,
            strings.settings.items.frontmatterModifiedField.placeholder,
            () => this.plugin.settings.frontmatterModifiedField,
            value => {
                this.plugin.settings.frontmatterModifiedField = value;
            }
        );

        const dateFormatSetting = this.createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterDateFormat.name,
            strings.settings.items.frontmatterDateFormat.desc,
            ISO_DATE_FORMAT,
            () => this.plugin.settings.frontmatterDateFormat,
            value => {
                this.plugin.settings.frontmatterDateFormat = value;
            }
        ).addExtraButton(button =>
            button
                .setIcon('help')
                .setTooltip(strings.settings.items.frontmatterDateFormat.helpTooltip)
                .onClick(() => {
                    new Notice(strings.settings.items.frontmatterDateFormat.help, 10000);
                })
        );
        dateFormatSetting.controlEl.addClass('nn-setting-wide-input');

        // Add metadata parsing info container
        const metadataInfoContainer = frontmatterSettingsEl.createDiv('nn-setting-info-container');
        this.metadataInfoEl = metadataInfoContainer.createEl('div', {
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName(strings.settings.items.fileNameRows.name)
            .setDesc(strings.settings.items.fileNameRows.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('1', strings.settings.items.fileNameRows.options['1'])
                    .addOption('2', strings.settings.items.fileNameRows.options['2'])
                    .setValue(this.plugin.settings.fileNameRows.toString())
                    .onChange(async value => {
                        this.plugin.settings.fileNameRows = parseInt(value, 10);
                        await this.saveAndRefresh();
                    })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showFileDate.name)
            .setDesc(strings.settings.items.showFileDate.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFileDate).onChange(async value => {
                    this.plugin.settings.showFileDate = value;
                    await this.saveAndRefresh();
                })
            );

        showFileTagsSetting = new Setting(containerEl)
            .setName(strings.settings.items.showFileTags.name)
            .setDesc(strings.settings.items.showFileTags.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFileTags).onChange(async value => {
                    this.plugin.settings.showFileTags = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showFilePreview.name)
            .setDesc(strings.settings.items.showFilePreview.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFilePreview).onChange(async value => {
                    this.plugin.settings.showFilePreview = value;
                    await this.saveAndRefresh();
                    previewSettingsEl.toggle(value);
                })
            );

        // Container for preview-related settings
        const previewSettingsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(previewSettingsEl)
            .setName(strings.settings.items.skipHeadingsInPreview.name)
            .setDesc(strings.settings.items.skipHeadingsInPreview.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.skipHeadingsInPreview).onChange(async value => {
                    this.plugin.settings.skipHeadingsInPreview = value;
                    await this.saveAndRefresh();
                })
            );

        new Setting(previewSettingsEl)
            .setName(strings.settings.items.previewRows.name)
            .setDesc(strings.settings.items.previewRows.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('1', strings.settings.items.previewRows.options['1'])
                    .addOption('2', strings.settings.items.previewRows.options['2'])
                    .addOption('3', strings.settings.items.previewRows.options['3'])
                    .addOption('4', strings.settings.items.previewRows.options['4'])
                    .addOption('5', strings.settings.items.previewRows.options['5'])
                    .setValue(this.plugin.settings.previewRows.toString())
                    .onChange(async value => {
                        this.plugin.settings.previewRows = parseInt(value, 10);
                        await this.saveAndRefresh();
                    })
            );

        const previewPropertiesSetting = this.createDebouncedTextSetting(
            previewSettingsEl,
            strings.settings.items.previewProperties.name,
            strings.settings.items.previewProperties.desc,
            strings.settings.items.previewProperties.placeholder,
            () => this.plugin.settings.previewProperties.join(', '),
            value => {
                this.plugin.settings.previewProperties = value
                    .split(',')
                    .map(prop => prop.trim())
                    .filter(prop => prop.length > 0);
            }
        );
        previewPropertiesSetting.controlEl.addClass('nn-setting-wide-input');

        // Create a container for additional info that appears below the entire setting
        const previewInfoContainer = previewSettingsEl.createDiv('nn-setting-info-container');
        const previewInfoDiv = previewInfoContainer.createEl('div', {
            cls: 'setting-item-description'
        });
        previewInfoDiv.createSpan({
            text: strings.settings.items.previewProperties.info
        });

        new Setting(containerEl)
            .setName(strings.settings.items.showFeatureImage.name)
            .setDesc(strings.settings.items.showFeatureImage.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFeatureImage).onChange(async value => {
                    this.plugin.settings.showFeatureImage = value;
                    await this.saveAndRefresh();
                    featureImageSettingsEl.toggle(value);
                })
            );

        // Container for feature image settings
        const featureImageSettingsEl = containerEl.createDiv('nn-sub-settings');

        const featurePropertiesSetting = this.createDebouncedTextSetting(
            featureImageSettingsEl,
            strings.settings.items.featureImageProperties.name,
            strings.settings.items.featureImageProperties.desc,
            strings.settings.items.featureImageProperties.placeholder,
            () => this.plugin.settings.featureImageProperties.join(', '),
            value => {
                // Parse comma-separated values into array
                this.plugin.settings.featureImageProperties = value
                    .split(',')
                    .map(prop => prop.trim())
                    .filter(prop => prop.length > 0);
            }
        );
        featurePropertiesSetting.controlEl.addClass('nn-setting-wide-input');

        // Create a container for additional info that appears below the entire setting
        const infoContainer = featureImageSettingsEl.createDiv('nn-setting-info-container');

        // Add tip text and embed fallback in a single section
        const tipDiv = infoContainer.createEl('div', {
            cls: 'setting-item-description'
        });
        tipDiv.createSpan({ text: strings.settings.items.featureImageProperties.tip + ' ' });
        tipDiv.createSpan({
            text: strings.settings.items.featureImageProperties.embedFallback
        });

        // Section 6: Advanced
        new Setting(containerEl).setName(strings.settings.sections.advanced).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.confirmBeforeDelete.name)
            .setDesc(strings.settings.items.confirmBeforeDelete.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.confirmBeforeDelete).onChange(async value => {
                    this.plugin.settings.confirmBeforeDelete = value;
                    await this.saveAndRefresh();
                })
            );

        // What's New button
        new Setting(containerEl)
            .setName(strings.settings.items.whatsNew.name)
            .setDesc(strings.settings.items.whatsNew.desc)
            .addButton(button =>
                button.setButtonText(strings.settings.items.whatsNew.buttonText).onClick(async () => {
                    const { WhatsNewModal } = await import('./modals/WhatsNewModal');
                    const { getLatestReleaseNotes } = await import('./releaseNotes');
                    const latestNotes = getLatestReleaseNotes();
                    new WhatsNewModal(this.app, latestNotes, this.plugin.settings.dateFormat).open();
                })
            );

        // Sponsor section
        // Support development section with both buttons
        const supportSetting = new Setting(containerEl)
            .setName(strings.settings.items.supportDevelopment.name)
            .setDesc(strings.settings.items.supportDevelopment.desc);

        // Buy me a coffee button
        supportSetting.addButton(button => {
            button
                .setButtonText('☕️ Buy me a coffee')
                .onClick(() => window.open('https://buymeacoffee.com/johansan'))
                .buttonEl.addClass('nn-support-button');
        });

        // GitHub sponsor button
        supportSetting.addButton(button => {
            button
                .setButtonText(strings.settings.items.supportDevelopment.buttonText)
                .onClick(() => window.open('https://github.com/sponsors/johansan/'))
                .buttonEl.addClass('nn-support-button');
        });

        // Database statistics section at the very bottom
        const statsContainer = containerEl.createDiv('nn-database-stats');
        statsContainer.addClass('setting-item');
        statsContainer.addClass('nn-stats-section');

        // Create the statistics content
        const statsContent = statsContainer.createDiv('nn-stats-content');

        // Store reference to stats element
        this.statsTextEl = statsContent.createEl('div', {
            cls: 'nn-stats-text',
            text: 'Loading statistics...'
        });

        // Load initial statistics asynchronously
        this.updateStatistics();

        // Start periodic updates every 1 second
        this.statsUpdateInterval = window.setInterval(() => {
            this.updateStatistics();
        }, 1000);

        // Set initial visibility
        previewSettingsEl.toggle(this.plugin.settings.showFilePreview);
        featureImageSettingsEl.toggle(this.plugin.settings.showFeatureImage);
        tagSubSettingsEl.toggle(this.plugin.settings.showTags);
        frontmatterSettingsEl.toggle(this.plugin.settings.useFrontmatterMetadata);
        folderNotesSettingsEl.toggle(this.plugin.settings.enableFolderNotes);
        // Hide "Show tags" in Notes section if main "Show tags" is disabled
        if (showFileTagsSetting) {
            showFileTagsSetting.settingEl.toggle(this.plugin.settings.showTags);
        }
    }

    /**
     * Export failed metadata parsing report to markdown file
     */
    private async exportFailedMetadataReport(stats: CacheStatistics): Promise<void> {
        if (!stats.failedCreatedFiles || !stats.failedModifiedFiles) return;

        // Generate timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-mm-ss
        const readableDate = now.toLocaleString();

        // Generate filename
        const filename = `metadata-parsing-failures-${timestamp}.md`;

        // Sort file paths alphabetically
        const failedCreatedFiles = [...stats.failedCreatedFiles].sort();
        const failedModifiedFiles = [...stats.failedModifiedFiles].sort();

        // Generate markdown content
        let content = `# Metadata Parsing Failures\n\n`;
        content += `Generated on: ${readableDate}\n\n`;

        content += `## Failed Created Date Parsing\n`;
        content += `Total files: ${failedCreatedFiles.length}\n\n`;
        if (failedCreatedFiles.length > 0) {
            failedCreatedFiles.forEach(path => {
                content += `- [[${path}]]\n`;
            });
        } else {
            content += `*No failures*\n`;
        }
        content += `\n`;

        content += `## Failed Modified Date Parsing\n`;
        content += `Total files: ${failedModifiedFiles.length}\n\n`;
        if (failedModifiedFiles.length > 0) {
            failedModifiedFiles.forEach(path => {
                content += `- [[${path}]]\n`;
            });
        } else {
            content += `*No failures*\n`;
        }

        try {
            // Create the file in vault root
            await this.app.vault.create(filename, content);
            new Notice(`Failed metadata report exported to: ${filename}`);
        } catch (error) {
            console.error('Failed to export metadata report:', error);
            new Notice('Failed to export metadata report');
        }
    }

    /**
     * Called when settings tab is closed
     * Cleans up any pending debounce timers and intervals to prevent memory leaks
     */
    hide(): void {
        // Clean up all pending debounce timers when settings tab is closed
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        // Clean up statistics update interval
        if (this.statsUpdateInterval !== null) {
            window.clearInterval(this.statsUpdateInterval);
            this.statsUpdateInterval = null;
        }

        // Clear reference to stats element
        this.statsTextEl = null;
        this.metadataInfoEl = null;
    }
}
