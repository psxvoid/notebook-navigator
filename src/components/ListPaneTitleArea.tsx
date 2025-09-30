import { useListPaneTitle } from '../hooks/useListPaneTitle';

interface ListPaneTitleAreaProps {
    isVisible: boolean;
}

export function ListPaneTitleArea({ isVisible }: ListPaneTitleAreaProps) {
    const { desktopTitle } = useListPaneTitle();

    if (!isVisible) {
        return null;
    }

    return (
        <div className="nn-list-title-area">
            <div className="nn-list-title-content">
                <span className="nn-list-title-text">{desktopTitle}</span>
            </div>
        </div>
    );
}
