/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { MenuItem, TFile, Notice, Menu, App } from 'obsidian';
import { FileMenuBuilderParams } from './menuTypes';
import { strings } from '../../i18n';
import { getInternalPlugin } from '../../utils/typeGuards';
import { getFilesForFolder, getFilesForTag } from '../../utils/fileFinder';
import { ItemType, NavigatorContext } from '../../types';
import { MetadataService } from '../../services/MetadataService';
import { FileSystemOperations } from '../../services/FileSystemService';
import { SelectionState, SelectionAction } from '../../context/SelectionContext';
import { NotebookNavigatorSettings } from '../../settings';
import { TagSuggestModal } from '../../modals/TagSuggestModal';
import { RemoveTagModal } from '../../modals/RemoveTagModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { CommandQueueService } from '../../services/CommandQueueService';

/**
 * Builds the context menu for a file
 */
export function buildFileMenu(params: FileMenuBuilderParams): void {
    const { file, menu, services, settings, state, dispatchers } = params;
    const { app, isMobile, fileSystemOps, metadataService, tagTreeService, commandQueue } = services;
    const { selectionState } = state;
    const { selectionDispatch } = dispatchers;

    // Check if multiple files are selected
    const selectedCount = selectionState.selectedFiles.size;
    const isMultipleSelected = selectedCount > 1;
    const isFileSelected = selectionState.selectedFiles.has(file.path);

    // Determine if this is a markdown file
    const isMarkdown = file.extension === 'md';

    // If right-clicking on an unselected file while having multi-selection,
    // treat it as a single file operation
    const shouldShowMultiOptions = isMultipleSelected && isFileSelected;

    // Cache the current file list to avoid regenerating it multiple times
    const cachedFileList = (() => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            return getFilesForFolder(selectionState.selectedFolder, settings, app);
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return getFilesForTag(selectionState.selectedTag, settings, app, tagTreeService);
        }
        return [];
    })();

    // Cache selected files to avoid repeated path-to-file conversions
    const cachedSelectedFiles = shouldShowMultiOptions
        ? Array.from(selectionState.selectedFiles)
              .map(path => app.vault.getAbstractFileByPath(path))
              .filter((f): f is TFile => f instanceof TFile)
        : [];

    // Open options - show for single or multiple selection
    if (!shouldShowMultiOptions) {
        addSingleFileOpenOptions(menu, file, app, isMobile, commandQueue);
    } else {
        addMultipleFilesOpenOptions(menu, selectedCount, selectionState, app, isMobile, cachedSelectedFiles, commandQueue);
    }

    menu.addSeparator();

    // Pin/Unpin note(s)
    const pinContext: NavigatorContext = selectionState.selectionType === ItemType.TAG ? 'tag' : 'folder';
    if (!shouldShowMultiOptions) {
        addSingleFilePinOption(menu, file, metadataService, pinContext);
    } else {
        addMultipleFilesPinOption(menu, selectedCount, selectionState, app, metadataService, pinContext);
    }

    // Duplicate note(s)
    if (!shouldShowMultiOptions) {
        addSingleFileDuplicateOption(menu, file, fileSystemOps);
    } else {
        addMultipleFilesDuplicateOption(menu, selectedCount, selectionState, app, fileSystemOps);
    }

    // Open version history (if Sync is enabled) - single selection only
    if (!shouldShowMultiOptions) {
        const syncPlugin = getInternalPlugin(app, 'sync');
        if (syncPlugin && 'enabled' in syncPlugin && syncPlugin.enabled) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.file.openVersionHistory)
                    .setIcon('history')
                    .onClick(async () => {
                        await fileSystemOps.openVersionHistory(file);
                    });
            });
        }
    }

    // Tag operations
    menu.addSeparator();

    const filesForTagOps = shouldShowMultiOptions ? cachedSelectedFiles : [file];

    // Check if files have tags
    const existingTags = services.tagOperations.getTagsFromFiles(filesForTagOps);
    const hasTags = existingTags.length > 0;
    const hasMultipleTags = existingTags.length > 1;

    // Add tag - always shown
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.file.addTag)
            .setIcon('plus')
            .onClick(async () => {
                const modal = new TagSuggestModal(
                    app,
                    services.plugin,
                    async (tag: string) => {
                        const result = await services.tagOperations.addTagToFiles(tag, filesForTagOps);
                        const message =
                            result.added === 1
                                ? strings.fileSystem.notifications.tagAddedToNote
                                : strings.fileSystem.notifications.tagAddedToNotes.replace('{count}', result.added.toString());
                        new Notice(message);
                    },
                    strings.modals.tagSuggest.addPlaceholder,
                    strings.modals.tagSuggest.instructions.add,
                    false // Don't include untagged
                );
                modal.open();
            });
    });

    // Remove tag - only show if files have tags
    if (hasTags) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.file.removeTag)
                .setIcon('minus')
                .onClick(async () => {
                    // Get tags from selected files
                    const existingTags = services.tagOperations.getTagsFromFiles(filesForTagOps);

                    if (existingTags.length === 0) {
                        new Notice(strings.fileSystem.notifications.noTagsToRemove);
                        return;
                    }

                    // If only one tag exists, remove it directly without showing modal
                    if (existingTags.length === 1) {
                        const result = await services.tagOperations.removeTagFromFiles(existingTags[0], filesForTagOps);
                        const message =
                            result === 1
                                ? strings.fileSystem.notifications.tagRemovedFromNote
                                : strings.fileSystem.notifications.tagRemovedFromNotes.replace('{count}', result.toString());
                        new Notice(message);
                        return;
                    }

                    // Create modal to select which tag to remove
                    const modal = new RemoveTagModal(app, existingTags, async (tag: string) => {
                        const result = await services.tagOperations.removeTagFromFiles(tag, filesForTagOps);
                        const message =
                            result === 1
                                ? strings.fileSystem.notifications.tagRemovedFromNote
                                : strings.fileSystem.notifications.tagRemovedFromNotes.replace('{count}', result.toString());
                        new Notice(message);
                    });
                    modal.open();
                });
        });

        // Remove all tags - only show if files have multiple tags
        if (hasMultipleTags) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.file.removeAllTags)
                    .setIcon('x')
                    .onClick(async () => {
                        // Check if files have tags first
                        const existingTags = services.tagOperations.getTagsFromFiles(filesForTagOps);

                        if (existingTags.length === 0) {
                            new Notice(strings.fileSystem.notifications.noTagsToRemove);
                            return;
                        }

                        // Show confirmation dialog
                        const confirmModal = new ConfirmModal(
                            app,
                            strings.modals.fileSystem.removeAllTagsTitle,
                            filesForTagOps.length === 1
                                ? strings.modals.fileSystem.removeAllTagsFromNote
                                : strings.modals.fileSystem.removeAllTagsFromNotes.replace('{count}', filesForTagOps.length.toString()),
                            async () => {
                                const result = await services.tagOperations.clearAllTagsFromFiles(filesForTagOps);
                                const message =
                                    result === 1
                                        ? strings.fileSystem.notifications.tagsClearedFromNote
                                        : strings.fileSystem.notifications.tagsClearedFromNotes.replace('{count}', result.toString());
                                new Notice(message);
                            },
                            strings.common.remove
                        );
                        confirmModal.open();
                    });
            });
        }
    }

    menu.addSeparator();

    // Reveal in folder - works on all platforms, single selection only
    // Show unless we have a selected folder and the file is directly in that folder
    if (!shouldShowMultiOptions) {
        const isFileInSelectedFolder =
            selectionState.selectedFolder && file.parent && file.parent.path === selectionState.selectedFolder.path;

        if (!isFileInSelectedFolder) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.file.revealInFolder)
                    .setIcon('folder')
                    .onClick(async () => {
                        await services.plugin.activateView();
                        await services.plugin.revealFileInActualFolder(file);
                    });
            });
        }
    }

    // Reveal in system explorer - desktop only, single selection only
    if (!isMobile && !shouldShowMultiOptions) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(fileSystemOps.getRevealInSystemExplorerText())
                .setIcon('folder-open')
                .onClick(async () => {
                    await fileSystemOps.revealInSystemExplorer(file);
                });
        });
    }

    // Copy deep link - single selection only
    if (!shouldShowMultiOptions) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.file.copyDeepLink)
                .setIcon('link')
                .onClick(async () => {
                    const vaultName = app.vault.getName();
                    const encodedVault = encodeURIComponent(vaultName);
                    const encodedFile = encodeURIComponent(file.path);
                    const deepLink = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;

                    await navigator.clipboard.writeText(deepLink);
                    new Notice(strings.fileSystem.notifications.deepLinkCopied);
                });
        });
    }

    menu.addSeparator();

    // Rename note - single selection only
    if (!shouldShowMultiOptions) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(isMarkdown ? strings.contextMenu.file.renameNote : strings.contextMenu.file.renameFile)
                .setIcon('pencil')
                .onClick(async () => {
                    await fileSystemOps.renameFile(file);
                });
        });
    }

    // Move note(s) to folder
    if (!shouldShowMultiOptions) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.file.moveToFolder)
                .setIcon('folder-input')
                .onClick(async () => {
                    await fileSystemOps.moveFilesWithModal([file], {
                        selectedFile: selectionState.selectedFile,
                        dispatch: selectionDispatch,
                        allFiles: cachedFileList
                    });
                });
        });
    } else {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.file.moveMultipleToFolder.replace('{count}', selectedCount.toString()))
                .setIcon('folder-input')
                .onClick(async () => {
                    await fileSystemOps.moveFilesWithModal(cachedSelectedFiles, {
                        selectedFile: selectionState.selectedFile,
                        dispatch: selectionDispatch,
                        allFiles: cachedFileList
                    });
                });
        });
    }

    // Delete note(s)
    if (!shouldShowMultiOptions) {
        addSingleFileDeleteOption(menu, file, selectionState, settings, fileSystemOps, selectionDispatch);
    } else {
        addMultipleFilesDeleteOption(
            menu,
            selectedCount,
            selectionState,
            settings,
            fileSystemOps,
            selectionDispatch,
            cachedFileList,
            cachedSelectedFiles
        );
    }
}

