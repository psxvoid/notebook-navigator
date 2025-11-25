import { useMemo } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState } from '../context/SelectionContext';
import type { ListDisplayMode, ListNoteGroupingOption } from '../settings/types';
import type { NotebookNavigatorSettings } from '../settings';
import { ItemType } from '../types';
import { resolveListGrouping } from '../utils/listGrouping';

export interface FolderAppearance {
    mode?: ListDisplayMode;
    titleRows?: number;
    previewRows?: number;
    groupBy?: ListNoteGroupingOption;
}

export type TagAppearance = FolderAppearance;

export function getDefaultListMode(settings: NotebookNavigatorSettings): ListDisplayMode {
    return settings.defaultListMode === 'compact' ? 'compact' : 'standard';
}

/**
 * Resolve the effective list mode for a folder/tag appearance.
 */
export function resolveListMode({
    appearance,
    defaultMode
}: {
    appearance?: FolderAppearance;
    defaultMode: ListDisplayMode;
}): ListDisplayMode {
    if (appearance?.mode === 'compact' || appearance?.mode === 'standard') {
        return appearance.mode;
    }

    return defaultMode;
}

/** Return visibility flags for a given list mode */
function getVisibilityForMode(mode: ListDisplayMode, settings: NotebookNavigatorSettings) {
    if (mode === 'compact') {
        return {
            showDate: false,
            showPreview: false,
            showImage: false
        };
    }

    return {
        showDate: settings.showFileDate,
        showPreview: settings.showFilePreview,
        showImage: settings.showFeatureImage
    };
}

/**
 * Hook to get effective appearance settings for the current selection (folder or tag)
 * Merges folder/tag-specific settings with defaults
 */
export function useListPaneAppearance() {
    const settings = useSettingsState();
    const { selectedFolder, selectedTag, selectionType } = useSelectionState();

    return useMemo(() => {
        const defaultMode = getDefaultListMode(settings);

        const buildAppearance = (appearance: FolderAppearance | undefined) => {
            const mode = resolveListMode({ appearance, defaultMode });
            const visibility = getVisibilityForMode(mode, settings);

            return {
                mode,
                titleRows: appearance?.titleRows ?? settings.fileNameRows,
                previewRows: appearance?.previewRows ?? settings.previewRows,
                showDate: visibility.showDate,
                showPreview: visibility.showPreview,
                showImage: visibility.showImage
            };
        };

        // For folders
        if (selectionType === ItemType.FOLDER && selectedFolder) {
            const folderPath = selectedFolder.path;
            const folderAppearance = settings.folderAppearances?.[folderPath];
            // Resolve effective grouping mode for this folder
            const grouping = resolveListGrouping({
                settings,
                selectionType,
                folderPath
            });

            const appearance = buildAppearance(folderAppearance);

            return {
                ...appearance,
                groupBy: grouping.effectiveGrouping
            };
        }

        // For tags
        if (selectionType === ItemType.TAG && selectedTag) {
            const tagAppearance = settings.tagAppearances?.[selectedTag];
            // Resolve effective grouping mode for this tag
            const grouping = resolveListGrouping({
                settings,
                selectionType,
                tag: selectedTag
            });

            const appearance = buildAppearance(tagAppearance);

            return {
                ...appearance,
                groupBy: grouping.effectiveGrouping
            };
        }

        // Default (no selection or other selection types)
        // Resolve default grouping mode when no folder or tag is selected
        const grouping = resolveListGrouping({ settings });
        const appearance = buildAppearance(undefined);
        return {
            ...appearance,
            groupBy: grouping.effectiveGrouping
        };
    }, [settings, selectedFolder, selectedTag, selectionType]);
}
