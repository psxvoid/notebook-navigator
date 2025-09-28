import React from 'react';
import type { ListReorderHandlers } from '../hooks/useListReorder';
import { NavigationListRow, type DragHandleConfig } from './NavigationListRow';

interface RootFolderReorderItemProps {
    icon: string;
    label: string;
    level: number;
    dragHandlers?: ListReorderHandlers;
    showDropIndicatorBefore?: boolean;
    showDropIndicatorAfter?: boolean;
    isDragSource?: boolean;
    dragHandleLabel: string;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function RootFolderReorderItem({
    icon,
    label,
    level,
    dragHandlers,
    showDropIndicatorBefore,
    showDropIndicatorAfter,
    isDragSource,
    dragHandleLabel,
    onClick
}: RootFolderReorderItemProps) {
    // Prevent event bubbling for reorder item clicks
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (onClick) {
            onClick(event);
        }
    };

    // Configure drag handle appearance when drag handlers are available
    const handleConfig: DragHandleConfig | undefined = dragHandlers
        ? {
              label: dragHandleLabel,
              visible: true,
              icon: 'lucide-grip-horizontal'
          }
        : undefined;

    return (
        <NavigationListRow
            icon={icon}
            label={label}
            level={level}
            itemType="folder"
            role="listitem"
            onClick={handleClick}
            dragHandlers={dragHandlers}
            showDropIndicatorBefore={showDropIndicatorBefore}
            showDropIndicatorAfter={showDropIndicatorAfter}
            isDragSource={isDragSource}
            showCount={false}
            className="nn-root-reorder-item"
            tabIndex={-1}
            ariaGrabbed={isDragSource}
            dragHandleConfig={handleConfig}
        />
    );
}
