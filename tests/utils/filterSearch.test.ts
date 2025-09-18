import { describe, it, expect } from 'vitest';
import { parseFilterSearchTokens, fileMatchesFilterTokens } from '../../src/utils/filterSearch';

describe('parseFilterSearchTokens', () => {
    it('returns empty tokens for blank queries', () => {
        expect(parseFilterSearchTokens('')).toEqual({ nameTokens: [], tagTokens: [], requireTagged: false });
        expect(parseFilterSearchTokens('   ')).toEqual({ nameTokens: [], tagTokens: [], requireTagged: false });
    });

    it('parses name tokens without tags', () => {
        expect(parseFilterSearchTokens('Platform note')).toEqual({
            nameTokens: ['platform', 'note'],
            tagTokens: [],
            requireTagged: false
        });
    });

    it('parses tag tokens and name tokens', () => {
        expect(parseFilterSearchTokens('#yta plat')).toEqual({
            nameTokens: ['plat'],
            tagTokens: ['yta'],
            requireTagged: true
        });
    });

    it('ignores connector words when other tokens exist', () => {
        expect(parseFilterSearchTokens('#yta and plat')).toEqual({
            nameTokens: ['plat'],
            tagTokens: ['yta'],
            requireTagged: true
        });
    });

    it('keeps connector words when they are the only tokens', () => {
        expect(parseFilterSearchTokens('AND')).toEqual({
            nameTokens: ['and'],
            tagTokens: [],
            requireTagged: false
        });
    });

    it('sets requireTagged when query is only hash', () => {
        expect(parseFilterSearchTokens('#')).toEqual({
            nameTokens: [],
            tagTokens: [],
            requireTagged: true
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
});
