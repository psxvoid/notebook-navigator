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
 * German language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_DE = {
    // Common UI elements
    common: {
        cancel: 'Abbrechen', // Button text for canceling dialogs and operations (English: Cancel)
        delete: 'Löschen', // Button text for delete operations in dialogs (English: Delete)
        submit: 'OK', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'Keine Auswahl', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Ohne Tag', // Label for notes without any tags (English: Untagged)
        untitled: 'Ohne Titel', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'Vorschaubild', // Alt text for thumbnail/preview images (English: Feature image)
    },

    // File list
    fileList: {
        emptyStateNoSelection: 'Wählen Sie einen Ordner oder Tag aus, um Notizen anzuzeigen', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'Keine Notizen', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Angeheftet', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
    },

    // Folder tree
    folderTree: {
        rootFolderName: 'Tresor', // Display name for the vault root folder in the tree (English: Vault)
    },

    // Tag list
    tagList: {
        sectionHeader: 'Tags', // Header text for the tags section below folders (English: Tags)
        untaggedLabel: 'Ohne Tag', // Label for the special item showing notes without tags (English: Untagged)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Alle Ordner einklappen', // Tooltip for button that collapses all expanded folders (English: Collapse all folders)
        expandAllFolders: 'Alle Ordner ausklappen', // Tooltip for button that expands all folders (English: Expand all folders)
        newFolder: 'Neuer Ordner', // Tooltip for create new folder button (English: New folder)
        newNote: 'Neue Notiz', // Tooltip for create new note button (English: New note)
        mobileBackToFolders: 'Zurück zu Ordnern', // Mobile-only back button text to return to folder list (English: Back to folders)
        changeSortOrder: 'Sortierreihenfolge ändern', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Standard', // Label for default sorting mode (English: Default)
        customSort: 'Benutzerdefiniert', // Label for custom sorting mode (English: Custom)
        showFolders: 'Ordner anzeigen', // Tooltip for button to show the folders pane (English: Show Folders)
        hideFolders: 'Ordner ausblenden', // Tooltip for button to hide the folders pane (English: Hide Folders)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'In neuem Tab öffnen',
            openToRight: 'Rechts öffnen',
            openInNewWindow: 'In neuem Fenster öffnen',
            openMultipleInNewTabs: '{count} Notizen in neuen Tabs öffnen',
            openMultipleToRight: '{count} Notizen rechts öffnen',
            openMultipleInNewWindows: '{count} Notizen in neuen Fenstern öffnen',
            pinNote: 'Notiz anheften',
            unpinNote: 'Notiz lösen',
            pinMultipleNotes: '{count} Notizen anheften',
            unpinMultipleNotes: '{count} Notizen lösen',
            duplicateNote: 'Notiz duplizieren',
            duplicateMultipleNotes: '{count} Notizen duplizieren',
            openVersionHistory: 'Versionsverlauf öffnen',
            revealInFinder: 'Im Finder anzeigen',
            showInExplorer: 'Im Explorer anzeigen',
            copyDeepLink: 'Deep Link kopieren',
            renameNote: 'Notiz umbenennen',
            deleteNote: 'Notiz löschen',
            deleteMultipleNotes: '{count} Notizen löschen',
        },
        folder: {
            newNote: 'Neue Notiz',
            newFolder: 'Neuer Ordner',
            newCanvas: 'Neue Canvas',
            newBase: 'Neue Datenbank',
            newDrawing: 'Neue Zeichnung',
            duplicateFolder: 'Ordner duplizieren',
            searchInFolder: 'In Ordner suchen',
            createFolderNote: 'Ordnernotiz erstellen',
            deleteFolderNote: 'Ordnernotiz löschen',
            changeIcon: 'Symbol ändern',
            removeIcon: 'Symbol entfernen',
            changeColor: 'Farbe ändern',
            removeColor: 'Farbe entfernen',
            renameFolder: 'Ordner umbenennen',
            deleteFolder: 'Ordner löschen',
        },
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Symbole suchen...',
            recentlyUsedHeader: 'Kürzlich verwendet',
            emptyStateSearch: 'Beginnen Sie zu tippen, um Symbole zu suchen',
            emptyStateNoResults: 'Keine Symbole gefunden',
            showingResultsInfo: 'Zeige 50 von {count} Ergebnissen. Geben Sie mehr ein, um die Suche einzugrenzen.',
        },
        colorPicker: {
            header: 'Ordnerfarbe wählen',
            colors: {
                red: 'Rot',
                orange: 'Orange',
                amber: 'Bernstein',
                yellow: 'Gelb',
                lime: 'Limette',
                green: 'Grün',
                emerald: 'Smaragd',
                teal: 'Blaugrün',
                cyan: 'Cyan',
                sky: 'Himmelblau',
                blue: 'Blau',
                indigo: 'Indigo',
                violet: 'Violett',
                purple: 'Lila',
                fuchsia: 'Fuchsia',
                pink: 'Pink',
                rose: 'Rosé',
                gray: 'Grau',
                slate: 'Schiefer',
                stone: 'Stein',
            },
        },
        fileSystem: {
            newFolderTitle: 'Neuer Ordner',
            renameFolderTitle: 'Ordner umbenennen',
            renameFileTitle: 'Datei umbenennen',
            deleteFolderTitle: '\'{name}\' löschen?',
            deleteFileTitle: '\'{name}\' löschen?',
            folderNamePrompt: 'Ordnernamen eingeben:',
            renamePrompt: 'Neuen Namen eingeben:',
            deleteFolderConfirm: 'Sind Sie sicher, dass Sie diesen Ordner und seinen gesamten Inhalt löschen möchten?',
            deleteFileConfirm: 'Sind Sie sicher, dass Sie diese Datei löschen möchten?',
        },
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Ordner konnte nicht erstellt werden: {error}',
            createFile: 'Datei konnte nicht erstellt werden: {error}',
            renameFolder: 'Ordner konnte nicht umbenannt werden: {error}',
            renameFile: 'Datei konnte nicht umbenannt werden: {error}',
            deleteFolder: 'Ordner konnte nicht gelöscht werden: {error}',
            deleteFile: 'Datei konnte nicht gelöscht werden: {error}',
            duplicateNote: 'Notiz konnte nicht dupliziert werden: {error}',
            createCanvas: 'Canvas konnte nicht erstellt werden: {error}',
            createDatabase: 'Datenbank konnte nicht erstellt werden: {error}',
            duplicateFolder: 'Ordner konnte nicht dupliziert werden: {error}',
            openVersionHistory: 'Versionsverlauf konnte nicht geöffnet werden: {error}',
            versionHistoryNotFound: 'Versionsverlauf-Befehl nicht gefunden. Stellen Sie sicher, dass Obsidian Sync aktiviert ist.',
            revealInExplorer: 'Datei konnte nicht im Explorer angezeigt werden: {error}',
            folderNoteAlreadyExists: 'Ordnernotiz existiert bereits',
            failedToDeleteFile: 'Löschen von {name} fehlgeschlagen: {error}',
            drawingAlreadyExists: 'Eine Zeichnung mit diesem Namen existiert bereits',
            failedToCreateDrawing: 'Zeichnung konnte nicht erstellt werden',
        },
        notifications: {
            deletedMultipleFiles: '{count} Dateien gelöscht',
            deepLinkCopied: 'Deep Link in die Zwischenablage kopiert',
        },
        confirmations: {
            deleteMultipleFiles: 'Möchten Sie wirklich {count} Dateien löschen?',
            deleteConfirmation: 'Diese Aktion kann nicht rückgängig gemacht werden.',
        },
        defaultNames: {
            untitled: 'Ohne Titel',
            untitledNumber: 'Ohne Titel {number}',
        },
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Ein Ordner kann nicht in sich selbst oder einen Unterordner verschoben werden.',
            itemAlreadyExists: 'Ein Element mit dem Namen "{name}" existiert bereits an diesem Ort.',
            failedToMove: 'Verschieben fehlgeschlagen: {error}',
        },
        notifications: {
            movedMultipleFiles: '{count} Dateien verschoben',
            filesAlreadyExist: '{count} Dateien existieren bereits am Zielort',
        },
    },

    // Date grouping
    dateGroups: {
        today: 'Heute',
        yesterday: 'Gestern',
        previous7Days: 'Letzte 7 Tage',
        previous30Days: 'Letzte 30 Tage',
    },

    // Weekdays
    weekdays: {
        sunday: 'Sonntag',
        monday: 'Montag',
        tuesday: 'Dienstag',
        wednesday: 'Mittwoch',
        thursday: 'Donnerstag',
        friday: 'Freitag',
        saturday: 'Samstag',
    },

    // Plugin commands
    commands: {
        open: 'Öffnen', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealActiveFile: 'Aktive Datei anzeigen', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal active file)
        focusFileList: 'Dateiliste fokussieren', // Command palette: Moves keyboard focus to the file list pane (English: Focus file list)
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Notebook Navigator', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'In Notebook Navigator anzeigen', // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Zuletzt geändert am',
        createdAt: 'Erstellt am',
        file: 'Datei',
        files: 'Dateien',
        folder: 'Ordner',
        folders: 'Ordner',
    },

    // Settings
    settings: {
        sections: {
            timeDisplay: 'Zeitanzeige',
            noteDisplay: 'Notizenanzeige',
            folderDisplay: 'Ordneranzeige',
            tagDisplay: 'Tag-Anzeige',
            folderNotes: 'Ordnernotizen',
            advanced: 'Erweitert',
        },
        items: {
            sortNotesBy: {
                name: 'Notizen sortieren nach',
                desc: 'Wählen Sie, wie Notizen in der Notizenliste sortiert werden.',
                options: {
                    'modified-desc': 'Bearbeitungsdatum (neueste zuerst)',
                    'modified-asc': 'Bearbeitungsdatum (älteste zuerst)',
                    'created-desc': 'Erstellungsdatum (neueste zuerst)',
                    'created-asc': 'Erstellungsdatum (älteste zuerst)',
                    'title-asc': 'Titel (A zuerst)',
                    'title-desc': 'Titel (Z zuerst)',
                },
            },
            groupByDate: {
                name: 'Notizen nach Datum gruppieren',
                desc: 'Bei Sortierung nach Datum werden Notizen unter Datumsüberschriften gruppiert.',
            },
            showNotesFromSubfolders: {
                name: 'Notizen aus Unterordnern anzeigen',
                desc: 'Alle Notizen aus Unterordnern in der aktuellen Ordneransicht anzeigen.',
            },
            showSubfolderNamesInList: {
                name: 'Übergeordnete Ordnernamen anzeigen',
                desc: 'Den übergeordneten Ordnernamen für Notizen aus Unterordnern anzeigen.',
            },
            autoRevealActiveNote: {
                name: 'Aktive Notiz automatisch anzeigen',
                desc: 'Notizen automatisch anzeigen und auswählen, wenn sie über Schnellauswahl, Links oder Suche geöffnet werden.',
            },
            autoSelectFirstFile: {
                name: 'Erste Datei beim Ordnerwechsel automatisch auswählen',
                desc: 'Die erste Datei automatisch auswählen und öffnen, wenn Sie den Ordner wechseln.',
            },
            excludedNotes: {
                name: 'Ausgeschlossene Notizen',
                desc: 'Kommagetrennte Liste von Frontmatter-Eigenschaften. Notizen mit diesen Eigenschaften werden ausgeblendet (z.B. Entwurf, privat, archiviert).',
                placeholder: 'entwurf, privat',
            },
            excludedFolders: {
                name: 'Ausgeschlossene Ordner',
                desc: 'Kommagetrennte Liste von auszublendenden Ordnern. Unterstützt Platzhalter: assets* (beginnt mit), *_temp (endet mit).',
                placeholder: 'vorlagen, assets*, *_temp',
            },
            showDate: {
                name: 'Datum anzeigen',
                desc: 'Das Datum unter Notizennamen anzeigen.',
            },
            dateFormat: {
                name: 'Datumsformat',
                desc: 'Format für die Datumsanzeige (verwendet date-fns Format).',
                placeholder: 'dd.MM.yyyy',
                help: 'Gängige Formate:\ndd.MM.yyyy = 25.05.2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = Jahr\nMMMM/MMM/MM = Monat\ndd/d = Tag\nEEEE/EEE = Wochentag',
                helpTooltip: 'Klicken für Formatreferenz',
            },
            timeFormat: {
                name: 'Zeitformat',
                desc: 'Format für die Zeitanzeige in Heute- und Gestern-Gruppen (verwendet date-fns Format).',
                placeholder: 'HH:mm',
                help: 'Gängige Formate:\nHH:mm = 14:30 (24-Stunden)\nh:mm a = 2:30 PM (12-Stunden)\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nTokens:\nHH/H = 24-Stunden\nhh/h = 12-Stunden\nmm = Minuten\nss = Sekunden\na = AM/PM',
                helpTooltip: 'Klicken für Formatreferenz',
            },
            showFilePreview: {
                name: 'Notizenvorschau anzeigen',
                desc: 'Vorschautext unter Notizennamen anzeigen.',
            },
            skipHeadingsInPreview: {
                name: 'Überschriften in Vorschau überspringen',
                desc: 'Überschriftenzeilen bei der Erstellung des Vorschautextes überspringen.',
            },
            skipNonTextInPreview: {
                name: 'Nicht-Text in Vorschau überspringen',
                desc: 'Bilder, Einbettungen und andere Nicht-Text-Elemente vom Vorschautext ausschließen.',
            },
            previewRows: {
                name: 'Vorschauzeilen',
                desc: 'Anzahl der Zeilen für den Vorschautext.',
                options: {
                    '1': '1 Zeile',
                    '2': '2 Zeilen',
                    '3': '3 Zeilen',
                    '4': '4 Zeilen',
                    '5': '5 Zeilen',
                },
            },
            fileNameRows: {
                name: 'Titelzeilen',
                desc: 'Anzahl der Zeilen für Notizentitel.',
                options: {
                    '1': '1 Zeile',
                    '2': '2 Zeilen',
                },
            },
            showFeatureImage: {
                name: 'Vorschaubild anzeigen',
                desc: 'Miniaturbilder aus Frontmatter anzeigen. Tipp: Verwenden Sie das "Featured Image" Plugin, um automatisch Vorschaubilder für alle Ihre Dokumente festzulegen.',
            },
            featureImageProperty: {
                name: 'Vorschaubild-Eigenschaft',
                desc: 'Der Name der Frontmatter-Eigenschaft für Miniaturbilder. Wichtig! Im Featured Image Plugin können Sie verkleinerte Thumbnails erstellen, was die Leistung erheblich verbessert! Verwenden Sie 42 Pixel für maximale Leistung oder 84 Pixel für Retina-Displays. Die verkleinerte Eigenschaft heißt standardmäßig "featureResized".',
                placeholder: 'feature',
            },
            showRootFolder: {
                name: 'Wurzelordner anzeigen',
                desc: '"Tresor" als Wurzelordner im Baum anzeigen.',
            },
            showFolderFileCount: {
                name: 'Ordner-Notizenzahl anzeigen',
                desc: 'Die Anzahl der Notizen in jedem Ordner anzeigen.',
            },
            showFolderIcons: {
                name: 'Ordnersymbole anzeigen',
                desc: 'Symbole neben Ordnernamen im Baum anzeigen.',
            },
            showTags: {
                name: 'Tags anzeigen',
                desc: 'Tag-Bereich unterhalb der Ordner im Navigator anzeigen.',
            },
            showUntagged: {
                name: 'Ungetaggte Notizen anzeigen',
                desc: '"Ohne Tag" für Notizen ohne Tags anzeigen.',
            },
            enableFolderNotes: {
                name: 'Ordnernotizen aktivieren',
                desc: 'Wenn aktiviert, werden Ordner mit zugehörigen Notizen als anklickbare Links angezeigt.',
            },
            folderNoteName: {
                name: 'Name der Ordnernotiz',
                desc: 'Name der Ordnernotiz-Datei. Leer lassen, um denselben Namen wie der Ordner zu verwenden.',
                placeholder: 'Leer lassen für Ordnernamen',
            },
            hideFolderNoteInList: {
                name: 'Ordnernotizen in Dateiliste ausblenden',
                desc: 'Die Ordnernotiz in der Dateiliste des Ordners ausblenden.',
            },
            confirmBeforeDelete: {
                name: 'Vor dem Löschen von Notizen bestätigen',
                desc: 'Bestätigungsdialog beim Löschen von Notizen oder Ordnern anzeigen',
            },
            useFrontmatterDates: {
                name: 'Metadaten aus Frontmatter lesen',
                desc: 'Notiznamen und Zeitstempel aus dem Frontmatter lesen, falls vorhanden, ansonsten Dateisystemwerte verwenden',
            },
            frontmatterNameField: {
                name: 'Namensfeld',
                desc: 'Frontmatter-Feld für den angezeigten Notiznamen. Leer lassen, um den Dateinamen zu verwenden.',
                placeholder: 'title',
            },
            frontmatterCreatedField: {
                name: 'Feld für Erstellungszeitstempel',
                desc: 'Frontmatter-Feldname für den Erstellungszeitstempel. Leer lassen, um nur das Dateisystemdatum zu verwenden.',
                placeholder: 'created',
            },
            frontmatterModifiedField: {
                name: 'Feld für Änderungszeitstempel',
                desc: 'Frontmatter-Feldname für den Änderungszeitstempel. Leer lassen, um nur das Dateisystemdatum zu verwenden.',
                placeholder: 'modified',
            },
            frontmatterDateFormat: {
                name: 'Zeitstempelformat',
                desc: 'Format zum Parsen von Zeitstempeln im Frontmatter',
                placeholder: "yyyy-MM-dd'T'HH:mm:ss",
                helpTooltip: 'Siehe date-fns Formatdokumentation',
                help: 'Häufige Formate:\nyyyy-MM-dd\'T\'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM',
            },
            supportDevelopment: {
                name: 'Entwicklung unterstützen',
                desc: 'Wenn Sie Notebook Navigator lieben, erwägen Sie bitte, die weitere Entwicklung zu unterstützen.',
                buttonText: '❤️ Auf GitHub sponsern',
            },
        },
    },
};