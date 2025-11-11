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

import { Menu } from 'obsidian';
import type { DragHandleConfig } from '../components/NavigationListRow';
import { runAsyncAction } from './async';

export interface ShowReorderMenuOptions {
    anchor: HTMLElement;
    mouseEvent?: MouseEvent;
    allowMoveUp: boolean;
    allowMoveDown: boolean;
    moveUpLabel: string;
    moveDownLabel: string;
    onMoveUp: () => void;
    onMoveDown: () => void;
    moveUpIcon?: string;
    moveDownIcon?: string;
}

const DEFAULT_MOVE_UP_ICON = 'lucide-arrow-up';
const DEFAULT_MOVE_DOWN_ICON = 'lucide-arrow-down';

interface MenuHandleConfigOptions {
    label: string;
    icon?: string;
    events: NonNullable<DragHandleConfig['events']>;
}

/**
 * Builds a temporary Obsidian menu for moving list items up or down.
 * Returns false when no move options are available.
 */
export function showReorderMenu(options: ShowReorderMenuOptions): boolean {
    const {
        anchor,
        mouseEvent,
        allowMoveUp,
        allowMoveDown,
        moveUpLabel,
        moveDownLabel,
        onMoveUp,
        onMoveDown,
        moveUpIcon = DEFAULT_MOVE_UP_ICON,
        moveDownIcon = DEFAULT_MOVE_DOWN_ICON
    } = options;

    // No menu needed if no move options are available
    if (!allowMoveUp && !allowMoveDown) {
        return false;
    }

    // Build menu with available move options
    const menu = new Menu();
    if (allowMoveUp) {
        menu.addItem(item => {
            item.setTitle(moveUpLabel)
                .setIcon(moveUpIcon)
                .onClick(() => {
                    // Execute move action through runAsyncAction for error handling
                    runAsyncAction(() => {
                        onMoveUp();
                    });
                });
        });
    }
    if (allowMoveDown) {
        menu.addItem(item => {
            item.setTitle(moveDownLabel)
                .setIcon(moveDownIcon)
                .onClick(() => {
                    // Execute move action through runAsyncAction for error handling
                    runAsyncAction(() => {
                        onMoveDown();
                    });
                });
        });
    }

    // Show menu at mouse position or centered below anchor element
    if (mouseEvent) {
        menu.showAtMouseEvent(mouseEvent);
    } else {
        const rect = anchor.getBoundingClientRect();
        menu.showAtPosition({
            x: rect.left + rect.width / 2,
            y: rect.bottom + 4
        });
    }

    return true;
}

/**
 * Creates a standardized drag handle configuration for menu-based reordering controls.
 */
export function createMenuReorderHandleConfig(options: MenuHandleConfigOptions): DragHandleConfig {
    const { label, icon = 'lucide-grip-horizontal', events } = options;
    return {
        label,
        visible: true,
        only: true,
        interactive: true,
        icon,
        events
    };
}
