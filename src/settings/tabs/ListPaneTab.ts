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

import { Platform, Setting, SliderComponent } from 'obsidian';
import { strings } from '../../i18n';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import type { ListNoteGroupingOption, ListPaneTitleOption, SortOption } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { runAsyncAction } from '../../utils/async';

/** Renders the list pane settings tab */
export function renderListPaneTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;

    if (!Platform.isMobile) {
        new Setting(containerEl)
            .setName(strings.settings.items.listPaneTitle.name)
            .setDesc(strings.settings.items.listPaneTitle.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('header', strings.settings.items.listPaneTitle.options.header)
                    .addOption('list', strings.settings.items.listPaneTitle.options.list)
                    .addOption('hidden', strings.settings.items.listPaneTitle.options.hidden)
                    .setValue(plugin.settings.listPaneTitle)
                    .onChange(async (value: ListPaneTitleOption) => {
                        plugin.settings.listPaneTitle = value;
                        await plugin.saveSettingsAndUpdate();
                    })
            );
    }

    new Setting(containerEl)
        .setName(strings.settings.items.sortNotesBy.name)
        .setDesc(strings.settings.items.sortNotesBy.desc)
        .addDropdown(dropdown =>
            dropdown
                .addOption('modified-desc', strings.settings.items.sortNotesBy.options['modified-desc'])
                .addOption('modified-asc', strings.settings.items.sortNotesBy.options['modified-asc'])
                .addOption('created-desc', strings.settings.items.sortNotesBy.options['created-desc'])
                .addOption('created-asc', strings.settings.items.sortNotesBy.options['created-asc'])
                .addOption('title-asc', strings.settings.items.sortNotesBy.options['title-asc'])
                .addOption('title-desc', strings.settings.items.sortNotesBy.options['title-desc'])
                .setValue(plugin.settings.defaultFolderSort)
                .onChange(async (value: SortOption) => {
                    plugin.settings.defaultFolderSort = value;
                    await plugin.saveSettingsAndUpdate();
                })
        );

    new Setting(containerEl).setName(strings.settings.groups.list.display).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.includeDescendantNotes.name)
        .setDesc(strings.settings.items.includeDescendantNotes.desc)
        .addToggle(toggle => {
            const preferences = plugin.getUXPreferences();
            toggle.setValue(preferences.includeDescendantNotes).onChange(value => {
                plugin.setIncludeDescendantNotes(value);
            });
        });

    new Setting(containerEl)
        .setName(strings.settings.items.limitPinnedToCurrentFolder.name)
        .setDesc(strings.settings.items.limitPinnedToCurrentFolder.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.filterPinnedByFolder).onChange(async value => {
                plugin.settings.filterPinnedByFolder = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.showPinnedGroupHeader.name)
        .setDesc(strings.settings.items.showPinnedGroupHeader.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showPinnedGroupHeader).onChange(async value => {
                plugin.settings.showPinnedGroupHeader = value;
                await plugin.saveSettingsAndUpdate();
                pinnedGroupSettingsEl.toggle(value);
            })
        );

    const pinnedGroupSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(pinnedGroupSettingsEl)
        .setName(strings.settings.items.showPinnedIcon.name)
        .setDesc(strings.settings.items.showPinnedIcon.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showPinnedIcon).onChange(async value => {
                plugin.settings.showPinnedIcon = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    pinnedGroupSettingsEl.toggle(plugin.settings.showPinnedGroupHeader);

    new Setting(containerEl)
        .setName(strings.settings.items.groupNotes.name)
        .setDesc(strings.settings.items.groupNotes.desc)
        .addDropdown(dropdown =>
            dropdown
                .addOption('none', strings.settings.items.groupNotes.options.none)
                .addOption('date', strings.settings.items.groupNotes.options.date)
                .addOption('folder', strings.settings.items.groupNotes.options.folder)
                .setValue(plugin.settings.noteGrouping)
                .onChange(async (value: ListNoteGroupingOption) => {
                    plugin.settings.noteGrouping = value;
                    await plugin.saveSettingsAndUpdate();
                })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.optimizeNoteHeight.name)
        .setDesc(strings.settings.items.optimizeNoteHeight.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.optimizeNoteHeight).onChange(async value => {
                plugin.settings.optimizeNoteHeight = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    // Slider to configure slim list item height with reset button
    let slimItemHeightSlider: SliderComponent;
    new Setting(containerEl)
        .setName(strings.settings.items.slimItemHeight.name)
        .setDesc(strings.settings.items.slimItemHeight.desc)
        .addSlider(slider => {
            slimItemHeightSlider = slider
                .setLimits(20, 28, 1)
                .setValue(plugin.settings.slimItemHeight)
                .setDynamicTooltip()
                .onChange(async value => {
                    plugin.settings.slimItemHeight = value;
                    await plugin.saveSettingsAndUpdate();
                });
            return slider;
        })
        .addExtraButton(button =>
            button
                .setIcon('lucide-rotate-ccw')
                .setTooltip(strings.settings.items.slimItemHeight.resetTooltip)
                .onClick(() => {
                    runAsyncAction(async () => {
                        const defaultValue = DEFAULT_SETTINGS.slimItemHeight;
                        slimItemHeightSlider.setValue(defaultValue);
                        plugin.settings.slimItemHeight = defaultValue;
                        await plugin.saveSettingsAndUpdate();
                    });
                })
        );

    // Sub-setting container for slim item height options
    const slimItemHeightSettingsEl = containerEl.createDiv('nn-sub-settings');

    // Toggle to scale text proportionally with slim item height
    new Setting(slimItemHeightSettingsEl)
        .setName(strings.settings.items.slimItemHeightScaleText.name)
        .setDesc(strings.settings.items.slimItemHeightScaleText.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.slimItemHeightScaleText).onChange(async value => {
                plugin.settings.slimItemHeightScaleText = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    if (!Platform.isMobile) {
        new Setting(containerEl).setName(strings.settings.groups.list.quickActions).setHeading();

        new Setting(containerEl)
            .setName(strings.settings.items.showQuickActions.name)
            .setDesc(strings.settings.items.showQuickActions.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.showQuickActions).onChange(async value => {
                    plugin.settings.showQuickActions = value;
                    await plugin.saveSettingsAndUpdate();
                    quickActionsEl.toggle(value);
                })
            );

        const quickActionsEl = containerEl.createDiv('nn-sub-settings');

        new Setting(quickActionsEl)
            .setName(strings.settings.items.quickActionsRevealInFolder.name)
            .setDesc(strings.settings.items.quickActionsRevealInFolder.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.quickActionRevealInFolder).onChange(async value => {
                    plugin.settings.quickActionRevealInFolder = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(quickActionsEl)
            .setName(strings.settings.items.quickActionsPinNote.name)
            .setDesc(strings.settings.items.quickActionsPinNote.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.quickActionPinNote).onChange(async value => {
                    plugin.settings.quickActionPinNote = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );

        new Setting(quickActionsEl)
            .setName(strings.settings.items.quickActionsOpenInNewTab.name)
            .setDesc(strings.settings.items.quickActionsOpenInNewTab.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.quickActionOpenInNewTab).onChange(async value => {
                    plugin.settings.quickActionOpenInNewTab = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );

        quickActionsEl.toggle(plugin.settings.showQuickActions);
    }
}
