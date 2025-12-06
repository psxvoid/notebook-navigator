import type { Modifier } from '@dnd-kit/core';

export const verticalAxisOnly: Modifier = ({ transform }) => {
    return {
        ...transform,
        x: 0
    };
};

export const SHORTCUT_POINTER_CONSTRAINT = { distance: 6 };
export const ROOT_REORDER_MOUSE_CONSTRAINT = { distance: 6 };
export const ROOT_REORDER_TOUCH_CONSTRAINT = { distance: 6 };
