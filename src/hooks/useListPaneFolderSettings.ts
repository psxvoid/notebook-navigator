import { useMemo } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState } from '../context/SelectionContext';

export interface FolderAppearance {
    titleRows?: number;
    previewRows?: number;
    showDate?: boolean;
    showPreview?: boolean;
    showImage?: boolean;
}

/**
 * Hook to get effective settings for the current folder
 * Merges folder-specific settings with defaults
 */
export function useListPaneFolderSettings() {
    const settings = useSettingsState();
    const { selectedFolder } = useSelectionState();

    return useMemo(() => {
        const folderPath = selectedFolder?.path || '';
        const folderAppearance = settings.folderAppearances?.[folderPath] || {};

        return {
            titleRows: folderAppearance.titleRows ?? settings.fileNameRows,
            previewRows: folderAppearance.previewRows ?? settings.previewRows,
            showDate: folderAppearance.showDate ?? settings.showFileDate,
            showPreview: folderAppearance.showPreview ?? settings.showFilePreview,
            showImage: folderAppearance.showImage ?? settings.showFeatureImage
        };
    }, [settings, selectedFolder]);
}
