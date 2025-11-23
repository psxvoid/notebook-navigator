import { Menu, TFolder } from 'obsidian';
import { strings } from '../i18n';
import { FolderAppearance, getDefaultListMode, resolveListMode } from '../hooks/useListPaneAppearance';
import type { ListDisplayMode, ListNoteGroupingOption } from '../settings/types';
import { NotebookNavigatorSettings } from '../settings';
import { ItemType } from '../types';
import { resolveListGrouping } from '../utils/listGrouping';
import { runAsyncAction } from '../utils/async';

interface AppearanceMenuProps {
    event: MouseEvent;
    settings: NotebookNavigatorSettings;
    selectedFolder: TFolder | null;
    selectedTag?: string | null;
    selectionType?: ItemType;
    updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>;
}

export function showListPaneAppearanceMenu({
    event,
    settings,
    selectedFolder,
    selectedTag,
    selectionType,
    updateSettings
}: AppearanceMenuProps) {
    const defaultMode: ListDisplayMode = getDefaultListMode(settings);

    const updateAppearance = (updates: Partial<FolderAppearance>) => {
        const normalizeAppearance = (appearance: FolderAppearance) => {
            const normalized = { ...appearance };
            if (normalized.mode === defaultMode) {
                delete normalized.mode;
            }
            return normalized;
        };

        if (selectionType === ItemType.TAG && selectedTag) {
            // Update tag appearance
            runAsyncAction(() =>
                updateSettings(s => {
                    const newAppearances = { ...s.tagAppearances };
                    const currentAppearance = newAppearances[selectedTag] || {};
                    newAppearances[selectedTag] = normalizeAppearance({ ...currentAppearance, ...updates });

                    const hasDefinedValues = Object.values(newAppearances[selectedTag]).some(value => value !== undefined);
                    if (!hasDefinedValues) {
                        delete newAppearances[selectedTag];
                    }

                    s.tagAppearances = newAppearances;
                })
            );
        } else if (selectionType === ItemType.FOLDER && selectedFolder) {
            // Update folder appearance
            const folderPath = selectedFolder.path;
            runAsyncAction(() =>
                updateSettings(s => {
                    const newAppearances = { ...s.folderAppearances };
                    const currentAppearance = newAppearances[folderPath] || {};
                    newAppearances[folderPath] = normalizeAppearance({ ...currentAppearance, ...updates });

                    const hasDefinedValues = Object.values(newAppearances[folderPath]).some(value => value !== undefined);
                    if (!hasDefinedValues) {
                        delete newAppearances[folderPath];
                    }

                    s.folderAppearances = newAppearances;
                })
            );
        }
    };

    const menu = new Menu();

    // Get custom appearance settings for the selected folder/tag
    // Will be undefined if no custom appearance has been set
    let appearance: FolderAppearance | undefined;
    if (selectionType === ItemType.TAG && selectedTag) {
        appearance = settings.tagAppearances?.[selectedTag];
    } else if (selectionType === ItemType.FOLDER && selectedFolder) {
        appearance = settings.folderAppearances?.[selectedFolder.path];
    }
    const effectiveMode = resolveListMode({ appearance, defaultMode });

    // Resolve grouping settings to detect custom overrides for this folder/tag
    const groupingInfo = resolveListGrouping({
        settings,
        selectionType,
        folderPath: selectedFolder ? selectedFolder.path : null,
        tag: selectedTag ?? null
    });
    const hasCustomGroupBy = groupingInfo.hasCustomOverride;

    const isStandard = effectiveMode === 'standard';
    const isCompact = effectiveMode === 'compact';

    // Standard preset
    menu.addItem(item => {
        const label =
            defaultMode === 'standard'
                ? `${strings.folderAppearance.standardPreset} ${strings.folderAppearance.defaultSuffix}`
                : strings.folderAppearance.standardPreset;
        item.setTitle(label)
            .setChecked(isStandard)
            .onClick(() => {
                updateAppearance({ mode: 'standard' });
            });
    });

    // Compact preset
    menu.addItem(item => {
        const label =
            defaultMode === 'compact'
                ? `${strings.folderAppearance.compactPreset} ${strings.folderAppearance.defaultSuffix}`
                : strings.folderAppearance.compactPreset;
        item.setTitle(label)
            .setChecked(isCompact)
            .onClick(() => {
                updateAppearance({ mode: 'compact', previewRows: undefined });
            });
    });

    menu.addSeparator();

    // Title rows header
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.titleRows).setIcon('lucide-text').setDisabled(true);
    });

    // Default title rows option
    menu.addItem(item => {
        const hasCustomTitleRows = appearance?.titleRows !== undefined;
        const isDefaultTitle = !hasCustomTitleRows;
        item.setTitle(`    ${strings.folderAppearance.defaultTitleOption(settings.fileNameRows)}`)
            .setChecked(isDefaultTitle)
            .onClick(() => {
                updateAppearance({ titleRows: undefined });
            });
    });

    // Title row options
    [1, 2].forEach(rows => {
        menu.addItem(item => {
            const isChecked = appearance?.titleRows === rows;
            item.setTitle(`    ${strings.folderAppearance.titleRowOption(rows)}`)
                .setChecked(isChecked)
                .onClick(() => {
                    updateAppearance({ titleRows: rows });
                });
        });
    });

    if (settings.showFilePreview && !isCompact) {
        menu.addSeparator();

        // Preview rows header
        menu.addItem(item => {
            item.setTitle(strings.folderAppearance.previewRows).setIcon('lucide-file-text').setDisabled(true);
        });

        // Default preview rows option
        menu.addItem(item => {
            const hasCustomPreviewRows = appearance?.previewRows !== undefined;
            const isDefaultPreview = !hasCustomPreviewRows;
            item.setTitle(`    ${strings.folderAppearance.defaultPreviewOption(settings.previewRows)}`)
                .setChecked(isDefaultPreview)
                .onClick(() => {
                    updateAppearance({ previewRows: undefined });
                });
        });

        // Preview row options
        [1, 2, 3, 4, 5].forEach(rows => {
            menu.addItem(item => {
                const hasCustomPreviewRows = appearance?.previewRows !== undefined;
                const isChecked = hasCustomPreviewRows && appearance?.previewRows === rows;
                item.setTitle(`    ${strings.folderAppearance.previewRowOption(rows)}`)
                    .setChecked(isChecked)
                    .onClick(() => {
                        updateAppearance({ previewRows: rows });
                    });
            });
        });
    }

    const isFolderSelection = selectionType === ItemType.FOLDER && selectedFolder;
    const isTagSelection = selectionType === ItemType.TAG && selectedTag;

    // Add groupBy menu section for folders and tags
    if (isFolderSelection || isTagSelection) {
        menu.addSeparator();

        // Group by header
        menu.addItem(item => {
            item.setTitle(strings.folderAppearance.groupBy).setIcon('lucide-layers').setDisabled(true);
        });

        // Default grouping option (clears custom override)
        const defaultGroupLabel = strings.settings.items.groupNotes.options[groupingInfo.defaultGrouping];

        menu.addItem(item => {
            item.setTitle(`    ${strings.folderAppearance.defaultGroupOption(defaultGroupLabel)}`)
                .setChecked(!hasCustomGroupBy)
                .onClick(() => {
                    updateAppearance({ groupBy: undefined });
                });
        });

        // Custom grouping options (folders support all three, tags only support none/date)
        const groupOptions: ListNoteGroupingOption[] = isFolderSelection ? ['none', 'date', 'folder'] : ['none', 'date'];
        groupOptions.forEach(option => {
            menu.addItem(item => {
                const isChecked = hasCustomGroupBy && groupingInfo.normalizedOverride === option;
                const optionLabel = strings.settings.items.groupNotes.options[option];
                item.setTitle(`    ${optionLabel}`)
                    .setChecked(isChecked)
                    .onClick(() => {
                        updateAppearance({ groupBy: option });
                    });
            });
        });
    }

    menu.showAtMouseEvent(event);
}
