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

import { ButtonComponent, DropdownComponent, Platform, Setting, SliderComponent, setIcon } from 'obsidian';
import { HomepageModal } from '../../modals/HomepageModal';
import { strings } from '../../i18n';
import { showNotice } from '../../utils/noticeUtils';
import { FILE_VISIBILITY, type FileVisibility } from '../../utils/fileTypeUtils';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { BackgroundMode } from '../../types';
import type { ListToolbarButtonId, MultiSelectModifier, NavigationToolbarButtonId } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { resetHiddenToggleIfNoSources } from '../../utils/exclusionUtils';
import { InputModal } from '../../modals/InputModal';
import { EditVaultProfilesModal } from '../../modals/EditVaultProfilesModal';
import {
    DEFAULT_UI_SCALE,
    formatUIScalePercent,
    MIN_UI_SCALE_PERCENT,
    MAX_UI_SCALE_PERCENT,
    UI_SCALE_PERCENT_STEP,
    scaleToPercent,
    percentToScale
} from '../../utils/uiScale';
import { runAsyncAction } from '../../utils/async';
import {
    DEFAULT_VAULT_PROFILE_ID,
    ensureVaultProfiles,
    createValidatedVaultProfileFromTemplate,
    validateVaultProfileNameOrNotify
} from '../../utils/vaultProfiles';
import { normalizeTagPath } from '../../utils/tagUtils';
import type NotebookNavigatorPlugin from '../../main';
import { createSettingGroupFactory } from '../settingGroups';
import { createSubSettingsContainer, setElementVisible, wireToggleSettingWithSubSettings } from '../subSettings';

