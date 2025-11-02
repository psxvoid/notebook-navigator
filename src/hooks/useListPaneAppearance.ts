import { useMemo } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState } from '../context/SelectionContext';
import type { ListNoteGroupingOption } from '../settings/types';
import { ItemType } from '../types';
import { resolveListGrouping } from '../utils/listGrouping';

export interface FolderAppearance {
    titleRows?: number;
    previewRows?: number;
    showDate?: boolean;
    showPreview?: boolean;
    showImage?: boolean;
    groupBy?: ListNoteGroupingOption;
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
            // Resolve effective grouping mode for this folder
            const grouping = resolveListGrouping({
                settings,
                selectionType,
                folderPath
            });

            return {
                titleRows: folderAppearance.titleRows ?? settings.fileNameRows,
                previewRows: folderAppearance.previewRows ?? settings.previewRows,
                showDate: folderAppearance.showDate ?? settings.showFileDate,
                showPreview: folderAppearance.showPreview ?? settings.showFilePreview,
                showImage: folderAppearance.showImage ?? settings.showFeatureImage,
                groupBy: grouping.effectiveGrouping
            };
        }

        // For tags
        if (selectionType === ItemType.TAG && selectedTag) {
            const tagAppearance = settings.tagAppearances?.[selectedTag] || {};
            // Resolve effective grouping mode for this tag
            const grouping = resolveListGrouping({
                settings,
                selectionType,
                tag: selectedTag
            });

            return {
                titleRows: tagAppearance.titleRows ?? settings.fileNameRows,
                previewRows: tagAppearance.previewRows ?? settings.previewRows,
                showDate: tagAppearance.showDate ?? settings.showFileDate,
                showPreview: tagAppearance.showPreview ?? settings.showFilePreview,
                showImage: tagAppearance.showImage ?? settings.showFeatureImage,
                groupBy: grouping.effectiveGrouping
            };
        }

        // Default (no selection or other selection types)
        // Resolve default grouping mode when no folder or tag is selected
        const grouping = resolveListGrouping({ settings });
        return {
            titleRows: settings.fileNameRows,
            previewRows: settings.previewRows,
            showDate: settings.showFileDate,
            showPreview: settings.showFilePreview,
            showImage: settings.showFeatureImage,
            groupBy: grouping.effectiveGrouping
        };
    }, [settings, selectedFolder, selectedTag, selectionType]);
}
