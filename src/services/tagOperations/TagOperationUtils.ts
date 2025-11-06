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
import { TFile } from 'obsidian';
import type { TagTreeService } from '../TagTreeService';
import type { RenameFile, TagDescriptor } from '../tagRename/TagRenameEngine';
import type { TagUsageSummary } from './types';
import { normalizeTagPathValue } from '../../utils/tagPrefixMatcher';

/**
 * Yields control back to the event loop to prevent blocking UI during batch operations
 * Uses requestAnimationFrame when available for smoother UI updates
 */
export async function yieldToEventLoop(): Promise<void> {
    await new Promise<void>(resolve => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
            return;
        }
        setTimeout(resolve, 0);
    });
}

/**
 * Collects all file paths that contain the specified tag
 * Returns null if tag tree service is unavailable
 */
export function collectPreviewPaths(tag: TagDescriptor, tagTreeService: TagTreeService | null): string[] | null {
    if (tag.canonicalName.length === 0) {
        return [];
    }
    if (!tagTreeService) {
        return null;
    }
    return tagTreeService.collectTagFilePaths(tag.canonicalName);
}

/**
 * Builds a usage summary from file paths
 * Limits sample to 8 files for display in modals
 */
export function buildUsageSummaryFromPaths(app: App, paths: Iterable<string>): TagUsageSummary {
    const sample: string[] = [];
    let total = 0;

    for (const filePath of paths) {
        total += 1;
        if (sample.length >= 8) {
            continue;
        }
        const abstractFile = app.vault.getAbstractFileByPath(filePath);
        if (abstractFile instanceof TFile) {
            sample.push(abstractFile.basename);
        } else {
            sample.push(filePath);
        }
    }

    return { total, sample };
}

/**
 * Builds a usage summary from rename target files
 * Wrapper for buildUsageSummaryFromPaths
 */
export function buildUsageSummary(app: App, targets: RenameFile[]): TagUsageSummary {
    return buildUsageSummaryFromPaths(
        app,
        targets.map(target => target.filePath)
    );
}

/**
 * Resolves canonical tag path to its display path using the tag tree
 * Returns original path if tag tree is unavailable or tag not found
 */
export function resolveDisplayTagPath(tagPath: string, tagTreeService: TagTreeService | null): string {
    const canonical = normalizeTagPathValue(tagPath);
    if (canonical.length === 0) {
        return tagPath;
    }
    if (!tagTreeService) {
        return tagPath;
    }
    const node = tagTreeService.findTagNode(canonical);
    return node?.displayPath ?? tagPath;
}
