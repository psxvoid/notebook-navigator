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

import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { strings } from '../../i18n';
import type { TagTreeService } from '../TagTreeService';
import type { MetadataService } from '../MetadataService';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../../types';
import { TagDescriptor } from '../tagRename/TagRenameEngine';
import { TagFileMutations } from './TagFileMutations';
import { collectPreviewPaths, yieldToEventLoop, buildUsageSummaryFromPaths } from './TagOperationUtils';
import type { TagDeleteEventPayload } from './types';
import { runAsyncAction } from '../../utils/async';
import { showNotice } from '../../utils/noticeUtils';

const DELETE_BATCH_SIZE = 10;

export interface TagDeleteHooks {
    deleteTagFromFile: (file: TFile, tag: TagDescriptor) => Promise<boolean>;
    removeTagMetadataAfterDelete: (tagPath: string) => Promise<void>;
    removeTagShortcutsAfterDelete: (tagPath: string) => Promise<void>;
    notifyTagDeleted: (payload: TagDeleteEventPayload) => void;
    resolveDisplayTagPath: (tagPath: string) => string;
}

/**
 * Handles the workflow for deleting tags from the vault
 * Includes modal confirmation, batch deletion, and metadata cleanup
 */
export class TagDeleteWorkflow {
    constructor(
        private readonly app: App,
        private readonly fileMutations: TagFileMutations,
        private readonly getTagTreeService: () => TagTreeService | null,
        private readonly getMetadataService: () => MetadataService | null,
        private readonly getHooks: () => TagDeleteHooks
    ) {}

    /**
     * Prompts user to confirm tag deletion with a modal
     * Shows affected files and handles special tag IDs
     */
    async promptDeleteTag(tagPath: string): Promise<void> {
        if (tagPath === TAGGED_TAG_ID || tagPath === UNTAGGED_TAG_ID) {
            return;
        }

        const hooks = this.getHooks();
        const tagTree = this.getTagTreeService();
        const displayPath = hooks.resolveDisplayTagPath(tagPath);
        if (displayPath.length === 0) {
            return;
        }

        const descriptor = new TagDescriptor(displayPath);
        const previewPaths = collectPreviewPaths(descriptor, tagTree);
        if (previewPaths === null) {
            showNotice(strings.fileSystem.notifications.tagOperationsNotAvailable, { variant: 'warning' });
            return;
        }

        const uniquePreview = Array.from(new Set(previewPaths));
        const usage = buildUsageSummaryFromPaths(this.app, uniquePreview);
        if (usage.total === 0) {
            showNotice(`#${displayPath}: ${strings.listPane.emptyStateNoNotes}`, { variant: 'warning' });
            return;
        }

        const countLabel = usage.total === 1 ? strings.modals.tagOperation.file : strings.modals.tagOperation.files;
        const modal = new ConfirmModal(
            this.app,
            strings.modals.tagOperation.deleteTitle.replace('{tag}', `#${displayPath}`),
            strings.modals.tagOperation.deleteWarning
                .replace('{tag}', `#${displayPath}`)
                .replace('{count}', usage.total.toString())
                .replace('{files}', countLabel),
            () => {
                // Execute tag deletion with error handling using latest tag data
                runAsyncAction(() => this.runTagDelete(displayPath));
            },
            strings.modals.tagOperation.confirmDelete,
            {
                buildContent: container => {
                    if (usage.sample.length === 0) {
                        return;
                    }

                    const listContainer = container.createDiv('nn-tag-rename-file-preview');
                    listContainer.createEl('h4', { text: strings.modals.tagOperation.affectedFiles });
                    const list = listContainer.createEl('ul');
                    usage.sample.forEach(fileName => {
                        list.createEl('li', { text: fileName });
                    });
                    const remaining = usage.total - usage.sample.length;
                    if (remaining > 0) {
                        listContainer.createEl('p', {
                            text: strings.modals.tagOperation.andMore.replace('{count}', remaining.toString())
                        });
                    }
                }
            }
        );
        modal.open();
    }

