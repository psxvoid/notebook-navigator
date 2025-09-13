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

import { App, Modal } from 'obsidian';
import * as emojilib from 'emojilib';
import { strings } from '../i18n';
import { getIconService, IconDefinition, IconProvider } from '../services/icons';
import { MetadataService } from '../services/MetadataService';
import { ItemType } from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { ISettingsProvider } from '../interfaces/ISettingsProvider';

// Constants
const GRID_COLUMNS = 5;
const MAX_SEARCH_RESULTS = 50;
const MAX_RECENT_PER_PROVIDER = 15;

/**
 * Enhanced icon picker modal that supports multiple icon providers
 * Features tabs for different providers (Lucide, Emoji, etc.)
 */
export class IconPickerModal extends Modal {
    private currentProvider: string = 'lucide';
    private iconService = getIconService();
    private itemPath: string;
    private itemType: typeof ItemType.FOLDER | typeof ItemType.TAG;
    private metadataService: MetadataService;
    private settingsProvider: ISettingsProvider;
    /** Callback function invoked when an icon is selected */
    public onChooseIcon: (iconId: string | null) => void;
    private resultsContainer: HTMLDivElement;
    private searchDebounceTimer: number | null = null;
    private searchInput: HTMLInputElement;

    private tabContainer: HTMLDivElement;
    private domDisposers: (() => void)[] = [];

    private addDomListener(
        el: HTMLElement,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        el.addEventListener(type, handler, options);
        this.domDisposers.push(() => el.removeEventListener(type, handler, options));
    }

