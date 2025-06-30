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

import { App, Modal, Setting, TFile } from 'obsidian';
import { strings } from '../i18n';

interface TagOperationOptions {
    operation: 'rename' | 'delete';
    tagPath: string; // Without the # prefix
    newTagPath?: string; // For rename operation, without the # prefix
    affectedFiles: TFile[];
    onConfirm: () => Promise<void>;
}

/**
 * Modal for tag operations (rename/delete) that warns about file modifications
 * Always shows even if confirmBeforeDelete is off, because these operations
 * modify file content and affect modification dates
 */
export class TagOperationModal extends Modal {
    private options: TagOperationOptions;
    newTagInput: string; // Made public for access from context menu

    constructor(app: App, options: TagOperationOptions) {
        super(app);
        this.options = options;
        this.newTagInput = options.newTagPath || '';
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Clean tag path - remove leading # if present
        const cleanTagPath = this.options.tagPath.startsWith('#') ? this.options.tagPath.substring(1) : this.options.tagPath;
        const tagDisplay = '#' + cleanTagPath;
        const fileCount = this.options.affectedFiles.length;

        if (this.options.operation === 'rename') {
            contentEl.createEl('h2', { text: strings.modals.tagOperation.renameTitle.replace('{tag}', tagDisplay) });
            
            // Show new tag input
            new Setting(contentEl)
                .setName(strings.modals.tagOperation.newTagPrompt)
                .addText(text => text
                    .setPlaceholder(strings.modals.tagOperation.newTagPlaceholder)
                    .setValue(this.newTagInput)
                    .onChange(value => {
                        this.newTagInput = value;
                    }));

            // Warning message
            const warningEl = contentEl.createDiv('nn-tag-operation-warning');
            const filesWord = fileCount === 1 ? strings.modals.tagOperation.file : strings.modals.tagOperation.files;
            warningEl.createEl('p', { 
                text: strings.modals.tagOperation.renameWarning
                    .replace('{count}', fileCount.toString())
                    .replace('{oldTag}', tagDisplay)
                    .replace('{newTag}', '')
                    .replace('{files}', filesWord)
            });
            
            if (fileCount > 0) {
                warningEl.createEl('p', { 
                    text: strings.modals.tagOperation.modificationWarning,
                    cls: 'nn-tag-operation-warning-highlight'
                });
            }
        } else {
            contentEl.createEl('h2', { text: strings.modals.tagOperation.deleteTitle.replace('{tag}', tagDisplay) });
            
            // Warning message
            const warningEl = contentEl.createDiv('nn-tag-operation-warning');
            const filesWord = fileCount === 1 ? strings.modals.tagOperation.file : strings.modals.tagOperation.files;
            warningEl.createEl('p', { 
                text: strings.modals.tagOperation.deleteWarning
                    .replace('{count}', fileCount.toString())
                    .replace('{tag}', tagDisplay)
                    .replace('{files}', filesWord)
            });
            
            if (fileCount > 0) {
                warningEl.createEl('p', { 
                    text: strings.modals.tagOperation.modificationWarning,
                    cls: 'nn-tag-operation-warning-highlight'
                });
            }
        }

        // Buttons
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(strings.common.cancel)
                .onClick(() => {
                    this.close();
                }))
            .addButton(button => button
                .setButtonText(this.options.operation === 'rename' 
                    ? strings.modals.tagOperation.confirmRename 
                    : strings.modals.tagOperation.confirmDelete)
                .setCta()
                .onClick(async () => {
                    if (this.options.operation === 'rename') {
                        // Validate new tag name
                        const trimmedTag = this.newTagInput.trim();
                        if (!trimmedTag) {
                            return;
                        }
                        
                        // Remove # if user included it
                        const cleanTag = trimmedTag.startsWith('#') ? trimmedTag.substring(1) : trimmedTag;
                        
                        // Pass the clean tag path
                        this.options.newTagPath = cleanTag;
                    }
                    
                    this.close();
                    await this.options.onConfirm();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}