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

import { TFile, TFolder, App } from 'obsidian';
import type { NotebookNavigatorSettings } from '../settings';
import type { NavigatorContext, PinnedNotes, VisibilityPreferences } from '../types';
import { TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';
import {
    shouldExcludeFile,
    shouldExcludeFolder,
    createHiddenFileNameMatcherForVisibility,
    getFilteredDocumentFiles,
    getFilteredFiles,
    isPathInExcludedFolder,
    isFolderInExcludedFolder
} from './fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY } from './fileTypeUtils';
import { getEffectiveSortOption, sortFiles } from './sortUtils';
import { TagTreeService } from '../services/TagTreeService';
import { getDBInstance } from '../storage/fileOperations';
import { extractMetadata } from '../utils/metadataExtractor';
import { METADATA_SENTINEL } from '../storage/IndexedDBStorage';
import { getFileDisplayName as getDisplayName } from './fileNameUtils';
import { isFolderNote } from './folderNotes';
import { createHiddenTagVisibility, normalizeTagPathValue } from './tagPrefixMatcher';
import {
    getActiveFileVisibility,
    getActiveHiddenFileNamePatterns,
    getActiveHiddenFiles,
    getActiveHiddenFolders,
    getActiveHiddenTags
} from './vaultProfiles';

interface CollectPinnedPathsOptions {
    restrictToFolderPath?: string;
}

function getParentFolderPath(path: string): string {
    const separatorIndex = path.lastIndexOf('/');
    if (separatorIndex === -1 || separatorIndex === 0) {
        return '/';
    }
    return path.slice(0, separatorIndex);
}

/**
 * Collects all pinned note paths from settings
 */
export function collectPinnedPaths(
    pinnedNotes: PinnedNotes,
    contextFilter?: NavigatorContext,
    options: CollectPinnedPathsOptions = {}
): Set<string> {
    const allPinnedPaths = new Set<string>();

    if (!pinnedNotes || typeof pinnedNotes !== 'object') {
        return allPinnedPaths;
    }

    const restrictToFolderPath = options.restrictToFolderPath;
    const shouldRestrictFolderContext = contextFilter === 'folder' && restrictToFolderPath !== undefined;

    for (const [path, contexts] of Object.entries(pinnedNotes)) {
        if (shouldRestrictFolderContext) {
            const parentPath = getParentFolderPath(path);
            if (parentPath !== restrictToFolderPath) {
                continue;
            }
        }

        if (!contextFilter) {
            // Include all pinned notes
            allPinnedPaths.add(path);
        } else if (contexts[contextFilter]) {
            // Include if pinned in the specified context
            allPinnedPaths.add(path);
        }
    }

    return allPinnedPaths;
}

// Reorders files to place pinned files first, preserving relative order within each group
function applyPinnedOrdering(
    files: TFile[],
    settings: NotebookNavigatorSettings,
    context: NavigatorContext,
    options?: CollectPinnedPathsOptions
): TFile[] {
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, context, options);
    if (pinnedPaths.size === 0) {
        return files;
    }

    const pinnedFiles: TFile[] = [];
    const unpinnedFiles: TFile[] = [];

    for (const file of files) {
        if (pinnedPaths.has(file.path)) {
            pinnedFiles.push(file);
        } else {
            unpinnedFiles.push(file);
        }
    }

    return [...pinnedFiles, ...unpinnedFiles];
}

/**
 * Gets a sorted list of files for a given folder, respecting all plugin settings.
 * This is the primary utility function to be used by the reducer.
 * @param folder - The folder to get files from
 * @param settings - Plugin settings for sorting and filtering
 * @param visibility - Visibility preferences for descendant notes and hidden items display
 * @param app - Obsidian app instance
 */
