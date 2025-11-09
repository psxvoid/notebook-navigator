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
import { runAsyncAction, type MaybePromise } from '../utils/async';

interface EditVaultProfileModalOptions {
    defaultValue: string;
    placeholder: string;
    title: string;
    canDelete: boolean;
    onSubmit: (value: string) => MaybePromise;
    onDelete: (value: string) => MaybePromise;
}

/**
 * Modal dialog for renaming an existing vault profile
 * Provides Save and Delete actions with keyboard shortcuts
 */
export class EditVaultProfileModal extends Modal {
    private deleteBtn: HTMLButtonElement;
    private deleteHandler: () => void;
    private inputEl: HTMLInputElement;
    private submitBtn: HTMLButtonElement;
    private submitHandler: () => void;

    constructor(
        app: App,
        private options: EditVaultProfileModalOptions
    ) {
        super(app);
        this.titleEl.setText(options.title);

        this.inputEl = this.contentEl.createEl('input', {
            type: 'text',
            placeholder: options.placeholder,
            value: options.defaultValue
        });
        this.inputEl.addClass('nn-input');

        const buttonContainer = this.contentEl.createDiv('nn-button-container');

        this.deleteHandler = () => {
            if (!this.options.canDelete) {
                return;
            }
            this.close();
            runAsyncAction(() => this.options.onDelete(this.inputEl.value));
        };
        this.submitHandler = () => {
            this.close();
            this.submitValue(this.inputEl.value);
        };

        this.deleteBtn = buttonContainer.createEl('button', {
            text: strings.settings.items.vaultProfiles.deleteButton,
            cls: 'mod-warning'
        });
        this.deleteBtn.disabled = !options.canDelete;
        this.deleteBtn.addEventListener('click', this.deleteHandler);

        this.submitBtn = buttonContainer.createEl('button', {
            text: strings.common.submit,
            cls: 'mod-cta'
        });
        this.submitBtn.addEventListener('click', this.submitHandler);

        // Submit the rename when Enter is pressed in the input field
        this.scope.register([], 'Enter', evt => {
            if (document.activeElement === this.inputEl) {
                evt.preventDefault();
                this.close();
                this.submitValue(this.inputEl.value);
            }
        });

        // Close the modal without saving when Escape is pressed
        this.scope.register([], 'Escape', evt => {
            evt.preventDefault();
            this.close();
        });

        // Focus the input field and select existing text for easy replacement
        this.inputEl.focus();
        if (options.defaultValue) {
            this.inputEl.select();
        }
    }

    onClose(): void {
        if (this.deleteBtn && this.deleteHandler) {
            this.deleteBtn.removeEventListener('click', this.deleteHandler);
        }
        if (this.submitBtn && this.submitHandler) {
            this.submitBtn.removeEventListener('click', this.submitHandler);
        }
    }

    // Execute the rename callback with the provided value
    private submitValue(value: string): void {
        runAsyncAction(() => this.options.onSubmit(value));
    }
}
