interface TagDragPayload {
    canonicalPath?: unknown;
    displayPath?: unknown;
}

// Determines if a value is a non-empty string
function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

// Filters array to include only non-empty strings
function filterStringArray(values: unknown[]): string[] {
    const filtered: string[] = [];
    for (const value of values) {
        if (isNonEmptyString(value)) {
            filtered.push(value);
        }
    }
    return filtered;
}

/**
 * Parses the Obsidian multi-file drag payload and returns all non-empty file paths.
 * Returns null if the payload is malformed or contains no usable paths.
 * Internal helper - not exported to prevent unused exports
 */
function parseObsidianFilesPayload(payload: string): string[] | null {
    const trimmed = payload.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            const paths = filterStringArray(parsed);
            return paths.length > 0 ? paths : null;
        }
        console.error('Invalid obsidian/files payload: expected array');
        return null;
    } catch (error) {
        console.error('Error parsing obsidian/files payload', error);
        return null;
    }
}

/**
 * Extracts file paths from a DataTransfer instance by checking the Obsidian-specific
 * payloads for single and multiple files. Returns null when no valid paths are found.
 */
export function extractFilePathsFromDataTransfer(dataTransfer: DataTransfer | null): string[] | null {
    if (!dataTransfer) {
        return null;
    }

    const multiPayload = dataTransfer.getData('obsidian/files');
    if (isNonEmptyString(multiPayload)) {
        const parsed = parseObsidianFilesPayload(multiPayload);
        if (parsed && parsed.length > 0) {
            return parsed;
        }
    }

    // Desktop builds omit obsidian/files when only one item is dragged, so we must
    // always check the single-item payload even if the multi entry existed.
    const singlePayload = dataTransfer.getData('obsidian/file');
    if (isNonEmptyString(singlePayload)) {
        return [singlePayload];
    }

    return null;
}

/**
 * Parses tag drag payloads originating from Obsidian's tag tree.
 * Accepts legacy string payloads or structured JSON with canonical/display paths.
 */
export function parseTagDragPayload(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (isNonEmptyString(parsed)) {
            return parsed;
        }
        if (parsed && typeof parsed === 'object') {
            const payload = parsed as TagDragPayload;
            const canonical = isNonEmptyString(payload.canonicalPath) ? payload.canonicalPath : null;
            const display = isNonEmptyString(payload.displayPath) ? payload.displayPath : null;
            if (canonical) {
                return canonical;
            }
            if (display) {
                return display;
            }
            return null;
        }
    } catch {
        return trimmed;
    }

    return null;
}
