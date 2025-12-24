/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad, modifications by Pavel Sapehin
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Setting, ButtonComponent, App, TAbstractFile, TFile } from 'obsidian';
import { strings } from '../../i18n';
import { showNotice } from '../../utils/noticeUtils';
import { ISO_DATE_FORMAT } from '../../utils/dateUtils';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { SettingsTabContext } from './SettingsTabContext';
import { runAsyncAction } from '../../utils/async';
import { createSettingGroupFactory } from '../settingGroups';
import { setElementVisible, wireToggleSettingWithSubSettings } from '../subSettings';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import {
    normalizeFileNameIconMapKey,
    normalizeFileTypeIconMapKey,
    parseIconMapText,
    serializeIconMapRecord,
    type IconMapParseResult
} from '../../utils/iconizeFormat';
import { formatCommaSeparatedList, normalizeCommaSeparatedList, parseCommaSeparatedList } from '../../utils/commaSeparatedListUtils';

import { buildTextReplaceSettings } from './common/TextReplaceSettingsBuilder';

/**
 * Type guard to check if a file is a markdown file
 * @param file - The file to check
 * @returns True if the file is a markdown file
 */
function isMarkdownFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile && file.extension === 'md';
}

/**
 * Counts the number of markdown files with metadata entries
 * @param records - Record of file paths to metadata values
 * @param app - The Obsidian app instance
 * @returns The number of markdown files with metadata entries
 */
function countMarkdownMetadataEntries(records: Record<string, string> | undefined, app: App): number {
    if (!records) {
        return 0;
    }

    let count = 0;
    for (const path of Object.keys(records)) {
        const file = app.vault.getAbstractFileByPath(path);
        if (isMarkdownFile(file)) {
            count += 1;
        }
    }
    return count;
}

function parseFileTypeIconMapText(value: string): IconMapParseResult {
    return parseIconMapText(value, normalizeFileTypeIconMapKey);
}

function parseFileNameIconMapText(value: string): IconMapParseResult {
    return parseIconMapText(value, normalizeFileNameIconMapKey);
}

