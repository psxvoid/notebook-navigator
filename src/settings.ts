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

import { App, Notice, PluginSettingTab, Setting, SliderComponent } from 'obsidian';
import NotebookNavigatorPlugin from './main';
import { strings } from './i18n';
import { TIMEOUTS } from './types/obsidian-extended';
import { FileVisibility, FILE_VISIBILITY } from './utils/fileTypeUtils';
import { NAVPANE_MEASUREMENTS } from './types';
import { calculateCacheStatistics, CacheStatistics } from './storage/statistics';
import { ISO_DATE_FORMAT } from './utils/dateUtils';
import { FolderAppearance, TagAppearance } from './hooks/useListPaneAppearance';
import { PinnedNotes } from './types';
import { FolderNoteType, isFolderNoteType } from './types/folderNote';

// Current settings schema version
export const SETTINGS_VERSION = 1;

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
 * Scope of items that button actions affect
 */
export type ItemScope =
    | 'all' // Both folders and tags
    | 'folders-only' // Only folders
    | 'tags-only'; // Only tags

export type MultiSelectModifier = 'cmdCtrl' | 'optionAlt';

export type SearchProvider = 'internal' | 'omnisearch';

/**
 * Quick actions configuration
 */
/**
 * Plugin settings interface defining all configurable options
 * These settings control the appearance and behavior of the navigator
 */
export interface NotebookNavigatorSettings {
    // Top level settings (no category)
    dualPane: boolean;
    autoRevealActiveFile: boolean;
    autoRevealIgnoreRightSidebar: boolean;
    showTooltips: boolean;
    fileVisibility: FileVisibility;
    excludedFolders: string[];
    excludedFiles: string[];
    // Navigation pane
    autoSelectFirstFileOnFocusChange: boolean;
    autoExpandFoldersTags: boolean;
    collapseBehavior: ItemScope;
    smartCollapse: boolean;
    showIcons: boolean;
    showNoteCount: boolean;
    navIndent: number;
    navItemHeight: number;
    navItemHeightScaleText: boolean;
    // Folders
    showRootFolder: boolean;
    inheritFolderColors: boolean;
    enableFolderNotes: boolean;
    folderNoteType: FolderNoteType;
    folderNoteName: string;
    folderNoteProperties: string[];
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
    multiSelectModifier: MultiSelectModifier;
    groupByDate: boolean;
    optimizeNoteHeight: boolean;
    showQuickActions: boolean;
    quickActionRevealInFolder: boolean;
    quickActionPinNote: boolean;
    quickActionOpenInNewTab: boolean;
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
    showFileTagsInSlimMode: boolean;
    showParentFolderNames: boolean;
    showFilePreview: boolean;
    skipHeadingsInPreview: boolean;
    previewProperties: string[];
    previewRows: number;
    showFeatureImage: boolean;
    featureImageProperties: string[];
    useEmbeddedImageFallback: boolean;
    // Advanced
    confirmBeforeDelete: boolean;
    // Internal
    searchActive: boolean;
    searchProvider: SearchProvider | null;
    showHiddenItems: boolean;
    // Whether list/tag views include notes from descendants (subfolders/subtags)
    includeDescendantNotes: boolean;
    customVaultName: string;
    pinnedNotes: PinnedNotes;
    folderIcons: Record<string, string>;
    folderColors: Record<string, string>;
    folderBackgroundColors: Record<string, string>;
    folderSortOverrides: Record<string, SortOption>;
    folderAppearances: Record<string, FolderAppearance>;
    tagIcons: Record<string, string>;
    tagColors: Record<string, string>;
    tagBackgroundColors: Record<string, string>;
    tagSortOverrides: Record<string, SortOption>;
    tagAppearances: Record<string, TagAppearance>;
    recentIcons: Record<string, string[]>;
    recentColors: string[];
    lastShownVersion: string;
    settingsVersion: number;
}

/**
 * Default settings for the plugin
 * Used when plugin is first installed or settings are reset
 */
