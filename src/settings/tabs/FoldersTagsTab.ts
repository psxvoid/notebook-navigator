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

import { Setting } from 'obsidian';
import { strings } from '../../i18n';
import { isFolderNoteType } from '../../types/folderNote';
import type { SettingsTabContext } from './SettingsTabContext';

/** Renders the folders and tags settings tab */
export function renderFoldersTagsTab(context: SettingsTabContext): void {
    const { containerEl, plugin, createDebouncedTextSetting, notifyShowTagsVisibility, registerShowTagsListener } = context;

    new Setting(containerEl).setName(strings.settings.sections.folders).setHeading();

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
                .addOption('markdown', strings.settings.items.folderNoteType.options.markdown)
                .addOption('canvas', strings.settings.items.folderNoteType.options.canvas)
                .addOption('base', strings.settings.items.folderNoteType.options.base)
                .setValue(plugin.settings.folderNoteType)
                .onChange(async value => {
                    if (!isFolderNoteType(value)) {
                        return;
                    }
                    plugin.settings.folderNoteType = value;
                    await plugin.saveSettingsAndUpdate();
                });
        });

    createDebouncedTextSetting(
        folderNotesSettingsEl,
        strings.settings.items.folderNoteName.name,
        strings.settings.items.folderNoteName.desc,
        strings.settings.items.folderNoteName.placeholder,
        () => plugin.settings.folderNoteName,
        value => {
            plugin.settings.folderNoteName = value;
        }
    );

    const folderNotePropertiesSetting = createDebouncedTextSetting(
        folderNotesSettingsEl,
        strings.settings.items.folderNoteProperties.name,
        strings.settings.items.folderNoteProperties.desc,
        strings.settings.items.folderNoteProperties.placeholder,
        () => plugin.settings.folderNoteProperties.join(', '),
        value => {
            plugin.settings.folderNoteProperties = value
                .split(',')
                .map(property => property.trim())
                .filter(property => property.length > 0);
        }
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

    new Setting(containerEl).setName(strings.settings.sections.tags).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.showTags.name)
        .setDesc(strings.settings.items.showTags.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showTags).onChange(async value => {
                plugin.settings.showTags = value;
                await plugin.saveSettingsAndUpdate();
                tagSubSettingsEl.toggle(value);
                notifyShowTagsVisibility(value);
            })
        );

    const tagSubSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.showTagsAboveFolders.name)
        .setDesc(strings.settings.items.showTagsAboveFolders.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showTagsAboveFolders).onChange(async value => {
                plugin.settings.showTagsAboveFolders = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(tagSubSettingsEl)
        .setName(strings.settings.items.showFavoriteTagsFolder.name)
        .setDesc(strings.settings.items.showFavoriteTagsFolder.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showFavoriteTagsFolder).onChange(async value => {
                plugin.settings.showFavoriteTagsFolder = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

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
                untaggedInFavoritesEl.style.display = value ? 'block' : 'none';
            })
        );

    const untaggedInFavoritesEl = tagSubSettingsEl.createDiv('notebook-navigator-subsetting');
    untaggedInFavoritesEl.style.display = plugin.settings.showUntagged ? 'block' : 'none';

    new Setting(untaggedInFavoritesEl)
        .setName(strings.settings.items.showUntaggedInFavorites.name)
        .setDesc(strings.settings.items.showUntaggedInFavorites.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showUntaggedInFavorites).onChange(async value => {
                plugin.settings.showUntaggedInFavorites = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    const favoriteTagsSetting = createDebouncedTextSetting(
        tagSubSettingsEl,
        strings.settings.items.favoriteTags.name,
        strings.settings.items.favoriteTags.desc,
        strings.settings.items.favoriteTags.placeholder,
        () => plugin.settings.favoriteTags.join(', '),
        value => {
            plugin.settings.favoriteTags = value
                .split(',')
                .map(tag => tag.trim())
                .map(tag => tag.replace(/^#/, ''))
                .map(tag => tag.replace(/^\/+|\/+$/g, ''))
                .map(tag => tag.toLowerCase())
                .filter(tag => tag.length > 0);
        }
    );
    favoriteTagsSetting.controlEl.addClass('nn-setting-wide-input');

    const hiddenTagsSetting = createDebouncedTextSetting(
        tagSubSettingsEl,
        strings.settings.items.hiddenTags.name,
        strings.settings.items.hiddenTags.desc,
        strings.settings.items.hiddenTags.placeholder,
        () => plugin.settings.hiddenTags.join(', '),
        value => {
            plugin.settings.hiddenTags = value
                .split(',')
                .map(tag => tag.trim())
                .map(tag => tag.replace(/^#/, ''))
                .map(tag => tag.replace(/^\/+|\/+$/g, ''))
                .map(tag => tag.toLowerCase())
                .filter(tag => tag.length > 0);
        }
    );
    hiddenTagsSetting.controlEl.addClass('nn-setting-wide-input');

    /** Toggles visibility of tag sub-settings based on show tags setting */
    const updateTagSection = (visible: boolean) => {
        tagSubSettingsEl.toggle(visible);
    };

    registerShowTagsListener(updateTagSection);
    updateTagSection(plugin.settings.showTags);
    folderNotesSettingsEl.toggle(plugin.settings.enableFolderNotes);
}
