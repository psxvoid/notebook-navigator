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

import { Platform, Setting, SliderComponent, setIcon } from 'obsidian';
import { strings } from '../../i18n';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import type { ListNoteGroupingOption, ListPaneTitleOption, SortOption } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { runAsyncAction } from '../../utils/async';

type QuickActionSettingKey =
    | 'quickActionRevealInFolder'
    | 'quickActionAddTag'
    | 'quickActionAddToShortcuts'
    | 'quickActionPinNote'
    | 'quickActionOpenInNewTab';

interface QuickActionToggleConfig {
    key: QuickActionSettingKey;
    icon: string;
    label: string;
}

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

    if (!Platform.isMobile) {
        const quickActionsSetting = new Setting(containerEl)
            .setName(strings.settings.items.showQuickActions.name)
            .setDesc(strings.settings.items.showQuickActions.desc);

        quickActionsSetting.controlEl.addClass('nn-quick-actions-control');

        const quickActionsButtonsEl = quickActionsSetting.controlEl.createDiv({
            cls: ['nn-toolbar-visibility-grid', 'nn-quick-actions-buttons']
        });

        const updateButtonsDisabledState = (enabled: boolean) => {
            quickActionsButtonsEl.classList.toggle('is-disabled', !enabled);
            quickActionsButtonsEl.querySelectorAll('button').forEach(button => {
                button.toggleAttribute('disabled', !enabled);
            });
        };

        const quickActionButtons: QuickActionToggleConfig[] = [
            {
                key: 'quickActionRevealInFolder',
                icon: 'lucide-folder-search',
                label: strings.contextMenu.file.revealInFolder
            },
            {
                key: 'quickActionAddTag',
                icon: 'lucide-tag',
                label: strings.contextMenu.file.addTag
            },
            {
                key: 'quickActionAddToShortcuts',
                icon: 'lucide-bookmark',
                label: strings.shortcuts.add
            },
            {
                key: 'quickActionPinNote',
                icon: 'lucide-pin',
                label: strings.contextMenu.file.pinNote
            },
            {
                key: 'quickActionOpenInNewTab',
                icon: 'lucide-file-plus',
                label: strings.contextMenu.file.openInNewTab
            }
        ];

        quickActionButtons.forEach(buttonConfig => {
            const buttonEl = quickActionsButtonsEl.createEl('button', {
                cls: ['nn-toolbar-visibility-toggle', 'nn-mobile-toolbar-button'],
                attr: { type: 'button' }
            });
            buttonEl.setAttr('aria-label', buttonConfig.label);
            buttonEl.setAttr('title', buttonConfig.label);

            const iconEl = buttonEl.createSpan({ cls: 'nn-toolbar-visibility-icon' });
            setIcon(iconEl, buttonConfig.icon);

            const applyState = () => {
                const isEnabled = Boolean(plugin.settings[buttonConfig.key]);
                buttonEl.classList.toggle('is-active', isEnabled);
                buttonEl.classList.toggle('nn-mobile-toolbar-button-active', isEnabled);
                buttonEl.setAttr('aria-pressed', isEnabled ? 'true' : 'false');
            };

            buttonEl.addEventListener('click', () => {
                plugin.settings[buttonConfig.key] = !plugin.settings[buttonConfig.key];
                applyState();
                runAsyncAction(async () => {
                    await plugin.saveSettingsAndUpdate();
                });
            });

            applyState();
        });

        quickActionsSetting.addToggle(toggle => {
            toggle.setValue(plugin.settings.showQuickActions).onChange(async value => {
                plugin.settings.showQuickActions = value;
                updateButtonsDisabledState(value);
                await plugin.saveSettingsAndUpdate();
            });
            toggle.toggleEl.addClass('nn-quick-actions-master-toggle');
        });

        updateButtonsDisabledState(plugin.settings.showQuickActions);
    }

    new Setting(containerEl).setName(strings.settings.groups.list.pinnedNotes).setHeading();

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
                    // Reset item height to default without blocking the UI
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
}
