import type { NotebookNavigatorSettings } from '../settings';
import type { App, TFile } from 'obsidian';
import { isFolderInExcludedFolder, shouldExcludeFile } from './fileFilters';

// Shared empty array used when hidden items are shown to signal no exclusions should apply
const NO_EXCLUSIONS: string[] = [];
Object.freeze(NO_EXCLUSIONS);

/**
 * Returns the effective list of frontmatter exclusion properties based on the current
 * hidden-item visibility settings. When hidden items are shown, frontmatter-based
 * exclusions should be ignored, so we return a shared empty array to signal no exclusions.
 */
export function getEffectiveFrontmatterExclusions(settings: NotebookNavigatorSettings): string[] {
    return settings.showHiddenItems ? NO_EXCLUSIONS : settings.excludedFiles;
}

/**
 * Detects whether any hidden-item configuration exists so UI surfaces can decide
 * if the toggle button should be shown.
 */
export function hasHiddenItemSources(settings: NotebookNavigatorSettings): boolean {
    return settings.excludedFolders.length > 0 || settings.hiddenTags.length > 0 || settings.excludedFiles.length > 0;
}

/**
 * Disables the showHiddenItems toggle when no hidden sources remain.
 */
export function resetHiddenToggleIfNoSources(settings: NotebookNavigatorSettings): void {
    if (settings.showHiddenItems && !hasHiddenItemSources(settings)) {
        settings.showHiddenItems = false;
    }
}

/**
 * Detects whether a file is hidden by current exclusion settings when hidden items are off.
 */
export function isFileHiddenBySettings(file: TFile, settings: NotebookNavigatorSettings, app: App): boolean {
    if (!file || settings.showHiddenItems) {
        return false;
    }

    const hasHiddenFrontmatter =
        file.extension === 'md' && settings.excludedFiles.length > 0 && shouldExcludeFile(file, settings.excludedFiles, app);
    if (hasHiddenFrontmatter) {
        return true;
    }

    if (settings.excludedFolders.length === 0 || !file.parent) {
        return false;
    }

    return isFolderInExcludedFolder(file.parent, settings.excludedFolders);
}
