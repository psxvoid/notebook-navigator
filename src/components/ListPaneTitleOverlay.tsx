import { useListPaneTitle } from '../hooks/useListPaneTitle';

interface ListPaneTitleOverlayProps {
    isVisible: boolean;
}

export function ListPaneTitleOverlay({ isVisible }: ListPaneTitleOverlayProps) {
    const { desktopTitle } = useListPaneTitle();

    if (!isVisible) {
        return null;
    }

    return (
        <div className="nn-list-title-overlay">
            <div className="nn-list-title-overlay-gradient" />
            <div className="nn-list-title-overlay-content">
                <span className="nn-list-title-overlay-text">{desktopTitle}</span>
            </div>
        </div>
    );
}
