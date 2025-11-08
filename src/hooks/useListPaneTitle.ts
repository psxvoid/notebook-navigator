import { useMemo } from 'react';
import { useServices, useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { useSelectionState } from '../context/SelectionContext';
import { useFileCache } from '../context/StorageContext';
import { useExpansionState } from '../context/ExpansionContext';
import { strings } from '../i18n';
import { ItemType, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';
import { hasSubfolders } from '../utils/fileFilters';
import { getVirtualTagCollection, VIRTUAL_TAG_COLLECTION_IDS } from '../utils/virtualTagCollections';

export type BreadcrumbTargetType = 'folder' | 'tag' | 'none';

export interface BreadcrumbSegment {
    label: string;
    targetType: BreadcrumbTargetType;
    targetPath?: string;
    isLast: boolean;
}

interface UseListPaneTitleResult {
    desktopTitle: string;
    breadcrumbSegments: BreadcrumbSegment[];
    iconName: string;
    showIcon: boolean;
    selectionType: ItemType | null;
}

export function useListPaneTitle(): UseListPaneTitleResult {
    const { app } = useServices();
    const settings = useSettingsState();
    const uxPreferences = useUXPreferences();
    const showHiddenItems = uxPreferences.showHiddenItems;
    const selectionState = useSelectionState();
    const { getTagDisplayPath } = useFileCache();
    const expansionState = useExpansionState();
    const metadataService = useMetadataService();

    // Determines the icon to display in the list pane header based on selection type and icon settings
    const iconName = useMemo(() => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            if (!settings.showFolderIcons) {
                return '';
            }
            const folder = selectionState.selectedFolder;
            const customIcon = metadataService.getFolderIcon(folder.path);
            if (customIcon) {
                return customIcon;
            }

            const excludedFolders = settings.excludedFolders;
            const showHiddenFolders = showHiddenItems;
            const hasChildren = hasSubfolders(folder, excludedFolders, showHiddenFolders);
            const isExpanded = expansionState.expandedFolders.has(folder.path);
            return hasChildren && isExpanded ? 'lucide-folder-open' : 'lucide-folder-closed';
        }

        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            if (!settings.showTagIcons) {
                return '';
            }
            return metadataService.getTagIcon(selectionState.selectedTag) || 'lucide-tags';
        }

        return '';
    }, [
        expansionState.expandedFolders,
        metadataService,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectionType,
        settings.excludedFolders,
        showHiddenItems,
        settings.showFolderIcons,
        settings.showTagIcons
    ]);

    const { desktopTitle, breadcrumbSegments } = useMemo(() => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            const folder = selectionState.selectedFolder;

            if (folder.path === '/') {
                const vaultName = settings.customVaultName || app.vault.getName();
                const rootBreadcrumb: BreadcrumbSegment[] = [
                    {
                        label: vaultName,
                        targetType: 'none',
                        isLast: true
                    }
                ];
                return {
                    desktopTitle: vaultName,
                    breadcrumbSegments: rootBreadcrumb
                };
            }

            const segments = folder.path.split('/').filter(Boolean);
            const breadcrumb: BreadcrumbSegment[] = segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                return {
                    label: segment,
                    targetType: isLast ? 'none' : 'folder',
                    targetPath: isLast ? undefined : segments.slice(0, index + 1).join('/'),
                    isLast
                };
            });

            return {
                desktopTitle: folder.name,
                breadcrumbSegments: breadcrumb
            };
        }

        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            const tag = selectionState.selectedTag;

            // Handle virtual tag collection showing all tagged notes
            if (tag === TAGGED_TAG_ID) {
                const taggedLabel = getVirtualTagCollection(VIRTUAL_TAG_COLLECTION_IDS.TAGGED).getLabel();
                const taggedBreadcrumb: BreadcrumbSegment[] = [
                    {
                        label: taggedLabel,
                        targetType: 'none',
                        isLast: true
                    }
                ];
                return {
                    desktopTitle: taggedLabel,
                    breadcrumbSegments: taggedBreadcrumb
                };
            }

            if (tag === UNTAGGED_TAG_ID) {
                const untaggedBreadcrumb: BreadcrumbSegment[] = [
                    {
                        label: strings.common.untagged,
                        targetType: 'none',
                        isLast: true
                    }
                ];
                return {
                    desktopTitle: strings.common.untagged,
                    breadcrumbSegments: untaggedBreadcrumb
                };
            }

            const displayPath = getTagDisplayPath(tag);
            const segments = displayPath.split('/').filter(Boolean);
            const breadcrumb: BreadcrumbSegment[] = segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                return {
                    label: segment,
                    targetType: isLast ? 'none' : 'tag',
                    targetPath: isLast ? undefined : segments.slice(0, index + 1).join('/'),
                    isLast
                };
            });

            return {
                desktopTitle: segments[segments.length - 1] || displayPath,
                breadcrumbSegments: breadcrumb
            };
        }

        const noSelectionBreadcrumb: BreadcrumbSegment[] = [
            {
                label: strings.common.noSelection,
                targetType: 'none',
                isLast: true
            }
        ];

        return {
            desktopTitle: strings.common.noSelection,
            breadcrumbSegments: noSelectionBreadcrumb
        };
    }, [
        app.vault,
        getTagDisplayPath,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectionType,
        settings.customVaultName
    ]);

    return {
        desktopTitle,
        breadcrumbSegments,
        iconName,
        showIcon:
            (selectionState.selectionType === ItemType.FOLDER && settings.showFolderIcons && iconName.length > 0) ||
            (selectionState.selectionType === ItemType.TAG && settings.showTagIcons && iconName.length > 0),
        selectionType: selectionState.selectionType
    };
}
