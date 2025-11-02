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

// ============================================================================
// Type Definitions
// ============================================================================

export interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface ColorParsingOptions {
    container?: HTMLElement | null;
}

// ============================================================================
// CSS Variable Resolution
// ============================================================================
// CSS variables (e.g., var(--my-color)) cannot be parsed directly. We need
// to apply them to a DOM element and read the computed style to get the
// actual RGB value. This section manages a hidden resolver element per container.

const resolverElementMap = new WeakMap<HTMLElement, HTMLElement>();
/** CSS variable name used in the hidden resolver element for color computation. */
const COLOR_VARIABLE_NAME = '--nn-color-resolver-value';

/**
 * Creates or retrieves a hidden DOM element used to resolve CSS variable colors via computed styles.
 * The resolver element is styled via CSS (.nn-color-resolver) to be invisible and non-interactive.
 * Uses WeakMap to associate one resolver per container and automatically clean up when container is removed.
 */
function ensureResolverElement(container: HTMLElement): HTMLElement {
    // Reuse existing resolver if it's still in the DOM
    const existing = resolverElementMap.get(container);
    if (existing && existing.isConnected) {
        return existing;
    }

    // Create new hidden resolver element
    const doc = container.ownerDocument;
    const resolver = doc.createElement('div');
    resolver.classList.add('nn-color-resolver');
    resolver.setAttribute('aria-hidden', 'true');
    container.appendChild(resolver);

    // Cache for future use
    resolverElementMap.set(container, resolver);
    return resolver;
}

/**
 * Resolves a CSS color value by setting it on a hidden element and reading the computed style.
 * This is necessary to resolve CSS variables (e.g., var(--my-color)) to actual RGB values.
 *
 * How it works:
 * 1. Apply the color value to a custom CSS variable on the resolver element
 * 2. Read the computed style which has resolved all variables and functions
 * 3. Return the resolved color (tries 'color' property first, then 'backgroundColor')
 *
 * Example:
 *   Input: "var(--nn-theme-navitem-selected-bg)"
 *   Output: "rgba(100, 150, 200, 0.2)"
 */
function resolveColorValue(input: string, container?: HTMLElement | null): string {
    // Without a container, we can't resolve CSS variables
    if (!container) {
        return input;
    }

    // Get or create the hidden resolver element
    const resolver = ensureResolverElement(container);

    // Clear any previous value and set the new color value
    resolver.style.removeProperty(COLOR_VARIABLE_NAME);
    resolver.style.setProperty(COLOR_VARIABLE_NAME, input);

    // Read the computed style - this is where CSS variables get resolved
    const computed = window.getComputedStyle(resolver);

    // The CSS applies the variable to both 'color' and 'background-color'
    // Try 'color' first as it's more reliable for color values
    const computedColor = computed.color;
    if (computedColor) {
        return computedColor;
    }

    // Fallback to background-color
    const computedBackground = computed.backgroundColor;
    if (computedBackground) {
        return computedBackground;
    }

    // If both fail, return original input
    return input;
}

/**
 * Removes the color resolver element from the container and cleans up the WeakMap entry.
 * Called during component cleanup to prevent memory leaks.
 */
export function releaseColorResolver(container: HTMLElement): void {
    const resolver = resolverElementMap.get(container);
    if (!resolver) {
        return;
    }
    resolverElementMap.delete(container);
    if (resolver.parentElement) {
        resolver.parentElement.removeChild(resolver);
    }
}

// ============================================================================
// Value Clamping and Validation
// ============================================================================
// Ensures all color values are within valid ranges to prevent rendering issues

/** Clamps a color channel value to the valid range [0, 255]. */
function clampChannel(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
        return 0;
    }
    if (value <= 0) {
        return 0;
    }
    if (value >= 255) {
        return 255;
    }
    return value;
}

/** Clamps an alpha value to the valid range [0, 1]. */
function clampAlpha(value: number): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
        return 1;
    }
    if (value <= 0) {
        return 0;
    }
    if (value >= 1) {
        return 1;
    }
    return value;
}

// ============================================================================
// Color Component Parsing
// ============================================================================
// Converts various color component formats (hex, percentage, decimal) to numeric values

/** Parses a hexadecimal color component string into a numeric channel value. */
function parseHexComponent(component: string): number {
    return clampChannel(parseInt(component, 16));
}

/**
 * Parses a percentage color channel value (e.g., "50%") into a 0-255 range.
 * Example: "50%" → 127.5 → 127 (after clamping)
 */
function parsePercentageChannel(value: string): number {
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
        return 0;
    }
    return clampChannel((numeric / 100) * 255);
}

/**
 * Parses a decimal color channel value into a clamped 0-255 range.
 * Example: "200" → 200, "300" → 255 (clamped)
 */
function parseDecimalChannel(value: string): number {
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
        return 0;
    }
    return clampChannel(numeric);
}

/**
 * Parses an alpha component from a CSS color string, supporting both decimal and percentage values.
 * Examples:
 *   "0.5" → 0.5
 *   "50%" → 0.5
 *   undefined → 1 (fully opaque)
 */
