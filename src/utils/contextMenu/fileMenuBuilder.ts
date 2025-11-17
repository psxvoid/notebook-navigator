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

import { MenuItem, TFile, Menu, App, Platform, FileSystemAdapter } from 'obsidian';
import { FileMenuBuilderParams } from './menuTypes';
import { strings } from '../../i18n';
import { getInternalPlugin } from '../../utils/typeGuards';
import { getFilesForFolder, getFilesForTag } from '../../utils/fileFinder';
import { ItemType, NavigatorContext } from '../../types';
import { MetadataService } from '../../services/MetadataService';
import { FileSystemOperations } from '../../services/FileSystemService';
import { SelectionState, SelectionAction } from '../../context/SelectionContext';
import { NotebookNavigatorSettings } from '../../settings';
import { CommandQueueService } from '../../services/CommandQueueService';
import { setAsyncOnClick } from './menuAsyncHelpers';
import { openFileInContext } from '../openFileInContext';
import { showNotice } from '../noticeUtils';
import { confirmRemoveAllTagsFromFiles, openAddTagToFilesModal, removeTagFromFilesWithPrompt } from '../tagModalHelpers';

/**
 * Builds the context menu for a file
 */
export function buildFileMenu(params: FileMenuBuilderParams): void {
    const { file, menu, services, settings, state, dispatchers } = params;
    const { app, isMobile, fileSystemOps, metadataService, tagTreeService, commandQueue, visibility } = services;
    const { selectionState } = state;
    const { selectionDispatch } = dispatchers;

    // Show file name on mobile
    if (isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(file.basename).setIsLabel(true);
        });
    }

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
            return getFilesForFolder(selectionState.selectedFolder, settings, visibility, app);
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return getFilesForTag(selectionState.selectedTag, settings, visibility, app, tagTreeService);
        }
        return [];
    })();

    // Cache selected files to avoid repeated path-to-file conversions
    const cachedSelectedFiles = shouldShowMultiOptions
        ? Array.from(selectionState.selectedFiles)
              .map(path => app.vault.getFileByPath(path))
              .filter((f): f is TFile => !!f)
        : [];

    // Open options - show for single or multiple selection
    if (!shouldShowMultiOptions) {
        addSingleFileOpenOptions(menu, file, app, isMobile, commandQueue);
    } else {
        addMultipleFilesOpenOptions(menu, selectedCount, selectionState, app, isMobile, cachedSelectedFiles, commandQueue);
    }

    menu.addSeparator();

    // Icon and color customization options - single selection only
    const canCustomizeFileIcon = !shouldShowMultiOptions;
    const canCustomizeFileColor = !shouldShowMultiOptions;
    if (canCustomizeFileIcon || canCustomizeFileColor) {
        if (canCustomizeFileIcon) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.file.changeIcon).setIcon('lucide-image'), async () => {
                    const { IconPickerModal } = await import('../../modals/IconPickerModal');
                    const modal = new IconPickerModal(app, metadataService, file.path, ItemType.FILE);
                    modal.open();
                });
            });
        }

        if (canCustomizeFileColor) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.file.changeColor).setIcon('lucide-palette'), async () => {
                    const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                    const modal = new ColorPickerModal(app, metadataService, file.path, ItemType.FILE, 'foreground');
                    modal.open();
                });
            });
        }

        menu.addSeparator();
    }

    const filesForTagOps = shouldShowMultiOptions ? cachedSelectedFiles : [file];
    // Only show tag operations if all files are markdown (tags only work with markdown)
    const canManageTags = filesForTagOps.length > 0 && filesForTagOps.every(f => f.extension === 'md');

    if (canManageTags) {
        // Tag operations
        // Check if files have tags
        const existingTags = services.tagOperations.getTagsFromFiles(filesForTagOps);
        const hasTags = existingTags.length > 0;
        const hasMultipleTags = existingTags.length > 1;

        // Add tag - shown when every selected file supports frontmatter
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.file.addTag).setIcon('lucide-tag'), () => {
                openAddTagToFilesModal({
                    app,
                    plugin: services.plugin,
                    tagOperations: services.tagOperations,
                    files: filesForTagOps
                });
            });
        });

        // Remove tag - only show if files have tags
        if (hasTags) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.file.removeTag).setIcon('lucide-minus'), async () => {
                    await removeTagFromFilesWithPrompt({
                        app,
                        tagOperations: services.tagOperations,
                        files: filesForTagOps
                    });
                });
            });

            // Remove all tags - only show if files have multiple tags
            if (hasMultipleTags) {
                menu.addItem((item: MenuItem) => {
                    setAsyncOnClick(item.setTitle(strings.contextMenu.file.removeAllTags).setIcon('lucide-x'), () => {
                        confirmRemoveAllTagsFromFiles({
                            app,
                            tagOperations: services.tagOperations,
                            files: filesForTagOps
                        });
                    });
                });
            }
        }

        menu.addSeparator();
    }

    // Add to shortcuts / Remove from shortcuts and Pin/Unpin - single selection only
    if (!shouldShowMultiOptions) {
        if (services.shortcuts) {
            const { noteShortcutKeysByPath, addNoteShortcut, removeShortcut } = services.shortcuts;
            const existingShortcutKey = noteShortcutKeysByPath.get(file.path);

            menu.addItem((item: MenuItem) => {
                if (existingShortcutKey) {
                    setAsyncOnClick(item.setTitle(strings.shortcuts.remove).setIcon('lucide-bookmark-x'), async () => {
                        await removeShortcut(existingShortcutKey);
                    });
                } else {
                    setAsyncOnClick(item.setTitle(strings.shortcuts.add).setIcon('lucide-bookmark'), async () => {
                        await addNoteShortcut(file.path);
                    });
                }
            });
        }

        const pinContext: NavigatorContext = selectionState.selectionType === ItemType.TAG ? 'tag' : 'folder';
        addSingleFilePinOption(menu, file, metadataService, pinContext);

        menu.addSeparator();
    }

    // Pin/Unpin for multiple files
    if (shouldShowMultiOptions) {
        const pinContext: NavigatorContext = selectionState.selectionType === ItemType.TAG ? 'tag' : 'folder';
        addMultipleFilesPinOption(menu, selectedCount, selectionState, app, metadataService, pinContext);

        menu.addSeparator();

        // Move, Duplicate, Delete - grouped together
        // Move note(s) to folder
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(
                item
                    .setTitle(strings.contextMenu.file.moveMultipleToFolder.replace('{count}', selectedCount.toString()))
                    .setIcon('lucide-folder-input'),
                async () => {
                    await fileSystemOps.moveFilesWithModal(cachedSelectedFiles, {
                        selectedFile: selectionState.selectedFile,
                        dispatch: selectionDispatch,
                        allFiles: cachedFileList
                    });
                }
            );
        });

        // Duplicate note(s)
        addMultipleFilesDuplicateOption(menu, selectedCount, selectionState, app, fileSystemOps);

        // Delete note(s)
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

    // Copy actions - single selection only
    if (!shouldShowMultiOptions) {
        const adapter = app.vault.adapter;

        // Copy relative path
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.file.copyRelativePath).setIcon('lucide-clipboard-list'), async () => {
                await navigator.clipboard.writeText(file.path);
                showNotice(strings.fileSystem.notifications.relativePathCopied, { variant: 'success' });
            });
        });

        // Copy absolute path if available
        if (adapter instanceof FileSystemAdapter) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.file.copyPath).setIcon('lucide-clipboard'), async () => {
                    // Get full system path from the file system adapter
                    const absolutePath = adapter.getFullPath(file.path);
                    await navigator.clipboard.writeText(absolutePath);
                    showNotice(strings.fileSystem.notifications.pathCopied, { variant: 'success' });
                });
            });
        }

        // Copy Obsidian URL
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.file.copyDeepLink).setIcon('lucide-link'), async () => {
                const vaultName = app.vault.getName();
                const encodedVault = encodeURIComponent(vaultName);
                const encodedFile = encodeURIComponent(file.path);
                // Construct Obsidian URL with encoded vault and file path
                const deepLink = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;

                await navigator.clipboard.writeText(deepLink);
                showNotice(strings.fileSystem.notifications.deepLinkCopied, { variant: 'success' });
            });
        });

        menu.addSeparator();
    }

    // Reveal options - single selection only
    if (!shouldShowMultiOptions) {
        // Check if file is already visible in the current folder view
        const isFileInSelectedFolder =
            selectionState.selectedFolder && file.parent && file.parent.path === selectionState.selectedFolder.path;
        // Only allow revealing in folder if file is not already visible
        const canRevealInFolder = !isFileInSelectedFolder;
        // System explorer reveal is desktop-only
        const canRevealInSystemExplorer = !isMobile;

        if (canRevealInFolder) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.file.revealInFolder).setIcon('lucide-folder-search'), async () => {
                    await services.plugin.activateView();
                    await services.plugin.revealFileInActualFolder(file);
                });
            });
        }

        if (canRevealInSystemExplorer) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(
                    item
                        .setTitle(fileSystemOps.getRevealInSystemExplorerText())
                        .setIcon(Platform.isMacOS ? 'lucide-app-window-mac' : 'lucide-app-window'),
                    async () => {
                        await fileSystemOps.revealInSystemExplorer(file);
                    }
                );
            });
        }

        if (canRevealInFolder || canRevealInSystemExplorer) {
            menu.addSeparator();
        }
    }

    // Open version history, Rename, Move, Duplicate, Delete - single selection only
    if (!shouldShowMultiOptions) {
        // Open version history (if Sync is enabled)
        const syncPlugin = getInternalPlugin(app, 'sync');
        if (syncPlugin && 'enabled' in syncPlugin && syncPlugin.enabled) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.file.openVersionHistory).setIcon('lucide-history'), async () => {
                    await fileSystemOps.openVersionHistory(file);
                });
            });
        }

        // Rename note
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(
                item
                    .setTitle(isMarkdown ? strings.contextMenu.file.renameNote : strings.contextMenu.file.renameFile)
                    .setIcon('lucide-pencil'),
                async () => {
                    await fileSystemOps.renameFile(file);
                }
            );
        });

        // Move to folder
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.file.moveToFolder).setIcon('lucide-folder-input'), async () => {
                await fileSystemOps.moveFilesWithModal([file], {
                    selectedFile: selectionState.selectedFile,
                    dispatch: selectionDispatch,
                    allFiles: cachedFileList
                });
            });
        });

        // Duplicate note
        addSingleFileDuplicateOption(menu, file, fileSystemOps);

        // Delete note
        addSingleFileDeleteOption(menu, file, selectionState, settings, fileSystemOps, selectionDispatch);
    }
}