export const DEFAULT_SETTINGS: NotebookNavigatorSettings = {
    // Top level settings (no category)
    dualPane: true,
    autoRevealActiveFile: true,
    autoRevealIgnoreRightSidebar: true,
    showTooltips: true,
    fileVisibility: FILE_VISIBILITY.DOCUMENTS,
    excludedFolders: [],
    excludedFiles: [],
    // Navigation pane
    autoSelectFirstFileOnFocusChange: false,
    autoExpandFoldersTags: false,
    collapseBehavior: 'all',
    smartCollapse: true,
    showIcons: true,
    showNoteCount: true,
    navIndent: NAVPANE_MEASUREMENTS.defaultIndent,
    navItemHeight: NAVPANE_MEASUREMENTS.defaultItemHeight,
    navItemHeightScaleText: true,
    // Folders
    showRootFolder: true,
    inheritFolderColors: false,
    enableFolderNotes: false,
    folderNoteType: 'markdown',
    folderNoteName: '',
    folderNoteProperties: [],
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
    multiSelectModifier: 'cmdCtrl',
    groupByDate: true,
    optimizeNoteHeight: true,
    showQuickActions: true,
    quickActionRevealInFolder: true,
    quickActionPinNote: true,
    quickActionOpenInNewTab: true,
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
    showFileTagsInSlimMode: false,
    showParentFolderNames: true,
    showFilePreview: true,
    skipHeadingsInPreview: true,
    previewProperties: [],
    previewRows: 2,
    showFeatureImage: true,
    featureImageProperties: ['thumbnail', 'featureResized', 'feature'],
    useEmbeddedImageFallback: true,
    // Advanced
    confirmBeforeDelete: true,
    // Internal
    searchActive: false,
    searchProvider: 'internal',
    showHiddenItems: false,
    includeDescendantNotes: true,
    customVaultName: '',
    pinnedNotes: {},
    folderIcons: {},
    folderColors: {},
    folderBackgroundColors: {},
    folderSortOverrides: {},
    folderAppearances: {},
    tagIcons: {},
    tagColors: {},
    tagBackgroundColors: {},
    tagSortOverrides: {},
    tagAppearances: {},
    recentIcons: {},
    recentColors: [],
    lastShownVersion: '',
    settingsVersion: SETTINGS_VERSION
};

/**
 * Settings tab for configuring the Notebook Navigator plugin
 * Provides organized sections for different aspects of the plugin
 * Implements debounced text inputs to prevent excessive updates
 */
