import { describe, it, expect } from 'vitest';
import { getFileDisplayName } from '../../src/utils/fileNameUtils';
import { createTestTFile } from './createTestTFile';

describe('getFileDisplayName', () => {
    it('strips composite Excalidraw suffix from markdown files', () => {
        const file = createTestTFile('Drawing 2025-10-24T10-03-10.excalidraw.md');
        expect(getFileDisplayName(file)).toBe('Drawing 2025-10-24T10-03-10');
    });

    it('returns basename for standard markdown files', () => {
        const file = createTestTFile('Example Note.md');
        expect(getFileDisplayName(file)).toBe('Example Note');
    });
});
