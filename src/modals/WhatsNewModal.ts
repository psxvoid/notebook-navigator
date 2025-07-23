import { App, Modal } from 'obsidian';
import { ReleaseNote } from '../releaseNotes';
import NotebookNavigatorPlugin from '../main';
import { strings } from '../i18n';

export class WhatsNewModal extends Modal {
    private plugin: NotebookNavigatorPlugin;
    private releaseNotes: ReleaseNote[];

    constructor(app: App, plugin: NotebookNavigatorPlugin, releaseNotes: ReleaseNote[]) {
        super(app);
        this.plugin = plugin;
        this.releaseNotes = releaseNotes;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.empty();
        contentEl.addClass('nn-whats-new-modal');

        const headerEl = contentEl.createEl('h2', {
            text: strings.whatsNew.title,
            cls: 'nn-whats-new-header'
        });

        const scrollContainer = contentEl.createDiv('nn-whats-new-scroll');

        this.releaseNotes.forEach(note => {
            const versionContainer = scrollContainer.createDiv('nn-whats-new-version');

            const versionHeader = versionContainer.createEl('h3', {
                text: `Version ${note.version}`
            });

            const dateEl = versionContainer.createEl('small', {
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
        const divider = contentEl.createDiv('nn-whats-new-divider');

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

        // Focus on Thanks button instead of Support button
        thanksButton.focus();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
