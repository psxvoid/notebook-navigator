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
import { setAsyncOnClick } from './menuAsyncHelpers';
import { addStyleMenu } from './styleMenuBuilder';

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

    // Add rename/delete options only for real tags (not virtual aggregations)
    const isVirtualTag = tagPath === UNTAGGED_TAG_ID || tagPath === TAGGED_TAG_ID;

    if (services.shortcuts) {
        const { tagShortcutKeysByPath, addTagShortcut, removeShortcut } = services.shortcuts;
        const normalizedShortcutPath = normalizeTagPath(tagPath);
        const existingShortcutKey = normalizedShortcutPath ? tagShortcutKeysByPath.get(normalizedShortcutPath) : undefined;

        menu.addItem((item: MenuItem) => {
            if (existingShortcutKey) {
                setAsyncOnClick(item.setTitle(strings.shortcuts.remove).setIcon('lucide-bookmark-x'), async () => {
                    await removeShortcut(existingShortcutKey);
                });
            } else {
                setAsyncOnClick(item.setTitle(strings.shortcuts.add).setIcon('lucide-bookmark'), async () => {
                    await addTagShortcut(tagPath);
                });
            }
        });
    }

    const tagSeparatorTarget = { type: 'tag', path: tagPath } as const;
    const hasSeparator = metadataService.hasNavigationSeparator(tagSeparatorTarget);

    menu.addItem((item: MenuItem) => {
        const title = hasSeparator ? strings.contextMenu.navigation.removeSeparator : strings.contextMenu.navigation.addSeparator;
        setAsyncOnClick(item.setTitle(title).setIcon('lucide-separator-horizontal'), async () => {
            if (hasSeparator) {
                await metadataService.removeNavigationSeparator(tagSeparatorTarget);
                return;
            }
            await metadataService.addNavigationSeparator(tagSeparatorTarget);
        });
    });

    menu.addSeparator();

    // Change icon
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.tag.changeIcon).setIcon('lucide-image'), async () => {
            const { IconPickerModal } = await import('../../modals/IconPickerModal');
            const modal = new IconPickerModal(app, metadataService, tagPath, ItemType.TAG);
            modal.open();
        });
    });

    // Change color
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.tag.changeColor).setIcon('lucide-palette'), async () => {
            const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
            const modal = new ColorPickerModal(app, metadataService, tagPath, ItemType.TAG, 'foreground');
            modal.open();
        });
    });

    // Change background color
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.tag.changeBackground).setIcon('lucide-paint-bucket'), async () => {
            const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
            const modal = new ColorPickerModal(app, metadataService, tagPath, ItemType.TAG, 'background');
            modal.open();
        });
    });

    const tagIcon = metadataService.getTagIcon(tagPath);
    const tagColor = metadataService.getTagColor(tagPath);
    const tagBackgroundColor = metadataService.getTagBackgroundColor(tagPath);

    const hasRemovableIcon = Boolean(tagIcon);
    const hasRemovableColor = Boolean(tagColor);
    const hasRemovableBackground = Boolean(tagBackgroundColor);
    const removalCount = Number(hasRemovableIcon) + Number(hasRemovableColor) + Number(hasRemovableBackground);
    const showIndividualRemovers = removalCount >= 2;

    addStyleMenu({
        menu,
        styleData: {
            icon: tagIcon,
            color: tagColor,
            background: tagBackgroundColor
        },
        hasIcon: true,
        hasColor: true,
        hasBackground: true,
        showIndividualRemovers,
        applyStyle: async clipboard => {
            const { icon, color, background } = clipboard;
            const actions: Promise<void>[] = [];

            if (icon) {
                actions.push(metadataService.setTagIcon(tagPath, icon));
            }
            if (color) {
                actions.push(metadataService.setTagColor(tagPath, color));
            }
            if (background) {
                actions.push(metadataService.setTagBackgroundColor(tagPath, background));
            }

            await Promise.all(actions);
        },
        removeIcon: hasRemovableIcon ? async () => metadataService.removeTagIcon(tagPath) : undefined,
        removeColor: hasRemovableColor ? async () => metadataService.removeTagColor(tagPath) : undefined,
        removeBackground: hasRemovableBackground ? async () => metadataService.removeTagBackgroundColor(tagPath) : undefined
    });

    const canHideTag = tagPath !== UNTAGGED_TAG_ID;
    if (canHideTag || !isVirtualTag) {
        menu.addSeparator();

        if (canHideTag) {
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
                    setAsyncOnClick(item.setTitle(strings.contextMenu.tag.hideTag).setIcon('lucide-eye-off'), async () => {
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
                    setAsyncOnClick(item.setTitle(strings.contextMenu.tag.showTag).setIcon('lucide-eye'), async () => {
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

        if (!isVirtualTag) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.modals.tagOperation.confirmRename).setIcon('lucide-pencil'), async () => {
                    await services.tagOperations.promptRenameTag(tagPath);
                });
            });

            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.modals.tagOperation.confirmDelete).setIcon('lucide-trash-2'), async () => {
                    await services.tagOperations.promptDeleteTag(tagPath);
                });
            });
        }
    }
}
