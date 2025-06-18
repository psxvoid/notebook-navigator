import { useCallback } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';

export function useVirtualScroller() {
    const scrollTo = useCallback((
        virtualizer: Virtualizer<any, any> | null | undefined, 
        index: number,
        align: 'auto' | 'start' | 'center' | 'end' = 'center'
    ) => {
        if (!virtualizer || index < 0) return;

        // Use setTimeout with a delay of 0. This pushes the scroll command to the
        // end of the event queue, ensuring it runs after React has finished its
        // current render and the DOM has been updated. This is a robust way to
        // handle scrolling immediately after a state change without a visible delay.
        setTimeout(() => {
            try {
                virtualizer.scrollToIndex(index, {
                    align: align,
                    behavior: 'auto'
                });
            } catch (e) {
                // Silently ignore scroll errors - they can occur during rapid state changes
            }
        }, 0);

    }, []);

    return { scrollTo };
}