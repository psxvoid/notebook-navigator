import { strings } from '../i18n';
import { isRecord } from './typeGuards';

const DEFAULT_UNKNOWN_ERROR = strings.common.unknownError;

function toError(error: unknown, fallback: string = DEFAULT_UNKNOWN_ERROR): Error {
    if (error instanceof Error) {
        return error;
    }

    if (isRecord(error) && typeof error.message === 'string') {
        return new Error(error.message);
    }

    if (typeof error === 'string') {
        const trimmed = error.trim();
        return new Error(trimmed || fallback);
    }

    if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
        return new Error(String(error));
    }

    if (typeof error === 'object' && error !== null) {
        try {
            return new Error(JSON.stringify(error));
        } catch {
            return new Error(fallback);
        }
    }

    return new Error(fallback);
}

export function getErrorMessage(error: unknown, fallback: string = DEFAULT_UNKNOWN_ERROR): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (isRecord(error) && typeof error.message === 'string') {
        const trimmed = error.message.trim();
        if (trimmed) {
            return trimmed;
        }
    }

    if (typeof error === 'string') {
        const trimmed = error.trim();
        return trimmed || fallback;
    }

    const message = toError(error, fallback).message;
    return message || fallback;
}
