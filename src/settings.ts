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
import { FileVisibility, FILE_VISIBILITY } from './utils/fileTypeUtils';

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
 * Collapse button behavior options
 */
export type CollapseButtonBehavior = 
    | 'all'           // Collapse/expand both folders and tags
    | 'folders-only'  // Collapse/expand only folders
    | 'tags-only';    // Collapse/expand only tags

/**
 * Plugin settings interface defining all configurable options
 * These settings control the appearance and behavior of the navigator
 */
export interface NotebookNavigatorSettings {
    // Top level settings (no category)
    autoRevealActiveFile: boolean;
    showTooltips: boolean;
    fileVisibility: FileVisibility;
    excludedFolders: string;
    excludedFiles: string;
    // Navigation pane
    autoSelectFirstFileOnFocusChange: boolean;
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
    showUntagged: boolean;
    // List pane
    defaultFolderSort: SortOption;
    groupByDate: boolean;
    showNotesFromSubfolders: boolean;
    showParentFolderNames: boolean;
    dateFormat: string;
    timeFormat: string;
    // Notes
    frontmatterNameField: string;
    frontmatterCreatedField: string;
    frontmatterModifiedField: string;
    frontmatterDateFormat: string;
    fileNameRows: number;
    showDate: boolean;
    showFilePreview: boolean;
    skipHeadingsInPreview: boolean;
    skipNonTextInPreview: boolean;
    previewRows: number;
    showFeatureImage: boolean;
    featureImageProperties: string[];
    useFrontmatterDates: boolean;
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
}

/**
 * Default settings for the plugin
 * Used when plugin is first installed or settings are reset
 */
