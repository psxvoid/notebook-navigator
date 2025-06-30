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

import { MenuItem, Notice } from 'obsidian';
import { TagMenuBuilderParams } from './menuTypes';
import { strings } from '../../i18n';
import { getFilesForTag } from '../../utils/fileFinder';
import { TagOperationModal } from '../../modals/TagOperationModal';

/**
 * Builds the context menu for a tag
 */
export function buildTagMenu(params: TagMenuBuilderParams): void {
    const { tagPath, menu, services, settings, dispatchers } = params;
    const { app, metadataService, tagOperations } = services;

    // Change icon
    menu.addItem((item: MenuItem) => {
        item
            .setTitle(strings.contextMenu.tag.changeIcon)
            .setIcon('palette')
            .onClick(async () => {
                const { IconPickerModal } = await import('../../modals/IconPickerModal');
                const modal = new IconPickerModal(
                    app, 
                    metadataService, 
                    tagPath,
                    settings.recentlyUsedIcons || [],
                    'tag'
                );
                modal.open();
            });
    });

    // Remove icon (only show if custom icon is set)
    const currentIcon = metadataService.getTagIcon(tagPath);
    if (currentIcon) {
        menu.addItem((item: MenuItem) => {
            item
                .setTitle(strings.contextMenu.tag.removeIcon)
                .setIcon('x')
                .onClick(async () => {
                    await metadataService.removeTagIcon(tagPath);
                });
        });
    }

    menu.addSeparator();

    // Change color
    menu.addItem((item: MenuItem) => {
        item
            .setTitle(strings.contextMenu.tag.changeColor)
            .setIcon('palette')
            .onClick(async () => {
                const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                const modal = new ColorPickerModal(app, metadataService, tagPath, 'tag');
                modal.open();
            });
    });

    // Remove color (only show if custom color is set)
    const currentColor = metadataService.getTagColor(tagPath);
    if (currentColor) {
        menu.addItem((item: MenuItem) => {
            item
                .setTitle(strings.contextMenu.tag.removeColor)
                .setIcon('x')
                .onClick(async () => {
                    await metadataService.removeTagColor(tagPath);
                });
        });
    }

    menu.addSeparator();

    // Rename tag
    menu.addItem((item: MenuItem) => {
        item
            .setTitle(strings.contextMenu.tag.renameTag)
            .setIcon('pencil')
            .onClick(async () => {
                // Find all files with this tag
                const affectedFiles = getFilesForTag(tagPath, settings, app);
                
                const modal = new TagOperationModal(app, {
                    operation: 'rename',
                    tagPath: tagPath,
                    newTagPath: tagPath, // Pre-fill with current tag name (without #)
                    affectedFiles: affectedFiles,
                    onConfirm: async () => {
                        if (!modal.newTagInput) {
                            return;
                        }
                        
                        const newTagPath = modal.newTagInput;
                        
                        // Check if tag already exists
                        const existingFiles = getFilesForTag(newTagPath, settings, app);
                        if (existingFiles.length > 0) {
                            new Notice(strings.fileSystem.errors.tagAlreadyExists.replace('{tag}', '#' + newTagPath));
                            return;
                        }
                        
                        try {
                            // Rename the tag in all affected files
                            await tagOperations.renameTag(tagPath, newTagPath, affectedFiles);
                            
                            // Update metadata for the tag
                            await metadataService.handleTagRename(tagPath, newTagPath);
                            
                            new Notice(strings.fileSystem.notifications.tagRenamed
                                .replace('{oldTag}', '#' + tagPath)
                                .replace('{newTag}', '#' + newTagPath)
                                .replace('{count}', affectedFiles.length.toString()));
                        } catch (error) {
                            new Notice(strings.fileSystem.errors.renameTag.replace('{error}', error.message));
                        }
                    }
                });
                
                modal.open();
            });
    });

    // Delete tag
    menu.addItem((item: MenuItem) => {
        item
            .setTitle(strings.contextMenu.tag.deleteTag)
            .setIcon('trash')
            .onClick(async () => {
                // Find all files with this tag
                const affectedFiles = getFilesForTag(tagPath, settings, app);
                
                const modal = new TagOperationModal(app, {
                    operation: 'delete',
                    tagPath: tagPath,
                    affectedFiles: affectedFiles,
                    onConfirm: async () => {
                        try {
                            // Delete the tag from all affected files
                            await tagOperations.deleteTag(tagPath, affectedFiles);
                            
                            // Clean up metadata for the tag
                            await metadataService.handleTagDelete(tagPath);
                            
                            new Notice(strings.fileSystem.notifications.tagDeleted
                                .replace('{tag}', '#' + tagPath)
                                .replace('{count}', affectedFiles.length.toString()));
                        } catch (error) {
                            new Notice(strings.fileSystem.errors.deleteTag.replace('{error}', error.message));
                        }
                    }
                });
                
                modal.open();
            });
    });
}