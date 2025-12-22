import { TFile } from 'obsidian';
import { hasExcalidrawFrontmatterFlag, isExcalidrawFile } from './fileNameUtils';
import { isImageExtension } from './fileTypeUtils';

export type FileIconFallbackMode = 'none' | 'file';

interface MetadataCacheLike {
    getFileCache: (
        file: TFile
    ) => { frontmatter?: Record<string, boolean | number | string | object | null | undefined> } | null | undefined;
}

export interface FileIconResolutionSettings {
    showFilenameMatchIcons: boolean;
    fileNameIconMap: Record<string, string>;
    showCategoryIcons: boolean;
    fileTypeIconMap: Record<string, string>;
}

export interface ResolveFileIconIdOptions {
    customIconId?: string | null;
    metadataCache?: MetadataCacheLike;
    isExternalFile?: boolean;
    allowCategoryIcons?: boolean;
    fallbackMode?: FileIconFallbackMode;
}

const BUILT_IN_FILE_TYPE_ICON_MAP = Object.freeze(
    Object.assign(Object.create(null) as Record<string, string>, {
        md: 'file-text',
        'excalidraw.md': 'pencil',
        canvas: 'layout-grid',
        base: 'database',
        pdf: 'file-text'
    })
);

export function resolveFileTypeIconKey(file: TFile, metadataCache?: MetadataCacheLike): string {
    if (isExcalidrawFile(file)) {
        return 'excalidraw.md';
    }

    const extension = file.extension.toLowerCase();
    if (extension === 'md') {
        const fileCache = metadataCache?.getFileCache(file);
        if (hasExcalidrawFrontmatterFlag(fileCache?.frontmatter)) {
            return 'excalidraw.md';
        }
    }

    return extension;
}

export function resolveFileNameMatchIconId(basename: string, iconMap: Record<string, string>): string | null {
    const fileName = basename.toLowerCase();
    if (!fileName) {
        return null;
    }

    let bestNeedle: string | null = null;
    let bestIconId: string | null = null;

    for (const needle in iconMap) {
        if (!Object.prototype.hasOwnProperty.call(iconMap, needle)) {
            continue;
        }

        const iconId = iconMap[needle];
        if (!needle || !iconId) {
            continue;
        }

        if (!fileName.includes(needle)) {
            continue;
        }

        if (
            !bestNeedle ||
            needle.length > bestNeedle.length ||
            (needle.length === bestNeedle.length && needle.localeCompare(bestNeedle) < 0)
        ) {
            bestNeedle = needle;
            bestIconId = iconId;
        }
    }

    return bestIconId;
}

export function resolveFileTypeIconId(fileTypeIconKey: string, iconMap: Record<string, string>): string | null {
    if (!fileTypeIconKey) {
        return null;
    }

    const resolved = iconMap[fileTypeIconKey] ?? BUILT_IN_FILE_TYPE_ICON_MAP[fileTypeIconKey];
    if (resolved) {
        return resolved;
    }

    if (isImageExtension(fileTypeIconKey)) {
        return 'image';
    }

    return null;
}

export function resolveFileIconId(
    file: TFile,
    settings: FileIconResolutionSettings,
    options: ResolveFileIconIdOptions = {}
): string | null {
    const customIconId = options.customIconId;
    if (customIconId) {
        return customIconId;
    }

    if (settings.showFilenameMatchIcons) {
        const fileNameMatchIconId = resolveFileNameMatchIconId(file.basename, settings.fileNameIconMap);
        if (fileNameMatchIconId) {
            return fileNameMatchIconId;
        }
    }

    const allowCategoryIcons = options.allowCategoryIcons ?? settings.showCategoryIcons;
    if (allowCategoryIcons) {
        const fileTypeIconKey = resolveFileTypeIconKey(file, options.metadataCache);
        const fileTypeIconId = resolveFileTypeIconId(fileTypeIconKey, settings.fileTypeIconMap);
        if (fileTypeIconId) {
            return fileTypeIconId;
        }
    }

    if (options.isExternalFile) {
        return 'external-link';
    }

    const fallbackMode = options.fallbackMode ?? (allowCategoryIcons ? 'file' : 'none');
    if (fallbackMode === 'file') {
        return 'file';
    }

    return null;
}

export function resolveFileDragIconId(
    file: TFile,
    fileTypeIconMap: Record<string, string>,
    metadataCache?: MetadataCacheLike,
    preferredIconId?: string | null
): string {
    if (preferredIconId) {
        return preferredIconId;
    }

    const fileTypeIconKey = resolveFileTypeIconKey(file, metadataCache);
    return resolveFileTypeIconId(fileTypeIconKey, fileTypeIconMap) ?? 'file';
}
