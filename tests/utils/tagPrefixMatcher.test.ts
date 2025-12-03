import { describe, it, expect } from 'vitest';
import { createHiddenTagMatcher, matchesHiddenTagPattern } from '../../src/utils/tagPrefixMatcher';

function extractName(tagPath: string): string {
    const parts = tagPath.split('/');
    return parts[parts.length - 1] ?? tagPath;
}

describe('createHiddenTagMatcher', () => {
    it('categorizes prefix, startsWith, endsWith, and path patterns', () => {
        const matcher = createHiddenTagMatcher(['ARCHIVE', 'temp*', '*Draft', 'archive/*', '*temp*']);

        expect(matcher.prefixes).toEqual(['archive', 'temp']);
        expect(matcher.startsWithNames).toEqual(['temp']);
        expect(matcher.endsWithNames).toEqual(['draft']);
        expect(matcher.pathPatterns.map(pattern => pattern.normalized)).toEqual(expect.arrayContaining(['archive', 'archive/*', 'temp*']));
    });

    it('sanitizes patterns by removing hash prefix and trailing slashes', () => {
        const matcher = createHiddenTagMatcher(['#Area/Planning/', 'Docs//']);

        expect(matcher.prefixes).toContain('area/planning');
        expect(matcher.prefixes).toContain('docs');
        expect(matcher.pathPatterns.map(pattern => pattern.normalized)).toEqual(expect.arrayContaining(['area/planning', 'docs']));
    });

    it('ignores invalid wildcard patterns', () => {
        const matcher = createHiddenTagMatcher(['*temp*', 'archive/**/private', 'proj*ect*', '']);

        expect(matcher.prefixes).toEqual([]);
        expect(matcher.startsWithNames).toEqual([]);
        expect(matcher.endsWithNames).toEqual([]);
        expect(matcher.pathPatterns).toEqual([]);
    });
});

describe('matchesHiddenTagPattern', () => {
    const matcher = createHiddenTagMatcher(['archive', 'temp*', '*draft', 'projects/*/drafts']);

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

    it('matches mid-segment wildcard path patterns', () => {
        expect(matchesHiddenTagPattern('projects/client/drafts', extractName('projects/client/drafts'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('projects/other/notes', extractName('projects/other/notes'), matcher)).toBe(false);
    });

    it('matches trailing wildcard path patterns against the base tag', () => {
        const trailingMatcher = createHiddenTagMatcher(['projects/*']);

        expect(matchesHiddenTagPattern('projects', extractName('projects'), trailingMatcher)).toBe(false);
        expect(matchesHiddenTagPattern('projects/client', extractName('projects/client'), trailingMatcher)).toBe(true);
    });

    it('does not match when only ignored wildcard patterns are provided', () => {
        const ignoredMatcher = createHiddenTagMatcher(['archive/*/private', '*temp*']);

        expect(matchesHiddenTagPattern('archive/2024', extractName('archive/2024'), ignoredMatcher)).toBe(false);
        expect(matchesHiddenTagPattern('temp-files', extractName('temp-files'), ignoredMatcher)).toBe(false);
    });

    it('returns false when no patterns are configured', () => {
        const emptyMatcher = createHiddenTagMatcher([]);

        expect(matchesHiddenTagPattern('archive', extractName('archive'), emptyMatcher)).toBe(false);
    });
});
