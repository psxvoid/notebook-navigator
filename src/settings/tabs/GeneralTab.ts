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

import { ButtonComponent, DropdownComponent, Notice, Platform, Setting, SliderComponent } from 'obsidian';
import { HomepageModal } from '../../modals/HomepageModal';
import { strings } from '../../i18n';
import { FILE_VISIBILITY, type FileVisibility } from '../../utils/fileTypeUtils';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { BackgroundMode } from '../../types';
import type { MultiSelectModifier } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { resetHiddenToggleIfNoSources } from '../../utils/exclusionUtils';
import { InputModal } from '../../modals/InputModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { EditVaultProfileModal } from '../../modals/EditVaultProfileModal';
import {
    DEFAULT_UI_SCALE,
    formatUIScalePercent,
    sanitizeUIScale,
    MIN_UI_SCALE_PERCENT,
    MAX_UI_SCALE_PERCENT,
    UI_SCALE_PERCENT_STEP,
    scaleToPercent,
    percentToScale
} from '../../utils/uiScale';
import { runAsyncAction } from '../../utils/async';
import { createVaultProfile, DEFAULT_VAULT_PROFILE_ID, ensureVaultProfiles } from '../../utils/vaultProfiles';
import { normalizeTagPath } from '../../utils/tagUtils';

