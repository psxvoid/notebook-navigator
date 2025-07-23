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
import { strings } from '../i18n';

/**
 * Modal dialog for accepting text input from the user
 * Used for file/folder creation and renaming operations
 * Supports Enter key submission and pre-filled default values
 */
export class InputModal extends Modal {
    private inputEl: HTMLInputElement;
    private cancelBtn: HTMLButtonElement;
    private submitBtn: HTMLButtonElement;
    private keydownHandler: (e: KeyboardEvent) => void;
    private cancelHandler: () => void;
    private submitHandler: () => void;

    /**
     * Creates an input modal with text field and submit/cancel buttons
     * @param app - The Obsidian app instance
     * @param title - Modal title (e.g., "New Folder")
     * @param placeholder - Placeholder text for the input field
     * @param onSubmit - Callback to execute with the entered value
     * @param defaultValue - Optional pre-filled value for editing operations
     */
    constructor(
        app: App,
        title: string,
        placeholder: string,
        private onSubmit: (value: string) => void,
        defaultValue: string = ''
    ) {
        super(app);
        this.titleEl.setText(title);

        this.inputEl = this.contentEl.createEl('input', {
            type: 'text',
            placeholder: placeholder,
            value: defaultValue
        });
        this.inputEl.addClass('nn-input');

        // Store handlers for cleanup
        this.keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.close();
                this.onSubmit(this.inputEl.value);
            }
        };
        this.cancelHandler = () => this.close();
        this.submitHandler = () => {
            this.close();
            this.onSubmit(this.inputEl.value);
        };

        this.inputEl.addEventListener('keydown', this.keydownHandler);

        const buttonContainer = this.contentEl.createDiv('nn-button-container');

        this.cancelBtn = buttonContainer.createEl('button', { text: strings.common.cancel });
        this.cancelBtn.addEventListener('click', this.cancelHandler);

        this.submitBtn = buttonContainer.createEl('button', {
            text: strings.common.submit,
            cls: 'mod-cta'
        });
        this.submitBtn.addEventListener('click', this.submitHandler);

        this.inputEl.focus();
        if (defaultValue) {
            this.inputEl.select();
        }
    }

    /**
     * Cleanup event listeners when modal is closed
     * Prevents memory leaks by removing all event listeners
     */
    onClose() {
        if (this.inputEl && this.keydownHandler) {
            this.inputEl.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.cancelBtn && this.cancelHandler) {
            this.cancelBtn.removeEventListener('click', this.cancelHandler);
        }
        if (this.submitBtn && this.submitHandler) {
            this.submitBtn.removeEventListener('click', this.submitHandler);
        }
    }
}
