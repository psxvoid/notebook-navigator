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

import { App, Modal, setIcon } from 'obsidian';
import { strings } from '../i18n';
import { ItemType } from '../types';
import { ISettingsProvider } from '../interfaces/ISettingsProvider';

/**
 * Color palette for folder colors
 * Carefully selected to work well in both light and dark themes
 */
const COLOR_PALETTE = [
    { name: strings.modals.colorPicker.colors.red, value: '#ef4444' },
    { name: strings.modals.colorPicker.colors.orange, value: '#f97316' },
    { name: strings.modals.colorPicker.colors.amber, value: '#f59e0b' },
    { name: strings.modals.colorPicker.colors.yellow, value: '#eab308' },
    { name: strings.modals.colorPicker.colors.lime, value: '#84cc16' },
    { name: strings.modals.colorPicker.colors.green, value: '#22c55e' },
    { name: strings.modals.colorPicker.colors.emerald, value: '#10b981' },
    { name: strings.modals.colorPicker.colors.teal, value: '#14b8a6' },
    { name: strings.modals.colorPicker.colors.cyan, value: '#06b6d4' },
    { name: strings.modals.colorPicker.colors.sky, value: '#0ea5e9' },
    { name: strings.modals.colorPicker.colors.blue, value: '#3b82f6' },
    { name: strings.modals.colorPicker.colors.indigo, value: '#6366f1' },
    { name: strings.modals.colorPicker.colors.violet, value: '#8b5cf6' },
    { name: strings.modals.colorPicker.colors.purple, value: '#a855f7' },
    { name: strings.modals.colorPicker.colors.fuchsia, value: '#d946ef' },
    { name: strings.modals.colorPicker.colors.pink, value: '#ec4899' },
    { name: strings.modals.colorPicker.colors.rose, value: '#f43f5e' },
    { name: strings.modals.colorPicker.colors.gray, value: '#6b7280' },
    { name: strings.modals.colorPicker.colors.slate, value: '#64748b' },
    { name: strings.modals.colorPicker.colors.stone, value: '#78716c' }
];

const MAX_RECENT_COLORS = 10;
const DEFAULT_COLOR = '#3b82f6';

type RGBChannel = 'r' | 'g' | 'b';

type ColorPickerMode = 'foreground' | 'background';

/**
 * Extended metadata service interface for color operations
 */
interface ColorMetadataService {
    setTagColor(path: string, color: string): Promise<void>;
    setFolderColor(path: string, color: string): Promise<void>;
    setFileColor(path: string, color: string): Promise<void>;
    removeTagColor(path: string): Promise<void>;
    removeFolderColor(path: string): Promise<void>;
    removeFileColor(path: string): Promise<void>;
    setTagBackgroundColor(path: string, color: string): Promise<void>;
    setFolderBackgroundColor(path: string, color: string): Promise<void>;
    removeTagBackgroundColor(path: string): Promise<void>;
    removeFolderBackgroundColor(path: string): Promise<void>;
    getSettingsProvider(): ISettingsProvider;
}

/**
 * Color picker modal with advanced features
 * - Hex input field
 * - RGB sliders
 * - Recently used colors
 * - Preset color palette
 * - Real-time preview
 */
export class ColorPickerModal extends Modal {
    private itemPath: string;
    private itemType: typeof ItemType.FOLDER | typeof ItemType.TAG | typeof ItemType.FILE;
    private metadataService: ColorMetadataService;
    private settingsProvider: ISettingsProvider;
    private currentColor: string | null = null;
    private selectedColor: string = DEFAULT_COLOR;
    private isBackgroundMode: boolean;
    private hexInput: HTMLInputElement;
    private previewCurrent: HTMLDivElement;
    private previewNew: HTMLDivElement;
    private rgbSliders: { r: HTMLInputElement; g: HTMLInputElement; b: HTMLInputElement };
    private rgbValues: { r: HTMLSpanElement; g: HTMLSpanElement; b: HTMLSpanElement };
    private recentColorsContainer: HTMLDivElement;
    private presetColorsContainer: HTMLDivElement;
    private isUpdating = false;
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

    /** Callback function invoked when a color is selected */
    public onChooseColor: (color: string | null) => void;

