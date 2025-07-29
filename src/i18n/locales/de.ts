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
        featureImageAlt: 'Vorschaubild' // Alt text for thumbnail/preview images (English: Feature image)
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Wählen Sie einen Ordner oder Tag aus, um Notizen anzuzeigen', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'Keine Notizen', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Angeheftet' // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
    },

    // Folder tree
    folderTree: {
        rootFolderName: 'Tresor' // Display name for the vault root folder in the tree (English: Vault)
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Ohne Tag', // Label for the special item showing notes without tags (English: Untagged)
        favoriteTags: 'Favoriten', // Label for the favorites virtual folder (English: Favorites)
        hiddenTags: 'Versteckte Tags', // Label for the hidden tags virtual folder (English: Hidden tags)
        allTags: 'Tags', // Label for the tags virtual folder when favorites exist (English: Tags)
        tags: 'Tags' // Label for the tags virtual folder when no favorites exist (English: Tags)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Alle einklappen', // Tooltip for button that collapses all expanded items (English: Collapse all)
        expandAllFolders: 'Alle ausklappen', // Tooltip for button that expands all items (English: Expand all)
        newFolder: 'Neuer Ordner', // Tooltip for create new folder button (English: New folder)
        newNote: 'Neue Notiz erstellen', // Tooltip for create new note button (English: Create new note)
        mobileBackToNavigation: 'Zurück zur Navigation', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: 'Sortierreihenfolge ändern', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Standard', // Label for default sorting mode (English: Default)
        customSort: 'Benutzerdefiniert', // Label for custom sorting mode (English: Custom)
        showFolders: 'Navigation anzeigen', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'Navigation ausblenden', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        toggleSubfolders: 'Notizen aus Unterordnern anzeigen', // Tooltip for button to toggle showing notes from subfolders (English: Show notes from subfolders)
        autoExpandFoldersTags: 'Ordner und Tags automatisch erweitern', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showDualPane: 'Zweispaltige Ansicht anzeigen', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: 'Einspaltige Ansicht anzeigen' // Tooltip for button to show single-pane layout (English: Show single pane)
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
            revealInFolder: 'Im Ordner anzeigen',
            revealInFinder: 'Im Finder anzeigen',
            showInExplorer: 'Im Explorer anzeigen',
            copyDeepLink: 'Deep Link kopieren',
            renameNote: 'Notiz umbenennen',
            deleteNote: 'Notiz löschen',
            deleteMultipleNotes: '{count} Notizen löschen',
            moveToFolder: 'Move to...',
            moveMultipleToFolder: 'Move {count} files to...',
            // File-specific context menu items (non-markdown files)
            openMultipleFilesInNewTabs: '{count} Dateien in neuen Tabs öffnen',
            openMultipleFilesToRight: '{count} Dateien rechts öffnen',
            openMultipleFilesInNewWindows: '{count} Dateien in neuen Fenstern öffnen',
            pinFile: 'Datei anheften',
            unpinFile: 'Datei lösen',
            pinMultipleFiles: '{count} Dateien anheften',
            unpinMultipleFiles: '{count} Dateien lösen',
            duplicateFile: 'Datei duplizieren',
            duplicateMultipleFiles: '{count} Dateien duplizieren',
            renameFile: 'Datei umbenennen',
            deleteFile: 'Datei löschen',
            deleteMultipleFiles: '{count} Dateien löschen'
        },
        folder: {
            newNote: 'Neue Notiz erstellen',
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
            deleteFolder: 'Ordner löschen'
        },
        tag: {
            changeIcon: 'Symbol ändern',
            removeIcon: 'Symbol entfernen',
            changeColor: 'Farbe ändern',
            removeColor: 'Farbe entfernen'
        }
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Symbole suchen...',
            recentlyUsedHeader: 'Kürzlich verwendet',
            emptyStateSearch: 'Beginnen Sie zu tippen, um Symbole zu suchen',
            emptyStateNoResults: 'Keine Symbole gefunden',
            showingResultsInfo: 'Zeige 50 von {count} Ergebnissen. Geben Sie mehr ein, um die Suche einzugrenzen.',
            emojiInstructions: 'Geben Sie ein Emoji ein oder fügen Sie es ein, um es als Symbol zu verwenden'
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
                stone: 'Stein'
            }
        },
        tagOperation: {
            renameTitle: 'Tag {tag} umbenennen',
            deleteTitle: 'Tag {tag} löschen',
            newTagPrompt: 'Neuer Tag-Name',
            newTagPlaceholder: 'Neuen Tag-Namen eingeben',
            renameWarning: 'Das Umbenennen des Tags {oldTag} wird {count} {files} ändern.',
            deleteWarning: 'Das Löschen des Tags {tag} wird {count} {files} ändern.',
            modificationWarning: 'Dies wird die Änderungsdaten der Dateien aktualisieren.',
            affectedFiles: 'Betroffene Dateien:',
            andMore: '...und {count} weitere',
            confirmRename: 'Tag umbenennen',
            confirmDelete: 'Tag löschen',
            file: 'Datei',
            files: 'Dateien'
        },
        fileSystem: {
            newFolderTitle: 'Neuer Ordner',
            renameFolderTitle: 'Ordner umbenennen',
            renameFileTitle: 'Datei umbenennen',
            deleteFolderTitle: "'{name}' löschen?",
            deleteFileTitle: "'{name}' löschen?",
            folderNamePrompt: 'Ordnernamen eingeben:',
            renamePrompt: 'Neuen Namen eingeben:',
            deleteFolderConfirm: 'Sind Sie sicher, dass Sie diesen Ordner und seinen gesamten Inhalt löschen möchten?',
            deleteFileConfirm: 'Sind Sie sicher, dass Sie diese Datei löschen möchten?'
        },
        folderSuggest: {
            placeholder: 'In Ordner verschieben...',
            navigatePlaceholder: 'Zu Ordner navigieren...',
            instructions: {
                navigate: 'zum Navigieren',
                move: 'zum Verschieben',
                select: 'zum Auswählen',
                dismiss: 'zum Abbrechen'
            }
        },
        tagSuggest: {
            placeholder: 'Tags suchen...',
            navigatePlaceholder: 'Zu Tag navigieren...',
            instructions: {
                navigate: 'zum Navigieren',
                select: 'zum Auswählen',
                dismiss: 'zum Abbrechen'
            }
        }
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
            noFolderSelected: 'Kein Ordner im Notebook Navigator ausgewählt',
            noFileSelected: 'Keine Datei ausgewählt'
        },
        notifications: {
            deletedMultipleFiles: '{count} Dateien gelöscht',
            deepLinkCopied: 'Deep Link in die Zwischenablage kopiert'
        },
        confirmations: {
            deleteMultipleFiles: 'Möchten Sie wirklich {count} Dateien löschen?',
            deleteConfirmation: 'Diese Aktion kann nicht rückgängig gemacht werden.'
        },
        defaultNames: {
            untitled: 'Ohne Titel',
            untitledNumber: 'Ohne Titel {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Ein Ordner kann nicht in sich selbst oder einen Unterordner verschoben werden.',
            itemAlreadyExists: 'Ein Element mit dem Namen "{name}" existiert bereits an diesem Ort.',
            failedToMove: 'Verschieben fehlgeschlagen: {error}',
            failedToAddTag: 'Hinzufügen des Tags "{tag}" fehlgeschlagen',
            failedToClearTags: 'Entfernen der Tags fehlgeschlagen'
        },
        notifications: {
            filesAlreadyExist: '{count} Dateien existieren bereits am Zielort',
            addedTag: 'Tag "{tag}" zu {count} Dateien hinzugefügt',
            filesAlreadyHaveTag: '{count} Dateien haben dieses Tag oder ein spezifischeres bereits',
            clearedTags: 'Alle Tags von {count} Dateien entfernt',
            noTagsToClear: 'Keine Tags zum Entfernen'
        }
    },

    // Date grouping
    dateGroups: {
        today: 'Heute',
        yesterday: 'Gestern',
        previous7Days: 'Letzte 7 Tage',
        previous30Days: 'Letzte 30 Tage'
    },

    // Weekdays
    weekdays: {
        sunday: 'Sonntag',
        monday: 'Montag',
        tuesday: 'Dienstag',
        wednesday: 'Mittwoch',
        thursday: 'Donnerstag',
        friday: 'Freitag',
        saturday: 'Samstag'
    },

    // Plugin commands
    commands: {
        open: 'Öffnen', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealFile: 'Datei anzeigen', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        focusFile: 'Datei fokussieren', // Command palette: Moves keyboard focus to the file list pane (English: Focus file)
        toggleDualPane: 'Doppelbereichslayout umschalten', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: 'Dateien löschen', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: 'Neue Notiz erstellen', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: 'Dateien verschieben', // Command palette: Move selected files to another folder (English: Move files)
        navigateToFolder: 'Zu Ordner navigieren', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: 'Zu Tag navigieren', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        toggleSubfolders: 'Notizen aus Unterordnern umschalten' // Command palette: Toggles showing notes from subfolders (English: Toggle show notes from subfolders)
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Notebook Navigator', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'In Notebook Navigator anzeigen' // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Zuletzt geändert am',
        createdAt: 'Erstellt am',
        file: 'Datei',
        files: 'Dateien',
        folder: 'Ordner',
        folders: 'Ordner'
    },

    // Settings
    settings: {
        sections: {
            notes: 'Notizenanzeige',
            navigationPane: 'Ordneranzeige',
            tags: 'Tag-Anzeige',
            folders: 'Ordnernotizen',
            listPane: 'Listenbereich',
            advanced: 'Erweitert'
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
                    'title-desc': 'Titel (Z zuerst)'
                }
            },
            groupByDate: {
                name: 'Notizen nach Datum gruppieren',
                desc: 'Bei Sortierung nach Datum werden Notizen unter Datumsüberschriften gruppiert.'
            },
            showNotesFromSubfolders: {
                name: 'Notizen aus Unterordnern anzeigen',
                desc: 'Alle Notizen aus Unterordnern in der aktuellen Ordneransicht anzeigen.'
            },
            showParentFolderNames: {
                name: 'Übergeordnete Ordnernamen anzeigen',
                desc: 'Den übergeordneten Ordnernamen für Notizen aus Unterordnern anzeigen.'
            },
            dualPane: {
                name: 'Doppelbereichslayout (nur Desktop)',
                desc: 'Navigationsbereich und Listenbereich nebeneinander auf dem Desktop anzeigen.'
            },
            autoRevealActiveNote: {
                name: 'Aktive Notiz automatisch anzeigen',
                desc: 'Notizen automatisch anzeigen, wenn sie über Schnellauswahl, Links oder Suche geöffnet werden.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Erste Notiz automatisch auswählen (nur Desktop)',
                desc: 'Die erste Notiz automatisch öffnen, wenn Sie den Ordner oder Tag wechseln.'
            },
            autoExpandFoldersTags: {
                name: 'Ordner und Tags automatisch erweitern',
                desc: 'Ordner und Tags automatisch erweitern, wenn sie ausgewählt werden.'
            },
            showTooltips: {
                name: 'Tooltips anzeigen (nur Desktop)',
                desc: 'Zeige Hover-Tooltips mit zusätzlichen Informationen für Notizen und Ordner an.'
            },
            excludedNotes: {
                name: 'Ausgeschlossene Notizen',
                desc: 'Kommagetrennte Liste von Frontmatter-Eigenschaften. Notizen mit diesen Eigenschaften werden ausgeblendet (z.B. Entwurf, privat, archiviert).',
                placeholder: 'entwurf, privat'
            },
            excludedFolders: {
                name: 'Ausgeschlossene Ordner',
                desc: 'Kommagetrennte Liste von auszublendenden Ordnern. Unterstützt Platzhalter: assets* (beginnt mit), *_temp (endet mit).',
                placeholder: 'vorlagen, assets*, *_temp'
            },
            fileVisibility: {
                name: 'Dateitypen anzeigen',
                desc: 'Wählen Sie, welche Dateitypen im Navigator angezeigt werden sollen. Dateien, die von Obsidian nicht unterstützt werden, werden in der Standardanwendung Ihres Systems geöffnet.',
                options: {
                    markdownOnly: 'Nur Markdown',
                    supported: 'Unterstützte Dateien',
                    all: 'Alle Dateien'
                }
            },
            showFileDate: {
                name: 'Datum anzeigen',
                desc: 'Das Datum unter Notizennamen anzeigen.'
            },
            showFileTags: {
                name: 'Tags anzeigen',
                desc: 'Zeigt klickbare Tags in Datei-Elementen an. Verwenden Sie Tag-Farben, um verschiedene Tag-Typen visuell zu unterscheiden.'
            },
            dateFormat: {
                name: 'Datumsformat',
                desc: 'Format für die Datumsanzeige (verwendet date-fns Format).',
                placeholder: 'dd.MM.yyyy',
                help: 'Gängige Formate:\ndd.MM.yyyy = 25.05.2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = Jahr\nMMMM/MMM/MM = Monat\ndd/d = Tag\nEEEE/EEE = Wochentag',
                helpTooltip: 'Klicken für Formatreferenz'
            },
            timeFormat: {
                name: 'Zeitformat',
                desc: 'Format für die Zeitanzeige (verwendet date-fns Format).',
                placeholder: 'HH:mm',
                help: 'Gängige Formate:\nHH:mm = 14:30 (24-Stunden)\nh:mm a = 2:30 PM (12-Stunden)\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nTokens:\nHH/H = 24-Stunden\nhh/h = 12-Stunden\nmm = Minuten\nss = Sekunden\na = AM/PM',
                helpTooltip: 'Klicken für Formatreferenz'
            },
            showFilePreview: {
                name: 'Notizenvorschau anzeigen (*)',
                desc: 'Vorschautext unter Notizennamen anzeigen.'
            },
            skipHeadingsInPreview: {
                name: 'Überschriften in Vorschau überspringen',
                desc: 'Überschriftenzeilen bei der Erstellung des Vorschautextes überspringen.'
            },
            previewProperties: {
                name: 'Vorschau-Eigenschaften',
                desc: 'Kommagetrennte Liste von Frontmatter-Eigenschaften für Vorschautext. Die erste Eigenschaft mit Text wird verwendet.',
                placeholder: 'zusammenfassung, beschreibung, abstrakt',
                info: 'Wenn kein Vorschautext in den angegebenen Eigenschaften gefunden wird, wird die Vorschau aus dem Notizinhalt generiert.'
            },
            previewRows: {
                name: 'Vorschauzeilen',
                desc: 'Anzahl der Zeilen für den Vorschautext.',
                options: {
                    '1': '1 Zeile',
                    '2': '2 Zeilen',
                    '3': '3 Zeilen',
                    '4': '4 Zeilen',
                    '5': '5 Zeilen'
                }
            },
            fileNameRows: {
                name: 'Titelzeilen',
                desc: 'Anzahl der Zeilen für Notizentitel.',
                options: {
                    '1': '1 Zeile',
                    '2': '2 Zeilen'
                }
            },
            showFeatureImage: {
                name: 'Vorschaubild anzeigen (*)',
                desc: 'Miniaturbilder aus Frontmatter anzeigen. Tipp: Verwenden Sie das "Featured Image" Plugin, um automatisch Vorschaubilder für alle Ihre Dokumente festzulegen.'
            },
            featureImageProperties: {
                name: 'Bildeigenschaften',
                desc: 'Kommagetrennte Liste von Frontmatter-Eigenschaften für Miniaturbilder. Die erste Eigenschaft mit einem Bild wird verwendet.',
                tip: 'Verwenden Sie das "Featured Image" Plugin für automatische Vorschaubilder. Für beste Leistung verwenden Sie 42px Thumbnails oder 84px für Retina-Displays.',
                placeholder: 'featureResized, feature',
                embedFallback:
                    'Wenn kein Bild in den obigen Eigenschaften gefunden wird, wird das erste eingebettete Bild im Dokument verwendet (erfordert Obsidian 1.9.4+)'
            },
            showRootFolder: {
                name: 'Wurzelordner anzeigen',
                desc: '"Tresor" als Wurzelordner im Baum anzeigen.'
            },
            showNoteCount: {
                name: 'Notizenzahl anzeigen',
                desc: 'Die Anzahl der Notizen in jedem Ordner und Tag anzeigen.'
            },
            showIcons: {
                name: 'Symbole anzeigen',
                desc: 'Symbole neben Ordnern und Tags im Navigationsbereich anzeigen.'
            },
            collapseButtonBehavior: {
                name: 'Verhalten der Einklapp-Schaltfläche',
                desc: 'Wählen Sie, was die Schaltfläche zum Ein-/Ausklappen beeinflusst.',
                options: {
                    all: 'Alle Ordner und Tags',
                    foldersOnly: 'Nur Ordner',
                    tagsOnly: 'Nur Tags'
                }
            },
            showTags: {
                name: 'Tags anzeigen (*)',
                desc: 'Tag-Bereich unterhalb der Ordner im Navigator anzeigen.'
            },
            showTagsAboveFolders: {
                name: 'Tags über Ordnern anzeigen',
                desc: 'Tag-Bereich vor den Ordnern im Navigator anzeigen.'
            },
            showFavoriteTagsFolder: {
                name: 'Favoriten-Ordner anzeigen',
                desc: '"Favoriten" als einklappbaren Ordner anzeigen, wenn Favoriten-Tags konfiguriert sind.'
            },
            showAllTagsFolder: {
                name: 'Tags-Ordner anzeigen',
                desc: '"Tags" als einklappbaren Ordner anzeigen.'
            },
            showUntagged: {
                name: 'Ungetaggte Notizen anzeigen',
                desc: '"Ohne Tag" für Notizen ohne Tags anzeigen.'
            },
            showUntaggedInFavorites: {
                name: 'Ungetaggte Notizen im Favoriten-Bereich anzeigen',
                desc: 'Ungetaggte Notizen im Favoriten-Bereich anzeigen, entweder im Ordner oder direkt unter den Favoriten.'
            },
            favoriteTags: {
                name: 'Favoriten-Tags',
                desc: 'Kommagetrennte Liste von favorisierten Tag-Mustern. Unterstützt exakte Übereinstimmung, Platzhalter (*) und Regex (/muster/).',
                placeholder: 'inbox, projekt-*, /^täglich-\\d{4}/'
            },
            hiddenTags: {
                name: 'Versteckte Tags',
                desc: 'Kommagetrennte Liste von Tag-Mustern, die im Tag-Baum ausgeblendet werden sollen. Unterstützt exakte Übereinstimmung, Platzhalter (*) und Regex (/muster/).',
                placeholder: 'intern, temp-*, /^archiv-\\d{4}/'
            },
            enableFolderNotes: {
                name: 'Ordnernotizen aktivieren',
                desc: 'Wenn aktiviert, werden Ordner mit zugehörigen Notizen als anklickbare Links angezeigt.'
            },
            folderNoteName: {
                name: 'Name der Ordnernotiz',
                desc: 'Name der Ordnernotiz. Leer lassen, um denselben Namen wie der Ordner zu verwenden.',
                placeholder: 'Leer lassen für Ordnernamen'
            },
            hideFolderNoteInList: {
                name: 'Ordnernotizen in Liste ausblenden',
                desc: 'Die Ordnernotiz in der Notizliste des Ordners ausblenden.'
            },
            confirmBeforeDelete: {
                name: 'Vor dem Löschen bestätigen',
                desc: 'Bestätigungsdialog beim Löschen von Notizen oder Ordnern anzeigen'
            },
            useFrontmatterDates: {
                name: 'Metadaten aus Frontmatter lesen (*)',
                desc: 'Notiznamen und Zeitstempel aus dem Frontmatter lesen, falls vorhanden, ansonsten Dateisystemwerte verwenden'
            },
            frontmatterNameField: {
                name: 'Namensfeld',
                desc: 'Frontmatter-Feld für den angezeigten Notiznamen. Leer lassen, um den Dateinamen zu verwenden.',
                placeholder: 'titel'
            },
            frontmatterCreatedField: {
                name: 'Feld für Erstellungszeitstempel',
                desc: 'Frontmatter-Feldname für den Erstellungszeitstempel. Leer lassen, um nur das Dateisystemdatum zu verwenden.',
                placeholder: 'erstellt'
            },
            frontmatterModifiedField: {
                name: 'Feld für Änderungszeitstempel',
                desc: 'Frontmatter-Feldname für den Änderungszeitstempel. Leer lassen, um nur das Dateisystemdatum zu verwenden.',
                placeholder: 'geändert'
            },
            frontmatterDateFormat: {
                name: 'Zeitstempelformat',
                desc: 'Format zum Parsen von Zeitstempeln im Frontmatter. Leer lassen, um ISO 8601-Format zu verwenden',
                helpTooltip: 'Siehe date-fns Formatdokumentation',
                help: "Häufige Formate:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: 'Entwicklung unterstützen',
                desc: 'Wenn Sie Notebook Navigator lieben, erwägen Sie bitte, die weitere Entwicklung zu unterstützen.',
                buttonText: '❤️ Auf GitHub sponsern'
            },
            whatsNew: {
                name: 'Neuigkeiten',
                desc: 'Letzte Updates und Verbesserungen anzeigen',
                buttonText: 'Letzte Updates anzeigen'
            },
            cacheStatistics: {
                localCache: '(*) Lokaler Cache',
                items: 'Einträge',
                withTags: 'mit Tags',
                withPreviewText: 'mit Vorschautext',
                withFeatureImage: 'mit Vorschaubild',
                withMetadata: 'mit Metadaten'
            },
            metadataInfo: {
                successfullyParsed: 'Erfolgreich geparst',
                itemsWithName: 'Einträge mit Name',
                withCreatedDate: 'mit Erstellungsdatum',
                withModifiedDate: 'mit Änderungsdatum',
                failedToParse: 'Parsing fehlgeschlagen',
                createdDates: 'Erstellungsdaten',
                modifiedDates: 'Änderungsdaten',
                checkTimestampFormat: 'Überprüfen Sie Ihr Zeitstempelformat.',
                exportFailed: 'Fehler exportieren'
            }
        }
    },
    whatsNew: {
        title: 'Neuigkeiten in Notebook Navigator',
        supportMessage: 'Wenn Sie Notebook Navigator hilfreich finden, erwägen Sie bitte, die Entwicklung zu unterstützen.',
        supportButton: '❤️ Unterstützen',
        thanksButton: 'Danke!'
    }
};
