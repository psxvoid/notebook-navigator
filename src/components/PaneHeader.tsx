import React from 'react';
export function PaneHeader({ type }: { type: 'folder' | 'file' }) {
    // TODO: Add buttons and logic from original PaneHeader
    return <div className="nn-pane-header">{type === 'folder' ? 'Folders' : 'Files'}</div>;
}