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

import { ButtonComponent, Setting, SliderComponent } from 'obsidian';
import { strings } from '../../i18n';
import { NavigationBannerModal } from '../../modals/NavigationBannerModal';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import type { ItemScope } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { runAsyncAction } from '../../utils/async';
import { getActiveVaultProfile } from '../../utils/vaultProfiles';

/** Renders the navigation pane settings tab */
export function renderNavigationPaneTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;
    const getActiveProfile = () => getActiveVaultProfile(plugin.settings);

    new Setting(containerEl).setName(strings.settings.groups.navigation.behavior).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.pinRecentNotesWithShortcuts.name)
        .setDesc(strings.settings.items.pinRecentNotesWithShortcuts.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.pinRecentNotesWithShortcuts).onChange(async value => {
                plugin.settings.pinRecentNotesWithShortcuts = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.collapseBehavior.name)
        .setDesc(strings.settings.items.collapseBehavior.desc)
        .addDropdown(dropdown =>
            dropdown
                .addOption('all', strings.settings.items.collapseBehavior.options.all)
                .addOption('folders-only', strings.settings.items.collapseBehavior.options.foldersOnly)
                .addOption('tags-only', strings.settings.items.collapseBehavior.options.tagsOnly)
                .setValue(plugin.settings.collapseBehavior)
                .onChange(async (value: ItemScope) => {
                    plugin.settings.collapseBehavior = value;
                    await plugin.saveSettingsAndUpdate();
                })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.smartCollapse.name)
        .setDesc(strings.settings.items.smartCollapse.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.smartCollapse).onChange(async value => {
                plugin.settings.smartCollapse = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl).setName(strings.settings.groups.navigation.shortcutsAndRecent).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.showSectionIcons.name)
        .setDesc(strings.settings.items.showSectionIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showSectionIcons).onChange(async value => {
                plugin.settings.showSectionIcons = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    let shortcutsSubSettings: HTMLDivElement | null = null;

    const updateShortcutsVisibility = (visible: boolean) => {
        if (shortcutsSubSettings) {
            shortcutsSubSettings.toggleClass('nn-setting-hidden', !visible);
        }
    };

    new Setting(containerEl)
        .setName(strings.settings.items.showShortcuts.name)
        .setDesc(strings.settings.items.showShortcuts.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showShortcuts).onChange(async value => {
                plugin.settings.showShortcuts = value;
                await plugin.saveSettingsAndUpdate();
                updateShortcutsVisibility(value);
            })
        );

    shortcutsSubSettings = containerEl.createDiv('nn-sub-settings');

    new Setting(shortcutsSubSettings)
        .setName(strings.settings.items.skipAutoScroll.name)
        .setDesc(strings.settings.items.skipAutoScroll.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.skipAutoScroll).onChange(async value => {
                plugin.settings.skipAutoScroll = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    updateShortcutsVisibility(plugin.settings.showShortcuts);

    let recentNotesSubSettings: HTMLDivElement | null = null;

    const updateRecentNotesVisibility = (visible: boolean) => {
        if (recentNotesSubSettings) {
            recentNotesSubSettings.toggleClass('nn-setting-hidden', !visible);
        }
    };

    new Setting(containerEl)
        .setName(strings.settings.items.showRecentNotes.name)
        .setDesc(strings.settings.items.showRecentNotes.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showRecentNotes).onChange(async value => {
                plugin.settings.showRecentNotes = value;
                await plugin.saveSettingsAndUpdate();
                updateRecentNotesVisibility(value);
            })
        );

    recentNotesSubSettings = containerEl.createDiv('nn-sub-settings');

    new Setting(recentNotesSubSettings)
        .setName(strings.settings.items.recentNotesCount.name)
        .setDesc(strings.settings.items.recentNotesCount.desc)
        .addSlider(slider =>
            slider
                .setLimits(1, 10, 1)
                .setValue(plugin.settings.recentNotesCount)
                .setDynamicTooltip()
                .onChange(async value => {
                    plugin.settings.recentNotesCount = value;
                    plugin.applyRecentNotesLimit();
                    await plugin.saveSettingsAndUpdate();
                })
        );

    updateRecentNotesVisibility(plugin.settings.showRecentNotes);

    new Setting(containerEl).setName(strings.settings.groups.navigation.appearance).setHeading();

    const navigationBannerSetting = new Setting(containerEl).setName(strings.settings.items.navigationBanner.name);
    navigationBannerSetting.setDesc('');

    const navigationBannerDescEl = navigationBannerSetting.descEl;
    navigationBannerDescEl.empty();
    navigationBannerDescEl.createDiv({ text: strings.settings.items.navigationBanner.desc });

    const navigationBannerValueEl = navigationBannerDescEl.createDiv();
    let clearNavigationBannerButton: ButtonComponent | null = null;

    const renderNavigationBannerValue = () => {
        const navigationBanner = getActiveProfile().navigationBanner;
        navigationBannerValueEl.setText('');
        if (navigationBanner) {
            navigationBannerValueEl.setText(strings.settings.items.navigationBanner.current.replace('{path}', navigationBanner));
        }

        if (clearNavigationBannerButton) {
            clearNavigationBannerButton.setDisabled(!navigationBanner);
        }
    };

    navigationBannerSetting.addButton(button => {
        button.setButtonText(strings.settings.items.navigationBanner.chooseButton);
        button.onClick(() => {
            new NavigationBannerModal(context.app, file => {
                getActiveProfile().navigationBanner = file.path;
                renderNavigationBannerValue();
                // Save navigation banner setting without blocking the UI
                runAsyncAction(() => plugin.saveSettingsAndUpdate());
            }).open();
        });
    });

    navigationBannerSetting.addButton(button => {
        button.setButtonText(strings.common.clear);
        clearNavigationBannerButton = button;
        button.setDisabled(!getActiveProfile().navigationBanner);
        // Clear navigation banner without blocking the UI
        button.onClick(() => {
            runAsyncAction(async () => {
                const activeProfile = getActiveProfile();
                if (!activeProfile.navigationBanner) {
                    return;
                }
                activeProfile.navigationBanner = null;
                renderNavigationBannerValue();
                await plugin.saveSettingsAndUpdate();
            });
        });
    });

    renderNavigationBannerValue();

    let noteCountSubSettingsEl: HTMLDivElement | null = null;

    const updateNoteCountSettingsVisibility = () => {
        if (noteCountSubSettingsEl) {
            noteCountSubSettingsEl.toggle(plugin.settings.showNoteCount);
        }
    };

    new Setting(containerEl)
        .setName(strings.settings.items.showNoteCount.name)
        .setDesc(strings.settings.items.showNoteCount.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showNoteCount).onChange(async value => {
                plugin.settings.showNoteCount = value;
                await plugin.saveSettingsAndUpdate();
                updateNoteCountSettingsVisibility();
            })
        );

    noteCountSubSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(noteCountSubSettingsEl)
        .setName(strings.settings.items.separateNoteCounts.name)
        .setDesc(strings.settings.items.separateNoteCounts.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.separateNoteCounts).onChange(async value => {
                plugin.settings.separateNoteCounts = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    updateNoteCountSettingsVisibility();

    let indentationSlider: SliderComponent;
    new Setting(containerEl)
        .setName(strings.settings.items.navIndent.name)
        .setDesc(strings.settings.items.navIndent.desc)
        .addSlider(slider => {
            indentationSlider = slider
                .setLimits(10, 24, 1)
                .setValue(plugin.settings.navIndent)
                .setDynamicTooltip()
                .onChange(async value => {
                    plugin.settings.navIndent = value;
                    await plugin.saveSettingsAndUpdate();
                });
            return slider;
        })
        .addExtraButton(button =>
            button
                .setIcon('lucide-rotate-ccw')
                .setTooltip('Restore to default (16px)')
                .onClick(() => {
                    // Reset indentation to default without blocking the UI
                    runAsyncAction(async () => {
                        const defaultValue = DEFAULT_SETTINGS.navIndent;
                        indentationSlider.setValue(defaultValue);
                        plugin.settings.navIndent = defaultValue;
                        await plugin.saveSettingsAndUpdate();
                    });
                })
        );

    let lineHeightSlider: SliderComponent;
    new Setting(containerEl)
        .setName(strings.settings.items.navItemHeight.name)
        .setDesc(strings.settings.items.navItemHeight.desc)
        .addSlider(slider => {
            lineHeightSlider = slider
                .setLimits(20, 28, 1)
                .setValue(plugin.settings.navItemHeight)
                .setDynamicTooltip()
                .onChange(async value => {
                    plugin.settings.navItemHeight = value;
                    await plugin.saveSettingsAndUpdate();
                });
            return slider;
        })
        .addExtraButton(button =>
            button
                .setIcon('lucide-rotate-ccw')
                .setTooltip('Restore to default (28px)')
                .onClick(() => {
                    // Reset line height to default without blocking the UI
                    runAsyncAction(async () => {
                        const defaultValue = DEFAULT_SETTINGS.navItemHeight;
                        lineHeightSlider.setValue(defaultValue);
                        plugin.settings.navItemHeight = defaultValue;
                        await plugin.saveSettingsAndUpdate();
                    });
                })
        );

    const navItemHeightSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(navItemHeightSettingsEl)
        .setName(strings.settings.items.navItemHeightScaleText.name)
        .setDesc(strings.settings.items.navItemHeightScaleText.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.navItemHeightScaleText).onChange(async value => {
                plugin.settings.navItemHeightScaleText = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    let rootSpacingSlider: SliderComponent;
    new Setting(containerEl)
        .setName(strings.settings.items.navRootSpacing.name)
        .setDesc(strings.settings.items.navRootSpacing.desc)
        .addSlider(slider => {
            rootSpacingSlider = slider
                .setLimits(0, 6, 1)
                .setValue(plugin.settings.rootLevelSpacing)
                .setDynamicTooltip()
                .onChange(async value => {
                    plugin.settings.rootLevelSpacing = value;
                    await plugin.saveSettingsAndUpdate();
                });
            return slider;
        })
        .addExtraButton(button =>
            button
                .setIcon('lucide-rotate-ccw')
                .setTooltip('Restore to default (0px)')
                .onClick(() => {
                    // Reset root spacing to default without blocking the UI
                    runAsyncAction(async () => {
                        const defaultValue = DEFAULT_SETTINGS.rootLevelSpacing;
                        rootSpacingSlider.setValue(defaultValue);
                        plugin.settings.rootLevelSpacing = defaultValue;
                        await plugin.saveSettingsAndUpdate();
                    });
                })
        );
}
