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

import { Platform, Setting } from 'obsidian';
import { strings } from '../../i18n';
import { isFolderNoteCreationPreference } from '../../types/folderNote';
import { isTagSortOrder } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';

/** Renders the folders and tags settings tab */
export function renderFoldersTagsTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;

    if (!Platform.isMobile) {
        new Setting(containerEl)
            .setName(strings.settings.items.autoSelectFirstFileOnFocusChange.name)
            .setDesc(strings.settings.items.autoSelectFirstFileOnFocusChange.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.autoSelectFirstFileOnFocusChange).onChange(async value => {
                    plugin.settings.autoSelectFirstFileOnFocusChange = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );
    }

    new Setting(containerEl)
        .setName(strings.settings.items.autoExpandFoldersTags.name)
        .setDesc(strings.settings.items.autoExpandFoldersTags.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.autoExpandFoldersTags).onChange(async value => {
                plugin.settings.autoExpandFoldersTags = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl).setName(strings.settings.sections.folders).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.showFolderIcons.name)
        .setDesc(strings.settings.items.showFolderIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFolderIcons).onChange(async value => {
                plugin.settings.showFolderIcons = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.showRootFolder.name)
        .setDesc(strings.settings.items.showRootFolder.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showRootFolder).onChange(async value => {
                plugin.settings.showRootFolder = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.inheritFolderColors.name)
        .setDesc(strings.settings.items.inheritFolderColors.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.inheritFolderColors).onChange(async value => {
                plugin.settings.inheritFolderColors = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.enableFolderNotes.name)
        .setDesc(strings.settings.items.enableFolderNotes.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.enableFolderNotes).onChange(async value => {
                plugin.settings.enableFolderNotes = value;
                await plugin.saveSettingsAndUpdate();
                folderNotesSettingsEl.toggle(value);
            })
        );

    const folderNotesSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.folderNoteType.name)
        .setDesc(strings.settings.items.folderNoteType.desc)
        .addDropdown(dropdown => {
            dropdown
                .addOption('ask', strings.settings.items.folderNoteType.options.ask)
                .addOption('markdown', strings.settings.items.folderNoteType.options.markdown)
                .addOption('canvas', strings.settings.items.folderNoteType.options.canvas)
                .addOption('base', strings.settings.items.folderNoteType.options.base)
                .setValue(plugin.settings.folderNoteType)
                .onChange(async value => {
                    if (!isFolderNoteCreationPreference(value)) {
                        return;
                    }
                    plugin.settings.folderNoteType = value;
                    await plugin.saveSettingsAndUpdate();
                });
        });

    // Use context directly to satisfy eslint exhaustive-deps requirements
    context.createDebouncedTextSetting(
        folderNotesSettingsEl,
        strings.settings.items.folderNoteName.name,
        strings.settings.items.folderNoteName.desc,
        strings.settings.items.folderNoteName.placeholder,
        () => plugin.settings.folderNoteName,
        value => {
            plugin.settings.folderNoteName = value;
        }
    );

    const folderNotePropertiesSetting = context.createDebouncedTextAreaSetting(
        folderNotesSettingsEl,
        strings.settings.items.folderNoteProperties.name,
        strings.settings.items.folderNoteProperties.desc,
        strings.settings.items.folderNoteProperties.placeholder,
        () => plugin.settings.folderNoteProperties,
        value => {
            const normalizedBlock = value.replace(/\r\n/g, '\n').trim();
            const withoutDelimiters = normalizedBlock
                .replace(/^---\s*\n?/, '')
                .replace(/\n?---\s*$/, '')
                .trim();
            plugin.settings.folderNoteProperties = withoutDelimiters;
        },
        { rows: 4 }
    );
    folderNotePropertiesSetting.controlEl.addClass('nn-setting-wide-input');

    let pinCreatedFolderNoteSetting: Setting | null = null;

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.hideFolderNoteInList.name)
        .setDesc(strings.settings.items.hideFolderNoteInList.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.hideFolderNoteInList).onChange(async value => {
                plugin.settings.hideFolderNoteInList = value;
                await plugin.saveSettingsAndUpdate();
                if (pinCreatedFolderNoteSetting) {
                    pinCreatedFolderNoteSetting.settingEl.toggleClass('nn-setting-hidden', value);
                }
            })
        );

    pinCreatedFolderNoteSetting = new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.pinCreatedFolderNote.name)
        .setDesc(strings.settings.items.pinCreatedFolderNote.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.pinCreatedFolderNote).onChange(async value => {
                plugin.settings.pinCreatedFolderNote = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    pinCreatedFolderNoteSetting.settingEl.toggleClass('nn-setting-hidden', plugin.settings.hideFolderNoteInList);

    new Setting(containerEl).setName(strings.settings.sections.tags).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.showTags.name)
        .setDesc(strings.settings.items.showTags.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showTags).onChange(async value => {
                plugin.settings.showTags = value;
                await plugin.saveSettingsAndUpdate();
                tagSubSettingsEl.toggle(value);
                context.notifyShowTagsVisibility(value);
            })
        );

    const tagSubSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.showTagIcons.name)
        .setDesc(strings.settings.items.showTagIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showTagIcons).onChange(async value => {
                plugin.settings.showTagIcons = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    /** Setting for choosing tag sort order in the navigation pane */
    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.tagSortOrder.name)
        .setDesc(strings.settings.items.tagSortOrder.desc)
        .addDropdown(dropdown => {
            dropdown
                .addOption('alpha-asc', strings.settings.items.tagSortOrder.options.alphaAsc)
                .addOption('alpha-desc', strings.settings.items.tagSortOrder.options.alphaDesc)
                .addOption('frequency-asc', strings.settings.items.tagSortOrder.options.frequencyAsc)
                .addOption('frequency-desc', strings.settings.items.tagSortOrder.options.frequencyDesc)
                .setValue(plugin.settings.tagSortOrder)
                .onChange(async value => {
                    if (!isTagSortOrder(value)) {
                        return;
                    }
                    plugin.settings.tagSortOrder = value;
                    await plugin.saveSettingsAndUpdate();
                });
        });

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.showAllTagsFolder.name)
        .setDesc(strings.settings.items.showAllTagsFolder.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showAllTagsFolder).onChange(async value => {
                plugin.settings.showAllTagsFolder = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.showUntagged.name)
        .setDesc(strings.settings.items.showUntagged.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showUntagged).onChange(async value => {
                plugin.settings.showUntagged = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.keepEmptyTagsProperty.name)
        .setDesc(strings.settings.items.keepEmptyTagsProperty.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.keepEmptyTagsProperty).onChange(async value => {
                plugin.settings.keepEmptyTagsProperty = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    /** Toggles visibility of tag sub-settings based on show tags setting */
    const updateTagSection = (visible: boolean) => {
        tagSubSettingsEl.toggle(visible);
    };

    context.registerShowTagsListener(updateTagSection);
    updateTagSection(plugin.settings.showTags);
    folderNotesSettingsEl.toggle(plugin.settings.enableFolderNotes);
}
