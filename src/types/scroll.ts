// Shared scroll types and helpers

export type Align = 'auto' | 'center' | 'start' | 'end';

// Navigation pane scroll intents
export type NavScrollIntent = 'selection' | 'startup' | 'reveal' | 'visibilityToggle' | 'external' | 'mobile-visibility';

// List pane scroll intents
export type ListScrollIntent = 'folder-navigation' | 'visibility-change' | 'reveal' | 'list-config-change';

// Determine alignment for navigation pane based on intent and explicit override
export function getNavAlign(intent?: NavScrollIntent): Align {
    switch (intent) {
        case 'visibilityToggle':
        case 'mobile-visibility':
            return 'auto';
        case 'selection':
            return Platform.isMobile ? 'center' : 'auto';
        case 'reveal':
        case 'external':
            return 'auto';
        default:
            return 'center';
    }
}

import { Platform } from 'obsidian';

// Determine alignment for list pane based on intent and platform
export function getListAlign(reason?: ListScrollIntent): Align {
    switch (reason) {
        case 'folder-navigation':
            return Platform.isMobile ? 'center' : 'auto';
        case 'visibility-change':
            return 'auto';
        case 'list-config-change':
            return 'auto';
        case 'reveal':
        default:
            return 'auto';
    }
}

// Rank list pane pending requests for simple coalescing
export function rankListPending(p?: { type: 'file' | 'top'; reason?: ListScrollIntent }): number {
    if (!p) return -1;
    if (p.type === 'top') return 0;
    switch (p.reason) {
        case 'list-config-change':
            return 1; // Maintain position after list settings changes
        case 'visibility-change':
            return 2; // Pane became visible on mobile
        case 'folder-navigation':
            return 3; // User navigated to a different folder/tag
        case 'reveal':
            return 4; // Explicit reveal of active file
        default:
            return 1;
    }
}
