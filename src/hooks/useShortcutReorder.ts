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

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { SHORTCUT_DRAG_MIME } from '../types/shortcuts';

interface ShortcutDescriptor {
    key: string;
}

export interface ShortcutDragHandlers {
    draggable: boolean;
    onDragStart: (event: DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
    onDrop: (event: DragEvent<HTMLDivElement>) => void;
    onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
}

interface UseShortcutReorderParams<T extends ShortcutDescriptor> {
    shortcuts: T[];
    isEnabled: boolean;
    reorderShortcuts: (orderedKeys: string[]) => Promise<boolean>;
}

interface UseShortcutReorderResult {
    getDragHandlers: (key: string) => ShortcutDragHandlers;
    dropIndex: number | null;
    draggingKey: string | null;
}

function noopHandler() {
    // Intentionally empty - used when drag and drop is disabled
}

export function useShortcutReorder<T extends ShortcutDescriptor>({
    shortcuts,
    isEnabled,
    reorderShortcuts
}: UseShortcutReorderParams<T>): UseShortcutReorderResult {
    const [draggingKey, setDraggingKey] = useState<string | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);

    const shortcutOrder = useMemo(() => shortcuts.map(shortcut => shortcut.key), [shortcuts]);

    const keyToIndex = useMemo(() => {
        const indexMap = new Map<string, number>();
        shortcutOrder.forEach((key, index) => {
            indexMap.set(key, index);
        });
        return indexMap;
    }, [shortcutOrder]);

    const resetDragState = useCallback(() => {
        setDraggingKey(null);
        setDropIndex(null);
    }, []);

    useEffect(() => {
        if (!isEnabled) {
            resetDragState();
        }
    }, [isEnabled, resetDragState]);

    useEffect(() => {
        if (!draggingKey) {
            return;
        }
        if (!keyToIndex.has(draggingKey)) {
            resetDragState();
        }
    }, [draggingKey, keyToIndex, resetDragState]);

    useEffect(() => {
        if (shortcuts.length < 2) {
            resetDragState();
        }
    }, [shortcuts.length, resetDragState]);

    const computeInsertIndex = useCallback(
        (event: DragEvent<HTMLDivElement>, targetKey: string) => {
            if (!draggingKey) {
                return null;
            }

            const targetIndex = keyToIndex.get(targetKey);
            if (targetIndex === undefined) {
                return null;
            }

            const element = event.currentTarget;
            const bounds = element.getBoundingClientRect();
            const offset = event.clientY - bounds.top;
            const shouldInsertBefore = offset < bounds.height / 2;

            const proposedIndex = shouldInsertBefore ? targetIndex : targetIndex + 1;
            return Math.max(0, Math.min(proposedIndex, shortcutOrder.length));
        },
        [draggingKey, keyToIndex, shortcutOrder.length]
    );

    const finalizeReorder = useCallback(
        async (targetIndex: number | null) => {
            if (draggingKey === null) {
                return;
            }
            if (targetIndex === null) {
                return;
            }

            const fromIndex = keyToIndex.get(draggingKey);
            if (fromIndex === undefined) {
                return;
            }

            let insertIndex = Math.max(0, Math.min(targetIndex, shortcutOrder.length));

            if (fromIndex === insertIndex || fromIndex + 1 === insertIndex) {
                return;
            }

            const nextOrder = [...shortcutOrder];
            const [moved] = nextOrder.splice(fromIndex, 1);
            if (fromIndex < insertIndex) {
                insertIndex -= 1;
            }
            nextOrder.splice(insertIndex, 0, moved);

            let changed = false;
            for (let index = 0; index < nextOrder.length; index += 1) {
                if (nextOrder[index] !== shortcutOrder[index]) {
                    changed = true;
                    break;
                }
            }

            if (!changed) {
                return;
            }

            try {
                const success = await reorderShortcuts(nextOrder);
                if (!success) {
                    console.warn('Shortcut reorder returned false, no changes applied');
                }
            } catch (error) {
                console.error('Failed to reorder shortcuts', error);
            }
        },
        [draggingKey, keyToIndex, reorderShortcuts, shortcutOrder]
    );

    const handleDragStart = useCallback(
        (event: DragEvent<HTMLDivElement>, key: string) => {
            if (!isEnabled) {
                return;
            }

            try {
                event.dataTransfer.setData(SHORTCUT_DRAG_MIME, key);
                event.dataTransfer.setData('text/plain', key);
            } catch (error) {
                console.debug('Drag dataTransfer setData failed', error);
            }
            event.dataTransfer.effectAllowed = 'move';
            setDraggingKey(key);
            setDropIndex(keyToIndex.get(key) ?? null);
        },
        [isEnabled, keyToIndex]
    );

    const handleDragOver = useCallback(
        (event: DragEvent<HTMLDivElement>, key: string) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const nextIndex = computeInsertIndex(event, key);
            if (nextIndex === null) {
                setDropIndex(null);
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';

            if (dropIndex !== nextIndex) {
                setDropIndex(nextIndex);
            }
        },
        [computeInsertIndex, dropIndex, draggingKey, isEnabled]
    );

    const handleDrop = useCallback(
        async (event: DragEvent<HTMLDivElement>, key: string) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const targetIndex = computeInsertIndex(event, key);
            event.preventDefault();
            event.stopPropagation();

            await finalizeReorder(targetIndex);
            resetDragState();
        },
        [computeInsertIndex, draggingKey, finalizeReorder, isEnabled, resetDragState]
    );

    const handleDragLeave = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const relatedTarget = event.relatedTarget as HTMLElement | null;
            if (!relatedTarget) {
                setDropIndex(null);
                return;
            }

            if (event.currentTarget.contains(relatedTarget)) {
                return;
            }

            if (relatedTarget.closest('[data-shortcut-draggable="true"]')) {
                return;
            }

            setDropIndex(null);
        },
        [draggingKey, isEnabled, setDropIndex]
    );

    const handleDragEnd = useCallback(() => {
        if (!draggingKey) {
            return;
        }
        resetDragState();
    }, [draggingKey, resetDragState]);

    const disabledHandlers = useMemo<ShortcutDragHandlers>(
        () => ({
            draggable: false,
            onDragStart: noopHandler,
            onDragOver: noopHandler,
            onDragLeave: noopHandler,
            onDrop: noopHandler,
            onDragEnd: noopHandler
        }),
        []
    );

    const getDragHandlers = useCallback(
        (key: string): ShortcutDragHandlers => {
            if (!isEnabled) {
                return disabledHandlers;
            }

            return {
                draggable: true,
                onDragStart: event => handleDragStart(event, key),
                onDragOver: event => handleDragOver(event, key),
                onDragLeave: handleDragLeave,
                onDrop: event => void handleDrop(event, key),
                onDragEnd: handleDragEnd
            };
        },
        [disabledHandlers, handleDragEnd, handleDragLeave, handleDragOver, handleDragStart, handleDrop, isEnabled]
    );

    return {
        getDragHandlers,
        dropIndex,
        draggingKey
    };
}
