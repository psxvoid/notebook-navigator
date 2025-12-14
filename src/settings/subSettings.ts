import type { Setting } from 'obsidian';

const SETTING_HIDDEN_CLASS = 'nn-setting-hidden';

export function setElementVisible(element: HTMLElement, visible: boolean): void {
    element.classList.toggle(SETTING_HIDDEN_CLASS, !visible);
}

export function createSubSettingsContainer(parentSetting: Setting, cls = 'nn-sub-settings'): HTMLDivElement {
    const container = parentSetting.settingEl.ownerDocument.createElement('div');
    container.className = cls;
    parentSetting.settingEl.after(container);
    return container;
}

export function wireToggleSettingWithSubSettings(
    parentSetting: Setting,
    getValue: () => boolean,
    onValueChange: (value: boolean) => Promise<void> | void,
    cls = 'nn-sub-settings'
): HTMLDivElement {
    const container = createSubSettingsContainer(parentSetting, cls);
    setElementVisible(container, getValue());

    parentSetting.addToggle(toggle =>
        toggle.setValue(getValue()).onChange(async value => {
            await onValueChange(value);
            setElementVisible(container, value);
        })
    );

    return container;
}
