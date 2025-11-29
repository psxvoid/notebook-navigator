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

import { App, ButtonComponent, PluginSettingTab, Setting } from 'obsidian';
import NotebookNavigatorPlugin from './main';
import { showNotice } from './utils/noticeUtils';
import { strings } from './i18n';
import { TIMEOUTS } from './types/obsidian-extended';
import { calculateCacheStatistics, CacheStatistics } from './storage/statistics';
import { renderGeneralTab } from './settings/tabs/GeneralTab';
import { renderNavigationPaneTab } from './settings/tabs/NavigationPaneTab';
import { renderFoldersTagsTab } from './settings/tabs/FoldersTagsTab';
import { renderListPaneTab } from './settings/tabs/ListPaneTab';
import { renderNotesTab } from './settings/tabs/NotesTab';
import { renderIconPacksTab } from './settings/tabs/IconPacksTab';
import { renderHotkeysSearchTab } from './settings/tabs/HotkeysSearchTab';
import { renderAdvancedTab } from './settings/tabs/AdvancedTab';
import type { DebouncedTextAreaSettingOptions, SettingsTabContext } from './settings/tabs/SettingsTabContext';
import { runAsyncAction } from './utils/async';

/** Identifiers for different settings tab panes */
type SettingsPaneId = 'general' | 'navigation-pane' | 'folders-tags' | 'list-pane' | 'notes' | 'icon-packs' | 'search-hotkeys' | 'advanced';

