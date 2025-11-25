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
 * Rebuilds a record into a null-prototype object, optionally validating entries.
 * Prevents keys like "constructor" from resolving to Object.prototype.
 */
export function sanitizeRecord<T>(record: Record<string, T> | undefined, validate?: (value: unknown) => value is T): Record<string, T> {
    // Null prototype avoids pulling values from Object.prototype (e.g., "constructor" keys)
    const sanitized = Object.create(null) as Record<string, T>;
    if (!record) {
        return sanitized;
    }

    // Copy only own properties, optionally filtering by type validator
    for (const key of Object.keys(record)) {
        const value = (record as Record<string, unknown>)[key];
        if (validate && !validate(value)) {
            continue;
        }
        sanitized[key] = value as T;
    }

    return sanitized;
}

/**
 * Ensures a record uses a null prototype and only contains validated entries.
 * Reuses the existing object when already sanitized to avoid unnecessary copies.
 */
export function ensureRecord<T>(record: Record<string, T> | undefined, validate?: (value: unknown) => value is T): Record<string, T> {
    if (!record) {
        return Object.create(null) as Record<string, T>;
    }

    // Check if record already has null prototype to avoid unnecessary rebuild
    const hasNullPrototype = Object.getPrototypeOf(record) === null;
    if (!hasNullPrototype) {
        return sanitizeRecord(record, validate);
    }

    // Record is already safe, just validate and remove invalid entries in-place
    if (!validate) {
        return record;
    }

    Object.keys(record).forEach(key => {
        const value = (record as Record<string, unknown>)[key];
        if (!validate(value)) {
            delete record[key];
        }
    });

    return record;
}

/** Type guard for string values in records */
export function isStringRecordValue(value: unknown): value is string {
    return typeof value === 'string';
}

/** Type guard for boolean values in records */
export function isBooleanRecordValue(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/** Type guard for plain object values in records */
export function isPlainObjectRecordValue(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
