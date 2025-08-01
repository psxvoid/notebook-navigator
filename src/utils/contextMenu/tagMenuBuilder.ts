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
import { findMatchingFavoritePatterns } from '../tagUtils';
import { UNTAGGED_TAG_ID } from '../../types';

/**
 * Builds the context menu for a tag
 */
export function buildTagMenu(params: TagMenuBuilderParams): void {
    const { tagPath, menu, services, settings } = params;
    const { app, metadataService, plugin } = services;

    // Don't show favorites options for the Untagged virtual tag
    if (tagPath !== UNTAGGED_TAG_ID) {
        // Check if this tag exists in the favoriteTree
        const isFavorite = services.findTagInFavoriteTree ? services.findTagInFavoriteTree(tagPath) !== null : false;

        if (!isFavorite) {
            // Tag is not a favorite - show "Add to favorites"
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.tag.addToFavorites)
                    .setIcon('star')
                    .onClick(async () => {
                        plugin.settings.favoriteTags = [...plugin.settings.favoriteTags, tagPath];
                        await plugin.saveSettings();
                    });
            });
        } else {
            // Tag is a favorite - show "Remove from favorites"
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.tag.removeFromFavorites)
                    .setIcon('star-off')
                    .onClick(async () => {
                        // Find all patterns that match this tag
                        const matchingPatterns = findMatchingFavoritePatterns(tagPath, settings.favoriteTags);

                        // Remove all matching patterns from favorites
                        plugin.settings.favoriteTags = settings.favoriteTags.filter(pattern => !matchingPatterns.includes(pattern));

                        await plugin.saveSettings();
                    });
            });
        }

        menu.addSeparator();
    }

    // Change icon
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.tag.changeIcon)
            .setIcon('palette')
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
                .setIcon('x')
                .onClick(async () => {
                    await metadataService.removeTagIcon(tagPath);
                });
        });
    }

    menu.addSeparator();

    // Change color
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.tag.changeColor)
            .setIcon('palette')
            .onClick(async () => {
                const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                const modal = new ColorPickerModal(app, metadataService, tagPath, 'tag');
                modal.open();
            });
    });

    // Remove color (only show if custom color is set)
    const currentColor = metadataService.getTagColor(tagPath);
    if (currentColor) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.tag.removeColor)
                .setIcon('x')
                .onClick(async () => {
                    await metadataService.removeTagColor(tagPath);
                });
        });
    }
}
