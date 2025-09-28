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
        remove: 'Entfernen', // Button text for remove operations in dialogs (English: Remove)
        submit: 'OK', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'Keine Auswahl', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Ohne Tag', // Label for notes without any tags (English: Untagged)
        untitled: 'Ohne Titel', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'Vorschaubild', // Alt text for thumbnail/preview images (English: Feature image)
        unknownError: 'Unbekannter Fehler' // Generic fallback when an error has no message (English: Unknown error)
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Wählen Sie einen Ordner oder Tag aus, um Notizen anzuzeigen', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'Keine Notizen', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Angeheftet', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
        notesSection: 'Notizen', // Header shown between pinned and regular items when showing documents only (English: Notes)
        filesSection: 'Dateien' // Header shown between pinned and regular items when showing supported or all files (English: Files)
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Ohne Tag', // Label for the special item showing notes without tags (English: Untagged)
        favoriteTags: 'Favoriten', // Label for the favorites virtual folder (English: Favorites)
        hiddenTags: 'Versteckte Tags', // Label for the hidden tags virtual folder (English: Hidden tags)
        allTags: 'Tags', // Label for the tags virtual folder when favorites exist (English: Tags)
        tags: 'Tags' // Label for the tags virtual folder when no favorites exist (English: Tags)
    },

    navigationPane: {
        shortcutsHeader: 'Kurzbefehle',
        recentNotesHeader: 'Neueste Notizen',
        recentFilesHeader: 'Neueste Dateien',
        reorderRootFoldersTitle: 'Hauptordner neu anordnen',
        reorderRootFoldersHint: 'Ordner ziehen, um die Reihenfolge zu ändern',
        vaultRootLabel: 'Tresor',
        resetRootFolderOrder: 'Auf alphabetische Reihenfolge zurücksetzen',
        dragHandleLabel: 'Ziehen zum Neuanordnen'
    },

    shortcuts: {
        folderExists: 'Ordner bereits in Kurzbefehlen vorhanden',
        noteExists: 'Notiz bereits in Kurzbefehlen vorhanden',
        tagExists: 'Tag bereits in Kurzbefehlen vorhanden',
        searchExists: 'Such-Kurzbefehl existiert bereits',
        emptySearchQuery: 'Geben Sie eine Suchanfrage ein, bevor Sie sie speichern',
        emptySearchName: 'Geben Sie einen Namen ein, bevor Sie die Suche speichern',
        add: 'Zu Shortcuts hinzufügen',
        remove: 'Aus Shortcuts entfernen',
        moveUp: 'Nach oben verschieben',
        moveDown: 'Nach unten verschieben'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Elemente einklappen', // Tooltip for button that collapses expanded items (English: Collapse items)
        expandAllFolders: 'Alle Elemente ausklappen', // Tooltip for button that expands all items (English: Expand all items)
        scrollToShortcuts: 'Zu Kurzbefehlen scrollen',
        newFolder: 'Neuer Ordner', // Tooltip for create new folder button (English: New folder)
        newNote: 'Neue Notiz', // Tooltip for create new note button (English: New note)
        mobileBackToNavigation: 'Zurück zur Navigation', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: 'Sortierreihenfolge ändern', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Standard', // Label for default sorting mode (English: Default)
        customSort: 'Benutzerdefiniert', // Label for custom sorting mode (English: Custom)
        showFolders: 'Navigation anzeigen', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'Navigation ausblenden', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        reorderRootFolders: 'Hauptordner neu anordnen',
        finishRootFolderReorder: 'Neuanordnung der Hauptordner abschließen',
        toggleDescendantNotes: 'Notizen aus Nachkommen anzeigen (Ordner und Tags)', // Tooltip for button to toggle showing notes from descendants (English: Show notes from descendants (folders and tags))
        autoExpandFoldersTags: 'Ordner und Tags automatisch erweitern', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showExcludedItems: 'Versteckte Elemente anzeigen', // Tooltip for button to show hidden items (English: Show hidden items)
        hideExcludedItems: 'Versteckte Elemente ausblenden', // Tooltip for button to hide hidden items (English: Hide hidden items)
        showDualPane: 'Zweispaltige Ansicht anzeigen', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: 'Einspaltige Ansicht anzeigen', // Tooltip for button to show single-pane layout (English: Show single pane)
        changeAppearance: 'Erscheinungsbild ändern', // Tooltip for button to change folder appearance settings (English: Change appearance)
        search: 'Suchen' // Tooltip for search button (English: Search)
    },
    // Search input
    searchInput: {
        placeholder: 'Suchen...', // Placeholder text for search input (English: Search...)
        placeholderOmnisearch: 'Omnisearch...', // Placeholder text when Omnisearch provider is active (English: Omnisearch...)
        clearSearch: 'Suche löschen', // Tooltip for clear search button (English: Clear search)
        saveSearchShortcut: 'Suche zu Shortcuts hinzufügen',
        removeSearchShortcut: 'Suche aus Shortcuts entfernen',
        shortcutModalTitle: 'Suche als Shortcut speichern',
        shortcutNameLabel: 'Shortcut-Name',
        shortcutNamePlaceholder: 'Shortcut-Namen eingeben'
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
            moveToFolder: 'Verschieben nach...',
            moveMultipleToFolder: '{count} Dateien verschieben nach...',
            addTag: 'Tag hinzufügen',
            removeTag: 'Tag entfernen',
            removeAllTags: 'Alle Tags entfernen',
            changeIcon: 'Icon ändern',
            removeIcon: 'Icon entfernen',
            changeColor: 'Farbe ändern',
            removeColor: 'Farbe entfernen',
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
            changeColor: 'Farbe ändern',
            changeBackground: 'Hintergrund ändern',
            excludeFolder: 'Ordner verstecken',
            renameFolder: 'Ordner umbenennen',
            deleteFolder: 'Ordner löschen'
        },
        tag: {
            changeIcon: 'Symbol ändern',
            changeColor: 'Farbe ändern',
            changeBackground: 'Hintergrund ändern',
            addToFavorites: 'Zu Favoriten hinzufügen',
            removeFromFavorites: 'Aus Favoriten entfernen',
            hideTag: 'Tag ausblenden'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: 'Standard-Aussehen',
        slimPreset: 'Schmal (ohne Datum/Vorschau/Bild)',
        titleRows: 'Titelzeilen',
        previewRows: 'Vorschauzeilen',
        defaultOption: (rows: number) => `Standard (${rows})`,
        defaultTitleOption: (rows: number) => `Standard-Titelzeilen (${rows})`,
        defaultPreviewOption: (rows: number) => `Standard-Vorschauzeilen (${rows})`,
        titleRowOption: (rows: number) => `${rows} Titelzeile${rows === 1 ? '' : 'n'}`,
        previewRowOption: (rows: number) => `${rows} Vorschauzeile${rows === 1 ? '' : 'n'}`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Symbole suchen...',
            recentlyUsedHeader: 'Kürzlich verwendet',
            emptyStateSearch: 'Beginnen Sie zu tippen, um Symbole zu suchen',
            emptyStateNoResults: 'Keine Symbole gefunden',
            showingResultsInfo: 'Zeige 50 von {count} Ergebnissen. Geben Sie mehr ein, um die Suche einzugrenzen.',
            emojiInstructions: 'Geben Sie ein Emoji ein oder fügen Sie es ein, um es als Symbol zu verwenden',
            removeIcon: 'Icon entfernen'
        },
        colorPicker: {
            currentColor: 'Aktuell',
            newColor: 'Neu',
            presetColors: 'Vordefinierte Farben',
            recentColors: 'Zuletzt verwendete Farben',
            clearRecentColors: 'Zuletzt verwendete Farben löschen',
            removeRecentColor: 'Farbe entfernen',
            removeColor: 'Farbe entfernen',
            apply: 'Anwenden',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
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
            renameVaultTitle: 'Anzeigenamen des Tresors ändern',
            renameVaultPrompt: 'Benutzerdefinierten Anzeigenamen eingeben (leer lassen für Standard):',
            deleteFolderConfirm: 'Sind Sie sicher, dass Sie diesen Ordner und seinen gesamten Inhalt löschen möchten?',
            deleteFileConfirm: 'Sind Sie sicher, dass Sie diese Datei löschen möchten?',
            removeAllTagsTitle: 'Alle Tags entfernen',
            removeAllTagsFromNote: 'Sind Sie sicher, dass Sie alle Tags von dieser Notiz entfernen möchten?',
            removeAllTagsFromNotes: 'Sind Sie sicher, dass Sie alle Tags von {count} Notizen entfernen möchten?'
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
        homepage: {
            placeholder: 'Dateien durchsuchen...',
            instructions: {
                navigate: 'zum Navigieren',
                select: 'als Startseite setzen',
                dismiss: 'zum Abbrechen'
            }
        },
        tagSuggest: {
            placeholder: 'Tags suchen...',
            navigatePlaceholder: 'Zu Tag navigieren...',
            addPlaceholder: 'Nach hinzuzufügendem Tag suchen...',
            removePlaceholder: 'Tag zum Entfernen auswählen...',
            createNewTag: 'Neuen Tag erstellen: #{tag}',
            instructions: {
                navigate: 'zum Navigieren',
                select: 'zum Auswählen',
                dismiss: 'zum Abbrechen',
                add: 'zum Hinzufügen des Tags',
                remove: 'zum Entfernen des Tags'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Ordner konnte nicht erstellt werden: {error}',
            createFile: 'Datei konnte nicht erstellt werden: {error}',
            renameFolder: 'Ordner konnte nicht umbenannt werden: {error}',
            renameFolderNoteConflict: 'Umbenennung nicht möglich: "{name}" existiert bereits in diesem Ordner',
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
            failedToDeleteMultipleFiles: 'Löschen von {count} Dateien fehlgeschlagen',
            versionHistoryNotAvailable: 'Versionsverlauf-Dienst nicht verfügbar',
            drawingAlreadyExists: 'Eine Zeichnung mit diesem Namen existiert bereits',
            failedToCreateDrawing: 'Zeichnung konnte nicht erstellt werden',
            noFolderSelected: 'Kein Ordner im Notebook Navigator ausgewählt',
            noFileSelected: 'Keine Datei ausgewählt'
        },
        notices: {
            excludedFolder: 'Ordner ausgeschlossen: {name}'
        },
        notifications: {
            deletedMultipleFiles: '{count} Dateien gelöscht',
            movedMultipleFiles: '{count} Dateien nach {folder} verschoben',
            folderMoved: 'Ordner "{name}" verschoben',
            deepLinkCopied: 'Deep Link in die Zwischenablage kopiert',
            tagAddedToNote: 'Tag zu 1 Notiz hinzugefügt',
            tagAddedToNotes: 'Tag zu {count} Notizen hinzugefügt',
            tagRemovedFromNote: 'Tag von 1 Notiz entfernt',
            tagRemovedFromNotes: 'Tag von {count} Notizen entfernt',
            tagsClearedFromNote: 'Alle Tags von 1 Notiz entfernt',
            tagsClearedFromNotes: 'Alle Tags von {count} Notizen entfernt',
            noTagsToRemove: 'Keine Tags zum Entfernen',
            noFilesSelected: 'Keine Dateien ausgewählt',
            tagOperationsNotAvailable: 'Tag-Operationen nicht verfügbar',
            iconPackDownloaded: '{provider} heruntergeladen',
            iconPackRemoved: '{provider} entfernt',
            iconPackLoadFailed: '{provider} konnte nicht geladen werden'
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
            failedToClearTags: 'Entfernen der Tags fehlgeschlagen',
            failedToMoveFolder: 'Ordner "{name}" konnte nicht verschoben werden',
            failedToImportFiles: 'Import fehlgeschlagen: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} Dateien existieren bereits am Zielort',
            addedTag: 'Tag "{tag}" zu {count} Dateien hinzugefügt',
            filesAlreadyHaveTag: '{count} Dateien haben dieses Tag oder ein spezifischeres bereits',
            clearedTags: 'Alle Tags von {count} Dateien entfernt',
            noTagsToClear: 'Keine Tags zum Entfernen',
            fileImported: '1 Datei importiert',
            filesImported: '{count} Dateien importiert'
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
        openHomepage: 'Startseite öffnen', // Command palette: Opens the Notebook Navigator view and loads the homepage file (English: Open homepage)
        revealFile: 'Datei anzeigen', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        search: 'Suchen', // Command palette: Toggle search in the file list (English: Search)
        toggleDualPane: 'Doppelbereichslayout umschalten', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: 'Dateien löschen', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: 'Neue Notiz erstellen', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: 'Dateien verschieben', // Command palette: Move selected files to another folder (English: Move files)
        navigateToFolder: 'Zu Ordner navigieren', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: 'Zu Tag navigieren', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        toggleDescendants: 'Nachkommen umschalten', // Command palette: Toggles showing notes from descendants (English: Toggle descendants)
        toggleHidden: 'Versteckte Elemente umschalten', // Command palette: Toggles showing hidden items (English: Toggle hidden items)
        collapseExpand: 'Alle Elemente ein-/ausklappen', // Command palette: Collapse or expand all folders and tags (English: Collapse / expand all items)
        addTag: 'Tag zu ausgewählten Dateien hinzufügen', // Command palette: Opens a dialog to add a tag to selected files (English: Add tag to selected files)
        removeTag: 'Tag von ausgewählten Dateien entfernen', // Command palette: Opens a dialog to remove a tag from selected files (English: Remove tag from selected files)
        removeAllTags: 'Alle Tags von ausgewählten Dateien entfernen', // Command palette: Removes all tags from selected files (English: Remove all tags from selected files)
        rebuildCache: 'Cache neu aufbauen' // Command palette: Rebuilds the local Notebook Navigator cache (English: Rebuild cache)
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
        metadataReport: {
            exportSuccess: 'Fehlgeschlagene Metadaten-Bericht exportiert nach: {filename}',
            exportFailed: 'Export des Metadaten-Berichts fehlgeschlagen'
        },
        sections: {
            notes: 'Notizenanzeige',
            navigationPane: 'Ordneranzeige',
            icons: 'Icon-Pakete',
            tags: 'Tag-Anzeige',
            folders: 'Ordnernotizen',
            search: 'Suchen',
            listPane: 'Listenbereich',
            hotkeys: 'Tastenkürzel',
            advanced: 'Erweitert'
        },
        items: {
            searchProvider: {
                name: 'Suchanbieter',
                desc: 'Wählen Sie zwischen schneller Dateinamensuche oder Volltextsuche mit dem Omnisearch-Plugin.',
                options: {
                    internal: 'Filtersuche',
                    omnisearch: 'Omnisearch (Volltext)'
                },
                info: {
                    filterSearch: {
                        title: 'Filtersuche (Standard):',
                        description:
                            'Schnelle, leichtgewichtige Suche, die Dateien nach Namen und Tags im aktuellen Ordner und Unterordnern filtert. Unterstützt Tag-Filterung mit # Präfix (z.B. #projekt), Ausschluss mit ! Präfix (z.B. !entwurf, !#archiviert), und das Finden von Notizen ohne Tags mit !#. Ideal für die schnelle Navigation im aktuellen Kontext.'
                    },
                    omnisearch: {
                        title: 'Omnisearch:',
                        description:
                            'Volltextsuche, die Ihren gesamten Tresor durchsucht und dann die Ergebnisse filtert, um nur Dateien aus dem aktuellen Ordner, Unterordnern oder ausgewählten Tags anzuzeigen. Erfordert die Installation des Omnisearch-Plugins - falls nicht verfügbar, fällt die Suche automatisch auf die Filtersuche zurück.',
                        warningNotInstalled: 'Omnisearch-Plugin nicht installiert. Filtersuche wird verwendet.',
                        limitations: {
                            title: 'Bekannte Einschränkungen:',
                            performance:
                                'Leistung: Kann langsam sein, besonders bei der Suche nach weniger als 3 Zeichen in großen Tresoren',
                            pathBug:
                                'Pfadfehler: Kann nicht in Pfaden mit Nicht-ASCII-Zeichen suchen und durchsucht Unterpfade nicht korrekt, was die angezeigten Suchergebnisse beeinflusst',
                            limitedResults:
                                'Begrenzte Ergebnisse: Da Omnisearch den gesamten Tresor durchsucht und eine begrenzte Anzahl von Ergebnissen vor der Filterung zurückgibt, erscheinen relevante Dateien aus Ihrem aktuellen Ordner möglicherweise nicht, wenn zu viele Treffer an anderer Stelle im Tresor vorhanden sind',
                            previewText:
                                'Vorschautext: Notizvorschauen werden durch Omnisearch-Ergebnisauszüge ersetzt, die möglicherweise nicht die tatsächliche Suchtreffhervorhebung anzeigen, wenn sie an anderer Stelle in der Datei erscheint'
                        }
                    }
                }
            },
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
            optimizeNoteHeight: {
                name: 'Notizenhöhe optimieren',
                desc: 'Höhe für angeheftete Notizen und Notizen ohne Vorschautext reduzieren.'
            },
            showParentFolderNames: {
                name: 'Übergeordnete Ordnernamen anzeigen',
                desc: 'Den übergeordneten Ordnernamen für Notizen in Unterordnern oder Tags anzeigen.'
            },
            showQuickActions: {
                name: 'Schnellaktionen anzeigen (nur Desktop)',
                desc: 'Zeige Hover-Aktionen auf Dateielementen.'
            },
            quickActionsRevealInFolder: {
                name: 'Im Ordner anzeigen',
                desc: 'Schnellaktion: Notiz im übergeordneten Ordner anzeigen. Nur sichtbar bei Notizen aus Unterordnern oder in Tags (nicht im eigentlichen Ordner der Notiz).'
            },
            quickActionsPinNote: {
                name: 'Notiz anheften',
                desc: 'Schnellaktion: Notiz oben in der Liste anheften oder lösen.'
            },
            quickActionsOpenInNewTab: {
                name: 'In neuem Tab öffnen',
                desc: 'Schnellaktion: Notiz in neuem Tab öffnen.'
            },
            dualPane: {
                name: 'Doppelbereichslayout (nur Desktop, nicht synchronisiert)',
                desc: 'Navigationsbereich und Listenbereich nebeneinander auf dem Desktop anzeigen.'
            },
            singlePaneStartView: {
                name: 'Standard-Startansicht',
                desc: 'Wählen Sie die Ansicht, die beim Öffnen von Notebook Navigator angezeigt wird. Die Navigationsansicht bietet schnellen Zugriff auf Verknüpfungen, aktuelle Notizen und Ordnerstruktur. Die Notizlistenansicht zeigt Dateien direkt für sofortigen Zugriff.',
                options: {
                    navigation: 'Navigation (Verknüpfungen und Ordner)',
                    files: 'Notizliste (direkter Dateizugriff)'
                }
            },
            autoRevealActiveNote: {
                name: 'Aktive Notiz automatisch anzeigen',
                desc: 'Notizen automatisch anzeigen, wenn sie über Schnellauswahl, Links oder Suche geöffnet werden.'
            },
            autoRevealIgnoreRightSidebar: {
                name: 'Ereignisse von rechter Seitenleiste ignorieren',
                desc: 'Aktive Notiz nicht ändern, wenn in der rechten Seitenleiste auf Notizen geklickt oder diese gewechselt werden.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Erste Notiz automatisch auswählen (nur Desktop)',
                desc: 'Die erste Notiz automatisch öffnen, wenn Sie den Ordner oder Tag wechseln.'
            },
            autoExpandFoldersTags: {
                name: 'Ordner und Tags automatisch erweitern',
                desc: 'Ordner und Tags automatisch erweitern, wenn sie ausgewählt werden.'
            },
            showShortcuts: {
                name: 'Shortcuts anzeigen',
                desc: 'Shortcut-Bereich im Navigationsbereich anzeigen.'
            },
            showRecentNotes: {
                name: 'Neueste Notizen anzeigen',
                desc: 'Den Bereich für neueste Notizen im Navigationsbereich anzeigen.'
            },
            recentNotesCount: {
                name: 'Anzahl neuester Notizen',
                desc: 'Anzahl der anzuzeigenden neuesten Notizen.'
            },
            showTooltips: {
                name: 'Tooltips anzeigen (nur Desktop)',
                desc: 'Zeige Hover-Tooltips mit zusätzlichen Informationen für Notizen und Ordner an.'
            },
            multiSelectModifier: {
                name: 'Mehrfachauswahl-Modifikator',
                desc: 'Wählen Sie, welche Modifikatortaste die Mehrfachauswahl umschaltet. Wenn Option/Alt ausgewählt ist, öffnet Cmd/Strg-Klick Notizen in einem neuen Tab.',
                options: {
                    cmdCtrl: 'Cmd/Strg-Klick',
                    optionAlt: 'Option/Alt-Klick'
                }
            },
            excludedNotes: {
                name: 'Notizen verstecken',
                desc: 'Kommagetrennte Liste von Frontmatter-Eigenschaften. Notizen mit diesen Eigenschaften werden ausgeblendet (z.B. Entwurf, privat, archiviert).',
                placeholder: 'entwurf, privat'
            },
            excludedFolders: {
                name: 'Ordner verstecken',
                desc: 'Kommagetrennte Liste von auszublendenden Ordnern. Namensmuster: assets* (Ordner die mit assets beginnen), *_temp (endet mit _temp). Pfadmuster: /archive (nur Wurzel-Archive), /res* (Wurzelordner die mit res beginnen), /*/temp (temp-Ordner eine Ebene tief), /projects/* (alle Ordner in projects).',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            fileVisibility: {
                name: 'Dateitypen anzeigen',
                desc: 'Filtern Sie, welche Dateitypen im Navigator angezeigt werden. Dateitypen, die von Obsidian nicht unterstützt werden, können in externen Anwendungen geöffnet werden.',
                options: {
                    documents: 'Dokumente (.md, .canvas, .base)',
                    supported: 'Unterstützt (öffnet in Obsidian)',
                    all: 'Alle (öffnet ggf. extern)'
                }
            },
            homepage: {
                name: 'Startseite',
                desc: 'Datei auswählen, die Notebook Navigator automatisch öffnet, z. B. ein Dashboard.',
                current: 'Aktuell: {path}',
                chooseButton: 'Datei auswählen',
                clearButton: 'Zurücksetzen'
            },
            showFileDate: {
                name: 'Datum anzeigen',
                desc: 'Das Datum unter Notizennamen anzeigen.'
            },
            showFileTags: {
                name: 'Datei-Tags anzeigen',
                desc: 'Zeigt klickbare Tags in Datei-Elementen an. Verwenden Sie Tag-Farben, um verschiedene Tag-Typen visuell zu unterscheiden.'
            },
            showFileTagsInSlimMode: {
                name: 'Datei-Tags im schlanken Modus anzeigen',
                desc: 'Tags anzeigen, wenn Datum, Vorschau und Bild ausgeblendet sind.'
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
            skipCodeBlocksInPreview: {
                name: 'Codeblöcke in Vorschau überspringen',
                desc: 'Codeblöcke bei der Erstellung des Vorschautextes überspringen.'
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
                desc: 'Kommagetrennte Liste von Frontmatter-Eigenschaften für Miniaturbilder. Die erste Eigenschaft mit einem Bild wird verwendet. Wenn leer und die Fallback-Einstellung aktiviert ist, wird das erste eingebettete Bild verwendet.',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: 'Eingebettetes Bild als Fallback verwenden',
                desc: 'Verwende das erste eingebettete Bild im Dokument als Fallback, wenn kein Miniaturbild in den Frontmatter-Eigenschaften gefunden wird (erfordert Obsidian 1.9.4+). Deaktivieren Sie dies, um zu überprüfen, ob Miniaturbilder richtig konfiguriert sind.'
            },
            showRootFolder: {
                name: 'Wurzelordner anzeigen',
                desc: 'Den Namen des Wurzelordners im Baum anzeigen.'
            },
            inheritFolderColors: {
                name: 'Ordnerfarben vererben',
                desc: 'Unterordner erben die Farbe von übergeordneten Ordnern.'
            },
            showNoteCount: {
                name: 'Notizenzahl anzeigen',
                desc: 'Die Anzahl der Notizen neben jedem Ordner und Tag anzeigen.'
            },
            showIcons: {
                name: 'Symbole anzeigen',
                desc: 'Symbole neben Ordnern und Tags im Navigationsbereich anzeigen.'
            },
            collapseBehavior: {
                name: 'Elemente einklappen',
                desc: 'Wählen Sie, was die Schaltfläche zum Ein-/Ausklappen beeinflusst.',
                options: {
                    all: 'Alle Ordner und Tags',
                    foldersOnly: 'Nur Ordner',
                    tagsOnly: 'Nur Tags'
                }
            },
            smartCollapse: {
                name: 'Ausgewähltes Element erweitert halten',
                desc: 'Beim Einklappen bleiben der aktuell ausgewählte Ordner oder Tag und seine übergeordneten Elemente erweitert.'
            },
            navIndent: {
                name: 'Baum-Einrückung',
                desc: 'Passen Sie die Einrückungsbreite für verschachtelte Ordner und Tags an.'
            },
            navItemHeight: {
                name: 'Zeilenhöhe',
                desc: 'Passen Sie die Höhe von Ordnern und Tags im Navigationsbereich an.'
            },
            navItemHeightScaleText: {
                name: 'Text mit Zeilenhöhe skalieren',
                desc: 'Verkleinert die Navigationsschrift, wenn die Zeilenhöhe reduziert wird.'
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
                desc: 'Kommagetrennte Liste von Tag-Präfixen. Ein Tag schließt alle Unter-Tags ein (z.B. "photo" schließt "photo/camera/fuji" ein).',
                placeholder: 'inbox, projekte/arbeit, täglich/2025'
            },
            hiddenTags: {
                name: 'Versteckte Tags',
                desc: 'Kommagetrennte Liste von Tag-Präfixen oder Namensplatzhaltern zum Ausblenden. Verwende `tag*` oder `*tag`, um Tagnamen abzugleichen. Ein versteckter Tag blendet auch alle Unter-Tags aus (z.B. "archiv" blendet "archiv/2024/docs" aus).',
                placeholder: 'intern, temp/entwürfe, archiv/2024'
            },
            enableFolderNotes: {
                name: 'Ordnernotizen aktivieren',
                desc: 'Wenn aktiviert, werden Ordner mit zugehörigen Notizen als anklickbare Links angezeigt.'
            },
            folderNoteType: {
                name: 'Standardtyp für Ordnernotizen',
                desc: 'Ordnernotiztyp, der über das Kontextmenü erstellt wird.',
                options: {
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: 'Name der Ordnernotiz',
                desc: 'Name der Ordnernotiz. Leer lassen, um denselben Namen wie der Ordner zu verwenden.',
                placeholder: 'Leer lassen für Ordnernamen'
            },
            folderNoteProperties: {
                name: 'Ordnernotiz-Eigenschaften',
                desc: 'Frontmatter-Eigenschaften, die neu erstellten Ordnernotizen hinzugefügt werden (kommagetrennt).',
                placeholder: 'foldernote, darktheme'
            },
            hideFolderNoteInList: {
                name: 'Ordnernotizen in Liste ausblenden',
                desc: 'Die Ordnernotiz in der Notizliste des Ordners ausblenden.'
            },
            confirmBeforeDelete: {
                name: 'Vor dem Löschen bestätigen',
                desc: 'Bestätigungsdialog beim Löschen von Notizen oder Ordnern anzeigen'
            },
            metadataCleanup: {
                name: 'Metadaten bereinigen',
                desc: 'Entfernt verwaiste Metadaten, die zurückbleiben, wenn Dateien, Ordner oder Tags außerhalb von Obsidian gelöscht, verschoben oder umbenannt werden. Dies betrifft nur die Notebook Navigator Einstellungsdatei.',
                buttonText: 'Metadaten bereinigen',
                error: 'Einstellungen-Bereinigung fehlgeschlagen',
                loading: 'Metadaten werden überprüft...',
                statusClean: 'Keine Metadaten zu bereinigen',
                statusCounts: 'Verwaiste Elemente: {folders} Ordner, {tags} Tags, {files} Dateien, {pinned} Pins'
            },
            rebuildCache: {
                name: 'Cache neu aufbauen',
                desc: 'Verwenden Sie dies, wenn Tags fehlen, Vorschauen falsch sind oder Bilder fehlen. Dies kann nach Synchronisierungskonflikten oder unerwarteten Schließungen auftreten.',
                buttonText: 'Cache neu aufbauen',
                success: 'Cache wurde neu aufgebaut',
                error: 'Cache-Neuaufbau fehlgeschlagen'
            },
            hotkeys: {
                infoText:
                    'Sie können Notebook Navigator-Tastenkürzel anpassen, indem Sie .obsidian/plugins/notebook-navigator/data.json bearbeiten. Öffnen Sie es in einem Texteditor und suchen Sie den Abschnitt "keyboardShortcuts". Jeder Befehl hat diese Struktur:\n"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] } ]\n\nModifikatortasten:\n• "Mod" = Cmd (macOS) / Strg (Win/Linux)\n• "Alt" = Alt/Option\n• "Shift" = Umschalt\n• "Ctrl" = Steuerung ("Mod" für plattformübergreifend bevorzugen)\n\nSie können mehrere Tasten pro Befehl zuweisen, z.B. ArrowUp und K:\n"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]\n\nTastatursequenzen (wie "gg" oder "dd" in VIM) werden nicht unterstützt. Nach der Bearbeitung Obsidian neu laden oder das Plugin umschalten, um Änderungen anzuwenden.'
            },
            externalIcons: {
                downloadButton: 'Herunterladen',
                downloadingLabel: 'Wird heruntergeladen...',
                removeButton: 'Entfernen',
                statusInstalled: 'Heruntergeladen (Version {version})',
                statusNotInstalled: 'Nicht heruntergeladen',
                versionUnknown: 'unbekannt',
                downloadFailed: 'Fehler beim Herunterladen von {name}. Überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
                removeFailed: 'Fehler beim Entfernen von {name}.',
                infoNote:
                    'Heruntergeladene Icon-Pakete synchronisieren den Installationsstatus über Geräte hinweg. Icon-Pakete bleiben in der lokalen Datenbank auf jedem Gerät; die Synchronisierung verfolgt nur, ob sie heruntergeladen oder entfernt werden sollen. Icon-Pakete werden aus dem Notebook Navigator Repository heruntergeladen (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).',
                providers: {
                    bootstrapIconsDesc: 'https://icons.getbootstrap.com/',
                    fontAwesomeDesc: 'https://fontawesome.com/v6/search?f=classic&s=solid&ic=free&o=r',
                    materialIconsDesc: 'https://fonts.google.com/icons',
                    phosphorDesc: 'https://phosphoricons.com/',
                    rpgAwesomeDesc: 'https://nagoshiashumari.github.io/Rpg-Awesome/',
                    simpleIconsDesc: 'https://simpleicons.org/'
                }
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
        supportButton: 'Kauf mir einen Kaffee',
        thanksButton: 'Danke!'
    }
};
