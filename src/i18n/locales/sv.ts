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
 * Swedish language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_SV = {
    // Common UI elements
    common: {
        cancel: 'Avbryt', // Button text for canceling dialogs and operations (English: Cancel)
        delete: 'Radera', // Button text for delete operations in dialogs (English: Delete)
        submit: 'OK', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'Inget val', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Utan tagg', // Label for notes without any tags (English: Untagged)
        untitled: 'Namnlös', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'Utvald bild', // Alt text for thumbnail/preview images (English: Feature image)
    },

    // File list
    fileList: {
        emptyStateNoSelection: 'Välj en mapp eller tagg för att visa anteckningar', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'Inga anteckningar', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Fastnålat', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
    },

    // Folder tree
    folderTree: {
        rootFolderName: 'Valv', // Display name for the vault root folder in the tree (English: Vault)
    },

    // Tag list
    tagList: {
        sectionHeader: 'Taggar', // Header text for the tags section below folders (English: Tags)
        untaggedLabel: 'Otaggade', // Label for the special item showing notes without tags (English: Untagged)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Fäll ihop alla mappar', // Tooltip for button that collapses all expanded folders (English: Collapse all folders)
        expandAllFolders: 'Expandera alla mappar', // Tooltip for button that expands all folders (English: Expand all folders)
        newFolder: 'Ny mapp', // Tooltip for create new folder button (English: New folder)
        newNote: 'Ny anteckning', // Tooltip for create new note button (English: New note)
        mobileBackToFolders: 'Tillbaka till mappar', // Mobile-only back button text to return to folder list (English: Back to folders)
        changeSortOrder: 'Ändra sorteringsordning', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Standard', // Label for default sorting mode (English: Default)
        customSort: 'Anpassad', // Label for custom sorting mode (English: Custom)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Öppna i ny flik',
            openToRight: 'Öppna till höger',
            openInNewWindow: 'Öppna i nytt fönster',
            pinNote: 'Fäst anteckning',
            unpinNote: 'Lösgör anteckning',
            duplicateNote: 'Duplicera anteckning',
            openVersionHistory: 'Öppna versionshistorik',
            revealInFinder: 'Visa i Finder',
            showInExplorer: 'Visa i filutforskaren',
            renameNote: 'Byt namn på anteckning',
            deleteNote: 'Ta bort anteckning',
        },
        folder: {
            newNote: 'Ny anteckning',
            newFolder: 'Ny mapp',
            newCanvas: 'Ny canvas',
            newBase: 'Ny databas',
            duplicateFolder: 'Duplicera mapp',
            searchInFolder: 'Sök i mapp',
            changeIcon: 'Ändra ikon',
            removeIcon: 'Ta bort ikon',
            changeColor: 'Ändra färg',
            removeColor: 'Ta bort färg',
            renameFolder: 'Byt namn på mapp',
            deleteFolder: 'Ta bort mapp',
        },
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Sök ikoner...',
            recentlyUsedHeader: 'Nyligen använda',
            emptyStateSearch: 'Börja skriva för att söka ikoner',
            emptyStateNoResults: 'Inga ikoner hittades',
            showingResultsInfo: 'Visar 50 av {count} resultat. Skriv mer för att begränsa.',
        },
        colorPicker: {
            header: 'Välj mappfärg',
            colors: {
                red: 'Röd',
                orange: 'Orange',
                amber: 'Bärnsten',
                yellow: 'Gul',
                lime: 'Lime',
                green: 'Grön',
                emerald: 'Smaragd',
                teal: 'Teal',
                cyan: 'Cyan',
                sky: 'Himmel',
                blue: 'Blå',
                indigo: 'Indigo',
                violet: 'Violett',
                purple: 'Lila',
                fuchsia: 'Fuchsia',
                pink: 'Rosa',
                rose: 'Rosenröd',
                gray: 'Grå',
                slate: 'Skiffer',
                stone: 'Sten',
            },
        },
        fileSystem: {
            newFolderTitle: 'Ny mapp',
            renameFolderTitle: 'Byt namn på mapp',
            renameFileTitle: 'Byt namn på fil',
            deleteFolderTitle: 'Ta bort \'{name}\'?',
            deleteFileTitle: 'Ta bort \'{name}\'?',
            folderNamePrompt: 'Ange mappnamn:',
            renamePrompt: 'Ange nytt namn:',
            deleteFolderConfirm: 'Är du säker på att du vill ta bort denna mapp och allt dess innehåll?',
            deleteFileConfirm: 'Är du säker på att du vill ta bort denna fil?',
        },
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Kunde inte skapa mapp: {error}',
            createFile: 'Kunde inte skapa fil: {error}',
            renameFolder: 'Kunde inte byta namn på mapp: {error}',
            renameFile: 'Kunde inte byta namn på fil: {error}',
            deleteFolder: 'Kunde inte ta bort mapp: {error}',
            deleteFile: 'Kunde inte ta bort fil: {error}',
            duplicateNote: 'Kunde inte duplicera anteckning: {error}',
            createCanvas: 'Kunde inte skapa canvas: {error}',
            createDatabase: 'Kunde inte skapa databas: {error}',
            duplicateFolder: 'Kunde inte duplicera mapp: {error}',
            openVersionHistory: 'Kunde inte öppna versionshistorik: {error}',
            versionHistoryNotFound: 'Versionshistorik-kommando hittades inte. Se till att Obsidian Sync är aktiverat.',
            revealInExplorer: 'Kunde inte visa fil i filutforskaren: {error}',
        },
        defaultNames: {
            untitled: 'Namnlös',
            untitledNumber: 'Namnlös {number}',
        },
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Kan inte flytta en mapp till sig själv eller en undermapp.',
            itemAlreadyExists: 'Ett objekt med namnet "{name}" finns redan på denna plats.',
            failedToMove: 'Kunde inte flytta: {error}',
        },
    },

    // Date grouping
    dateGroups: {
        today: 'Idag',
        yesterday: 'Igår',
        previous7Days: 'Senaste 7 dagarna',
        previous30Days: 'Senaste 30 dagarna',
    },

    // Weekdays
    weekdays: {
        sunday: 'Söndag',
        monday: 'Måndag',
        tuesday: 'Tisdag',
        wednesday: 'Onsdag',
        thursday: 'Torsdag',
        friday: 'Fredag',
        saturday: 'Lördag',
    },

    // Plugin commands
    commands: {
        open: 'Öppna', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealActiveFile: 'Visa aktiv fil', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal active file)
        focusFileList: 'Fokusera fillista', // Command palette: Moves keyboard focus to the file list pane (English: Focus file list)
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Notebook Navigator', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Visa i Notebook Navigator', // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Settings
    settings: {
        sections: {
            noteDisplay: 'Anteckningar',
            folderDisplay: 'Mappar',
            tagDisplay: 'Taggar',
            advanced: 'Avancerat',
        },
        items: {
            sortNotesBy: {
                name: 'Sortera anteckningar efter',
                desc: 'Välj hur anteckningar sorteras i anteckningslistan.',
                options: {
                    'modified-desc': 'Redigeringsdatum (nyast först)',
                    'modified-asc': 'Redigeringsdatum (äldst först)',
                    'created-desc': 'Skapelsedatum (nyast först)',
                    'created-asc': 'Skapelsedatum (äldst först)',
                    'title-asc': 'Titel (A först)',
                    'title-desc': 'Titel (Ö först)',
                },
            },
            groupByDate: {
                name: 'Gruppera anteckningar efter datum',
                desc: 'Gruppera anteckningar under datumrubriker när de sorteras efter datum.',
            },
            showNotesFromSubfolders: {
                name: 'Visa anteckningar från undermappar',
                desc: 'Visa anteckningar från alla undermappar i den aktuella mappvyn.',
            },
            autoRevealActiveNote: {
                name: 'Visa aktiv anteckning automatiskt',
                desc: 'Visa och välj automatiskt anteckningar när de öppnas från snabbväljaren, länkar eller sök.',
            },
            excludedNotes: {
                name: 'Exkluderade anteckningar',
                desc: 'Kommaseparerad lista med frontmatter-attribut. Anteckningar som innehåller någon av dessa attribut kommer att döljas (t.ex. utkast, privat, arkiverad).',
                placeholder: 'utkast, privat',
            },
            excludedFolders: {
                name: 'Exkluderade mappar',
                desc: 'Kommaseparerad lista med mappar att dölja (t.ex. resurser, mallar).',
                placeholder: 'mapp1, mapp2',
            },
            showDate: {
                name: 'Visa datum',
                desc: 'Visa datum under anteckningsnamn.',
            },
            dateFormat: {
                name: 'Datumformat',
                desc: 'Format för att visa datum (använder date-fns format).',
                placeholder: 'yyyy-MM-dd',
                help: 'Vanliga format:\nd MMM yyyy = 25 maj 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = år\nMMMM/MMM/MM = månad\ndd/d = dag\nEEEE/EEE = veckodag',
                helpTooltip: 'Klicka för formatreferens',
            },
            timeFormat: {
                name: 'Tidsformat',
                desc: 'Format för att visa tider i Idag- och Igår-grupper (använder date-fns format).',
                placeholder: 'HH:mm',
                help: 'Vanliga format:\nHH:mm = 14:30 (24-timmar)\nh:mm a = 2:30 PM (12-timmar)\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nTokens:\nHH/H = 24-timmar\nhh/h = 12-timmar\nmm = minuter\nss = sekunder\na = FM/EM',
                helpTooltip: 'Klicka för formatreferens',
            },
            showFilePreview: {
                name: 'Visa förhandsgranskning',
                desc: 'Visa förhandsgranskningstext under anteckningsnamn.',
            },
            skipHeadingsInPreview: {
                name: 'Hoppa över rubriker i förhandsgranskning',
                desc: 'Hoppa över rubrikrader när förhandsgranskningstext genereras.',
            },
            skipNonTextInPreview: {
                name: 'Hoppa över icke-text i förhandsgranskning',
                desc: 'Hoppa över bilder, inbäddningar och andra icke-textelement från förhandsgranskningstext.',
            },
            previewRows: {
                name: 'Förhandsgranskningsrader',
                desc: 'Antal rader att visa för förhandsgranskningstext.',
                options: {
                    '1': '1 rad',
                    '2': '2 rader',
                    '3': '3 rader',
                    '4': '4 rader',
                    '5': '5 rader',
                },
            },
            showFeatureImage: {
                name: 'Visa utvald bild',
                desc: 'Visa miniatyrbilder från frontmatter. Tips: Använd plugin "Featured Image" för att automatiskt ställa in utvalda bilder för alla dina dokument.',
            },
            featureImageProperty: {
                name: 'Attribut för utvald bild',
                desc: 'Frontmatter-attribut för miniatyrbilder.',
                placeholder: 'feature',
            },
            showRootFolder: {
                name: 'Visa rotmapp',
                desc: 'Visa "Valv" som rotmapp i trädet.',
            },
            showFolderFileCount: {
                name: 'Visa antal anteckningar i mapp',
                desc: 'Visa antalet anteckningar i varje mapp.',
            },
            showFolderIcons: {
                name: 'Visa mappikoner',
                desc: 'Visa ikoner bredvid mappnamn i trädet.',
            },
            showTags: {
                name: 'Visa taggar',
                desc: 'Visa taggsektion under mappar i navigatorn.',
            },
            showUntagged: {
                name: 'Visa otaggade anteckningar',
                desc: 'Visa "Otaggade" för anteckningar utan några taggar.',
            },
            confirmBeforeDelete: {
                name: 'Bekräfta innan borttagning',
                desc: 'Visa dialog innan anteckningar eller mappar tas bort',
            },
            clearSavedState: {
                name: 'Rensa inställningar',
                desc: 'Tag bort alla sparade inställningar för unika ikoner, färger, sorteringar, val och panelbredd.',
                buttonText: 'Rensa',
                successMessage: 'Inställningar rensade. Uppdatera vyn för att se ändringar.',
            },
            supportDevelopment: {
                name: 'Sponsra utveckling',
                desc: 'Om du älskar Notebook Navigator och den hjälper dig i din vardag, sponsra dess fortsatta utveckling.',
                buttonText: '❤️ Sponsra på GitHub',
            },
        },
    },
};