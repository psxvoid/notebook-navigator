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

import { format } from 'date-fns';
import { strings } from '../i18n';

export class DateUtils {
    /**
     * Format a timestamp into a human-readable date string
     * @param timestamp - Unix timestamp in milliseconds
     * @param dateFormat - Date format string (date-fns format)
     * @returns Formatted date string
     */
    static formatDate(timestamp: number, dateFormat: string): string {
        const date = new Date(timestamp);
        try {
            return format(date, dateFormat);
        } catch (e) {
            // If invalid format string, fall back to default
            return format(date, 'MMM d, yyyy');
        }
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
            return format(date, 'MMMM');
        } else {
            // Previous years - show year
            return date.getFullYear().toString();
        }
    }
}