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

import { MenuItem } from 'obsidian';
import { TagMenuBuilderParams } from './menuTypes';
import { strings } from '../../i18n';
import { cleanupTagPatterns, createHiddenTagMatcher, matchesHiddenTagPattern } from '../tagPrefixMatcher';
import { ItemType, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../../types';
import { normalizeTagPath } from '../tagUtils';
import { resetHiddenToggleIfNoSources } from '../exclusionUtils';

/**
 * Builds the context menu for a tag
 */
export function buildTagMenu(params: TagMenuBuilderParams): void {
    const { tagPath, menu, services, settings } = params;
    const { app, metadataService, plugin, isMobile } = services;

    // Show tag name on mobile
    if (isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(`#${tagPath}`).setIsLabel(true);
        });
    }

    // Add rename option for user-created tags
    const isVirtualTag = tagPath === UNTAGGED_TAG_ID || tagPath === TAGGED_TAG_ID;
    if (!isVirtualTag) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.modals.tagOperation.confirmRename)
                .setIcon('lucide-pencil')
                .onClick(() => {
                    void services.tagOperations.promptRenameTag(tagPath);
                });
        });

        menu.addSeparator();
    }

    if (services.shortcuts) {
        const { tagShortcutKeysByPath, addTagShortcut, removeShortcut } = services.shortcuts;
        const normalizedShortcutPath = normalizeTagPath(tagPath);
        const existingShortcutKey = normalizedShortcutPath ? tagShortcutKeysByPath.get(normalizedShortcutPath) : undefined;

        menu.addItem((item: MenuItem) => {
            if (existingShortcutKey) {
                item.setTitle(strings.shortcuts.remove)
                    .setIcon('lucide-bookmark-x')
                    .onClick(() => {
                        void removeShortcut(existingShortcutKey);
                    });
            } else {
                item.setTitle(strings.shortcuts.add)
                    .setIcon('lucide-bookmark')
                    .onClick(() => {
                        void addTagShortcut(tagPath);
                    });
            }
        });

        menu.addSeparator();
    }

    // Change icon
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.tag.changeIcon)
            .setIcon('lucide-image')
            .onClick(async () => {
                const { IconPickerModal } = await import('../../modals/IconPickerModal');
                const modal = new IconPickerModal(app, metadataService, tagPath, ItemType.TAG);
                modal.open();
            });
    });

    // Change color
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.tag.changeColor)
            .setIcon('lucide-palette')
            .onClick(async () => {
                const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                const modal = new ColorPickerModal(app, metadataService, tagPath, ItemType.TAG, 'foreground');
                modal.open();
            });
    });

    // Change background color
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.tag.changeBackground)
            .setIcon('lucide-paint-bucket')
            .onClick(async () => {
                const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                const modal = new ColorPickerModal(app, metadataService, tagPath, ItemType.TAG, 'background');
                modal.open();
            });
    });

    // Don't show hide tag option for the Untagged virtual tag
    if (tagPath !== UNTAGGED_TAG_ID) {
        menu.addSeparator();

        const hiddenMatcher = createHiddenTagMatcher(settings.hiddenTags);
        const hasHiddenRules =
            hiddenMatcher.prefixes.length > 0 || hiddenMatcher.startsWithNames.length > 0 || hiddenMatcher.endsWithNames.length > 0;
        const tagName = tagPath.split('/').pop() ?? tagPath;
        const isHidden = hasHiddenRules && matchesHiddenTagPattern(tagPath, tagName, hiddenMatcher);

        const normalizedTagPath = normalizeTagPath(tagPath);
        const hasDirectHiddenEntry =
            normalizedTagPath !== null &&
            settings.hiddenTags.some(pattern => {
                const normalizedPattern = normalizeTagPath(pattern);
                return normalizedPattern !== null && !normalizedPattern.includes('*') && normalizedPattern === normalizedTagPath;
            });

        if (!isHidden) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.tag.hideTag)
                    .setIcon('lucide-eye-off')
                    .onClick(async () => {
                        // Clean up redundant entries when adding new hidden tag
                        const cleanedHiddenTags = cleanupTagPatterns(settings.hiddenTags, tagPath);

                        plugin.settings.hiddenTags = cleanedHiddenTags;
                        resetHiddenToggleIfNoSources({
                            settings: plugin.settings,
                            showHiddenItems: services.visibility.showHiddenItems,
                            setShowHiddenItems: value => plugin.setShowHiddenItems(value)
                        });
                        await plugin.saveSettingsAndUpdate();
                    });
            });
        } else if (hasDirectHiddenEntry && normalizedTagPath) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.tag.showTag)
                    .setIcon('lucide-eye')
                    .onClick(async () => {
                        plugin.settings.hiddenTags = settings.hiddenTags.filter(pattern => {
                            const normalizedPattern = normalizeTagPath(pattern);
                            return !(normalizedPattern && !normalizedPattern.includes('*') && normalizedPattern === normalizedTagPath);
                        });

                        resetHiddenToggleIfNoSources({
                            settings: plugin.settings,
                            showHiddenItems: services.visibility.showHiddenItems,
                            setShowHiddenItems: value => plugin.setShowHiddenItems(value)
                        });
                        await plugin.saveSettingsAndUpdate();
                    });
            });
        }
    }
}
