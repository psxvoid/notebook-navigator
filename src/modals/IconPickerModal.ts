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

/**
 * Enhanced icon picker modal that supports multiple icon providers
 * Features tabs for different providers (Lucide, Emoji, etc.)
 */
export class IconPickerModal extends Modal {
    private currentProvider: string = 'lucide';
    private gridColumns: number = 5;
    private iconService = getIconService();
    private itemPath: string;
    private itemType: typeof ItemType.FOLDER | typeof ItemType.TAG;
    private metadataService: MetadataService;
    /** Callback function invoked when an icon is selected */
    public onChooseIcon: (iconId: string | null) => void;
    private resultsContainer: HTMLDivElement;
    private searchDebounceTimer: NodeJS.Timeout | null = null;
    private searchInput: HTMLInputElement;

    private tabContainer: HTMLDivElement;

    constructor(
        app: App,
        metadataService: MetadataService,
        itemPath: string,
        itemType: typeof ItemType.FOLDER | typeof ItemType.TAG = ItemType.FOLDER
    ) {
        super(app);
        this.metadataService = metadataService;
        this.itemPath = itemPath;
        this.itemType = itemType;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nn-icon-picker-modal');

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
        this.searchInput.addEventListener('input', () => {
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            this.searchDebounceTimer = setTimeout(() => {
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

            tab.addEventListener('click', () => {
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
            // Show recently used icons for both providers
            const recentIcons = this.iconService
                .getRecentIcons()
                .filter(iconId => {
                    const parsed = this.iconService.parseIconId(iconId);
                    return parsed.provider === this.currentProvider;
                })
                .slice(0, 20);

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

                // Limit to first 50 results
                results.slice(0, 50).forEach(iconDef => {
                    if (provider) {
                        this.createIconItem(iconDef, grid, provider);
                    }
                });

                if (results.length > 50) {
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
        iconItem.addEventListener('click', () => {
            this.selectIcon(fullIconId);
        });

        // Make focusable
        iconItem.setAttribute('tabindex', '0');
    }

    private async selectIcon(iconId: string) {
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
        // Similar to original but simplified
        this.contentEl.addEventListener('keydown', e => {
            const iconItems = Array.from(this.resultsContainer.querySelectorAll('.nn-icon-item')) as HTMLElement[];
            if (iconItems.length === 0) return;

            const currentFocused = document.activeElement as HTMLElement;
            const isInGrid = currentFocused?.classList.contains('nn-icon-item');

            if (e.key === 'Tab' && !isInGrid) {
                e.preventDefault();
                const firstIcon = iconItems[0];
                if (firstIcon) {
                    firstIcon.focus();
                }
                return;
            }

            if (isInGrid) {
                const currentIndex = iconItems.indexOf(currentFocused);
                let newIndex = currentIndex;

                switch (e.key) {
                    case 'Tab':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.searchInput.focus();
                        }
                        break;

                    case 'ArrowLeft':
                        e.preventDefault();
                        if (currentIndex % this.gridColumns > 0) {
                            newIndex = currentIndex - 1;
                        }
                        break;

                    case 'ArrowRight':
                        e.preventDefault();
                        if (currentIndex % this.gridColumns < this.gridColumns - 1 && currentIndex < iconItems.length - 1) {
                            newIndex = currentIndex + 1;
                        }
                        break;

                    case 'ArrowUp':
                        e.preventDefault();
                        if (currentIndex >= this.gridColumns) {
                            newIndex = currentIndex - this.gridColumns;
                        }
                        break;

                    case 'ArrowDown':
                        e.preventDefault();
                        if (currentIndex + this.gridColumns < iconItems.length) {
                            newIndex = currentIndex + this.gridColumns;
                        }
                        break;

                    case 'Enter':
                    case ' ': {
                        e.preventDefault();
                        const iconId = currentFocused.getAttribute('data-icon-id');
                        if (iconId) {
                            this.selectIcon(iconId);
                        }
                        break;
                    }
                }

                if (newIndex !== currentIndex && newIndex >= 0 && newIndex < iconItems.length) {
                    iconItems[newIndex].focus();
                    this.ensureIconVisible(iconItems[newIndex]);
                }
            }
        });
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
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }

        const { contentEl } = this;
        contentEl.empty();
    }
}