/** Renders the general settings tab */
export function renderGeneralTab(context: SettingsTabContext): void {
    const { containerEl, plugin, createDebouncedTextSetting } = context;
    const pluginVersion = plugin.manifest.version;
    ensureVaultProfiles(plugin.settings);

    let updateStatusEl: HTMLDivElement | null = null;

    const renderUpdateStatus = (version: string | null) => {
        if (!updateStatusEl) {
            return;
        }
        const hasVersion = Boolean(version);
        updateStatusEl.setText(hasVersion ? strings.settings.items.updateCheckOnStart.status.replace('{version}', version ?? '') : '');
        updateStatusEl.classList.toggle('is-hidden', !hasVersion);
    };

    const applyCurrentNotice = () => {
        const notice = plugin.getPendingUpdateNotice();
        renderUpdateStatus(notice?.version ?? null);
    };

    const updateStatusListenerId = 'general-update-status';
    plugin.unregisterUpdateNoticeListener(updateStatusListenerId);

    const whatsNewSetting = new Setting(containerEl)
        .setName(strings.settings.items.whatsNew.name.replace('{version}', pluginVersion))
        .setDesc(strings.settings.items.whatsNew.desc)
        .addButton(button =>
            button.setButtonText(strings.settings.items.whatsNew.buttonText).onClick(() => {
                // Load and display release notes without blocking the UI
                runAsyncAction(async () => {
                    const { WhatsNewModal } = await import('../../modals/WhatsNewModal');
                    const { getLatestReleaseNotes } = await import('../../releaseNotes');
                    const latestNotes = getLatestReleaseNotes();
                    new WhatsNewModal(context.app, latestNotes, plugin.settings.dateFormat).open();
                });
            })
        );

    updateStatusEl = whatsNewSetting.descEl.createDiv({ cls: 'setting-item-description nn-update-status is-hidden' });

    applyCurrentNotice();

    plugin.registerUpdateNoticeListener(updateStatusListenerId, notice => {
        renderUpdateStatus(notice?.version ?? null);
    });

    const supportSetting = new Setting(containerEl)
        .setName(strings.settings.items.supportDevelopment.name)
        .setDesc(strings.settings.items.supportDevelopment.desc);

    supportSetting.addButton(button => {
        button
            .setButtonText(strings.settings.items.supportDevelopment.buttonText)
            .onClick(() => window.open('https://github.com/sponsors/johansan/'));
        button.buttonEl.addClass('nn-support-button');
    });

    supportSetting.addButton(button => {
        button
            .setButtonText(strings.settings.items.supportDevelopment.coffeeButton)
            .onClick(() => window.open('https://buymeacoffee.com/johansan'));
        button.buttonEl.addClass('nn-support-button');
    });

    new Setting(containerEl).setName(strings.settings.groups.general.filtering).setHeading();

    const fallbackProfileName = strings.settings.items.vaultProfiles.defaultName || 'Default';
    const getProfileDisplayName = (name?: string): string => {
        const trimmed = name?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : fallbackProfileName;
    };
    const getActiveProfile = () => {
        return (
            plugin.settings.vaultProfiles.find(profile => profile.id === plugin.settings.vaultProfile) ??
            plugin.settings.vaultProfiles[0] ??
            null
        );
    };

    let profileDropdown: DropdownComponent | null = null;
    let editProfileButton: ButtonComponent | null = null;
    let fileVisibilityDropdown: DropdownComponent | null = null;
    let excludedFoldersInput: HTMLInputElement | null = null;
    let hiddenTagsInput: HTMLInputElement | null = null;
    let excludedFilesInput: HTMLInputElement | null = null;

    // Updates all profile-related UI controls with current settings values
    const refreshProfileControls = () => {
        if (profileDropdown) {
            const selectEl = profileDropdown.selectEl;
            while (selectEl.firstChild) {
                selectEl.removeChild(selectEl.firstChild);
            }
            plugin.settings.vaultProfiles.forEach(profile => {
                selectEl.createEl('option', {
                    value: profile.id,
                    text: getProfileDisplayName(profile.name)
                });
            });
            selectEl.value = plugin.settings.vaultProfile;
        }
        if (editProfileButton) {
            editProfileButton.setDisabled(!getActiveProfile());
        }
        const activeProfile = getActiveProfile();
        if (fileVisibilityDropdown) {
            fileVisibilityDropdown.setValue(plugin.settings.fileVisibility);
        }
        if (excludedFoldersInput) {
            excludedFoldersInput.value = activeProfile ? activeProfile.hiddenFolders.join(', ') : '';
        }
        if (hiddenTagsInput) {
            hiddenTagsInput.value = plugin.settings.hiddenTags.join(', ');
        }
        if (excludedFilesInput) {
            excludedFilesInput.value = activeProfile ? activeProfile.hiddenFiles.join(', ') : '';
        }
    };

    // Creates a new vault profile with the given name and switches to it
    const handleAddProfile = async (profileName: string) => {
        const trimmedName = profileName.trim();
        if (!trimmedName) {
            new Notice(strings.settings.items.vaultProfiles.errors.emptyName);
            return;
        }

        const hasDuplicate = plugin.settings.vaultProfiles.some(profile => profile.name.toLowerCase() === trimmedName.toLowerCase());
        if (hasDuplicate) {
            new Notice(strings.settings.items.vaultProfiles.errors.duplicateName);
            return;
        }

        const activeProfile = getActiveProfile();
        const newProfile = createVaultProfile(trimmedName, {
            hiddenFolders: activeProfile?.hiddenFolders,
            hiddenFiles: activeProfile?.hiddenFiles,
            hiddenTags: plugin.settings.hiddenTags,
            fileVisibility: plugin.settings.fileVisibility
        });
        plugin.settings.vaultProfiles.push(newProfile);
        await plugin.setVaultProfile(newProfile.id);
        refreshProfileControls();
    };

    // Renames an existing vault profile after validating name constraints
    const handleRenameProfile = async (profileId: string, profileName: string) => {
        // Validate that the profile name is not empty
        const trimmedName = profileName.trim();
        if (!trimmedName) {
            new Notice(strings.settings.items.vaultProfiles.errors.emptyName);
            return;
        }
        const normalizedName = trimmedName.toLowerCase();
        // Check if another profile already has this name (case-insensitive)
        const hasDuplicate = plugin.settings.vaultProfiles.some(profile => {
            // Skip the current profile being renamed
            if (profile.id === profileId) {
                return false;
            }
            const candidate = profile.name?.trim().toLowerCase();
            return candidate === normalizedName;
        });
        if (hasDuplicate) {
            new Notice(strings.settings.items.vaultProfiles.errors.duplicateName);
            return;
        }
        // Find the profile to rename and update its name
        const targetProfile = plugin.settings.vaultProfiles.find(profile => profile.id === profileId);
        if (!targetProfile) {
            return;
        }
        targetProfile.name = trimmedName;
        await plugin.saveSettingsAndUpdate();
        refreshProfileControls();
    };

    // Deletes the provided profile and switches to a fallback profile if needed
    const handleDeleteProfileById = async (profileId: string) => {
        if (profileId === DEFAULT_VAULT_PROFILE_ID) {
            return;
        }
        const profiles = plugin.settings.vaultProfiles;
        const currentIndex = profiles.findIndex(profile => profile.id === profileId);
        if (currentIndex === -1) {
            return;
        }
        profiles.splice(currentIndex, 1);
        const fallbackProfile =
            profiles[currentIndex] ??
            profiles[currentIndex - 1] ??
            profiles.find(profile => profile.id === DEFAULT_VAULT_PROFILE_ID) ??
            profiles[0];
        const fallbackId = fallbackProfile?.id ?? DEFAULT_VAULT_PROFILE_ID;
        // Switch to fallback profile only if deleting the currently active profile
        if (plugin.settings.vaultProfile === profileId) {
            await plugin.setVaultProfile(fallbackId);
        } else {
            await plugin.saveSettingsAndUpdate();
        }
        refreshProfileControls();
    };

    // Opens the edit modal for the active profile, enabling rename or deletion
    const openEditProfileModal = () => {
        const activeProfile = getActiveProfile();
        if (!activeProfile) {
            return;
        }
        const modal = new EditVaultProfileModal(context.app, {
            title: strings.settings.items.vaultProfiles.editModalTitle,
            placeholder: strings.settings.items.vaultProfiles.addModalPlaceholder,
            defaultValue: activeProfile.name ?? '',
            canDelete: activeProfile.id !== DEFAULT_VAULT_PROFILE_ID,
            onSubmit: async profileName => {
                await handleRenameProfile(activeProfile.id, profileName);
            },
            onDelete: value => {
                // Prevent deletion of the default profile
                if (activeProfile.id === DEFAULT_VAULT_PROFILE_ID) {
                    return;
                }
                // Show confirmation dialog before deleting the profile
                const profileName = getProfileDisplayName(value || activeProfile.name);
                const confirmModal = new ConfirmModal(
                    context.app,
                    strings.settings.items.vaultProfiles.deleteModalTitle.replace('{name}', profileName),
                    strings.settings.items.vaultProfiles.deleteModalMessage.replace('{name}', profileName),
                    async () => {
                        await handleDeleteProfileById(activeProfile.id);
                    }
                );
                confirmModal.open();
            }
        });
        modal.open();
    };

    const profileSetting = new Setting(containerEl)
        .setName(strings.settings.items.vaultProfiles.name)
        .setDesc(strings.settings.items.vaultProfiles.desc);

    profileSetting.addDropdown(dropdown => {
        profileDropdown = dropdown;
        refreshProfileControls();
        dropdown.onChange(value => {
            runAsyncAction(async () => {
                await plugin.setVaultProfile(value);
                refreshProfileControls();
            });
        });
        return dropdown;
    });

    profileSetting.addButton(button => {
        button.setButtonText(strings.settings.items.vaultProfiles.addButton).onClick(() => {
            const modal = new InputModal(
                context.app,
                strings.settings.items.vaultProfiles.addModalTitle,
                strings.settings.items.vaultProfiles.addModalPlaceholder,
                async profileName => {
                    await handleAddProfile(profileName);
                }
            );
            modal.open();
        });
        return button;
    });

    profileSetting.addButton(button => {
        editProfileButton = button;
        button.setButtonText(strings.settings.items.vaultProfiles.editButton).onClick(() => {
            openEditProfileModal();
        });
        button.setDisabled(!getActiveProfile());
        return button;
    });

    profileSetting.controlEl.addClass('nn-setting-profile-dropdown');

    new Setting(containerEl)
        .setName(strings.settings.items.fileVisibility.name)
        .setDesc(strings.settings.items.fileVisibility.desc)
        .addDropdown(dropdown => {
            fileVisibilityDropdown = dropdown;
            dropdown
                .addOption(FILE_VISIBILITY.DOCUMENTS, strings.settings.items.fileVisibility.options.documents)
                .addOption(FILE_VISIBILITY.SUPPORTED, strings.settings.items.fileVisibility.options.supported)
                .addOption(FILE_VISIBILITY.ALL, strings.settings.items.fileVisibility.options.all)
                .setValue(plugin.settings.fileVisibility)
                .onChange(async (value: FileVisibility) => {
                    plugin.settings.fileVisibility = value;
                    const activeProfile = plugin.settings.vaultProfiles.find(profile => profile.id === plugin.settings.vaultProfile);
                    if (activeProfile) {
                        activeProfile.fileVisibility = value;
                    }
                    await plugin.saveSettingsAndUpdate();
                    refreshProfileControls();
                });
            return dropdown;
        });

    const excludedFoldersSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.excludedFolders.name,
        strings.settings.items.excludedFolders.desc,
        strings.settings.items.excludedFolders.placeholder,
        () => getActiveProfile()?.hiddenFolders.join(', ') ?? '',
        value => {
            const activeProfile = getActiveProfile();
            if (!activeProfile) {
                return;
            }
            const nextHiddenFolders = value
                .split(',')
                .map(folder => folder.trim())
                .filter(folder => folder.length > 0);
            activeProfile.hiddenFolders = Array.from(new Set(nextHiddenFolders));
            resetHiddenToggleIfNoSources({
                settings: plugin.settings,
                showHiddenItems: plugin.getUXPreferences().showHiddenItems,
                setShowHiddenItems: value => plugin.setShowHiddenItems(value)
            });
        }
    );
    excludedFoldersSetting.controlEl.addClass('nn-setting-wide-input');
    excludedFoldersInput = excludedFoldersSetting.controlEl.querySelector('input');

    const hiddenTagsSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.hiddenTags.name,
        strings.settings.items.hiddenTags.desc,
        strings.settings.items.hiddenTags.placeholder,
        () => plugin.settings.hiddenTags.join(', '),
        value => {
            const normalizedHiddenTags = value
                .split(',')
                .map(entry => normalizeTagPath(entry))
                .filter((entry): entry is string => entry !== null);

            plugin.settings.hiddenTags = Array.from(new Set(normalizedHiddenTags));
            resetHiddenToggleIfNoSources({
                settings: plugin.settings,
                showHiddenItems: plugin.getUXPreferences().showHiddenItems,
                setShowHiddenItems: value => plugin.setShowHiddenItems(value)
            });
        }
    );
    hiddenTagsSetting.controlEl.addClass('nn-setting-wide-input');
    hiddenTagsInput = hiddenTagsSetting.controlEl.querySelector('input');

    const excludedFilesSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.excludedNotes.name,
        strings.settings.items.excludedNotes.desc,
        strings.settings.items.excludedNotes.placeholder,
        () => getActiveProfile()?.hiddenFiles.join(', ') ?? '',
        value => {
            const activeProfile = getActiveProfile();
            if (!activeProfile) {
                return;
            }
            const nextHiddenFiles = value
                .split(',')
                .map(file => file.trim())
                .filter(file => file.length > 0);
            activeProfile.hiddenFiles = Array.from(new Set(nextHiddenFiles));
            resetHiddenToggleIfNoSources({
                settings: plugin.settings,
                showHiddenItems: plugin.getUXPreferences().showHiddenItems,
                setShowHiddenItems: value => plugin.setShowHiddenItems(value)
            });
        }
    );
    excludedFilesSetting.controlEl.addClass('nn-setting-wide-input');
    excludedFilesInput = excludedFilesSetting.controlEl.querySelector('input');
    refreshProfileControls();

    new Setting(containerEl).setName(strings.settings.groups.general.behavior).setHeading();

    const autoRevealSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(containerEl)
        .setName(strings.settings.items.autoRevealActiveNote.name)
        .setDesc(strings.settings.items.autoRevealActiveNote.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.autoRevealActiveFile).onChange(async value => {
                plugin.settings.autoRevealActiveFile = value;
                await plugin.saveSettingsAndUpdate();
                autoRevealSettingsEl.toggle(value);
            })
        );

    containerEl.appendChild(autoRevealSettingsEl);

    new Setting(autoRevealSettingsEl)
        .setName(strings.settings.items.autoRevealIgnoreRightSidebar.name)
        .setDesc(strings.settings.items.autoRevealIgnoreRightSidebar.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.autoRevealIgnoreRightSidebar).onChange(async value => {
                plugin.settings.autoRevealIgnoreRightSidebar = value;
                await plugin.saveSettingsAndUpdate();
            })
        );
    autoRevealSettingsEl.toggle(plugin.settings.autoRevealActiveFile);

    new Setting(containerEl)
        .setName(strings.settings.items.multiSelectModifier.name)
        .setDesc(strings.settings.items.multiSelectModifier.desc)
        .addDropdown(dropdown =>
            dropdown
                .addOption('cmdCtrl', strings.settings.items.multiSelectModifier.options.cmdCtrl)
                .addOption('optionAlt', strings.settings.items.multiSelectModifier.options.optionAlt)
                .setValue(plugin.settings.multiSelectModifier)
                .onChange(async (value: MultiSelectModifier) => {
                    plugin.settings.multiSelectModifier = value;
                    await plugin.saveSettingsAndUpdate();
                })
        );

    if (!Platform.isMobile) {
        new Setting(containerEl).setName(strings.settings.groups.general.desktopAppearance).setHeading();

        const desktopScaleSetting = new Setting(containerEl)
            .setName(strings.settings.items.appearanceScale.name)
            .setDesc(strings.settings.items.appearanceScale.desc);

        const desktopScaleValueEl = desktopScaleSetting.controlEl.createDiv({ cls: 'nn-slider-value' });
        const updateDesktopScaleLabel = (percentValue: number) => {
            desktopScaleValueEl.setText(formatUIScalePercent(percentToScale(percentValue)));
        };

        let desktopScaleSlider: SliderComponent;
        const initialDesktopScale = sanitizeUIScale(plugin.settings.desktopScale);
        const initialDesktopScalePercent = scaleToPercent(initialDesktopScale);

        desktopScaleSetting
            .addSlider(slider => {
                desktopScaleSlider = slider
                    .setLimits(MIN_UI_SCALE_PERCENT, MAX_UI_SCALE_PERCENT, UI_SCALE_PERCENT_STEP)
                    .setDynamicTooltip()
                    .setValue(initialDesktopScalePercent)
                    .onChange(async value => {
                        const nextValue = percentToScale(value);
                        plugin.settings.desktopScale = nextValue;
                        updateDesktopScaleLabel(value);
                        await plugin.saveSettingsAndUpdate();
                    });
                return slider;
            })
            .addExtraButton(button =>
                button
                    .setIcon('lucide-rotate-ccw')
                    .setTooltip('Restore to default (100%)')
                    .onClick(() => {
                        // Reset desktop scale to default without blocking the UI
                        runAsyncAction(async () => {
                            const defaultPercent = scaleToPercent(DEFAULT_UI_SCALE);
                            desktopScaleSlider.setValue(defaultPercent);
                            plugin.settings.desktopScale = DEFAULT_UI_SCALE;
                            updateDesktopScaleLabel(defaultPercent);
                            await plugin.saveSettingsAndUpdate();
                        });
                    })
            );

        updateDesktopScaleLabel(initialDesktopScalePercent);

        new Setting(containerEl)
            .setName(strings.settings.items.dualPane.name)
            .setDesc(strings.settings.items.dualPane.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.useDualPane()).onChange(value => {
                    plugin.setDualPanePreference(value);
                })
            );

        new Setting(containerEl)
            .setName(strings.settings.items.dualPaneOrientation.name)
            .setDesc(strings.settings.items.dualPaneOrientation.desc)
            .addDropdown(dropdown => {
                dropdown
                    .addOptions({
                        horizontal: strings.settings.items.dualPaneOrientation.options.horizontal,
                        vertical: strings.settings.items.dualPaneOrientation.options.vertical
                    })
                    .setValue(plugin.getDualPaneOrientation())
                    .onChange(async value => {
                        const nextOrientation = value === 'vertical' ? 'vertical' : 'horizontal';
                        await plugin.setDualPaneOrientation(nextOrientation);
                    });
            });

        new Setting(containerEl)
            .setName(strings.settings.items.appearanceBackground.name)
            .setDesc(strings.settings.items.appearanceBackground.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOptions({
                        separate: strings.settings.items.appearanceBackground.options.separate,
                        primary: strings.settings.items.appearanceBackground.options.primary,
                        secondary: strings.settings.items.appearanceBackground.options.secondary
                    })
                    .setValue(plugin.settings.desktopBackground ?? 'separate')
                    .onChange(async value => {
                        const nextValue: BackgroundMode = value === 'primary' || value === 'secondary' ? value : 'separate';
                        plugin.settings.desktopBackground = nextValue;
                        await plugin.saveSettingsAndUpdate();
                    })
            );

        let showTooltipsSubSettings: HTMLDivElement | null = null;

        const updateShowTooltipsSubSettings = (visible: boolean) => {
            if (showTooltipsSubSettings) {
                showTooltipsSubSettings.toggleClass('nn-setting-hidden', !visible);
            }
        };

        new Setting(containerEl)
            .setName(strings.settings.items.showTooltips.name)
            .setDesc(strings.settings.items.showTooltips.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.showTooltips).onChange(async value => {
                    plugin.settings.showTooltips = value;
                    await plugin.saveSettingsAndUpdate();
                    updateShowTooltipsSubSettings(value);
                })
            );

        showTooltipsSubSettings = containerEl.createDiv('nn-sub-settings');

        new Setting(showTooltipsSubSettings)
            .setName(strings.settings.items.showTooltipPath.name)
            .setDesc(strings.settings.items.showTooltipPath.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.showTooltipPath).onChange(async value => {
                    plugin.settings.showTooltipPath = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );

        updateShowTooltipsSubSettings(plugin.settings.showTooltips);
    }

    if (Platform.isMobile) {
        new Setting(containerEl).setName(strings.settings.groups.general.mobileAppearance).setHeading();

        const mobileScaleSetting = new Setting(containerEl)
            .setName(strings.settings.items.appearanceScale.name)
            .setDesc(strings.settings.items.appearanceScale.desc);

        const mobileScaleValueEl = mobileScaleSetting.controlEl.createDiv({ cls: 'nn-slider-value' });
        const updateMobileScaleLabel = (percentValue: number) => {
            mobileScaleValueEl.setText(formatUIScalePercent(percentToScale(percentValue)));
        };

        let mobileScaleSlider: SliderComponent;
        const initialMobileScale = sanitizeUIScale(plugin.settings.mobileScale);
        const initialMobileScalePercent = scaleToPercent(initialMobileScale);

        mobileScaleSetting
            .addSlider(slider => {
                mobileScaleSlider = slider
                    .setLimits(MIN_UI_SCALE_PERCENT, MAX_UI_SCALE_PERCENT, UI_SCALE_PERCENT_STEP)
                    .setDynamicTooltip()
                    .setValue(initialMobileScalePercent)
                    .onChange(async value => {
                        const nextValue = percentToScale(value);
                        plugin.settings.mobileScale = nextValue;
                        updateMobileScaleLabel(value);
                        await plugin.saveSettingsAndUpdate();
                    });
                return slider;
            })
            .addExtraButton(button =>
                button
                    .setIcon('lucide-rotate-ccw')
                    .setTooltip('Restore to default (100%)')
                    .onClick(() => {
                        // Reset mobile scale to default without blocking the UI
                        runAsyncAction(async () => {
                            const defaultPercent = scaleToPercent(DEFAULT_UI_SCALE);
                            mobileScaleSlider.setValue(defaultPercent);
                            plugin.settings.mobileScale = DEFAULT_UI_SCALE;
                            updateMobileScaleLabel(defaultPercent);
                            await plugin.saveSettingsAndUpdate();
                        });
                    })
            );

        updateMobileScaleLabel(initialMobileScalePercent);

        new Setting(containerEl)
            .setName(strings.settings.items.appearanceBackground.name)
            .setDesc(strings.settings.items.appearanceBackground.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOptions({
                        separate: strings.settings.items.appearanceBackground.options.separate,
                        primary: strings.settings.items.appearanceBackground.options.primary,
                        secondary: strings.settings.items.appearanceBackground.options.secondary
                    })
                    .setValue(plugin.settings.mobileBackground ?? 'primary')
                    .onChange(async value => {
                        const nextValue: BackgroundMode = value === 'primary' || value === 'secondary' ? value : 'separate';
                        plugin.settings.mobileBackground = nextValue;
                        await plugin.saveSettingsAndUpdate();
                    })
            );
    }

    new Setting(containerEl).setName(strings.settings.groups.general.view).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.startView.name)
        .setDesc(strings.settings.items.startView.desc)
        .addDropdown(dropdown => {
            dropdown
                .addOptions({
                    navigation: strings.settings.items.startView.options.navigation,
                    files: strings.settings.items.startView.options.files
                })
                .setValue(plugin.settings.startView)
                .onChange(async value => {
                    const nextView = value === 'navigation' ? 'navigation' : 'files';
                    plugin.settings.startView = nextView;
                    await plugin.saveSettingsAndUpdate();
                });
        });

    const homepageSetting = new Setting(containerEl).setName(strings.settings.items.homepage.name);
    homepageSetting.setDesc('');

    const homepageDescEl = homepageSetting.descEl;
    homepageDescEl.empty();
    homepageDescEl.createDiv({ text: strings.settings.items.homepage.desc });

    const homepageValueEl = homepageDescEl.createDiv();
    let clearHomepageButton: ButtonComponent | null = null;

    /** Updates the displayed homepage path and button state */
    const renderHomepageValue = () => {
        const { homepage, mobileHomepage, useMobileHomepage } = plugin.settings;
        const isMobile = Platform.isMobile;

        const activePath = isMobile && useMobileHomepage ? mobileHomepage : homepage;
        const labelTemplate =
            isMobile && useMobileHomepage
                ? (strings.settings.items.homepage.currentMobile ?? strings.settings.items.homepage.current)
                : strings.settings.items.homepage.current;

        homepageValueEl.setText('');
        if (activePath) {
            homepageValueEl.setText(labelTemplate.replace('{path}', activePath));
        }

        if (clearHomepageButton) {
            const canClear = isMobile && useMobileHomepage ? Boolean(mobileHomepage) : Boolean(homepage);
            clearHomepageButton.setDisabled(!canClear);
        }
    };

    homepageSetting.addButton(button => {
        button.setButtonText(strings.settings.items.homepage.chooseButton);
        button.onClick(() => {
            new HomepageModal(context.app, file => {
                if (Platform.isMobile && plugin.settings.useMobileHomepage) {
                    plugin.settings.mobileHomepage = file.path;
                } else {
                    plugin.settings.homepage = file.path;
                }
                renderHomepageValue();
                // Save homepage setting without blocking the UI
                runAsyncAction(() => plugin.saveSettingsAndUpdate());
            }).open();
        });
    });

    homepageSetting.addButton(button => {
        button.setButtonText(strings.settings.items.homepage.clearButton);
        clearHomepageButton = button;
        // Clear homepage file without blocking the UI
        button.onClick(() => {
            runAsyncAction(async () => {
                if (Platform.isMobile && plugin.settings.useMobileHomepage) {
                    if (!plugin.settings.mobileHomepage) {
                        return;
                    }
                    plugin.settings.mobileHomepage = null;
                } else {
                    if (!plugin.settings.homepage) {
                        return;
                    }
                    plugin.settings.homepage = null;
                }
                renderHomepageValue();
                await plugin.saveSettingsAndUpdate();
            });
        });
    });

    renderHomepageValue();

    const homepageSubSettingsEl = containerEl.createDiv('nn-sub-settings');
    new Setting(homepageSubSettingsEl)
        .setName(strings.settings.items.homepage.separateMobile.name)
        .setDesc(strings.settings.items.homepage.separateMobile.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.useMobileHomepage).onChange(async value => {
                plugin.settings.useMobileHomepage = value;
                await plugin.saveSettingsAndUpdate();
                renderHomepageValue();
            })
        );

    new Setting(containerEl)
        .setName(strings.settings.items.showIconsColorOnly.name)
        .setDesc(strings.settings.items.showIconsColorOnly.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.colorIconOnly).onChange(async value => {
                plugin.settings.colorIconOnly = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(containerEl).setName(strings.settings.groups.general.formatting).setHeading();

    const dateFormatSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.dateFormat.name,
        strings.settings.items.dateFormat.desc,
        strings.settings.items.dateFormat.placeholder,
        () => plugin.settings.dateFormat,
        value => {
            plugin.settings.dateFormat = value || 'MMM d, yyyy';
        }
    );
    dateFormatSetting.addExtraButton(button =>
        button
            .setIcon('lucide-help-circle')
            .setTooltip(strings.settings.items.dateFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.dateFormat.help, TIMEOUTS.NOTICE_HELP);
            })
    );
    dateFormatSetting.controlEl.addClass('nn-setting-wide-input');

    const timeFormatSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.timeFormat.name,
        strings.settings.items.timeFormat.desc,
        strings.settings.items.timeFormat.placeholder,
        () => plugin.settings.timeFormat,
        value => {
            plugin.settings.timeFormat = value || 'h:mm a';
        }
    );
    timeFormatSetting.addExtraButton(button =>
        button
            .setIcon('lucide-help-circle')
            .setTooltip(strings.settings.items.timeFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.timeFormat.help, TIMEOUTS.NOTICE_HELP);
            })
    );
    timeFormatSetting.controlEl.addClass('nn-setting-wide-input');
}
