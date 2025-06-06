import React from 'react';
import { useAppContext } from '../context/AppContext';
import { TFile } from 'obsidian';
import { FileItem } from './FileItem';

export function FileList() {
    const { app, appState, setAppState } = useAppContext();
    
    // TODO: Get files from selected folder
    // For now, this is a placeholder implementation
    const files: TFile[] = [];
    
    const handleFileClick = (file: TFile) => {
        setAppState(currentState => ({
            ...currentState,
            selectedFile: file,
            focusedPane: 'files',
        }));
        // Logic to preview the file in an Obsidian leaf can go here
        // app.workspace.getLeaf().openFile(file);
    };

    return (
        <div className="nn-file-list">
            {files.map((file) => (
                <FileItem
                    key={file.path}
                    file={file}
                    isSelected={appState.selectedFile?.path === file.path}
                    onClick={() => handleFileClick(file)}
                />
            ))}
        </div>
    );
}