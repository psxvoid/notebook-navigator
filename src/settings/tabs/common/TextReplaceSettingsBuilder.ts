import { Notice, Setting } from "obsidian";
import { strings } from "src/i18n";
import type NotebookNavigatorPlugin from "src/main";
import { parseReplacer } from "src/services/content/common/TextReplacer";
import { PatternReplaceSource } from "src/services/content/common/TextReplacerTransform";
import { EMPTY_STRING } from "src/utils/empty";

export interface ReplaceTextConfig {
    getSource(): PatternReplaceSource[]
    getSettingsElement(): HTMLElement
    getPlugin(): NotebookNavigatorPlugin
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

export function addOption(transform: PatternReplaceSource, index: number, config: ReplaceTextConfig) {
    const replacementSettings = new Setting(config.getSettingsElement())
    const titleInput = replacementSettings.addText((cb) => {
        cb.setPlaceholder(strings.settings.groups.notes.titleTransformPatternPlaceholder)
            .setValue(transform.pattern)
            .onChange(async (newPattern: string) => {
                if (newPattern == null || newPattern.length === 0 || !isValidPattern(newPattern)) {
                    return new Notice(strings.settings.groups.notes.titleTransformEmptyTitle);
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
        cb.setPlaceholder(strings.settings.groups.notes.titleTransformReplacementPlaceholder)
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

