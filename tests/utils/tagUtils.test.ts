import { describe, it, expect } from 'vitest';
import { hasValidTagCharacters, isValidTagPrecedingChar } from '../../src/utils/tagUtils';

describe('tagUtils', () => {
    describe('hasValidTagCharacters', () => {
        it('should return true for valid tags', () => {
            expect(hasValidTagCharacters('valid-tag')).toBe(true);
            expect(hasValidTagCharacters('valid_tag')).toBe(true);
            expect(hasValidTagCharacters('valid/tag')).toBe(true);
            expect(hasValidTagCharacters('123')).toBe(true);
            expect(hasValidTagCharacters('ümlaut')).toBe(true);
        });

        it('should return false for invalid tags', () => {
            expect(hasValidTagCharacters('invalid tag')).toBe(false);
            expect(hasValidTagCharacters('invalid#tag')).toBe(false);
            expect(hasValidTagCharacters('invalid!')).toBe(false);
            expect(hasValidTagCharacters('')).toBe(false);
            expect(hasValidTagCharacters(null)).toBe(false);
            expect(hasValidTagCharacters(undefined)).toBe(false);
        });
    });

    describe('isValidTagPrecedingChar', () => {
        it('should return true for whitespace', () => {
            expect(isValidTagPrecedingChar(' ')).toBe(true);
            expect(isValidTagPrecedingChar('\t')).toBe(true);
            expect(isValidTagPrecedingChar('\n')).toBe(true);
        });

        it('should return true for exclamation mark', () => {
            expect(isValidTagPrecedingChar('!')).toBe(true);
        });

        it('should return true for null/undefined (start of string)', () => {
            expect(isValidTagPrecedingChar(null)).toBe(true);
            expect(isValidTagPrecedingChar(undefined)).toBe(true);
        });

        it('should return false for other characters', () => {
            expect(isValidTagPrecedingChar('a')).toBe(false);
            expect(isValidTagPrecedingChar('1')).toBe(false);
            expect(isValidTagPrecedingChar('-')).toBe(false);
            expect(isValidTagPrecedingChar('.')).toBe(false);
        });
    });
});
