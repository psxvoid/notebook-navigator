import { describe, expect, it } from 'vitest';
import { ensureRecord, sanitizeRecord, isStringRecordValue } from '../../src/utils/recordUtils';

describe('sanitizeRecord', () => {
    it('returns a null-prototype object while preserving own entries', () => {
        const record = { valid: 'ok', constructor: 'icon' };

        const sanitized = sanitizeRecord(record);

        expect(Object.getPrototypeOf(sanitized)).toBeNull();
        expect(sanitized.valid).toBe('ok');
        expect(sanitized.constructor).toBe('icon');
    });

    it('drops inherited properties from the prototype chain', () => {
        const prototype = { inherited: 'skip' };
        const record = Object.create(prototype);
        record.own = 'keep';

        const sanitized = sanitizeRecord(record);

        expect(sanitized).toEqual({ own: 'keep' });
        expect('inherited' in sanitized).toBe(false);
    });

    it('applies validators to filter out invalid values', () => {
        const record = { good: 'yes', bad: 123 as unknown as string };

        const sanitized = sanitizeRecord(record, isStringRecordValue);

        expect(sanitized).toEqual({ good: 'yes' });
    });
});

describe('ensureRecord', () => {
    it('creates a null-prototype record when input is undefined', () => {
        const ensured = ensureRecord<string>(undefined);

        expect(Object.getPrototypeOf(ensured)).toBeNull();
    });

    it('sanitizes objects with prototypes by rebuilding entries only', () => {
        const proto = { inherited: 'skip' };
        const record = Object.create(proto);
        record.own = 'keep';

        const ensured = ensureRecord(record);

        expect(Object.getPrototypeOf(ensured)).toBeNull();
        expect(ensured).toEqual({ own: 'keep' });
    });

    it('removes invalid values when validate is provided', () => {
        const record = Object.create(null) as Record<string, unknown>;
        record.valid = 'ok';
        record.invalid = 42;

        const ensured = ensureRecord(record, isStringRecordValue);

        expect(ensured).toEqual({ valid: 'ok' });
        expect(Object.prototype.hasOwnProperty.call(ensured, 'invalid')).toBe(false);
    });
});
