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
 * Central export point for internationalization
 * Dynamically loads the appropriate language based on Obsidian's language setting
 */
import { getLanguage } from 'obsidian';
import { STRINGS_AR } from './locales/ar';
import { STRINGS_DE } from './locales/de';
import { STRINGS_EN } from './locales/en';
import { STRINGS_ES } from './locales/es';
import { STRINGS_FA } from './locales/fa';
import { STRINGS_FR } from './locales/fr';
import { STRINGS_ID } from './locales/id';
import { STRINGS_IT } from './locales/it';
import { STRINGS_JA } from './locales/ja';
import { STRINGS_KO } from './locales/ko';
import { STRINGS_NL } from './locales/nl';
import { STRINGS_PL } from './locales/pl';
import { STRINGS_PT } from './locales/pt';
import { STRINGS_RU } from './locales/ru';
import { STRINGS_TH } from './locales/th';
import { STRINGS_TR } from './locales/tr';
import { STRINGS_UK } from './locales/uk';
import { STRINGS_VI } from './locales/vi';
import { STRINGS_ZH_CN } from './locales/zh_cn';
import { STRINGS_ZH_TW } from './locales/zh_tw';

// Type for the translation strings structure
type TranslationStrings = typeof STRINGS_EN;

// Map of supported languages to their translation modules
// Just add new languages here as they are created
//
// Obsidian-supported languages:
// ✅ ar     - Arabic
// ❌ am     - Amharic
// ❌ be     - Belarusian
// ❌ da     - Danish
// ✅ de     - German
// ✅ en     - English
// ❌ en-GB  - English (UK)
// ✅ es     - Spanish
// ✅ fa     - Persian (Farsi)
// ✅ fr     - French
// ✅ id     - Indonesian
// ✅ it     - Italian
// ✅ ja     - Japanese
// ✅ ko     - Korean
// ❌ lv     - Latvian
// ❌ ne     - Nepali
// ✅ nl     - Dutch
// ❌ no     - Norwegian
// ✅ pl     - Polish
// ✅ pt     - Portuguese
// ✅ pt-BR  - Portuguese (Brazil)
// ✅ ru     - Russian
// ❌ sq     - Albanian
// ✅ th     - Thai
// ✅ tr     - Turkish
// ✅ uk     - Ukrainian
// ✅ vi     - Vietnamese
// ✅ zh     - Chinese (Simplified)
// ✅ zh-TW  - Chinese (Traditional)
const LANGUAGE_MAP: Record<string, TranslationStrings> = {
    ar: STRINGS_AR,
    de: STRINGS_DE,
    en: STRINGS_EN,
    es: STRINGS_ES,
    fa: STRINGS_FA,
    fr: STRINGS_FR,
    id: STRINGS_ID,
    it: STRINGS_IT,
    ja: STRINGS_JA,
    ko: STRINGS_KO,
    nl: STRINGS_NL,
    pl: STRINGS_PL,
    pt: STRINGS_PT,
    ru: STRINGS_RU,
    th: STRINGS_TH,
    tr: STRINGS_TR,
    uk: STRINGS_UK,
    vi: STRINGS_VI,
    zh: STRINGS_ZH_CN,
    'zh-CN': STRINGS_ZH_CN,
    zh_cn: STRINGS_ZH_CN,
    'zh-TW': STRINGS_ZH_TW,
    zh_tw: STRINGS_ZH_TW
};

/**
 * Gets the current language setting from Obsidian
 */
export function getCurrentLanguage(): string {
    return getLanguage();
}

/**
 * Detects the current Obsidian language setting
 * Falls back to English if the language is not supported
 */
function getObsidianLanguage(): string {
    const locale = getCurrentLanguage();

    // Check if the detected language is supported
    if (locale && locale in LANGUAGE_MAP) {
        return locale;
    }

    // Fallback to English
    return 'en';
}

// Export the appropriate language strings based on Obsidian's setting
export const strings: TranslationStrings = LANGUAGE_MAP[getObsidianLanguage()];

/**
 * Get the default date format for the current language
 * Falls back to 'MMM d, yyyy' if not found
 */
export function getDefaultDateFormat(): string {
    const lang = getObsidianLanguage();
    const localeStrings = LANGUAGE_MAP[lang] || LANGUAGE_MAP.en;
    return localeStrings.settings.items.dateFormat.placeholder;
}

/**
 * Get the default time format for the current language
 * Falls back to 'h:mm a' if not found
 */
export function getDefaultTimeFormat(): string {
    const lang = getObsidianLanguage();
    const localeStrings = LANGUAGE_MAP[lang] || LANGUAGE_MAP.en;
    return localeStrings.settings.items.timeFormat.placeholder;
}
