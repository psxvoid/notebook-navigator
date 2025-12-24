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

import type React from 'react';
import { Menu } from 'obsidian';
import { useSelectionState } from '../context/SelectionContext';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { useUIState } from '../context/UIStateContext';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useNavigationActions } from '../hooks/useNavigationActions';
import { hasHiddenItemSources } from '../utils/exclusionUtils';
import { runAsyncAction } from '../utils/async';
import { getLocalizedDefaultVaultProfileName } from '../utils/vaultProfiles';

interface NavigationPaneHeaderProps {
    onTreeUpdateComplete?: () => void;
    onTogglePinnedShortcuts?: () => void;
    onToggleRootFolderReorder?: () => void;
    rootReorderActive?: boolean;
    rootReorderDisabled?: boolean;
    pinToggleLabel?: string;
}

export function NavigationPaneHeader({
    onTreeUpdateComplete,
    onTogglePinnedShortcuts,
    onToggleRootFolderReorder,
    rootReorderActive,
    rootReorderDisabled,
    pinToggleLabel
}: NavigationPaneHeaderProps) {
    const { isMobile, plugin } = useServices();
    const settings = useSettingsState();
    const uxPreferences = useUXPreferences();
    const showHiddenItems = uxPreferences.showHiddenItems;
    const uiState = useUIState();
    const selectionState = useSelectionState();
    const vaultProfiles = settings.vaultProfiles ?? [];
    const activeProfileId = settings.vaultProfile;
    const activeProfile = vaultProfiles.find(profile => profile.id === activeProfileId) ?? vaultProfiles[0] ?? null;
    const profileNameFallback = getLocalizedDefaultVaultProfileName();
    const activeProfileName = activeProfile?.name?.trim().length ? activeProfile.name : profileNameFallback;
    const hasProfiles = vaultProfiles.length > 0;
    const hasMultipleProfiles = vaultProfiles.length > 1;

    // Hook providing shared navigation actions (expand/collapse, folder creation, toggle visibility)
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleShowExcludedFolders } = useNavigationActions();
    // Detects if any hidden folders, tags, or files are configured to determine if toggle should be shown
    const hasHiddenItems = hasHiddenItemSources(settings);
    const navigationVisibility = settings.toolbarVisibility.navigation;
    const showShortcutsButton = settings.showShortcuts && navigationVisibility.shortcuts;
    const showExpandCollapseButton = navigationVisibility.expandCollapse;
    const showHiddenItemsButton = navigationVisibility.hiddenItems && hasHiddenItems;
    const showRootReorderButton = navigationVisibility.rootReorder;
    const showNewFolderButton = navigationVisibility.newFolder;

    // Creates a dropdown menu displaying all available vault profiles
    const createProfileMenu = () => {
        const menu = new Menu();
        vaultProfiles.forEach(profile => {
            menu.addItem(item => {
                const profileName = profile.name?.trim().length ? profile.name : profileNameFallback;
                item.setTitle(profileName)
                    .setIcon(profile.id === activeProfile?.id ? 'lucide-check' : 'lucide-user')
                    .setDisabled(profile.id === activeProfile?.id)
                    .onClick(() => {
                        runAsyncAction(() => {
                            plugin.setVaultProfile(profile.id);
                        });
                    });
            });
        });
        return menu;
    };

    // Handles mouse click on the profile selector to show the profile menu
    const handleProfileTriggerClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (!activeProfile) {
            return;
        }

        const menu = createProfileMenu();
        menu.showAtMouseEvent(event.nativeEvent);
    };

    // Handles keyboard activation (Enter or Space) on the profile selector to show the profile menu
    const handleProfileTriggerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (!activeProfile) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const menu = createProfileMenu();
        menu.showAtPosition({
            x: rect.left + rect.width / 2,
            y: rect.bottom
        });
    };

    if (!hasProfiles) {
        return null;
    }

    // Clickable element that displays the active profile name and opens the profile menu on interaction
    const profileTrigger = hasMultipleProfiles ? (
        <div
            className="nn-pane-header-title nn-pane-header-profile"
            aria-label={strings.navigationPane.profileMenuAria}
            role="button"
            tabIndex={0}
            onClick={handleProfileTriggerClick}
            onKeyDown={handleProfileTriggerKeyDown}
        >
            <span className="nn-pane-header-text">{activeProfileName}</span>
            <ObsidianIcon className="nn-pane-header-profile-chevron" name="lucide-chevron-down" aria-hidden={true} />
        </div>
    ) : null;

    if (isMobile) {
        if (!profileTrigger) {
            return null;
        }
        return <div className="nn-pane-header nn-pane-header-simple">{profileTrigger}</div>;
    }

    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions nn-header-actions--space-between">
                <div className="nn-header-actions nn-header-actions-profile">
                    <button
                        className="nn-icon-button"
                        aria-label={uiState.dualPane ? strings.paneHeader.showSinglePane : strings.paneHeader.showDualPane}
                        onClick={() => {
                            plugin.setDualPanePreference(!plugin.useDualPane());
                        }}
                        tabIndex={-1}
                        type="button"
                    >
                        <ObsidianIcon name={uiState.dualPane ? 'lucide-panel-left-dashed' : 'lucide-panel-left'} />
                    </button>
                    {profileTrigger}
                </div>
                <div className="nn-header-actions">
                    {showShortcutsButton ? (
                        <button
                            className={`nn-icon-button ${uiState.pinShortcuts ? 'nn-icon-button-active' : ''}`}
                            aria-label={
                                pinToggleLabel ??
                                (uiState.pinShortcuts ? strings.navigationPane.unpinShortcuts : strings.navigationPane.pinShortcuts)
                            }
                            onClick={() => {
                                if (onTogglePinnedShortcuts) {
                                    onTogglePinnedShortcuts();
                                }
                            }}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="lucide-bookmark" />
                        </button>
                    ) : null}
                    {showExpandCollapseButton ? (
                        <button
                            className="nn-icon-button"
                            aria-label={shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders}
                            onClick={() => {
                                handleExpandCollapseAll();
                                if (onTreeUpdateComplete) {
                                    // Defer callback until after DOM updates complete
                                    requestAnimationFrame(() => {
                                        onTreeUpdateComplete();
                                    });
                                }
                            }}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name={shouldCollapseItems() ? 'lucide-chevrons-down-up' : 'lucide-chevrons-up-down'} />
                        </button>
                    ) : null}
                    {showHiddenItemsButton ? (
                        <button
                            className={`nn-icon-button ${showHiddenItems ? 'nn-icon-button-active' : ''}`}
                            aria-label={showHiddenItems ? strings.paneHeader.hideExcludedItems : strings.paneHeader.showExcludedItems}
                            onClick={() => {
                                handleToggleShowExcludedFolders();
                                if (onTreeUpdateComplete) {
                                    // Defer callback until after DOM updates complete
                                    requestAnimationFrame(() => {
                                        onTreeUpdateComplete();
                                    });
                                }
                            }}
                            disabled={!hasHiddenItems}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="lucide-eye" />
                        </button>
                    ) : null}
                    {showRootReorderButton ? (
                        <button
                            className={`nn-icon-button ${rootReorderActive ? 'nn-icon-button-active' : ''}`}
                            aria-label={
                                rootReorderActive ? strings.paneHeader.finishRootFolderReorder : strings.paneHeader.reorderRootFolders
                            }
                            onClick={onToggleRootFolderReorder}
                            disabled={rootReorderDisabled}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="lucide-list-tree" />
                        </button>
                    ) : null}
                    {showNewFolderButton ? (
                        <button
                            className="nn-icon-button"
                            aria-label={strings.paneHeader.newFolder}
                            onClick={() => {
                                runAsyncAction(() => handleNewFolder());
                            }}
                            disabled={!selectionState.selectedFolder}
                            tabIndex={-1}
                        >
                            <ObsidianIcon name="lucide-folder-plus" />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
