/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Determines evaluation mode for search tokens (filter uses AND for all, tag uses expression tree)
export type FilterMode = 'filter' | 'tag';

// Logical operator for combining tag filter expressions
export type InclusionOperator = 'AND' | 'OR';

// Operands in a tag filter expression tree
type TagExpressionOperand =
    | {
          kind: 'tag';
          value: string;
      }
    | {
          kind: 'notTag';
          value: string;
      }
    | {
          kind: 'requireTagged';
      }
    | {
          kind: 'untagged';
      };

// Tokens in a tag filter expression (operands and operators)
type TagExpressionToken =
    | TagExpressionOperand
    | {
          kind: 'operator';
          operator: InclusionOperator;
      };

/**
 * Tokens extracted from a filter search query.
 */
export interface FilterSearchTokens {
    mode: FilterMode;
    expression: TagExpressionToken[];
    hasInclusions: boolean;
    requiresTags: boolean;
    allRequireTags: boolean;
    includedTagTokens: string[];
    nameTokens: string[];
    tagTokens: string[];
    requireTagged: boolean;
    includeUntagged: boolean;
    excludeNameTokens: string[];
    excludeTagTokens: string[];
    excludeTagged: boolean;
}

// Default empty token set returned for blank queries
const EMPTY_TOKENS: FilterSearchTokens = {
    mode: 'filter',
    expression: [],
    hasInclusions: false,
    requiresTags: false,
    allRequireTags: false,
    includedTagTokens: [],
    nameTokens: [],
    tagTokens: [],
    requireTagged: false,
    includeUntagged: false,
    excludeNameTokens: [],
    excludeTagTokens: [],
    excludeTagged: false
};

// Precedence values for expression evaluation (higher number binds tighter)
const OPERATOR_PRECEDENCE: Record<InclusionOperator, number> = {
    AND: 2,
    OR: 1
};

// Set of recognized connector words in search queries
const CONNECTOR_TOKEN_SET = new Set(['and', 'or']);

// Checks if a tag token matches a lowercase tag path (exact or descendant)
const tagMatchesToken = (tagPath: string, token: string): boolean => {
    if (!tagPath || !token) {
        return false;
    }
    return tagPath === token || tagPath.startsWith(`${token}/`);
};

// Intermediate token representation during classification
type ClassifiedToken =
    | {
          kind: 'operator';
          operator: InclusionOperator;
      }
    | {
          kind: 'tag';
          value: string | null;
      }
    | {
          kind: 'tagNegation';
          value: string | null;
      }
    | {
          kind: 'name';
          value: string;
      }
    | {
          kind: 'nameNegation';
          value: string;
      };

// Result of classifying raw string tokens into typed tokens
interface TokenClassificationResult {
    tokens: ClassifiedToken[];
    hasTagOperand: boolean;
    hasNonTagOperand: boolean;
    hasInvalidToken: boolean;
}

// Checks if a token set can use tag expression mode
const canUseTagMode = (classification: TokenClassificationResult): boolean => {
    return classification.hasTagOperand && !classification.hasNonTagOperand && !classification.hasInvalidToken;
};

// Parses raw tokens into classified tokens with metadata
const classifyRawTokens = (rawTokens: string[]): TokenClassificationResult => {
    const tokens: ClassifiedToken[] = [];
    let hasTagOperand = false;
    let hasNonTagOperand = false;
    let hasInvalidToken = false;

    for (const token of rawTokens) {
        if (!token) {
            continue;
        }

        if (token === 'and') {
            tokens.push({ kind: 'operator', operator: 'AND' });
            continue;
        }

        if (token === 'or') {
            tokens.push({ kind: 'operator', operator: 'OR' });
            continue;
        }

        if (token.startsWith('!')) {
            const negatedToken = token.slice(1);
            if (!negatedToken) {
                hasInvalidToken = true;
                continue;
            }

            if (negatedToken.startsWith('#')) {
                const tagValue = negatedToken.slice(1);
                tokens.push({ kind: 'tagNegation', value: tagValue.length > 0 ? tagValue : null });
                hasTagOperand = true;
                continue;
            }

            hasNonTagOperand = true;
            tokens.push({ kind: 'nameNegation', value: negatedToken });
            continue;
        }

        if (token.startsWith('#')) {
            const tagValue = token.slice(1);
            tokens.push({ kind: 'tag', value: tagValue.length > 0 ? tagValue : null });
            hasTagOperand = true;
            continue;
        }

        hasNonTagOperand = true;
        tokens.push({ kind: 'name', value: token });
    }

    return {
        tokens,
        hasTagOperand,
        hasNonTagOperand,
        hasInvalidToken
    };
};

