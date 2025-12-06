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

import React, { useCallback, useMemo, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    type DragEndEvent,
    type DragStartEvent,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RootFolderReorderItem } from './RootFolderReorderItem';
import { strings } from '../i18n';
import type { SectionReorderRenderItem, RootReorderRenderItem } from '../hooks/useNavigationRootReorder';
import { NavigationSectionId } from '../types';
import { runAsyncAction } from '../utils/async';
import type { DragHandleConfig } from './NavigationListRow';
import {
    ROOT_REORDER_MOUSE_CONSTRAINT,
    ROOT_REORDER_TOUCH_CONSTRAINT,
    typeFilteredCollisionDetection,
    verticalAxisOnly
} from '../utils/dndConfig';

interface NavigationRootReorderPanelProps {
    sectionItems: SectionReorderRenderItem[];
    folderItems: RootReorderRenderItem[];
    tagItems: RootReorderRenderItem[];
    isMobile: boolean;
    showRootFolderSection: boolean;
    showRootTagSection: boolean;
    foldersSectionExpanded: boolean;
    tagsSectionExpanded: boolean;
    showRootFolderReset: boolean;
    showRootTagReset: boolean;
    resetRootTagOrderLabel: string;
    onResetRootFolderOrder: () => Promise<void> | void;
    onResetRootTagOrder: () => Promise<void> | void;
    onReorderSections: (orderedKeys: NavigationSectionId[]) => Promise<void> | void;
    onReorderFolders: (orderedKeys: string[]) => Promise<void> | void;
    onReorderTags: (orderedKeys: string[]) => Promise<void> | void;
    canReorderSections: boolean;
    canReorderFolders: boolean;
    canReorderTags: boolean;
}

const RESET_FOLDER_LABEL = strings.navigationPane.resetRootToAlpha;

interface RootSortableEntry {
    sortableId: string;
    item: RootReorderRenderItem;
}

interface SortableItemProps {
    entry: RootSortableEntry;
    canReorder: boolean;
    isMobile: boolean;
}

function SortableRootItem({ entry, canReorder, isMobile }: SortableItemProps) {
    const { item, sortableId } = entry;
    const { attributes, listeners, setNodeRef, transform, transition, isSorting } = useSortable({
        id: sortableId,
        disabled: !canReorder,
        data: { type: item.props.itemType }
    });

    const dragStyle = transform ? { transform: CSS.Transform.toString(transform), transition } : undefined;
    const dragHandleConfig = useMemo(
        () => ({
            label: strings.navigationPane.dragHandleLabel,
            visible: isMobile && canReorder,
            icon: 'lucide-grip-horizontal',
            interactive: isMobile && canReorder,
            only: isMobile
        }),
        [canReorder, isMobile]
    );

    return (
        <RootFolderReorderItem
            {...item.props}
            dragRef={setNodeRef}
            dragAttributes={attributes}
            dragListeners={listeners}
            dragStyle={dragStyle}
            isSorting={isSorting}
            dragHandleConfig={dragHandleConfig}
        />
    );
}

interface SortableListProps {
    entries: RootSortableEntry[];
    canReorder: boolean;
    children?: React.ReactNode;
    isMobile: boolean;
}

function SortableList({ entries, canReorder, children, isMobile }: SortableListProps) {
    const itemIds = useMemo(() => entries.map(entry => entry.sortableId), [entries]);
    return (
        <>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                {entries.map(entry => (
                    <SortableRootItem key={entry.sortableId} entry={entry} canReorder={canReorder} isMobile={isMobile} />
                ))}
            </SortableContext>
            {children}
        </>
    );
}

interface SortableSectionListProps {
    entries: SectionSortableEntry[];
    canReorder: boolean;
    renderSection: (args: {
        entry: SectionSortableEntry;
        attributes: ReturnType<typeof useSortable>['attributes'];
        listeners: ReturnType<typeof useSortable>['listeners'];
        setNodeRef: ReturnType<typeof useSortable>['setNodeRef'];
        setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef'];
        dragStyle: React.CSSProperties | undefined;
        isSorting: boolean;
        dragHandleConfig: DragHandleConfig;
    }) => React.ReactNode;
    isMobile: boolean;
}

