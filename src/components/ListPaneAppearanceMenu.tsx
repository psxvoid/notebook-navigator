import { Menu } from 'obsidian';
import { strings } from '../i18n';
import { FolderAppearance } from '../hooks/useListPaneFolderSettings';
import { NotebookNavigatorSettings } from '../settings';
import { TFolder } from 'obsidian';

interface FolderAppearanceMenuProps {
    event: MouseEvent;
    titleRows: number;
    previewRows: number;
    showDate: boolean;
    showPreview: boolean;
    showImage: boolean;
    settings: NotebookNavigatorSettings;
    selectedFolder: TFolder | null;
    updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>;
}

export function showListPaneAppearanceMenu({
    event,
    titleRows,
    previewRows,
    showDate,
    showPreview,
    showImage,
    settings,
    selectedFolder,
    updateSettings
}: FolderAppearanceMenuProps) {
    const updateFolderAppearance = (updates: Partial<FolderAppearance>) => {
        if (!selectedFolder) return;

        const folderPath = selectedFolder.path;
        updateSettings(s => {
            const newAppearances = { ...s.folderAppearances };
            const currentAppearance = newAppearances[folderPath] || {};

            // Merge updates
            newAppearances[folderPath] = { ...currentAppearance, ...updates };

            // Remove folder entry if all settings are cleared (back to defaults)
            const hasDefinedValues = Object.values(newAppearances[folderPath]).some(value => value !== undefined);
            if (!hasDefinedValues) {
                delete newAppearances[folderPath];
            }

            s.folderAppearances = newAppearances;
        });
    };

    const menu = new Menu();

    // Check if we're using default values
    // Only true if NO custom values are set for this folder
    const folderPath = selectedFolder?.path || '';
    const folderAppearance = settings.folderAppearances?.[folderPath] || {};
    const hasAnyCustomValues =
        folderAppearance.titleRows !== undefined ||
        folderAppearance.previewRows !== undefined ||
        folderAppearance.showDate !== undefined ||
        folderAppearance.showPreview !== undefined ||
        folderAppearance.showImage !== undefined;

    const isUsingDefaults = !hasAnyCustomValues;

    // Check if we're in slim mode
    const isSlim = !showDate && !showPreview && !showImage;

    // Default preset
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.defaultPreset)
            .setChecked(isUsingDefaults)
            .onClick(() => {
                updateFolderAppearance({
                    titleRows: undefined,
                    previewRows: undefined,
                    showDate: undefined,
                    showPreview: undefined,
                    showImage: undefined
                });
            });
    });

    // Slim preset
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.slimPreset)
            .setChecked(isSlim)
            .onClick(() => {
                updateFolderAppearance({
                    showDate: false,
                    showPreview: false,
                    showImage: false
                });
            });
    });

    menu.addSeparator();

    // Title rows header
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.titleRows).setIcon('text').setDisabled(true);
    });

    // Default title rows option
    menu.addItem(item => {
        const hasCustomTitleRows = folderAppearance.titleRows !== undefined;
        const isDefaultTitle = titleRows === settings.fileNameRows && !hasCustomTitleRows;
        item.setTitle('    ' + strings.folderAppearance.defaultTitleOption(settings.fileNameRows))
            .setChecked(isDefaultTitle && !isSlim)
            .onClick(() => {
                updateFolderAppearance({ titleRows: undefined });
            });
    });

    // Title row options
    [1, 2].forEach(rows => {
        menu.addItem(item => {
            const hasCustomTitleRows = folderAppearance.titleRows !== undefined;
            const isChecked = titleRows === rows && hasCustomTitleRows && !isSlim;
            item.setTitle('    ' + strings.folderAppearance.titleRowOption(rows))
                .setChecked(isChecked)
                .onClick(() => {
                    updateFolderAppearance({ titleRows: rows });
                });
        });
    });

    menu.addSeparator();

    // Preview rows header
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.previewRows).setIcon('file-text').setDisabled(true);
    });

    // Default preview rows option
    menu.addItem(item => {
        const hasCustomPreviewRows = folderAppearance.previewRows !== undefined;
        const isDefaultPreview = previewRows === settings.previewRows && !hasCustomPreviewRows;
        item.setTitle('    ' + strings.folderAppearance.defaultPreviewOption(settings.previewRows))
            .setChecked(isDefaultPreview && !isSlim)
            .onClick(() => {
                updateFolderAppearance({ previewRows: undefined });
            });
    });

    // Preview row options
    [1, 2, 3, 4, 5].forEach(rows => {
        menu.addItem(item => {
            const hasCustomPreviewRows = folderAppearance.previewRows !== undefined;
            const isChecked = previewRows === rows && hasCustomPreviewRows && !isSlim;
            item.setTitle('    ' + strings.folderAppearance.previewRowOption(rows))
                .setChecked(isChecked)
                .onClick(() => {
                    updateFolderAppearance({ previewRows: rows });
                });
        });
    });

    menu.showAtMouseEvent(event);
}
