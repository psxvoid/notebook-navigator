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

import { Notice, Setting, ButtonComponent } from 'obsidian';
import { strings } from '../../i18n';
import { ISO_DATE_FORMAT } from '../../utils/dateUtils';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { SettingsTabContext } from './SettingsTabContext';

/** Renders the notes settings tab */
export function renderNotesTab(context: SettingsTabContext): void {
    const {
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

    createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterNameField.name,
        strings.settings.items.frontmatterNameField.desc,
        strings.settings.items.frontmatterNameField.placeholder,
        () => plugin.settings.frontmatterNameField,
        value => {
            plugin.settings.frontmatterNameField = value || '';
        }
    );

    const frontmatterIconSetting = createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterIconField.name,
        strings.settings.items.frontmatterIconField.desc,
        strings.settings.items.frontmatterIconField.placeholder,
        () => plugin.settings.frontmatterIconField,
        value => {
            plugin.settings.frontmatterIconField = value || '';
        }
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
        }
    );
    frontmatterColorSetting.controlEl.addClass('nn-setting-wide-input');

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

        const iconsBefore = Object.keys(plugin.settings.fileIcons).length;
        const colorsBefore = Object.keys(plugin.settings.fileColors).length;
        const noMigrationsPending = iconsBefore === 0 && colorsBefore === 0;

        const descriptionText = strings.settings.items.frontmatterMigration.desc
            .replace('{icons}', iconsBefore.toString())
            .replace('{colors}', colorsBefore.toString());

        descriptionEl.createDiv({ text: descriptionText });
        migrateButton?.setDisabled(noMigrationsPending);
        migrationSetting.settingEl.toggle(!noMigrationsPending);
    };

    updateMigrationDescription();

    createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterCreatedField.name,
        strings.settings.items.frontmatterCreatedField.desc,
        strings.settings.items.frontmatterCreatedField.placeholder,
        () => plugin.settings.frontmatterCreatedField,
        value => {
            plugin.settings.frontmatterCreatedField = value;
        }
    );

    createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterModifiedField.name,
        strings.settings.items.frontmatterModifiedField.desc,
        strings.settings.items.frontmatterModifiedField.placeholder,
        () => plugin.settings.frontmatterModifiedField,
        value => {
            plugin.settings.frontmatterModifiedField = value;
        }
    );

    const dateFormatSetting = createDebouncedTextSetting(
        frontmatterSettingsEl,
        strings.settings.items.frontmatterDateFormat.name,
        strings.settings.items.frontmatterDateFormat.desc,
        ISO_DATE_FORMAT,
        () => plugin.settings.frontmatterDateFormat,
        value => {
            plugin.settings.frontmatterDateFormat = value;
        }
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
        .setName(strings.settings.items.useEmbeddedImageFallback.name)
        .setDesc(strings.settings.items.useEmbeddedImageFallback.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.useEmbeddedImageFallback).onChange(async value => {
                plugin.settings.useEmbeddedImageFallback = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    fileTagsSubSettingsEl.toggle(plugin.settings.showFileTags);
    previewSettingsEl.toggle(plugin.settings.showFilePreview);
    featureImageSettingsEl.toggle(plugin.settings.showFeatureImage);
    frontmatterSettingsEl.toggle(plugin.settings.useFrontmatterMetadata);

    registerShowTagsListener(visible => {
        showFileTagsSetting.settingEl.toggle(visible);
    });

    requestStatisticsRefresh();
}