    constructor(
        app: App,
        metadataService: MetadataService,
        itemPath: string,
        itemType: typeof ItemType.FOLDER | typeof ItemType.TAG = ItemType.FOLDER
    ) {
        super(app);
        this.metadataService = metadataService;
        this.settingsProvider = metadataService.getSettingsProvider();
        this.itemPath = itemPath;
        this.itemType = itemType;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nn-icon-picker-modal');

        // Header showing the folder/tag name
        const header = contentEl.createDiv('nn-icon-picker-header');
        const headerText = this.itemType === ItemType.TAG ? `#${this.itemPath}` : this.itemPath.split('/').pop() || this.itemPath;
        header.createEl('h3', { text: headerText });

        // Create tabs for providers
        this.createProviderTabs();

        // Create search input
        const searchContainer = contentEl.createDiv('nn-icon-search-container');
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: strings.modals.iconPicker.searchPlaceholder,
            cls: 'nn-icon-search-input'
        });

        // Create results container
        this.resultsContainer = contentEl.createDiv('nn-icon-results-container');

        // Set up search functionality with debouncing
        this.addDomListener(this.searchInput, 'input', () => {
            if (this.searchDebounceTimer) {
                window.clearTimeout(this.searchDebounceTimer);
            }
            this.searchDebounceTimer = window.setTimeout(() => {
                this.updateResults();
            }, TIMEOUTS.DEBOUNCE_KEYBOARD);
        });

        // Set up keyboard navigation
        this.setupKeyboardNavigation();

        // Focus search input
        this.searchInput.focus();

        // Show initial results
        this.updateResults();
    }

    private createProviderTabs() {
        this.tabContainer = this.contentEl.createDiv('nn-icon-provider-tabs');

        const providers = this.iconService.getAllProviders();

        providers.forEach((provider, index) => {
            const tab = this.tabContainer.createDiv({
                cls: 'nn-icon-provider-tab',
                text: provider.name
            });

            if (index === 0 || provider.id === this.currentProvider) {
                tab.addClass('nn-active');
                this.currentProvider = provider.id;
            }

            this.addDomListener(tab, 'click', () => {
                // Update active tab
                this.tabContainer.querySelectorAll('.nn-icon-provider-tab').forEach(t => t.removeClass('nn-active'));
                tab.addClass('nn-active');

                // Update current provider and refresh results
                this.currentProvider = provider.id;
                this.updateResults();
            });
        });
    }

    private updateResults() {
        this.resultsContainer.empty();

        const searchTerm = this.searchInput.value.toLowerCase().trim();

        if (searchTerm === '') {
            // Show recently used icons for the current provider
            const settings = this.settingsProvider.settings;
            const recentIcons = settings.recentIcons?.[this.currentProvider] || [];

            if (recentIcons.length > 0) {
                const header = this.resultsContainer.createDiv('nn-icon-section-header');
                header.setText(strings.modals.iconPicker.recentlyUsedHeader);

                const grid = this.resultsContainer.createDiv('nn-icon-grid');
                recentIcons.forEach(iconId => {
                    const parsed = this.iconService.parseIconId(iconId);
                    const provider = this.iconService.getProvider(parsed.provider);
                    if (provider) {
                        if (this.currentProvider === 'lucide') {
                            const icons = provider.getAll();
                            const iconDef = icons.find(i => i.id === parsed.identifier);
                            if (iconDef) {
                                this.createIconItem(iconDef, grid, provider);
                            }
                        } else if (this.currentProvider === 'emoji') {
                            // For emojis, create icon definition on the fly
                            // Try to find the emoji name from emojilib
                            let displayName = '';
                            for (const [emoji, keywords] of Object.entries(emojilib)) {
                                if (emoji === parsed.identifier && Array.isArray(keywords)) {
                                    displayName = keywords[0] || '';
                                    break;
                                }
                            }

                            const iconDef = {
                                id: parsed.identifier,
                                displayName: displayName,
                                preview: parsed.identifier
                            };
                            this.createIconItem(iconDef, grid, provider);
                        }
                    }
                });
            } else {
                if (this.currentProvider === 'emoji') {
                    // Show instructions for emoji tab when no recent emojis
                    const emptyMessage = this.resultsContainer.createDiv('nn-icon-empty-message');
                    emptyMessage.setText(strings.modals.iconPicker.emojiInstructions);
                } else {
                    this.showEmptyState();
                }
            }
        } else {
            // Search within current provider
            const results = this.iconService.search(searchTerm, this.currentProvider);

            if (results.length > 0) {
                const grid = this.resultsContainer.createDiv('nn-icon-grid');
                const provider = this.iconService.getProvider(this.currentProvider);

                // Limit to first MAX_SEARCH_RESULTS results
                results.slice(0, MAX_SEARCH_RESULTS).forEach(iconDef => {
                    if (provider) {
                        this.createIconItem(iconDef, grid, provider);
                    }
                });

                if (results.length > MAX_SEARCH_RESULTS) {
                    const moreMessage = this.resultsContainer.createDiv('nn-icon-more-message');
                    moreMessage.setText(strings.modals.iconPicker.showingResultsInfo.replace('{count}', results.length.toString()));
                }
            } else {
                // Show empty state for all providers
                this.showEmptyState(true);
            }
        }
    }

    private showEmptyState(isSearch: boolean = false) {
        const emptyMessage = this.resultsContainer.createDiv('nn-icon-empty-message');
        emptyMessage.setText(isSearch ? strings.modals.iconPicker.emptyStateNoResults : strings.modals.iconPicker.emptyStateSearch);
    }

    private createIconItem(iconDef: IconDefinition, container: HTMLElement, provider: IconProvider) {
        const iconItem = container.createDiv('nn-icon-item');
        const fullIconId = this.iconService.formatIconId(provider.id, iconDef.id);
        iconItem.setAttribute('data-icon-id', fullIconId);

        // Icon preview
        const iconPreview = iconItem.createDiv('nn-icon-item-preview');
        provider.render(iconPreview, iconDef.id);

        // For emojis, also show the emoji as preview text if available
        if (provider.id === 'emoji' && iconDef.preview) {
            iconPreview.addClass('nn-emoji-preview');
        }

        // Icon name
        const iconName = iconItem.createDiv('nn-icon-item-name');
        iconName.setText(iconDef.displayName);

        // Click handler
        this.addDomListener(iconItem, 'click', () => {
            this.selectIcon(fullIconId);
        });

        // Make focusable
        iconItem.setAttribute('tabindex', '0');
    }

    /**
     * Save icon to recent icons (per provider)
     */
    private async saveToRecentIcons(iconId: string) {
        const parsed = this.iconService.parseIconId(iconId);
        const providerId = parsed.provider;

        const settings = this.settingsProvider.settings;
        if (!settings.recentIcons) {
            settings.recentIcons = {};
        }
        if (!settings.recentIcons[providerId]) {
            settings.recentIcons[providerId] = [];
        }

        const providerIcons = settings.recentIcons[providerId];
        const index = providerIcons.indexOf(iconId);

        // Remove if already exists
        if (index > -1) {
            providerIcons.splice(index, 1);
        }

        // Add to front
        providerIcons.unshift(iconId);

        // Limit to MAX_RECENT_PER_PROVIDER per provider
        if (providerIcons.length > MAX_RECENT_PER_PROVIDER) {
            settings.recentIcons[providerId] = providerIcons.slice(0, MAX_RECENT_PER_PROVIDER);
        }

        await this.settingsProvider.saveSettingsAndUpdate();
    }

    private async selectIcon(iconId: string) {
        // Save to recent icons
        await this.saveToRecentIcons(iconId);

        // Set the icon based on item type
        if (this.itemType === ItemType.TAG) {
            await this.metadataService.setTagIcon(this.itemPath, iconId);
        } else {
            await this.metadataService.setFolderIcon(this.itemPath, iconId);
        }

        // Notify callback and close
        this.onChooseIcon?.(iconId);
        this.close();
    }

    private setupKeyboardNavigation() {
        // Shift+Tab -> focus search input
        this.scope.register(['Shift'], 'Tab', evt => {
            evt.preventDefault();
            this.searchInput.focus();
        });

        // Tab -> focus first icon if not in grid
        this.scope.register([], 'Tab', evt => {
            const currentFocused = document.activeElement as HTMLElement;
            const isInGrid = currentFocused?.classList.contains('nn-icon-item');

            if (!isInGrid) {
                evt.preventDefault();
                const firstIcon = this.resultsContainer.querySelector<HTMLElement>('.nn-icon-item');
                if (firstIcon) firstIcon.focus();
            }
        });

        // Arrow keys and Enter for grid navigation
        this.scope.register([], 'ArrowLeft', evt => this.handleArrowKey(evt, -1, 0));
        this.scope.register([], 'ArrowRight', evt => this.handleArrowKey(evt, 1, 0));
        this.scope.register([], 'ArrowUp', evt => this.handleArrowKey(evt, 0, -1));
        this.scope.register([], 'ArrowDown', evt => this.handleArrowKey(evt, 0, 1));

        this.scope.register([], 'Enter', evt => {
            const currentFocused = document.activeElement as HTMLElement;
            if (currentFocused?.classList.contains('nn-icon-item')) {
                evt.preventDefault();
                const iconId = currentFocused.getAttribute('data-icon-id');
                if (iconId) this.selectIcon(iconId);
            }
        });
    }

    private handleArrowKey(evt: KeyboardEvent, deltaX: number, deltaY: number) {
        const currentFocused = document.activeElement as HTMLElement;
        if (!currentFocused?.classList.contains('nn-icon-item')) return;

        evt.preventDefault();
        const iconItems = Array.from(this.resultsContainer.querySelectorAll<HTMLElement>('.nn-icon-item'));
        const currentIndex = iconItems.indexOf(currentFocused);

        let newIndex = currentIndex;
        if (deltaX !== 0) {
            newIndex = currentIndex + deltaX;
        } else {
            newIndex = currentIndex + deltaY * GRID_COLUMNS;
        }

        if (newIndex >= 0 && newIndex < iconItems.length) {
            iconItems[newIndex].focus();
            this.ensureIconVisible(iconItems[newIndex]);
        }
    }

    private ensureIconVisible(iconElement: HTMLElement) {
        const container = this.resultsContainer;
        const containerRect = container.getBoundingClientRect();
        const elementRect = iconElement.getBoundingClientRect();

        const padding = 8;

        if (elementRect.top < containerRect.top + padding) {
            container.scrollTop -= containerRect.top - elementRect.top + padding;
        }

        if (elementRect.bottom > containerRect.bottom - padding) {
            container.scrollTop += elementRect.bottom - containerRect.bottom + padding;
        }
    }

    onClose() {
        if (this.searchDebounceTimer) {
            window.clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }

        const { contentEl } = this;
        contentEl.empty();
        // Cleanup DOM listeners
        if (this.domDisposers.length) {
            this.domDisposers.forEach(dispose => {
                try {
                    dispose();
                } catch (e) {
                    console.error('Error disposing icon picker listener:', e);
                }
            });
            this.domDisposers = [];
        }
    }
}