function parseAlphaComponent(value: string | undefined): number {
    if (!value) {
        return 1;
    }
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
        const numeric = parseFloat(trimmed.slice(0, -1));
        if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
            return 1;
        }
        return clampAlpha(numeric / 100);
    }
    const numeric = parseFloat(trimmed);
    return clampAlpha(numeric);
}

// ============================================================================
// CSS Color String Parsing
// ============================================================================

/**
 * Parses a CSS color string into an RGBA object. Supports hex and rgb/rgba formats.
 *
 * Supported formats:
 * - Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
 * - RGB: rgb(r, g, b), rgba(r, g, b, a)
 * - Modern: rgb(r g b / a)
 * - CSS variables: var(--my-color) when container is provided
 *
 * @param input - The CSS color string to parse
 * @param options - Optional container for resolving CSS variables
 * @returns RGBA object with values r/g/b (0-255) and a (0-1), or null if parsing fails
 */
export function parseCssColor(input: string | null | undefined, options?: ColorParsingOptions): RGBA | null {
    if (!input) {
        return null;
    }
    const trimmedInput = input.trim();
    if (!trimmedInput) {
        return null;
    }

    // Step 1: Resolve CSS variables if a container is provided
    // This converts "var(--my-color)" to "rgba(100, 150, 200, 0.2)"
    const resolvedInput = options?.container ? resolveColorValue(trimmedInput, options.container) : trimmedInput;

    // Step 2: Try parsing as hex color (#rgb, #rrggbb, etc.)
    const hexMatch = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(resolvedInput);
    if (hexMatch) {
        const hexValue = hexMatch[1];

        // #rgb → #rrggbb (3-digit shorthand)
        if (hexValue.length === 3) {
            const r = hexValue[0];
            const g = hexValue[1];
            const b = hexValue[2];
            return {
                r: parseHexComponent(r + r), // "f" → "ff" → 255
                g: parseHexComponent(g + g),
                b: parseHexComponent(b + b),
                a: 1
            };
        }

        // #rgba → #rrggbbaa (4-digit shorthand with alpha)
        if (hexValue.length === 4) {
            const r = hexValue[0];
            const g = hexValue[1];
            const b = hexValue[2];
            const a = hexValue[3];
            return {
                r: parseHexComponent(r + r),
                g: parseHexComponent(g + g),
                b: parseHexComponent(b + b),
                a: clampAlpha(parseInt(a + a, 16) / 255) // hex to 0-1 range
            };
        }

        // #rrggbb (6-digit full hex)
        if (hexValue.length === 6) {
            return {
                r: parseHexComponent(hexValue.slice(0, 2)),
                g: parseHexComponent(hexValue.slice(2, 4)),
                b: parseHexComponent(hexValue.slice(4, 6)),
                a: 1
            };
        }

        // #rrggbbaa (8-digit with alpha)
        if (hexValue.length === 8) {
            return {
                r: parseHexComponent(hexValue.slice(0, 2)),
                g: parseHexComponent(hexValue.slice(2, 4)),
                b: parseHexComponent(hexValue.slice(4, 6)),
                a: clampAlpha(parseInt(hexValue.slice(6, 8), 16) / 255)
            };
        }
    }

    // Step 3: Try parsing as rgb/rgba function
    // Supports both legacy (comma) and modern (space/slash) syntax:
    // - rgb(255, 0, 0), rgba(255, 0, 0, 0.5)
    // - rgb(255 0 0), rgb(255 0 0 / 0.5)
    const rgbaMatch =
        /^rgba?\(\s*([^\s,]+)\s*,\s*([^\s,]+)\s*,\s*([^\s,]+)(?:\s*,\s*([^\s,]+))?\s*\)$/i.exec(resolvedInput) ||
        /^rgba?\(\s*([^\s,]+)\s+([^\s,]+)\s+([^\s,]+)(?:\s*\/\s*([^\s,]+))?\s*\)$/i.exec(resolvedInput);
    if (rgbaMatch) {
        const [, rRaw, gRaw, bRaw, aRaw] = rgbaMatch;

        // Helper to parse channel values (supports both decimal and percentage)
        const parseChannel = (value: string): number => {
            const channel = value.trim();
            if (channel.endsWith('%')) {
                return parsePercentageChannel(channel.slice(0, -1));
            }
            return parseDecimalChannel(channel);
        };

        return {
            r: parseChannel(rRaw),
            g: parseChannel(gRaw),
            b: parseChannel(bRaw),
            a: parseAlphaComponent(aRaw)
        };
    }

    // Step 4: Parsing failed - return null
    return null;
}

// ============================================================================
// Color Formatting and Comparison
// ============================================================================

/**
 * Formats an RGBA object into an rgb() string without alpha.
 * Always returns a solid (opaque) color string suitable for CSS.
 * Example: {r: 100, g: 150, b: 200, a: 0.5} → "rgb(100, 150, 200)"
 */
