import { describe, it, expect } from 'vitest';
import { parseFilterSearchTokens, fileMatchesFilterTokens, updateFilterQueryWithTag } from '../../src/utils/filterSearch';

const sortTokens = (values: string[]) => [...values].sort();

describe('parseFilterSearchTokens', () => {
    it('returns neutral tokens for blank queries', () => {
        const tokens = parseFilterSearchTokens('');
        expect(tokens.mode).toBe('filter');
        expect(tokens.expression).toHaveLength(0);
        expect(tokens.hasInclusions).toBe(false);
        expect(tokens.requiresTags).toBe(false);
        expect(tokens.allRequireTags).toBe(false);
        expect(tokens.includedTagTokens).toEqual([]);
        expect(tokens.nameTokens).toEqual([]);
        expect(tokens.tagTokens).toEqual([]);
        expect(tokens.requireTagged).toBe(false);
        expect(tokens.includeUntagged).toBe(false);
        expect(tokens.excludeNameTokens).toEqual([]);
        expect(tokens.excludeTagTokens).toEqual([]);
        expect(tokens.excludeTagged).toBe(false);
    });

    it('parses name tokens without tags', () => {
        const tokens = parseFilterSearchTokens('Platform note');
        expect(tokens.mode).toBe('filter');
        expect(tokens.hasInclusions).toBe(true);
        expect(tokens.requiresTags).toBe(false);
        expect(tokens.allRequireTags).toBe(false);
        expect(tokens.includedTagTokens).toEqual([]);
        expect(tokens.nameTokens).toEqual(['platform', 'note']);
        expect(tokens.tagTokens).toEqual([]);
        expect(tokens.requireTagged).toBe(false);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('parses tag tokens combined with name tokens', () => {
        const tokens = parseFilterSearchTokens('#yta plat');
        expect(tokens.mode).toBe('filter');
        expect(tokens.hasInclusions).toBe(true);
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.allRequireTags).toBe(true);
        expect(tokens.includedTagTokens).toEqual(['yta']);
        expect(tokens.tagTokens).toEqual(['yta']);
        expect(tokens.nameTokens).toEqual(['plat']);
        expect(tokens.requireTagged).toBe(true);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('keeps explicit AND as literal token outside tag mode', () => {
        const tokens = parseFilterSearchTokens('#yta and plat');
        expect(tokens.mode).toBe('filter');
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.allRequireTags).toBe(true);
        expect(tokens.includedTagTokens).toEqual(['yta']);
        expect(sortTokens(tokens.nameTokens)).toEqual(['and', 'plat']);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('collects tag tokens when OR connectors appear between tokens', () => {
        const tokens = parseFilterSearchTokens('#alpha OR #beta');
        expect(tokens.mode).toBe('tag');
        expect(tokens.expression.length).toBeGreaterThan(0);
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.allRequireTags).toBe(true);
        expect(sortTokens(tokens.includedTagTokens)).toEqual(['alpha', 'beta']);
        expect(sortTokens(tokens.tagTokens)).toEqual(['alpha', 'beta']);
        expect(tokens.nameTokens).toEqual([]);
        expect(tokens.requireTagged).toBe(false);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('treats standalone OR as a literal token', () => {
        const tokens = parseFilterSearchTokens('OR');
        expect(tokens.mode).toBe('filter');
        expect(tokens.hasInclusions).toBe(true);
        expect(tokens.requiresTags).toBe(false);
        expect(tokens.includedTagTokens).toEqual([]);
        expect(tokens.nameTokens).toEqual(['or']);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('keeps connector words when they are the only tokens', () => {
        const tokens = parseFilterSearchTokens('AND');
        expect(tokens.mode).toBe('filter');
        expect(tokens.hasInclusions).toBe(true);
        expect(tokens.requiresTags).toBe(false);
        expect(tokens.includedTagTokens).toEqual([]);
        expect(tokens.nameTokens).toEqual(['and']);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('treats trailing connector as literal with name tokens', () => {
        const tokens = parseFilterSearchTokens('openai and');
        expect(tokens.mode).toBe('filter');
        expect(tokens.requiresTags).toBe(false);
        expect(tokens.tagTokens).toEqual([]);
        expect(sortTokens(tokens.nameTokens)).toEqual(['and', 'openai']);
    });

    it('treats leading connector as literal with name tokens', () => {
        const tokens = parseFilterSearchTokens('or openai');
        expect(tokens.mode).toBe('filter');
        expect(tokens.requiresTags).toBe(false);
        expect(tokens.tagTokens).toEqual([]);
        expect(sortTokens(tokens.nameTokens)).toEqual(['openai', 'or']);
    });

    it('sets requireTagged when query is only hash', () => {
        const tokens = parseFilterSearchTokens('#');
        expect(tokens.mode).toBe('tag');
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.allRequireTags).toBe(true);
        expect(tokens.includedTagTokens).toEqual([]);
        expect(tokens.requireTagged).toBe(true);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('falls back to filter mode when a non-tag operand exists beside tags', () => {
        const tokens = parseFilterSearchTokens('plan OR #alpha');
        expect(tokens.mode).toBe('filter');
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.allRequireTags).toBe(true);
        expect(sortTokens(tokens.includedTagTokens)).toEqual(['alpha']);
        expect(sortTokens(tokens.nameTokens)).toEqual(['or', 'plan']);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('applies tag mode precedence when only tags and connectors are present', () => {
        const tokens = parseFilterSearchTokens('#tag1 OR #tag2 AND #tag3');
        expect(tokens.mode).toBe('tag');
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.allRequireTags).toBe(true);
        expect(sortTokens(tokens.includedTagTokens)).toEqual(['tag1', 'tag2', 'tag3']);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('marks untagged inclusion when !# appears in tag expressions', () => {
        const tokens = parseFilterSearchTokens('#alpha OR !#');
        expect(tokens.mode).toBe('tag');
        expect(tokens.includeUntagged).toBe(true);
        expect(tokens.excludeTagged).toBe(false);
        expect(tokens.includedTagTokens).toEqual(['alpha']);
    });

    it('drops dangling connectors before exclusion tokens', () => {
        const tokens = parseFilterSearchTokens('#alpha OR !#beta');
        expect(tokens.mode).toBe('tag');
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.excludeTagTokens).toEqual(['beta']);
        expect(tokens.excludeTagged).toBe(false);
        expect(tokens.includedTagTokens).toEqual(['alpha']);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('drops dangling connectors before the first inclusion token', () => {
        const tokens = parseFilterSearchTokens('!#beta OR #alpha');
        expect(tokens.mode).toBe('tag');
        expect(tokens.requiresTags).toBe(true);
        expect(sortTokens(tokens.includedTagTokens)).toEqual(['alpha']);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('keeps tag mode for negated tag-only expressions', () => {
        const tokens = parseFilterSearchTokens('!#alpha OR !#beta');
        expect(tokens.mode).toBe('tag');
        expect(tokens.requiresTags).toBe(true);
        expect(tokens.includedTagTokens).toEqual([]);
        expect(tokens.excludeTagTokens).toEqual(['alpha', 'beta']);
        expect(tokens.excludeTagged).toBe(false);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('parses negated name tokens', () => {
        const tokens = parseFilterSearchTokens('!draft');
        expect(tokens.mode).toBe('filter');
        expect(tokens.hasInclusions).toBe(false);
        expect(tokens.excludeNameTokens).toEqual(['draft']);
        expect(tokens.excludeTagTokens).toEqual([]);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('parses negated tag tokens', () => {
        const tokens = parseFilterSearchTokens('!#yta');
        expect(tokens.mode).toBe('tag');
        expect(tokens.hasInclusions).toBe(true);
        expect(tokens.excludeNameTokens).toEqual([]);
        expect(tokens.excludeTagTokens).toEqual(['yta']);
        expect(tokens.excludeTagged).toBe(false);
        expect(tokens.includeUntagged).toBe(false);
    });

    it('marks untagged inclusion when !# appears with name tokens', () => {
        const tokens = parseFilterSearchTokens('plat !#');
        expect(tokens.mode).toBe('filter');
        expect(tokens.includeUntagged).toBe(true);
        expect(tokens.excludeTagged).toBe(true);
    });

    it('parses negated tagged requirement', () => {
        const tokens = parseFilterSearchTokens('!#');
        expect(tokens.mode).toBe('tag');
        expect(tokens.excludeTagged).toBe(false);
        expect(tokens.includeUntagged).toBe(true);
    });
});

describe('updateFilterQueryWithTag', () => {
    it('adds a tag to an empty query', () => {
        const result = updateFilterQueryWithTag('', 'project/alpha', 'AND');
        expect(result.query).toBe('#project/alpha');
        expect(result.action).toBe('added');
        expect(result.changed).toBe(true);
    });

    it('removes an existing tag and cleans connectors', () => {
        const result = updateFilterQueryWithTag('#project/alpha AND #status/green', 'status/green', 'AND');
        expect(result.query).toBe('#project/alpha');
        expect(result.action).toBe('removed');
        expect(result.changed).toBe(true);
    });

    it('switches connector when toggling the same tag twice', () => {
        const first = updateFilterQueryWithTag('#project/alpha', 'status/green', 'OR');
        expect(first.query).toBe('#project/alpha OR #status/green');
        expect(first.action).toBe('added');
        expect(first.changed).toBe(true);

        const second = updateFilterQueryWithTag(first.query, 'status/green', 'OR');
        expect(second.query).toBe('#project/alpha');
        expect(second.action).toBe('removed');
        expect(second.changed).toBe(true);
    });

    it('normalizes duplicate connectors when removing a middle tag', () => {
        const result = updateFilterQueryWithTag('#alpha OR #beta OR #gamma', 'beta', 'OR');
        expect(result.query).toBe('#alpha OR #gamma');
        expect(result.action).toBe('removed');
        expect(result.changed).toBe(true);
    });

    it('matches tags case-insensitively', () => {
        const result = updateFilterQueryWithTag('#Alpha and #beta', 'alpha', 'AND');
        expect(result.query).toBe('#beta');
        expect(result.action).toBe('removed');
        expect(result.changed).toBe(true);
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

    it('matches tag tokens using prefix comparison', () => {
        const tokens = parseFilterSearchTokens('#yta');
        expect(fileMatchesFilterTokens('platform', ['yta'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform', ['yta-helper'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('platform', ['yta/roadmap'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform', ['inbox'], tokens)).toBe(false);
    });

    it('requires both name and tag tokens when both are present', () => {
        const tokens = parseFilterSearchTokens('#yta plat');
        expect(fileMatchesFilterTokens('platform plan', ['yta'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('roadmap plan', ['projects/mytag'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('platform plan', ['archive'], tokens)).toBe(false);
    });

    it('requires every literal token when connectors appear with plain text', () => {
        const tokens = parseFilterSearchTokens('alpha OR beta');
        expect(tokens.mode).toBe('filter');
        expect(fileMatchesFilterTokens('alpha or beta notes', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('alpha beta notes', [], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('alpha notes', [], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('beta summary', [], tokens)).toBe(false);
    });

    it('supports OR semantics when only tag operands are present', () => {
        const tokens = parseFilterSearchTokens('#alpha OR #beta');
        expect(tokens.mode).toBe('tag');
        expect(fileMatchesFilterTokens('note', ['alpha'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['beta'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['alpha/project'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['gamma'], tokens)).toBe(false);
    });

    it('matches descendant tags in tag mode', () => {
        const tokens = parseFilterSearchTokens('#ai');
        expect(tokens.mode).toBe('tag');
        expect(fileMatchesFilterTokens('note', ['ai'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['ai/help'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['ai-helper'], tokens)).toBe(false);
    });

    it('requires matching both name and tag in mixed filter mode queries', () => {
        const tokens = parseFilterSearchTokens('#alpha OR plan');
        expect(tokens.mode).toBe('filter');
        expect(fileMatchesFilterTokens('project or plan', ['alpha'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('project or plan', [], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('roadmap', ['projects/alpha'], tokens)).toBe(false);
    });

    it('matches untagged notes when using !# operand in tag mode', () => {
        const tokens = parseFilterSearchTokens('#alpha OR !#');
        expect(tokens.mode).toBe('tag');
        expect(fileMatchesFilterTokens('note', ['alpha'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['beta'], tokens)).toBe(false);
    });

    it('evaluates AND before OR for complex tag expressions', () => {
        const tokens = parseFilterSearchTokens('#tag1 OR #tag2 AND #tag3 OR #tag4 AND #tag5 AND #tag6');

        expect(fileMatchesFilterTokens('note', ['tag1'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['tag2', 'tag3'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['tag4', 'tag5', 'tag6'], tokens)).toBe(true);

        expect(fileMatchesFilterTokens('note', ['tag2'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('note', ['tag4', 'tag5'], tokens)).toBe(false);
    });

    it('supports OR tag queries combined with exclusion clauses', () => {
        const tokens = parseFilterSearchTokens('#alpha OR !#beta');
        expect(tokens.mode).toBe('tag');
        expect(fileMatchesFilterTokens('note', ['alpha'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['beta'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('note', [], tokens)).toBe(true);
    });

    it('matches when exclusions precede an OR branch', () => {
        const tokens = parseFilterSearchTokens('!#beta OR #alpha');
        expect(tokens.mode).toBe('tag');
        expect(fileMatchesFilterTokens('note', ['alpha'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['beta'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('note', [], tokens)).toBe(true);
    });

    it('evaluates OR logic for negated tag-only expressions', () => {
        const tokens = parseFilterSearchTokens('!#alpha OR !#beta');
        expect(tokens.mode).toBe('tag');
        expect(fileMatchesFilterTokens('note', ['alpha'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['beta'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('note', ['alpha', 'beta'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('note', [], tokens)).toBe(true);
    });

    it('requires tags when query is only hash', () => {
        const tokens = parseFilterSearchTokens('#');
        expect(fileMatchesFilterTokens('platform plan', ['projects/mytag'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(false);
    });

    it('excludes files with matching name tokens', () => {
        const tokens = parseFilterSearchTokens('plat !draft');
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform draft', [], tokens)).toBe(false);
    });

    it('excludes tagged files when !# is used', () => {
        const tokens = parseFilterSearchTokens('!#');
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform plan', ['projects/mytag'], tokens)).toBe(false);
    });

    it('excludes files with specific tags when !#tag is used', () => {
        const tokens = parseFilterSearchTokens('!#yta');
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform plan', ['mytag'], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform plan', ['yta'], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('platform plan', ['yta/roadmap'], tokens)).toBe(false);
    });

    it('handles mixed include and exclude tokens', () => {
        const tokens = parseFilterSearchTokens('plat !draft !#yta');
        expect(fileMatchesFilterTokens('platform plan', [], tokens)).toBe(true);
        expect(fileMatchesFilterTokens('platform draft', [], tokens)).toBe(false);
        expect(fileMatchesFilterTokens('platform plan', ['yta'], tokens)).toBe(false);
    });
});
