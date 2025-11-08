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

import { LISTPANE_MEASUREMENTS } from '../types';

export interface SlimListMetrics {
    fontSize: number;
    mobileFontSize: number;
    desktopPadding: number;
    desktopPaddingTotal: number;
    mobilePadding: number;
    mobilePaddingTotal: number;
}

interface SlimListMetricsInput {
    slimItemHeight: number;
    scaleText: boolean;
}

/**
 * Calculates slim list typography and spacing based on height settings.
 * Keeps CSS custom properties and virtualization estimates in sync.
 */
export function calculateSlimListMetrics({ slimItemHeight, scaleText }: SlimListMetricsInput): SlimListMetrics {
    const {
        titleLineHeight,
        defaultSlimItemHeight,
        defaultSlimFontSize,
        mobileHeightIncrement,
        mobileFontSizeIncrement,
        minSlimPaddingVerticalMobile
    } = LISTPANE_MEASUREMENTS;

    // Calculate desktop padding to center title line within item height
    const desktopPadding = Math.max((slimItemHeight - titleLineHeight) / 2, 0);
    const desktopPaddingTotal = Math.max(slimItemHeight - titleLineHeight, 0);

    // Reduce font size for shorter items when text scaling is enabled
    let fontSize = defaultSlimFontSize;
    if (scaleText) {
        if (slimItemHeight <= defaultSlimItemHeight - 6) {
            fontSize = defaultSlimFontSize - 2;
        } else if (slimItemHeight <= defaultSlimItemHeight - 4) {
            fontSize = defaultSlimFontSize - 1;
        }
    }

    // Mobile height uses same scaling logic as navigation items with fixed increment
    const mobileItemHeight = slimItemHeight + mobileHeightIncrement;

    // Calculate mobile padding using mobile-adjusted item height
    const mobilePaddingRaw = Math.max((mobileItemHeight - titleLineHeight) / 2, 0);
    const mobilePadding = Math.max(minSlimPaddingVerticalMobile, mobilePaddingRaw);
    const mobilePaddingTotal = mobilePadding * 2;

    // Apply same font scaling delta as navigation items
    const mobileFontSize = fontSize + mobileFontSizeIncrement;

    return {
        fontSize,
        mobileFontSize,
        desktopPadding,
        desktopPaddingTotal,
        mobilePadding,
        mobilePaddingTotal
    };
}
