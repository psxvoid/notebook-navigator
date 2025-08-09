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

/**
 * Specific error types
 */
export class FileNotFoundError extends APIError {
    constructor(path: string) {
        super(APIErrorCode.FILE_NOT_FOUND, `File not found: ${path}`, { path });
        this.name = 'FileNotFoundError';
    }
}

export class FolderNotFoundError extends APIError {
    constructor(path: string) {
        super(APIErrorCode.FOLDER_NOT_FOUND, `Folder not found: ${path}`, { path });
        this.name = 'FolderNotFoundError';
    }
}

export class InvalidParameterError extends APIError {
    constructor(parameter: string, reason: string) {
        super(APIErrorCode.INVALID_PARAMETER, `Invalid parameter '${parameter}': ${reason}`, {
            parameter,
            reason
        });
        this.name = 'InvalidParameterError';
    }
}

export class StorageNotReadyError extends APIError {
    constructor() {
        super(APIErrorCode.STORAGE_NOT_READY, 'Storage system is not ready');
        this.name = 'StorageNotReadyError';
    }
}

export class IncompatibleVersionError extends APIError {
    constructor(clientVersion: string, apiVersion: string) {
        super(APIErrorCode.INCOMPATIBLE_VERSION, `API version ${clientVersion} is incompatible with plugin API ${apiVersion}`, {
            clientVersion,
            apiVersion
        });
        this.name = 'IncompatibleVersionError';
    }
}

/**
 * Parameter validation utilities
 */
export class Validator {
    /**
     * Validate required parameters
     */
    static validateRequired(params: Record<string, unknown>, required: string[]): void {
        for (const param of required) {
            if (params[param] === undefined || params[param] === null) {
                throw new APIError(APIErrorCode.MISSING_PARAMETER, `Missing required parameter: ${param}`, { parameter: param });
            }
        }
    }

    /**
     * Validate parameter type
     */
    static validateType(value: unknown, name: string, expectedType: string): void {
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== expectedType) {
            throw new InvalidParameterError(name, `Expected ${expectedType}, got ${actualType}`);
        }
    }

    /**
     * Validate string parameter
     */
    static validateString(
        value: unknown,
        name: string,
        options?: {
            minLength?: number;
            maxLength?: number;
            pattern?: RegExp;
            allowEmpty?: boolean;
        }
    ): void {
        this.validateType(value, name, 'string');

        const str = value as string;

        if (!options?.allowEmpty && str.length === 0) {
            throw new InvalidParameterError(name, 'Cannot be empty');
        }

        if (options?.minLength && str.length < options.minLength) {
            throw new InvalidParameterError(name, `Minimum length is ${options.minLength}`);
        }

        if (options?.maxLength && str.length > options.maxLength) {
            throw new InvalidParameterError(name, `Maximum length is ${options.maxLength}`);
        }

        if (options?.pattern && !options.pattern.test(str)) {
            throw new InvalidParameterError(name, `Does not match required pattern`);
        }
    }

    /**
     * Validate number parameter
     */
    static validateNumber(
        value: unknown,
        name: string,
        options?: {
            min?: number;
            max?: number;
            integer?: boolean;
        }
    ): void {
        this.validateType(value, name, 'number');

        const num = value as number;

        if (options?.integer && !Number.isInteger(num)) {
            throw new InvalidParameterError(name, 'Must be an integer');
        }

        if (options?.min !== undefined && num < options.min) {
            throw new InvalidParameterError(name, `Minimum value is ${options.min}`);
        }

        if (options?.max !== undefined && num > options.max) {
            throw new InvalidParameterError(name, `Maximum value is ${options.max}`);
        }
    }

    /**
     * Validate array parameter
     */
    static validateArray(
        value: unknown,
        name: string,
        options?: {
            minLength?: number;
            maxLength?: number;
            itemValidator?: (item: unknown, index: number) => void;
        }
    ): void {
        if (!Array.isArray(value)) {
            throw new InvalidParameterError(name, 'Must be an array');
        }

        const arr = value;

        if (options?.minLength && arr.length < options.minLength) {
            throw new InvalidParameterError(name, `Minimum length is ${options.minLength}`);
        }

        if (options?.maxLength && arr.length > options.maxLength) {
            throw new InvalidParameterError(name, `Maximum length is ${options.maxLength}`);
        }

        if (options?.itemValidator) {
            const validator = options.itemValidator;
            arr.forEach((item, index) => {
                try {
                    validator(item, index);
                } catch (error) {
                    throw new InvalidParameterError(`${name}[${index}]`, error instanceof Error ? error.message : String(error));
                }
            });
        }
    }

    /**
     * Validate file path
     */
    static validatePath(value: unknown, name: string): void {
        this.validateString(value, name, {
            minLength: 1,
            pattern: /^[^<>:"|?*]+$/ // Basic path validation
        });

        const path = value as string;

        // Check for dangerous paths
        if (path.includes('..')) {
            throw new InvalidParameterError(name, 'Path cannot contain ".."');
        }

        if (path.startsWith('/') && path.length === 1) {
            // Root path is okay
            return;
        }

        if (path.endsWith('/')) {
            throw new InvalidParameterError(name, 'Path cannot end with "/"');
        }
    }

    /**
     * Validate color string
     */
    static validateColor(value: unknown, name: string): void {
        this.validateString(value, name);

        const color = value as string;
        const hexPattern = /^#[0-9A-Fa-f]{6}$/;
        const rgbPattern = /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/;
        const rgbaPattern = /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[01]?\.?\d*\)$/;

        if (!hexPattern.test(color) && !rgbPattern.test(color) && !rgbaPattern.test(color)) {
            throw new InvalidParameterError(name, 'Invalid color format');
        }
    }
}

/**
 * Error handler wrapper for API methods
 */
export function handleAPIError<T>(operation: () => T | Promise<T>, context?: string): T | Promise<T> {
    try {
        const result = operation();

        // Handle async operations
        if (result instanceof Promise) {
            return result.catch(error => {
                throw APIError.from(error);
            });
        }

        return result;
    } catch (error) {
        // Add context if provided
        const apiError = APIError.from(error);
        if (context) {
            // Create new error with context added to details
            throw new APIError(apiError.code, apiError.message, { ...apiError.details, context });
        }
        throw apiError;
    }
}

/**
 * Result type for operations that can fail
 */
export type APIResult<T> = { success: true; data: T } | { success: false; error: APIError };

/**
 * Wrap operation in a result type
 */
export async function toResult<T>(operation: () => Promise<T>): Promise<APIResult<T>> {
    try {
        const data = await operation();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: APIError.from(error) };
    }
}
