/*
 * Notebook Navigator - Plugin for Obsidian
 */

import { TFile, TFolder } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { strings } from '../../i18n';

export default function registerWorkspaceEvents(plugin: NotebookNavigatorPlugin): void {
    plugin.registerEvent(
        plugin.app.workspace.on('editor-menu', (menu, _, view) => {
            const file = view.file;
            if (!file) {
                return;
            }

            menu.addSeparator();
            menu.addItem(item => {
                item.setTitle(strings.plugin.revealInNavigator)
                    .setIcon('lucide-folder-open')
                    .onClick(async () => {
                        await plugin.activateView();
                        await plugin.revealFileInActualFolder(file);
                    });
            });
        })
    );

    plugin.ribbonIconEl = plugin.addRibbonIcon('lucide-notebook', strings.plugin.ribbonTooltip, async () => {
        await plugin.activateView();
    });

    plugin.registerEvent(
        plugin.app.workspace.on('file-open', file => {
            if (!(file instanceof TFile) || plugin.isFileInRightSidebar(file)) {
                return;
            }

            plugin.recentNotesService?.recordFileOpen(file);
        })
    );

    const initialActiveFile = plugin.app.workspace.getActiveFile();
    if (initialActiveFile instanceof TFile && !plugin.isFileInRightSidebar(initialActiveFile)) {
        plugin.recentNotesService?.recordFileOpen(initialActiveFile);
    }

    plugin.registerEvent(
        plugin.app.vault.on('rename', async (file, oldPath) => {
            if (plugin.isShuttingDown()) {
                return;
            }

            if (file instanceof TFolder) {
                await plugin.metadataService?.handleFolderRename(oldPath, file.path);
                return;
            }

            if (!(file instanceof TFile)) {
                return;
            }

            plugin.recentNotesService?.renameEntry(oldPath, file.path);
            await plugin.metadataService?.handleFileRename(oldPath, file.path);

            const getParentPath = (path: string): string => {
                const lastSlash = path.lastIndexOf('/');
                return lastSlash > 0 ? path.substring(0, lastSlash) : '/';
            };

            const movedToDifferentFolder = getParentPath(oldPath) !== getParentPath(file.path);
            if (movedToDifferentFolder && file === plugin.app.workspace.getActiveFile()) {
                if (!plugin.commandQueue?.isMovingFile()) {
                    await plugin.revealFileInActualFolder(file);
                }
            }

            plugin.notifyFileRenameListeners(oldPath, file.path);
        })
    );

    plugin.registerEvent(
        plugin.app.vault.on('delete', async file => {
            if (plugin.isShuttingDown()) {
                return;
            }

            if (file instanceof TFolder) {
                await plugin.metadataService?.handleFolderDelete(file.path);
                return;
            }

            if (!(file instanceof TFile)) {
                return;
            }

            plugin.recentNotesService?.removeEntry(file.path);
            if (plugin.metadataService) {
                await plugin.metadataService.handleFileDelete(file.path);
            }
        })
    );
}
