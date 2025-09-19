export type ExternalIconProviderId = 'fontawesome-regular' | 'rpg-awesome' | 'bootstrap-icons' | 'material-icons' | 'phosphor';

export interface ExternalIconManifest {
    version: string;
    font: string;
    metadata: string;
    fontMimeType?: string;
    metadataFormat?: 'json';
    checksum?: string;
}

export interface ExternalIconProviderConfig {
    id: ExternalIconProviderId;
    name: string;
    manifestUrl: string;
    fontFamily: string;
}

export const EXTERNAL_ICON_PROVIDERS: Record<ExternalIconProviderId, ExternalIconProviderConfig> = {
    'fontawesome-regular': {
        id: 'fontawesome-regular',
        name: 'Font Awesome',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/fontawesome/latest.json',
        fontFamily: 'NotebookNavigatorFontAwesomeSolid'
    },
    'rpg-awesome': {
        id: 'rpg-awesome',
        name: 'RPG Awesome',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/rpg-awesome/latest.json',
        fontFamily: 'NotebookNavigatorRpgAwesome'
    },
    'bootstrap-icons': {
        id: 'bootstrap-icons',
        name: 'Bootstrap Icons',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/bootstrap-icons/latest.json',
        fontFamily: 'NotebookNavigatorBootstrapIcons'
    },
    'material-icons': {
        id: 'material-icons',
        name: 'Material Icons',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/material-icons/latest.json',
        fontFamily: 'NotebookNavigatorMaterialIcons'
    },
    phosphor: {
        id: 'phosphor',
        name: 'Phosphor Icons',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/phosphor/latest.json',
        fontFamily: 'NotebookNavigatorPhosphorIcons'
    }
};