export class NotebookNavigatorSettingTab extends PluginSettingTab {
    plugin: NotebookNavigatorPlugin;
    // Map of active debounce timers for text inputs
    private debounceTimers: Map<string, number> = new Map();
    // Reference to stats element
    private statsTextEl: HTMLElement | null = null;
    // Reference to metadata parsing info element
    private metadataInfoEl: HTMLElement | null = null;
    // Statistics update interval ID
    private statsUpdateInterval: number | null = null;

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
                            window.clearTimeout(existingTimer);
                        }

                        // Set new timer
                        const timer = window.setTimeout(async () => {
                            // Validate if validator provided
                            if (!validator || validator(value)) {
                                setValue(value);
                                await this.plugin.saveSettingsAndUpdate();
                            }

                            this.debounceTimers.delete(timerId);
                        }, TIMEOUTS.DEBOUNCE_SETTINGS);

                        this.debounceTimers.set(timerId, timer);
                    })
            );
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
                failedText += ` ${strings.settings.items.metadataInfo.checkTimestampFormat}`;
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
        // Clear any existing interval to prevent duplicates
        if (this.statsUpdateInterval !== null) {
            window.clearInterval(this.statsUpdateInterval);
            this.statsUpdateInterval = null;
        }

        const { containerEl } = this;
        containerEl.empty();

        // Top level settings (no category header)

        new Setting(containerEl)
            .setName(strings.settings.items.dualPane.name)
            .setDesc(strings.settings.items.dualPane.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.dualPane).onChange(async value => {
                    this.plugin.settings.dualPane = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        // Auto-reveal active note + sub-settings
        new Setting(containerEl)
            .setName(strings.settings.items.autoRevealActiveNote.name)
            .setDesc(strings.settings.items.autoRevealActiveNote.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.autoRevealActiveFile).onChange(async value => {
                    this.plugin.settings.autoRevealActiveFile = value;
                    await this.plugin.saveSettingsAndUpdate();
                    autoRevealSettingsEl.toggle(value);
                })
            );

        // Container for auto-reveal sub-settings
        const autoRevealSettingsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(autoRevealSettingsEl)
            .setName(strings.settings.items.autoRevealIgnoreRightSidebar.name)
            .setDesc(strings.settings.items.autoRevealIgnoreRightSidebar.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.autoRevealIgnoreRightSidebar).onChange(async value => {
                    this.plugin.settings.autoRevealIgnoreRightSidebar = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );
        autoRevealSettingsEl.toggle(this.plugin.settings.autoRevealActiveFile);

        new Setting(containerEl)
            .setName(strings.settings.items.showTooltips.name)
            .setDesc(strings.settings.items.showTooltips.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showTooltips).onChange(async value => {
                    this.plugin.settings.showTooltips = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.fileVisibility.name)
            .setDesc(strings.settings.items.fileVisibility.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption(FILE_VISIBILITY.DOCUMENTS, strings.settings.items.fileVisibility.options.documents)
                    .addOption(FILE_VISIBILITY.SUPPORTED, strings.settings.items.fileVisibility.options.supported)
                    .addOption(FILE_VISIBILITY.ALL, strings.settings.items.fileVisibility.options.all)
                    .setValue(this.plugin.settings.fileVisibility)
                    .onChange(async (value: FileVisibility) => {
                        this.plugin.settings.fileVisibility = value;
                        await this.plugin.saveSettingsAndUpdate();
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
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.autoExpandFoldersTags.name)
            .setDesc(strings.settings.items.autoExpandFoldersTags.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.autoExpandFoldersTags).onChange(async value => {
                    this.plugin.settings.autoExpandFoldersTags = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.collapseBehavior.name)
            .setDesc(strings.settings.items.collapseBehavior.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('all', strings.settings.items.collapseBehavior.options.all)
                    .addOption('folders-only', strings.settings.items.collapseBehavior.options.foldersOnly)
                    .addOption('tags-only', strings.settings.items.collapseBehavior.options.tagsOnly)
                    .setValue(this.plugin.settings.collapseBehavior)
                    .onChange(async (value: ItemScope) => {
                        this.plugin.settings.collapseBehavior = value;
                        await this.plugin.saveSettingsAndUpdate();
                    })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.smartCollapse.name)
            .setDesc(strings.settings.items.smartCollapse.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.smartCollapse).onChange(async value => {
                    this.plugin.settings.smartCollapse = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showIcons.name)
            .setDesc(strings.settings.items.showIcons.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showIcons).onChange(async value => {
                    this.plugin.settings.showIcons = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showNoteCount.name)
            .setDesc(strings.settings.items.showNoteCount.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showNoteCount).onChange(async value => {
                    this.plugin.settings.showNoteCount = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        let indentationSlider: SliderComponent;
        new Setting(containerEl)
            .setName(strings.settings.items.navIndent.name)
            .setDesc(strings.settings.items.navIndent.desc)
            .addSlider(slider => {
                indentationSlider = slider
                    .setLimits(10, 24, 1)
                    .setValue(this.plugin.settings.navIndent)
                    .setDynamicTooltip()
                    .onChange(async value => {
                        this.plugin.settings.navIndent = value;
                        await this.plugin.saveSettingsAndUpdate();
                    });
                return slider;
            })
            .addExtraButton(button =>
                button
                    .setIcon('lucide-rotate-ccw')
                    .setTooltip('Restore to default (16px)')
                    .onClick(async () => {
                        const defaultValue = DEFAULT_SETTINGS.navIndent;
                        indentationSlider.setValue(defaultValue);
                        this.plugin.settings.navIndent = defaultValue;
                        await this.plugin.saveSettingsAndUpdate();
                    })
            );

        let lineHeightSlider: SliderComponent;
        new Setting(containerEl)
            .setName(strings.settings.items.navItemHeight.name)
            .setDesc(strings.settings.items.navItemHeight.desc)
            .addSlider(slider => {
                lineHeightSlider = slider
                    .setLimits(20, 28, 1)
                    .setValue(this.plugin.settings.navItemHeight)
                    .setDynamicTooltip()
                    .onChange(async value => {
                        this.plugin.settings.navItemHeight = value;
                        await this.plugin.saveSettingsAndUpdate();
                    });
                return slider;
            })
            .addExtraButton(button =>
                button
                    .setIcon('lucide-rotate-ccw')
                    .setTooltip('Restore to default (28px)')
                    .onClick(async () => {
                        const defaultValue = DEFAULT_SETTINGS.navItemHeight;
                        lineHeightSlider.setValue(defaultValue);
                        this.plugin.settings.navItemHeight = defaultValue;
                        await this.plugin.saveSettingsAndUpdate();
                    })
            );

        const navItemHeightSettingsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(navItemHeightSettingsEl)
            .setName(strings.settings.items.navItemHeightScaleText.name)
            .setDesc(strings.settings.items.navItemHeightScaleText.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.navItemHeightScaleText).onChange(async value => {
                    this.plugin.settings.navItemHeightScaleText = value;
                    await this.plugin.saveSettingsAndUpdate();
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
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.inheritFolderColors.name)
            .setDesc(strings.settings.items.inheritFolderColors.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.inheritFolderColors).onChange(async value => {
                    this.plugin.settings.inheritFolderColors = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.enableFolderNotes.name)
            .setDesc(strings.settings.items.enableFolderNotes.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.enableFolderNotes).onChange(async value => {
                    this.plugin.settings.enableFolderNotes = value;
                    await this.plugin.saveSettingsAndUpdate();
                    // Update folder notes sub-settings visibility
                    folderNotesSettingsEl.toggle(value);
                })
            );

        // Container for folder notes sub-settings
        const folderNotesSettingsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(folderNotesSettingsEl)
            .setName(strings.settings.items.folderNoteType.name)
            .setDesc(strings.settings.items.folderNoteType.desc)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('markdown', strings.settings.items.folderNoteType.options.markdown)
                    .addOption('canvas', strings.settings.items.folderNoteType.options.canvas)
                    .addOption('base', strings.settings.items.folderNoteType.options.base)
                    .setValue(this.plugin.settings.folderNoteType)
                    .onChange(async value => {
                        if (!isFolderNoteType(value)) {
                            return;
                        }
                        this.plugin.settings.folderNoteType = value;
                        await this.plugin.saveSettingsAndUpdate();
                    });
            });

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

        const folderNotePropertiesSetting = this.createDebouncedTextSetting(
            folderNotesSettingsEl,
            strings.settings.items.folderNoteProperties.name,
            strings.settings.items.folderNoteProperties.desc,
            strings.settings.items.folderNoteProperties.placeholder,
            () => this.plugin.settings.folderNoteProperties.join(', '),
            value => {
                this.plugin.settings.folderNoteProperties = value
                    .split(',')
                    .map(prop => prop.trim())
                    .filter(prop => prop.length > 0);
            }
        );
        folderNotePropertiesSetting.controlEl.addClass('nn-setting-wide-input');

        new Setting(folderNotesSettingsEl)
            .setName(strings.settings.items.hideFolderNoteInList.name)
            .setDesc(strings.settings.items.hideFolderNoteInList.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.hideFolderNoteInList).onChange(async value => {
                    this.plugin.settings.hideFolderNoteInList = value;
                    await this.plugin.saveSettingsAndUpdate();
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
                    await this.plugin.saveSettingsAndUpdate();
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
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(tagSubSettingsEl)
            .setName(strings.settings.items.showFavoriteTagsFolder.name)
            .setDesc(strings.settings.items.showFavoriteTagsFolder.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFavoriteTagsFolder).onChange(async value => {
                    this.plugin.settings.showFavoriteTagsFolder = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(tagSubSettingsEl)
            .setName(strings.settings.items.showAllTagsFolder.name)
            .setDesc(strings.settings.items.showAllTagsFolder.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showAllTagsFolder).onChange(async value => {
                    this.plugin.settings.showAllTagsFolder = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(tagSubSettingsEl)
            .setName(strings.settings.items.showUntagged.name)
            .setDesc(strings.settings.items.showUntagged.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showUntagged).onChange(async value => {
                    this.plugin.settings.showUntagged = value;
                    untaggedInFavoritesEl.style.display = value ? 'block' : 'none';
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        // Sub-setting for untagged in favorites - only show if showUntagged is enabled
        const untaggedInFavoritesEl = tagSubSettingsEl.createDiv('notebook-navigator-subsetting');
        untaggedInFavoritesEl.style.display = this.plugin.settings.showUntagged ? 'block' : 'none';

        new Setting(untaggedInFavoritesEl)
            .setName(strings.settings.items.showUntaggedInFavorites.name)
            .setDesc(strings.settings.items.showUntaggedInFavorites.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showUntaggedInFavorites).onChange(async value => {
                    this.plugin.settings.showUntaggedInFavorites = value;
                    await this.plugin.saveSettingsAndUpdate();
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
                    .map(tag => tag.replace(/^#/, '')) // Remove leading hashtag
                    .map(tag => tag.replace(/^\/+|\/+$/g, '')) // Trim leading/trailing slashes
                    .map(tag => tag.toLowerCase())
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
                    .map(tag => tag.replace(/^#/, '')) // Remove leading hashtag
                    .map(tag => tag.replace(/^\/+|\/+$/g, '')) // Trim leading/trailing slashes
                    .map(tag => tag.toLowerCase())
                    .filter(tag => tag.length > 0);
            }
        );

        // Add a custom class to make the input wider
        hiddenTagsSetting.controlEl.addClass('nn-setting-wide-input');

        // Section 4: Search
        new Setting(containerEl).setName(strings.settings.sections.search).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.searchProvider.name)
            .setDesc(strings.settings.items.searchProvider.desc)
            .addDropdown(dropdown => {
                const currentProvider = this.plugin.settings.searchProvider ?? 'internal';
                dropdown
                    .addOption('internal', strings.settings.items.searchProvider.options.internal)
                    .addOption('omnisearch', strings.settings.items.searchProvider.options.omnisearch)
                    .setValue(currentProvider)
                    .onChange(async value => {
                        const provider = value as SearchProvider;
                        this.plugin.settings.searchProvider = provider;
                        await this.plugin.saveSettingsAndUpdate();
                        updateSearchInfo();
                    });
            });

        const searchInfoContainer = containerEl.createDiv('nn-setting-info-container');
        const searchInfoEl = searchInfoContainer.createEl('div', {
            cls: 'setting-item-description'
        });

        const updateSearchInfo = () => {
            const provider = this.plugin.settings.searchProvider;
            const hasOmnisearch = this.plugin.omnisearchService?.isAvailable() ?? false;

            // Clear existing content
            searchInfoEl.empty();

            if (provider === 'omnisearch' && !hasOmnisearch) {
                const warningDiv = searchInfoEl.createDiv({ cls: 'setting-item-description' });
                warningDiv.createEl('strong', {
                    text: strings.settings.items.searchProvider.info.omnisearch.warningNotInstalled
                });
                searchInfoEl.createEl('br');
            }

            // Always show comprehensive information about search providers
            const infoDiv = searchInfoEl.createDiv();

            // Add information about Filter search
            const filterSection = infoDiv.createEl('div', { cls: 'nn-search-info-section' });
            filterSection.createEl('strong', { text: strings.settings.items.searchProvider.info.filterSearch.title });
            filterSection.createEl('div', {
                text: strings.settings.items.searchProvider.info.filterSearch.description,
                cls: 'nn-search-description'
            });

            infoDiv.createEl('br');

            // Add information about Omnisearch
            const omnisearchSection = infoDiv.createEl('div', { cls: 'nn-search-info-section' });
            omnisearchSection.createEl('strong', { text: strings.settings.items.searchProvider.info.omnisearch.title });

            const omnisearchDesc = omnisearchSection.createEl('div', { cls: 'nn-search-description' });
            omnisearchDesc.createSpan({
                text: `${strings.settings.items.searchProvider.info.omnisearch.description} `
            });

            omnisearchDesc.createEl('br');
            omnisearchDesc.createEl('strong', { text: strings.settings.items.searchProvider.info.omnisearch.limitations.title });
            const limitsList = omnisearchDesc.createEl('ul', { cls: 'nn-search-limitations' });
            limitsList.createEl('li', {
                text: strings.settings.items.searchProvider.info.omnisearch.limitations.performance
            });
            limitsList.createEl('li', {
                text: strings.settings.items.searchProvider.info.omnisearch.limitations.pathBug
            });
            limitsList.createEl('li', {
                text: strings.settings.items.searchProvider.info.omnisearch.limitations.limitedResults
            });
            limitsList.createEl('li', {
                text: strings.settings.items.searchProvider.info.omnisearch.limitations.previewText
            });
        };

        updateSearchInfo();

        // Section 5: List pane
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
                        await this.plugin.saveSettingsAndUpdate();
                    })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.multiSelectModifier.name)
            .setDesc(strings.settings.items.multiSelectModifier.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('cmdCtrl', strings.settings.items.multiSelectModifier.options.cmdCtrl)
                    .addOption('optionAlt', strings.settings.items.multiSelectModifier.options.optionAlt)
                    .setValue(this.plugin.settings.multiSelectModifier)
                    .onChange(async (value: MultiSelectModifier) => {
                        this.plugin.settings.multiSelectModifier = value;
                        await this.plugin.saveSettingsAndUpdate();
                    })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.groupByDate.name)
            .setDesc(strings.settings.items.groupByDate.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.groupByDate).onChange(async value => {
                    this.plugin.settings.groupByDate = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.optimizeNoteHeight.name)
            .setDesc(strings.settings.items.optimizeNoteHeight.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.optimizeNoteHeight).onChange(async value => {
                    this.plugin.settings.optimizeNoteHeight = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        // Quick actions settings
        new Setting(containerEl)
            .setName(strings.settings.items.showQuickActions.name)
            .setDesc(strings.settings.items.showQuickActions.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showQuickActions).onChange(async value => {
                    this.plugin.settings.showQuickActions = value;
                    await this.plugin.saveSettingsAndUpdate();
                    // Update quick actions sub-settings visibility
                    quickActionsEl.toggle(value);
                })
            );

        // Container for quick actions sub-settings
        const quickActionsEl = containerEl.createDiv('nn-sub-settings');

        // Reveal in folder quick action
        new Setting(quickActionsEl)
            .setName(strings.settings.items.quickActionsRevealInFolder.name)
            .setDesc(strings.settings.items.quickActionsRevealInFolder.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.quickActionRevealInFolder).onChange(async value => {
                    this.plugin.settings.quickActionRevealInFolder = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        // Pin note quick action
        new Setting(quickActionsEl)
            .setName(strings.settings.items.quickActionsPinNote.name)
            .setDesc(strings.settings.items.quickActionsPinNote.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.quickActionPinNote).onChange(async value => {
                    this.plugin.settings.quickActionPinNote = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        // Open in new tab quick action
        new Setting(quickActionsEl)
            .setName(strings.settings.items.quickActionsOpenInNewTab.name)
            .setDesc(strings.settings.items.quickActionsOpenInNewTab.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.quickActionOpenInNewTab).onChange(async value => {
                    this.plugin.settings.quickActionOpenInNewTab = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        // Set initial visibility
        quickActionsEl.toggle(this.plugin.settings.showQuickActions);

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
                .setIcon('lucide-help-circle')
                .setTooltip(strings.settings.items.dateFormat.helpTooltip)
                .onClick(() => {
                    new Notice(strings.settings.items.dateFormat.help, TIMEOUTS.NOTICE_HELP);
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
                .setIcon('lucide-help-circle')
                .setTooltip(strings.settings.items.timeFormat.helpTooltip)
                .onClick(() => {
                    new Notice(strings.settings.items.timeFormat.help, TIMEOUTS.NOTICE_HELP);
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
                    await this.plugin.saveSettingsAndUpdate();
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
                .setIcon('lucide-help-circle')
                .setTooltip(strings.settings.items.frontmatterDateFormat.helpTooltip)
                .onClick(() => {
                    new Notice(strings.settings.items.frontmatterDateFormat.help, TIMEOUTS.NOTICE_HELP);
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
                        await this.plugin.saveSettingsAndUpdate();
                    })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showFileDate.name)
            .setDesc(strings.settings.items.showFileDate.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFileDate).onChange(async value => {
                    this.plugin.settings.showFileDate = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        showFileTagsSetting = new Setting(containerEl)
            .setName(strings.settings.items.showFileTags.name)
            .setDesc(strings.settings.items.showFileTags.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFileTags).onChange(async value => {
                    this.plugin.settings.showFileTags = value;
                    await this.plugin.saveSettingsAndUpdate();
                    // Update sub-settings visibility
                    fileTagsSubSettingsEl.toggle(value);
                })
            );

        // Container for file tags sub-settings
        const fileTagsSubSettingsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(fileTagsSubSettingsEl)
            .setName(strings.settings.items.showFileTagsInSlimMode.name)
            .setDesc(strings.settings.items.showFileTagsInSlimMode.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFileTagsInSlimMode).onChange(async value => {
                    this.plugin.settings.showFileTagsInSlimMode = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showParentFolderNames.name)
            .setDesc(strings.settings.items.showParentFolderNames.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showParentFolderNames).onChange(async value => {
                    this.plugin.settings.showParentFolderNames = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.showFilePreview.name)
            .setDesc(strings.settings.items.showFilePreview.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.showFilePreview).onChange(async value => {
                    this.plugin.settings.showFilePreview = value;
                    await this.plugin.saveSettingsAndUpdate();
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
                    await this.plugin.saveSettingsAndUpdate();
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
                        await this.plugin.saveSettingsAndUpdate();
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
                    await this.plugin.saveSettingsAndUpdate();
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

        // Add embedded image fallback toggle
        new Setting(featureImageSettingsEl)
            .setName(strings.settings.items.useEmbeddedImageFallback.name)
            .setDesc(strings.settings.items.useEmbeddedImageFallback.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.useEmbeddedImageFallback).onChange(async value => {
                    this.plugin.settings.useEmbeddedImageFallback = value;
                    await this.plugin.saveSettingsAndUpdate();
                })
            );

        // Section 6: Advanced
        new Setting(containerEl).setName(strings.settings.sections.advanced).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.confirmBeforeDelete.name)
            .setDesc(strings.settings.items.confirmBeforeDelete.desc)
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.confirmBeforeDelete).onChange(async value => {
                    this.plugin.settings.confirmBeforeDelete = value;
                    await this.plugin.saveSettingsAndUpdate();
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
            cls: 'nn-stats-text'
        });

        // Load initial statistics asynchronously
        this.updateStatistics();

        // Start periodic updates every 1 second
        // Create interval and register it with plugin for cleanup on unload
        this.statsUpdateInterval = window.setInterval(() => {
            this.updateStatistics();
        }, TIMEOUTS.INTERVAL_STATISTICS);

        // Register with plugin to ensure cleanup on plugin unload
        this.plugin.registerInterval(this.statsUpdateInterval);

        // Set initial visibility
        previewSettingsEl.toggle(this.plugin.settings.showFilePreview);
        featureImageSettingsEl.toggle(this.plugin.settings.showFeatureImage);
        tagSubSettingsEl.toggle(this.plugin.settings.showTags);
        frontmatterSettingsEl.toggle(this.plugin.settings.useFrontmatterMetadata);
        folderNotesSettingsEl.toggle(this.plugin.settings.enableFolderNotes);
        fileTagsSubSettingsEl.toggle(this.plugin.settings.showFileTags);
        // Hide "Show file tags" in Notes section if main "Show tags" is disabled
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
            new Notice(strings.settings.metadataReport.exportSuccess.replace('{filename}', filename));
        } catch (error) {
            console.error('Failed to export metadata report:', error);
            new Notice(strings.settings.metadataReport.exportFailed);
        }
    }

    /**
     * Called when settings tab is closed
     * Cleans up any pending debounce timers and intervals to prevent memory leaks
     */
    hide(): void {
        // Clean up all pending debounce timers when settings tab is closed
        this.debounceTimers.forEach(timer => window.clearTimeout(timer));
        this.debounceTimers.clear();

        // Stop statistics update interval
        if (this.statsUpdateInterval !== null) {
            window.clearInterval(this.statsUpdateInterval);
            this.statsUpdateInterval = null;
        }

        // Clear reference to stats element
        this.statsTextEl = null;
        this.metadataInfoEl = null;
    }
}
