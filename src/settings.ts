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
import { shouldShowDateGrouping } from './utils/sortUtils';

/**
 * Available sort options for file listing
 */
export type SortOption = 
    | 'modified-desc'  // Date edited (newest first)
    | 'modified-asc'   // Date edited (oldest first)
    | 'created-desc'   // Date created (newest first)
    | 'created-asc'    // Date created (oldest first)
    | 'title-asc'      // Title (A first)
    | 'title-desc';    // Title (Z first)

/**
 * Plugin settings interface defining all configurable options
 * These settings control the appearance and behavior of the navigator
 */
export interface NotebookNavigatorSettings {
    // File organization
    defaultFolderSort: SortOption;
    folderSortOverrides: Record<string, SortOption>;
    groupByDate: boolean;
    showNotesFromSubfolders: boolean;
    showSubfolderNamesInList: boolean;
    autoRevealActiveFile: boolean;
    autoSelectFirstFile: boolean;
    excludedFiles: string;
    ignoreFolders: string;
    // Note display
    fileNameRows: number;
    showDate: boolean;
    dateFormat: string;
    timeFormat: string;
    showFilePreview: boolean;
    skipHeadingsInPreview: boolean;
    skipNonTextInPreview: boolean;
    previewRows: number;
    showFeatureImage: boolean;
    featureImageProperty: string;
    // Folder display
    showRootFolder: boolean;
    showFolderFileCount: boolean;
    showFolderIcons: boolean;
    // Tag display
    showTags: boolean;
    showUntagged: boolean;
    // Advanced
    confirmBeforeDelete: boolean;
    useFrontmatterDates: boolean;
    frontmatterCreatedField: string;
    frontmatterModifiedField: string;
    frontmatterDateFormat: string;
    debugMobile: boolean;
    // Internal
    pinnedNotes: Record<string, string[]>;
    folderIcons: Record<string, string>;
    folderColors: Record<string, string>;
    recentlyUsedIcons: string[];
}

/**
 * Default settings for the plugin
 * Used when plugin is first installed or settings are reset
 */
export const DEFAULT_SETTINGS: NotebookNavigatorSettings = {
    // File organization
    defaultFolderSort: 'modified-desc',
    folderSortOverrides: {},
    groupByDate: true,
    showNotesFromSubfolders: false,
    showSubfolderNamesInList: true,
    autoRevealActiveFile: true,
    autoSelectFirstFile: true,
    excludedFiles: '',
    ignoreFolders: '',
    // Note display
    fileNameRows: 1,
    showDate: true,
    dateFormat: 'MMM d, yyyy',
    timeFormat: 'h:mm a',
    showFilePreview: true,
    skipHeadingsInPreview: false,
    skipNonTextInPreview: true,
    previewRows: 1,
    showFeatureImage: true,
    featureImageProperty: 'feature',
    // Folder display
    showRootFolder: true,
    showFolderFileCount: true,
    showFolderIcons: true,
    // Tag display
    showTags: true,
    showUntagged: false,
    // Advanced
    confirmBeforeDelete: true,
    useFrontmatterDates: false,
    frontmatterCreatedField: 'created',
    frontmatterModifiedField: 'modified',
    frontmatterDateFormat: "yyyy-MM-dd'T'HH:mm:ss",
    debugMobile: false,
    // Internal
    pinnedNotes: {},
    folderIcons: {},
    folderColors: {},
    recentlyUsedIcons: []
}

/**
 * Settings tab for configuring the Notebook Navigator plugin
 * Provides organized sections for different aspects of the plugin
 * Implements debounced text inputs to prevent excessive updates
 */
