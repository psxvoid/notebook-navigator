/**
 * Derives filename metadata (name, basename, extension) from a vault-relative path.
 */
export function deriveFileMetadata(path: string): {
    name: string;
    basename: string;
    extension: string;
} {
    const name = path.split('/').pop() ?? '';

    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) {
        return {
            name,
            basename: name,
            extension: ''
        };
    }

    return {
        name,
        basename: name.substring(0, lastDot),
        extension: name.substring(lastDot + 1)
    };
}
