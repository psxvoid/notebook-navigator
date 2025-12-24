/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad, modifications by Pavel Sapehin
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

import { TFile, getAllTags, CachedMetadata } from 'obsidian';
import { ContentType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';
import { FileData, TagsV2 } from '../../storage/IndexedDBStorage';
import { getDBInstance } from '../../storage/fileOperations';
import { BaseContentProvider } from './BaseContentProvider';
import { CacheCustomFields } from 'src/types';
import { EMPTY_ARRAY, EMPTY_MAP } from 'src/utils/empty';
import { getAllSupportedTagProps } from 'src/utils/vaultProfiles';

/**
 * Content provider for extracting tags from files
 */
export class TagContentProvider extends BaseContentProvider {
    getContentType(): ContentType {
        return 'tags';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return ['showTags'];
    }

    shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean {
        // Clear if tags are disabled
        if (!newSettings.showTags && oldSettings.showTags) {
            return true;
        }

        // Regenerate if tags are enabled and weren't before
        if (newSettings.showTags && !oldSettings.showTags) {
            return true;
        }

        return false;
    }

    async clearContent(): Promise<void> {
        const db = getDBInstance();
        await db.batchClearAllFileContent('tags');
    }

    protected needsProcessing(fileData: FileData | null, file: TFile, settings: NotebookNavigatorSettings): boolean {
        if (!settings.showTags) {
            return false;
        }

        const fileModified = fileData !== null && fileData.mtime !== file.stat.mtime;
        return !fileData || fileData.tags === null || fileModified;
    }

    protected async processFile(
        job: { file: TFile; path: string[] },
        fileData: FileData | null,
        settings: NotebookNavigatorSettings,
    ): Promise<{
        path: string;
        tags?: TagsV2;
        preview?: string;
        featureImage?: string;
        metadata?: FileData['metadata'];
    } | null> {
        if (!settings.showTags) {
            return null;
        }

        try {
            const metadata = this.app.metadataCache.getFileCache(job.file);
            const tags: Map<string, readonly string[]> = this.extractTagsFromMetadata(metadata, settings);

            if (
                fileData &&
                fileData.tags instanceof Map &&
                tags.size === 0 &&
                fileData.mtime === job.file.stat.mtime
            ) {
                // Metadata has not been refreshed after a rename; keep existing tags until Obsidian re-parses the file
                return null;
            }

            // Only return update if tags changed
            if (fileData && this.tagsEqual(fileData.tags, tags)) {
                return null;
            }

            return {
                path: job.file.path,
                tags,
            };
        } catch (error) {
            console.error(`Error extracting tags for ${job.file.path}:`, error);
            return null;
        }
    }

    /**
     * Extract tags from cached metadata.
     *
     * Tags are returned with their original casing as found in the vault,
     * without the # prefix. For example, "#ToDo" becomes "ToDo".
     *
     * Duplicate tags with different casing are deduplicated - only the first
     * occurrence is kept. For example, if a file has #todo and #TODO, only
     * "todo" (the first one) is returned.
     *
     * The tag tree building process will later normalize these to lowercase
     * for the `path` property while preserving the original casing in `displayPath`.
     *
     * @param metadata - Cached metadata from Obsidian's metadata cache
     * @returns Array of unique tag strings without # prefix, in original casing
     */
    private extractTagsFromMetadata(metadata: CachedMetadata | null, settings: NotebookNavigatorSettings): Map<string, readonly string[]> {
        const rawTags: readonly string[] = metadata ? getAllTags(metadata) ?? EMPTY_ARRAY : EMPTY_ARRAY;

        // Deduplicate tags while preserving the first occurrence's casing
        const filterUniqTagsV1 = (source: readonly string[]): readonly string[] => {
            const seen = new Set<string>();
            const uniqueTags: string[] = [];

            for (const tag of source) {
                // Remove # prefix
                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                const lowerTag = cleanTag.toLowerCase();

                // Only add if we haven't seen this tag (case-insensitive)
                if (!seen.has(lowerTag)) {
                    seen.add(lowerTag);
                    uniqueTags.push(cleanTag);
                }
            }

            return uniqueTags;
        }

        const filterUniqTagProps = (tagProp: string, tagPropValueRaw: readonly string[] | undefined): readonly [string, undefined | readonly string[]] => 
            [tagProp, tagPropValueRaw == null ? tagPropValueRaw : filterUniqTagsV1(tagPropValueRaw)]

        const tagPropsRaw: readonly (readonly [string, readonly string[]])[] =
            getAllSupportedTagProps(settings)
                .map(x => {
                    const metaProps = metadata?.frontmatter?.[x] as undefined | readonly string[]
                    return filterUniqTagProps(x, metaProps)
                })
                .concat([filterUniqTagProps(CacheCustomFields.TagDefault, rawTags)])
                .filter(x => x[1] != null) as readonly (readonly [string, readonly string[]])[]

        return tagPropsRaw.length === 0
            ? EMPTY_MAP as Map<string, string[]>
            : new Map(tagPropsRaw)
    }

    /**
     * Check if two tag arrays are equal.
     * Handles null values properly.
     *
     * @param tags1 - First tag array (can be null)
     * @param tags2 - Second tag array (can be null)
     * @returns True if tags are equal
     */
    private tagsEqual(tags1: TagsV2, tags2: TagsV2): boolean {
        if (tags1 === tags2) return true; // Both null or same reference
        if (tags1 === null || tags2 === null) return false; // One is null
        if (tags1.size !== tags2.size) return false;

        for (const [tagProp, tagArr1] of tags1.entries()) {
            const tagArr2 = tags2.get(tagProp)

            if (tagArr2 == null || typeof tagArr1 !== typeof tagArr2 || tagArr1?.length !== tagArr2?.length || !(tagArr1?.every((tag, i) => tag === tags2.get(tagProp)?.[i]))) {
                return false
            }
        }

        return true
    }
}
