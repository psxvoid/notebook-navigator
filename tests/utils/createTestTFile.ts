import { TFile } from 'obsidian';
import { deriveFileMetadata } from './pathMetadata';

/**
 * Creates a TFile stub with path-derived metadata for unit tests.
 */
export function createTestTFile(path: string): TFile {
    const file = new TFile();
    file.path = path;

    const metadata = deriveFileMetadata(path);
    file.name = metadata.name;
    file.basename = metadata.basename;
    file.extension = metadata.extension;

    return file;
}