function formatRgb(color: RGBA): string {
    const r = Math.round(clampChannel(color.r));
    const g = Math.round(clampChannel(color.g));
    const b = Math.round(clampChannel(color.b));
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Returns true if two RGBA colors are component-wise equal within a small epsilon.
 * Uses epsilon tolerance to account for floating-point precision and rounding.
 *
 * @param left - First color to compare
 * @param right - Second color to compare
 * @param epsilon - Tolerance for RGB channels (default 0.5 out of 255)
 * @returns true if colors are equal within tolerance
 */
export function colorsEqual(left: RGBA | null, right: RGBA | null, epsilon = 0.5): boolean {
    if (!left && !right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return (
        Math.abs(left.r - right.r) <= epsilon &&
        Math.abs(left.g - right.g) <= epsilon &&
        Math.abs(left.b - right.b) <= epsilon &&
        Math.abs(left.a - right.a) <= 0.01 // Tighter tolerance for alpha
    );
}

// ============================================================================
// Alpha Compositing (Blending)
// ============================================================================
// Implements standard alpha compositing to blend semi-transparent colors
// onto opaque backgrounds, producing solid colors that appear identical
// to the transparent overlay when viewed on the base color.

/**
 * Composites an overlay color onto an opaque base color, returning the resulting RGBA.
 * Uses the standard alpha compositing formula: result = overlay * alpha + base * (1 - alpha)
 *
 * Example:
 *   Base: rgb(30, 30, 30) - dark pane background
 *   Overlay: rgba(100, 150, 200, 0.3) - 30% transparent blue
 *   Result: rgb(51, 66, 81) - solid color that looks like the overlay on that background
 *
 * @param base - The opaque base color (typically the pane background)
 * @param overlay - The overlay color (may be transparent)
 * @returns Solid RGBA with alpha = 1
 */
function compositeOntoBase(base: RGBA, overlay: RGBA): RGBA {
    const overlayAlpha = clampAlpha(overlay.a);

    // Optimization: If overlay is fully opaque, just return it
    if (overlayAlpha >= 1) {
        return {
            r: clampChannel(overlay.r),
            g: clampChannel(overlay.g),
            b: clampChannel(overlay.b),
            a: 1
        };
    }

    // Optimization: If overlay is fully transparent, return base
    if (overlayAlpha <= 0) {
        return {
            r: clampChannel(base.r),
            g: clampChannel(base.g),
            b: clampChannel(base.b),
            a: 1
        };
    }

    // Standard alpha compositing formula
    // Each channel: result = (overlay * alpha) + (base * (1 - alpha))
    const inverse = 1 - overlayAlpha;
    return {
        r: clampChannel(overlay.r * overlayAlpha + base.r * inverse),
        g: clampChannel(overlay.g * overlayAlpha + base.g * inverse),
        b: clampChannel(overlay.b * overlayAlpha + base.b * inverse),
        a: 1 // Result is always fully opaque
    };
}

/**
 * Composites the given overlay color string onto the provided base color.
 * This is the main entry point for converting semi-transparent theme colors
 * into solid colors that prevent hairline artifacts.
 *
 * Process:
 * 1. Parse overlay color string to RGBA
 * 2. Check if base is opaque enough (alpha >= 0.99)
 * 3. Blend overlay onto base using alpha compositing
 * 4. Return solid rgb() string
 *
 * @param base - The base color (usually pane background) as RGBA object
 * @param overlayColor - The overlay color (usually theme color) as CSS string
 * @param options - Optional container for resolving CSS variables
 * @returns Solid rgb() string, or undefined if overlay is null/empty
 *
 * Examples:
 *   base: {r: 30, g: 30, b: 30, a: 1}
 *   overlayColor: "rgba(100, 150, 200, 0.2)"
 *   → "rgb(44, 54, 64)"
 *
 *   overlayColor: "var(--nn-theme-navitem-selected-bg)"
 *   → Resolves variable, then composites
 *   → "rgb(51, 66, 81)"
 */
export function compositeWithBase(
    base: RGBA | null,
    overlayColor: string | null | undefined,
    options?: ColorParsingOptions
): string | undefined {
    // Threshold for considering a color "opaque enough" for compositing
    // Set to 0.99 to account for floating-point precision
    const OPAQUE_THRESHOLD = 0.99;

    // Early return if no overlay color provided
    if (!overlayColor) {
        return undefined;
    }
    const trimmedOverlay = overlayColor.trim();
    if (!trimmedOverlay) {
        return undefined;
    }

    // Step 1: Parse the overlay color string (resolves CSS variables if container provided)
    const overlay = parseCssColor(trimmedOverlay, options);
    if (!overlay) {
        // Parsing failed, return original string as fallback
        return trimmedOverlay;
    }

    // Step 2: Check if base is opaque enough for compositing
    // If base is transparent, we can't composite accurately (would affect transparency)
    const effectiveBase = base && base.a >= OPAQUE_THRESHOLD ? base : null;

    // Step 3: Handle case where we don't have a valid opaque base
    if (!effectiveBase) {
        // If overlay is already opaque, format it
        // Otherwise return original string to preserve transparency
        return overlay.a >= 1 ? formatRgb(overlay) : trimmedOverlay;
    }

    // Step 4: Perform alpha compositing and return solid color
    const blended = compositeOntoBase(effectiveBase, overlay);
    return formatRgb(blended);
}
