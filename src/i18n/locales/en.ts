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
        cancel: 'Cancel', // Button text for canceling dialogs and operations (English: Cancel)
        delete: 'Delete', // Button text for delete operations in dialogs (English: Delete)
        submit: 'Submit', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'No selection', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Untagged', // Label for notes without any tags (English: Untagged)
        untitled: 'Untitled', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'Feature image', // Alt text for thumbnail/preview images (English: Feature image)
    },

    // File list
    fileList: {
        emptyStateNoSelection: 'Select a folder or tag to view notes', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'No notes', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Pinned', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
    },

    // Folder tree
    folderTree: {
        rootFolderName: 'Vault', // Display name for the vault root folder in the tree (English: Vault)
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Untagged', // Label for the special item showing notes without tags (English: Untagged)
        favoriteTags: 'Favorites', // Label for the favorites virtual folder (English: Favorites)
        hiddenTags: 'Hidden tags', // Label for the hidden tags virtual folder (English: Hidden tags)
        allTags: 'Tags', // Label for the tags virtual folder when favorites exist (English: Tags)
        tags: 'Tags', // Label for the tags virtual folder when no favorites exist (English: Tags)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Collapse all', // Tooltip for button that collapses all expanded items (English: Collapse all)
        expandAllFolders: 'Expand all', // Tooltip for button that expands all items (English: Expand all)
        newFolder: 'New folder', // Tooltip for create new folder button (English: New folder)
        newNote: 'Create new note', // Tooltip for create new note button (English: Create new note)
        mobileBackToFolders: 'Back to folders', // Mobile-only back button text to return to folder list (English: Back to folders)
        changeSortOrder: 'Change sort order', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Default', // Label for default sorting mode (English: Default)
        customSort: 'Custom', // Label for custom sorting mode (English: Custom)
        showFolders: 'Show navigation', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'Hide navigation', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        toggleSubfolders: 'Show notes from subfolders', // Tooltip for button to toggle showing notes from subfolders (English: Show notes from subfolders)
        autoExpandFoldersTags: 'Auto-expand folders and tags', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Open in new tab',
            openToRight: 'Open to the right',
            openInNewWindow: 'Open in new window',
            openMultipleInNewTabs: 'Open {count} notes in new tabs',
            openMultipleToRight: 'Open {count} notes to the right',
            openMultipleInNewWindows: 'Open {count} notes in new windows',
            pinNote: 'Pin note',
            unpinNote: 'Unpin note',
            pinMultipleNotes: 'Pin {count} notes',
            unpinMultipleNotes: 'Unpin {count} notes',
            duplicateNote: 'Duplicate note',
            duplicateMultipleNotes: 'Duplicate {count} notes',
            openVersionHistory: 'Open version history',
            revealInFinder: 'Reveal in Finder',
            showInExplorer: 'Show in system explorer',
            copyDeepLink: 'Copy deep link',
            renameNote: 'Rename note',
            deleteNote: 'Delete note',
            deleteMultipleNotes: 'Delete {count} notes',
            moveToFolder: 'Move to...',
            moveMultipleToFolder: 'Move {count} files to...',
        },
        folder: {
            newNote: 'Create new note',
            newFolder: 'New folder',
            newCanvas: 'New canvas',
            newBase: 'New base',
            newDrawing: 'New drawing',
            duplicateFolder: 'Duplicate folder',
            searchInFolder: 'Search in folder',
            createFolderNote: 'Create folder note',
            deleteFolderNote: 'Delete folder note',
            changeIcon: 'Change icon',
            removeIcon: 'Remove icon',
            changeColor: 'Change color',
            removeColor: 'Remove color',
            renameFolder: 'Rename folder',
            deleteFolder: 'Delete folder',
        },
        tag: {
            changeIcon: 'Change icon',
            removeIcon: 'Remove icon',
            changeColor: 'Change color',
            removeColor: 'Remove color',
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
        tagOperation: {
            renameTitle: 'Rename tag {tag}',
            deleteTitle: 'Delete tag {tag}',
            newTagPrompt: 'New tag name',
            newTagPlaceholder: 'Enter new tag name',
            renameWarning: 'Renaming tag {oldTag} will modify {count} {files}.',
            deleteWarning: 'Deleting tag {tag} will modify {count} {files}.',
            modificationWarning: 'This will update file modification dates.',
            affectedFiles: 'Affected files:',
            andMore: '...and {count} more',
            confirmRename: 'Rename tag',
            confirmDelete: 'Delete tag',
            file: 'file',
            files: 'files',
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
        folderSuggest: {
            placeholder: 'Move to folder...',
            navigatePlaceholder: 'Navigate to folder...',
            instructions: {
                navigate: 'to navigate',
                move: 'to move',
                select: 'to select',
                dismiss: 'to dismiss',
            },
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
            folderNoteAlreadyExists: 'Folder note already exists',
            failedToDeleteFile: 'Failed to delete {name}: {error}',
            drawingAlreadyExists: 'A drawing with this name already exists',
            failedToCreateDrawing: 'Failed to create drawing',
            noFolderSelected: 'No folder is selected in Notebook Navigator',
            noFileSelected: 'No file is selected',
        },
        notifications: {
            deletedMultipleFiles: 'Deleted {count} files',
            deepLinkCopied: 'Deep link copied to clipboard',
        },
        confirmations: {
            deleteMultipleFiles: 'Are you sure you want to delete {count} files?',
            deleteConfirmation: 'This action cannot be undone.',
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
            failedToAddTag: 'Failed to add tag "{tag}"',
            failedToClearTags: 'Failed to clear tags',
        },
        notifications: {
            filesAlreadyExist: '{count} files already exist in destination',
            addedTag: 'Added tag "{tag}" to {count} files',
            filesAlreadyHaveTag: '{count} files already have this tag or a more specific one',
            clearedTags: 'Cleared all tags from {count} files',
            noTagsToClear: 'No tags to clear',
        },
    },

    // Date grouping
    dateGroups: {
        today: 'Today',
        yesterday: 'Yesterday',
        previous7Days: 'Previous 7 days',
        previous30Days: 'Previous 30 days',
    },

    // Weekdays
    weekdays: {
        sunday: 'Sunday',
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
    },

    // Plugin commands
    commands: {
        open: 'Open', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealFile: 'Reveal file', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        focusFile: 'Focus file', // Command palette: Moves keyboard focus to the file list pane (English: Focus file)
        toggleNavigationPane: 'Toggle navigation pane', // Command palette: Shows or hides the navigation pane (English: Toggle navigation pane)
        deleteFile: 'Delete files', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: 'Create new note', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: 'Move files', // Command palette: Move selected files to another folder (English: Move files)
        navigateToFolder: 'Navigate to folder', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        toggleSubfolders: 'Toggle show notes from subfolders', // Command palette: Toggles showing notes from subfolders (English: Toggle show notes from subfolders)
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Notebook Navigator', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Reveal in Notebook Navigator', // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Last modified at',
        createdAt: 'Created at',
        file: 'file',
        files: 'files',
        folder: 'folder',
        folders: 'folders',
    },

    // Settings
    settings: {
        sections: {
            navigationPane: 'Navigation pane',
            folders: 'Folders',
            tags: 'Tags',
            listPane: 'List pane',
            notes: 'Notes',
            advanced: 'Advanced',
        },
        items: {
            sortNotesBy: {
                name: 'Sort notes by',
                desc: 'Choose how notes are sorted in the note list.',
                options: {
                    'modified-desc': 'Date edited (newest first)',
                    'modified-asc': 'Date edited (oldest first)',
                    'created-desc': 'Date created (newest first)',
                    'created-asc': 'Date created (oldest first)',
                    'title-asc': 'Title (A first)',
                    'title-desc': 'Title (Z first)',
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
            showParentFolderNames: {
                name: 'Show parent folder names',
                desc: 'Display the parent folder name for notes from subfolders.',
            },
            singlePane: {
                name: 'Use single-pane view on desktop',
                desc: 'When enabled, shows folders, tags, and the file list in a single pane. When disabled, folders and tags appear side-by-side with the file list in a dual-pane view.',
            },
            autoRevealActiveNote: {
                name: 'Auto-reveal active note',
                desc: 'Automatically reveal and select notes when opened from Quick Switcher, links, or search.',
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Auto-select first note on focus change',
                desc: 'Automatically select and open the first note when switching folders or tags.',
            },
            autoExpandFoldersTags: {
                name: 'Auto-expand folders and tags',
                desc: 'Automatically expand folders and tags when they are selected.',
            },
            showTooltips: {
                name: 'Show tooltips',
                desc: 'Display hover tooltips with additional information for notes and folders.',
            },
            fileVisibility: {
                name: 'Show file types',
                desc: 'Choose which file types to display in the navigator. Files not supported by Obsidian will open in your system\'s default application.',
                options: {
                    markdownOnly: 'Markdown only',
                    supported: 'Supported files',
                    all: 'All files',
                },
            },
            excludedNotes: {
                name: 'Excluded notes',
                desc: 'Comma-separated list of frontmatter properties. Notes containing any of these properties will be hidden (e.g., draft, private, archived).',
                placeholder: 'draft, private',
            },
            excludedFolders: {
                name: 'Excluded folders',
                desc: 'Comma-separated list of folders to hide. Supports wildcards: assets* (starts with), *_temp (ends with).',
                placeholder: 'templates, assets*, *_temp',
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
            timeFormat: {
                name: 'Time format',
                desc: 'Format for displaying times (uses date-fns format).',
                placeholder: 'h:mm a',
                help: 'Common formats:\nh:mm a = 2:30 PM (12-hour)\nHH:mm = 14:30 (24-hour)\nh:mm:ss a = 2:30:45 PM\nHH:mm:ss = 14:30:45\n\nTokens:\nHH/H = 24-hour\nhh/h = 12-hour\nmm = minutes\nss = seconds\na = AM/PM',
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
            fileNameRows: {
                name: 'Title rows',
                desc: 'Number of rows to display for note titles.',
                options: {
                    '1': '1 row',
                    '2': '2 rows',
                },
            },
            showFeatureImage: {
                name: 'Show feature image',
                desc: 'Display thumbnail images from frontmatter. Tip: Use the "Featured Image" plugin to automatically set feature images for all your documents.',
            },
            featureImageProperties: {
                name: 'Image properties',
                desc: 'Comma-separated list of frontmatter properties to check for thumbnail images. The first property with an image will be used.',
                tip: 'Use the "Featured Image" plugin to automatically set feature images. For best performance, use 42px thumbnails or 84px for retina displays.',
                placeholder: 'featureResized, feature',
                embedFallback: 'If no image is found in the properties above, the first embedded image in the document will be used (requires Obsidian 1.9.4+)',
            },
            showRootFolder: {
                name: 'Show root folder',
                desc: 'Display "Vault" as the root folder in the tree.',
            },
            showNoteCount: {
                name: 'Show note count',
                desc: 'Display the number of notes in each folder and tag.',
            },
            showIcons: {
                name: 'Show icons',
                desc: 'Display icons next to folders and tags in the navigation pane.',
            },
            collapseButtonBehavior: {
                name: 'Collapse button behavior',
                desc: 'Choose what the expand/collapse all button affects.',
                options: {
                    all: 'All folders and tags',
                    foldersOnly: 'Folders only',
                    tagsOnly: 'Tags only',
                },
            },
            showTags: {
                name: 'Show tags',
                desc: 'Display tags section below folders in the navigator.',
            },
            showTagsAboveFolders: {
                name: 'Show tags above folders',
                desc: 'Display tags section before folders in the navigator.',
            },
            showFavoriteTagsFolder: {
                name: 'Show favorites folder',
                desc: 'Display "Favorites" as a collapsible folder when favorite tags are configured.',
            },
            showAllTagsFolder: {
                name: 'Show tags folder',
                desc: 'Display "Tags" as a collapsible folder.',
            },
            showUntagged: {
                name: 'Show untagged notes',
                desc: 'Display "Untagged" item for notes without any tags.',
            },
            showUntaggedInFavorites: {
                name: 'Show untagged notes in favorites section',
                desc: 'Display untagged notes in the favorites section, either inside the folder or directly below favorites.',
            },
            favoriteTags: {
                name: 'Favorite tags',
                desc: 'Comma-separated list of favorite tag patterns. Supports exact match, wildcards (*), and regex (/pattern/).',
                placeholder: 'inbox, project-*, /^daily-\\d{4}/',
            },
            hiddenTags: {
                name: 'Hidden tags',
                desc: 'Comma-separated list of tag patterns to hide from the tag tree. Supports exact match, wildcards (*), and regex (/pattern/).',
                placeholder: 'internal, temp-*, /^archive-\\d{4}/',
            },
            enableFolderNotes: {
                name: 'Enable folder notes',
                desc: 'When enabled, folders with associated notes are displayed as clickable links.',
            },
            folderNoteName: {
                name: 'Folder note name',
                desc: 'Name of the folder note without extension. Leave empty to use the same name as the folder.',
                placeholder: 'index',
            },
            hideFolderNoteInList: {
                name: 'Hide folder notes in list',
                desc: 'Hide the folder note from appearing in the folder\'s note list.',
            },
            confirmBeforeDelete: {
                name: 'Confirm before deleting',
                desc: 'Show confirmation dialog when deleting notes or folders',
            },
            useFrontmatterDates: {
                name: 'Read metadata from frontmatter',
                desc: 'Read note names and timestamps from frontmatter when available, falling back to file system values',
            },
            frontmatterNameField: {
                name: 'Name field',
                desc: 'Frontmatter field to use as the note display name. Leave empty to use the file name.',
                placeholder: 'title',
            },
            frontmatterCreatedField: {
                name: 'Created timestamp field',
                desc: 'Frontmatter field name for the created timestamp. Leave empty to only use file system date.',
                placeholder: 'created',
            },
            frontmatterModifiedField: {
                name: 'Modified timestamp field',
                desc: 'Frontmatter field name for the modified timestamp. Leave empty to only use file system date.',
                placeholder: 'modified',
            },
            frontmatterDateFormat: {
                name: 'Timestamp format',
                desc: 'Format used to parse timestamps in frontmatter',
                placeholder: "yyyy-MM-dd'T'HH:mm:ss",
                helpTooltip: 'See date-fns format documentation',
                help: 'Common formats:\nyyyy-MM-dd\'T\'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM',
            },
            supportDevelopment: {
                name: 'Support development',
                desc: 'If you love using Notebook Navigator, please consider supporting its continued development.',
                buttonText: '❤️ Sponsor on GitHub',
            },
        },
    },
};