// Result of building a tag expression tree from classified tokens
interface TagExpressionBuildResult {
    expression: TagExpressionToken[];
    includeUntagged: boolean;
    requireTagged: boolean;
    includedTagTokens: string[];
}

// Builds a postfix expression tree from classified tokens using operator precedence
const buildTagExpression = (classifiedTokens: ClassifiedToken[]): TagExpressionBuildResult | null => {
    const expression: TagExpressionToken[] = [];
    const operatorStack: InclusionOperator[] = [];
    const positiveTags = new Set<string>();

    let expectOperand = true;
    let includeUntagged = false;
    let requireTagged = false;
    let hasOperand = false;

    // Pushes an operator to the expression, respecting precedence
    const pushOperator = (operator: InclusionOperator): boolean => {
        if (expectOperand) {
            return false;
        }

        // Pop higher or equal precedence operators from stack
        while (operatorStack.length > 0) {
            const top = operatorStack[operatorStack.length - 1];
            if (OPERATOR_PRECEDENCE[top] >= OPERATOR_PRECEDENCE[operator]) {
                expression.push({ kind: 'operator', operator: operatorStack.pop() as InclusionOperator });
            } else {
                break;
            }
        }

        operatorStack.push(operator);
        expectOperand = true;
        return true;
    };

    // Pushes an operand to the expression, inserting implicit AND if needed
    const pushOperand = (operand: TagExpressionOperand): boolean => {
        if (!expectOperand) {
            // Insert implicit AND between adjacent operands
            if (!pushOperator('AND')) {
                return false;
            }
        }

        expression.push(operand);
        expectOperand = false;
        hasOperand = true;
        return true;
    };

    for (const token of classifiedTokens) {
        if (token.kind === 'operator') {
            if (!pushOperator(token.operator)) {
                return null;
            }
            continue;
        }

        if (token.kind === 'tag') {
            if (token.value === null) {
                if (!pushOperand({ kind: 'requireTagged' })) {
                    return null;
                }
                requireTagged = true;
            } else {
                if (!pushOperand({ kind: 'tag', value: token.value })) {
                    return null;
                }
                positiveTags.add(token.value);
            }
            continue;
        }

        if (token.kind === 'tagNegation') {
            if (token.value === null) {
                if (!pushOperand({ kind: 'untagged' })) {
                    return null;
                }
                includeUntagged = true;
            } else {
                if (!pushOperand({ kind: 'notTag', value: token.value })) {
                    return null;
                }
            }
            continue;
        }

        return null;
    }

    // Validate expression is not incomplete
    if (expectOperand) {
        return null;
    }

    // Pop remaining operators from stack
    while (operatorStack.length > 0) {
        const operator = operatorStack.pop();
        if (!operator) {
            break;
        }
        expression.push({ kind: 'operator', operator });
    }

    // Validate expression has at least one operand
    if (!hasOperand) {
        return null;
    }

    // Validate postfix expression structure (each operator consumes two operands)
    let depth = 0;
    for (const token of expression) {
        if (token.kind === 'operator') {
            if (depth < 2) {
                return null;
            }
            depth -= 1;
        } else {
            depth += 1;
        }
    }

    // Final depth should be exactly 1 (single result)
    if (depth !== 1) {
        return null;
    }

    return {
        expression,
        includeUntagged,
        requireTagged,
        includedTagTokens: Array.from(positiveTags)
    };
};

