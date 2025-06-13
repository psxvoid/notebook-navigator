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
import { MetadataService } from '../services/MetadataService';
import { strings } from '../i18n';

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

/**
 * Color picker modal for selecting custom folder colors
 * Displays a grid of predefined colors that work well in both themes
 * 
 * Features:
 * - Clean grid layout with 5 columns
 * - Shows color preview with name below
 * - Keyboard navigation support
 * - Smooth hover and focus effects
 * - Applies to folder icon and name (not chevron)
 */
export class ColorPickerModal extends Modal {
    private metadataService: MetadataService;
    private folderPath: string;
    private colorGrid: HTMLDivElement;
    private focusedIndex: number = -1;
    private gridColumns: number = 5;

    /** Callback function invoked when a color is selected */
    public onChooseColor: (color: string | null) => void;

    /**
     * Creates a new color picker modal
     * @param app - The Obsidian app instance
     * @param metadataService - The metadata service for managing folder colors
     * @param folderPath - Path of the folder to set color for
     */
    constructor(app: App, metadataService: MetadataService, folderPath: string) {
        super(app);
        this.metadataService = metadataService;
        this.folderPath = folderPath;
    }

    /**
     * Called when the modal is opened
     * Sets up the color grid
     */
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nn-color-picker-modal');

        // Create header
        const header = contentEl.createDiv('nn-color-picker-header');
        header.createEl('h3', { text: strings.modals.colorPicker.header });

        // Create color grid
        this.colorGrid = contentEl.createDiv('nn-color-grid');
        
        // Add color items
        COLOR_PALETTE.forEach((color, index) => {
            this.createColorItem(color, index);
        });

        // Set up keyboard navigation
        this.setupKeyboardNavigation();

        // Focus first color
        setTimeout(() => {
            this.focusFirstColor();
        }, 50);
    }

    /**
     * Called when the modal is closed
     * Cleans up the modal content
     */
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * Creates a clickable color item in the grid
     * @param color - The color object with name and value
     * @param index - The index in the grid
     */
    private createColorItem(color: { name: string; value: string }, index: number) {
        const colorItem = this.colorGrid.createDiv('nn-color-item');
        colorItem.setAttribute('data-color', color.value);
        colorItem.setAttribute('data-index', index.toString());
        
        // Color preview
        const colorPreview = colorItem.createDiv('nn-color-preview');
        colorPreview.style.backgroundColor = color.value;
        
        // Color name
        const colorName = colorItem.createDiv('nn-color-name');
        colorName.setText(color.name);
        
        // Click handler
        colorItem.addEventListener('click', () => {
            this.selectColor(color.value);
        });
        
        // Make focusable
        colorItem.setAttribute('tabindex', '0');
    }

    /**
     * Sets up keyboard navigation for the modal
     * Arrow keys navigate the grid, Enter/Space selects
     */
    private setupKeyboardNavigation() {
        this.contentEl.addEventListener('keydown', (e) => {
            const colorItems = Array.from(this.colorGrid.querySelectorAll('.nn-color-item')) as HTMLElement[];
            if (colorItems.length === 0) return;

            const currentFocused = document.activeElement as HTMLElement;
            const isInGrid = currentFocused?.classList.contains('nn-color-item');

            if (isInGrid) {
                const currentIndex = parseInt(currentFocused.getAttribute('data-index') || '0');
                let newIndex = currentIndex;

                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        if (currentIndex % this.gridColumns > 0) {
                            newIndex = currentIndex - 1;
                        }
                        break;

                    case 'ArrowRight':
                        e.preventDefault();
                        if (currentIndex % this.gridColumns < this.gridColumns - 1 && currentIndex < colorItems.length - 1) {
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
                        if (currentIndex + this.gridColumns < colorItems.length) {
                            newIndex = currentIndex + this.gridColumns;
                        }
                        break;

                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        const color = currentFocused.getAttribute('data-color');
                        if (color) {
                            this.selectColor(color);
                        }
                        break;

                    case 'Escape':
                        e.preventDefault();
                        this.close();
                        break;
                }

                if (newIndex !== currentIndex && newIndex >= 0 && newIndex < colorItems.length) {
                    colorItems[newIndex].focus();
                    this.focusedIndex = newIndex;
                }
            }
        });
    }

    /**
     * Focuses the first color in the grid
     */
    private focusFirstColor() {
        const firstColor = this.colorGrid.querySelector('.nn-color-item') as HTMLElement;
        if (firstColor) {
            firstColor.focus();
            this.focusedIndex = 0;
        }
    }

    /**
     * Handles color selection
     * Saves the selection and closes the modal
     * @param color - The selected color value
     */
    private async selectColor(color: string) {
        // Set the folder color using metadata service
        await this.metadataService.setFolderColor(this.folderPath, color);

        // Notify callback and close
        this.onChooseColor?.(color);
        this.close();
    }
}