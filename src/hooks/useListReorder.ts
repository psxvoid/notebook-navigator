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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { SHORTCUT_DRAG_MIME } from '../types/shortcuts';

interface ReorderItemDescriptor {
    key: string;
}

export interface ListReorderHandlers {
    draggable: boolean;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: (event: DragEvent<HTMLElement>) => void;
}

interface UseListReorderParams<T extends ReorderItemDescriptor> {
    items: T[];
    isEnabled: boolean;
    reorderItems: (orderedKeys: string[]) => Promise<boolean>;
}

interface UseListReorderResult {
    getDragHandlers: (key: string) => ListReorderHandlers;
    dropIndex: number | null;
    draggingKey: string | null;
}

function noopHandler() {
    // Intentionally empty - used when drag and drop is disabled
}

/**
 * Hook that manages drag and drop reordering of navigation lists.
 * Returns drag handlers and current drag state for visual feedback.
 */
export function useListReorder<T extends ReorderItemDescriptor>({
    items,
    isEnabled,
    reorderItems
}: UseListReorderParams<T>): UseListReorderResult {
    const [draggingKey, setDraggingKey] = useState<string | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    // Timeout reference for deferred drop index clearing
    const dropClearTimeoutRef = useRef<number | null>(null);

    // Cancel any pending drop index clear operation
    const clearDeferredDropIndex = useCallback(() => {
        if (dropClearTimeoutRef.current !== null) {
            window.clearTimeout(dropClearTimeoutRef.current);
            dropClearTimeoutRef.current = null;
        }
    }, []);

    // Schedule a delayed clearing of drop index to avoid flicker during drag operations
    const scheduleDropIndexClear = useCallback(() => {
        clearDeferredDropIndex();
        dropClearTimeoutRef.current = window.setTimeout(() => {
            setDropIndex(null);
            dropClearTimeoutRef.current = null;
        }, 60);
    }, [clearDeferredDropIndex]);

    // Extract ordered list of shortcut keys from the shortcuts array
    const itemOrder = useMemo(() => items.map(item => item.key), [items]);

    // Build a map of shortcut keys to their current index for fast lookup
    const keyToIndex = useMemo(() => {
        const indexMap = new Map<string, number>();
        itemOrder.forEach((key, index) => {
            indexMap.set(key, index);
        });
        return indexMap;
    }, [itemOrder]);

    // Reset all drag-related state to initial values
    const resetDragState = useCallback(() => {
        setDraggingKey(null);
        setDropIndex(null);
        clearDeferredDropIndex();
    }, [clearDeferredDropIndex]);

    // Clean up any pending timeouts on unmount
    useEffect(() => {
        return () => {
            clearDeferredDropIndex();
        };
    }, [clearDeferredDropIndex]);

    // Clear drag state when drag and drop is disabled
    useEffect(() => {
        if (!isEnabled) {
            resetDragState();
        }
    }, [isEnabled, resetDragState]);

    // Clear drag state if the dragged shortcut is no longer in the list
    useEffect(() => {
        if (!draggingKey) {
            return;
        }
        if (!keyToIndex.has(draggingKey)) {
            resetDragState();
        }
    }, [draggingKey, keyToIndex, resetDragState]);

    // Disable drag and drop when there are fewer than 2 shortcuts
    useEffect(() => {
        if (items.length < 2) {
            resetDragState();
        }
    }, [items.length, resetDragState]);

    // Calculate where to insert the dragged item based on mouse position
    const computeInsertIndex = useCallback(
        (event: DragEvent<HTMLElement>, targetKey: string) => {
            if (!draggingKey) {
                return null;
            }

            const targetIndex = keyToIndex.get(targetKey);
            if (targetIndex === undefined) {
                return null;
            }

            // Determine if drop is in top or bottom half of target element
            const element = event.currentTarget;
            const bounds = element.getBoundingClientRect();
            const offset = event.clientY - bounds.top;
            const shouldInsertBefore = offset < bounds.height / 2;

            const proposedIndex = shouldInsertBefore ? targetIndex : targetIndex + 1;
            return Math.max(0, Math.min(proposedIndex, itemOrder.length));
        },
        [draggingKey, keyToIndex, itemOrder.length]
    );

    // Apply the reorder operation and update settings
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

            let insertIndex = Math.max(0, Math.min(targetIndex, itemOrder.length));

            // Skip reorder if item would end up in the same position
            if (fromIndex === insertIndex || fromIndex + 1 === insertIndex) {
                return;
            }

            // Build new order array with the moved item in its new position
            const nextOrder = [...itemOrder];
            const [moved] = nextOrder.splice(fromIndex, 1);
            if (fromIndex < insertIndex) {
                insertIndex -= 1;
            }
            nextOrder.splice(insertIndex, 0, moved);

            // Check if the order actually changed
            let changed = false;
            for (let index = 0; index < nextOrder.length; index += 1) {
                if (nextOrder[index] !== itemOrder[index]) {
                    changed = true;
                    break;
                }
            }

            if (!changed) {
                return;
            }

            try {
                const success = await reorderItems(nextOrder);
                if (!success) {
                    console.warn('List reorder returned false, no changes applied');
                }
            } catch (error) {
                console.error('Failed to reorder list', error);
            }
        },
        [draggingKey, keyToIndex, reorderItems, itemOrder]
    );

    // Initialize drag operation and set dragging state
    const handleDragStart = useCallback(
        (event: DragEvent<HTMLElement>, key: string) => {
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

    // Update drop indicator position as drag moves over elements
    const handleDragOver = useCallback(
        (event: DragEvent<HTMLElement>, key: string) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const nextIndex = computeInsertIndex(event, key);
            if (nextIndex === null) {
                scheduleDropIndexClear();
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';

            clearDeferredDropIndex();
            if (dropIndex !== nextIndex) {
                setDropIndex(nextIndex);
            }
        },
        [clearDeferredDropIndex, computeInsertIndex, dropIndex, draggingKey, isEnabled, scheduleDropIndexClear]
    );

    // Complete the drag operation and reorder shortcuts
    const handleDrop = useCallback(
        async (event: DragEvent<HTMLElement>, key: string) => {
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

    // Clear drop indicator when drag leaves the valid drop zone
    const handleDragLeave = useCallback(
        (event: DragEvent<HTMLElement>) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const relatedTarget = event.relatedTarget as HTMLElement | null;
            if (!relatedTarget) {
                scheduleDropIndexClear();
                return;
            }

            if (event.currentTarget.contains(relatedTarget)) {
                return;
            }

            if (relatedTarget.closest('[data-reorder-draggable="true"]')) {
                return;
            }

            scheduleDropIndexClear();
        },
        [draggingKey, isEnabled, scheduleDropIndexClear]
    );

    // Clean up drag state when drag operation ends
    const handleDragEnd = useCallback(() => {
        if (!draggingKey) {
            return;
        }
        resetDragState();
    }, [draggingKey, resetDragState]);

    // No-op handlers used when drag and drop is disabled
    const disabledHandlers = useMemo<ListReorderHandlers>(
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

    // Factory function to create drag handlers for a specific shortcut
    const getDragHandlers = useCallback(
        (key: string): ListReorderHandlers => {
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