// Evaluates a postfix tag expression against a file's tags
const evaluateTagExpression = (expression: TagExpressionToken[], lowercaseTags: string[]): boolean => {
    if (expression.length === 0) {
        return true;
    }

    const stack: boolean[] = [];

    const hasTagMatch = (token: string): boolean => {
        for (const tag of lowercaseTags) {
            if (tagMatchesToken(tag, token)) {
                return true;
            }
        }
        return false;
    };

    for (const token of expression) {
        if (token.kind === 'operator') {
            const right = stack.pop();
            const left = stack.pop();
            if (left === undefined || right === undefined) {
                return false;
            }
            stack.push(token.operator === 'AND' ? left && right : left || right);
            continue;
        }

        let value = false;
        if (token.kind === 'tag') {
            value = hasTagMatch(token.value);
        } else if (token.kind === 'notTag') {
            value = !hasTagMatch(token.value);
        } else if (token.kind === 'requireTagged') {
            value = lowercaseTags.length > 0;
        } else if (token.kind === 'untagged') {
            value = lowercaseTags.length === 0;
        }
        stack.push(value);
    }

    return stack.length === 0 ? true : Boolean(stack[stack.length - 1]);
};

// Parses tokens into tag expression mode with OR/AND precedence
const parseTagModeTokens = (classifiedTokens: ClassifiedToken[], excludeTagTokens: string[]): FilterSearchTokens | null => {
    const buildResult = buildTagExpression(classifiedTokens);
    if (!buildResult) {
        return null;
    }

    const { expression, includeUntagged, requireTagged, includedTagTokens } = buildResult;
    const hasInclusions = expression.length > 0;
    const requiresTags = hasInclusions;
    // Check if empty tag array would fail (meaning all clauses require tags)
    const allRequireTags = hasInclusions ? !evaluateTagExpression(expression, []) : false;

    return {
        mode: 'tag',
        expression,
        hasInclusions,
        requiresTags,
        allRequireTags,
        includedTagTokens,
        nameTokens: [],
        tagTokens: includedTagTokens.slice(),
        requireTagged,
        includeUntagged,
        excludeNameTokens: [],
        excludeTagTokens,
        excludeTagged: false
    };
};

// Parses tokens into filter mode with simple AND semantics
const parseFilterModeTokens = (
    classifiedTokens: ClassifiedToken[],
    excludeTagTokens: string[],
    hasUntaggedOperand: boolean
): FilterSearchTokens => {
    const nameTokens: string[] = [];
    const tagTokens: string[] = [];
    const connectorCandidates: string[] = [];
    const excludeNameTokens: string[] = [];
    let requireTagged = false;

    // Extract name and tag tokens, treating operators as potential name tokens
    for (const token of classifiedTokens) {
        switch (token.kind) {
            case 'name':
                nameTokens.push(token.value);
                break;
            case 'nameNegation':
                excludeNameTokens.push(token.value);
                break;
            case 'tag':
                if (token.value) {
                    tagTokens.push(token.value);
                }
                requireTagged = true;
                break;
            case 'operator':
                connectorCandidates.push(token.operator.toLowerCase());
                break;
            case 'tagNegation':
                break;
        }
    }

    // Treat connector words as literal tokens when not in tag mode
    if (connectorCandidates.length > 0) {
        nameTokens.push(...connectorCandidates);
    }

    const hasInclusions = nameTokens.length > 0 || tagTokens.length > 0 || requireTagged;
    const requiresTags = requireTagged || tagTokens.length > 0;
    const allRequireTags = hasInclusions ? requiresTags : false;
    const includedTagTokens = tagTokens.slice();

    return {
        mode: 'filter',
        expression: [],
        hasInclusions,
        requiresTags,
        allRequireTags,
        includedTagTokens,
        nameTokens,
        tagTokens,
        requireTagged,
        includeUntagged: hasUntaggedOperand,
        excludeNameTokens,
        excludeTagTokens,
        excludeTagged: hasUntaggedOperand
    };
};