export const DEFAULT_SETTINGS: NotebookNavigatorSettings = {
    // Top level settings (no category)
    autoRevealActiveFile: true,
    showTooltips: true,
    fileVisibility: FILE_VISIBILITY.MARKDOWN,
    excludedFolders: '',
    excludedFiles: '',
    // Navigation pane
    autoSelectFirstFileOnFocusChange: true,
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
    showUntagged: false,
    // List pane
    defaultFolderSort: 'modified-desc',
    groupByDate: true,
    showNotesFromSubfolders: true,
    showParentFolderNames: true,
    dateFormat: 'MMM d, yyyy',
    timeFormat: 'h:mm a',
    // Notes
    frontmatterNameField: '',
    frontmatterCreatedField: 'created',
    frontmatterModifiedField: 'modified',
    frontmatterDateFormat: "yyyy-MM-dd'T'HH:mm:ss",
    fileNameRows: 1,
    showDate: true,
    showFilePreview: true,
    skipHeadingsInPreview: false,
    skipNonTextInPreview: true,
    previewRows: 1,
    showFeatureImage: true,
    featureImageProperties: ['featureResized', 'feature'],
    useFrontmatterDates: false,
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
                            
                            // Add this line to trigger the refresh:
                            this.plugin.onSettingsUpdate();
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
     * Helper to save settings
     * Settings changes are automatically propagated through context providers
     */
    private async saveAndRefresh(): Promise<void> {
        await this.plugin.saveSettings();
        // Now, explicitly tell the plugin UI to update itself.
        this.plugin.onSettingsUpdate();
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
            .setName(strings.settings.items.autoRevealActiveNote.name)
            .setDesc(strings.settings.items.autoRevealActiveNote.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoRevealActiveFile)
                .onChange(async (value) => {
                    this.plugin.settings.autoRevealActiveFile = value;
                    await this.saveAndRefresh();
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.showTooltips.name)
            .setDesc(strings.settings.items.showTooltips.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showTooltips)
                .onChange(async (value) => {
                    this.plugin.settings.showTooltips = value;
                    await this.saveAndRefresh();
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.fileVisibility.name)
            .setDesc(strings.settings.items.fileVisibility.desc)
            .addDropdown(dropdown => dropdown
                .addOption(FILE_VISIBILITY.MARKDOWN, strings.settings.items.fileVisibility.options.markdownOnly)
                .addOption(FILE_VISIBILITY.SUPPORTED, strings.settings.items.fileVisibility.options.supported)
                .addOption(FILE_VISIBILITY.ALL, strings.settings.items.fileVisibility.options.all)
                .setValue(this.plugin.settings.fileVisibility)
                .onChange(async (value: FileVisibility) => {
                    this.plugin.settings.fileVisibility = value;
                    await this.saveAndRefresh();
                }));

        this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.excludedFolders.name,
            strings.settings.items.excludedFolders.desc,
            strings.settings.items.excludedFolders.placeholder,
            () => this.plugin.settings.excludedFolders,
            (value) => { this.plugin.settings.excludedFolders = value; }
        );

        this.createDebouncedTextSetting(
            containerEl,
            strings.settings.items.excludedNotes.name,
            strings.settings.items.excludedNotes.desc,
            strings.settings.items.excludedNotes.placeholder,
            () => this.plugin.settings.excludedFiles,
            (value) => { this.plugin.settings.excludedFiles = value; }
        );

        // Section 1: Navigation pane
        new Setting(containerEl)
            .setName(strings.settings.sections.navigationPane)
            .setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.autoSelectFirstFileOnFocusChange.name)
            .setDesc(strings.settings.items.autoSelectFirstFileOnFocusChange.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSelectFirstFileOnFocusChange)
                .onChange(async (value) => {
                    this.plugin.settings.autoSelectFirstFileOnFocusChange = value;
                    await this.saveAndRefresh();
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.showNoteCount.name)
            .setDesc(strings.settings.items.showNoteCount.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNoteCount)
                .onChange(async (value) => {
                    this.plugin.settings.showNoteCount = value;
                    await this.saveAndRefresh();
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.showIcons.name)
            .setDesc(strings.settings.items.showIcons.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showIcons)
                .onChange(async (value) => {
                    this.plugin.settings.showIcons = value;
                    await this.saveAndRefresh();
                }));

        new Setting(containerEl)
            .setName(strings.settings.items.collapseButtonBehavior.name)
            .setDesc(strings.settings.items.collapseButtonBehavior.desc)
            .addDropdown(dropdown => dropdown
                .addOption('all', strings.settings.items.collapseButtonBehavior.options.all)
                .addOption('folders-only', strings.settings.items.collapseButtonBehavior.options.foldersOnly)
                .addOption('tags-only', strings.settings.items.collapseButtonBehavior.options.tagsOnly)
                .setValue(this.plugin.settings.collapseButtonBehavior)
                .onChange(async (value: CollapseButtonBehavior) => {
                    this.plugin.settings.collapseButtonBehavior = value;
                    await this.saveAndRefresh();
                }));

        // Section 2: Folders
        new Setting(containerEl)
            .setName(strings.settings.sections.folders)
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

        const enableFolderNotesSetting = new Setting(containerEl)
            .setName(strings.settings.items.enableFolderNotes.name)
            .setDesc(strings.settings.items.enableFolderNotes.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFolderNotes)
                .onChange(async (value) => {
                    this.plugin.settings.enableFolderNotes = value;
                    await this.saveAndRefresh();
                    // Update folder notes sub-settings visibility
                    this.setElementVisibility(folderNotesSettingsEl, value);
                }));

        // Container for folder notes sub-settings
        const folderNotesSettingsEl = containerEl.createDiv('nn-sub-settings');

        this.createDebouncedTextSetting(
            folderNotesSettingsEl,
            strings.settings.items.folderNoteName.name,
            strings.settings.items.folderNoteName.desc,
            strings.settings.items.folderNoteName.placeholder,
            () => this.plugin.settings.folderNoteName,
            (value) => { this.plugin.settings.folderNoteName = value; }
        );

        new Setting(folderNotesSettingsEl)
            .setName(strings.settings.items.hideFolderNoteInList.name)
            .setDesc(strings.settings.items.hideFolderNoteInList.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideFolderNoteInList)
                .onChange(async (value) => {
                    this.plugin.settings.hideFolderNoteInList = value;
                    await this.saveAndRefresh();
                }));

        // Section 3: Tags
        new Setting(containerEl)
            .setName(strings.settings.sections.tags)
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
        const untaggedSettingEl = containerEl.createDiv('nn-sub-settings');

        new Setting(untaggedSettingEl)
            .setName(strings.settings.items.showUntagged.name)
            .setDesc(strings.settings.items.showUntagged.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showUntagged)
                .onChange(async (value) => {
                    this.plugin.settings.showUntagged = value;
                    await this.saveAndRefresh();
                }));

        // Section 4: List pane
        new Setting(containerEl)
            .setName(strings.settings.sections.listPane)
            .setHeading();

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
                }));

        new Setting(containerEl)
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
            .setName(strings.settings.items.showParentFolderNames.name)
            .setDesc(strings.settings.items.showParentFolderNames.desc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showParentFolderNames)
                .onChange(async (value) => {
                    this.plugin.settings.showParentFolderNames = value;
                    await this.saveAndRefresh();
                }));

        // Set initial visibility
        this.setElementVisibility(subfolderNamesEl, this.plugin.settings.showNotesFromSubfolders);

        this.createDebouncedTextSetting(
            containerEl,
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
            containerEl,
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

        // Section 5: Notes
        new Setting(containerEl)
            .setName(strings.settings.sections.notes)
            .setHeading();

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
            strings.settings.items.frontmatterNameField.name,
            strings.settings.items.frontmatterNameField.desc,
            strings.settings.items.frontmatterNameField.placeholder,
            () => this.plugin.settings.frontmatterNameField,
            (value) => { this.plugin.settings.frontmatterNameField = value || ''; }
        );

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

        const featurePropertiesSetting = this.createDebouncedTextSetting(
            featureImageSettingsEl,
            strings.settings.items.featureImageProperties.name,
            strings.settings.items.featureImageProperties.desc,
            strings.settings.items.featureImageProperties.placeholder,
            () => this.plugin.settings.featureImageProperties.join(', '),
            (value) => { 
                // Parse comma-separated values into array
                this.plugin.settings.featureImageProperties = value
                    .split(',')
                    .map(prop => prop.trim())
                    .filter(prop => prop.length > 0);
            }
        );
        
        // Add informational text about embed fallback
        featurePropertiesSetting.descEl.createEl('div', {
            text: strings.settings.items.featureImageProperties.embedFallback,
            cls: 'nn-setting-info'
        });


        // Section 6: Advanced
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
                    await this.saveAndRefresh();
                }));


        // Sponsor section
        // Support development section with both buttons
        const supportSetting = new Setting(containerEl)
            .setName(strings.settings.items.supportDevelopment.name)
            .setDesc(strings.settings.items.supportDevelopment.desc);
        
        // Buy me a coffee button
        supportSetting.addButton((button) => {
            button
                .setButtonText('☕️ Buy me a coffee')
                .onClick(() => window.open('https://buymeacoffee.com/johansan'))
                .buttonEl.addClass('nn-support-button');
        });
        
        // GitHub sponsor button
        supportSetting.addButton((button) => {
            button
                .setButtonText(strings.settings.items.supportDevelopment.buttonText)
                .onClick(() => window.open('https://github.com/sponsors/johansan/'))
                .buttonEl.addClass('nn-support-button');
        });

        // Set initial visibility
        this.setElementVisibility(previewSettingsEl, this.plugin.settings.showFilePreview);
        this.setElementVisibility(featureImageSettingsEl, this.plugin.settings.showFeatureImage);
        this.setElementVisibility(untaggedSettingEl, this.plugin.settings.showTags);
        this.setElementVisibility(frontmatterSettingsEl, this.plugin.settings.useFrontmatterDates);
        this.setElementVisibility(folderNotesSettingsEl, this.plugin.settings.enableFolderNotes);
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