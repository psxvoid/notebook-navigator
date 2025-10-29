/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { Notice, Setting, ButtonComponent, App, TAbstractFile, TFile } from 'obsidian';
import { strings } from '../../i18n';
import { ISO_DATE_FORMAT } from '../../utils/dateUtils';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { SettingsTabContext } from './SettingsTabContext';

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

/** Renders the notes settings tab */
export function renderNotesTab(context: SettingsTabContext): void {
    const {
        app,
        containerEl,
        plugin,
        createDebouncedTextSetting,
        registerMetadataInfoElement,
        requestStatisticsRefresh,
        registerShowTagsListener
    } = context;

    new Setting(containerEl).setName(strings.settings.groups.notes.frontmatter).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.useFrontmatterDates.name)
        .setDesc(strings.settings.items.useFrontmatterDates.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.useFrontmatterMetadata).onChange(async value => {
                plugin.settings.useFrontmatterMetadata = value;
                await plugin.saveSettingsAndUpdate();
                frontmatterSettingsEl.toggle(value);
                requestStatisticsRefresh();
            })
        );

    const frontmatterSettingsEl = containerEl.createDiv('nn-sub-settings');
    // Function to update visibility of frontmatter save setting based on field values
    let updateFrontmatterSaveVisibility: (() => void) | null = null;
    let frontmatterIconizeSetting: Setting | null = null;

    const frontmatterIconSetting = createDebouncedTextSetting(
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
        requestStatisticsRefresh
    );
    frontmatterIconSetting.controlEl.addClass('nn-setting-wide-input');

    const frontmatterColorSetting = createDebouncedTextSetting(
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
        requestStatisticsRefresh
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
        frontmatterSaveSetting.settingEl.toggle(canSaveMetadata);
        // Show Iconize format option only when icon field is configured and saving to frontmatter is enabled
        frontmatterIconizeSetting?.settingEl.toggle(hasIconField && plugin.settings.saveMetadataToFrontmatter);
    };

    updateFrontmatterSaveVisibility();

    // Setting to enable Iconize format for icon values in frontmatter
    frontmatterIconizeSetting = new Setting(frontmatterSettingsEl)
        .setName(strings.settings.items.frontmatterIconizeFormat.name)
        .setDesc(strings.settings.items.frontmatterIconizeFormat.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.iconizeFormat).onChange(async value => {
                plugin.settings.iconizeFormat = value;
                await plugin.saveSettingsAndUpdate();
            })
        );
    // Set initial visibility based on whether icon field is configured and saving is enabled
    frontmatterIconizeSetting.settingEl.toggle(
        plugin.settings.frontmatterIconField.trim().length > 0 && plugin.settings.saveMetadataToFrontmatter
    );

    let migrateButton: ButtonComponent | null = null;

    const migrationSetting = new Setting(frontmatterSettingsEl).setName(strings.settings.items.frontmatterMigration.name);

    migrationSetting.addButton(button => {
        migrateButton = button;
        button.setButtonText(strings.settings.items.frontmatterMigration.button);
        button.setCta();
        button.onClick(async () => {
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
                    new Notice(strings.settings.items.frontmatterMigration.noticeNone);
                } else if (migratedIcons === 0 && migratedColors === 0) {
                    new Notice(strings.settings.items.frontmatterMigration.noticeNone);
                } else {
                    let message = strings.settings.items.frontmatterMigration.noticeDone
                        .replace('{migratedIcons}', migratedIcons.toString())
                        .replace('{icons}', iconsBefore.toString())
                        .replace('{migratedColors}', migratedColors.toString())
                        .replace('{colors}', colorsBefore.toString());
                    if (failures > 0) {
                        message += ` ${strings.settings.items.frontmatterMigration.noticeFailures.replace('{failures}', failures.toString())}`;
                    }
                    new Notice(message);
                }
            } catch (error) {
                console.error('Failed to migrate icon/color metadata to frontmatter', error);
                new Notice(strings.settings.items.frontmatterMigration.noticeError, TIMEOUTS.NOTICE_ERROR);
            } finally {
                button.setButtonText(strings.settings.items.frontmatterMigration.button);
                button.setDisabled(false);
                updateMigrationDescription();
                requestStatisticsRefresh();
            }
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
        migrationSetting.settingEl.toggle(shouldShow);
    };

    updateMigrationDescription();

    createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterNameField.name,
        strings.settings.items.frontmatterNameField.desc,
        strings.settings.items.frontmatterNameField.placeholder,
        () => plugin.settings.frontmatterNameField,
        value => {
            plugin.settings.frontmatterNameField = value || '';
        },
        undefined,
        requestStatisticsRefresh
    );

    createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterCreatedField.name,
        strings.settings.items.frontmatterCreatedField.desc,
        strings.settings.items.frontmatterCreatedField.placeholder,
        () => plugin.settings.frontmatterCreatedField,
        value => {
            plugin.settings.frontmatterCreatedField = value;
        },
        undefined,
        requestStatisticsRefresh
    );

    createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterModifiedField.name,
        strings.settings.items.frontmatterModifiedField.desc,
        strings.settings.items.frontmatterModifiedField.placeholder,
        () => plugin.settings.frontmatterModifiedField,
        value => {
            plugin.settings.frontmatterModifiedField = value;
        },
        undefined,
        requestStatisticsRefresh
    );

    const dateFormatSetting = createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterDateFormat.name,
        strings.settings.items.frontmatterDateFormat.desc,
        ISO_DATE_FORMAT,
        () => plugin.settings.frontmatterDateFormat,
        value => {
            plugin.settings.frontmatterDateFormat = value;
        },
        undefined,
        requestStatisticsRefresh
    ).addExtraButton(button =>
        button
            .setIcon('lucide-help-circle')
            .setTooltip(strings.settings.items.frontmatterDateFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.frontmatterDateFormat.help, TIMEOUTS.NOTICE_HELP);
            })
    );
    dateFormatSetting.controlEl.addClass('nn-setting-wide-input');

    const metadataInfoContainer = frontmatterSettingsEl.createDiv('nn-setting-info-container');
    const metadataInfoEl = metadataInfoContainer.createEl('div', {
        cls: 'setting-item-description'
    });
    registerMetadataInfoElement(metadataInfoEl);

    new Setting(containerEl).setName(strings.settings.groups.notes.display).setHeading();

    new Setting(containerEl)
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

    new Setting(containerEl)
        .setName(strings.settings.items.showFileDate.name)
        .setDesc(strings.settings.items.showFileDate.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFileDate).onChange(async value => {
                plugin.settings.showFileDate = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    const showFileTagsSetting = new Setting(containerEl)
        .setName(strings.settings.items.showFileTags.name)
        .setDesc(strings.settings.items.showFileTags.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFileTags).onChange(async value => {
                plugin.settings.showFileTags = value;
                await plugin.saveSettingsAndUpdate();
                fileTagsSubSettingsEl.toggle(value);
            })
        );

    const fileTagsSubSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(fileTagsSubSettingsEl)
        .setName(strings.settings.items.showFileTagAncestors.name)
        .setDesc(strings.settings.items.showFileTagAncestors.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFileTagAncestors).onChange(async value => {
                plugin.settings.showFileTagAncestors = value;
                await plugin.saveSettingsAndUpdate();
                fileTagsAncestorsEl.toggle(value)
            })
        );

    const fileTagsAncestorsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(fileTagsAncestorsEl)
        .setName(strings.settings.items.collapseFileTagsToSelectedTag.name)
        .setDesc(strings.settings.items.collapseFileTagsToSelectedTag.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.collapseFileTagsToSelectedTag).onChange(async value => {
                plugin.settings.collapseFileTagsToSelectedTag = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(fileTagsSubSettingsEl)
        .setName(strings.settings.items.colorFileTags.name)
        .setDesc(strings.settings.items.colorFileTags.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.colorFileTags).onChange(async value => {
                plugin.settings.colorFileTags = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(fileTagsSubSettingsEl)
        .setName(strings.settings.items.showFileTagsInSlimMode.name)
        .setDesc(strings.settings.items.showFileTagsInSlimMode.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFileTagsInSlimMode).onChange(async value => {
                plugin.settings.showFileTagsInSlimMode = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.showParentFolderNames.name)
        .setDesc(strings.settings.items.showParentFolderNames.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showParentFolderNames).onChange(async value => {
                plugin.settings.showParentFolderNames = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.showFilePreview.name)
        .setDesc(strings.settings.items.showFilePreview.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFilePreview).onChange(async value => {
                plugin.settings.showFilePreview = value;
                await plugin.saveSettingsAndUpdate();
                previewSettingsEl.toggle(value);
            })
        );

    const previewSettingsEl = containerEl.createDiv('nn-sub-settings');

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

    const previewPropertiesSetting = createDebouncedTextSetting(
        previewSettingsEl,
        strings.settings.items.previewProperties.name,
        strings.settings.items.previewProperties.desc,
        strings.settings.items.previewProperties.placeholder,
        () => plugin.settings.previewProperties.join(', '),
        value => {
            plugin.settings.previewProperties = value
                .split(',')
                .map(property => property.trim())
                .filter(property => property.length > 0);
        }
    );
    previewPropertiesSetting.controlEl.addClass('nn-setting-wide-input');

    const previewInfoContainer = previewSettingsEl.createDiv('nn-setting-info-container');
    const previewInfoDiv = previewInfoContainer.createEl('div', {
        cls: 'setting-item-description'
    });
    previewInfoDiv.createSpan({ text: strings.settings.items.previewProperties.info });

    new Setting(containerEl)
        .setName(strings.settings.items.showFeatureImage.name)
        .setDesc(strings.settings.items.showFeatureImage.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFeatureImage).onChange(async value => {
                plugin.settings.showFeatureImage = value;
                await plugin.saveSettingsAndUpdate();
                featureImageSettingsEl.toggle(value);
            })
        );

    const featureImageSettingsEl = containerEl.createDiv('nn-sub-settings');

    const featurePropertiesSetting = createDebouncedTextSetting(
        featureImageSettingsEl,
        strings.settings.items.featureImageProperties.name,
        strings.settings.items.featureImageProperties.desc,
        strings.settings.items.featureImageProperties.placeholder,
        () => plugin.settings.featureImageProperties.join(', '),
        value => {
            plugin.settings.featureImageProperties = value
                .split(',')
                .map(property => property.trim())
                .filter(property => property.length > 0);
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

    fileTagsSubSettingsEl.toggle(plugin.settings.showFileTags);
    previewSettingsEl.toggle(plugin.settings.showFilePreview);
    featureImageSettingsEl.toggle(plugin.settings.showFeatureImage);
    frontmatterSettingsEl.toggle(plugin.settings.useFrontmatterMetadata);

    registerShowTagsListener(visible => {
        showFileTagsSetting.settingEl.toggle(visible);
    });

    requestStatisticsRefresh();
}
