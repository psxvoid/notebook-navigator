import { TFile } from 'obsidian';
import { hasExcalidrawFrontmatterFlag, isExcalidrawFile } from './fileNameUtils';
import { isImageExtension } from './fileTypeUtils';
import type { IconId } from '../services/icons/types';

export type FileIconFallbackMode = 'none' | 'file';

interface MetadataCacheLike {
    getFileCache: (
        file: TFile
    ) => { frontmatter?: Record<string, boolean | number | string | object | null | undefined> } | null | undefined;
}

export interface FileIconResolutionSettings {
    showFilenameMatchIcons: boolean;
    fileNameIconMap: Record<string, IconId>;
    showCategoryIcons: boolean;
    fileTypeIconMap: Record<string, IconId>;
}

export interface FileNameIconNeedle {
    needle: string;
    iconId: IconId;
}

export interface ResolveFileIconIdOptions {
    customIconId?: IconId | null;
    metadataCache?: MetadataCacheLike;
    isExternalFile?: boolean;
    allowCategoryIcons?: boolean;
    fallbackMode?: FileIconFallbackMode;
    fileNameNeedles?: readonly FileNameIconNeedle[];
    fileNameForMatch?: string;
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

export function buildFileNameIconNeedles(iconMap: Record<string, IconId>): FileNameIconNeedle[] {
    const needles: FileNameIconNeedle[] = [];
    Object.entries(iconMap).forEach(([key, value]) => {
        if (typeof key !== 'string' || typeof value !== 'string') {
            return;
        }

        const needle = key.trim().toLowerCase();
        const iconId = value.trim();
        if (!needle || !iconId) {
            return;
        }

        needles.push({ needle, iconId });
    });

    needles.sort((a, b) => {
        const lengthDelta = b.needle.length - a.needle.length;
        if (lengthDelta !== 0) {
            return lengthDelta;
        }
        return a.needle.localeCompare(b.needle);
    });

    return needles;
}

export function resolveFileNameMatchIconIdFromNeedles(basename: string, needles: readonly FileNameIconNeedle[]): IconId | null {
    const fileName = basename.toLowerCase();
    if (!fileName) {
        return null;
    }

    for (const entry of needles) {
        if (!entry.needle || !entry.iconId) {
            continue;
        }
        if (fileName.includes(entry.needle)) {
            return entry.iconId;
        }
    }

    return null;
}

export function resolveFileNameMatchIconId(basename: string, iconMap: Record<string, IconId>): IconId | null {
    const needles = buildFileNameIconNeedles(iconMap);
    return resolveFileNameMatchIconIdFromNeedles(basename, needles);
}

export function resolveFileTypeIconId(fileTypeIconKey: string, iconMap: Record<string, IconId>): IconId | null {
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
): IconId | null {
    const customIconId = options.customIconId;
    if (customIconId) {
        return customIconId;
    }

    if (settings.showFilenameMatchIcons) {
        const fileNameNeedles = options.fileNameNeedles ?? buildFileNameIconNeedles(settings.fileNameIconMap);
        const fileNameForMatch = options.fileNameForMatch ?? file.basename;
        const fileNameMatchIconId = resolveFileNameMatchIconIdFromNeedles(fileNameForMatch, fileNameNeedles);
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
    fileTypeIconMap: Record<string, IconId>,
    metadataCache?: MetadataCacheLike,
    preferredIconId?: IconId | null
): IconId {
    if (preferredIconId) {
        return preferredIconId;
    }

    const fileTypeIconKey = resolveFileTypeIconKey(file, metadataCache);
    return resolveFileTypeIconId(fileTypeIconKey, fileTypeIconMap) ?? 'file';
}