/**
 * Parse a filter search query into name and tag tokens with support for negations.
 *
 * Inclusion patterns (must match):
 * - #tag - Include notes with tags containing "tag"
 * - # - Include only notes that have at least one tag
 * - word - Include notes with "word" in their name
 *
 * Exclusion patterns (must NOT match):
 * - !#tag - Exclude notes with tags containing "tag"
 * - !# - Exclude all tagged notes (show only untagged)
 * - !word - Exclude notes with "word" in their name
 *
 * Special handling:
 * - AND has higher precedence than OR for inclusion clauses
 * - Adjacent tokens without connectors implicitly use AND
 * - Leading or consecutive connectors are treated as literal text tokens
 * - All tokens are normalized to lowercase for case-insensitive matching
 *
 * @param query - Raw search query from the UI
 * @returns Parsed tokens with include/exclude criteria for filtering
 */
export function parseFilterSearchTokens(query: string): FilterSearchTokens {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return EMPTY_TOKENS;
    }

    const rawTokens = normalized.split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) {
        return EMPTY_TOKENS;
    }

    const classification = classifyRawTokens(rawTokens);
    const { tokens: classifiedTokens } = classification;

    const excludeTagTokens: string[] = [];
    let hasUntaggedOperand = false;
    for (const token of classifiedTokens) {
        if (token.kind !== 'tagNegation') {
            continue;
        }

        if (token.value === null) {
            hasUntaggedOperand = true;
        } else {
            excludeTagTokens.push(token.value);
        }
    }

    if (canUseTagMode(classification)) {
        const tagTokens = parseTagModeTokens(classifiedTokens, excludeTagTokens);
        if (tagTokens) {
            return tagTokens;
        }
    }

    return parseFilterModeTokens(classifiedTokens, excludeTagTokens, hasUntaggedOperand);
}

// Checks if a token is a recognized connector word
const isConnectorToken = (value: string | undefined): boolean => {
    if (!value) {
        return false;
    }
    return CONNECTOR_TOKEN_SET.has(value.toLowerCase());
};

export interface UpdateFilterQueryWithTagResult {
    query: string;
    action: 'added' | 'removed';
    changed: boolean;
}

/**
 * Toggle a normalized tag inside a raw query string, inserting or pruning connectors.
 * Returns the updated query string and whether the operation modified the input.
 */
export function updateFilterQueryWithTag(
    query: string,
    normalizedTag: string,
    operator: InclusionOperator
): UpdateFilterQueryWithTagResult {
    const trimmed = query.trim();
    if (!normalizedTag) {
        return {
            query: trimmed,
            action: 'removed',
            changed: false
        };
    }

    const formattedTag = `#${normalizedTag}`;
    const tokens = trimmed.length > 0 ? trimmed.split(/\s+/) : [];
    const lowerTarget = formattedTag.toLowerCase();
    const removalIndex = tokens.findIndex(token => token.toLowerCase() === lowerTarget);

    if (removalIndex !== -1) {
        const updatedTokens = tokens.slice();
        updatedTokens.splice(removalIndex, 1);

        const precedingIndex = removalIndex - 1;
        if (precedingIndex >= 0 && isConnectorToken(updatedTokens[precedingIndex])) {
            updatedTokens.splice(precedingIndex, 1);
        }

        while (updatedTokens.length > 0 && isConnectorToken(updatedTokens[0])) {
            updatedTokens.shift();
        }

        for (let index = 0; index < updatedTokens.length - 1; index += 1) {
            if (isConnectorToken(updatedTokens[index]) && isConnectorToken(updatedTokens[index + 1])) {
                updatedTokens.splice(index + 1, 1);
                index -= 1;
            }
        }

        while (updatedTokens.length > 0 && isConnectorToken(updatedTokens[updatedTokens.length - 1])) {
            updatedTokens.pop();
        }

        const nextQuery = updatedTokens.join(' ').trim();
        return {
            query: nextQuery,
            action: 'removed',
            changed: nextQuery !== trimmed
        };
    }

    const connector = operator === 'OR' ? 'OR' : 'AND';
    const nextTokens = tokens.slice();

    if (nextTokens.length === 0) {
        nextTokens.push(formattedTag);
    } else if (isConnectorToken(nextTokens[nextTokens.length - 1])) {
        nextTokens[nextTokens.length - 1] = connector;
        nextTokens.push(formattedTag);
    } else {
        nextTokens.push(connector, formattedTag);
    }

    const nextQuery = nextTokens.join(' ').trim();
    return {
        query: nextQuery,
        action: 'added',
        changed: nextQuery !== trimmed
    };
}

