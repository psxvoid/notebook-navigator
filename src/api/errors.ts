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
 * API Error handling and validation
 */

/**
 * Error codes for API operations
 * These codes are stable and will not change
 */
export enum APIErrorCode {
    // General errors (1000-1099)
    UNKNOWN = 1000,
    INVALID_PARAMETER = 1001,
    MISSING_PARAMETER = 1002,
    OPERATION_FAILED = 1003,
    NOT_INITIALIZED = 1004,
    PERMISSION_DENIED = 1005,

    // File system errors (1100-1199)
    FILE_NOT_FOUND = 1100,
    FILE_ALREADY_EXISTS = 1101,
    FOLDER_NOT_FOUND = 1102,
    FOLDER_ALREADY_EXISTS = 1103,
    INVALID_PATH = 1104,
    DELETE_FAILED = 1105,
    MOVE_FAILED = 1106,
    CREATE_FAILED = 1107,
    RENAME_FAILED = 1108,

    // Storage errors (1200-1299)
    STORAGE_NOT_READY = 1200,
    STORAGE_QUERY_FAILED = 1201,
    CACHE_MISS = 1202,
    INDEXEDDB_ERROR = 1203,

    // Navigation errors (1300-1399)
    NAVIGATION_FAILED = 1300,
    VIEW_NOT_OPEN = 1301,
    INVALID_SELECTION = 1302,

    // Metadata errors (1400-1499)
    METADATA_SAVE_FAILED = 1400,
    INVALID_COLOR = 1401,
    INVALID_ICON = 1402,
    INVALID_SORT_OPTION = 1403,

    // Tag errors (1500-1599)
    TAG_NOT_FOUND = 1500,
    INVALID_TAG_FORMAT = 1501,
    TAG_OPERATION_FAILED = 1502,

    // Version errors (1600-1699)
    INCOMPATIBLE_VERSION = 1600,
    DEPRECATED_FEATURE = 1601,
    FEATURE_NOT_AVAILABLE = 1602
}

/**
 * Base API Error class
 */
export class APIError extends Error {
    constructor(
        public readonly code: APIErrorCode,
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'APIError';

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, APIError);
        }
    }

    /**
     * Convert to JSON for serialization
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
            stack: this.stack
        };
    }

    /**
     * Create from a regular error
     */
    static from(error: unknown, code: APIErrorCode = APIErrorCode.UNKNOWN): APIError {
        if (error instanceof APIError) {
            return error;
        }

        if (error instanceof Error) {
            return new APIError(code, error.message, {
                originalError: error.name,
                originalStack: error.stack
            });
        }

        return new APIError(code, String(error));
    }
}
