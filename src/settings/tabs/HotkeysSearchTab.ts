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

import { strings } from '../../i18n';
import type { SearchProvider } from '../../types/search';
import type { SettingsTabContext } from './SettingsTabContext';
import { createSettingGroupFactory } from '../settingGroups';

/** Renders the search and hotkeys settings tab */
export function renderHotkeysSearchTab(context: SettingsTabContext): void {
    const { containerEl, plugin, addInfoSetting } = context;

    const createGroup = createSettingGroupFactory(containerEl);
    const searchGroup = createGroup(strings.settings.sections.search);

    const isSearchProvider = (value: string): value is SearchProvider => {
        return value === 'internal' || value === 'omnisearch';
    };

    searchGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.searchProvider.name)
            .setDesc(strings.settings.items.searchProvider.desc)
            .addDropdown(dropdown => {
                const currentProvider = plugin.getSearchProvider();
                dropdown
                    .addOption('internal', strings.settings.items.searchProvider.options.internal)
                    .addOption('omnisearch', strings.settings.items.searchProvider.options.omnisearch)
                    .setValue(currentProvider)
                    .onChange(value => {
                        if (!isSearchProvider(value)) {
                            return;
                        }
                        plugin.setSearchProvider(value);
                        updateSearchInfo();
                    });
            });
    });

    const searchInfoSetting = addInfoSetting(searchGroup.addSetting, 'nn-setting-info-container', () => {});
    const searchInfoEl = searchInfoSetting.descEl;

    /** Updates the search provider information display */
    const updateSearchInfo = () => {
        const provider = plugin.getSearchProvider();
        const hasOmnisearch = plugin.omnisearchService?.isAvailable() ?? false;

        searchInfoEl.empty();

        if (provider === 'omnisearch' && !hasOmnisearch) {
            searchInfoEl.createEl('strong', { text: strings.settings.items.searchProvider.info.omnisearch.warningNotInstalled });
            searchInfoEl.createEl('br');
        }

        const infoDiv = searchInfoEl.createDiv();

        const filterSection = infoDiv.createEl('div', { cls: 'nn-search-info-section' });
        filterSection.createEl('strong', { text: strings.settings.items.searchProvider.info.filterSearch.title });
        filterSection.createEl('div', {
            text: strings.settings.items.searchProvider.info.filterSearch.description,
            cls: 'nn-search-description'
        });

        infoDiv.createEl('br');

        const omnisearchSection = infoDiv.createEl('div', { cls: 'nn-search-info-section' });
        omnisearchSection.createEl('strong', { text: strings.settings.items.searchProvider.info.omnisearch.title });

        const omnisearchDesc = omnisearchSection.createEl('div', { cls: 'nn-search-description' });
        omnisearchDesc.createSpan({ text: `${strings.settings.items.searchProvider.info.omnisearch.description} ` });

        omnisearchDesc.createEl('br');
        omnisearchDesc.createEl('strong', {
            text: strings.settings.items.searchProvider.info.omnisearch.limitations.title
        });
        const limitsList = omnisearchDesc.createEl('ul', { cls: 'nn-search-limitations' });
        limitsList.createEl('li', {
            text: strings.settings.items.searchProvider.info.omnisearch.limitations.performance
        });
        limitsList.createEl('li', {
            text: strings.settings.items.searchProvider.info.omnisearch.limitations.pathBug
        });
        limitsList.createEl('li', {
            text: strings.settings.items.searchProvider.info.omnisearch.limitations.limitedResults
        });
        limitsList.createEl('li', {
            text: strings.settings.items.searchProvider.info.omnisearch.limitations.previewText
        });
    };

    updateSearchInfo();

    const hotkeysGroup = createGroup(strings.settings.sections.hotkeys);

    addInfoSetting(hotkeysGroup.addSetting, 'nn-setting-info-container', descEl => {
        descEl.createEl('p', { text: strings.settings.items.hotkeys.intro });
        descEl.createEl('p', { text: strings.settings.items.hotkeys.example });

        const modifierList = descEl.createEl('ul');
        strings.settings.items.hotkeys.modifierList.forEach(item => {
            modifierList.createEl('li', { text: item });
        });

        descEl.createEl('p', { text: strings.settings.items.hotkeys.guidance });
    });
}