interface SortableSectionItemProps {
    entry: SectionSortableEntry;
    canReorder: boolean;
    renderSection: SortableSectionListProps['renderSection'];
    dragHandleConfig: DragHandleConfig;
}

function SortableSectionItem({ entry, canReorder, renderSection, dragHandleConfig }: SortableSectionItemProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isSorting } = useSortable({
        id: entry.sortableId,
        disabled: !canReorder,
        data: { type: 'section' }
    });
    const dragStyle = transform ? { transform: CSS.Transform.toString(transform), transition } : undefined;

    return renderSection({
        entry,
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        dragStyle,
        isSorting,
        dragHandleConfig
    });
}

interface SectionSortableEntry {
    sortableId: string;
    item: SectionReorderRenderItem;
}

function SortableSectionList({ entries, canReorder, renderSection, isMobile }: SortableSectionListProps) {
    const itemIds = useMemo(() => entries.map(entry => entry.sortableId), [entries]);
    const dragHandleConfig = useMemo(
        () => ({
            label: strings.navigationPane.dragHandleLabel,
            visible: isMobile && canReorder,
            icon: 'lucide-grip-horizontal',
            interactive: isMobile && canReorder,
            only: isMobile
        }),
        [canReorder, isMobile]
    );

    return (
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {entries.map(entry => (
                <SortableSectionItem
                    key={entry.sortableId}
                    entry={entry}
                    canReorder={canReorder}
                    renderSection={renderSection}
                    dragHandleConfig={dragHandleConfig}
                />
            ))}
        </SortableContext>
    );
}