    /**
     * Creates a new color picker modal
     * @param app - The Obsidian app instance
     * @param metadataService - The metadata service for managing folder/tag colors
     * @param itemPath - Path of the folder or tag to set color for
     * @param itemType - Whether this is for a folder or tag
     */
    constructor(
        app: App,
        metadataService: ColorMetadataService,
        itemPath: string,
        itemType: typeof ItemType.FOLDER | typeof ItemType.TAG | typeof ItemType.FILE = ItemType.FOLDER,
        colorMode: ColorPickerMode = 'foreground'
    ) {
        super(app);
        this.metadataService = metadataService;
        this.itemPath = itemPath;
        this.itemType = itemType;
        this.isBackgroundMode = itemType !== ItemType.FILE && colorMode === 'background';

        // Access settings through the service
        this.settingsProvider = metadataService.getSettingsProvider();

        // Get current color if exists
        const settings = this.settingsProvider.settings;
        const currentColors = this.isBackgroundMode
            ? itemType === ItemType.TAG
                ? settings.tagBackgroundColors
                : settings.folderBackgroundColors
            : itemType === ItemType.TAG
              ? settings.tagColors
              : itemType === ItemType.FILE
                ? settings.fileColors
                : settings.folderColors;
        const lookupKey = itemType === ItemType.TAG ? itemPath.toLowerCase() : itemPath;
        const initialColor = currentColors?.[lookupKey];
        if (initialColor) {
            this.currentColor = initialColor;
            this.selectedColor = initialColor;
        } else {
            // Default starting color
            this.selectedColor = DEFAULT_COLOR;
        }
    }

    /**
     * Called when the modal is opened
     */
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nn-color-picker-modal');

        // Header showing the folder/tag name
        const header = contentEl.createDiv('nn-color-picker-header');
        const headerText = this.isTag() ? `#${this.itemPath}` : this.itemPath.split('/').pop() || this.itemPath;
        header.createEl('h3', { text: headerText });

        // Two-column layout
        const mainContent = contentEl.createDiv('nn-color-picker-content');

        // Left column
        const leftColumn = mainContent.createDiv('nn-color-picker-left');

        // Color preview section
        const previewSection = leftColumn.createDiv('nn-color-preview-section');
        const previewContainer = previewSection.createDiv('nn-color-preview-container');

        const currentSection = previewContainer.createDiv('nn-preview-current');
        currentSection.createEl('span', { text: strings.modals.colorPicker.currentColor, cls: 'nn-preview-label' });
        this.previewCurrent = currentSection.createDiv('nn-preview-color');
        if (this.currentColor) {
            this.previewCurrent.style.backgroundColor = this.currentColor;
        } else {
            this.previewCurrent.addClass('nn-no-color');
        }

        const arrow = previewContainer.createDiv('nn-preview-arrow');
        setIcon(arrow, 'lucide-arrow-right');

        const newSection = previewContainer.createDiv('nn-preview-new');
        newSection.createEl('span', { text: strings.modals.colorPicker.newColor, cls: 'nn-preview-label' });
        this.previewNew = newSection.createDiv('nn-preview-color');
        this.previewNew.style.backgroundColor = this.selectedColor;

        // Preset colors section
        const presetSection = leftColumn.createDiv('nn-preset-section');
        presetSection.createEl('div', { text: strings.modals.colorPicker.presetColors, cls: 'nn-section-label' });
        this.presetColorsContainer = presetSection.createDiv('nn-preset-colors');

        // Right column
        const rightColumn = mainContent.createDiv('nn-color-picker-right');

        // Hex input section
        const hexSection = rightColumn.createDiv('nn-hex-section');
        hexSection.createEl('label', { text: strings.modals.colorPicker.hexLabel, cls: 'nn-hex-title' });
        const hexContainer = hexSection.createDiv('nn-hex-container');
        hexContainer.createEl('span', { text: '#', cls: 'nn-hex-label' });
        this.hexInput = hexContainer.createEl('input', {
            type: 'text',
            cls: 'nn-hex-input',
            value: this.selectedColor.substring(1),
            attr: {
                'aria-label': 'Hex color value',
                maxlength: '6',
                placeholder: 'RRGGBB'
            }
        });

        // RGB sliders section
        const rgbSection = rightColumn.createDiv('nn-rgb-section');
        rgbSection.createEl('div', { text: strings.modals.colorPicker.rgbLabel, cls: 'nn-rgb-title' });
        this.rgbSliders = {} as Record<RGBChannel, HTMLInputElement>;
        this.rgbValues = {} as Record<RGBChannel, HTMLSpanElement>;

        (['r', 'g', 'b'] as const).forEach(channel => {
            const sliderRow = rgbSection.createDiv('nn-rgb-row');
            sliderRow.createEl('span', {
                text: channel.toUpperCase(),
                cls: 'nn-rgb-label'
            });

            const slider = sliderRow.createEl('input', {
                type: 'range',
                cls: 'nn-rgb-slider',
                attr: {
                    'aria-label': `${channel.toUpperCase()} value`,
                    min: '0',
                    max: '255'
                }
            });
            slider.classList.add(`nn-rgb-slider-${channel}`);

            const value = sliderRow.createEl('span', {
                cls: 'nn-rgb-value',
                text: '0'
            });

            this.rgbSliders[channel as RGBChannel] = slider;
            this.rgbValues[channel as RGBChannel] = value;
        });

