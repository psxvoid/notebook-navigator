import { describe, expect, it } from 'vitest';
import { findFencedCodeBlockRanges, findInlineCodeRanges, isIndexInRanges } from '../../src/utils/codeRangeUtils';

describe('codeRangeUtils', () => {
    it('finds fenced code blocks and returns exact slices', () => {
        const content = ['Intro', '```js', 'const value = 1;', '```', 'Outro'].join('\n');
        const ranges = findFencedCodeBlockRanges(content);

        expect(ranges).toHaveLength(1);
        const [range] = ranges;
        expect(content.slice(range.start, range.end)).toBe(['```js', 'const value = 1;', '```', ''].join('\n'));
    });

    it('treats unterminated fences as running to the end of the document', () => {
        const content = ['Intro', '```', 'open block'].join('\n');
        const ranges = findFencedCodeBlockRanges(content);

        expect(ranges).toHaveLength(1);
        expect(ranges[0]).toEqual({ start: 'Intro\n'.length, end: content.length });
    });

    it('ignores inline backticks inside fenced blocks', () => {
        const content = ['Alpha `code` segment', '```js', 'const value = `inline`;', '```', 'Omega'].join('\n');
        const fenced = findFencedCodeBlockRanges(content);
        const inline = findInlineCodeRanges(content, fenced);

        expect(inline).toHaveLength(1);
        expect(content.slice(inline[0].start, inline[0].end)).toBe('`code`');
    });

    it('detects multi-backtick inline spans', () => {
        const content = 'Example ``callout`` test';
        const inline = findInlineCodeRanges(content);

        expect(inline).toHaveLength(1);
        expect(content.slice(inline[0].start, inline[0].end)).toBe('``callout``');
    });

    it('detects index membership within ranges', () => {
        const ranges = [
            { start: 2, end: 5 },
            { start: 10, end: 12 }
        ];

        expect(isIndexInRanges(3, ranges)).toBe(true);
        expect(isIndexInRanges(5, ranges)).toBe(false);
        expect(isIndexInRanges(11, ranges)).toBe(true);
    });
});
