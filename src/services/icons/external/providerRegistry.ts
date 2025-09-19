export type ExternalIconProviderId = 'fontawesome-regular' | 'rpg-awesome';

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
        name: 'Font Awesome Regular',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/fontawesome/latest.json',
        fontFamily: 'NotebookNavigatorFontAwesomeRegular'
    },
    'rpg-awesome': {
        id: 'rpg-awesome',
        name: 'RPG Awesome',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/rpg-awesome/latest.json',
        fontFamily: 'NotebookNavigatorRpgAwesome'
    }
};
