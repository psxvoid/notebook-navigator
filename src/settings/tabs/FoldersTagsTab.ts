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
import { createSettingGroupFactory } from '../settingGroups';
import { setElementVisible, wireToggleSettingWithSubSettings } from '../subSettings';

/** Renders the folders and tags settings tab */
export function renderFoldersTagsTab(context: SettingsTabContext): void {
    const { containerEl, plugin, addToggleSetting } = context;
    const createGroup = createSettingGroupFactory(containerEl);

    const topGroup = createGroup(undefined);

    if (!Platform.isMobile) {
        addToggleSetting(
            topGroup.addSetting,
            strings.settings.items.autoSelectFirstFileOnFocusChange.name,
            strings.settings.items.autoSelectFirstFileOnFocusChange.desc,
            () => plugin.settings.autoSelectFirstFileOnFocusChange,
            value => {
                plugin.settings.autoSelectFirstFileOnFocusChange = value;
            }
        );
    }

    addToggleSetting(
        topGroup.addSetting,
        strings.settings.items.autoExpandFoldersTags.name,
        strings.settings.items.autoExpandFoldersTags.desc,
        () => plugin.settings.autoExpandFoldersTags,
        value => {
            plugin.settings.autoExpandFoldersTags = value;
        }
    );

    if (!Platform.isMobile) {
        const springLoadedFoldersSetting = topGroup.addSetting(setting => {
            setting.setName(strings.settings.items.springLoadedFolders.name).setDesc(strings.settings.items.springLoadedFolders.desc);
        });
        const springLoadedFoldersSubSettings = wireToggleSettingWithSubSettings(
            springLoadedFoldersSetting,
            () => plugin.settings.springLoadedFolders,
            async value => {
                plugin.settings.springLoadedFolders = value;
                await plugin.saveSettingsAndUpdate();
            }
        );

        new Setting(springLoadedFoldersSubSettings)
            .setName(strings.settings.items.springLoadedFoldersInitialDelay.name)
            .setDesc(strings.settings.items.springLoadedFoldersInitialDelay.desc)
            .addSlider(slider =>
                slider
                    .setLimits(0.1, 2, 0.1)
                    .setValue(plugin.settings.springLoadedFoldersInitialDelay)
                    .setInstant(false)
                    .setDynamicTooltip()
                    .onChange(async value => {
                        plugin.settings.springLoadedFoldersInitialDelay = Math.round(value * 10) / 10;
                        await plugin.saveSettingsAndUpdate();
                    })
            );

        new Setting(springLoadedFoldersSubSettings)
            .setName(strings.settings.items.springLoadedFoldersSubsequentDelay.name)
            .setDesc(strings.settings.items.springLoadedFoldersSubsequentDelay.desc)
            .addSlider(slider =>
                slider
                    .setLimits(0.1, 2, 0.1)
                    .setValue(plugin.settings.springLoadedFoldersSubsequentDelay)
                    .setInstant(false)
                    .setDynamicTooltip()
                    .onChange(async value => {
                        plugin.settings.springLoadedFoldersSubsequentDelay = Math.round(value * 10) / 10;
                        await plugin.saveSettingsAndUpdate();
                    })
            );
    }

    const foldersGroup = createGroup(strings.settings.sections.folders);

    addToggleSetting(
        foldersGroup.addSetting,
        strings.settings.items.showFolderIcons.name,
        strings.settings.items.showFolderIcons.desc,
        () => plugin.settings.showFolderIcons,
        value => {
            plugin.settings.showFolderIcons = value;
        }
    );

    addToggleSetting(
        foldersGroup.addSetting,
        strings.settings.items.showRootFolder.name,
        strings.settings.items.showRootFolder.desc,
        () => plugin.settings.showRootFolder,
        value => {
            plugin.settings.showRootFolder = value;
        }
    );

    addToggleSetting(
        foldersGroup.addSetting,
        strings.settings.items.inheritFolderColors.name,
        strings.settings.items.inheritFolderColors.desc,
        () => plugin.settings.inheritFolderColors,
        value => {
            plugin.settings.inheritFolderColors = value;
        }
    );

    const enableFolderNotesSetting = foldersGroup.addSetting(setting => {
        setting.setName(strings.settings.items.enableFolderNotes.name).setDesc(strings.settings.items.enableFolderNotes.desc);
    });
    const folderNotesSettingsEl = wireToggleSettingWithSubSettings(
        enableFolderNotesSetting,
        () => plugin.settings.enableFolderNotes,
        async value => {
            plugin.settings.enableFolderNotes = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

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

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.hideFolderNoteInList.name)
        .setDesc(strings.settings.items.hideFolderNoteInList.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.hideFolderNoteInList).onChange(async value => {
                plugin.settings.hideFolderNoteInList = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.pinCreatedFolderNote.name)
        .setDesc(strings.settings.items.pinCreatedFolderNote.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.pinCreatedFolderNote).onChange(async value => {
                plugin.settings.pinCreatedFolderNote = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    const tagsGroup = createGroup(strings.settings.sections.tags);

    const showTagsSetting = tagsGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showTags.name).setDesc(strings.settings.items.showTags.desc);
    });
    const tagSubSettingsEl = wireToggleSettingWithSubSettings(
        showTagsSetting,
        () => plugin.settings.showTags,
        async value => {
            plugin.settings.showTags = value;
            await plugin.saveSettingsAndUpdate();
            context.notifyShowTagsVisibility(value);
        }
    );

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.showTagIcons.name)
        .setDesc(strings.settings.items.showTagIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showTagIcons).onChange(async value => {
                plugin.settings.showTagIcons = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.inheritTagColors.name)
        .setDesc(strings.settings.items.inheritTagColors.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.inheritTagColors).onChange(async value => {
                plugin.settings.inheritTagColors = value;
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
                .setValue(plugin.getTagSortOrder())
                .onChange(value => {
                    if (!isTagSortOrder(value)) {
                        return;
                    }
                    plugin.setTagSortOrder(value);
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

    context.registerShowTagsListener(visible => {
        setElementVisible(tagSubSettingsEl, visible);
    });
}
