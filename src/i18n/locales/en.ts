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

/**
 * English language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_EN = {
    // Common UI elements
    common: {
        cancel: 'Cancel',
        delete: 'Delete',
        submit: 'Submit',
        noSelection: 'No selection',
        untagged: 'Untagged',
        untitled: 'Untitled',
        featureImageAlt: 'Feature image',
    },

    // File list
    fileList: {
        emptyStateNoSelection: 'Select a folder or tag to view notes',
        emptyStateNoNotes: 'No notes',
        pinnedSection: '📌 Pinned',
    },

    // Folder tree
    folderTree: {
        rootFolderName: 'Vault',
    },

    // Tag list
    tagList: {
        sectionHeader: 'Tags',
        untaggedLabel: 'Untagged',
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Collapse all folders',
        expandAllFolders: 'Expand all folders',
        newFolder: 'New folder',
        newNote: 'New note',
        mobileBackToFolders: 'Back to folders',
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Open in new tab',
            openToRight: 'Open to the right',
            openInNewWindow: 'Open in new window',
            pinNote: 'Pin note',
            unpinNote: 'Unpin note',
            duplicateNote: 'Duplicate note',
            openVersionHistory: 'Open version history',
            revealInFinder: 'Reveal in Finder',
            showInExplorer: 'Show in system explorer',
            renameNote: 'Rename note',
            deleteNote: 'Delete note',
        },
        folder: {
            newNote: 'New note',
            newFolder: 'New folder',
            newCanvas: 'New canvas',
            newBase: 'New base',
            duplicateFolder: 'Duplicate folder',
            searchInFolder: 'Search in folder',
            changeIcon: 'Change icon',
            removeIcon: 'Remove icon',
            changeColor: 'Change color',
            removeColor: 'Remove color',
            renameFolder: 'Rename folder',
            deleteFolder: 'Delete folder',
        },
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Search icons...',
            recentlyUsedHeader: 'Recently used',
            emptyStateSearch: 'Start typing to search icons',
            emptyStateNoResults: 'No icons found',
            showingResultsInfo: 'Showing 50 of {count} results. Type more to narrow down.',
        },
        colorPicker: {
            header: 'Choose folder color',
            colors: {
                red: 'Red',
                orange: 'Orange',
                amber: 'Amber',
                yellow: 'Yellow',
                lime: 'Lime',
                green: 'Green',
                emerald: 'Emerald',
                teal: 'Teal',
                cyan: 'Cyan',
                sky: 'Sky',
                blue: 'Blue',
                indigo: 'Indigo',
                violet: 'Violet',
                purple: 'Purple',
                fuchsia: 'Fuchsia',
                pink: 'Pink',
                rose: 'Rose',
                gray: 'Gray',
                slate: 'Slate',
                stone: 'Stone',
            },
        },
        fileSystem: {
            newFolderTitle: 'New folder',
            renameFolderTitle: 'Rename folder',
            renameFileTitle: 'Rename file',
            deleteFolderTitle: 'Delete \'{name}\'?',
            deleteFileTitle: 'Delete \'{name}\'?',
            folderNamePrompt: 'Enter folder name:',
            renamePrompt: 'Enter new name:',
            deleteFolderConfirm: 'Are you sure you want to delete this folder and all its contents?',
            deleteFileConfirm: 'Are you sure you want to delete this file?',
        },
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Failed to create folder: {error}',
            createFile: 'Failed to create file: {error}',
            renameFolder: 'Failed to rename folder: {error}',
            renameFile: 'Failed to rename file: {error}',
            deleteFolder: 'Failed to delete folder: {error}',
            deleteFile: 'Failed to delete file: {error}',
            duplicateNote: 'Failed to duplicate note: {error}',
            createCanvas: 'Failed to create canvas: {error}',
            createDatabase: 'Failed to create database: {error}',
            duplicateFolder: 'Failed to duplicate folder: {error}',
            openVersionHistory: 'Failed to open version history: {error}',
            versionHistoryNotFound: 'Version history command not found. Ensure Obsidian Sync is enabled.',
            revealInExplorer: 'Failed to reveal file in system explorer: {error}',
        },
        defaultNames: {
            untitled: 'Untitled',
            untitledNumber: 'Untitled {number}',
        },
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Cannot move a folder into itself or a subfolder.',
            itemAlreadyExists: 'An item named "{name}" already exists in this location.',
            failedToMove: 'Failed to move: {error}',
        },
    },

    // Date grouping
    dateGroups: {
        today: 'Today',
        yesterday: 'Yesterday',
        previous7Days: 'Previous 7 days',
        previous30Days: 'Previous 30 days',
    },

    // Plugin commands
    commands: {
        open: 'Open',
        revealActiveFile: 'Reveal active file',
        focusFileList: 'Focus file list',
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator',
        ribbonTooltip: 'Notebook Navigator',
        revealInNavigator: 'Reveal in Notebook Navigator',
    },

    // Settings
    settings: {
        sections: {
            noteDisplay: 'Note display',
            folderDisplay: 'Folder display',
            tagDisplay: 'Tag display',
            advanced: 'Advanced',
        },
        items: {
            sortNotesBy: {
                name: 'Sort notes by',
                desc: 'Choose how notes are sorted in the note list.',
                options: {
                    modified: 'Date edited',
                    created: 'Date created',
                    title: 'Title',
                },
            },
            groupByDate: {
                name: 'Group notes by date',
                desc: 'When sorted by date, group notes under date headers.',
            },
            showNotesFromSubfolders: {
                name: 'Show notes from subfolders',
                desc: 'Display all notes from subfolders in the current folder view.',
            },
            autoRevealActiveNote: {
                name: 'Auto-reveal active note',
                desc: 'Automatically reveal and select notes when opened from Quick Switcher, links, or search.',
            },
            excludedNotes: {
                name: 'Excluded notes',
                desc: 'Comma-separated list of frontmatter properties. Notes containing any of these properties will be hidden (e.g., draft, private, archived).',
                placeholder: 'draft, private',
            },
            excludedFolders: {
                name: 'Excluded folders',
                desc: 'Comma-separated list of folders to hide (e.g., resources, templates).',
                placeholder: 'folder1, folder2',
            },
            showDate: {
                name: 'Show date',
                desc: 'Display the date below note names.',
            },
            dateFormat: {
                name: 'Date format',
                desc: 'Format for displaying dates (uses date-fns format).',
                placeholder: 'MMM d, yyyy',
                help: 'Common formats:\nMMM d, yyyy = May 25, 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = year\nMMMM/MMM/MM = month\ndd/d = day\nEEEE/EEE = weekday',
                helpTooltip: 'Click for format reference',
            },
            showFilePreview: {
                name: 'Show note preview',
                desc: 'Display preview text beneath note names.',
            },
            skipHeadingsInPreview: {
                name: 'Skip headings in preview',
                desc: 'Skip heading lines when generating preview text.',
            },
            skipNonTextInPreview: {
                name: 'Skip non-text in preview',
                desc: 'Skip images, embeds, and other non-text elements from preview text.',
            },
            previewRows: {
                name: 'Preview rows',
                desc: 'Number of rows to display for preview text.',
                options: {
                    '1': '1 row',
                    '2': '2 rows',
                    '3': '3 rows',
                    '4': '4 rows',
                    '5': '5 rows',
                },
            },
            showFeatureImage: {
                name: 'Show feature image',
                desc: 'Display thumbnail images from frontmatter. Tip: Use the "Featured Image" plugin to automatically set feature images for all your documents.',
            },
            featureImageProperty: {
                name: 'Feature image property',
                desc: 'The frontmatter property name for thumbnail images.',
                placeholder: 'feature',
            },
            showRootFolder: {
                name: 'Show root folder',
                desc: 'Display "Vault" as the root folder in the tree.',
            },
            showFolderFileCount: {
                name: 'Show folder note count',
                desc: 'Display the number of notes in each folder.',
            },
            showFolderIcons: {
                name: 'Show folder icons',
                desc: 'Display icons next to folder names in the tree.',
            },
            showTags: {
                name: 'Show tags',
                desc: 'Display tags section below folders in the navigator.',
            },
            showUntagged: {
                name: 'Show untagged notes',
                desc: 'Display "Untagged" item for notes without any tags.',
            },
            confirmBeforeDelete: {
                name: 'Confirm before deleting notes',
                desc: 'Show confirmation dialog when deleting notes or folders',
            },
            clearSavedState: {
                name: 'Clear saved state',
                desc: 'Reset expanded folders, selections, and pane width to defaults.',
                buttonText: 'Clear state',
                successMessage: 'Navigator state cleared. Refresh the view to see changes.',
            },
            supportDevelopment: {
                name: 'Support development',
                desc: 'If you enjoy using Notebook Navigator, please consider supporting its continued development.',
                buttonText: '❤️ Sponsor on GitHub',
            },
        },
    },
};