export class NotebookNavigatorSettingTab extends PluginSettingTab {
    plugin: NotebookNavigatorPlugin;
    // Map of active debounce timers for text inputs
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

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
        refreshView: boolean = true,
        validator?: (value: string) => boolean
    ): Setting {
        return new Setting(container)
            .setName(name)
            .setDesc(desc)
            .addText(text => text
                .setPlaceholder(placeholder)
                .setValue(getValue())
                .onChange(async (value) => {
                    // Clear existing timer for this setting
                    const timerId = `setting-${name}`;
                    if (this.debounceTimers.has(timerId)) {
                        clearTimeout(this.debounceTimers.get(timerId)!);
                    }
                    
                    // Set new timer
                    const timer = setTimeout(async () => {
                        // Validate if validator provided
                        if (!validator || validator(value)) {
                            setValue(value);
                            await this.plugin.saveSettings();
                            
                            if (refreshView) {
                                this.plugin.onSettingsChange();
                            }
                        }
                        
                        this.debounceTimers.delete(timerId);
                    }, 500);
                    
                    this.debounceTimers.set(timerId, timer);
                }));
    }

    /**
     * Helper function to toggle element visibility using CSS class
     * @param element - The HTML element to show/hide
     * @param show - Whether to show (true) or hide (false) the element
     */
    private setElementVisibility(element: HTMLElement, show: boolean): void {
        element.toggleClass('nn-setting-hidden', !show);
    }

    /**
     * Helper to save settings and optionally refresh the view
     * @param refresh - Whether to refresh the navigator view after saving
     */
    private async saveAndRefresh(refresh: boolean = true): Promise<void> {
        await this.plugin.saveSettings();
        if (refresh) {
            this.plugin.onSettingsChange();
        }
    }

    /**
     * Renders the settings tab UI
     * Organizes settings into logical sections:
     * - File organization
     * - File display
     * - Folder display
     * - Appearance
     * - Advanced
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Section 1: File organization
        // Not shown to follow Obsidian plugin guidelines
        // new Setting(containerEl)
        //     .setName('File organization')
        //     .setHeading();

        const sortSetting = new Setting(containerEl)
            .setName(strings.settings.items.sortNotesBy.name)
            .setDesc(strings.settings.items.sortNotesBy.desc)
            .addDropdown(dropdown => dropdown
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
                    // Update group by date visibility
                    this.setElementVisibility(dateGroupingEl, shouldShowDateGrouping(value));
                }));

        // Container for conditional group by date setting
        const dateGroupingEl = containerEl.createDiv('nn-sub-settings');

        new Setting(dateGroupingEl)
            .setName(strings.settings.items.groupByDate.name)
            .setDesc(strings.settings.items.groupByDate.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.groupByDate)
                .onChange(async (value) => {
                    this.plugin.settings.groupByDate = value;
                    await this.saveAndRefresh();
                }));

        const showNotesFromSubfoldersToggle = new Setting(containerEl)
            .setName(strings.settings.items.showNotesFromSubfolders.name)
            .setDesc(strings.settings.items.showNotesFromSubfolders.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNotesFromSubfolders)
                .onChange(async (value) => {
                    this.plugin.settings.showNotesFromSubfolders = value;
                    await this.saveAndRefresh();
                    // Update subfolder names visibility
                    this.setElementVisibility(subfolderNamesEl, value);
                }));

        // Container for conditional subfolder names setting
        const subfolderNamesEl = containerEl.createDiv('nn-sub-settings');

        new Setting(subfolderNamesEl)
            .setName(strings.settings.items.showSubfolderNamesInList.name)
            .setDesc(strings.settings.items.showSubfolderNamesInList.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showSubfolderNamesInList)
                .onChange(async (value) => {
                    this.plugin.settings.showSubfolderNamesInList = value;
                    await this.saveAndRefresh();
                }));

        // Set initial visibility
        this.setElementVisibility(subfolderNamesEl, this.plugin.settings.showNotesFromSubfolders);

        new Setting(containerEl)
            .setName(strings.settings.items.autoRevealActiveNote.name)
            .setDesc(strings.settings.items.autoRevealActiveNote.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoRevealActiveFile)
                .onChange(async (value) => {
                    this.plugin.settings.autoRevealActiveFile = value;
                    await this.saveAndRefresh(false);
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.autoSelectFirstFile.name)
            .setDesc(strings.settings.items.autoSelectFirstFile.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSelectFirstFile)
                .onChange(async (value) => {
                    this.plugin.settings.autoSelectFirstFile = value;
                    await this.saveAndRefresh(false);
                }));

        this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.excludedNotes.name,
            strings.settings.items.excludedNotes.desc,
            strings.settings.items.excludedNotes.placeholder,
            () => this.plugin.settings.excludedFiles,
            (value) => { this.plugin.settings.excludedFiles = value; }
        );

        this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.excludedFolders.name,
            strings.settings.items.excludedFolders.desc,
            strings.settings.items.excludedFolders.placeholder,
            () => this.plugin.settings.ignoreFolders,
            (value) => { this.plugin.settings.ignoreFolders = value; }
        );

        // Section 2: Note display
        new Setting(containerEl)
            .setName(strings.settings.sections.noteDisplay)
            .setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.fileNameRows.name)
            .setDesc(strings.settings.items.fileNameRows.desc)
            .addDropdown(dropdown => dropdown
                .addOption('1', strings.settings.items.fileNameRows.options['1'])
                .addOption('2', strings.settings.items.fileNameRows.options['2'])
                .setValue(this.plugin.settings.fileNameRows.toString())
                .onChange(async (value) => {
                    this.plugin.settings.fileNameRows = parseInt(value, 10);
                    await this.saveAndRefresh();
                }));

        const showDateSetting = new Setting(containerEl)
            .setName(strings.settings.items.showDate.name)
            .setDesc(strings.settings.items.showDate.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDate)
                .onChange(async (value) => {
                    this.plugin.settings.showDate = value;
                    await this.saveAndRefresh();
                    this.setElementVisibility(dateFormatSettingEl, value);
                }));

        // Container for date format setting
        const dateFormatSettingEl = containerEl.createDiv('nn-sub-settings');

        this.createDebouncedTextSetting(
            dateFormatSettingEl,
            strings.settings.items.dateFormat.name,
            strings.settings.items.dateFormat.desc,
            strings.settings.items.dateFormat.placeholder,
            () => this.plugin.settings.dateFormat,
            (value) => { this.plugin.settings.dateFormat = value || 'MMM d, yyyy'; }
        ).addExtraButton(button => button
            .setIcon('help')
            .setTooltip(strings.settings.items.dateFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.dateFormat.help, 10000);
            }));

        this.createDebouncedTextSetting(
            dateFormatSettingEl,
            strings.settings.items.timeFormat.name,
            strings.settings.items.timeFormat.desc,
            strings.settings.items.timeFormat.placeholder,
            () => this.plugin.settings.timeFormat,
            (value) => { this.plugin.settings.timeFormat = value || 'h:mm a'; }
        ).addExtraButton(button => button
            .setIcon('help')
            .setTooltip(strings.settings.items.timeFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.timeFormat.help, 10000);
            }));

        const showPreviewSetting = new Setting(containerEl)
            .setName(strings.settings.items.showFilePreview.name)
            .setDesc(strings.settings.items.showFilePreview.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFilePreview)
                .onChange(async (value) => {
                    this.plugin.settings.showFilePreview = value;
                    await this.saveAndRefresh();
                    this.setElementVisibility(previewSettingsEl, value);
                }));

        // Container for preview-related settings
        const previewSettingsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(previewSettingsEl)
            .setName(strings.settings.items.skipHeadingsInPreview.name)
            .setDesc(strings.settings.items.skipHeadingsInPreview.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.skipHeadingsInPreview)
                .onChange(async (value) => {
                    this.plugin.settings.skipHeadingsInPreview = value;
                    await this.saveAndRefresh();
                }));

        new Setting(previewSettingsEl)
            .setName(strings.settings.items.skipNonTextInPreview.name)
            .setDesc(strings.settings.items.skipNonTextInPreview.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.skipNonTextInPreview)
                .onChange(async (value) => {
                    this.plugin.settings.skipNonTextInPreview = value;
                    await this.saveAndRefresh();
                }));

        new Setting(previewSettingsEl)
            .setName(strings.settings.items.previewRows.name)
            .setDesc(strings.settings.items.previewRows.desc)
            .addDropdown(dropdown => dropdown
                .addOption('1', strings.settings.items.previewRows.options['1'])
                .addOption('2', strings.settings.items.previewRows.options['2'])
                .addOption('3', strings.settings.items.previewRows.options['3'])
                .addOption('4', strings.settings.items.previewRows.options['4'])
                .addOption('5', strings.settings.items.previewRows.options['5'])
                .setValue(this.plugin.settings.previewRows.toString())
                .onChange(async (value) => {
                    this.plugin.settings.previewRows = parseInt(value, 10);
                    await this.saveAndRefresh();
                }));

        const showFeatureImageSetting = new Setting(containerEl)
            .setName(strings.settings.items.showFeatureImage.name)
            .setDesc(strings.settings.items.showFeatureImage.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFeatureImage)
                .onChange(async (value) => {
                    this.plugin.settings.showFeatureImage = value;
                    await this.saveAndRefresh();
                    this.setElementVisibility(featureImageSettingsEl, value);
                }));

        // Container for feature image settings
        const featureImageSettingsEl = containerEl.createDiv('nn-sub-settings');

        this.createDebouncedTextSetting(
            featureImageSettingsEl,
            strings.settings.items.featureImageProperty.name,
            strings.settings.items.featureImageProperty.desc,
            strings.settings.items.featureImageProperty.placeholder,
            () => this.plugin.settings.featureImageProperty,
            (value) => { this.plugin.settings.featureImageProperty = value || 'feature'; }
        );

        // Section 3: Folder display
        new Setting(containerEl)
            .setName(strings.settings.sections.folderDisplay)
            .setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.showRootFolder.name)
            .setDesc(strings.settings.items.showRootFolder.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRootFolder)
                .onChange(async (value) => {
                    this.plugin.settings.showRootFolder = value;
                    await this.saveAndRefresh();
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.showFolderFileCount.name)
            .setDesc(strings.settings.items.showFolderFileCount.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFolderFileCount)
                .onChange(async (value) => {
                    this.plugin.settings.showFolderFileCount = value;
                    await this.saveAndRefresh();
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.showFolderIcons.name)
            .setDesc(strings.settings.items.showFolderIcons.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFolderIcons)
                .onChange(async (value) => {
                    this.plugin.settings.showFolderIcons = value;
                    await this.saveAndRefresh();
                }));

        // Section 4: Tag display
        new Setting(containerEl)
            .setName(strings.settings.sections.tagDisplay)
            .setHeading();

        const showTagsSetting = new Setting(containerEl)
            .setName(strings.settings.items.showTags.name)
            .setDesc(strings.settings.items.showTags.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showTags)
                .onChange(async (value) => {
                    this.plugin.settings.showTags = value;
                    await this.saveAndRefresh();
                    // Update untagged visibility
                    this.setElementVisibility(untaggedSettingEl, value);
                }));

        // Container for untagged setting
        const untaggedSettingEl = containerEl.createDiv();

        new Setting(untaggedSettingEl)
            .setName(strings.settings.items.showUntagged.name)
            .setDesc(strings.settings.items.showUntagged.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showUntagged)
                .onChange(async (value) => {
                    this.plugin.settings.showUntagged = value;
                    await this.saveAndRefresh();
                }));

        // Section 5: Advanced
        new Setting(containerEl)
            .setName(strings.settings.sections.advanced)
            .setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.confirmBeforeDelete.name)
            .setDesc(strings.settings.items.confirmBeforeDelete.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.confirmBeforeDelete)
                .onChange(async (value) => {
                    this.plugin.settings.confirmBeforeDelete = value;
                    await this.saveAndRefresh(false);
                }));

        const useFrontmatterDatesSetting = new Setting(containerEl)
            .setName(strings.settings.items.useFrontmatterDates.name)
            .setDesc(strings.settings.items.useFrontmatterDates.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useFrontmatterDates)
                .onChange(async (value) => {
                    this.plugin.settings.useFrontmatterDates = value;
                    await this.saveAndRefresh();
                    this.setElementVisibility(frontmatterSettingsEl, value);
                }));

        // Container for frontmatter settings
        const frontmatterSettingsEl = containerEl.createDiv('nn-sub-settings');

        this.createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterCreatedField.name,
            strings.settings.items.frontmatterCreatedField.desc,
            strings.settings.items.frontmatterCreatedField.placeholder,
            () => this.plugin.settings.frontmatterCreatedField,
            (value) => { this.plugin.settings.frontmatterCreatedField = value || 'created'; }
        );

        this.createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterModifiedField.name,
            strings.settings.items.frontmatterModifiedField.desc,
            strings.settings.items.frontmatterModifiedField.placeholder,
            () => this.plugin.settings.frontmatterModifiedField,
            (value) => { this.plugin.settings.frontmatterModifiedField = value || 'modified'; }
        );

        this.createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterDateFormat.name,
            strings.settings.items.frontmatterDateFormat.desc,
            strings.settings.items.frontmatterDateFormat.placeholder,
            () => this.plugin.settings.frontmatterDateFormat,
            (value) => { this.plugin.settings.frontmatterDateFormat = value || "yyyy-MM-dd'T'HH:mm:ss"; }
        ).addExtraButton(button => button
            .setIcon('help')
            .setTooltip(strings.settings.items.frontmatterDateFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.frontmatterDateFormat.help, 10000);
            }));

        // Debug mobile setting
        new Setting(containerEl)
            .setName('Enable debug logging (mobile only)')
            .setDesc('Creates a debug log file in vault root to help diagnose issues. Currently only works on mobile devices. Requires restart.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMobile)
                .onChange(async (value) => {
                    this.plugin.settings.debugMobile = value;
                    await this.saveAndRefresh(false);
                    // Notify about the change
                    new Notice('Debug logging change will take effect on next restart');
                }));

        // Sponsor section
        new Setting(containerEl)
            .setName(strings.settings.items.supportDevelopment.name)
            .setDesc(strings.settings.items.supportDevelopment.desc)
            .addButton((button) => {
                button
                    .setButtonText(strings.settings.items.supportDevelopment.buttonText)
                    .onClick(() => window.open('https://github.com/sponsors/johansan/'))
                    .buttonEl.addClass('nn-sponsor-button');
            });

        // Set initial visibility
        this.setElementVisibility(dateGroupingEl, shouldShowDateGrouping(this.plugin.settings.defaultFolderSort));
        this.setElementVisibility(previewSettingsEl, this.plugin.settings.showFilePreview);
        this.setElementVisibility(featureImageSettingsEl, this.plugin.settings.showFeatureImage);
        this.setElementVisibility(dateFormatSettingEl, this.plugin.settings.showDate);
        this.setElementVisibility(untaggedSettingEl, this.plugin.settings.showTags);
        this.setElementVisibility(frontmatterSettingsEl, this.plugin.settings.useFrontmatterDates);
    }

    /**
     * Called when settings tab is closed
     * Cleans up any pending debounce timers to prevent memory leaks
     */
    hide(): void {
        // Clean up all pending debounce timers when settings tab is closed
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }
}