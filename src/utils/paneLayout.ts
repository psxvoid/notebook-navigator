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

import type { BackgroundMode } from '../types';

/** Returns CSS classes for the configured background mode */
export function getBackgroundClasses(mode: BackgroundMode | null | undefined): string[] {
    if (mode === 'primary') {
        return ['nn-bg-primary'];
    }
    if (mode === 'secondary') {
        return ['nn-bg-secondary'];
    }
    return [];
}
