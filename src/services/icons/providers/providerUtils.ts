const ICON_FONT_CLASSES = [
    'nn-iconfont',
    'nn-iconfont-fa-solid',
    'nn-iconfont-rpg-awesome',
    'nn-iconfont-bootstrap-icons',
    'nn-iconfont-material-icons',
    'nn-iconfont-phosphor',
    'nn-iconfont-simple-icons'
];

/**
 * Resets a container element by removing icon-related classes and content.
 */
export function resetIconContainer(container: HTMLElement): void {
    container.empty();
    container.removeClass('nn-emoji-icon');
    ICON_FONT_CLASSES.forEach(className => {
        container.removeClass(className);
    });
}
