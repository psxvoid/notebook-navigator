import { useEffect } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';

interface UseVirtualScrollIntoViewProps<T> {
    itemPath: string | null;
    items: Array<{ path?: string; key: string }>;
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    isActive: boolean;
}

/**
 * Custom hook for scrolling to a specific item in a virtualized list.
 * Replaces the DOM-based useScrollIntoView for virtual lists.
 */
export function useVirtualScrollIntoView<T extends { path?: string; key: string }>({
    itemPath,
    items,
    virtualizer,
    isActive
}: UseVirtualScrollIntoViewProps<T>) {
    useEffect(() => {
        if (!isActive || !itemPath) return;
        
        // Find the index of the item to scroll to
        const index = items.findIndex(item => {
            // Check if item has a path property
            if ('path' in item && item.path) {
                return item.path === itemPath;
            }
            // For items without path, check the key
            return item.key === itemPath;
        });
        
        if (index >= 0) {
            // Use double RAF for proper timing after DOM updates
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    virtualizer.scrollToIndex(index, {
                        align: 'center',
                        behavior: 'smooth'
                    });
                });
            });
        }
    }, [itemPath, items, virtualizer, isActive]);
}