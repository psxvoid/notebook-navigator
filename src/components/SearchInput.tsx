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

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ObsidianIcon } from './ObsidianIcon';
import { useUIDispatch, useUIState } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { useServices } from '../context/ServicesContext';
import { strings } from '../i18n';
import { matchesShortcut, KeyboardShortcutAction } from '../utils/keyboardShortcuts';
import { runAsyncAction, type MaybePromise } from '../utils/async';
import { SearchTagInputSuggest } from '../suggest/SearchTagInputSuggest';
import type { SearchProvider } from '../types/search';

interface SearchInputProps {
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    onClose: () => void;
    onFocusFiles?: () => void;
    shouldFocus?: boolean;
    onFocusComplete?: () => void;
    /** Root container to scope DOM queries within this navigator instance */
    containerRef?: React.RefObject<HTMLDivElement | null>;
    onSaveShortcut?: () => MaybePromise;
    onRemoveShortcut?: () => MaybePromise;
    isShortcutSaved?: boolean;
    isShortcutDisabled?: boolean;
    searchProvider?: SearchProvider;
}

export function SearchInput({
    searchQuery,
    onSearchQueryChange,
    onClose,
    onFocusFiles,
    shouldFocus,
    onFocusComplete,
    containerRef,
    onSaveShortcut,
    onRemoveShortcut,
    isShortcutSaved,
    isShortcutDisabled,
    searchProvider
}: SearchInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const tagSuggestRef = useRef<SearchTagInputSuggest | null>(null);
    const { isMobile, omnisearchService, app, tagTreeService } = useServices();
    const settings = useSettingsState();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

    const placeholderText = useMemo(() => {
        const activeProvider = searchProvider ?? settings.searchProvider ?? 'internal';
        const isOmnisearchSelected = activeProvider === 'omnisearch';
        const isOmnisearchAvailable = omnisearchService?.isAvailable() ?? false;

        if (isOmnisearchSelected && isOmnisearchAvailable) {
            return strings.searchInput.placeholderOmnisearch;
        }

        return strings.searchInput.placeholder;
    }, [searchProvider, settings.searchProvider, omnisearchService]);

    // Auto-focus input when shouldFocus is true
    useEffect(() => {
        if (shouldFocus) {
            inputRef.current?.focus();
            // Reset the focus flag after focusing
            if (onFocusComplete) {
                onFocusComplete();
            }
        }
    }, [shouldFocus, onFocusComplete]);

    const applyTagSuggestion = useCallback(
        (value: string, cursor: number) => {
            onSearchQueryChange(value);
            requestAnimationFrame(() => {
                const input = inputRef.current;
                if (!input) {
                    return;
                }
                input.focus();
                input.setSelectionRange(cursor, cursor);
            });
        },
        [onSearchQueryChange]
    );

    // Initialize Obsidian's tag suggest helper on the search input
    useEffect(() => {
        if (!settings.showTags) {
            return;
        }

        const inputEl = inputRef.current;
        if (!inputEl || !tagTreeService) {
            return;
        }

        const suggest = new SearchTagInputSuggest(app, inputEl, {
            getTags: () => tagTreeService.getFlattenedTagNodes() ?? [],
            onApply: applyTagSuggestion,
            isMobile
        });
        tagSuggestRef.current = suggest;
        return () => {
            tagSuggestRef.current = null;
            suggest.dispose();
        };
    }, [app, tagTreeService, settings.showTags, applyTagSuggestion, isMobile]);

    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            return;
        }
        tagSuggestRef.current?.close();
    }, [searchQuery]);

    /**
     * Focuses the list pane scroll container to enable keyboard navigation.
     * Used after closing search or switching focus away from search input.
     */
    const focusListPane = () => {
        setTimeout(() => {
            const scope = containerRef?.current ?? document;
            const listPaneScroller = scope.querySelector('.nn-list-pane-scroller');
            if (listPaneScroller instanceof HTMLElement) {
                listPaneScroller.focus();
            }
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const nativeEvent = e.nativeEvent;
        const shortcuts = settings.keyboardShortcuts;
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- keyCode=229 is still needed for legacy IME detection
        const isImeComposing = nativeEvent.isComposing || nativeEvent.keyCode === 229;

        if (isImeComposing) {
            return;
        }

        if (matchesShortcut(nativeEvent, shortcuts, KeyboardShortcutAction.SEARCH_CLOSE)) {
            e.preventDefault();
            onClose();
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            focusListPane();
            return;
        }

        if (matchesShortcut(nativeEvent, shortcuts, KeyboardShortcutAction.SEARCH_FOCUS_NAVIGATION)) {
            if (!uiState.singlePane && !isMobile) {
                e.preventDefault();
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
            }
            return;
        }

        if (matchesShortcut(nativeEvent, shortcuts, KeyboardShortcutAction.SEARCH_FOCUS_LIST)) {
            e.preventDefault();
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });

            if (isMobile) {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                focusListPane();
                return;
            }

            if (onFocusFiles) {
                onFocusFiles();
            }

            focusListPane();
        }
    };

    // Set focus state to search when clicking on search field
    const handleSearchClick = () => {
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
    };

    // Determine if shortcut save/remove button should be shown and its state
    const hasQuery = searchQuery.trim().length > 0;
    const showShortcutButton = hasQuery && Boolean(onSaveShortcut || (isShortcutSaved && onRemoveShortcut));
    const shortcutButtonDisabled = isShortcutDisabled || (!isShortcutSaved && !onSaveShortcut) || (isShortcutSaved && !onRemoveShortcut);

    return (
        <div className="nn-search-input-wrapper">
            <div className="nn-search-input-container">
                <ObsidianIcon name="lucide-search" className="nn-search-input-icon" />
                <input
                    ref={inputRef}
                    type="search"
                    className={`nn-search-input ${searchQuery ? 'nn-search-active' : ''}`}
                    placeholder={placeholderText}
                    spellCheck={false}
                    enterKeyHint="search"
                    value={searchQuery}
                    onChange={e => onSearchQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onClick={handleSearchClick}
                />
                {/* Star button to save/remove search as shortcut */}
                {showShortcutButton && (
                    <div
                        className={`nn-search-star-button ${isShortcutSaved ? 'nn-search-star-button--active' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label={isShortcutSaved ? strings.searchInput.removeSearchShortcut : strings.searchInput.saveSearchShortcut}
                        aria-pressed={isShortcutSaved || false}
                        onClick={() => {
                            if (shortcutButtonDisabled) {
                                return;
                            }
                            const action = isShortcutSaved ? onRemoveShortcut : onSaveShortcut;
                            if (action) {
                                runAsyncAction(action);
                            }
                            inputRef.current?.focus();
                        }}
                        onKeyDown={event => {
                            if ((event.key === 'Enter' || event.key === ' ') && !shortcutButtonDisabled) {
                                event.preventDefault();
                                const action = isShortcutSaved ? onRemoveShortcut : onSaveShortcut;
                                if (action) {
                                    runAsyncAction(action);
                                }
                                inputRef.current?.focus();
                            }
                        }}
                    >
                        <ObsidianIcon name="lucide-bookmark" />
                    </div>
                )}
                {hasQuery && (
                    <div
                        className="nn-search-clear-button"
                        role="button"
                        tabIndex={0}
                        aria-label={strings.searchInput.clearSearch}
                        onClick={() => {
                            onSearchQueryChange('');
                            inputRef.current?.focus();
                        }}
                        onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onSearchQueryChange('');
                                inputRef.current?.focus();
                            }
                        }}
                    >
                        <ObsidianIcon name="lucide-circle-x" />
                    </div>
                )}
            </div>
        </div>
    );
}
