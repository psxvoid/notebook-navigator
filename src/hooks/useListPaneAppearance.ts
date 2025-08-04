import { useMemo } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState } from '../context/SelectionContext';
import { ItemType } from '../types';

export interface FolderAppearance {
    titleRows?: number;
    previewRows?: number;
    showDate?: boolean;
    showPreview?: boolean;
    showImage?: boolean;
}

export type TagAppearance = FolderAppearance;

/**
 * Hook to get effective appearance settings for the current selection (folder or tag)
 * Merges folder/tag-specific settings with defaults
 */
export function useListPaneAppearance() {
    const settings = useSettingsState();
    const { selectedFolder, selectedTag, selectionType } = useSelectionState();

    return useMemo(() => {
        // For folders
        if (selectionType === ItemType.FOLDER && selectedFolder) {
            const folderPath = selectedFolder.path;
            const folderAppearance = settings.folderAppearances?.[folderPath] || {};

            return {
                titleRows: folderAppearance.titleRows ?? settings.fileNameRows,
                previewRows: folderAppearance.previewRows ?? settings.previewRows,
                showDate: folderAppearance.showDate ?? settings.showFileDate,
                showPreview: folderAppearance.showPreview ?? settings.showFilePreview,
                showImage: folderAppearance.showImage ?? settings.showFeatureImage
            };
        }

        // For tags
        if (selectionType === ItemType.TAG && selectedTag) {
            const tagAppearance = settings.tagAppearances?.[selectedTag] || {};

            return {
                titleRows: tagAppearance.titleRows ?? settings.fileNameRows,
                previewRows: tagAppearance.previewRows ?? settings.previewRows,
                showDate: tagAppearance.showDate ?? settings.showFileDate,
                showPreview: tagAppearance.showPreview ?? settings.showFilePreview,
                showImage: tagAppearance.showImage ?? settings.showFeatureImage
            };
        }

        // Default (no selection or other selection types)
        return {
            titleRows: settings.fileNameRows,
            previewRows: settings.previewRows,
            showDate: settings.showFileDate,
            showPreview: settings.showFilePreview,
            showImage: settings.showFeatureImage
        };
    }, [settings, selectedFolder, selectedTag, selectionType]);
}