        // Recent colors section
        const recentSection = rightColumn.createDiv('nn-recent-section');
        const recentHeader = recentSection.createDiv('nn-recent-header');
        recentHeader.createEl('div', { text: strings.modals.colorPicker.recentColors, cls: 'nn-section-label' });

        // Clear button
        const clearButton = recentHeader.createEl('button', {
            text: '×',
            cls: 'nn-clear-recent',
            title: strings.modals.colorPicker.clearRecentColors
        });
        this.addDomListener(clearButton, 'click', () => {
            this.clearRecentColors();
        });

        this.recentColorsContainer = recentSection.createDiv('nn-recent-colors');

        // Action buttons
        const buttonContainer = contentEl.createDiv('nn-color-button-container');

        // Cancel/Remove button
        const removeColorText = this.isTag()
            ? strings.contextMenu.tag.removeColor
            : this.isFile()
              ? strings.contextMenu.file.removeColor
              : strings.contextMenu.folder.removeColor;
        const cancelRemoveButton = buttonContainer.createEl('button', {
            text: this.currentColor ? removeColorText : strings.common.cancel
        });
        this.addDomListener(cancelRemoveButton, 'click', () => {
            if (this.currentColor) {
                this.removeColor();
            } else {
                this.close();
            }
        });

        // Apply color button
        const applyButton = buttonContainer.createEl('button', {
            text: strings.modals.colorPicker.apply,
            cls: 'mod-cta'
        });
        this.addDomListener(applyButton, 'click', async () => {
            await this.applyColor();
        });

        // Set up event handlers
        this.setupEventHandlers();
        this.loadRecentColors();
        this.loadPresetColors();
        this.updateFromHex(this.selectedColor);

