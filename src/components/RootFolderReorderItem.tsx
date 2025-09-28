import React from 'react';
import type { ListReorderHandlers } from '../hooks/useListReorder';
import { NavigationListRow, type DragHandleConfig } from './NavigationListRow';

/**
 * Props for a root folder item in reorder mode
 */
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
    chevronIcon?: string;
}

/**
 * Renders a root folder item that can be reordered via drag and drop.
 * Wraps NavigationListRow with specific configuration for root folder reordering.
 */
export function RootFolderReorderItem({
    icon,
    label,
    level,
    dragHandlers,
    showDropIndicatorBefore,
    showDropIndicatorAfter,
    isDragSource,
    dragHandleLabel,
    onClick,
    chevronIcon
}: RootFolderReorderItemProps) {
    // Prevents event bubbling for reorder item clicks to avoid triggering parent handlers
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (onClick) {
            onClick(event);
        }
    };

    // Configures the drag handle appearance when drag handlers are available
    // Shows a grip icon that allows users to reorder the root folder
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
            chevronIcon={chevronIcon}
        />
    );
}