export function getFilesForFolder(
    folder: TFolder,
    settings: NotebookNavigatorSettings,
    visibility: VisibilityPreferences,
    app: App
): TFile[] {
    const files: TFile[] = [];
    const excludedFolderPatterns = getActiveHiddenFolders(settings);
    const excludedFileProperties = getActiveHiddenFiles(settings);
    const excludedFileNamePatterns = getActiveHiddenFileNamePatterns(settings);
    const fileVisibility = getActiveFileVisibility(settings);
    const fileNameMatcher = createHiddenFileNameMatcherForVisibility(excludedFileNamePatterns, visibility.showHiddenItems);

    // Check if hidden folders should be shown based on UX preference
    const showHiddenFolders = visibility.showHiddenItems;
    const folderHiddenInitially = excludedFolderPatterns.length > 0 && isFolderInExcludedFolder(folder, excludedFolderPatterns);
    if (!showHiddenFolders && folderHiddenInitially) {
        return [];
    }

    // Recursively collect files, tracking excluded folder state through the tree
    const collectFiles = (f: TFolder, parentHidden: boolean): void => {
        for (const child of f.children) {
            if (child instanceof TFile) {
                // Check if file should be displayed based on visibility setting
                if (shouldDisplayFile(child, fileVisibility, app)) {
                    files.push(child);
                }
            } else if (visibility.includeDescendantNotes && child instanceof TFolder) {
                // Include descendant notes when UX preference is enabled
                // Inherit parent's hidden state, then check if this folder is also excluded
                let childHidden = parentHidden;
                if (excludedFolderPatterns.length > 0 && shouldExcludeFolder(child.name, excludedFolderPatterns, child.path)) {
                    childHidden = true;
                }
                const shouldTraverse = showHiddenFolders || !childHidden;
                if (shouldTraverse) {
                    collectFiles(child, childHidden);
                }
            }
        }
    };

    collectFiles(folder, folderHiddenInitially);
    let allFiles: TFile[] = files;
    if (!visibility.showHiddenItems && excludedFileProperties.length > 0) {
        allFiles = files.filter(file => file.extension !== 'md' || !shouldExcludeFile(file, excludedFileProperties, app));
    }
    if (fileNameMatcher) {
        allFiles = allFiles.filter(file => !fileNameMatcher.matches(file));
    }

    // Filter out folder notes if enabled and set to hide
    if (settings.enableFolderNotes && settings.hideFolderNoteInList) {
        allFiles = allFiles.filter(file => {
            if (file.parent && file.parent instanceof TFolder) {
                return !isFolderNote(file, file.parent, {
                    enableFolderNotes: true,
                    folderNoteName: settings.folderNoteName
                });
            }
            return true;
        });
    }

    const sortOption = getEffectiveSortOption(settings, 'folder', folder);

    if (settings.useFrontmatterMetadata) {
        const metadataCache = new Map<string, ReturnType<typeof extractMetadata>>();
        const getCached = (file: TFile) => {
            let v = metadataCache.get(file.path);
            if (!v) {
                v = extractMetadata(app, file, settings);
                metadataCache.set(file.path, v);
            }
            return v;
        };

        sortFiles(
            allFiles,
            sortOption,
            (file: TFile) => {
                const md = getCached(file);
                if (md.fc === undefined || md.fc === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fc === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.ctime;
                }
                return md.fc;
            },
            (file: TFile) => {
                const md = getCached(file);
                if (md.fm === undefined || md.fm === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fm === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.mtime;
                }
                return md.fm;
            },
            (file: TFile) => {
                const md = getCached(file);
                return getDisplayName(file, { fn: md.fn }, settings);
            }
        );
    } else {
        sortFiles(
            allFiles,
            sortOption,
            (file: TFile) => file.stat.ctime,
            (file: TFile) => file.stat.mtime,
            (file: TFile) => file.basename
        );
    }

    const pinnedOrderingOptions = settings.filterPinnedByFolder ? { restrictToFolderPath: folder.path } : undefined;
    return applyPinnedOrdering(allFiles, settings, 'folder', pinnedOrderingOptions);
}

/**
 * Gets a sorted list of files for a given tag, respecting all plugin settings.
 * @param tag - The tag to get files for
 * @param settings - Plugin settings for sorting and filtering
 * @param visibility - Visibility preferences for descendant notes and hidden items display
 * @param app - Obsidian app instance
 * @param tagTreeService - Service for tag tree operations
 */
