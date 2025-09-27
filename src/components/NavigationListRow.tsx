import React, { useMemo, useEffect, useRef } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { getIconService, useIconServiceVersion } from '../services/icons';
import type { ListReorderHandlers } from '../hooks/useListReorder';
import { ObsidianIcon } from './ObsidianIcon';

export interface DragHandleConfig {
    label: string;
    only?: boolean;
    disabled?: boolean;
    visible?: boolean;
    icon?: string;
}

interface NavigationListRowProps {
    icon: string;
    color?: string;
    label: string;
    description?: string;
    level: number;
    itemType: string;
    role?: 'treeitem' | 'listitem';
    tabIndex?: number;
    ariaDisabled?: boolean;
    ariaGrabbed?: boolean;
    isDisabled?: boolean;
    isExcluded?: boolean;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    dragHandlers?: ListReorderHandlers;
    showDropIndicatorBefore?: boolean;
    showDropIndicatorAfter?: boolean;
    isDragSource?: boolean;
    showCount?: boolean;
    count?: number;
    actions?: React.ReactNode;
    dragHandleConfig?: DragHandleConfig;
    className?: string;
}

export function NavigationListRow({
    icon,
    color,
    label,
    level,
    itemType,
    description,
    isDisabled,
    isExcluded,
    onClick,
    onContextMenu,
    dragHandlers,
    showDropIndicatorBefore,
    showDropIndicatorAfter,
    isDragSource,
    showCount,
    count,
    actions,
    dragHandleConfig,
    className,
    role = 'treeitem',
    tabIndex,
    ariaDisabled,
    ariaGrabbed
}: NavigationListRowProps) {
    const settings = useSettingsState();
    const iconRef = useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();

    // Build CSS class names based on component state
    const classes = useMemo(() => {
        const classList = ['nn-navitem', 'nn-drag-item'];
        if (className) {
            classList.push(className);
        }
        if (isDisabled) {
            classList.push('nn-shortcut-disabled');
        }
        if (isExcluded) {
            classList.push('nn-shortcut-excluded');
        }
        if (isDragSource) {
            classList.push('nn-shortcut-drag-source');
        }
        if (dragHandleConfig?.visible) {
            classList.push('nn-drag-item-has-handle');
        }
        return classList.join(' ');
    }, [className, dragHandleConfig?.visible, isDisabled, isDragSource, isExcluded]);

    // Render icon using Obsidian's icon service
    useEffect(() => {
        if (!iconRef.current) {
            return;
        }

        if (!settings.showIcons) {
            iconRef.current.textContent = '';
            return;
        }

        const iconService = getIconService();
        iconService.renderIcon(iconRef.current, icon);
    }, [icon, iconVersion, settings.showIcons]);

    // Determine drag and drop behavior based on handlers and configuration
    const draggable = dragHandlers?.draggable ?? false;
    const handleVisible = Boolean(dragHandleConfig?.visible);
    const handleOnly = dragHandleConfig?.only === true;
    const handleDisabled = dragHandleConfig?.disabled === true;
    const handleInteractive = handleVisible && draggable && !handleDisabled;
    const rowDraggable = draggable && !handleOnly;
    const shouldShowCount = Boolean(showCount && typeof count === 'number' && count > 0);

    // Handle drag start event - sets custom drag image from parent row
    const handleDragStart =
        handleInteractive && dragHandlers?.onDragStart
            ? (event: DragEvent<HTMLElement>) => {
                  const parentRow = event.currentTarget.closest('.nn-drag-item');
                  if (parentRow instanceof HTMLElement) {
                      try {
                          const rect = parentRow.getBoundingClientRect();
                          const offsetX = event.clientX - rect.left;
                          const offsetY = event.clientY - rect.top;
                          event.dataTransfer.setDragImage(parentRow, offsetX, offsetY);
                      } catch (error) {
                          console.log('Drag handle setDragImage failed', error);
                      }
                  }
                  dragHandlers.onDragStart(event);
              }
            : undefined;

    const handleDragEnd = handleInteractive ? dragHandlers?.onDragEnd : undefined;

    return (
        <div
            className={classes}
            role={role}
            tabIndex={tabIndex}
            aria-disabled={ariaDisabled || undefined}
            aria-grabbed={ariaGrabbed ? true : undefined}
            data-nav-item-type={itemType}
            data-nav-item-disabled={isDisabled ? 'true' : undefined}
            data-nav-item-excluded={isExcluded ? 'true' : undefined}
            data-nav-item-level={level}
            data-level={level}
            data-reorder-draggable={rowDraggable ? 'true' : undefined}
            data-reorder-drop-before={showDropIndicatorBefore ? 'true' : undefined}
            data-reorder-drop-after={showDropIndicatorAfter ? 'true' : undefined}
            aria-level={level + 1}
            draggable={rowDraggable}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onDragStart={rowDraggable ? dragHandlers?.onDragStart : undefined}
            onDragOver={dragHandlers?.onDragOver}
            onDragLeave={dragHandlers?.onDragLeave}
            onDrop={dragHandlers?.onDrop}
            onDragEnd={rowDraggable ? dragHandlers?.onDragEnd : undefined}
            style={{ '--level': level } as CSSProperties}
        >
            <div className="nn-navitem-content">
                <span className="nn-navitem-chevron nn-navitem-chevron--no-children" aria-hidden="true" />
                <span
                    ref={iconRef}
                    className="nn-navitem-icon"
                    aria-hidden="true"
                    data-has-color={color ? 'true' : 'false'}
                    style={color ? { color } : undefined}
                />
                <span className="nn-navitem-name">
                    <span className="nn-shortcut-label">{label}</span>
                    {description ? <span className="nn-shortcut-description">{description}</span> : null}
                </span>
                <span className="nn-navitem-spacer" />
                {shouldShowCount ? <span className="nn-navitem-count">{count}</span> : null}
                {actions ? <div className="nn-shortcut-actions">{actions}</div> : null}
                {handleVisible ? (
                    <span
                        className={`nn-drag-handle${handleInteractive ? '' : ' nn-drag-handle-disabled'}${
                            isDragSource ? ' nn-drag-handle-active' : ''
                        }`}
                        role="button"
                        tabIndex={-1}
                        aria-label={dragHandleConfig?.label}
                        data-reorder-handle-draggable={handleInteractive ? 'true' : undefined}
                        draggable={handleInteractive}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <ObsidianIcon name={dragHandleConfig?.icon ?? 'lucide-grip'} />
                    </span>
                ) : null}
            </div>
        </div>
    );
}
