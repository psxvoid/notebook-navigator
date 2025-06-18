import { useCallback } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';

export function useVirtualScroller() {
    const scrollTo = useCallback((
        virtualizer: Virtualizer<any, any> | null | undefined, 
        index: number,
        align: 'auto' | 'start' | 'center' | 'end' = 'center'
    ) => {
        if (!virtualizer || index < 0) return;

        // Using a double requestAnimationFrame is the most robust way to ensure
        // the browser has completed layout and paint cycles before scrolling,
        // which is critical on mobile. This is a standard pattern for
        // solving this exact type of race condition without timers.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                virtualizer.scrollToIndex(index, {
                    align: align,
                    behavior: 'auto'
                });
            });
        });
    }, []);

    return { scrollTo };
}