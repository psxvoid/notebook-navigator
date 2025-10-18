import type { NoteCountInfo } from '../types/noteCounts';

export interface NoteCountDisplay {
    /** Whether the count should be rendered */
    shouldDisplay: boolean;
    /** Text representation for the count badge */
    label: string;
}

/**
 * Builds a formatted note-count label for folders, tags, and shortcuts.
 * Handles separate current/descendant formatting and hides zero values.
 */
export function buildNoteCountDisplay(
    countInfo: NoteCountInfo | undefined,
    includeDescendants: boolean,
    useSeparateCounts: boolean
): NoteCountDisplay {
    // Ensure counts are non-negative with fallback to zero
    const current = Math.max(0, countInfo?.current ?? 0);
    const descendants = includeDescendants ? Math.max(0, countInfo?.descendants ?? 0) : 0;
    const total = current + descendants;

    // Handle separate count display format (e.g., "2 ▾ 5" for 2 current, 5 descendants)
    if (useSeparateCounts && includeDescendants) {
        let label = '';
        if (current === 0 && descendants === 0) {
            // No notes at all - hide the count
            label = '';
        } else if (descendants === 0) {
            // Only current notes, no descendants
            label = `${current}`;
        } else if (current === 0) {
            // Only descendant notes, no current ones
            label = `▾ ${descendants}`;
        } else {
            // Both current and descendant notes
            label = `${current} ▾ ${descendants}`;
        }

        return {
            shouldDisplay: label.length > 0,
            label
        };
    }

    // Handle combined count display format (single number)
    const combinedCount = includeDescendants ? total : current;
    const shouldDisplay = combinedCount > 0;

    return {
        shouldDisplay,
        label: shouldDisplay ? `${combinedCount}` : ''
    };
}