/**
 * Check if parsed tokens contain any include or exclude criteria.
 */
export function filterSearchHasActiveCriteria(tokens: FilterSearchTokens): boolean {
    return tokens.hasInclusions || tokens.excludeNameTokens.length > 0 || tokens.excludeTagTokens.length > 0 || tokens.excludeTagged;
}

/**
 * Check if evaluating the parsed tokens requires file tag metadata.
 */
export function filterSearchNeedsTagLookup(tokens: FilterSearchTokens): boolean {
    return tokens.requiresTags || tokens.excludeTagged || tokens.excludeTagTokens.length > 0;
}

/**
 * Check if every matching clause requires tagged files.
 */
export function filterSearchRequiresTagsForEveryMatch(tokens: FilterSearchTokens): boolean {
    return tokens.hasInclusions && tokens.allRequireTags;
}

/**
 * Check if a file matches parsed filter search tokens.
 *
 * Filtering logic:
 * - Inclusion clauses are evaluated with AND semantics; the file must satisfy every token inside a clause
 * - If any clause matches, the file is accepted (OR across clauses)
 * - All exclusion tokens (!name, !#tag) are ANDed - file must match NONE
 * - Tag requirements (# or !#) control whether tagged/untagged notes are shown
 *
 * @param lowercaseName - File display name in lowercase
 * @param lowercaseTags - File tags in lowercase
 * @param tokens - Parsed query tokens with include/exclude criteria
 * @returns True when the file passes all filter criteria
 */
export function fileMatchesFilterTokens(lowercaseName: string, lowercaseTags: string[], tokens: FilterSearchTokens): boolean {
    if (tokens.mode === 'filter') {
        if (tokens.excludeNameTokens.length > 0) {
            const hasExcludedName = tokens.excludeNameTokens.some(token => lowercaseName.includes(token));
            if (hasExcludedName) {
                return false;
            }
        }

        if (tokens.excludeTagged) {
            if (lowercaseTags.length > 0) {
                return false;
            }
        } else if (tokens.excludeTagTokens.length > 0 && lowercaseTags.length > 0) {
            const hasExcludedTag = tokens.excludeTagTokens.some(token => lowercaseTags.some(tag => tagMatchesToken(tag, token)));
            if (hasExcludedTag) {
                return false;
            }
        }

        if (tokens.nameTokens.length > 0) {
            const matchesName = tokens.nameTokens.every(token => lowercaseName.includes(token));
            if (!matchesName) {
                return false;
            }
        }

        if (tokens.requireTagged || tokens.tagTokens.length > 0) {
            if (lowercaseTags.length === 0) {
                return false;
            }
            if (tokens.tagTokens.length > 0) {
                const matchesTags = tokens.tagTokens.every(token => lowercaseTags.some(tag => tagMatchesToken(tag, token)));
                if (!matchesTags) {
                    return false;
                }
            }
        }

        return true;
    }

    if (tokens.excludeTagged) {
        if (lowercaseTags.length > 0) {
            return false;
        }
    }

    if (tokens.expression.length === 0) {
        return true;
    }

    return evaluateTagExpression(tokens.expression, lowercaseTags);
}
