import { TFile } from 'obsidian';
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

import { format, parse, Locale } from 'date-fns';
import * as locales from 'date-fns/locale';
import { strings, getCurrentLanguage } from '../i18n';
import { NotebookNavigatorSettings } from '../settings';

// Type the locales object properly
type LocalesMap = typeof locales & Record<string, Locale>;

export class DateUtils {
    /**
     * Map of Obsidian language codes to date-fns locale names
     * Only define the special cases where names differ
     *
     * Based on Obsidian's supported languages:
     * - 'en' = English
     * - 'en-gb' = English (GB)
     * - 'zh' = 简体中文 (Chinese Simplified)
     * - 'zh-tw' = 繁體中文 (Chinese Traditional)
     * - 'pt' = Português (Portuguese)
     * - 'pt-br' = Português do Brasil (Brazilian Portuguese)
     * - Other languages use their ISO code directly (de, es, fr, it, ja, ko, nl, no, pl, ru, tr, etc.)
     */
    private static localeExceptions: Record<string, string> = {
        en: 'enUS', // English defaults to US
        'en-gb': 'enGB', // English (GB)
        zh: 'zhCN', // Chinese defaults to Simplified
        'zh-tw': 'zhTW', // Chinese Traditional
        pt: 'pt', // Portuguese (Portugal)
        'pt-br': 'ptBR', // Portuguese (Brazil)
        no: 'nb' // Norwegian (Bokmål) - date-fns uses 'nb' for Norwegian
    };

    /**
     * Languages that use lowercase month names by default in date-fns
     * Based on testing, these languages format months in lowercase
     */
    private static lowercaseMonthLanguages = new Set([
        'es',
        'fr',
        'no',
        'nb',
        'pt',
        'pt-br',
        'it',
        'nl',
        'sv',
        'da',
        'fi',
        'pl',
        'cs',
        'ca',
        'ro'
    ]);

    /**
     * Get the current Obsidian language setting
     * @returns Language code (e.g., 'en', 'de', 'sv')
     */
    private static getObsidianLanguage(): string {
        const currentLocale = getCurrentLanguage();
        return currentLocale || 'en';
    }

    /**
     * Get the appropriate date-fns locale for the current Obsidian language
     * @returns date-fns locale object
     */
    private static getDateFnsLocale(): Locale {
        const obsidianLang = DateUtils.getObsidianLanguage();

        // Check if this language has a different locale name in date-fns
        const localeName = DateUtils.localeExceptions[obsidianLang] || obsidianLang;

        // Safely access the locale from the imported locales object
        const localesMap = locales as LocalesMap;
        return localesMap[localeName] || locales.enUS;
    }

    /**
     * Format a timestamp into a human-readable date string
     * Uses date-fns with proper locale support
     * @param timestamp - Unix timestamp in milliseconds
     * @param dateFormat - Date format string (date-fns format)
     * @returns Formatted date string
     */
    static formatDate(timestamp: number, dateFormat: string): string {
        const date = new Date(timestamp);
        const locale = DateUtils.getDateFnsLocale();

        try {
            return format(date, dateFormat, { locale });
        } catch (e) {
            // If invalid format string, fall back to a default format
            try {
                return format(date, 'PPP', { locale }); // localized date format
            } catch (e2) {
                // Last resort fallback
                return date.toLocaleDateString();
            }
        }
    }