/** Definition of a settings pane with its ID, label, and render function */
interface SettingsPaneDefinition {
    id: SettingsPaneId;
    label: string;
    render: (context: SettingsTabContext) => void;
}

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
    // Map of tab IDs to their content elements
    private tabContentMap: Map<SettingsPaneId, HTMLElement> = new Map();
    // Map of tab IDs to their button components
    private tabButtons: Map<SettingsPaneId, ButtonComponent> = new Map();
    // Tracks the most recently active tab during the current session
    private lastActiveTabId: SettingsPaneId | null = null;
    // Registered listeners for show tags visibility changes
    private showTagsListeners: ((visible: boolean) => void)[] = [];
    // Current visibility state of show tags setting
    private currentShowTagsVisible = false;
    // Pending deferred statistics refresh timer
    private pendingStatisticsRefresh: number | null = null;

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
     * Ensures only the most recent change for a given setting runs after the debounce delay.
     */
    private scheduleDebouncedSettingUpdate(name: string, updater: () => Promise<void> | void): void {
        const timerId = `setting-${name}`;
        const existingTimer = this.debounceTimers.get(timerId);
        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }

        const timer = window.setTimeout(() => {
            runAsyncAction(async () => {
                try {
                    await updater();
                } finally {
                    this.debounceTimers.delete(timerId);
                }
            });
        }, TIMEOUTS.DEBOUNCE_SETTINGS);

        this.debounceTimers.set(timerId, timer);
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
        validator?: (value: string) => boolean,
        onAfterUpdate?: () => void
    ): Setting {
        return new Setting(container)
            .setName(name)
            .setDesc(desc)
            .addText(text =>
                text
                    .setPlaceholder(placeholder)
                    .setValue(getValue())
                    .onChange(value => {
                        // Schedule debounced update to ensure async operations complete safely
                        this.scheduleDebouncedSettingUpdate(name, async () => {
                            const isValid = !validator || validator(value);
                            if (!isValid) {
                                return;
                            }
                            setValue(value);
                            await this.plugin.saveSettingsAndUpdate();
                            if (onAfterUpdate) {
                                onAfterUpdate();
                            }
                        });
                    })
            );
    }

    /**
     * Creates a multiline text setting with debounced onChange handler
     * Uses the same debounce timers as single-line inputs
     * @param container - Container element for the setting
     * @param name - Setting display name
     * @param desc - Setting description
     * @param placeholder - Placeholder text for the textarea
     * @param getValue - Function to get current value
     * @param setValue - Function to set new value
     * @param options - Optional configuration for validation and row count
     * @returns The created Setting instance
     */
    private createDebouncedTextAreaSetting(
        container: HTMLElement,
        name: string,
        desc: string,
        placeholder: string,
        getValue: () => string,
        setValue: (value: string) => void,
        options?: DebouncedTextAreaSettingOptions
    ): Setting {
        const rows = options?.rows ?? 4;

        return new Setting(container)
            .setName(name)
            .setDesc(desc)
            .addTextArea(textArea => {
                textArea.setPlaceholder(placeholder);
                textArea.setValue(getValue());
                textArea.inputEl.rows = rows;
                textArea.onChange(value => {
                    // Schedule debounced update to ensure async operations complete safely
                    this.scheduleDebouncedSettingUpdate(name, async () => {
                        const validator = options?.validator;
                        const isValid = !validator || validator(value);
                        if (!isValid) {
                            return;
                        }
                        setValue(value);
                        await this.plugin.saveSettingsAndUpdate();
                        options?.onAfterUpdate?.();
                    });
                });
            });
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
        const iconCount = stats.itemsWithMetadataIcon || 0;
        const colorCount = stats.itemsWithMetadataColor || 0;
        const failedCreatedCount = stats.itemsWithFailedCreatedParse || 0;
        const failedModifiedCount = stats.itemsWithFailedModifiedParse || 0;

        const infoText = `${strings.settings.items.metadataInfo.successfullyParsed}: ${nameCount} ${strings.settings.items.metadataInfo.itemsWithName}, ${createdCount} ${strings.settings.items.metadataInfo.withCreatedDate}, ${modifiedCount} ${strings.settings.items.metadataInfo.withModifiedDate}, ${iconCount} ${strings.settings.items.metadataInfo.withIcon}, ${colorCount} ${strings.settings.items.metadataInfo.withColor}.`;

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
        const stats = calculateCacheStatistics(this.plugin.settings, this.plugin.getUXPreferences().showHiddenItems);
        if (!stats) {
            return;
        }

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
     * Schedule a deferred statistics refresh after content providers finish regeneration.
     * This ensures we reflect fresh metadata once background processing completes.
     */
    private scheduleDeferredStatisticsRefresh(): void {
        if (this.pendingStatisticsRefresh !== null) {
            window.clearTimeout(this.pendingStatisticsRefresh);
        }

        const delay = TIMEOUTS.INTERVAL_STATISTICS * 2;
        this.pendingStatisticsRefresh = window.setTimeout(() => {
            this.pendingStatisticsRefresh = null;
            this.updateStatistics();
        }, delay);
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
        containerEl.addClass('nn-settings-tab-root');

        // Reset state for new render
        this.tabContentMap.clear();
        this.tabButtons.clear();
        this.statsTextEl = null;
        this.metadataInfoEl = null;
        this.showTagsListeners = [];
        this.currentShowTagsVisible = this.plugin.settings.showTags;

        // Define all settings tabs
        const tabs: SettingsPaneDefinition[] = [
            { id: 'general', label: strings.settings.sections.general, render: renderGeneralTab },
            { id: 'navigation-pane', label: strings.settings.sections.navigationPane, render: renderNavigationPaneTab },
            {
                id: 'folders-tags',
                label: strings.settings.sections.foldersAndTags,
                render: renderFoldersTagsTab
            },
            { id: 'list-pane', label: strings.settings.sections.listPane, render: renderListPaneTab },
            { id: 'notes', label: strings.settings.sections.notes, render: renderNotesTab },
            { id: 'icon-packs', label: strings.settings.sections.icons, render: renderIconPacksTab },
            {
                id: 'search-hotkeys',
                label: strings.settings.sections.searchAndHotkeys,
                render: renderHotkeysSearchTab
            },
            { id: 'advanced', label: strings.settings.sections.advanced, render: renderAdvancedTab }
        ];

        // Create tab navigation structure
        const tabsWrapper = containerEl.createDiv('nn-settings-tabs');
        const navEl = tabsWrapper.createDiv('nn-settings-tabs-nav');
        navEl.setAttribute('role', 'tablist');
        const contentWrapper = tabsWrapper.createDiv('nn-settings-tabs-content');

        // Create navigation buttons for each tab
        tabs.forEach(tab => {
            const buttonComponent = new ButtonComponent(navEl);
            buttonComponent.setButtonText(tab.label);
            buttonComponent.removeCta();
            buttonComponent.buttonEl.addClass('nn-settings-tab-button');
            buttonComponent.buttonEl.addClass('clickable-icon');
            buttonComponent.buttonEl.setAttribute('role', 'tab');
            buttonComponent.onClick(() => {
                this.activateTab(tab.id, tabs, contentWrapper);
            });
            this.tabButtons.set(tab.id, buttonComponent);
        });

        // Activate previously open tab if available, otherwise default to first
        const fallbackTabId = tabs[0]?.id ?? null;
        const initialTabId =
            this.lastActiveTabId && tabs.some(tab => tab.id === this.lastActiveTabId) ? this.lastActiveTabId : fallbackTabId;
        if (initialTabId) {
            this.activateTab(initialTabId, tabs, contentWrapper, { focus: true });
        }
    }

    /**
     * Creates a context object for rendering settings tabs
     * Provides access to app, plugin, and utility methods for tab rendering
     */
    private createTabContext(container: HTMLElement): SettingsTabContext {
        return {
            app: this.app,
            plugin: this.plugin,
            containerEl: container,
            createDebouncedTextSetting: (parent, name, desc, placeholder, getValue, setValue, validator, onAfterUpdate) =>
                this.createDebouncedTextSetting(parent, name, desc, placeholder, getValue, setValue, validator, onAfterUpdate),
            createDebouncedTextAreaSetting: (parent, name, desc, placeholder, getValue, setValue, options) =>
                this.createDebouncedTextAreaSetting(parent, name, desc, placeholder, getValue, setValue, options),
            registerMetadataInfoElement: element => {
                this.metadataInfoEl = element;
            },
            registerStatsTextElement: element => {
                this.statsTextEl = element;
            },
            requestStatisticsRefresh: () => {
                this.updateStatistics();
                this.scheduleDeferredStatisticsRefresh();
            },
            ensureStatisticsInterval: () => {
                this.ensureStatisticsInterval();
            },
            registerShowTagsListener: listener => {
                this.showTagsListeners.push(listener);
                listener(this.currentShowTagsVisible);
            },
            notifyShowTagsVisibility: visible => {
                this.currentShowTagsVisible = visible;
                this.showTagsListeners.forEach(callback => callback(visible));
            }
        };
    }

    /**
     * Activates a settings tab by ID
     * Creates tab content if it doesn't exist yet (lazy loading)
     * Updates active state for both content and buttons
     */
    private activateTab(
        id: SettingsPaneId,
        tabs: SettingsPaneDefinition[],
        contentWrapper: HTMLElement,
        options?: { focus?: boolean }
    ): void {
        const definition = tabs.find(tab => tab.id === id);
        if (!definition) {
            return;
        }
        const shouldFocus = options?.focus ?? false;

        // Lazy load tab content on first access
        if (!this.tabContentMap.has(id)) {
            const tabContainer = contentWrapper.createDiv('nn-settings-tab');
            const context = this.createTabContext(tabContainer);
            definition.render(context);
            this.tabContentMap.set(id, tabContainer);
        }

        // Update active state for all tab contents
        this.tabContentMap.forEach((element, tabId) => {
            element.toggleClass('is-active', tabId === id);
        });
        // Update active state for all tab buttons
        this.tabButtons.forEach((buttonComponent, tabId) => {
            const isActive = tabId === id;
            buttonComponent.buttonEl.toggleClass('is-active', isActive);
            buttonComponent.buttonEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
            if (isActive) {
                buttonComponent.setCta();
            } else {
                buttonComponent.removeCta();
            }
        });
        this.lastActiveTabId = id;
        contentWrapper.scrollTop = 0;

        if (shouldFocus) {
            const activeButton = this.tabButtons.get(id);
            activeButton?.buttonEl.focus();
        }
    }

    private ensureStatisticsInterval(): void {
        // Don't create duplicate intervals
        if (this.statsUpdateInterval !== null) {
            return;
        }

        // Update immediately
        this.updateStatistics();
        // Schedule periodic updates
        this.statsUpdateInterval = window.setInterval(() => {
            this.updateStatistics();
        }, TIMEOUTS.INTERVAL_STATISTICS);
        this.plugin.registerInterval(this.statsUpdateInterval);
    }

    /**
     * Export failed metadata parsing report to markdown file
     */
    private async exportFailedMetadataReport(stats: CacheStatistics): Promise<void> {
        if (!stats.failedCreatedFiles || !stats.failedModifiedFiles) return;

        // Generate timestamp for filename
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const readableDate = now.toLocaleString();

        // Generate filename with timestamp
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
            showNotice(strings.settings.metadataReport.exportSuccess.replace('{filename}', filename), { variant: 'success' });
        } catch (error) {
            console.error('Failed to export metadata report:', error);
            showNotice(strings.settings.metadataReport.exportFailed, { variant: 'warning' });
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

        if (this.pendingStatisticsRefresh !== null) {
            window.clearTimeout(this.pendingStatisticsRefresh);
            this.pendingStatisticsRefresh = null;
        }

        // Clear references and state
        this.statsTextEl = null;
        this.metadataInfoEl = null;
        this.tabContentMap.clear();
        this.tabButtons.clear();
        this.showTagsListeners = [];
        this.containerEl.removeClass('nn-settings-tab-root');
    }
}

export function updateFeatureImageSize(newSize: number) {
    // Review: Refactoring: maybe there is a better way
    // eslint-disable-next-line obsidianmd/no-static-styles-assignment
    document.body.style.setProperty(
        '--nn-feature-image-max-size',
        `${newSize}px`);
}

export type {
    NotebookNavigatorSettings,
    SortOption,
    ItemScope,
    MultiSelectModifier,
    ListPaneTitleOption,
    AlphabeticalDateMode
} from './settings/types';
export { DEFAULT_SETTINGS } from './settings/defaultSettings';
