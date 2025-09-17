import { describe, it, expect } from 'vitest';
import { createHiddenTagMatcher, matchesHiddenTagPattern } from '../../src/utils/tagPrefixMatcher';

function extractName(tagPath: string): string {
    const parts = tagPath.split('/');
    return parts[parts.length - 1] ?? tagPath;
}

describe('createHiddenTagMatcher', () => {
    it('categorizes prefix, startsWith, and endsWith patterns', () => {
        const matcher = createHiddenTagMatcher(['ARCHIVE', 'temp*', '*Draft', 'archive', 'archive/*', '*temp*']);

        expect(matcher.prefixes).toEqual(['archive']);
        expect(matcher.startsWithNames).toEqual(['temp']);
        expect(matcher.endsWithNames).toEqual(['draft']);
    });

    it('sanitizes patterns by removing hash prefix and trailing slashes', () => {
        const matcher = createHiddenTagMatcher(['#Area/Planning/', 'Docs//']);

        expect(matcher.prefixes).toContain('area/planning');
        expect(matcher.prefixes).toContain('docs');
    });

    it('ignores invalid wildcard patterns', () => {
        const matcher = createHiddenTagMatcher(['*temp*', 'archive/*', '']);

        expect(matcher.prefixes).toEqual([]);
        expect(matcher.startsWithNames).toEqual([]);
        expect(matcher.endsWithNames).toEqual([]);
    });
});

describe('matchesHiddenTagPattern', () => {
    const matcher = createHiddenTagMatcher(['archive', 'temp*', '*draft']);

    it('matches full path prefixes', () => {
        expect(matchesHiddenTagPattern('archive', extractName('archive'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('archive/2024/reports', extractName('archive/2024/reports'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('ARCHIVE/Ideas', extractName('ARCHIVE/Ideas'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('project/archive', extractName('project/archive'), matcher)).toBe(false);
    });

    it('matches tag names that start with configured text', () => {
        expect(matchesHiddenTagPattern('temp', extractName('temp'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('temp-notes', extractName('temp-notes'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('attempt', extractName('attempt'), matcher)).toBe(false);
    });

    it('matches tag names that end with configured text', () => {
        expect(matchesHiddenTagPattern('draft', extractName('draft'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('meeting-draft', extractName('meeting-draft'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('drafting', extractName('drafting'), matcher)).toBe(false);
    });

    it('does not match when only ignored wildcard patterns are provided', () => {
        const ignoredMatcher = createHiddenTagMatcher(['archive/*', '*temp*']);

        expect(matchesHiddenTagPattern('archive/2024', extractName('archive/2024'), ignoredMatcher)).toBe(false);
        expect(matchesHiddenTagPattern('temp-files', extractName('temp-files'), ignoredMatcher)).toBe(false);
    });

    it('returns false when no patterns are configured', () => {
        const emptyMatcher = createHiddenTagMatcher([]);

        expect(matchesHiddenTagPattern('archive', extractName('archive'), emptyMatcher)).toBe(false);
    });
});
