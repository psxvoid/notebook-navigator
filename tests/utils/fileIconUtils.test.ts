import { describe, expect, it } from 'vitest';
import { resolveFileNameMatchIconId, resolveFileTypeIconId, resolveFileTypeIconKey } from '../../src/utils/fileIconUtils';
import { createTestTFile } from './createTestTFile';

describe('resolveFileNameMatchIconId', () => {
    it('returns null for empty basenames', () => {
        expect(resolveFileNameMatchIconId('', { meeting: 'calendar' })).toBe(null);
    });

    it('matches case-insensitively and prefers longer needles', () => {
        const iconMap = {
            meet: 'check-circle',
            meeting: 'calendar',
            invoice: 'receipt'
        };

        expect(resolveFileNameMatchIconId('Meeting notes', iconMap)).toBe('calendar');
        expect(resolveFileNameMatchIconId('Invoice 2025', iconMap)).toBe('receipt');
    });

    it('breaks ties by needle sort order', () => {
        const iconMap = {
            ab: 'icon-ab',
            aa: 'icon-aa'
        };

        expect(resolveFileNameMatchIconId('aab', iconMap)).toBe('icon-aa');
    });

    it('ignores empty needles and empty icon IDs', () => {
        const iconMap = {
            meeting: 'calendar',
            '': 'invalid',
            invoice: ''
        };

        expect(resolveFileNameMatchIconId('Invoice meeting', iconMap)).toBe('calendar');
    });
});

describe('resolveFileTypeIconKey', () => {
    it('normalizes file extensions to lowercase', () => {
        const file = createTestTFile('Photo.PNG');
        expect(resolveFileTypeIconKey(file)).toBe('png');
    });

    describe('resolveFileTypeIconId', () => {
        it('returns null for empty keys', () => {
            expect(resolveFileTypeIconId('', { md: 'file-text' })).toBe(null);
        });

        it('uses explicit overrides before built-in mappings', () => {
            expect(resolveFileTypeIconId('md', { md: 'book-open' })).toBe('book-open');
        });

        it('falls back to built-in mappings when no override exists', () => {
            expect(resolveFileTypeIconId('md', {})).toBe('file-text');
            expect(resolveFileTypeIconId('png', {})).toBe('image');
        });

        it('returns null for unknown types without overrides', () => {
            expect(resolveFileTypeIconId('cpp', {})).toBe(null);
        });
    });

    it('returns excalidraw.md for .excalidraw.md filenames', () => {
        const file = createTestTFile('Drawing.excalidraw.md');
        expect(resolveFileTypeIconKey(file)).toBe('excalidraw.md');
    });

    it('returns excalidraw.md when excalidraw frontmatter flag is set', () => {
        const file = createTestTFile('Drawing.md');
        const metadataCacheStub = {
            getFileCache: () => ({ frontmatter: { 'excalidraw-plugin': true } })
        };

        expect(resolveFileTypeIconKey(file, metadataCacheStub)).toBe('excalidraw.md');
    });

    it('ignores false-like excalidraw frontmatter flags', () => {
        const file = createTestTFile('Drawing.md');
        const metadataCacheStub = {
            getFileCache: () => ({ frontmatter: { 'excalidraw-plugin': 'false' } })
        };

        expect(resolveFileTypeIconKey(file, metadataCacheStub)).toBe('md');
    });
});