/**
 * Add open options for a single file
 */
function addSingleFileOpenOptions(menu: Menu, file: TFile, app: App, isMobile: boolean, commandQueue: CommandQueueService | null): void {
    // Open in new tab
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.file.openInNewTab).setIcon('lucide-file-plus'), async () => {
            await openFileInContext({ app, commandQueue, file, context: 'tab' });
        });
    });

    // Open to the right
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.file.openToRight).setIcon('lucide-separator-vertical'), async () => {
            await openFileInContext({ app, commandQueue, file, context: 'split' });
        });
    });

    // Open in new window - desktop only
    if (!isMobile) {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.file.openInNewWindow).setIcon('lucide-external-link'), async () => {
                await openFileInContext({ app, commandQueue, file, context: 'window' });
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
            .map(path => app.vault.getFileByPath(path))
            .filter((f): f is TFile => !!f);
    const allMarkdown = selectedFiles.every(f => f.extension === 'md');

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(
            item
                .setTitle(
                    allMarkdown
                        ? strings.contextMenu.file.openMultipleInNewTabs.replace('{count}', selectedCount.toString())
                        : strings.contextMenu.file.openMultipleFilesInNewTabs.replace('{count}', selectedCount.toString())
                )
                .setIcon('lucide-file-plus'),
            async () => {
                for (const selectedFile of selectedFiles) {
                    await openFileInContext({
                        app,
                        commandQueue: commandQueue ?? null,
                        file: selectedFile,
                        context: 'tab'
                    });
                }
            }
        );
    });

    // Open to the right
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(
            item
                .setTitle(
                    allMarkdown
                        ? strings.contextMenu.file.openMultipleToRight.replace('{count}', selectedCount.toString())
                        : strings.contextMenu.file.openMultipleFilesToRight.replace('{count}', selectedCount.toString())
                )
                .setIcon('lucide-separator-vertical'),
            async () => {
                for (const selectedFile of selectedFiles) {
                    await openFileInContext({
                        app,
                        commandQueue: commandQueue ?? null,
                        file: selectedFile,
                        context: 'split'
                    });
                }
            }
        );
    });

    // Open in new windows - desktop only
    if (!isMobile) {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(
                item
                    .setTitle(
                        allMarkdown
                            ? strings.contextMenu.file.openMultipleInNewWindows.replace('{count}', selectedCount.toString())
                            : strings.contextMenu.file.openMultipleFilesInNewWindows.replace('{count}', selectedCount.toString())
                    )
                    .setIcon('lucide-external-link'),
                async () => {
                    for (const selectedFile of selectedFiles) {
                        await openFileInContext({
                            app,
                            commandQueue: commandQueue ?? null,
                            file: selectedFile,
                            context: 'window'
                        });
                    }
                }
            );
        });
    }
}

