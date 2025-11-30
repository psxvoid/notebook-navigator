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

import { Menu, MenuItem } from 'obsidian';
import { strings } from '../../i18n';
import { setAsyncOnClick } from './menuAsyncHelpers';
import { copyStyleToClipboard, getStyleClipboard, hasStyleData, type StyleClipboardData } from './styleClipboard';

/** Extended MenuItem type with submenu support */
type MenuItemWithSubmenu = MenuItem & {
    setSubmenu: () => Menu;
};

/** Type guard for menu items that support submenus */
function menuItemHasSubmenu(item: MenuItem): item is MenuItemWithSubmenu {
    return typeof (item as MenuItemWithSubmenu).setSubmenu === 'function';
}

/** Checks if the current Obsidian version supports submenu creation */
function menuSupportsSubmenu(): boolean {
    return typeof (MenuItem.prototype as MenuItemWithSubmenu).setSubmenu === 'function';
}

/**
 * Configuration for the style submenu
 */
export interface StyleMenuConfig {
    menu: Menu;
    styleData: StyleClipboardData;
    hasIcon?: boolean;
    hasColor?: boolean;
    hasBackground?: boolean;
    showIndividualRemovers?: boolean;
    showClearAction?: boolean;
    applyStyle?: (data: StyleClipboardData) => Promise<void>;
    removeIcon?: () => Promise<void>;
    removeColor?: () => Promise<void>;
    removeBackground?: () => Promise<void>;
}

/**
 * Adds a Style submenu to a context menu with copy/paste and removal options
 */
export function addStyleMenu(config: StyleMenuConfig): void {
    if (!menuSupportsSubmenu()) {
        return;
    }

    const hasIconSupport = Boolean(config.hasIcon);
    const hasColorSupport = Boolean(config.hasColor);
    const hasBackgroundSupport = Boolean(config.hasBackground);

    const clipboard = getStyleClipboard();
    const clipboardData = clipboard?.data;

    const hasSupportedClipboardData = Boolean(
        (hasIconSupport && clipboardData?.icon) ||
            (hasColorSupport && clipboardData?.color) ||
            (hasBackgroundSupport && clipboardData?.background)
    );

    const hasRemovableIcon = Boolean(config.removeIcon && hasIconSupport);
    const hasRemovableColor = Boolean(config.removeColor && hasColorSupport);
    const hasRemovableBackground = Boolean(config.removeBackground && hasBackgroundSupport);
    const removalCount = Number(hasRemovableIcon) + Number(hasRemovableColor) + Number(hasRemovableBackground);
    const hasCopyableStyle = hasStyleData(config.styleData);
    const hasPasteableStyle = Boolean(config.applyStyle && hasSupportedClipboardData);
    const hasRemoveActions = removalCount > 0;
    const showIndividualRemovers = (config.showIndividualRemovers ?? true) && hasRemoveActions;
    const showClearAction = config.showClearAction ?? removalCount >= 2;

    if (!hasCopyableStyle && !hasPasteableStyle && !hasRemoveActions) {
        return;
    }

    config.menu.addItem((item: MenuItem) => {
        if (!menuItemHasSubmenu(item)) {
            return;
        }

        item.setTitle(strings.contextMenu.style.title).setIcon('lucide-brush');
        const styleSubmenu: Menu = item.setSubmenu();

        if (hasCopyableStyle) {
            styleSubmenu.addItem(subItem => {
                setAsyncOnClick(subItem.setTitle(strings.contextMenu.style.copy).setIcon('lucide-copy'), async () => {
                    copyStyleToClipboard(config.styleData);
                });
            });
        }

        if (hasPasteableStyle) {
            styleSubmenu.addItem(subItem => {
                setAsyncOnClick(subItem.setTitle(strings.contextMenu.style.paste).setIcon('lucide-clipboard-check'), async () => {
                    const clipboard = getStyleClipboard();
                    if (!clipboard || !hasStyleData(clipboard.data) || !config.applyStyle) {
                        return;
                    }

                    await config.applyStyle(clipboard.data);
                });
            });
        }

        if (showIndividualRemovers && hasRemovableIcon) {
            styleSubmenu.addItem(subItem => {
                setAsyncOnClick(subItem.setTitle(strings.contextMenu.style.removeIcon).setIcon('lucide-image-off'), async () => {
                    await config.removeIcon?.();
                });
            });
        }

        if (showIndividualRemovers && hasRemovableColor) {
            styleSubmenu.addItem(subItem => {
                setAsyncOnClick(subItem.setTitle(strings.contextMenu.style.removeColor).setIcon('lucide-palette'), async () => {
                    await config.removeColor?.();
                });
            });
        }

        if (showIndividualRemovers && hasRemovableBackground) {
            styleSubmenu.addItem(subItem => {
                setAsyncOnClick(subItem.setTitle(strings.contextMenu.style.removeBackground).setIcon('lucide-paint-bucket'), async () => {
                    await config.removeBackground?.();
                });
            });
        }

        if (showClearAction && hasRemoveActions) {
            styleSubmenu.addItem(subItem => {
                setAsyncOnClick(subItem.setTitle(strings.contextMenu.style.clear).setIcon('lucide-eraser'), async () => {
                    const actions: Promise<void>[] = [];

                    if (hasRemovableIcon && config.removeIcon) {
                        actions.push(config.removeIcon());
                    }
                    if (hasRemovableColor && config.removeColor) {
                        actions.push(config.removeColor());
                    }
                    if (hasRemovableBackground && config.removeBackground) {
                        actions.push(config.removeBackground());
                    }

                    await Promise.all(actions);
                });
            });
        }
    });
}
