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

/**
 * Android WebView textZoom Detection and Compensation
 * ====================================================
 *
 * PROBLEM:
 * Android WebView scales text based on system font size settings via the textZoom
 * property. This scaling happens at the rendering level AFTER CSS is parsed but
 * BEFORE layout, so CSS `text-size-adjust: none` has no effect. Users with large
 * system fonts would see oversized text that breaks the carefully designed UI.
 *
 * WHAT ANDROID TEXTZOOM SCALES:
 * - font-size: YES (scaled proportionally)
 * - line-height: YES (when specified in px or em)
 * - width/height/min-height: NO (not scaled)
 * - SVG dimensions: NO (not scaled)
 * - padding/margin: NO (not scaled)
 *
 * COMPENSATION STRATEGY:
 * Since we can't disable textZoom, we pre-divide values by the scale factor so that
 * when Android applies its scaling, the final rendered size is correct.
 *
 * Example with scale factor 1.8:
 * - We want 14px font-size
 * - We set CSS to: 14px / 1.8 = 7.78px
 * - Android scales: 7.78px × 1.8 = 14px ✓
 *
 * DETECTION METHOD:
 * We create a probe element with a known font-size (16px), measure the computed
 * style, and calculate the ratio. This must happen BEFORE React renders so the
 * virtualizer gets correct measurements for row heights.
 *
 * WHAT WE COMPENSATE:
 *
 * 1. Font-size variables (via JavaScript inline styles):
 *    - --nn-file-name-size, --nn-file-small-size, etc.
 *    - Set on outer container, cascades to all descendants
 *
 * 2. Line-height variables (via CSS calc):
 *    - --nn-file-title-line-height, --nn-file-multiline-text-line-height, etc.
 *    - Must be done in CSS because .nn-mobile class redefines these on inner element
 *    - Uses: calc(21px * var(--nn-android-font-scale-reciprocal, 1))
 *
 * 3. Container heights (via CSS calc):
 *    - height/min-height for .nn-file-name and .nn-file-preview
 *    - These use line-height vars which are pre-compensated, so we multiply by
 *      scale to get the original value (which Android won't scale)
 *    - Uses: calc(var(--line-height) * rows * var(--nn-android-font-scale, 1))
 *
 * 4. Text elements with hardcoded sizes (via CSS):
 *    - .nn-navitem-count (note counts)
 *    - .nn-root-reorder-hint (reorder panel text)
 *
 * 5. Emoji and webfont icons (via CSS):
 *    - .nn-emoji-icon and .nn-iconfont classes
 *    - These use font-size which Android scales
 *    - Lucide SVG icons are NOT compensated (they use width/height)
 *
 * CSS VARIABLE ARCHITECTURE:
 * - --nn-android-font-scale: The detected scale factor (e.g., 1.8)
 * - --nn-android-font-scale-reciprocal: calc(1 / scale) for multiplication in CSS
 *   (some browsers handle calc(x * reciprocal) better than calc(x / var))
 *
 * FILES INVOLVED:
 * - src/utils/androidFontScale.ts: Detection and font-size variable compensation
 * - src/view/NotebookNavigatorView.tsx: Calls applyAndroidFontCompensation before React
 * - styles.css: "Android textZoom Compensation" section for CSS-based compensation
 */

/** Expected probe font size in pixels */
const EXPECTED_FONT_SIZE = 16;

/** Tolerance for detecting scaling (2% threshold) */
const SCALE_DETECTION_TOLERANCE = 0.02;

/** Font size variables and their default values in pixels */
const FONT_SIZE_VARIABLES: Record<string, number> = {
    '--nn-file-name-size': 14,
    '--nn-file-small-size': 13,
    '--nn-compact-font-size': 13,
    '--nn-compact-font-size-mobile': 15,
    '--nn-list-title-font-size': 16,
    '--nn-desktop-header-font-size': 13,
    '--nn-mobile-header-font-size': 17
};

/**
 * Line height variables are compensated in CSS rather than JavaScript because
 * the .nn-mobile class (on an inner React element) redefines these variables
 * and would override any inline styles set on the outer container.
 * See styles.css "Android textZoom Compensation" section.
 */

/**
 * Detects the Android textZoom scale factor by measuring a probe element.
 * Returns the scale factor (e.g., 1.3 means system is scaling fonts by 130%).
 */
function detectAndroidFontScale(container: HTMLElement): number {
    const probe = document.createElement('div');
    probe.style.cssText = `
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        font-size: ${EXPECTED_FONT_SIZE}px;
        line-height: 1;
        width: auto;
        height: auto;
        white-space: nowrap;
    `;
    probe.textContent = 'M';

    container.appendChild(probe);
    const computedStyle = getComputedStyle(probe);
    const actual = parseFloat(computedStyle.fontSize);
    const lineHeight = computedStyle.lineHeight;
    container.removeChild(probe);

    console.log(`[AndroidFontScale] Probe measurement: expected=${EXPECTED_FONT_SIZE}px, actual=${actual}px, lineHeight=${lineHeight}`);

    if (actual <= 0 || !Number.isFinite(actual)) {
        console.log('[AndroidFontScale] Invalid measurement, returning scale=1');
        return 1;
    }

    // Return the scale factor (actual / expected)
    // e.g., if expected 16px renders as 20.8px, scale = 1.3
    const scaleFactor = actual / EXPECTED_FONT_SIZE;
    console.log(`[AndroidFontScale] Detected scale factor: ${scaleFactor}`);
    return scaleFactor;
}

/**
 * Detects Android textZoom and applies compensated font-size CSS variables.
 * Must be called BEFORE React renders to ensure the virtualizer gets correct measurements.
 *
 * @param container - The container element to detect on and apply the variables to
 */
export function applyAndroidFontCompensation(container: HTMLElement): void {
    console.log('[AndroidFontScale] applyAndroidFontCompensation called');
    const scaleFactor = detectAndroidFontScale(container);

    // Only apply if scaling detected (beyond tolerance threshold)
    if (Math.abs(scaleFactor - 1) <= SCALE_DETECTION_TOLERANCE) {
        console.log(`[AndroidFontScale] Scale factor ${scaleFactor} within tolerance, skipping compensation`);
        return;
    }

    // Store the scale factor for use by dynamic font size calculations
    container.style.setProperty('--nn-android-font-scale', String(scaleFactor));

    // Override font-size variables with compensated values
    // If system scales by 1.8x, we set 14px / 1.8 = 7.78px so it renders as 14px
    for (const [variable, defaultSize] of Object.entries(FONT_SIZE_VARIABLES)) {
        const compensatedSize = defaultSize / scaleFactor;
        container.style.setProperty(variable, `${compensatedSize}px`);
        console.log(`[AndroidFontScale] ${variable}: ${defaultSize}px → ${compensatedSize.toFixed(2)}px`);
    }

    // Line-height variables are compensated in CSS using calc() with --nn-android-font-scale
    // This is necessary because .nn-mobile redefines these variables on an inner element

    console.log(`[AndroidFontScale] Compensation applied. Scale factor: ${scaleFactor}`);
}

/**
 * Gets the detected Android font scale factor from a container element.
 * Returns 1 if no scaling was detected or not on Android.
 */
export function getAndroidFontScale(container: Element | null): number {
    if (!(container instanceof HTMLElement)) {
        return 1;
    }
    const value = container.style.getPropertyValue('--nn-android-font-scale');
    if (!value) {
        return 1;
    }
    const scale = parseFloat(value);
    return Number.isFinite(scale) ? scale : 1;
}