/**
 * Add open options for a single file
 */
function addSingleFileOpenOptions(menu: Menu, file: TFile, app: App, isMobile: boolean, commandQueue: CommandQueueService | null): void {
    // Open in new tab
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.file.openInNewTab)
            .setIcon('file-plus')
            .onClick(() => {
                if (commandQueue) {
                    commandQueue.executeOpenInNewContext(file, 'tab', async () => {
                        await app.workspace.getLeaf('tab').openFile(file);
                    });
                } else {
                    app.workspace.getLeaf('tab').openFile(file);
                }
            });
    });

    // Open to the right
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.file.openToRight)
            .setIcon('vertical-three-dots')
            .onClick(() => {
                if (commandQueue) {
                    commandQueue.executeOpenInNewContext(file, 'split', async () => {
                        await app.workspace.getLeaf('split').openFile(file);
                    });
                } else {
                    app.workspace.getLeaf('split').openFile(file);
                }
            });
    });

    // Open in new window - desktop only
    if (!isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.file.openInNewWindow)
                .setIcon('monitor')
                .onClick(() => {
                    app.workspace.getLeaf('window').openFile(file);
                });
        });
    }
}

/**
 * Add open options for multiple files
 */
function addMultipleFilesOpenOptions(
    menu: Menu,
    selectedCount: number,
    selectionState: SelectionState,
    app: App,
    isMobile: boolean,
    cachedSelectedFiles?: TFile[],
    commandQueue?: CommandQueueService | null
): void {
    // Use cached files if provided, otherwise convert paths to files
    const selectedFiles =
        cachedSelectedFiles ||
        Array.from(selectionState.selectedFiles)
            .map(path => app.vault.getAbstractFileByPath(path))
            .filter((f): f is TFile => f instanceof TFile);
    const allMarkdown = selectedFiles.every(f => f.extension === 'md');

    menu.addItem((item: MenuItem) => {
        item.setTitle(
            allMarkdown
                ? strings.contextMenu.file.openMultipleInNewTabs.replace('{count}', selectedCount.toString())
                : strings.contextMenu.file.openMultipleFilesInNewTabs.replace('{count}', selectedCount.toString())
        )
            .setIcon('file-plus')
            .onClick(async () => {
                const selectedFiles = Array.from(selectionState.selectedFiles)
                    .map(path => app.vault.getAbstractFileByPath(path))
                    .filter((f): f is TFile => f instanceof TFile);

                for (const selectedFile of selectedFiles) {
                    if (commandQueue) {
                        await commandQueue.executeOpenInNewContext(selectedFile, 'tab', async () => {
                            await app.workspace.getLeaf('tab').openFile(selectedFile);
                        });
                    } else {
                        await app.workspace.getLeaf('tab').openFile(selectedFile);
                    }
                }
            });
    });

    // Open to the right
    menu.addItem((item: MenuItem) => {
        item.setTitle(
            allMarkdown
                ? strings.contextMenu.file.openMultipleToRight.replace('{count}', selectedCount.toString())
                : strings.contextMenu.file.openMultipleFilesToRight.replace('{count}', selectedCount.toString())
        )
            .setIcon('vertical-three-dots')
            .onClick(async () => {
                const selectedFiles = Array.from(selectionState.selectedFiles)
                    .map(path => app.vault.getAbstractFileByPath(path))
                    .filter((f): f is TFile => f instanceof TFile);

                for (const selectedFile of selectedFiles) {
                    if (commandQueue) {
                        await commandQueue.executeOpenInNewContext(selectedFile, 'split', async () => {
                            await app.workspace.getLeaf('split').openFile(selectedFile);
                        });
                    } else {
                        await app.workspace.getLeaf('split').openFile(selectedFile);
                    }
                }
            });
    });

    // Open in new windows - desktop only
    if (!isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(
                allMarkdown
                    ? strings.contextMenu.file.openMultipleInNewWindows.replace('{count}', selectedCount.toString())
                    : strings.contextMenu.file.openMultipleFilesInNewWindows.replace('{count}', selectedCount.toString())
            )
                .setIcon('monitor')
                .onClick(async () => {
                    const selectedFiles = Array.from(selectionState.selectedFiles)
                        .map(path => app.vault.getAbstractFileByPath(path))
                        .filter((f): f is TFile => f instanceof TFile);

                    for (const selectedFile of selectedFiles) {
                        await app.workspace.getLeaf('window').openFile(selectedFile);
                    }
                });
        });
    }
}