        // Hex input real-time update
        this.addDomListener(this.hexInput, 'input', () => {
            const hex = this.validateAndFormatHex(this.hexInput.value);
            if (hex) {
                this.updateFromHex(hex);
            }
        });
    }

    /**
     * Called when the modal is closed
     */
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        // Cleanup DOM listeners
        if (this.domDisposers.length) {
            this.domDisposers.forEach(dispose => {
                try {
                    dispose();
                } catch (e) {
                    console.error('Error disposing color picker listener:', e);
                }
            });
            this.domDisposers = [];
        }
    }

    /**
     * Set up event handlers for sliders
     */
    private setupEventHandlers() {
        // RGB slider handlers
        (Object.keys(this.rgbSliders) as RGBChannel[]).forEach(channel => {
            const slider = this.rgbSliders[channel];
            this.addDomListener(slider, 'input', () => {
                if (!this.isUpdating) {
                    this.updateFromRGB();
                }
            });
        });
    }

    /**
     * Load and display recently used colors
     */
    private loadRecentColors() {
        const recentColors = this.settingsProvider.settings.recentColors || [];
        this.recentColorsContainer.empty();

        recentColors.forEach(color => {
            const dot = this.recentColorsContainer.createDiv('nn-color-dot');
            dot.style.backgroundColor = color;
            dot.setAttribute('data-color', color);
            this.addDomListener(dot, 'click', () => {
                this.applyColorAndClose(color, false);
            });
        });

        // Fill empty slots
        for (let i = recentColors.length; i < MAX_RECENT_COLORS; i++) {
            this.recentColorsContainer.createDiv('nn-color-dot nn-color-empty');
        }
    }

    /**
     * Clear all recently used colors
     */
    private clearRecentColors() {
        this.settingsProvider.settings.recentColors = [];
        this.settingsProvider.saveSettingsAndUpdate();
        this.loadRecentColors();
    }

    /**
     * Load preset color palette
     */
    private loadPresetColors() {
        this.presetColorsContainer.empty();

        COLOR_PALETTE.forEach(color => {
            const dot = this.presetColorsContainer.createDiv('nn-color-dot');
            dot.style.backgroundColor = color.value;
            dot.setAttribute('data-color', color.value);
            dot.setAttribute('title', color.name);
            this.addDomListener(dot, 'click', () => {
                this.applyColorAndClose(color.value, false);
            });
        });
    }

    /**
     * Update all controls from hex value
     */
    private updateFromHex(hex: string) {
        this.isUpdating = true;
        this.selectedColor = hex;

        // Update preview
        this.previewNew.style.backgroundColor = hex;

        // Update hex input
        this.hexInput.value = hex.substring(1);

        // Convert to RGB and update sliders
        const rgb = this.hexToRgb(hex);
        if (rgb) {
            this.rgbSliders.r.value = rgb.r.toString();
            this.rgbSliders.g.value = rgb.g.toString();
            this.rgbSliders.b.value = rgb.b.toString();
            this.rgbValues.r.setText(rgb.r.toString());
            this.rgbValues.g.setText(rgb.g.toString());
            this.rgbValues.b.setText(rgb.b.toString());
        }

        this.isUpdating = false;
    }

    /**
     * Update from RGB slider values
     */
    private updateFromRGB() {
        const r = parseInt(this.rgbSliders.r.value);
        const g = parseInt(this.rgbSliders.g.value);
        const b = parseInt(this.rgbSliders.b.value);

        // Update value displays
        this.rgbValues.r.setText(r.toString());
        this.rgbValues.g.setText(g.toString());
        this.rgbValues.b.setText(b.toString());

        // Convert to hex
        const hex = this.rgbToHex(r, g, b);
        this.selectedColor = hex;

        // Update preview and hex input
        this.previewNew.style.backgroundColor = hex;
        this.hexInput.value = hex.substring(1);
    }

    /**
     * Convert hex to RGB
     */
    private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16)
              }
            : null;
    }

    /**
     * Convert RGB to hex
     */
    private rgbToHex(r: number, g: number, b: number): string {
        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }

    /**
     * Validate and format hex input
     */
    private validateAndFormatHex(input: string): string | null {
        // Remove # if present and spaces
        const hex = input.replace('#', '').trim();

        // Validate 6-digit hex
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
            return null;
        }

        return `#${hex.toLowerCase()}`;
    }

    /**
     * Save color to recent colors
     */
    private async saveToRecentColors(color: string) {
        // Don't add preset colors to recent
        const isPresetColor = COLOR_PALETTE.some(preset => preset.value === color);
        if (isPresetColor) {
            return;
        }

        const settings = this.settingsProvider.settings;
        let recentColors = settings.recentColors || [];

        // Remove if already exists
        recentColors = recentColors.filter(c => c !== color);

        // Add to front
        recentColors.unshift(color);

        // Limit to max
        recentColors = recentColors.slice(0, MAX_RECENT_COLORS);

        // Update settings
        settings.recentColors = recentColors;
        await this.settingsProvider.saveSettingsAndUpdate();
    }

    /**
     * Apply the selected color and close
     */
    private async applyColor() {
        // Save the color
        await this.saveColor();
        // Close the modal
        this.close();
    }

    /**
     * Remove the color and close
     */
    private async removeColor() {
        await this.updateMetadataColor(null);

        // Notify callback with null
        this.onChooseColor?.(null);

        // Close the modal
        this.close();
    }

    /**
     * Save the selected color
     */
    private async saveColor() {
        // Save to recent colors
        await this.saveToRecentColors(this.selectedColor);

        await this.updateMetadataColor(this.selectedColor);

        // Notify callback
        this.onChooseColor?.(this.selectedColor);
    }

    /**
     * Helper to check if this is for a tag
     */
    private isTag(): boolean {
        return this.itemType === ItemType.TAG;
    }

    private isFile(): boolean {
        return this.itemType === ItemType.FILE;
    }

    /**
     * Apply color and close modal
     * Used by both preset and recent color clicks
     */
    private async applyColorAndClose(color: string, saveToRecent: boolean = true) {
        this.updateFromHex(color);

        // Save to recent if requested
        if (saveToRecent) {
            await this.saveToRecentColors(color);
        }

        await this.updateMetadataColor(color);

        // Notify callback
        this.onChooseColor?.(color);

        // Close the modal
        this.close();
    }

    /**
     * Update metadata for the current mode and item type
     */
    private async updateMetadataColor(color: string | null): Promise<void> {
        const isTag = this.isTag();
        const isFile = this.isFile();

        if (color === null) {
            if (isTag) {
                if (this.isBackgroundMode) {
                    await this.metadataService.removeTagBackgroundColor(this.itemPath);
                } else {
                    await this.metadataService.removeTagColor(this.itemPath);
                }
            } else if (isFile) {
                await this.metadataService.removeFileColor(this.itemPath);
            } else if (this.isBackgroundMode) {
                await this.metadataService.removeFolderBackgroundColor(this.itemPath);
            } else {
                await this.metadataService.removeFolderColor(this.itemPath);
            }
            return;
        }

        if (isTag) {
            if (this.isBackgroundMode) {
                await this.metadataService.setTagBackgroundColor(this.itemPath, color);
            } else {
                await this.metadataService.setTagColor(this.itemPath, color);
            }
        } else if (isFile) {
            await this.metadataService.setFileColor(this.itemPath, color);
        } else if (this.isBackgroundMode) {
            await this.metadataService.setFolderBackgroundColor(this.itemPath, color);
        } else {
            await this.metadataService.setFolderColor(this.itemPath, color);
        }
    }
}
