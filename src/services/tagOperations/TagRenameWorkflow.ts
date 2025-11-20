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

import type { App } from 'obsidian';
import { strings } from '../../i18n';
import type { TagTreeService } from '../TagTreeService';
import type { MetadataService } from '../MetadataService';
import { collectRenameFiles, RenameFile, TagDescriptor, TagReplacement, isDescendantRename } from '../tagRename/TagRenameEngine';
import { TagRenameModal } from '../../modals/TagRenameModal';
import { buildUsageSummary, buildUsageSummaryFromPaths, collectPreviewPaths, yieldToEventLoop } from './TagOperationUtils';
import type { TagRenameEventPayload, TagUsageSummary } from './types';
import { TagFileMutations } from './TagFileMutations';
import { showNotice } from '../../utils/noticeUtils';

const RENAME_BATCH_SIZE = 10;

export interface TagRenameAnalysis {
    oldTag: TagDescriptor;
    newTag: TagDescriptor;
    replacement: TagReplacement;
    targets: RenameFile[];
    mergeConflict: [TagDescriptor, TagDescriptor] | null;
}

export interface TagRenameResult {
    renamed: number;
    total: number;
}

export interface TagRenameHooks {
    executeRename: (analysis: TagRenameAnalysis) => Promise<TagRenameResult>;
    updateTagMetadataAfterRename: (oldTagPath: string, newTagPath: string, preserveDestination: boolean) => Promise<void>;
    updateTagShortcutsAfterRename: (oldTagPath: string, newTagPath: string) => Promise<void>;
    notifyTagRenamed: (payload: TagRenameEventPayload) => void;
}

/**
 * Handles the workflow for renaming tags across the vault
 * Includes modal prompt, batch processing, and metadata updates
 */
export class TagRenameWorkflow {
    constructor(
        private readonly app: App,
        private readonly fileMutations: TagFileMutations,
        private readonly getTagTreeService: () => TagTreeService | null,
        private readonly getMetadataService: () => MetadataService | null,
        private readonly resolveDisplayTagPathInternal: (tagPath: string) => string,
        private readonly getHooks: () => TagRenameHooks
    ) {}

    /**
     * Prompts user to rename a tag with validation
     * Shows affected files and prevents invalid renames
     */
    async promptRenameTag(tagPath: string, initialValue?: string): Promise<void> {
        const tagTree = this.getTagTreeService();
        const displayPath = this.resolveDisplayTagPathInternal(tagPath);
        const oldTagDescriptor = new TagDescriptor(displayPath);
        const previewPaths = collectPreviewPaths(oldTagDescriptor, tagTree);
        let presetTargets: RenameFile[] | null = null;
        let usage: TagUsageSummary;

        if (previewPaths === null) {
            const targets = collectRenameFiles(this.app, oldTagDescriptor, tagTree);
            usage = buildUsageSummary(this.app, targets);
            presetTargets = targets;
        } else {
            usage = buildUsageSummaryFromPaths(this.app, previewPaths);
        }

        if (usage.total === 0) {
            showNotice(`#${displayPath}: ${strings.listPane.emptyStateNoNotes}`, { variant: 'warning' });
            return;
        }

        const modal = new TagRenameModal(this.app, {
            tagPath: displayPath,
            affectedCount: usage.total,
            sampleFiles: usage.sample,
            initialValue: this.getInitialInputValue(initialValue, displayPath),
            onSubmit: async newName => {
                const trimmedName = newName.startsWith('#') ? newName.slice(1) : newName;
                if (!this.fileMutations.isValidTagName(trimmedName)) {
                    showNotice(strings.modals.tagOperation.invalidTagName, { variant: 'warning' });
                    return false;
                }
                const newDescriptor = new TagDescriptor(trimmedName);
                if (isDescendantRename(oldTagDescriptor, newDescriptor)) {
                    showNotice(strings.modals.tagOperation.descendantRenameError, { variant: 'warning' });
                    return false;
                }
                return this.runTagRename(displayPath, trimmedName, presetTargets ?? null);
            }
        });
        modal.open();
    }

    /**
     * Determines the starting value for the rename input
     * Falls back to the current tag path when no override provided
     */
    private getInitialInputValue(initialValue: string | undefined, displayPath: string): string {
        const sourceValue = initialValue ?? displayPath;
        const trimmed = sourceValue.trim();
        if (trimmed.length === 0) {
            return displayPath;
        }
        return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    }