/**
 * Add pin option for a single file
 */
function addSingleFilePinOption(menu: Menu, file: TFile, metadataService: MetadataService, context: NavigatorContext): void {
    const isPinned = metadataService.isFilePinned(file.path, context);

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(
            item
                .setTitle(
                    isPinned
                        ? file.extension === 'md'
                            ? strings.contextMenu.file.unpinNote
                            : strings.contextMenu.file.unpinFile
                        : file.extension === 'md'
                          ? strings.contextMenu.file.pinNote
                          : strings.contextMenu.file.pinFile
                )
                .setIcon('lucide-pin'),
            async () => {
                if (!file.parent) return;

                await metadataService.togglePin(file.path, context);
            }
        );
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
        .map(path => app.vault.getFileByPath(path))
        .filter((f): f is TFile => !!f);

    const anyUnpinned = selectedFiles.some(f => {
        return !metadataService.isFilePinned(f.path, context);
    });

    // Check if all files are markdown
    const allMarkdown = selectedFiles.every(f => f.extension === 'md');

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(
            item
                .setTitle(
                    anyUnpinned
                        ? allMarkdown
                            ? strings.contextMenu.file.pinMultipleNotes.replace('{count}', selectedCount.toString())
                            : strings.contextMenu.file.pinMultipleFiles.replace('{count}', selectedCount.toString())
                        : allMarkdown
                          ? strings.contextMenu.file.unpinMultipleNotes.replace('{count}', selectedCount.toString())
                          : strings.contextMenu.file.unpinMultipleFiles.replace('{count}', selectedCount.toString())
                )
                .setIcon('lucide-pin'),
            async () => {
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
            }
        );
    });
}

