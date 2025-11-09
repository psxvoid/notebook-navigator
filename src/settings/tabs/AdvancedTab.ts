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

import { ButtonComponent, Notice, Platform, Setting } from 'obsidian';
import { strings } from '../../i18n';
import type { MetadataCleanupSummary } from '../../services/MetadataService';
import type { SettingsTabContext } from './SettingsTabContext';
import { getNavigationPaneSizing } from '../../utils/paneSizing';
import { localStorage } from '../../utils/localStorage';
import { runAsyncAction } from '../../utils/async';

/** Renders the advanced settings tab */
export function renderAdvancedTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;

    new Setting(containerEl)
        .setName(strings.settings.items.updateCheckOnStart.name)
        .setDesc(strings.settings.items.updateCheckOnStart.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.checkForUpdatesOnStart).onChange(async value => {
                plugin.settings.checkForUpdatesOnStart = value;
                if (!value) {
                    plugin.dismissPendingUpdateNotice();
                }
                await plugin.saveSettingsAndUpdate();
                if (value) {
                    await plugin.runReleaseUpdateCheck(true);
                }
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.confirmBeforeDelete.name)
        .setDesc(strings.settings.items.confirmBeforeDelete.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.confirmBeforeDelete).onChange(async value => {
                plugin.settings.confirmBeforeDelete = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    if (!Platform.isMobile) {
        new Setting(containerEl)
            .setName(strings.settings.items.resetPaneSeparator.name)
            .setDesc(strings.settings.items.resetPaneSeparator.desc)
            .addButton(button =>
                button.setButtonText(strings.settings.items.resetPaneSeparator.buttonText).onClick(() => {
                    const orientation = plugin.getDualPaneOrientation();
                    const { storageKey } = getNavigationPaneSizing(orientation);
                    localStorage.remove(storageKey);
                    new Notice(strings.settings.items.resetPaneSeparator.notice);
                })
            );
    }

    let metadataCleanupButton: ButtonComponent | null = null;
    let metadataCleanupInfoText: HTMLDivElement | null = null;

    /** Sets the metadata cleanup UI to loading state */
    const setMetadataCleanupLoadingState = () => {
        metadataCleanupInfoText?.setText(strings.settings.items.metadataCleanup.loading);
        metadataCleanupButton?.setDisabled(true);
    };

    /** Updates the metadata cleanup information display based on cleanup summary */
    const updateMetadataCleanupInfo = ({ folders, tags, files, pinnedNotes, total }: MetadataCleanupSummary) => {
        if (!metadataCleanupInfoText) {
            return;
        }

        if (total === 0) {
            metadataCleanupInfoText.setText(strings.settings.items.metadataCleanup.statusClean);
            metadataCleanupButton?.setDisabled(true);
            return;
        }

        const infoText = strings.settings.items.metadataCleanup.statusCounts
            .replace('{folders}', folders.toString())
            .replace('{tags}', tags.toString())
            .replace('{files}', files.toString())
            .replace('{pinned}', pinnedNotes.toString());
        metadataCleanupInfoText.setText(infoText);
        metadataCleanupButton?.setDisabled(false);
    };

    const refreshMetadataCleanupSummary = async () => {
        setMetadataCleanupLoadingState();
        try {
            const summary = await plugin.getMetadataCleanupSummary();
            updateMetadataCleanupInfo(summary);
        } catch (error) {
            console.error('Failed to fetch metadata cleanup summary', error);
            metadataCleanupInfoText?.setText(strings.settings.items.metadataCleanup.error);
            metadataCleanupButton?.setDisabled(false);
        }
    };

    const metadataCleanupSetting = new Setting(containerEl)
        .setName(strings.settings.items.metadataCleanup.name)
        .setDesc(strings.settings.items.metadataCleanup.desc);

    metadataCleanupSetting.addButton(button => {
        metadataCleanupButton = button;
        button.setButtonText(strings.settings.items.metadataCleanup.buttonText);
        button.setDisabled(true);
        button.onClick(() => {
            runAsyncAction(async () => {
                setMetadataCleanupLoadingState();
                try {
                    await plugin.runMetadataCleanup();
                } catch (error) {
                    console.error('Metadata cleanup failed', error);
                    new Notice(strings.settings.items.metadataCleanup.error);
                } finally {
                    await refreshMetadataCleanupSummary();
                }
            });
        });
    });

    metadataCleanupInfoText = metadataCleanupSetting.descEl.createDiv({
        cls: 'setting-item-description',
        text: strings.settings.items.metadataCleanup.loading
    });

    runAsyncAction(() => refreshMetadataCleanupSummary());

    new Setting(containerEl)
        .setName(strings.settings.items.rebuildCache.name)
        .setDesc(strings.settings.items.rebuildCache.desc)
        .addButton(button =>
            button.setButtonText(strings.settings.items.rebuildCache.buttonText).onClick(() => {
                runAsyncAction(async () => {
                    button.setDisabled(true);
                    try {
                        await plugin.rebuildCache();
                        new Notice(strings.settings.items.rebuildCache.success);
                    } catch (error) {
                        console.error('Failed to rebuild cache from settings:', error);
                        new Notice(strings.settings.items.rebuildCache.error);
                    } finally {
                        button.setDisabled(false);
                    }
                });
            })
        );

    const statsContainer = containerEl.createDiv('nn-database-stats');
    statsContainer.addClass('setting-item');
    statsContainer.addClass('nn-stats-section');

    const statsContent = statsContainer.createDiv('nn-stats-content');
    const statsTextEl = statsContent.createEl('div', {
        cls: 'nn-stats-text'
    });

    context.registerStatsTextElement(statsTextEl);
    context.requestStatisticsRefresh();
    context.ensureStatisticsInterval();
}