    /**
     * Analyzes rename operation for conflicts and affected files
     * Detects when rename would merge into existing tags
     */
    private buildRenameAnalysis(oldTagPath: string, newTagPath: string, presetTargets?: RenameFile[] | null): TagRenameAnalysis {
        const oldTag = new TagDescriptor(oldTagPath);
        const newTag = new TagDescriptor(newTagPath);
        const replacement = new TagReplacement(oldTag, newTag);
        const tagTree = this.getTagTreeService();
        const targets = presetTargets ?? collectRenameFiles(this.app, oldTag, tagTree);
        const existingTags = tagTree ? tagTree.getAllTagPaths().map(path => `#${path}`) : [];
        const mergeConflict = existingTags.length > 0 ? replacement.willMergeTags(existingTags) : null;
        return { oldTag, newTag, replacement, targets, mergeConflict };
    }

    /**
     * Executes rename operation on all affected files in batches
     * Yields to event loop periodically to avoid blocking UI
     */
    async executeRename(analysis: TagRenameAnalysis): Promise<TagRenameResult> {
        const conflict = analysis.mergeConflict;
        if (conflict) {
            const [origin, clash] = conflict;
            showNotice(`${origin.tag} merges into ${clash.tag}`, { variant: 'warning' });
        }

        let renamed = 0;
        for (let index = 0; index < analysis.targets.length; index++) {
            const target = analysis.targets[index];
            if (await target.renamed(analysis.replacement)) {
                renamed++;
            }
            if ((index + 1) % RENAME_BATCH_SIZE === 0) {
                await yieldToEventLoop();
            }
        }

        return { renamed, total: analysis.targets.length };
    }

    /**
     * Updates tag metadata (colors, icons) after rename
     * Preserves destination metadata when merging tags
     */
    async updateTagMetadataAfterRename(oldTagPath: string, newTagPath: string, preserveDestination: boolean): Promise<void> {
        const metadataService = this.getMetadataService();
        if (!metadataService) {
            return;
        }

        const trimmedOld = oldTagPath.trim();
        const trimmedNew = newTagPath.trim();
        if (trimmedOld.length === 0 || trimmedNew.length === 0 || trimmedOld === trimmedNew) {
            return;
        }

        try {
            await metadataService.handleTagRename(trimmedOld, trimmedNew, preserveDestination);
        } catch (error) {
            console.error('[Notebook Navigator] Failed to update tag metadata after rename', error);
        }
    }

    /**
     * Runs the complete tag rename workflow
     * Validates, executes rename, updates metadata and notifies listeners
     */
    async runTagRename(oldTagPath: string, newTagPath: string, presetTargets: RenameFile[] | null = null): Promise<boolean> {
        const hooks = this.getHooks();
        const analysis = this.buildRenameAnalysis(oldTagPath, newTagPath, presetTargets);

        if (isDescendantRename(analysis.oldTag, analysis.newTag)) {
            showNotice(strings.modals.tagOperation.descendantRenameError, { variant: 'warning' });
            return false;
        }

        if (analysis.oldTag.tag === analysis.newTag.tag) {
            showNotice(strings.modals.tagOperation.renameUnchanged.replace('{tag}', analysis.oldTag.tag), { variant: 'warning' });
            return false;
        }

        if (analysis.targets.length === 0) {
            showNotice(`#${analysis.oldTag.name}: ${strings.listPane.emptyStateNoNotes}`, { variant: 'warning' });
            return false;
        }

        const result = await hooks.executeRename(analysis);
        if (result.renamed === 0) {
            showNotice(
                strings.modals.tagOperation.renameNoChanges
                    .replace('{oldTag}', analysis.oldTag.tag)
                    .replace('{newTag}', analysis.newTag.tag)
                    .replace('{countLabel}', strings.listPane.emptyStateNoNotes),
                { variant: 'warning' }
            );
            return false;
        }

        await hooks.updateTagMetadataAfterRename(analysis.oldTag.name, analysis.newTag.name, Boolean(analysis.mergeConflict));
        await hooks.updateTagShortcutsAfterRename(analysis.oldTag.name, analysis.newTag.name);

        hooks.notifyTagRenamed({
            oldPath: analysis.oldTag.name,
            newPath: analysis.newTag.name,
            oldCanonicalPath: analysis.oldTag.canonicalName,
            newCanonicalPath: analysis.newTag.canonicalName,
            mergedIntoExisting: Boolean(analysis.mergeConflict)
        });

        showNotice(
            `${strings.modals.tagOperation.confirmRename}: ${analysis.oldTag.tag} → ${analysis.newTag.tag} (${result.renamed}/${result.total})`,
            { variant: 'success' }
        );
        return true;
    }
}