/**
 * Add pin option for a single file
 */
function addSingleFilePinOption(menu: Menu, file: TFile, metadataService: MetadataService, context: NavigatorContext): void {
    const isPinned = metadataService.isFilePinned(file.path, context);

    menu.addItem((item: MenuItem) => {
        item.setTitle(
            isPinned
                ? file.extension === 'md'
                    ? strings.contextMenu.file.unpinNote
                    : strings.contextMenu.file.unpinFile
                : file.extension === 'md'
                  ? strings.contextMenu.file.pinNote
                  : strings.contextMenu.file.pinFile
        )
            .setIcon('pin')
            .onClick(async () => {
                if (!file.parent) return;

                await metadataService.togglePin(file.path, context);
            });
    });
}

/**
 * Add pin option for multiple files
 */
function addMultipleFilesPinOption(
    menu: Menu,
    selectedCount: number,
    selectionState: SelectionState,
    app: App,
    metadataService: MetadataService,
    context: NavigatorContext
): void {
    // Check if any selected files are unpinned
    const selectedFiles = Array.from(selectionState.selectedFiles)
        .map(path => app.vault.getAbstractFileByPath(path))
        .filter((f): f is TFile => f instanceof TFile);

    const anyUnpinned = selectedFiles.some(f => {
        return !metadataService.isFilePinned(f.path, context);
    });

    // Check if all files are markdown
    const allMarkdown = selectedFiles.every(f => f.extension === 'md');

    menu.addItem((item: MenuItem) => {
        item.setTitle(
            anyUnpinned
                ? allMarkdown
                    ? strings.contextMenu.file.pinMultipleNotes.replace('{count}', selectedCount.toString())
                    : strings.contextMenu.file.pinMultipleFiles.replace('{count}', selectedCount.toString())
                : allMarkdown
                  ? strings.contextMenu.file.unpinMultipleNotes.replace('{count}', selectedCount.toString())
                  : strings.contextMenu.file.unpinMultipleFiles.replace('{count}', selectedCount.toString())
        )
            .setIcon('pin')
            .onClick(async () => {
                for (const selectedFile of selectedFiles) {
                    if (anyUnpinned) {
                        // Pin all unpinned files
                        if (!metadataService.isFilePinned(selectedFile.path, context)) {
                            await metadataService.togglePin(selectedFile.path, context);
                        }
                    } else {
                        // Unpin all files
                        await metadataService.togglePin(selectedFile.path, context);
                    }
                }
            });
    });
}

