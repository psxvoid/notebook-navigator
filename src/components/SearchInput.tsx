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

import React, { useEffect, useRef } from 'react';
import { ObsidianIcon } from './ObsidianIcon';
import { useUIDispatch, useUIState } from '../context/UIStateContext';
import { useServices } from '../context/ServicesContext';
import { strings } from '../i18n';

interface SearchInputProps {
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    onClose: () => void;
    onFocusFiles?: () => void;
    shouldFocus?: boolean;
    onFocusComplete?: () => void;
}

export function SearchInput({ searchQuery, onSearchQueryChange, onClose, onFocusFiles, shouldFocus, onFocusComplete }: SearchInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { isMobile } = useServices();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

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

    // Handle keyboard navigation
    // Mobile: Escape closes, Enter moves focus to list (hides keyboard) but doesn't select
    // Desktop: Escape closes, Enter/Tab move to file list, Shift+Tab to nav pane
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();

            // Return focus to files pane and focus the scroll container
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });

            setTimeout(() => {
                const listPaneScroller = document.querySelector('.nn-list-pane-scroller');
                if (listPaneScroller instanceof HTMLElement) {
                    listPaneScroller.focus();
                }
            }, 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });

            if (!isMobile) {
                // Desktop: Handle file selection and focus the list
                if (onFocusFiles) {
                    onFocusFiles();
                }

                // Focus the list pane scroller to enable keyboard navigation
                setTimeout(() => {
                    const listPaneScroller = document.querySelector('.nn-list-pane-scroller');
                    if (listPaneScroller instanceof HTMLElement) {
                        listPaneScroller.focus();
                    }
                }, 0);
            } else {
                // Mobile: Just focus the list to hide keyboard (no file selection)
                setTimeout(() => {
                    const listPaneScroller = document.querySelector('.nn-list-pane-scroller');
                    if (listPaneScroller instanceof HTMLElement) {
                        listPaneScroller.focus();
                    }
                }, 0);
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();

            if (e.shiftKey && !uiState.singlePane && !isMobile) {
                // Shift+Tab: Move focus to navigation pane (only in dual pane desktop mode)
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
            } else if (!isMobile) {
                // Tab: Move focus to files pane (desktop only)
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });

                // Handle file selection and focus the list
                if (onFocusFiles) {
                    onFocusFiles();
                }

                // Focus the list pane scroller to enable keyboard navigation
                setTimeout(() => {
                    const listPaneScroller = document.querySelector('.nn-list-pane-scroller');
                    if (listPaneScroller instanceof HTMLElement) {
                        listPaneScroller.focus();
                    }
                }, 0);
            }
            // On mobile, Tab does nothing (stays in search field)
        }
    };

    // Set focus state to search when clicking on search field
    const handleSearchClick = () => {
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
    };

    return (
        <div className="nn-search-input-wrapper">
            <div className="nn-search-input-container">
                <ObsidianIcon name="lucide-search" className="nn-search-input-icon" />
                <input
                    ref={inputRef}
                    type="search"
                    className={`nn-search-input ${searchQuery ? 'nn-search-active' : ''}`}
                    placeholder={strings.searchInput.placeholder}
                    spellCheck={false}
                    enterKeyHint="search"
                    value={searchQuery}
                    onChange={e => onSearchQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onClick={handleSearchClick}
                />
                {searchQuery && (
                    <div
                        className="nn-search-clear-button"
                        onClick={() => {
                            onSearchQueryChange('');
                            // Keep focus in the search field after clearing
                            inputRef.current?.focus();
                        }}
                        aria-label={strings.searchInput.clearSearch}
                    >
                        <ObsidianIcon name="lucide-circle-x" />
                    </div>
                )}
            </div>
        </div>
    );
}