    /**
     * Capitalize the first letter of a string
     * @param str - String to capitalize
     * @returns Capitalized string
     */
    private static capitalizeFirst(str: string): string {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Get a date group label for grouping files by date
     * @param timestamp - Unix timestamp in milliseconds
     * @returns Date group label (e.g. "Today", "Yesterday", "Previous 7 Days", etc.)
     */
    static getDateGroup(timestamp: number): string {
        const now = new Date();
        const date = new Date(timestamp);

        // Reset times to start of day for comparison
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);

        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (dateOnly.getTime() === today.getTime()) {
            return strings.dateGroups.today;
        } else if (dateOnly.getTime() === yesterday.getTime()) {
            return strings.dateGroups.yesterday;
        } else if (dateOnly > weekAgo) {
            return strings.dateGroups.previous7Days;
        } else if (dateOnly > monthAgo) {
            return strings.dateGroups.previous30Days;
        } else if (date.getFullYear() === now.getFullYear()) {
            // Same year - show month name
            const locale = DateUtils.getDateFnsLocale();
            let monthName = format(date, 'MMMM', { locale });

            // Capitalize month name for languages that use lowercase
            const obsidianLang = DateUtils.getObsidianLanguage();
            if (DateUtils.lowercaseMonthLanguages.has(obsidianLang)) {
                monthName = DateUtils.capitalizeFirst(monthName);
            }

            return monthName;
        } else {
            // Previous years - show year
            return date.getFullYear().toString();
        }
    }

    /**
     * Format a date based on its group - Apple Notes style
     * @param timestamp - Unix timestamp in milliseconds
     * @param group - The date group this timestamp belongs to
     * @param dateFormat - Default date format string (date-fns format)
     * @param timeFormat - Time format string (date-fns format)
     * @returns Formatted date string appropriate for the group
     */
    static formatDateForGroup(timestamp: number, group: string, dateFormat: string, timeFormat: string): string {
        const date = new Date(timestamp);
        const locale = DateUtils.getDateFnsLocale();

        // Today and Yesterday groups - show time only
        if (group === strings.dateGroups.today || group === strings.dateGroups.yesterday) {
            return format(date, timeFormat, { locale });
        }

        // Previous 7 days - show weekday name
        if (group === strings.dateGroups.previous7Days) {
            return format(date, 'EEEE', { locale }); // Full weekday name
        }

        // All other groups - use default format
        return DateUtils.formatDate(timestamp, dateFormat);
    }

    /**
     * Get file timestamp
     * @param file - The file to get timestamp for
     * @param dateType - Whether to get created or modified timestamp
     * @param cachedData - Optional cached file data containing frontmatter timestamps
     * @param settings - Plugin settings to check if frontmatter is enabled
     * @returns Unix timestamp in milliseconds
     */
    static getFileTimestamp(
        file: TFile,
        dateType: 'created' | 'modified',
        cachedData?: { fc?: number; fm?: number },
        settings?: NotebookNavigatorSettings
    ): number {
        // If frontmatter metadata is enabled and we have cached timestamps, use them
        if (settings?.useFrontmatterMetadata && cachedData) {
            const timestamp = dateType === 'created' ? cachedData.fc : cachedData.fm;
            if (timestamp !== undefined) {
                return timestamp;
            }
        }

        // Fall back to file system timestamps
        return dateType === 'created' ? file.stat.ctime : file.stat.mtime;
    }

    /**
     * Parse a frontmatter date value into a timestamp
     * @param value - The frontmatter value to parse
     * @param dateFormat - The expected date format from settings
     * @returns Unix timestamp in milliseconds, or undefined if parsing fails
     */
    static parseFrontmatterDate(value: unknown, dateFormat: string): number | undefined {
        if (!value) return undefined;

        try {
            // If it's already a Date object
            if (value instanceof Date) {
                return value.getTime();
            }

            // If it's a number, assume it's already a timestamp
            if (typeof value === 'number') {
                // If it looks like seconds (less than year 3000 in milliseconds)
                if (value < 32503680000) {
                    return value * 1000;
                }
                return value;
            }

            // If it's a string, parse it
            if (typeof value === 'string') {
                // First try to parse as ISO 8601 (standard format)
                const isoDate = new Date(value);
                if (!isNaN(isoDate.getTime())) {
                    return isoDate.getTime();
                }

                // If ISO parsing failed, try with the configured format
                const parsedDate = parse(value, dateFormat, new Date());

                // Check if parsing succeeded
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.getTime();
                }
            }
        } catch (e) {
            // Parsing failed
        }

        return undefined;
    }
}