/**
 * Add duplicate option for a single file
 */
function addSingleFileDuplicateOption(menu: Menu, file: TFile, fileSystemOps: FileSystemOperations): void {
    menu.addItem((item: MenuItem) => {
        item.setTitle(file.extension === 'md' ? strings.contextMenu.file.duplicateNote : strings.contextMenu.file.duplicateFile)
            .setIcon('documents')
            .onClick(async () => {
                await fileSystemOps.duplicateNote(file);
            });
    });
}

/**
 * Add duplicate option for multiple files
 */
function addMultipleFilesDuplicateOption(
    menu: Menu,
    selectedCount: number,
    selectionState: SelectionState,
    app: App,
    fileSystemOps: FileSystemOperations
): void {
    // Check if all files are markdown
    const selectedFiles = Array.from(selectionState.selectedFiles)
        .map(path => app.vault.getAbstractFileByPath(path))
        .filter((f): f is TFile => f instanceof TFile);
    const allMarkdown = selectedFiles.every(f => f.extension === 'md');

    menu.addItem((item: MenuItem) => {
        item.setTitle(
            allMarkdown
                ? strings.contextMenu.file.duplicateMultipleNotes.replace('{count}', selectedCount.toString())
                : strings.contextMenu.file.duplicateMultipleFiles.replace('{count}', selectedCount.toString())
        )
            .setIcon('documents')
            .onClick(async () => {
                // Duplicate all selected files
                const selectedFiles = Array.from(selectionState.selectedFiles)
                    .map(path => app.vault.getAbstractFileByPath(path))
                    .filter((f): f is TFile => f instanceof TFile);

                for (const selectedFile of selectedFiles) {
                    await fileSystemOps.duplicateNote(selectedFile);
                }
            });
    });
}

