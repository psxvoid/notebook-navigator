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

import { App, Modal, Setting, Notice } from 'obsidian';
import { strings } from '../i18n';
import { runAsyncAction } from '../utils/async';

/**
 * Options for initializing the SaveSearchShortcutModal
 */
interface SaveSearchShortcutModalOptions {
    initialName: string;
    onSubmit: (name: string) => Promise<boolean> | boolean;
}

/**
 * Modal for saving a search query as a shortcut.
 * Allows user to provide a custom name for the saved search.
 */
export class SaveSearchShortcutModal extends Modal {
    private name: string;
    private readonly onSubmitHandler: SaveSearchShortcutModalOptions['onSubmit'];

    constructor(app: App, { initialName, onSubmit }: SaveSearchShortcutModalOptions) {
        super(app);
        this.name = initialName;
        this.onSubmitHandler = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nn-modal');

        contentEl.createEl('h2', { text: strings.searchInput.shortcutModalTitle });

        // Input field for shortcut name
        new Setting(contentEl).setName(strings.searchInput.shortcutNameLabel).addText(text => {
            text.setPlaceholder(strings.searchInput.shortcutNamePlaceholder)
                .setValue(this.name)
                .onChange(value => {
                    this.name = value;
                });
            // Submit on Enter key
            text.inputEl.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    runAsyncAction(() => this.handleSubmit());
                }
            });
            // Auto-focus and select text for easy editing
            text.inputEl.focus();
            text.inputEl.setSelectionRange(0, this.name.length);
        });

        // Action buttons
        const actions = new Setting(contentEl);
        actions.addButton(button =>
            button.setButtonText(strings.common.cancel).onClick(() => {
                this.close();
            })
        );
        actions.addButton(button =>
            button
                .setCta()
                .setButtonText(strings.common.submit)
                .onClick(() => {
                    runAsyncAction(() => this.handleSubmit());
                })
        );
    }

    /**
     * Validates input and calls the submit handler.
     * Shows an error notice if the name is empty.
     */
    private async handleSubmit(): Promise<void> {
        const trimmedName = this.name.trim();
        if (trimmedName.length === 0) {
            new Notice(strings.shortcuts.emptySearchName);
            return;
        }

        const result = await this.onSubmitHandler(trimmedName);
        if (result !== false) {
            this.close();
        }
    }
}