export function NavigationRootReorderPanel({
    sectionItems,
    folderItems,
    tagItems,
    isMobile,
    showRootFolderSection,
    showRootTagSection,
    foldersSectionExpanded,
    tagsSectionExpanded,
    showRootFolderReset,
    showRootTagReset,
    resetRootTagOrderLabel,
    onResetRootFolderOrder,
    onResetRootTagOrder,
    onReorderSections,
    onReorderFolders,
    onReorderTags,
    canReorderSections,
    canReorderFolders,
    canReorderTags
}: NavigationRootReorderPanelProps) {
    const handleResetFolders = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            runAsyncAction(async () => {
                await onResetRootFolderOrder?.();
            });
        },
        [onResetRootFolderOrder]
    );

    const handleResetTags = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            runAsyncAction(async () => {
                await onResetRootTagOrder?.();
            });
        },
        [onResetRootTagOrder]
    );

    const sectionEntries = useMemo<SectionSortableEntry[]>(() => {
        return sectionItems.map(item => ({
            sortableId: `section:${item.key}`,
            item
        }));
    }, [sectionItems]);

    const folderEntries = useMemo<RootSortableEntry[]>(() => {
        return folderItems.map(item => ({
            sortableId: `folder:${item.key}`,
            item
        }));
    }, [folderItems]);

    const tagEntries = useMemo<RootSortableEntry[]>(() => {
        return tagItems.map(item => ({
            sortableId: `tag:${item.key}`,
            item
        }));
    }, [tagItems]);

    const sortableRegistry = useMemo(() => {
        const map = new Map<string, { type: 'section' | 'folder' | 'tag'; key: string }>();
        sectionEntries.forEach(entry => {
            map.set(entry.sortableId, { type: 'section', key: entry.item.key });
        });
        folderEntries.forEach(entry => {
            map.set(entry.sortableId, { type: 'folder', key: entry.item.key });
        });
        tagEntries.forEach(entry => {
            map.set(entry.sortableId, { type: 'tag', key: entry.item.key });
        });
        return map;
    }, [folderEntries, sectionEntries, tagEntries]);

    const sectionIds = useMemo(() => sectionEntries.map(entry => entry.item.key as NavigationSectionId), [sectionEntries]);
    const folderIds = useMemo(() => folderEntries.map(entry => entry.item.key), [folderEntries]);
    const tagIds = useMemo(() => tagEntries.map(entry => entry.item.key), [tagEntries]);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: ROOT_REORDER_MOUSE_CONSTRAINT }),
        useSensor(TouchSensor, { activationConstraint: ROOT_REORDER_TOUCH_CONSTRAINT })
    );

    const [activeSectionEntry, setActiveSectionEntry] = useState<SectionSortableEntry | null>(null);

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const activeId = event.active.id as string;
            const activeInfo = sortableRegistry.get(activeId);
            if (activeInfo?.type === 'section') {
                const entry = sectionEntries.find(e => e.sortableId === activeId);
                setActiveSectionEntry(entry ?? null);
            }
        },
        [sectionEntries, sortableRegistry]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveSectionEntry(null);

            const activeId = event.active.id as string;
            const overId = event.over?.id as string | undefined;
            if (!overId) {
                return;
            }

            const active = sortableRegistry.get(activeId);
            const over = sortableRegistry.get(overId);
            if (!active || !over) {
                return;
            }
            if (active.type !== over.type) {
                return;
            }

            if (active.type === 'section') {
                if (!canReorderSections) {
                    return;
                }
                const oldIndex = sectionIds.indexOf(active.key as NavigationSectionId);
                const newIndex = sectionIds.indexOf(over.key as NavigationSectionId);
                if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
                    return;
                }
                const next = arrayMove(sectionIds, oldIndex, newIndex);
                runAsyncAction(async () => {
                    await onReorderSections(next);
                });
                return;
            }

            if (active.type === 'folder') {
                if (!canReorderFolders) {
                    return;
                }
                const oldIndex = folderIds.indexOf(active.key);
                const newIndex = folderIds.indexOf(over.key);
                if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
                    return;
                }
                const next = arrayMove(folderIds, oldIndex, newIndex);
                runAsyncAction(async () => {
                    await onReorderFolders(next);
                });
                return;
            }

            if (!canReorderTags) {
                return;
            }
            const oldIndex = tagIds.indexOf(active.key);
            const newIndex = tagIds.indexOf(over.key);
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
                return;
            }
            const next = arrayMove(tagIds, oldIndex, newIndex);
            runAsyncAction(async () => {
                await onReorderTags(next);
            });
        },
        [
            canReorderFolders,
            canReorderSections,
            canReorderTags,
            folderIds,
            onReorderFolders,
            onReorderSections,
            onReorderTags,
            sectionIds,
            sortableRegistry,
            tagIds
        ]
    );

    const hasSortableContent = sectionEntries.length > 0 || folderEntries.length > 0 || tagEntries.length > 0;

    return (
        <div className="nn-root-reorder-panel">
            <div className="nn-root-reorder-header">
                <span className="nn-root-reorder-title">{strings.navigationPane.reorderRootFoldersTitle}</span>
                <span className="nn-root-reorder-hint">{strings.navigationPane.reorderRootFoldersHint}</span>
            </div>

            <div className="nn-root-reorder-list" role="presentation">
                {hasSortableContent ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={typeFilteredCollisionDetection}
                        modifiers={[verticalAxisOnly]}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        {sectionEntries.length > 0 ? (
                            <SortableSectionList
                                entries={sectionEntries}
                                canReorder={canReorderSections}
                                isMobile={isMobile}
                                renderSection={({
                                    entry,
                                    attributes,
                                    listeners,
                                    setNodeRef,
                                    setActivatorNodeRef,
                                    dragStyle,
                                    isSorting,
                                    dragHandleConfig
                                }) => {
                                    const item = entry.item;
                                    const shouldRenderFolders =
                                        item.sectionId === NavigationSectionId.FOLDERS && foldersSectionExpanded && showRootFolderSection;
                                    const shouldRenderTags =
                                        item.sectionId === NavigationSectionId.TAGS && tagsSectionExpanded && showRootTagSection;
                                    const isBeingDragged = activeSectionEntry?.sortableId === entry.sortableId;

                                    return (
                                        <div
                                            key={entry.sortableId}
                                            ref={setNodeRef}
                                            style={isBeingDragged ? undefined : dragStyle}
                                            className={`nn-root-reorder-section${isBeingDragged ? ' nn-root-reorder-section--dragging' : ''}`}
                                        >
                                            <RootFolderReorderItem
                                                {...item.props}
                                                dragAttributes={attributes}
                                                dragListeners={listeners}
                                                dragHandleRef={setActivatorNodeRef}
                                                isSorting={isSorting}
                                                dragHandleConfig={dragHandleConfig}
                                            />

                                            {shouldRenderFolders && folderEntries.length > 0 ? (
                                                <SortableList entries={folderEntries} canReorder={canReorderFolders} isMobile={isMobile}>
                                                    {showRootFolderReset ? (
                                                        <div className="nn-root-reorder-actions">
                                                            <button
                                                                type="button"
                                                                className="nn-root-reorder-reset nn-support-button"
                                                                onClick={handleResetFolders}
                                                            >
                                                                <span className="nn-root-reorder-reset-icon" aria-hidden="true">
                                                                    Aa
                                                                </span>
                                                                <span>{RESET_FOLDER_LABEL}</span>
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </SortableList>
                                            ) : null}

                                            {shouldRenderTags && tagEntries.length > 0 ? (
                                                <SortableList entries={tagEntries} canReorder={canReorderTags} isMobile={isMobile}>
                                                    {showRootTagReset ? (
                                                        <div className="nn-root-reorder-actions">
                                                            <button
                                                                type="button"
                                                                className="nn-root-reorder-reset nn-support-button"
                                                                onClick={handleResetTags}
                                                            >
                                                                <span className="nn-root-reorder-reset-icon" aria-hidden="true">
                                                                    Aa
                                                                </span>
                                                                <span>{resetRootTagOrderLabel}</span>
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </SortableList>
                                            ) : null}
                                        </div>
                                    );
                                }}
                            />
                        ) : (
                            <>
                                {showRootFolderSection && folderEntries.length > 0 ? (
                                    <div className="nn-root-reorder-section">
                                        <SortableList entries={folderEntries} canReorder={canReorderFolders} isMobile={isMobile}>
                                            {showRootFolderReset ? (
                                                <div className="nn-root-reorder-actions">
                                                    <button
                                                        type="button"
                                                        className="nn-root-reorder-reset nn-support-button"
                                                        onClick={handleResetFolders}
                                                    >
                                                        <span className="nn-root-reorder-reset-icon" aria-hidden="true">
                                                            Aa
                                                        </span>
                                                        <span>{RESET_FOLDER_LABEL}</span>
                                                    </button>
                                                </div>
                                            ) : null}
                                        </SortableList>
                                    </div>
                                ) : null}

                                {showRootTagSection && tagEntries.length > 0 ? (
                                    <div className="nn-root-reorder-section">
                                        <SortableList entries={tagEntries} canReorder={canReorderTags} isMobile={isMobile}>
                                            {showRootTagReset ? (
                                                <div className="nn-root-reorder-actions">
                                                    <button
                                                        type="button"
                                                        className="nn-root-reorder-reset nn-support-button"
                                                        onClick={handleResetTags}
                                                    >
                                                        <span className="nn-root-reorder-reset-icon" aria-hidden="true">
                                                            Aa
                                                        </span>
                                                        <span>{resetRootTagOrderLabel}</span>
                                                    </button>
                                                </div>
                                            ) : null}
                                        </SortableList>
                                    </div>
                                ) : null}
                            </>
                        )}
                        <DragOverlay modifiers={[verticalAxisOnly]}>
                            {activeSectionEntry ? (
                                <RootFolderReorderItem
                                    {...activeSectionEntry.item.props}
                                    isSorting={true}
                                    dragHandleConfig={{
                                        label: strings.navigationPane.dragHandleLabel,
                                        visible: isMobile && canReorderSections,
                                        icon: 'lucide-grip-horizontal',
                                        interactive: false,
                                        only: isMobile
                                    }}
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                ) : null}
            </div>
        </div>
    );
}