/**
 * Add delete option for a single file
 */
function addSingleFileDeleteOption(
    menu: Menu,
    file: TFile,
    selectionState: SelectionState,
    settings: NotebookNavigatorSettings,
    fileSystemOps: FileSystemOperations,
    selectionDispatch: React.Dispatch<SelectionAction>
): void {
    menu.addItem((item: MenuItem) => {
        item.setTitle(file.extension === 'md' ? strings.contextMenu.file.deleteNote : strings.contextMenu.file.deleteFile)
            .setIcon('trash')
            .onClick(async () => {
                // Check if this is the currently selected file
                if (selectionState.selectedFile?.path === file.path) {
                    // Use the smart delete handler
                    await fileSystemOps.deleteSelectedFile(
                        file,
                        settings,
                        {
                            selectionType: selectionState.selectionType,
                            selectedFolder: selectionState.selectedFolder || undefined,
                            selectedTag: selectionState.selectedTag || undefined
                        },
                        selectionDispatch,
                        settings.confirmBeforeDelete
                    );
                } else {
                    // Normal deletion - not the currently selected file
                    await fileSystemOps.deleteFile(file, settings.confirmBeforeDelete);
                }
            });
    });
}

/**
 * Add delete option for multiple files
 */
function addMultipleFilesDeleteOption(
    menu: Menu,
    selectedCount: number,
    selectionState: SelectionState,
    settings: NotebookNavigatorSettings,
    fileSystemOps: FileSystemOperations,
    selectionDispatch: React.Dispatch<SelectionAction>,
    cachedFileList: TFile[],
    cachedSelectedFiles: TFile[]
): void {
    // Use cached files
    const selectedFiles = cachedSelectedFiles;
    const allMarkdown = selectedFiles.every(f => f.extension === 'md');

    menu.addItem((item: MenuItem) => {
        item.setTitle(
            allMarkdown
                ? strings.contextMenu.file.deleteMultipleNotes.replace('{count}', selectedCount.toString())
                : strings.contextMenu.file.deleteMultipleFiles.replace('{count}', selectedCount.toString())
        )
            .setIcon('trash')
            .onClick(async () => {
                // Use centralized delete method with smart selection
                await fileSystemOps.deleteFilesWithSmartSelection(
                    selectionState.selectedFiles,
                    cachedFileList,
                    settings,
                    {
                        selectionType: selectionState.selectionType,
                        selectedFolder: selectionState.selectedFolder || undefined,
                        selectedTag: selectionState.selectedTag || undefined
                    },
                    selectionDispatch,
                    settings.confirmBeforeDelete
                );
            });
    });
}
