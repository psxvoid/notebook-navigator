import { App, Modal } from 'obsidian';
import { ReleaseNote } from '../releaseNotes';
import NotebookNavigatorPlugin from '../main';
import { strings } from '../i18n';

export class WhatsNewModal extends Modal {
    private releaseNotes: ReleaseNote[];
    private thanksButton: HTMLButtonElement | null = null;

    constructor(app: App, plugin: NotebookNavigatorPlugin, releaseNotes: ReleaseNote[]) {
        super(app);
        this.releaseNotes = releaseNotes;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.empty();
        contentEl.addClass('nn-whats-new-modal');

        contentEl.createEl('h2', {
            text: strings.whatsNew.title,
            cls: 'nn-whats-new-header'
        });

        const scrollContainer = contentEl.createDiv('nn-whats-new-scroll');

        this.releaseNotes.forEach(note => {
            const versionContainer = scrollContainer.createDiv('nn-whats-new-version');

            versionContainer.createEl('h3', {
                text: `Version ${note.version}`
            });

            versionContainer.createEl('small', {
                text: note.date,
                cls: 'nn-whats-new-date'
            });

            const featuresList = versionContainer.createEl('ul', {
                cls: 'nn-whats-new-features'
            });

            note.features.forEach(feature => {
                featuresList.createEl('li', { text: feature });
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
            text: strings.whatsNew.supportButton,
            cls: 'nn-support-button-small'
        });
        supportButton.addEventListener('click', () => {
            window.open('https://github.com/sponsors/johansan/');
        });

        const thanksButton = buttonContainer.createEl('button', {
            text: strings.whatsNew.thanksButton,
            cls: 'mod-cta'
        });
        thanksButton.addEventListener('click', () => {
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
    }
}