/**
 * Add duplicate option for a single file
 */
function addSingleFileDuplicateOption(menu: Menu, file: TFile, fileSystemOps: FileSystemOperations): void {
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(
            item
                .setTitle(file.extension === 'md' ? strings.contextMenu.file.duplicateNote : strings.contextMenu.file.duplicateFile)
                .setIcon('lucide-copy'),
            async () => {
                await fileSystemOps.duplicateNote(file);
            }
        );
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
        .map(path => app.vault.getFileByPath(path))
        .filter((f): f is TFile => !!f);
    const allMarkdown = selectedFiles.every(f => f.extension === 'md');

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(
            item
                .setTitle(
                    allMarkdown
                        ? strings.contextMenu.file.duplicateMultipleNotes.replace('{count}', selectedCount.toString())
                        : strings.contextMenu.file.duplicateMultipleFiles.replace('{count}', selectedCount.toString())
                )
                .setIcon('lucide-copy'),
            async () => {
                // Duplicate all selected files
                const selectedFiles = Array.from(selectionState.selectedFiles)
                    .map(path => app.vault.getFileByPath(path))
                    .filter((f): f is TFile => !!f);

                for (const selectedFile of selectedFiles) {
                    await fileSystemOps.duplicateNote(selectedFile);
                }
            }
        );
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
        setAsyncOnClick(
            item
                .setTitle(file.extension === 'md' ? strings.contextMenu.file.deleteNote : strings.contextMenu.file.deleteFile)
                .setIcon('lucide-trash'),
            async () => {
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
            }
        );
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
        setAsyncOnClick(
            item
                .setTitle(
                    allMarkdown
                        ? strings.contextMenu.file.deleteMultipleNotes.replace('{count}', selectedCount.toString())
                        : strings.contextMenu.file.deleteMultipleFiles.replace('{count}', selectedCount.toString())
                )
                .setIcon('lucide-trash'),
            async () => {
                // Use centralized delete method with smart selection
                await fileSystemOps.deleteFilesWithSmartSelection(
                    selectionState.selectedFiles,
                    cachedFileList,
                    selectionDispatch,
                    settings.confirmBeforeDelete
                );
            }
        );
    });
}
