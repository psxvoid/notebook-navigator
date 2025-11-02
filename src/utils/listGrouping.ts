import { ItemType } from '../types';
import type { NotebookNavigatorSettings } from '../settings';
import type { ListNoteGroupingOption } from '../settings/types';

interface ResolveListGroupingParams {
    settings: NotebookNavigatorSettings;
    selectionType?: ItemType;
    folderPath?: string | null;
    tag?: string | null;
}

interface ListGroupingResolution {
    defaultGrouping: ListNoteGroupingOption;
    effectiveGrouping: ListNoteGroupingOption;
    normalizedOverride: ListNoteGroupingOption | undefined;
    hasCustomOverride: boolean;
}

/**
 * Calculates effective list grouping for the current selection.
 * Normalizes legacy tag overrides that stored "folder" by falling back to the tag default.
 */
export function resolveListGrouping({ settings, selectionType, folderPath, tag }: ResolveListGroupingParams): ListGroupingResolution {
    const globalDefault: ListNoteGroupingOption = settings.noteGrouping ?? 'none';

    // Folder selection: use folder-specific override if set, otherwise use global default
    if (selectionType === ItemType.FOLDER && folderPath) {
        const rawOverride = settings.folderAppearances?.[folderPath]?.groupBy;
        return {
            defaultGrouping: globalDefault,
            effectiveGrouping: rawOverride ?? globalDefault,
            normalizedOverride: rawOverride,
            hasCustomOverride: rawOverride !== undefined
        };
    }

    // Tag selection: tags don't support "folder" grouping, so normalize default and overrides
    if (selectionType === ItemType.TAG && tag) {
        const rawOverride = settings.tagAppearances?.[tag]?.groupBy;
        // If global default is "folder", fall back to "date" for tags
        const defaultTagGrouping: ListNoteGroupingOption = globalDefault === 'folder' ? 'date' : globalDefault;

        // Treat undefined or "folder" overrides as no custom setting
        if (rawOverride === undefined || rawOverride === 'folder') {
            return {
                defaultGrouping: defaultTagGrouping,
                effectiveGrouping: defaultTagGrouping,
                normalizedOverride: undefined,
                hasCustomOverride: false
            };
        }

        // Valid custom override for tag (none or date)
        return {
            defaultGrouping: defaultTagGrouping,
            effectiveGrouping: rawOverride,
            normalizedOverride: rawOverride,
            hasCustomOverride: true
        };
    }

    // No specific selection or other selection types: use global default
    return {
        defaultGrouping: globalDefault,
        effectiveGrouping: globalDefault,
        normalizedOverride: undefined,
        hasCustomOverride: false
    };
}