    /**
     * Executes tag deletion from files in batches
     * Removes tag and all descendant tags, updates metadata and shortcuts
     */
    async runTagDelete(tagPath: string, presetPaths?: readonly string[] | null): Promise<boolean> {
        const hooks = this.getHooks();
        const descriptor = new TagDescriptor(tagPath);
        const targetPathsSet = new Set<string>();

        if (presetPaths && presetPaths.length > 0) {
            presetPaths.forEach(path => {
                if (typeof path === 'string' && path.length > 0) {
                    targetPathsSet.add(path);
                }
            });
        } else {
            const tagTree = this.getTagTreeService();
            const previewPaths = collectPreviewPaths(descriptor, tagTree);
            if (previewPaths === null) {
                showNotice(strings.fileSystem.notifications.tagOperationsNotAvailable, { variant: 'warning' });
                return false;
            }
            previewPaths.forEach(path => {
                if (typeof path === 'string' && path.length > 0) {
                    targetPathsSet.add(path);
                }
            });
        }

        if (targetPathsSet.size === 0) {
            showNotice(`#${descriptor.name}: ${strings.listPane.emptyStateNoNotes}`, { variant: 'warning' });
            return false;
        }

        let removed = 0;
        let processed = 0;

        for (const path of targetPathsSet) {
            const abstract = this.app.vault.getAbstractFileByPath(path);
            if (!(abstract instanceof TFile)) {
                processed++;
                continue;
            }

            try {
                if (await hooks.deleteTagFromFile(abstract, descriptor)) {
                    removed++;
                }
            } catch (error) {
                console.error(`[Notebook Navigator] Failed to delete tag ${descriptor.tag} in ${path}`, error);
            }

            processed++;
            if (processed % DELETE_BATCH_SIZE === 0) {
                await yieldToEventLoop();
            }
        }

        if (removed === 0) {
            showNotice(strings.fileSystem.notifications.noTagsToRemove, { variant: 'warning' });
            return false;
        }

        await hooks.removeTagMetadataAfterDelete(descriptor.name);
        await hooks.removeTagShortcutsAfterDelete(descriptor.name);

        hooks.notifyTagDeleted({
            path: descriptor.name,
            canonicalPath: descriptor.canonicalName
        });

        if (removed === 1) {
            showNotice(strings.fileSystem.notifications.tagRemovedFromNote, { variant: 'success' });
        } else {
            showNotice(strings.fileSystem.notifications.tagRemovedFromNotes.replace('{count}', removed.toString()), {
                variant: 'success'
            });
        }

        return true;
    }

    /**
     * Deletes a tag and its descendants from a single file
     * Removes from both frontmatter and inline content
     */
    async deleteTagFromFile(file: TFile, tag: TagDescriptor): Promise<boolean> {
        if (!this.fileMutations.isMarkdownFile(file)) {
            return false;
        }

        const normalizedTarget = tag.canonicalName;
        if (normalizedTarget.length === 0) {
            return false;
        }

        const descendants = this.fileMutations.collectDescendantTags(file, tag.name);
        const normalizedDescendants = descendants?.normalizedSet ?? new Set<string>();
        const descendantTags = descendants?.tags ?? [];

        const targets = new Set<string>(normalizedDescendants);
        targets.add(normalizedTarget);

        const inlineTags = descendantTags.length > 0 ? [tag.name, ...descendantTags] : [tag.name];
        return this.fileMutations.stripTagsFromFile(
            file,
            candidate => targets.has(candidate),
            inlineTags,
            'remove tag hierarchy from frontmatter'
        );
    }

    /**
     * Removes tag metadata entries after deletion
     * Cleans up tag colors, icons, and other metadata
     */
    async removeTagMetadataAfterDelete(tagPath: string): Promise<void> {
        const metadataService = this.getMetadataService();
        if (!metadataService) {
            return;
        }

        const trimmedPath = tagPath.trim();
        if (trimmedPath.length === 0) {
            return;
        }

        try {
            await metadataService.handleTagDelete(trimmedPath);
        } catch (error) {
            console.error('[Notebook Navigator] Failed to remove tag metadata after delete', error);
        }
    }
}
