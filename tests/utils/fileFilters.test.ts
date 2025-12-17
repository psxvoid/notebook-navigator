import { describe, expect, it } from 'vitest';
import { createHiddenFileNameMatcher, shouldExcludeFileName } from '../../src/utils/fileFilters';
import { createTestTFile } from './createTestTFile';

describe('shouldExcludeFileName', () => {
    it('matches literal names exactly and does not match basenames', () => {
        const file = createTestTFile('cover.md');
        expect(shouldExcludeFileName(file, ['cover'])).toBe(false);
        expect(shouldExcludeFileName(file, ['cover.md'])).toBe(true);
    });

    it('matches wildcard patterns against names with and without extensions', () => {
        const fileWithoutExtension = createTestTFile('cover');
        const fileWithExtension = createTestTFile('cover.md');
        expect(shouldExcludeFileName(fileWithoutExtension, ['cover*'])).toBe(true);
        expect(shouldExcludeFileName(fileWithExtension, ['cover*'])).toBe(true);
    });

    it('matches wildcard prefix patterns against the basename', () => {
        const file = createTestTFile('temp-123.md');
        expect(shouldExcludeFileName(file, ['temp-*'])).toBe(true);
        expect(shouldExcludeFileName(file, ['other-*'])).toBe(false);
    });

    it('matches wildcard extension patterns against the filename', () => {
        const file = createTestTFile('Images/Cover.PNG');
        expect(shouldExcludeFileName(file, ['*.png'])).toBe(true);
        expect(shouldExcludeFileName(file, ['*.jpg'])).toBe(false);
    });

    it('matches path patterns with leading slashes', () => {
        const file = createTestTFile('Images/Cover.PNG');
        expect(shouldExcludeFileName(file, ['/images/*'])).toBe(true);
        expect(shouldExcludeFileName(file, ['/other/*'])).toBe(false);
    });

    it('matches literal extension patterns', () => {
        const file = createTestTFile('photo.png');
        expect(shouldExcludeFileName(file, ['.png'])).toBe(true);
        expect(shouldExcludeFileName(file, ['.md'])).toBe(false);
    });

    it('matches exact filenames', () => {
        const file = createTestTFile('cover.png');
        expect(shouldExcludeFileName(file, ['cover.png'])).toBe(true);
        expect(shouldExcludeFileName(file, ['other.png'])).toBe(false);
    });

    it('handles multiple wildcards without requiring regex', () => {
        const file = createTestTFile('prefix-middle-suffix.md');
        expect(shouldExcludeFileName(file, ['prefix*middle*suffix'])).toBe(true);
        expect(shouldExcludeFileName(file, ['prefix*middle*suffix*'])).toBe(true);
        expect(shouldExcludeFileName(file, ['prefix*middle*suffixx'])).toBe(false);
        expect(shouldExcludeFileName(file, ['*prefix*middle*suffix'])).toBe(true);
        expect(shouldExcludeFileName(file, ['*prefix*middle*suffix*'])).toBe(true);
    });

    it('treats * as a match-all glob', () => {
        const file = createTestTFile('any/path/file.md');
        expect(shouldExcludeFileName(file, ['*'])).toBe(true);
    });

    it('treats consecutive wildcards as a single wildcard', () => {
        const file = createTestTFile('a---b.md');
        expect(shouldExcludeFileName(file, ['a**b'])).toBe(true);
        expect(shouldExcludeFileName(file, ['a***b'])).toBe(true);
    });

    it('dedupes and sorts patterns when caching matchers', () => {
        const first = createHiddenFileNameMatcher(['  *.png ', 'temp-*', '*.png']);
        const second = createHiddenFileNameMatcher(['temp-*', '*.png']);
        expect(first).toBe(second);
    });
});
