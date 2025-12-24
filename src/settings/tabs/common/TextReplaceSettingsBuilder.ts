/*
 * Notebook Navigator Ex - Plugin for Obsidian
 * Copyright (c) 2025 Pavel Sapehin
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

import { ButtonComponent, Notice, Setting } from "obsidian";
import { strings } from "../../../i18n";
import type NotebookNavigatorPlugin from "../../../main";
import { parseReplacer } from "../../../services/content/common/TextReplacer";
import { PatternReplaceSource } from "../../../services/content/common/TextReplacerTransform";
import { EMPTY_STRING } from "../../../utils/empty";

type SettingArgFactory = (argFactory: ((factorySetting: Setting) => unknown), hideBorderTob: boolean) => unknown

interface GroupSettingArgFactory {
    rootEl: HTMLElement,
    addSetting: SettingArgFactory
}

type ExternalSettingArgFactory = (rootEl: HTMLElement) => GroupSettingArgFactory

function captureSettingArg(settingFactory: SettingArgFactory, hideBorderTob: boolean = false) {
    let setting: Setting | undefined
    settingFactory((newSetting: Setting) => { setting = newSetting }, hideBorderTob)
    if (setting == null) {
        throw new Error("Unable to capture the setting arg.")
    }
    return setting
}

export interface ReplaceTextConfig {
    getSource(): PatternReplaceSource[]
    rootGroupFactory: GroupSettingArgFactory,
    getSettingFactory(): ExternalSettingArgFactory,
    getPlugin(): NotebookNavigatorPlugin
    optionName: { name: string, desc: string }
}

function isValidPattern(pattern: string): boolean {
    let isValid = true;

    try {
        parseReplacer(pattern, EMPTY_STRING)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        isValid = false
    }

    return isValid
}

function addOption(transform: PatternReplaceSource, index: number, config: ReplaceTextConfig, createSetting: () => Setting) {
    const replacementSettings: Setting = createSetting()

    const titleInput = replacementSettings.addText((cb) => {
        cb.setPlaceholder(strings.settings.groups.notes.textTransformPatternPlaceholder)
            .setValue(transform.pattern)
            .onChange(async (newPattern: string) => {
                if (newPattern == null || newPattern.length === 0 || !isValidPattern(newPattern)) {
                    return new Notice(strings.settings.groups.notes.textTransformEmptyTitle);
                }

                const currentPattern = config.getSource()[index].pattern

                if (currentPattern === newPattern) {
                    return
                }

                config.getSource()[index].pattern = newPattern;
                await config.getPlugin().saveSettingsAndUpdate();
            });
    })

    const replacementInput = titleInput.addText((cb) => {
        cb.setPlaceholder(strings.settings.groups.notes.textTransformReplacementPlaceholder)
            .setValue(transform.replacement)
            .onChange(async (newReplacement) => {
                if (newReplacement == null) {
                    return
                }

                const currentReplacement = config.getSource()[index].replacement

                if (currentReplacement === newReplacement) {
                    return
                }

                config.getSource()[index].replacement = newReplacement;
                await config.getPlugin().saveSettingsAndUpdate();
            });
    })
    const deleteButton = replacementInput.addExtraButton((cb) => {
        cb.setIcon('cross')
            .setTooltip(strings.common.delete)
            .onClick(async () => {
                config.getSource().splice(index, 1)
                await config.getPlugin().saveSettingsAndUpdate()
                titleInput.settingEl.remove()
                replacementInput.settingEl.remove()
                deleteButton.settingEl.remove()
            });
    });
    replacementSettings.infoEl.remove();
}

export function buildTextReplaceSettings(config: ReplaceTextConfig) {
    const rootGroup = config.rootGroupFactory;
    const rootSetting: Setting = captureSettingArg(rootGroup.addSetting)

    rootSetting
        .setName(config.optionName.name)
        .setDesc(config.optionName.desc)
        .addButton((button: ButtonComponent) => {
            button
                .setTooltip(strings.settings.groups.notes.textTransformAdd)
                .setButtonText('+')
                .setCta()
                .onClick(async () => {
                    config.getSource().push({
                        pattern: '',
                        replacement: ''
                    });
                    await config.getPlugin().saveSettingsAndUpdate();
                    addReplaceOption({ pattern: '', replacement: '' }, config.getSource().length - 1)
                });
        });
    
    const createSettingGroup = config.getSettingFactory()(rootGroup.rootEl)

    const addReplaceOption = (noteTitleTransform: PatternReplaceSource, index: number) => {
        return addOption(noteTitleTransform, index, config, () => captureSettingArg(createSettingGroup.addSetting, true))
    }

    config.getSource().forEach(addReplaceOption);
}