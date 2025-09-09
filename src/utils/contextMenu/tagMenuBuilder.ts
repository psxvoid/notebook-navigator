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
import { findMatchingPrefixes, cleanupTagPatterns } from '../tagPrefixMatcher';
import { UNTAGGED_TAG_ID } from '../../types';

/**
 * Builds the context menu for a tag
 */
export function buildTagMenu(params: TagMenuBuilderParams): void {
    const { tagPath, menu, services, settings, context } = params;
    const { app, metadataService, plugin, isMobile } = services;

    // Show tag name on mobile
    if (isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(`#${tagPath}`).setIsLabel(true);
        });
    }

    // Don't show favorites options for the Untagged virtual tag
    if (tagPath !== UNTAGGED_TAG_ID) {
        if (context === 'favorites') {
            // In favorites section - always show "Remove from favorites"
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.tag.removeFromFavorites)
                    .setIcon('lucide-star-off')
                    .onClick(async () => {
                        // Find all patterns that match this tag
                        const matchingPatterns = findMatchingPrefixes(tagPath, settings.favoriteTags);

                        // Remove all matching patterns from favorites
                        plugin.settings.favoriteTags = settings.favoriteTags.filter(pattern => !matchingPatterns.includes(pattern));

                        await plugin.saveSettingsAndUpdate();
                    });
            });
        } else {
            // In tags section - check for exact match in favorites array
            const isExactFavorite = settings.favoriteTags.includes(tagPath);

            if (!isExactFavorite) {
                // Tag is not a favorite - show "Add to favorites"
                menu.addItem((item: MenuItem) => {
                    item.setTitle(strings.contextMenu.tag.addToFavorites)
                        .setIcon('lucide-star')
                        .onClick(async () => {
                            // Clean up redundant entries when adding new favorite
                            const cleanedFavorites = cleanupTagPatterns(settings.favoriteTags, tagPath);

                            plugin.settings.favoriteTags = cleanedFavorites;
                            await plugin.saveSettingsAndUpdate();
                        });
                });
            } else {
                // Tag is already a favorite - show "Remove from favorites"
                menu.addItem((item: MenuItem) => {
                    item.setTitle(strings.contextMenu.tag.removeFromFavorites)
                        .setIcon('lucide-star-off')
                        .onClick(async () => {
                            // Find all patterns that match this tag
                            const matchingPatterns = findMatchingPrefixes(tagPath, settings.favoriteTags);

                            // Remove all matching patterns from favorites
                            plugin.settings.favoriteTags = settings.favoriteTags.filter(pattern => !matchingPatterns.includes(pattern));

                            await plugin.saveSettingsAndUpdate();
                        });
                });
            }
        }

        menu.addSeparator();
    }

    // Change icon
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.tag.changeIcon)
            .setIcon('lucide-image')
            .onClick(async () => {
                const { IconPickerModal } = await import('../../modals/IconPickerModal');
                const { ItemType } = await import('../../types');
                const modal = new IconPickerModal(app, metadataService, tagPath, ItemType.TAG);
                modal.open();
            });
    });

    // Remove icon (only show if custom icon is set)
    const currentIcon = metadataService.getTagIcon(tagPath);
    if (currentIcon) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.tag.removeIcon)
                .setIcon('lucide-x')
                .onClick(async () => {
                    await metadataService.removeTagIcon(tagPath);
                });
        });
    }

    // Change color
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.tag.changeColor)
            .setIcon('lucide-palette')
            .onClick(async () => {
                const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                const modal = new ColorPickerModal(app, metadataService, tagPath, 'tag');
                modal.open();
            });
    });

    // Remove color (only show if custom color is set directly on this tag)
    const hasDirectColor = settings.tagColors && settings.tagColors[tagPath];
    if (hasDirectColor) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.tag.removeColor)
                .setIcon('lucide-x')
                .onClick(async () => {
                    await metadataService.removeTagColor(tagPath);
                });
        });
    }

    // Don't show hide tag option for the Untagged virtual tag
    if (tagPath !== UNTAGGED_TAG_ID) {
        menu.addSeparator();

        // Hide tag option
        const isHidden = settings.hiddenTags.includes(tagPath);

        if (!isHidden) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.tag.hideTag)
                    .setIcon('lucide-eye-off')
                    .onClick(async () => {
                        // Clean up redundant entries when adding new hidden tag
                        const cleanedHiddenTags = cleanupTagPatterns(settings.hiddenTags, tagPath);

                        plugin.settings.hiddenTags = cleanedHiddenTags;
                        await plugin.saveSettingsAndUpdate();
                    });
            });
        }
    }
}
