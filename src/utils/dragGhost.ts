import { App, setIcon } from 'obsidian';
import { ItemType } from '../types';
import { getDBInstance } from '../storage/fileOperations';
import { getIconService } from '../services/icons';

export type DragGhostItemType = (typeof ItemType)[keyof typeof ItemType] | 'search';

export interface DragGhostOptions {
    itemType: DragGhostItemType | null;
    path?: string;
    itemCount?: number;
    icon?: string;
    iconColor?: string;
}

export interface DragGhostManager {
    showGhost: (event: DragEvent, options: DragGhostOptions) => void;
    hideGhost: () => void;
    hideNativePreview: (event: DragEvent) => void;
    hasGhost: () => boolean;
}

export function createDragGhostManager(app: App): DragGhostManager {
    let dragGhostElement: HTMLElement | null = null;
    let windowDragEndHandler: ((event: DragEvent) => void) | null = null;
    let windowDropHandler: ((event: DragEvent) => void) | null = null;

    const updateDragGhostPosition = (event: MouseEvent | DragEvent) => {
        if (!dragGhostElement) {
            return;
        }
        dragGhostElement.style.left = `${event.clientX + 10}px`;
        dragGhostElement.style.top = `${event.clientY + 10}px`;
    };

    const hideGhost = () => {
        if (dragGhostElement) {
            document.removeEventListener('mousemove', updateDragGhostPosition);
            document.removeEventListener('dragover', updateDragGhostPosition);
            dragGhostElement.remove();
            dragGhostElement = null;
        }
        if (windowDragEndHandler) {
            window.removeEventListener('dragend', windowDragEndHandler);
            windowDragEndHandler = null;
        }
        if (windowDropHandler) {
            window.removeEventListener('drop', windowDropHandler);
            windowDropHandler = null;
        }
    };

    const resolveIcon = (options: DragGhostOptions): string | null => {
        if (options.icon) {
            return options.icon;
        }
        if (options.itemType === ItemType.FOLDER) {
            return 'lucide-folder-closed';
        }
        if (options.itemType === ItemType.TAG) {
            return 'lucide-tags';
        }
        if (options.itemType === 'search') {
            return 'lucide-search';
        }
        if (options.itemType !== ItemType.FILE) {
            return null;
        }
        return 'lucide-file';
    };

    const asEmoji = (iconId: string): string | null => {
        if (iconId.startsWith('emoji:')) {
            return iconId.slice('emoji:'.length);
        }
        const emojiRegex = /\p{Extended_Pictographic}/u;
        return emojiRegex.test(iconId) ? iconId : null;
    };

    const showGhost = (event: DragEvent, options: DragGhostOptions) => {
        hideGhost();

        const ghost = document.createElement('div');
        ghost.className = 'nn-drag-ghost';
        ghost.style.left = `${event.clientX + 10}px`;
        ghost.style.top = `${event.clientY + 10}px`;

        const iconService = getIconService();

        if (options.itemCount && options.itemCount > 1) {
            const info = document.createElement('div');
            info.className = 'nn-drag-ghost-badge';
            info.textContent = `${options.itemCount}`;
            ghost.appendChild(info);
        } else {
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'nn-drag-ghost-icon';
            const iconColor = options.iconColor ?? '#ffffff';
            iconWrapper.style.color = iconColor;
            iconWrapper.style.setProperty('--icon-color', iconColor);
            iconWrapper.style.fill = iconColor;
            iconWrapper.style.stroke = iconColor;

            if (options.itemType === ItemType.FILE && options.path) {
                let featureImagePath = '';
                try {
                    featureImagePath = getDBInstance().getCachedFeatureImageUrl(options.path);
                } catch (error) {
                    void error;
                    // Ignore cache errors and fall back to icon rendering
                }
                let imageLoaded = false;
                if (featureImagePath) {
                    const imageFile = app.vault.getFileByPath(featureImagePath);
                    if (imageFile) {
                        try {
                            const resourceUrl = app.vault.getResourcePath(imageFile);
                            iconWrapper.className = 'nn-drag-ghost-icon nn-drag-ghost-featured-image';
                            const img = document.createElement('img');
                            img.src = resourceUrl;
                            iconWrapper.appendChild(img);
                            imageLoaded = true;
                        } catch (error) {
                            imageLoaded = false;
                            void error;
                        }
                    }
                }

                if (!imageLoaded) {
                    const renderIcon = (iconId: string | null | undefined): boolean => {
                        if (!iconId) {
                            return false;
                        }
                        iconWrapper.innerHTML = '';
                        try {
                            iconService.renderIcon(iconWrapper, iconId);
                            if (iconWrapper.childNodes.length > 0 || iconWrapper.innerHTML.trim() !== '') {
                                return true;
                            }
                        } catch (error) {
                            void error;
                        }
                        const emoji = asEmoji(iconId);
                        if (emoji) {
                            iconWrapper.textContent = emoji;
                            return true;
                        }
                        try {
                            setIcon(iconWrapper, iconId);
                            return iconWrapper.childNodes.length > 0;
                        } catch (error) {
                            void error;
                        }
                        return false;
                    };

                    const resolvedIcon = resolveIcon(options);
                    if (!renderIcon(options.icon) && !renderIcon(resolvedIcon)) {
                        iconWrapper.innerHTML = '';
                    }
                }
            } else {
                const renderIcon = (iconId: string | null | undefined): boolean => {
                    if (!iconId) {
                        return false;
                    }
                    iconWrapper.innerHTML = '';
                    try {
                        iconService.renderIcon(iconWrapper, iconId);
                        if (iconWrapper.childNodes.length > 0 || iconWrapper.innerHTML.trim() !== '') {
                            return true;
                        }
                    } catch (error) {
                        void error;
                    }
                    const emoji = asEmoji(iconId);
                    if (emoji) {
                        iconWrapper.textContent = emoji;
                        return true;
                    }
                    try {
                        setIcon(iconWrapper, iconId);
                        return iconWrapper.childNodes.length > 0;
                    } catch (error) {
                        void error;
                    }
                    return false;
                };

                const resolvedIcon = resolveIcon(options);
                if (!renderIcon(options.icon) && !renderIcon(resolvedIcon)) {
                    iconWrapper.innerHTML = '';
                }
            }

            ghost.appendChild(iconWrapper);
        }

        document.body.appendChild(ghost);
        dragGhostElement = ghost;

        document.addEventListener('mousemove', updateDragGhostPosition, { passive: true });
        document.addEventListener('dragover', updateDragGhostPosition);

        const onGlobalEnd = () => hideGhost();
        windowDragEndHandler = onGlobalEnd;
        windowDropHandler = onGlobalEnd;
        window.addEventListener('dragend', onGlobalEnd, { once: true });
        window.addEventListener('drop', onGlobalEnd, { once: true });
    };

    const hideNativePreview = (event: DragEvent) => {
        const empty = document.createElement('div');
        empty.className = 'nn-drag-empty-placeholder';
        document.body.appendChild(empty);
        try {
            event.dataTransfer?.setDragImage(empty, 0, 0);
        } catch (error) {
            void error;
        }
        setTimeout(() => empty.remove(), 0);
    };

    return {
        showGhost,
        hideGhost,
        hideNativePreview,
        hasGhost: () => dragGhostElement !== null
    };
}
