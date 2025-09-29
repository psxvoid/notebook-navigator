import { App, Modal } from 'obsidian';
import { strings } from '../i18n';
import { ReleaseNote } from '../releaseNotes';
import { DateUtils } from '../utils/dateUtils';

export class WhatsNewModal extends Modal {
    private releaseNotes: ReleaseNote[];
    private dateFormat: string;
    private thanksButton: HTMLButtonElement | null = null;
    private onCloseCallback?: () => void;
    private domDisposers: (() => void)[] = [];

    // Renders limited formatting into a container element.
    // Supports:
    // - **bold**
    // - ==text== (highlight as red + bold)
    // - [label](https://link)
    // - Auto-link bare http(s) URLs
    // - Line breaks: single \n becomes <br>
    private renderFormattedText(container: HTMLElement, text: string): void {
        const renderInline = (segment: string, dest: HTMLElement) => {
            const pattern = /==([\s\S]*?)==|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s]+)/g;
            let lastIndex = 0;
            let match: RegExpExecArray | null;

            const appendText = (t: string) => {
                if (t.length > 0) dest.appendText(t);
            };

            while ((match = pattern.exec(segment)) !== null) {
                appendText(segment.slice(lastIndex, match.index));

                if (match[1]) {
                    // ==highlight== -> highlight span, supports nested formatting inside
                    const highlight = dest.createSpan({ cls: 'nn-highlight' });
                    renderInline(match[1], highlight);
                } else if (match[2] && match[3]) {
                    // Markdown link [label](url)
                    const a = dest.createEl('a', { text: match[2] });
                    a.setAttr('href', match[3]);
                    a.setAttr('rel', 'noopener noreferrer');
                    a.setAttr('target', '_blank');
                } else if (match[4]) {
                    // **bold**
                    dest.createEl('strong', { text: match[4] });
                } else if (match[5]) {
                    // Bare URL
                    const url = match[5];
                    const a = dest.createEl('a', { text: url });
                    a.setAttr('href', url);
                    a.setAttr('rel', 'noopener noreferrer');
                    a.setAttr('target', '_blank');
                }

                lastIndex = pattern.lastIndex;
            }

            appendText(segment.slice(lastIndex));
        };

        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            renderInline(lines[i], container);
            if (i < lines.length - 1) {
                container.createEl('br');
            }
        }
    }

    private addDomListener(
        el: HTMLElement,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        el.addEventListener(type, handler, options);
        this.domDisposers.push(() => el.removeEventListener(type, handler, options));
    }

    constructor(app: App, releaseNotes: ReleaseNote[], dateFormat: string, onCloseCallback?: () => void) {
        super(app);
        this.releaseNotes = releaseNotes;
        this.dateFormat = dateFormat;
        this.onCloseCallback = onCloseCallback;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.empty();
        this.modalEl.addClass('nn-whats-new-modal');

        contentEl.createEl('h2', {
            text: strings.whatsNew.title,
            cls: 'nn-whats-new-header'
        });

        this.attachCloseButtonHandler();

        const scrollContainer = contentEl.createDiv('nn-whats-new-scroll');

        this.releaseNotes.forEach(note => {
            const versionContainer = scrollContainer.createDiv('nn-whats-new-version');

            versionContainer.createEl('h3', {
                text: `Version ${note.version}`
            });

            // Parse the date string and format according to user preference
            const parsedDate = new Date(note.date);
            const formattedDate = DateUtils.formatDate(parsedDate.getTime(), this.dateFormat);

            versionContainer.createEl('small', {
                text: formattedDate,
                cls: 'nn-whats-new-date'
            });

            // Show info text first if present (supports paragraphs and line breaks)
            if (note.info) {
                const paragraphs = note.info.split(/\n\s*\n/);
                paragraphs.forEach(para => {
                    const p = versionContainer.createEl('p', { cls: 'nn-whats-new-info' });
                    this.renderFormattedText(p, para);
                });
            }

            const categories = [
                { key: 'new', label: 'New' },
                { key: 'improved', label: 'Improved' },
                { key: 'changed', label: 'Changed' },
                { key: 'fixed', label: 'Fixed' }
            ];

            categories.forEach(category => {
                const items = note[category.key as keyof ReleaseNote] as string[] | undefined;
                if (items && items.length > 0) {
                    // Create category header
                    versionContainer.createEl('h4', {
                        text: category.label,
                        cls: 'nn-whats-new-category'
                    });

                    // Create list for this category
                    const categoryList = versionContainer.createEl('ul', {
                        cls: 'nn-whats-new-features'
                    });

                    items.forEach(item => {
                        const li = categoryList.createEl('li');
                        this.renderFormattedText(li, item);
                    });
                }
            });
        });

        // Add divider line right after scroll container
        contentEl.createDiv('nn-whats-new-divider');

        const supportContainer = contentEl.createDiv('nn-whats-new-support');

        supportContainer.createEl('p', {
            text: strings.whatsNew.supportMessage,
            cls: 'nn-whats-new-support-text'
        });

        const buttonContainer = contentEl.createDiv('nn-whats-new-buttons');

        // Create buttons directly without Setting wrapper
        const supportButton = buttonContainer.createEl('button', {
            cls: 'nn-support-button-small'
        });
        supportButton.setAttr('type', 'button');

        const supportIcon = supportButton.createSpan({ cls: 'nn-support-button-icon' });
        supportIcon.setAttr('aria-hidden', 'true');
        supportIcon.setText('☕');

        supportButton.createSpan({
            cls: 'nn-support-button-label',
            text: strings.whatsNew.supportButton
        });
        this.addDomListener(supportButton, 'click', () => {
            window.open('https://www.buymeacoffee.com/johansan');
        });

        const thanksButton = buttonContainer.createEl('button', {
            text: strings.whatsNew.thanksButton,
            cls: 'mod-cta'
        });
        this.addDomListener(thanksButton, 'click', () => {
            this.close();
        });

        // Store reference to thanks button
        this.thanksButton = thanksButton;
    }

    open(): void {
        super.open();
        // Focus the thanks button after the modal is fully opened
        if (this.thanksButton) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                this.thanksButton?.focus();
            });
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.removeClass('nn-whats-new-modal');
        if (this.domDisposers.length) {
            this.domDisposers.forEach(dispose => {
                try {
                    dispose();
                } catch (e) {
                    console.error("Error disposing what's new modal listener:", e);
                }
            });
            this.domDisposers = [];
        }

        // Call the callback when modal is closed
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }

    // Attaches event handlers to the modal close button to ensure proper modal closure
    private attachCloseButtonHandler(): void {
        const closeButton = this.modalEl.querySelector<HTMLElement>('.modal-close-button');
        if (!closeButton) {
            return;
        }

        const handleClose = (event: Event) => {
            event.preventDefault();
            this.close();
        };

        this.addDomListener(closeButton, 'click', handleClose);
        this.addDomListener(closeButton, 'pointerdown', handleClose);
    }
}