/** Renders the notes settings tab */
export function renderNotesTab(context: SettingsTabContext): void {
    const { app, containerEl, plugin } = context;

    const createGroup = createSettingGroupFactory(containerEl);
    const frontmatterGroup = createGroup(strings.settings.groups.notes.frontmatter);

    const useFrontmatterSetting = frontmatterGroup.addSetting(setting => {
        setting.setName(strings.settings.items.useFrontmatterDates.name).setDesc(strings.settings.items.useFrontmatterDates.desc);
    });

    const frontmatterSettingsEl = wireToggleSettingWithSubSettings(
        useFrontmatterSetting,
        () => plugin.settings.useFrontmatterMetadata,
        async value => {
            plugin.settings.useFrontmatterMetadata = value;
            await plugin.saveSettingsAndUpdate();
            // Use context directly to satisfy eslint exhaustive-deps requirements
            context.requestStatisticsRefresh();
        }
    );
    // Function to update visibility of frontmatter save setting based on field values
    let updateFrontmatterSaveVisibility: (() => void) | null = null;

    const frontmatterIconSetting = context.createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterIconField.name,
        strings.settings.items.frontmatterIconField.desc,
        strings.settings.items.frontmatterIconField.placeholder,
        () => plugin.settings.frontmatterIconField,
        value => {
            plugin.settings.frontmatterIconField = value || '';
            updateFrontmatterSaveVisibility?.();
        },
        undefined,
        () => context.requestStatisticsRefresh()
    );
    frontmatterIconSetting.controlEl.addClass('nn-setting-wide-input');

    const frontmatterColorSetting = context.createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterColorField.name,
        strings.settings.items.frontmatterColorField.desc,
        strings.settings.items.frontmatterColorField.placeholder,
        () => plugin.settings.frontmatterColorField,
        value => {
            plugin.settings.frontmatterColorField = value || '';
            updateFrontmatterSaveVisibility?.();
        },
        undefined,
        () => context.requestStatisticsRefresh()
    );
    frontmatterColorSetting.controlEl.addClass('nn-setting-wide-input');

    // Setting to control whether metadata is saved to frontmatter
    const frontmatterSaveSetting = new Setting(frontmatterSettingsEl)
        .setName(strings.settings.items.frontmatterSaveMetadata.name)
        .setDesc(strings.settings.items.frontmatterSaveMetadata.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.saveMetadataToFrontmatter).onChange(async value => {
                plugin.settings.saveMetadataToFrontmatter = value;
                await plugin.saveSettingsAndUpdate();
                updateMigrationDescription();
                updateFrontmatterSaveVisibility?.();
            })
        );

    // Show frontmatter save setting only when icon or color fields are configured
    updateFrontmatterSaveVisibility = () => {
        const hasIconField = plugin.settings.frontmatterIconField.trim().length > 0;
        const hasColorField = plugin.settings.frontmatterColorField.trim().length > 0;
        const canSaveMetadata = hasIconField || hasColorField;
        setElementVisible(frontmatterSaveSetting.settingEl, canSaveMetadata);
    };

    updateFrontmatterSaveVisibility();

    let migrateButton: ButtonComponent | null = null;

    const migrationSetting = new Setting(frontmatterSettingsEl).setName(strings.settings.items.frontmatterMigration.name);

    migrationSetting.addButton(button => {
        migrateButton = button;
        button.setButtonText(strings.settings.items.frontmatterMigration.button);
        button.setCta();
        // Migrate metadata to frontmatter without blocking the UI
        button.onClick(() => {
            runAsyncAction(async () => {
                if (!plugin.metadataService) {
                    return;
                }

                button.setDisabled(true);
                button.setButtonText(strings.settings.items.frontmatterMigration.buttonWorking);

                try {
                    const result = await plugin.metadataService.migrateFileMetadataToFrontmatter();
                    updateMigrationDescription();

                    const { iconsBefore, colorsBefore, migratedIcons, migratedColors, failures } = result;

                    if (iconsBefore === 0 && colorsBefore === 0) {
                        showNotice(strings.settings.items.frontmatterMigration.noticeNone);
                    } else if (migratedIcons === 0 && migratedColors === 0) {
                        showNotice(strings.settings.items.frontmatterMigration.noticeNone);
                    } else {
                        let message = strings.settings.items.frontmatterMigration.noticeDone
                            .replace('{migratedIcons}', migratedIcons.toString())
                            .replace('{icons}', iconsBefore.toString())
                            .replace('{migratedColors}', migratedColors.toString())
                            .replace('{colors}', colorsBefore.toString());
                        if (failures > 0) {
                            message += ` ${strings.settings.items.frontmatterMigration.noticeFailures.replace('{failures}', failures.toString())}`;
                        }
                        showNotice(message, { variant: 'success' });
                    }
                } catch (error) {
                    console.error('Failed to migrate icon/color metadata to frontmatter', error);
                    showNotice(strings.settings.items.frontmatterMigration.noticeError, {
                        timeout: TIMEOUTS.NOTICE_ERROR,
                        variant: 'warning'
                    });
                } finally {
                    button.setButtonText(strings.settings.items.frontmatterMigration.button);
                    button.setDisabled(false);
                    updateMigrationDescription();
                    context.requestStatisticsRefresh();
                }
            });
        });
    });

    /** Updates the migration setting description based on pending migrations */
    const updateMigrationDescription = () => {
        const descriptionEl = migrationSetting.descEl;
        descriptionEl.empty();

        const iconsBefore = countMarkdownMetadataEntries(plugin.settings.fileIcons, app);
        const colorsBefore = countMarkdownMetadataEntries(plugin.settings.fileColors, app);
        const noMigrationsPending = iconsBefore === 0 && colorsBefore === 0;

        const descriptionText = strings.settings.items.frontmatterMigration.desc
            .replace('{icons}', iconsBefore.toString())
            .replace('{colors}', colorsBefore.toString());

        descriptionEl.createDiv({ text: descriptionText });
        const shouldShow = !noMigrationsPending && plugin.settings.saveMetadataToFrontmatter;
        migrateButton?.setDisabled(!plugin.settings.saveMetadataToFrontmatter || noMigrationsPending);
        setElementVisible(migrationSetting.settingEl, shouldShow);
    };

    updateMigrationDescription();

    context.createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterNameField.name,
        strings.settings.items.frontmatterNameField.desc,
        strings.settings.items.frontmatterNameField.placeholder,
        () => normalizeCommaSeparatedList(plugin.settings.frontmatterNameField),
        value => {
            plugin.settings.frontmatterNameField = normalizeCommaSeparatedList(value);
        },
        undefined,
        () => context.requestStatisticsRefresh()
    );

    context.createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterCreatedField.name,
        strings.settings.items.frontmatterCreatedField.desc,
        strings.settings.items.frontmatterCreatedField.placeholder,
        () => plugin.settings.frontmatterCreatedField,
        value => {
            plugin.settings.frontmatterCreatedField = value;
        },
        undefined,
        () => context.requestStatisticsRefresh()
    );

    context.createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterModifiedField.name,
        strings.settings.items.frontmatterModifiedField.desc,
        strings.settings.items.frontmatterModifiedField.placeholder,
        () => plugin.settings.frontmatterModifiedField,
        value => {
            plugin.settings.frontmatterModifiedField = value;
        },
        undefined,
        () => context.requestStatisticsRefresh()
    );

    const dateFormatSetting = context
        .createDebouncedTextSetting(
            frontmatterSettingsEl,
            strings.settings.items.frontmatterDateFormat.name,
            strings.settings.items.frontmatterDateFormat.desc,
            ISO_DATE_FORMAT,
            () => plugin.settings.frontmatterDateFormat,
            value => {
                plugin.settings.frontmatterDateFormat = value;
            },
            undefined,
            () => context.requestStatisticsRefresh()
        )
        .addExtraButton(button =>
            button
                .setIcon('lucide-help-circle')
                .setTooltip(strings.settings.items.frontmatterDateFormat.helpTooltip)
                .onClick(() => {
                    showNotice(strings.settings.items.frontmatterDateFormat.help, { timeout: TIMEOUTS.NOTICE_HELP });
                })
        );
    dateFormatSetting.controlEl.addClass('nn-setting-wide-input');

    const metadataInfoContainer = frontmatterSettingsEl.createDiv('nn-setting-info-container');
    const metadataInfoEl = metadataInfoContainer.createEl('div', {
        cls: 'setting-item-description'
    });
    context.registerMetadataInfoElement(metadataInfoEl);

    const iconGroup = createGroup(strings.settings.groups.notes.icon);
    const titleGroup = createGroup(strings.settings.groups.notes.title);
    const previewTextGroup = createGroup(strings.settings.groups.notes.previewText);
    const featureImageGroup = createGroup(strings.settings.groups.notes.featureImage);
    const tagsGroup = createGroup(strings.settings.groups.notes.tags);
    const dateGroup = createGroup(strings.settings.groups.notes.date);
    const parentFolderGroup = createGroup(strings.settings.groups.notes.parentFolder);

    const setGroupVisible = (groupRootEl: HTMLElement, visible: boolean) => {
        setElementVisible(groupRootEl, visible);

        const headingEl = groupRootEl.previousElementSibling;
        if (headingEl instanceof HTMLElement && headingEl.classList.contains('setting-item-heading')) {
            setElementVisible(headingEl, visible);
        }
    };

    const showFileIconsSetting = iconGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showFileIcons.name).setDesc(strings.settings.items.showFileIcons.desc);
    });

    const fileIconSubSettingsEl = wireToggleSettingWithSubSettings(
        showFileIconsSetting,
        () => plugin.settings.showFileIcons,
        async value => {
            plugin.settings.showFileIcons = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    let updateFileNameIconMapVisibility: (() => void) | null = null;
    let updateFileTypeIconMapVisibility: (() => void) | null = null;

    new Setting(fileIconSubSettingsEl)
        .setName(strings.settings.items.showFilenameMatchIcons.name)
        .setDesc(strings.settings.items.showFilenameMatchIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFilenameMatchIcons).onChange(async value => {
                plugin.settings.showFilenameMatchIcons = value;
                await plugin.saveSettingsAndUpdate();
                updateFileNameIconMapVisibility?.();
            })
        );

    const fileNameIconMapSetting = context.createDebouncedTextAreaSetting(
        fileIconSubSettingsEl,
        strings.settings.items.fileNameIconMap.name,
        strings.settings.items.fileNameIconMap.desc,
        strings.settings.items.fileNameIconMap.placeholder,
        () => serializeIconMapRecord(plugin.settings.fileNameIconMap),
        value => {
            const parsed = parseFileNameIconMapText(value);
            plugin.settings.fileNameIconMap = parsed.map;
        },
        {
            rows: 3,
            validator: value => parseFileNameIconMapText(value).invalidLines.length === 0
        }
    );

    fileNameIconMapSetting.addExtraButton(button =>
        button
            .setIcon('lucide-rotate-ccw')
            .setTooltip(strings.settings.items.fileNameIconMap.resetTooltip)
            .onClick(async () => {
                plugin.settings.fileNameIconMap = { ...DEFAULT_SETTINGS.fileNameIconMap };

                const textarea = fileNameIconMapSetting.controlEl.querySelector('textarea');
                if (textarea instanceof HTMLTextAreaElement) {
                    textarea.value = serializeIconMapRecord(plugin.settings.fileNameIconMap);
                }

                await plugin.saveSettingsAndUpdate();
            })
    );
    fileNameIconMapSetting.controlEl.addClass('nn-setting-wide-input');
    updateFileNameIconMapVisibility = () => {
        setElementVisible(fileNameIconMapSetting.settingEl, plugin.settings.showFilenameMatchIcons);
    };
    updateFileNameIconMapVisibility();

    new Setting(fileIconSubSettingsEl)
        .setName(strings.settings.items.showCategoryIcons.name)
        .setDesc(strings.settings.items.showCategoryIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showCategoryIcons).onChange(async value => {
                plugin.settings.showCategoryIcons = value;
                await plugin.saveSettingsAndUpdate();
                updateFileTypeIconMapVisibility?.();
            })
        );

    const fileTypeIconMapSetting = context.createDebouncedTextAreaSetting(
        fileIconSubSettingsEl,
        strings.settings.items.fileTypeIconMap.name,
        strings.settings.items.fileTypeIconMap.desc,
        strings.settings.items.fileTypeIconMap.placeholder,
        () => serializeIconMapRecord(plugin.settings.fileTypeIconMap),
        value => {
            const parsed = parseFileTypeIconMapText(value);
            plugin.settings.fileTypeIconMap = parsed.map;
        },
        {
            rows: 3,
            validator: value => parseFileTypeIconMapText(value).invalidLines.length === 0
        }
    );

    fileTypeIconMapSetting.addExtraButton(button =>
        button
            .setIcon('lucide-rotate-ccw')
            .setTooltip(strings.settings.items.fileTypeIconMap.resetTooltip)
            .onClick(async () => {
                plugin.settings.fileTypeIconMap = { ...DEFAULT_SETTINGS.fileTypeIconMap };

                const textarea = fileTypeIconMapSetting.controlEl.querySelector('textarea');
                if (textarea instanceof HTMLTextAreaElement) {
                    textarea.value = serializeIconMapRecord(plugin.settings.fileTypeIconMap);
                }

                await plugin.saveSettingsAndUpdate();
            })
    );
    fileTypeIconMapSetting.controlEl.addClass('nn-setting-wide-input');
    updateFileTypeIconMapVisibility = () => {
        setElementVisible(fileTypeIconMapSetting.settingEl, plugin.settings.showCategoryIcons);
    };
    updateFileTypeIconMapVisibility();

    titleGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.fileNameRows.name)
            .setDesc(strings.settings.items.fileNameRows.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('1', strings.settings.items.fileNameRows.options['1'])
                    .addOption('2', strings.settings.items.fileNameRows.options['2'])
                    .setValue(plugin.settings.fileNameRows.toString())
                    .onChange(async value => {
                        plugin.settings.fileNameRows = parseInt(value, 10);
                        await plugin.saveSettingsAndUpdate();
                    })
            );
    });

    buildTextReplaceSettings({
        getSource: () => plugin.settings.noteTitleTransform,
        rootGroupFactory: titleGroup,
        getSettingFactory: () => (parentEl: HTMLElement) => createSettingGroupFactory(parentEl)(),
        getPlugin: () => plugin,
        optionName: strings.settings.items.titleTransformName
    })

    const showPreviewSetting = previewTextGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showFilePreview.name).setDesc(strings.settings.items.showFilePreview.desc);
    });

    const previewSettingsEl = wireToggleSettingWithSubSettings(
        showPreviewSetting,
        () => plugin.settings.showFilePreview,
        async value => {
            plugin.settings.showFilePreview = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    new Setting(previewSettingsEl)
        .setName(strings.settings.items.skipHeadingsInPreview.name)
        .setDesc(strings.settings.items.skipHeadingsInPreview.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.skipHeadingsInPreview).onChange(async value => {
                plugin.settings.skipHeadingsInPreview = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(previewSettingsEl)
        .setName(strings.settings.items.skipCodeBlocksInPreview.name)
        .setDesc(strings.settings.items.skipCodeBlocksInPreview.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.skipCodeBlocksInPreview).onChange(async value => {
                plugin.settings.skipCodeBlocksInPreview = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(previewSettingsEl)
        .setName(strings.settings.items.stripHtmlInPreview.name)
        .setDesc(strings.settings.items.stripHtmlInPreview.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.stripHtmlInPreview).onChange(async value => {
                plugin.settings.stripHtmlInPreview = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(previewSettingsEl)
        .setName(strings.settings.items.previewRows.name)
        .setDesc(strings.settings.items.previewRows.desc)
        .addDropdown(dropdown =>
            dropdown
                .addOption('1', strings.settings.items.previewRows.options['1'])
                .addOption('2', strings.settings.items.previewRows.options['2'])
                .addOption('3', strings.settings.items.previewRows.options['3'])
                .addOption('4', strings.settings.items.previewRows.options['4'])
                .addOption('5', strings.settings.items.previewRows.options['5'])
                .setValue(plugin.settings.previewRows.toString())
                .onChange(async value => {
                    plugin.settings.previewRows = parseInt(value, 10);
                    await plugin.saveSettingsAndUpdate();
                })
        );

    const previewPropertiesSetting = context.createDebouncedTextSetting(
        previewSettingsEl,
        strings.settings.items.previewProperties.name,
        strings.settings.items.previewProperties.desc,
        strings.settings.items.previewProperties.placeholder,
        () => formatCommaSeparatedList(plugin.settings.previewProperties),
        value => {
            plugin.settings.previewProperties = parseCommaSeparatedList(value);
        }
    );
    previewPropertiesSetting.controlEl.addClass('nn-setting-wide-input');

    const previewInfoContainer = previewSettingsEl.createDiv('nn-setting-info-container');
    const previewInfoDiv = previewInfoContainer.createEl('div', {
        cls: 'setting-item-description'
    });
    previewInfoDiv.createSpan({ text: strings.settings.items.previewProperties.info });

    buildTextReplaceSettings({
        getSource: () => plugin.settings.notePreviewTransform,
        rootGroupFactory: {
            rootEl: previewSettingsEl,
            addSetting: (callback: (cbSetting: Setting) => void) => {
                callback(new Setting(previewSettingsEl))
            }
        },
        getSettingFactory: () => (parentEl: HTMLElement) => createSettingGroupFactory(parentEl)(),
        getPlugin: () => plugin,
        optionName: strings.settings.items.previewTransformName
    })

    const showFeatureImageSetting = featureImageGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showFeatureImage.name).setDesc(strings.settings.items.showFeatureImage.desc);
    });

    const featureImageSettingsEl = wireToggleSettingWithSubSettings(
        showFeatureImageSetting,
        () => plugin.settings.showFeatureImage,
        async value => {
            plugin.settings.showFeatureImage = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    const featurePropertiesSetting = context.createDebouncedTextSetting(
        featureImageSettingsEl,
        strings.settings.items.featureImageProperties.name,
        strings.settings.items.featureImageProperties.desc,
        strings.settings.items.featureImageProperties.placeholder,
        () => formatCommaSeparatedList(plugin.settings.featureImageProperties),
        value => {
            plugin.settings.featureImageProperties = parseCommaSeparatedList(value);
        }
    );
    featurePropertiesSetting.controlEl.addClass('nn-setting-wide-input');

    new Setting(featureImageSettingsEl)
        .setName(strings.settings.items.forceSquareFeatureImage.name)
        .setDesc(strings.settings.items.forceSquareFeatureImage.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.forceSquareFeatureImage).onChange(async value => {
                plugin.settings.forceSquareFeatureImage = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(featureImageSettingsEl)
        .setName(strings.settings.items.useEmbeddedImageFallback.name)
        .setDesc(strings.settings.items.useEmbeddedImageFallback.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.useEmbeddedImageFallback).onChange(async value => {
                plugin.settings.useEmbeddedImageFallback = value;
                await plugin.saveSettingsAndUpdate();
            })
        );
    
        new Setting(featureImageSettingsEl)
        .setName(strings.settings.items.featureImageSize.name)
        .setDesc(strings.settings.items.featureImageSize.desc)
        .addSlider(slider => {
            slider.setLimits(64, 95, 1).setValue(plugin.settings.featureImageSize).onChange(async value => {
                plugin.settings.featureImageSize = value;
                await plugin.saveSettingsAndUpdate();
            })
        });

    new Setting(featureImageSettingsEl)
        .setName(strings.settings.items.featureImageForPDF.name)
        .setDesc(strings.settings.items.featureImageForPDF.desc)
        .addToggle(toggle => {
            toggle.setValue(plugin.settings.featureImageForPDF).onChange(async value => {
                plugin.settings.featureImageForPDF = value;
                await plugin.saveSettingsAndUpdate();
            })
        });

    new Setting(featureImageSettingsEl)
        .setName(strings.settings.items.featureImagePersistIntermediate.name)
        .setDesc(strings.settings.items.featureImagePersistIntermediate.desc)
        .addToggle(toggle => {
            toggle.setValue(plugin.settings.featureImagePersistIntermediate).onChange(async value => {
                plugin.settings.featureImagePersistIntermediate = value;
                await plugin.saveSettingsAndUpdate();
            })
        });

    const showFileTagsSetting = tagsGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showFileTags.name).setDesc(strings.settings.items.showFileTags.desc);
    });

    const fileTagsSubSettingsEl = wireToggleSettingWithSubSettings(
        showFileTagsSetting,
        () => plugin.settings.showFileTags,
        async value => {
            plugin.settings.showFileTags = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    const colorFileTagsSetting = new Setting(fileTagsSubSettingsEl)
        .setName(strings.settings.items.colorFileTags.name)
        .setDesc(strings.settings.items.colorFileTags.desc);
    const colorFileTagsSubSettingsEl = wireToggleSettingWithSubSettings(
        colorFileTagsSetting,
        () => plugin.settings.colorFileTags,
        async value => {
            plugin.settings.colorFileTags = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    new Setting(colorFileTagsSubSettingsEl)
        .setName(strings.settings.items.prioritizeColoredFileTags.name)
        .setDesc(strings.settings.items.prioritizeColoredFileTags.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.prioritizeColoredFileTags).onChange(async value => {
                plugin.settings.prioritizeColoredFileTags = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(fileTagsSubSettingsEl)
        .setName(strings.settings.items.showFileTagAncestors.name)
        .setDesc(strings.settings.items.showFileTagAncestors.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFileTagAncestors).onChange(async value => {
                plugin.settings.showFileTagAncestors = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(fileTagsSubSettingsEl)
        .setName(strings.settings.items.showFileTagsInCompactMode.name)
        .setDesc(strings.settings.items.showFileTagsInCompactMode.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFileTagsInCompactMode).onChange(async value => {
                plugin.settings.showFileTagsInCompactMode = value;
                await plugin.saveSettingsAndUpdate();
            })
        );
    
    new Setting(fileTagsSubSettingsEl)
        .setName(strings.settings.items.collapseFileTagsToSelectedTag.name)
        .setDesc(strings.settings.items.collapseFileTagsToSelectedTag.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.collapseFileTagsToSelectedTag).onChange(async value => {
                plugin.settings.collapseFileTagsToSelectedTag = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    const showFileDateSetting = dateGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showFileDate.name).setDesc(strings.settings.items.showFileDate.desc);
    });

    const fileDateSubSettingsEl = wireToggleSettingWithSubSettings(
        showFileDateSetting,
        () => plugin.settings.showFileDate,
        async value => {
            plugin.settings.showFileDate = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    // Dropdown to choose which date to display when sorting alphabetically
    new Setting(fileDateSubSettingsEl)
        .setName(strings.settings.items.alphabeticalDateMode.name)
        .setDesc(strings.settings.items.alphabeticalDateMode.desc)
        .addDropdown(dropdown =>
            dropdown
                .addOption('created', strings.settings.items.alphabeticalDateMode.options.created)
                .addOption('modified', strings.settings.items.alphabeticalDateMode.options.modified)
                .setValue(plugin.settings.alphabeticalDateMode)
                .onChange(async value => {
                    plugin.settings.alphabeticalDateMode = value === 'modified' ? 'modified' : 'created';
                    await plugin.saveSettingsAndUpdate();
                })
        );

    const showParentFolderSetting = parentFolderGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showParentFolder.name).setDesc(strings.settings.items.showParentFolder.desc);
    });

    const parentFolderSettingsEl = wireToggleSettingWithSubSettings(
        showParentFolderSetting,
        () => plugin.settings.showParentFolder,
        async value => {
            plugin.settings.showParentFolder = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    new Setting(parentFolderSettingsEl)
        .setName(strings.settings.items.parentFolderClickRevealsFile.name)
        .setDesc(strings.settings.items.parentFolderClickRevealsFile.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.parentFolderClickRevealsFile).onChange(async value => {
                plugin.settings.parentFolderClickRevealsFile = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(parentFolderSettingsEl)
        .setName(strings.settings.items.showParentFolderColor.name)
        .setDesc(strings.settings.items.showParentFolderColor.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showParentFolderColor).onChange(async value => {
                plugin.settings.showParentFolderColor = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    context.registerShowTagsListener(visible => {
        setGroupVisible(tagsGroup.rootEl, visible);
    });

    context.requestStatisticsRefresh();
}