export function getFilesForTag(
    tag: string,
    settings: NotebookNavigatorSettings,
    visibility: VisibilityPreferences,
    app: App,
    tagTreeService: TagTreeService | null
): TFile[] {
    // Get all files based on visibility setting, with proper filtering
    let allFiles: TFile[] = [];
    const hiddenTags = getActiveHiddenTags(settings);
    const fileVisibility = getActiveFileVisibility(settings);
    const hiddenTagVisibility = createHiddenTagVisibility(hiddenTags, visibility.showHiddenItems);
    const shouldFilterHiddenTags = hiddenTagVisibility.shouldFilterHiddenTags;

    if (fileVisibility === FILE_VISIBILITY.DOCUMENTS) {
        // Only document files (markdown, canvas, base)
        allFiles = getFilteredDocumentFiles(app, settings, { showHiddenItems: visibility.showHiddenItems });
    } else {
        // Get all files with filtering
        allFiles = getFilteredFiles(app, settings, { showHiddenItems: visibility.showHiddenItems });
    }

    const excludedFolderPatterns = getActiveHiddenFolders(settings);
    // For tag views, exclude files in excluded folders only when hidden items are not shown
    // When showing hidden items, include files from excluded folders to match the tag tree
    const baseFiles = visibility.showHiddenItems
        ? allFiles
        : allFiles.filter(
              (file: TFile) => excludedFolderPatterns.length === 0 || !isPathInExcludedFolder(file.path, excludedFolderPatterns)
          );

    let filteredFiles: TFile[] = [];

    const db = getDBInstance();

    // Special case for untagged files
    if (tag === UNTAGGED_TAG_ID) {
        // Only show markdown files in untagged section since only they can be tagged
        filteredFiles = baseFiles.filter(file => {
            if (file.extension !== 'md') {
                return false;
            }
            // Check if the markdown file has tags using our cache
            const fileTags = db.getCachedTags(file.path);
            return fileTags.length === 0;
        });
    } else if (tag === TAGGED_TAG_ID) {
        // Include markdown files that have at least one tag, respecting hidden tag visibility
        const markdownFiles = baseFiles.filter(file => file.extension === 'md');
        filteredFiles = markdownFiles.filter(file => {
            const fileTags = db.getCachedTags(file.path);
            if (fileTags.length === 0) {
                return false;
            }

            if (!shouldFilterHiddenTags) {
                return true;
            }

            return fileTags.some(tagValue => hiddenTagVisibility.isTagVisible(normalizeTagPathValue(tagValue)));
        });
    } else {
        // For regular tags, only consider markdown files since only they can have tags
        const markdownFiles = baseFiles.filter(file => file.extension === 'md');

        // Find the selected tag node using TagTreeService
        const selectedNode = tagTreeService?.findTagNode(tag) || null;

        if (selectedNode) {
            // Collect tags to include based on setting:
            // - When showing notes from descendants: include selected tag and all descendants
            // - Otherwise: include only the exact selected tag
            const tagsToInclude = visibility.includeDescendantNotes
                ? tagTreeService?.collectTagPaths(selectedNode) || new Set<string>()
                : new Set<string>([selectedNode.path]);
            const normalizedTagPaths = new Set(Array.from(tagsToInclude).map(path => normalizeTagPathValue(path)));
            const filteredTagPaths = shouldFilterHiddenTags
                ? new Set(Array.from(normalizedTagPaths).filter(tagPath => hiddenTagVisibility.isTagVisible(tagPath)))
                : normalizedTagPaths;

            if (filteredTagPaths.size === 0) {
                return [];
            }

            // Filter files that have any of the collected tags (case-insensitive)
            filteredFiles = markdownFiles.filter(file => {
                const fileTags = db.getCachedTags(file.path);
                if (fileTags.length === 0) {
                    return false;
                }

                return fileTags.some(tag => {
                    const normalizedTag = normalizeTagPathValue(tag);
                    if (!filteredTagPaths.has(normalizedTag)) {
                        return false;
                    }
                    if (!shouldFilterHiddenTags) {
                        return true;
                    }
                    return hiddenTagVisibility.isTagVisible(tag);
                });
            });
        } else {
            // Fallback to empty if tag not found
            filteredFiles = [];
        }
    }

    // Sort files
    const sortOption = getEffectiveSortOption(settings, 'tag', null, tag);

    if (settings.useFrontmatterMetadata) {
        const metadataCache = new Map<string, ReturnType<typeof extractMetadata>>();
        const getCached = (file: TFile) => {
            let v = metadataCache.get(file.path);
            if (!v) {
                v = extractMetadata(app, file, settings);
                metadataCache.set(file.path, v);
            }
            return v;
        };

        sortFiles(
            filteredFiles,
            sortOption,
            (file: TFile) => {
                const md = getCached(file);
                if (md.fc === undefined || md.fc === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fc === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.ctime;
                }
                return md.fc;
            },
            (file: TFile) => {
                const md = getCached(file);
                if (md.fm === undefined || md.fm === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fm === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.mtime;
                }
                return md.fm;
            },
            (file: TFile) => {
                const md = getCached(file);
                return getDisplayName(file, { fn: md.fn }, settings);
            }
        );
    } else {
        sortFiles(
            filteredFiles,
            sortOption,
            (file: TFile) => file.stat.ctime,
            (file: TFile) => file.stat.mtime,
            (file: TFile) => file.basename
        );
    }

    return applyPinnedOrdering(filteredFiles, settings, 'tag');
}
