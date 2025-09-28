import { useEffect, useRef } from 'react';
import { useListPaneTitle } from '../hooks/useListPaneTitle';
import { getIconService, useIconServiceVersion } from '../services/icons';

interface ListPaneTitleOverlayProps {
    isVisible: boolean;
}

export function ListPaneTitleOverlay({ isVisible }: ListPaneTitleOverlayProps) {
    const { desktopTitle, iconName, showIcon } = useListPaneTitle();
    const iconVersion = useIconServiceVersion();
    const iconRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!isVisible || !showIcon || !iconName) {
            return;
        }

        const iconService = getIconService();
        if (iconRef.current) {
            iconService.renderIcon(iconRef.current, iconName);
        }
    }, [iconName, iconVersion, isVisible, showIcon]);

    if (!isVisible) {
        return null;
    }

    return (
        <div className="nn-list-title-overlay">
            <div className="nn-list-title-overlay-gradient" />
            <div className="nn-list-title-overlay-content">
                {showIcon && <span ref={iconRef} className="nn-list-title-overlay-icon" />}
                <span className="nn-list-title-overlay-text">{desktopTitle}</span>
            </div>
        </div>
    );
}