/** Renders the general settings tab */
export function renderGeneralTab(context: SettingsTabContext): void {
    const { containerEl, plugin, addToggleSetting, configureDebouncedTextSetting } = context;
    const pluginVersion = plugin.manifest.version;
    ensureVaultProfiles(plugin.settings);

    const createGroup = createSettingGroupFactory(containerEl);
    const topGroup = createGroup(undefined);

    let updateStatusEl: HTMLDivElement | null = null;

    const renderUpdateStatus = (version: string | null) => {
        if (!updateStatusEl) {
            return;
        }
        const hasVersion = Boolean(version);
        updateStatusEl.setText(hasVersion ? strings.settings.items.updateCheckOnStart.status.replace('{version}', version ?? '') : '');
        setElementVisible(updateStatusEl, hasVersion);
    };

    const applyCurrentNotice = () => {
        const notice = plugin.getPendingUpdateNotice();
        renderUpdateStatus(notice?.version ?? null);
    };

    const updateStatusListenerId = 'general-update-status';
    plugin.unregisterUpdateNoticeListener(updateStatusListenerId);

    const whatsNewSetting = topGroup.addSetting(setting => {
        setting
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
    });

    updateStatusEl = whatsNewSetting.descEl.createDiv({ cls: 'setting-item-description nn-update-status nn-setting-hidden' });

    applyCurrentNotice();

    plugin.registerUpdateNoticeListener(updateStatusListenerId, notice => {
        renderUpdateStatus(notice?.version ?? null);
    });

    const supportSetting = topGroup.addSetting(setting => {
        setting.setName(strings.settings.items.supportDevelopment.name).setDesc(strings.settings.items.supportDevelopment.desc);
    });

    const filteringGroup = createGroup(strings.settings.groups.general.filtering);

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

    const ADD_PROFILE_OPTION_VALUE = '__add_new__';
    let profileDropdown: DropdownComponent | null = null;
    let fileVisibilityDropdown: DropdownComponent | null = null;
    let excludedFoldersInput: HTMLInputElement | null = null;
    let hiddenTagsInput: HTMLInputElement | null = null;
    let excludedFilesInput: HTMLInputElement | null = null;
    let hiddenFileNamePatternsInput: HTMLInputElement | null = null;

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
            selectEl.createEl('option', {
                value: ADD_PROFILE_OPTION_VALUE,
                text: strings.settings.items.vaultProfiles.addProfileOption
            });
            const hasActive = plugin.settings.vaultProfiles.some(profile => profile.id === plugin.settings.vaultProfile);
            const nextActiveId = hasActive ? plugin.settings.vaultProfile : (plugin.settings.vaultProfiles[0]?.id ?? '');
            selectEl.value = nextActiveId;
        }
        const activeProfile = getActiveProfile();
        if (fileVisibilityDropdown) {
            fileVisibilityDropdown.setValue(activeProfile?.fileVisibility ?? FILE_VISIBILITY.SUPPORTED);
        }
        if (excludedFoldersInput) {
            excludedFoldersInput.value = activeProfile ? activeProfile.hiddenFolders.join(', ') : '';
        }
        if (hiddenTagsInput) {
            hiddenTagsInput.value = activeProfile ? activeProfile.hiddenTags.join(', ') : '';
        }
        if (excludedFilesInput) {
            excludedFilesInput.value = activeProfile ? activeProfile.hiddenFiles.join(', ') : '';
        }
        if (hiddenFileNamePatternsInput) {
            hiddenFileNamePatternsInput.value = activeProfile ? activeProfile.hiddenFileNamePatterns.join(', ') : '';
        }
    };

    // Creates a new vault profile with the given name and switches to it
    const handleAddProfile = async (profileName: string) => {
        const validatedName = validateVaultProfileNameOrNotify(plugin.settings.vaultProfiles, profileName);
        if (!validatedName) {
            return;
        }
        const activeProfile = getActiveProfile();
        const result = createValidatedVaultProfileFromTemplate(plugin.settings.vaultProfiles, validatedName, {
            sourceProfile: activeProfile,
            fallbackHiddenTags: activeProfile?.hiddenTags,
            fallbackFileVisibility: activeProfile?.fileVisibility
        });

        if ('error' in result) {
            if (result.error === 'duplicate') {
                showNotice(strings.settings.items.vaultProfiles.errors.duplicateName, { variant: 'warning' });
            } else {
                showNotice(strings.settings.items.vaultProfiles.errors.emptyName, { variant: 'warning' });
            }
            return;
        }

        plugin.settings.vaultProfiles.push(result.profile);
        plugin.setVaultProfile(result.profile.id);
        await plugin.saveSettingsAndUpdate();
        refreshProfileControls();
    };

    // Returns the requested profile ID if it exists, otherwise falls back to default or first profile
    const resolveActiveProfileId = (profiles: typeof plugin.settings.vaultProfiles, requestedId: string) => {
        const hasRequested = profiles.some(profile => profile.id === requestedId);
        if (hasRequested) {
            return requestedId;
        }
        const defaultProfile = profiles.find(profile => profile.id === DEFAULT_VAULT_PROFILE_ID);
        if (defaultProfile) {
            return defaultProfile.id;
        }
        return profiles[0]?.id ?? DEFAULT_VAULT_PROFILE_ID;
    };

    // Opens the modal for editing, reordering, and deleting vault profiles
    const openEditProfilesModal = () => {
        const modal = new EditVaultProfilesModal(context.app, {
            profiles: plugin.settings.vaultProfiles,
            activeProfileId: plugin.settings.vaultProfile,
            onSave: async (updatedProfiles, nextActiveProfileId) => {
                plugin.settings.vaultProfiles = updatedProfiles;
                const targetProfileId = resolveActiveProfileId(updatedProfiles, nextActiveProfileId);
                if (plugin.settings.vaultProfile === targetProfileId) {
                    await plugin.saveSettingsAndUpdate();
                } else {
                    plugin.setVaultProfile(targetProfileId);
                    await plugin.saveSettingsAndUpdate();
                }
                refreshProfileControls();
            }
        });
        modal.open();
    };

    const profileSetting = filteringGroup.addSetting(setting => {
        setting.setName(strings.settings.items.vaultProfiles.name).setDesc(strings.settings.items.vaultProfiles.desc);
    });

    profileSetting.addDropdown(dropdown => {
        profileDropdown = dropdown;
        refreshProfileControls();
        dropdown.onChange(value => {
            // Handle "Add new profile" option by opening the input modal
            if (value === ADD_PROFILE_OPTION_VALUE) {
                if (profileDropdown) {
                    profileDropdown.selectEl.value = plugin.settings.vaultProfile;
                }
                const modal = new InputModal(
                    context.app,
                    strings.settings.items.vaultProfiles.addModalTitle,
                    strings.settings.items.vaultProfiles.addModalPlaceholder,
                    profileName => handleAddProfile(profileName)
                );
                modal.open();
                return;
            }
            runAsyncAction(() => {
                plugin.setVaultProfile(value);
                refreshProfileControls();
            });
        });
        return dropdown;
    });

    profileSetting.addButton(button => {
        button.setButtonText(strings.settings.items.vaultProfiles.editProfilesButton).onClick(() => {
            openEditProfilesModal();
        });
        return button;
    });

    profileSetting.controlEl.addClass('nn-setting-profile-dropdown');

    filteringGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.fileVisibility.name)
            .setDesc(strings.settings.items.fileVisibility.desc)
            .addDropdown(dropdown => {
                fileVisibilityDropdown = dropdown;
                dropdown
                    .addOption(FILE_VISIBILITY.DOCUMENTS, strings.settings.items.fileVisibility.options.documents)
                    .addOption(FILE_VISIBILITY.SUPPORTED, strings.settings.items.fileVisibility.options.supported)
                    .addOption(FILE_VISIBILITY.ALL, strings.settings.items.fileVisibility.options.all)
                    .setValue(getActiveProfile()?.fileVisibility ?? FILE_VISIBILITY.SUPPORTED)
                    .onChange(async (value: FileVisibility) => {
                        const activeProfile = plugin.settings.vaultProfiles.find(profile => profile.id === plugin.settings.vaultProfile);
                        if (activeProfile) {
                            activeProfile.fileVisibility = value;
                        }
                        await plugin.saveSettingsAndUpdate();
                        refreshProfileControls();
                    });
                return dropdown;
            });
    });

    const hiddenFileNamePatternsSetting = filteringGroup.addSetting(setting => {
        configureDebouncedTextSetting(
            setting,
            strings.settings.items.excludedFileNamePatterns.name,
            strings.settings.items.excludedFileNamePatterns.desc,
            strings.settings.items.excludedFileNamePatterns.placeholder,
            () => getActiveProfile()?.hiddenFileNamePatterns.join(', ') ?? '',
            value => {
                const activeProfile = getActiveProfile();
                if (!activeProfile) {
                    return;
                }
                const nextHiddenPatterns = value
                    .split(',')
                    .map(pattern => pattern.trim())
                    .filter(pattern => pattern.length > 0);
                activeProfile.hiddenFileNamePatterns = Array.from(new Set(nextHiddenPatterns));
                resetHiddenToggleIfNoSources({
                    settings: plugin.settings,
                    showHiddenItems: plugin.getUXPreferences().showHiddenItems,
                    setShowHiddenItems: value => plugin.setShowHiddenItems(value)
                });
            }
        );
    });
    hiddenFileNamePatternsSetting.controlEl.addClass('nn-setting-wide-input');
    hiddenFileNamePatternsInput = hiddenFileNamePatternsSetting.controlEl.querySelector('input');

    const excludedFoldersSetting = filteringGroup.addSetting(setting => {
        configureDebouncedTextSetting(
            setting,
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
    });
    excludedFoldersSetting.controlEl.addClass('nn-setting-wide-input');
    excludedFoldersInput = excludedFoldersSetting.controlEl.querySelector('input');

    const hiddenTagsSetting = filteringGroup.addSetting(setting => {
        configureDebouncedTextSetting(
            setting,
            strings.settings.items.hiddenTags.name,
            strings.settings.items.hiddenTags.desc,
            strings.settings.items.hiddenTags.placeholder,
            () => getActiveProfile()?.hiddenTags.join(', ') ?? '',
            value => {
                const activeProfile = getActiveProfile();
                if (!activeProfile) {
                    return;
                }
                const normalizedHiddenTags = value
                    .split(',')
                    .map(entry => normalizeTagPath(entry))
                    .filter((entry): entry is string => entry !== null);

                activeProfile.hiddenTags = Array.from(new Set(normalizedHiddenTags));
                resetHiddenToggleIfNoSources({
                    settings: plugin.settings,
                    showHiddenItems: plugin.getUXPreferences().showHiddenItems,
                    setShowHiddenItems: value => plugin.setShowHiddenItems(value)
                });
            }
        );
    });
    hiddenTagsSetting.controlEl.addClass('nn-setting-wide-input');
    hiddenTagsInput = hiddenTagsSetting.controlEl.querySelector('input');

    const excludedFilesSetting = filteringGroup.addSetting(setting => {
        configureDebouncedTextSetting(
            setting,
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
    });
    excludedFilesSetting.controlEl.addClass('nn-setting-wide-input');
    excludedFilesInput = excludedFilesSetting.controlEl.querySelector('input');
    refreshProfileControls();

    const behaviorGroup = createGroup(strings.settings.groups.general.behavior);

    const autoRevealSetting = behaviorGroup.addSetting(setting => {
        setting.setName(strings.settings.items.autoRevealActiveNote.name).setDesc(strings.settings.items.autoRevealActiveNote.desc);
    });

    const autoRevealSettingsEl = wireToggleSettingWithSubSettings(
        autoRevealSetting,
        () => plugin.settings.autoRevealActiveFile,
        async value => {
            plugin.settings.autoRevealActiveFile = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    new Setting(autoRevealSettingsEl)
        .setName(strings.settings.items.autoRevealIgnoreRightSidebar.name)
        .setDesc(strings.settings.items.autoRevealIgnoreRightSidebar.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.autoRevealIgnoreRightSidebar).onChange(async value => {
                plugin.settings.autoRevealIgnoreRightSidebar = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    behaviorGroup.addSetting(setting => {
        setting
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
    });

    if (!Platform.isMobile) {
        const desktopAppearanceGroup = createGroup(strings.settings.groups.general.desktopAppearance);

        desktopAppearanceGroup.addSetting(setting => {
            setting
                .setName(strings.settings.items.dualPane.name)
                .setDesc(strings.settings.items.dualPane.desc)
                .addToggle(toggle =>
                    toggle.setValue(plugin.useDualPane()).onChange(value => {
                        plugin.setDualPanePreference(value);
                    })
                );
        });

        desktopAppearanceGroup.addSetting(setting => {
            setting
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
        });

        desktopAppearanceGroup.addSetting(setting => {
            setting
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
        });

        const showTooltipsSetting = desktopAppearanceGroup.addSetting(setting => {
            setting.setName(strings.settings.items.showTooltips.name).setDesc(strings.settings.items.showTooltips.desc);
        });

        const showTooltipsSubSettings = wireToggleSettingWithSubSettings(
            showTooltipsSetting,
            () => plugin.settings.showTooltips,
            async value => {
                plugin.settings.showTooltips = value;
                await plugin.saveSettingsAndUpdate();
            }
        );

        new Setting(showTooltipsSubSettings)
            .setName(strings.settings.items.showTooltipPath.name)
            .setDesc(strings.settings.items.showTooltipPath.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.showTooltipPath).onChange(async value => {
                    plugin.settings.showTooltipPath = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );
    }

    if (Platform.isMobile) {
        const mobileAppearanceGroup = createGroup(strings.settings.groups.general.mobileAppearance);

        mobileAppearanceGroup.addSetting(setting => {
            setting
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
        });
    }

    const viewGroup = createGroup(strings.settings.groups.general.view);

    const uiScaleSetting = viewGroup.addSetting(setting => {
        setting.setName(strings.settings.items.appearanceScale.name).setDesc(strings.settings.items.appearanceScale.desc);
    });

    const uiScaleValueEl = uiScaleSetting.controlEl.createDiv({ cls: 'nn-slider-value' });
    const updateUIScaleLabel = (percentValue: number) => {
        uiScaleValueEl.setText(formatUIScalePercent(percentToScale(percentValue)));
    };

    let uiScaleSlider: SliderComponent;
    const initialUIScalePercent = scaleToPercent(plugin.getUIScale());

    uiScaleSetting
        .addSlider(slider => {
            uiScaleSlider = slider
                .setLimits(MIN_UI_SCALE_PERCENT, MAX_UI_SCALE_PERCENT, UI_SCALE_PERCENT_STEP)
                .setInstant(false)
                .setDynamicTooltip()
                .setValue(initialUIScalePercent)
                .onChange(value => {
                    const nextValue = percentToScale(value);
                    plugin.setUIScale(nextValue);
                    updateUIScaleLabel(value);
                });
            return slider;
        })
        .addExtraButton(button =>
            button
                .setIcon('lucide-rotate-ccw')
                .setTooltip('Restore to default (100%)')
                .onClick(() => {
                    const defaultPercent = scaleToPercent(DEFAULT_UI_SCALE);
                    uiScaleSlider.setValue(defaultPercent);
                    plugin.setUIScale(DEFAULT_UI_SCALE);
                    updateUIScaleLabel(defaultPercent);
                })
        );

    updateUIScaleLabel(initialUIScalePercent);

    viewGroup.addSetting(setting => {
        setting
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
    });

    const homepageSetting = viewGroup.addSetting(setting => {
        setting.setName(strings.settings.items.homepage.name);
    });
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
        button.setButtonText(strings.common.clear);
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

    const homepageSubSettingsEl = createSubSettingsContainer(homepageSetting);
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

    addToggleSetting(
        viewGroup.addSetting,
        strings.settings.items.showIconsColorOnly.name,
        strings.settings.items.showIconsColorOnly.desc,
        () => plugin.settings.colorIconOnly,
        value => {
            plugin.settings.colorIconOnly = value;
        }
    );

    renderToolbarVisibilitySetting(createSetting => viewGroup.addSetting(createSetting), plugin);

    const formattingGroup = createGroup(strings.settings.groups.general.formatting);

    const dateFormatSetting = formattingGroup.addSetting(setting => {
        configureDebouncedTextSetting(
            setting,
            strings.settings.items.dateFormat.name,
            strings.settings.items.dateFormat.desc,
            strings.settings.items.dateFormat.placeholder,
            () => plugin.settings.dateFormat,
            value => {
                plugin.settings.dateFormat = value || 'MMM d, yyyy';
            }
        );
    });
    dateFormatSetting.addExtraButton(button =>
        button
            .setIcon('lucide-help-circle')
            .setTooltip(strings.settings.items.dateFormat.helpTooltip)
            .onClick(() => {
                showNotice(strings.settings.items.dateFormat.help, { timeout: TIMEOUTS.NOTICE_HELP });
            })
    );
    dateFormatSetting.controlEl.addClass('nn-setting-wide-input');

    const timeFormatSetting = formattingGroup.addSetting(setting => {
        configureDebouncedTextSetting(
            setting,
            strings.settings.items.timeFormat.name,
            strings.settings.items.timeFormat.desc,
            strings.settings.items.timeFormat.placeholder,
            () => plugin.settings.timeFormat,
            value => {
                plugin.settings.timeFormat = value || 'h:mm a';
            }
        );
    });
    timeFormatSetting.addExtraButton(button =>
        button
            .setIcon('lucide-help-circle')
            .setTooltip(strings.settings.items.timeFormat.helpTooltip)
            .onClick(() => {
                showNotice(strings.settings.items.timeFormat.help, { timeout: TIMEOUTS.NOTICE_HELP });
            })
    );
    timeFormatSetting.controlEl.addClass('nn-setting-wide-input');
}

interface ToolbarButtonConfig<T extends string> {
    id: T;
    icon: string;
    label: string;
}

const NAVIGATION_TOOLBAR_BUTTONS: ToolbarButtonConfig<NavigationToolbarButtonId>[] = [
    { id: 'shortcuts', icon: 'lucide-bookmark', label: strings.navigationPane.pinShortcuts },
    { id: 'expandCollapse', icon: 'lucide-chevrons-up-down', label: strings.paneHeader.expandAllFolders },
    { id: 'hiddenItems', icon: 'lucide-eye', label: strings.paneHeader.showExcludedItems },
    { id: 'rootReorder', icon: 'lucide-list-tree', label: strings.paneHeader.reorderRootFolders },
    { id: 'newFolder', icon: 'lucide-folder-plus', label: strings.paneHeader.newFolder }
];

const LIST_TOOLBAR_BUTTONS: ToolbarButtonConfig<ListToolbarButtonId>[] = [
    { id: 'search', icon: 'lucide-search', label: strings.paneHeader.search },
    { id: 'descendants', icon: 'lucide-layers', label: strings.paneHeader.toggleDescendantNotes },
    { id: 'sort', icon: 'lucide-arrow-down-up', label: strings.paneHeader.changeSortOrder },
    { id: 'appearance', icon: 'lucide-palette', label: strings.paneHeader.changeAppearance },
    { id: 'newNote', icon: 'lucide-pen-box', label: strings.paneHeader.newNote }
];

function renderToolbarVisibilitySetting(
    addSetting: (createSetting: (setting: Setting) => void) => Setting,
    plugin: NotebookNavigatorPlugin
): void {
    const setting = addSetting(setting => {
        setting.setName(strings.settings.items.toolbarButtons.name).setDesc(strings.settings.items.toolbarButtons.desc);
    });

    setting.controlEl.addClass('nn-toolbar-visibility-control');
    const sectionsEl = setting.controlEl.createDiv({ cls: 'nn-toolbar-visibility-sections' });

    createToolbarButtonGroup({
        containerEl: sectionsEl,
        label: strings.settings.items.toolbarButtons.navigationLabel,
        buttons: NAVIGATION_TOOLBAR_BUTTONS,
        state: plugin.settings.toolbarVisibility.navigation,
        onToggle: () => {
            runAsyncAction(async () => {
                await plugin.saveSettingsAndUpdate();
            });
        }
    });

    createToolbarButtonGroup({
        containerEl: sectionsEl,
        label: strings.settings.items.toolbarButtons.listLabel,
        buttons: LIST_TOOLBAR_BUTTONS,
        state: plugin.settings.toolbarVisibility.list,
        onToggle: () => {
            runAsyncAction(async () => {
                await plugin.saveSettingsAndUpdate();
            });
        }
    });
}

interface ToolbarButtonGroupProps<T extends string> {
    containerEl: HTMLElement;
    label: string;
    buttons: ToolbarButtonConfig<T>[];
    state: Record<T, boolean>;
    onToggle: () => void;
}

function createToolbarButtonGroup<T extends string>({ containerEl, label, buttons, state, onToggle }: ToolbarButtonGroupProps<T>): void {
    const groupEl = containerEl.createDiv({ cls: 'nn-toolbar-visibility-group' });
    groupEl.createDiv({ cls: 'nn-toolbar-visibility-group-label', text: label });
    const gridEl = groupEl.createDiv({ cls: ['nn-toolbar-visibility-grid', 'nn-toolbar-visibility-grid-scroll'] });

    buttons.forEach(button => {
        const buttonEl = gridEl.createEl('button', {
            cls: ['nn-toolbar-visibility-toggle', 'nn-mobile-toolbar-button'],
            attr: { type: 'button' }
        });
        buttonEl.setAttr('aria-pressed', state[button.id] ? 'true' : 'false');
        buttonEl.setAttr('aria-label', button.label);
        buttonEl.setAttr('title', button.label);

        const iconEl = buttonEl.createSpan({ cls: 'nn-toolbar-visibility-icon' });
        setIcon(iconEl, button.icon);

        const applyState = () => {
            const isEnabled = Boolean(state[button.id]);
            buttonEl.classList.toggle('is-active', isEnabled);
            buttonEl.classList.toggle('nn-mobile-toolbar-button-active', isEnabled);
            buttonEl.setAttr('aria-pressed', isEnabled ? 'true' : 'false');
        };

        buttonEl.addEventListener('click', () => {
            state[button.id] = !state[button.id];
            applyState();
            onToggle();
        });

        applyState();
    });
}
