import { describe, it, expect } from 'vitest';
import { parseFilterSearchTokens, fileMatchesFilterTokens } from '../../src/utils/filterSearch';

describe('parseFilterSearchTokens', () => {
    it('returns empty tokens for blank queries', () => {
        expect(parseFilterSearchTokens('')).toEqual({
            nameTokens: [],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false
        });
        expect(parseFilterSearchTokens('   ')).toEqual({
            nameTokens: [],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false
        });
    });

    it('parses name tokens without tags', () => {
        expect(parseFilterSearchTokens('Platform note')).toEqual({
            nameTokens: ['platform', 'note'],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false
        });
    });

    it('parses tag tokens and name tokens', () => {
        expect(parseFilterSearchTokens('#yta plat')).toEqual({
            nameTokens: ['plat'],
            tagTokens: ['yta'],
            requireTagged: true,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false
        });
    });

    it('ignores connector words when other tokens exist', () => {
        expect(parseFilterSearchTokens('#yta and plat')).toEqual({
            nameTokens: ['plat'],
            tagTokens: ['yta'],
            requireTagged: true,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false
        });
    });

    it('keeps connector words when they are the only tokens', () => {
        expect(parseFilterSearchTokens('AND')).toEqual({
            nameTokens: ['and'],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false
        });
    });

    it('sets requireTagged when query is only hash', () => {
        expect(parseFilterSearchTokens('#')).toEqual({
            nameTokens: [],
            tagTokens: [],
            requireTagged: true,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false
        });
    });

    it('parses negated name tokens', () => {
        expect(parseFilterSearchTokens('!draft')).toEqual({
            nameTokens: [],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: ['draft'],
            excludeTagTokens: [],
            excludeTagged: false
        });
    });

    it('parses negated tag tokens', () => {
        expect(parseFilterSearchTokens('!#yta')).toEqual({
            nameTokens: [],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: ['yta'],
            excludeTagged: false
        });
    });

    it('parses negated tagged requirement', () => {
        expect(parseFilterSearchTokens('!#')).toEqual({
            nameTokens: [],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: true
        });
    });
});

describe('fileMatchesFilterTokens', () => {
    it('matches when no tokens are provided', () => {
        const tokens = parseFilterSearchTokens('');
        expect(fileMatchesFilterTokens('platform', [], tokens)).toBe(true);
    });

    it('matches name tokens using substring comparison', () => {
        const tokens = parseFilterSearchTokens('plat form');
        expect(fileMatchesFilterTokens('platform notes', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note list', [], tokens)).toBe(false);
    });

    it('matches tag tokens using substring comparison', () => {
        const tokens = parseFilterSearchTokens('#yta');
        expect(fileMatchesFilterTokens('platform', ['projects/mytag'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform', ['inbox'], tokens)).toBe(false);
    });

    it('requires both name and tag tokens when both are present', () => {
        const tokens = parseFilterSearchTokens('#yta plat');
        expect(fileMatchesFilterTokens('platform plan', ['projects/mytag'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('roadmap plan', ['projects/mytag'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('platform plan', ['projects/archive'], tokens)).toBe(false);
    });

    it('requires tags when query is only hash', () => {
        const tokens = parseFilterSearchTokens('#');
        expect(fileMatchesFilterTokens('platform plan', ['projects/mytag'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(false);
    });

    it('excludes files with matching name tokens', () => {
        const tokens = parseFilterSearchTokens('!draft');
        expect(fileMatchesFilterTokens('project plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('draft notes', [], tokens)).toBe(false);
    });

    it('excludes tagged files when !# is used', () => {
        const tokens = parseFilterSearchTokens('!#');
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform plan', ['projects/mytag'], tokens)).toBe(false);
    });

    it('excludes files with specific tags when !#tag is used', () => {
        const tokens = parseFilterSearchTokens('!#yta');
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform plan', ['projects/mytag'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('platform plan', ['projects/yta-roadmap'], tokens)).toBe(false);
    });

    it('handles mixed include and exclude tokens', () => {
        const tokens = parseFilterSearchTokens('plat !draft !#yta');
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform draft', [], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('platform plan', ['projects/yta-roadmap'], tokens)).toBe(false);
    });
});
