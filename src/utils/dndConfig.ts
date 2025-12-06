import { closestCenter, type CollisionDetection, type Modifier } from '@dnd-kit/core';

export const verticalAxisOnly: Modifier = ({ transform }) => {
    return {
        ...transform,
        x: 0
    };
};

/**
 * Collision detection that filters droppable containers by type.
 * Containers must have `data: { type: string }` set via useSortable.
 * Only containers matching the active item's type are considered.
 */
export const typeFilteredCollisionDetection: CollisionDetection = args => {
    const activeType = args.active?.data?.current?.type as string | undefined;

    if (!activeType) {
        return closestCenter(args);
    }

    const filteredContainers = args.droppableContainers.filter(container => container.data.current?.type === activeType);

    return closestCenter({
        ...args,
        droppableContainers: filteredContainers
    });
};

export const SHORTCUT_POINTER_CONSTRAINT = { distance: 6 };
export const ROOT_REORDER_MOUSE_CONSTRAINT = { distance: 6 };
export const ROOT_REORDER_TOUCH_CONSTRAINT = { distance: 6 };
