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
 * Italian language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_IT = {
    // Common UI elements
    common: {
        cancel: 'Annulla',
        delete: 'Elimina',
        remove: 'Rimuovi',
        submit: 'Invia',
        noSelection: 'Nessuna selezione',
        untagged: 'Senza tag',
        untitled: 'Senza titolo',
        featureImageAlt: 'Immagine in evidenza',
        unknownError: 'Errore sconosciuto',
        updateBannerTitle: 'Aggiornamento di Notebook Navigator disponibile',
        updateBannerInstruction: 'Aggiorna in Impostazioni -> Plugin della community',
        updateIndicatorLabel: 'Nuova versione disponibile'
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Seleziona una cartella o un tag per visualizzare le note',
        emptyStateNoNotes: 'Nessuna nota',
        pinnedSection: 'Fissate',
        notesSection: 'Note',
        filesSection: 'File',
        hiddenItemAriaLabel: '{name} (nascosto)'
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Senza tag',
        hiddenTags: 'Tag nascosti',
        tags: 'Tag'
    },

    // Navigation pane
    navigationPane: {
        shortcutsHeader: 'Collegamenti',
        recentNotesHeader: 'Note recenti',
        recentFilesHeader: 'File recenti',
        reorderRootFoldersTitle: 'Riordina sezioni di navigazione',
        reorderRootFoldersHint: 'Trascina intestazioni o elementi per cambiare ordine',
        vaultRootLabel: 'Vault',
        resetRootToAlpha: 'Ripristina ordine alfabetico',
        resetRootToFrequency: 'Ripristina ordine per frequenza',
        dragHandleLabel: 'Trascina per riordinare',
        pinShortcuts: 'Fissa collegamenti',
        unpinShortcuts: 'Rimuovi fissaggio collegamenti',
        profileMenuLabel: 'Profilo',
        profileMenuAria: 'Cambia profilo del vault'
    },

    shortcuts: {
        folderExists: 'Cartella già presente nei collegamenti',
        noteExists: 'Nota già presente nei collegamenti',
        tagExists: 'Tag già presente nei collegamenti',
        searchExists: 'Collegamento di ricerca già esistente',
        emptySearchQuery: 'Inserisci una query prima di salvare',
        emptySearchName: 'Inserisci un nome prima di salvare la ricerca',
        add: 'Aggiungi ai collegamenti',
        remove: 'Rimuovi dai collegamenti',
        moveUp: 'Sposta su',
        moveDown: 'Sposta giù',
        folderNotesPinned: '{count} note cartella fissate'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Comprimi elementi',
        expandAllFolders: 'Espandi tutti gli elementi',
        scrollToTop: 'Scorri in alto',
        newFolder: 'Nuova cartella',
        newNote: 'Nuova nota',
        mobileBackToNavigation: 'Torna alla navigazione',
        changeSortOrder: 'Cambia ordine',
        defaultSort: 'Predefinito',
        customSort: 'Personalizzato',
        showFolders: 'Mostra navigazione',
        hideFolders: 'Nascondi navigazione',
        reorderRootFolders: 'Riordina cartelle e tag radice',
        finishRootFolderReorder: 'Termina riordino radice',
        toggleDescendantNotes: 'Mostra note da sottocartelle / discendenti',
        autoExpandFoldersTags: 'Espandi automaticamente cartelle e tag',
        showExcludedItems: 'Mostra cartelle, tag e note nascosti',
        hideExcludedItems: 'Nascondi cartelle, tag e note nascosti',
        showDualPane: 'Mostra pannelli doppi',
        showSinglePane: 'Mostra pannello singolo',
        changeAppearance: 'Cambia aspetto',
        search: 'Cerca'
    },

    // Search input
    searchInput: {
        placeholder: 'Cerca...',
        placeholderOmnisearch: 'Omnisearch...',
        clearSearch: 'Cancella ricerca',
        saveSearchShortcut: 'Salva collegamento di ricerca',
        removeSearchShortcut: 'Rimuovi collegamento di ricerca',
        shortcutModalTitle: 'Salva collegamento di ricerca',
        shortcutNameLabel: 'Nome collegamento',
        shortcutNamePlaceholder: 'Inserisci nome collegamento'
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Apri in nuova scheda',
            openToRight: 'Apri a destra',
            openInNewWindow: 'Apri in nuova finestra',
            openMultipleInNewTabs: 'Apri {count} note in nuove schede',
            openMultipleFilesInNewTabs: 'Apri {count} file in nuove schede',
            openMultipleToRight: 'Apri {count} note a destra',
            openMultipleFilesToRight: 'Apri {count} file a destra',
            openMultipleInNewWindows: 'Apri {count} note in nuove finestre',
            openMultipleFilesInNewWindows: 'Apri {count} file in nuove finestre',
            pinNote: 'Fissa nota',
            pinFile: 'Fissa file',
            unpinNote: 'Rimuovi fissaggio nota',
            unpinFile: 'Rimuovi fissaggio file',
            pinMultipleNotes: 'Fissa {count} note',
            pinMultipleFiles: 'Fissa {count} file',
            unpinMultipleNotes: 'Rimuovi fissaggio {count} note',
            unpinMultipleFiles: 'Rimuovi fissaggio {count} file',
            duplicateNote: 'Duplica nota',
            duplicateFile: 'Duplica file',
            duplicateMultipleNotes: 'Duplica {count} note',
            duplicateMultipleFiles: 'Duplica {count} file',
            openVersionHistory: 'Apri cronologia versioni',
            revealInFolder: 'Mostra nella cartella',
            revealInFinder: 'Mostra nel Finder',
            showInExplorer: 'Mostra in Esplora file',
            copyDeepLink: 'Copia URL Obsidian',
            copyPath: 'Copia percorso',
            copyRelativePath: 'Copia percorso relativo',
            renameNote: 'Rinomina nota',
            renameFile: 'Rinomina file',
            deleteNote: 'Elimina nota',
            deleteFile: 'Elimina file',
            deleteMultipleNotes: 'Elimina {count} note',
            deleteMultipleFiles: 'Elimina {count} file',
            moveToFolder: 'Sposta in...',
            moveMultipleToFolder: 'Sposta {count} file in...',
            addTag: 'Aggiungi tag',
            removeTag: 'Rimuovi tag',
            removeAllTags: 'Rimuovi tutti i tag',
            changeIcon: 'Cambia icona',
            changeColor: 'Cambia colore'
        },
        folder: {
            newNote: 'Nuova nota',
            newFolder: 'Nuova cartella',
            newCanvas: 'Nuova tela',
            newBase: 'Nuova base',
            newDrawing: 'Nuovo disegno',
            duplicateFolder: 'Duplica cartella',
            searchInFolder: 'Cerca nella cartella',
            copyPath: 'Copia percorso',
            copyRelativePath: 'Copia percorso relativo',
            createFolderNote: 'Crea nota cartella',
            deleteFolderNote: 'Elimina nota cartella',
            changeIcon: 'Cambia icona',
            changeColor: 'Cambia colore',
            changeBackground: 'Cambia sfondo',
            excludeFolder: 'Nascondi cartella',
            unhideFolder: 'Mostra cartella',
            moveFolder: 'Sposta in...',
            renameFolder: 'Rinomina cartella',
            deleteFolder: 'Elimina cartella'
        },
        tag: {
            changeIcon: 'Cambia icona',
            changeColor: 'Cambia colore',
            changeBackground: 'Cambia sfondo',
            showTag: 'Mostra tag',
            hideTag: 'Nascondi tag'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: 'Aspetto predefinito',
        slimPreset: 'Sottile (senza data/anteprima/immagine)',
        titleRows: 'Righe titolo',
        previewRows: 'Righe anteprima',
        groupBy: 'Raggruppa per',
        defaultOption: (rows: number) => `Predefinito (${rows})`,
        defaultTitleOption: (rows: number) => `Righe titolo predefinite (${rows})`,
        defaultPreviewOption: (rows: number) => `Righe anteprima predefinite (${rows})`,
        defaultGroupOption: (groupLabel: string) => `Raggruppamento predefinito (${groupLabel})`,
        titleRowOption: (rows: number) => `${rows} ${rows === 1 ? 'riga' : 'righe'} titolo`,
        previewRowOption: (rows: number) => `${rows} ${rows === 1 ? 'riga' : 'righe'} anteprima`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Cerca icone...',
            recentlyUsedHeader: 'Usate recentemente',
            emptyStateSearch: 'Inizia a digitare per cercare icone',
            emptyStateNoResults: 'Nessuna icona trovata',
            showingResultsInfo: 'Mostro 50 di {count} risultati. Digita di più per restringere.',
            emojiInstructions: 'Digita o incolla qualsiasi emoji per usarla come icona',
            removeIcon: 'Rimuovi icona'
        },
        colorPicker: {
            currentColor: 'Attuale',
            newColor: 'Nuovo',
            presetColors: 'Colori predefiniti',
            recentColors: 'Colori recenti',
            clearRecentColors: 'Cancella colori recenti',
            removeRecentColor: 'Rimuovi colore',
            removeColor: 'Rimuovi colore',
            apply: 'Applica',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
            colors: {
                red: 'Rosso',
                orange: 'Arancione',
                amber: 'Ambra',
                yellow: 'Giallo',
                lime: 'Lime',
                green: 'Verde',
                emerald: 'Smeraldo',
                teal: 'Turchese',
                cyan: 'Ciano',
                sky: 'Cielo',
                blue: 'Blu',
                indigo: 'Indaco',
                violet: 'Violetto',
                purple: 'Viola',
                fuchsia: 'Fucsia',
                pink: 'Rosa',
                rose: 'Rose',
                gray: 'Grigio',
                slate: 'Ardesia',
                stone: 'Pietra'
            }
        },
        tagOperation: {
            renameTitle: 'Rinomina tag {tag}',
            deleteTitle: 'Elimina tag {tag}',
            newTagPrompt: 'Nuovo nome tag',
            newTagPlaceholder: 'Inserisci nuovo nome tag',
            renameWarning: 'Rinominare il tag {oldTag} modificherà {count} {files}.',
            deleteWarning: 'Eliminare il tag {tag} modificherà {count} {files}.',
            modificationWarning: 'Questo aggiornerà le date di modifica dei file.',
            affectedFiles: 'File interessati:',
            andMore: '...e altri {count}',
            confirmRename: 'Rinomina tag',
            renameUnchanged: '{tag} non modificato',
            renameNoChanges: '{oldTag} → {newTag} ({countLabel})',
            invalidTagName: 'Inserisci un nome tag valido.',
            descendantRenameError: 'Impossibile spostare un tag in se stesso o in un discendente.',
            confirmDelete: 'Elimina tag',
            file: 'file',
            files: 'file'
        },
        fileSystem: {
            newFolderTitle: 'Nuova cartella',
            renameFolderTitle: 'Rinomina cartella',
            renameFileTitle: 'Rinomina file',
            deleteFolderTitle: "Eliminare '{name}'?",
            deleteFileTitle: "Eliminare '{name}'?",
            folderNamePrompt: 'Inserisci nome cartella:',
            renamePrompt: 'Inserisci nuovo nome:',
            renameVaultTitle: 'Cambia nome visualizzato vault',
            renameVaultPrompt: 'Inserisci nome visualizzato personalizzato (lascia vuoto per usare predefinito):',
            deleteFolderConfirm: 'Sei sicuro di voler eliminare questa cartella e tutto il suo contenuto?',
            deleteFileConfirm: 'Sei sicuro di voler eliminare questo file?',
            removeAllTagsTitle: 'Rimuovi tutti i tag',
            removeAllTagsFromNote: 'Sei sicuro di voler rimuovere tutti i tag da questa nota?',
            removeAllTagsFromNotes: 'Sei sicuro di voler rimuovere tutti i tag da {count} note?'
        },
        folderNoteType: {
            title: 'Seleziona tipo nota cartella',
            folderLabel: 'Cartella: {name}'
        },
        folderSuggest: {
            placeholder: 'Sposta in cartella...',
            navigatePlaceholder: 'Vai a cartella...',
            instructions: {
                navigate: 'per navigare',
                move: 'per spostare',
                select: 'per selezionare',
                dismiss: 'per annullare'
            }
        },
        homepage: {
            placeholder: 'Cerca file...',
            instructions: {
                navigate: 'per navigare',
                select: 'per impostare homepage',
                dismiss: 'per annullare'
            }
        },
        navigationBanner: {
            placeholder: 'Cerca immagini...',
            instructions: {
                navigate: 'per navigare',
                select: 'per impostare banner',
                dismiss: 'per annullare'
            }
        },
        tagSuggest: {
            placeholder: 'Cerca tag...',
            navigatePlaceholder: 'Vai a tag...',
            addPlaceholder: 'Cerca tag da aggiungere...',
            removePlaceholder: 'Seleziona tag da rimuovere...',
            createNewTag: 'Crea nuovo tag: #{tag}',
            instructions: {
                navigate: 'per navigare',
                select: 'per selezionare',
                dismiss: 'per annullare',
                add: 'per aggiungere tag',
                remove: 'per rimuovere tag'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Impossibile creare cartella: {error}',
            createFile: 'Impossibile creare file: {error}',
            renameFolder: 'Impossibile rinominare cartella: {error}',
            renameFolderNoteConflict: 'Impossibile rinominare: "{name}" esiste già in questa cartella',
            renameFile: 'Impossibile rinominare file: {error}',
            deleteFolder: 'Impossibile eliminare cartella: {error}',
            deleteFile: 'Impossibile eliminare file: {error}',
            duplicateNote: 'Impossibile duplicare nota: {error}',
            createCanvas: 'Impossibile creare tela: {error}',
            createDatabase: 'Impossibile creare database: {error}',
            duplicateFolder: 'Impossibile duplicare cartella: {error}',
            openVersionHistory: 'Impossibile aprire cronologia versioni: {error}',
            versionHistoryNotFound: 'Comando cronologia versioni non trovato. Assicurati che Obsidian Sync sia abilitato.',
            revealInExplorer: 'Impossibile mostrare file in Esplora file: {error}',
            folderNoteAlreadyExists: 'Nota cartella già esistente',
            folderAlreadyExists: 'La cartella "{name}" esiste già',
            folderNotesDisabled: 'Abilita le note cartella nelle impostazioni per convertire i file',
            folderNoteAlreadyLinked: 'Questo file funge già da nota cartella',
            folderNoteUnsupportedExtension: 'Estensione file non supportata: {extension}',
            folderNoteMoveFailed: 'Impossibile spostare file durante conversione: {error}',
            folderNoteRenameConflict: 'Un file chiamato "{name}" esiste già nella cartella',
            folderNoteConversionFailed: 'Impossibile convertire file in nota cartella',
            folderNoteConversionFailedWithReason: 'Impossibile convertire file in nota cartella: {error}',
            folderNoteOpenFailed: 'File convertito ma impossibile aprire nota cartella: {error}',
            failedToDeleteFile: 'Impossibile eliminare {name}: {error}',
            failedToDeleteMultipleFiles: 'Impossibile eliminare {count} file',
            versionHistoryNotAvailable: 'Servizio cronologia versioni non disponibile',
            drawingAlreadyExists: 'Esiste già un disegno con questo nome',
            failedToCreateDrawing: 'Impossibile creare disegno',
            noFolderSelected: 'Nessuna cartella selezionata in Notebook Navigator',
            noFileSelected: 'Nessun file selezionato'
        },
        notices: {
            hideFolder: 'Cartella nascosta: {name}',
            showFolder: 'Cartella mostrata: {name}'
        },
        notifications: {
            deletedMultipleFiles: '{count} file eliminati',
            movedMultipleFiles: '{count} file spostati in {folder}',
            folderNoteConversionSuccess: 'File convertito in nota cartella in "{name}"',
            folderMoved: 'Cartella "{name}" spostata',
            deepLinkCopied: 'URL Obsidian copiato negli appunti',
            pathCopied: 'Percorso copiato negli appunti',
            relativePathCopied: 'Percorso relativo copiato negli appunti',
            tagAddedToNote: 'Tag aggiunto a 1 nota',
            tagAddedToNotes: 'Tag aggiunto a {count} note',
            tagRemovedFromNote: 'Tag rimosso da 1 nota',
            tagRemovedFromNotes: 'Tag rimosso da {count} note',
            tagsClearedFromNote: 'Tutti i tag rimossi da 1 nota',
            tagsClearedFromNotes: 'Tutti i tag rimossi da {count} note',
            noTagsToRemove: 'Nessun tag da rimuovere',
            noFilesSelected: 'Nessun file selezionato',
            tagOperationsNotAvailable: 'Operazioni tag non disponibili',
            tagsRequireMarkdown: 'I tag sono supportati solo su note Markdown',
            iconPackDownloaded: '{provider} scaricato',
            iconPackUpdated: '{provider} aggiornato ({version})',
            iconPackRemoved: '{provider} rimosso',
            iconPackLoadFailed: 'Impossibile caricare {provider}',
            hiddenFileReveal: 'File nascosto. Abilita "Mostra elementi nascosti" per visualizzarlo'
        },
        confirmations: {
            deleteMultipleFiles: 'Sei sicuro di voler eliminare {count} file?',
            deleteConfirmation: 'Questa azione non può essere annullata.'
        },
        defaultNames: {
            untitled: 'Senza titolo',
            untitledNumber: 'Senza titolo {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Impossibile spostare una cartella in se stessa o in una sottocartella.',
            itemAlreadyExists: 'Un elemento chiamato "{name}" esiste già in questa posizione.',
            failedToMove: 'Impossibile spostare: {error}',
            failedToAddTag: 'Impossibile aggiungere tag "{tag}"',
            failedToClearTags: 'Impossibile cancellare tag',
            failedToMoveFolder: 'Impossibile spostare cartella "{name}"',
            failedToImportFiles: 'Impossibile importare: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} file esistono già nella destinazione',
            addedTag: 'Tag "{tag}" aggiunto a {count} file',
            filesAlreadyHaveTag: '{count} file hanno già questo tag o uno più specifico',
            clearedTags: 'Tutti i tag rimossi da {count} file',
            noTagsToClear: 'Nessun tag da cancellare',
            fileImported: '1 file importato',
            filesImported: '{count} file importati'
        }
    },

    // Date grouping
    dateGroups: {
        today: 'Oggi',
        yesterday: 'Ieri',
        previous7Days: 'Ultimi 7 giorni',
        previous30Days: 'Ultimi 30 giorni'
    },

    // Weekdays
    weekdays: {
        sunday: 'Domenica',
        monday: 'Lunedì',
        tuesday: 'Martedì',
        wednesday: 'Mercoledì',
        thursday: 'Giovedì',
        friday: 'Venerdì',
        saturday: 'Sabato'
    },

    // Plugin commands
    commands: {
        open: 'Apri',
        openHomepage: 'Apri homepage',
        revealFile: 'Mostra file',
        search: 'Cerca',
        toggleDualPane: 'Attiva/disattiva layout pannello doppio',
        deleteFile: 'Elimina file',
        createNewNote: 'Crea nuova nota',
        moveFiles: 'Sposta file',
        selectNextFile: 'Seleziona file successivo',
        selectPreviousFile: 'Seleziona file precedente',
        convertToFolderNote: 'Converti in nota cartella',
        pinAllFolderNotes: 'Fissa tutte le note cartella',
        navigateToFolder: 'Vai a cartella',
        navigateToTag: 'Vai a tag',
        addShortcut: 'Aggiungi ai collegamenti',
        toggleDescendants: 'Attiva/disattiva discendenti',
        toggleHidden: 'Attiva/disattiva cartelle, tag e note nascosti',
        toggleTagSort: 'Attiva/disattiva ordine tag',
        collapseExpand: 'Comprimi / espandi tutti gli elementi',
        addTag: 'Aggiungi tag ai file selezionati',
        removeTag: 'Rimuovi tag dai file selezionati',
        removeAllTags: 'Rimuovi tutti i tag dai file selezionati',
        rebuildCache: 'Ricostruisci cache'
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator',
        ribbonTooltip: 'Notebook Navigator',
        revealInNavigator: 'Mostra in Notebook Navigator'
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Ultima modifica il',
        createdAt: 'Creato il',
        file: 'file',
        files: 'file',
        folder: 'cartella',
        folders: 'cartelle'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: 'Rapporto metadati con errori esportato in: {filename}',
            exportFailed: 'Impossibile esportare rapporto metadati'
        },
        sections: {
            general: 'Generale',
            navigationPane: 'Pannello di navigazione',
            icons: 'Pacchetti icone',
            folders: 'Cartelle',
            tags: 'Tag',
            search: 'Cerca',
            listPane: 'Pannello lista',
            notes: 'Note',
            hotkeys: 'Scorciatoie',
            advanced: 'Avanzato'
        },
        groups: {
            general: {
                filtering: 'Filtri',
                behavior: 'Comportamento',
                view: 'Aspetto',
                desktopAppearance: 'Aspetto desktop',
                mobileAppearance: 'Aspetto mobile',
                formatting: 'Formattazione'
            },
            navigation: {
                behavior: 'Comportamento',
                appearance: 'Aspetto'
            },
            list: {
                display: 'Aspetto',
                quickActions: 'Azioni rapide'
            },
            notes: {
                frontmatter: 'Frontmatter',
                display: 'Aspetto'
            }
        },
        items: {
            searchProvider: {
                name: 'Provider di ricerca',
                desc: 'Scegli tra ricerca rapida per nome file o ricerca full-text con il plugin Omnisearch.',
                options: {
                    internal: 'Ricerca con filtro',
                    omnisearch: 'Omnisearch (full-text)'
                },
                info: {
                    filterSearch: {
                        title: 'Ricerca con filtro (predefinita):',
                        description:
                            'Ricerca veloce e leggera che filtra i file per nome e tag nella cartella corrente e sottocartelle. Supporta filtro tag con prefisso # (es. #progetto), esclusione con prefisso ! (es. !bozza, !#archiviato) e ricerca note senza tag con !#. Ideale per navigazione rapida nel contesto corrente.'
                    },
                    omnisearch: {
                        title: 'Omnisearch:',
                        description:
                            'Ricerca full-text che cerca in tutto il vault e poi filtra i risultati per mostrare solo i file dalla cartella corrente, sottocartelle o tag selezionati. Richiede il plugin Omnisearch installato - se non disponibile, la ricerca torna automaticamente a Ricerca con filtro.',
                        warningNotInstalled: 'Plugin Omnisearch non installato. Viene usata Ricerca con filtro.',
                        limitations: {
                            title: 'Limitazioni note:',
                            performance: 'Prestazioni: Può essere lento, specialmente cercando meno di 3 caratteri in vault grandi',
                            pathBug:
                                'Bug percorso: Non può cercare in percorsi con caratteri non ASCII e non cerca correttamente nei sottopercorsi, influenzando quali file appaiono nei risultati di ricerca',
                            limitedResults:
                                'Risultati limitati: Poiché Omnisearch cerca in tutto il vault e restituisce un numero limitato di risultati prima del filtro, file rilevanti dalla cartella corrente potrebbero non apparire se ci sono troppe corrispondenze altrove nel vault',
                            previewText:
                                "Testo anteprima: Le anteprime delle note sono sostituite con estratti dei risultati Omnisearch, che potrebbero non mostrare l'evidenziazione effettiva della corrispondenza di ricerca se appare altrove nel file"
                        }
                    }
                }
            },
            listPaneTitle: {
                name: 'Titolo pannello lista (solo desktop)',
                desc: 'Scegli dove viene mostrato il titolo del pannello lista.',
                options: {
                    header: 'Mostra in intestazione',
                    list: 'Mostra nel pannello lista',
                    hidden: 'Non mostrare'
                }
            },
            sortNotesBy: {
                name: 'Ordina note per',
                desc: 'Scegli come le note sono ordinate nella lista.',
                options: {
                    'modified-desc': 'Data modifica (più recente in alto)',
                    'modified-asc': 'Data modifica (più vecchia in alto)',
                    'created-desc': 'Data creazione (più recente in alto)',
                    'created-asc': 'Data creazione (più vecchia in alto)',
                    'title-asc': 'Titolo (A in alto)',
                    'title-desc': 'Titolo (Z in alto)'
                }
            },
            includeDescendantNotes: {
                name: 'Mostra note da sottocartelle / discendenti',
                desc: 'Includi note da sottocartelle nidificate e discendenti di tag quando visualizzi una cartella o un tag.'
            },
            limitPinnedToCurrentFolder: {
                name: 'Mostra note fissate solo nella cartella genitore',
                desc: 'Le note fissate appaiono solo quando si visualizza la loro cartella'
            },
            separateNoteCounts: {
                name: 'Mostra conteggi attuali e discendenti separatamente',
                desc: 'Visualizza conteggi note nel formato "attuale ▾ discendenti" in cartelle e tag.'
            },
            groupNotes: {
                name: 'Raggruppa note',
                desc: 'Visualizza intestazioni tra note raggruppate per data o cartella. Le visualizzazioni tag usano gruppi data quando il raggruppamento cartelle è abilitato.',
                options: {
                    none: 'Non raggruppare',
                    date: 'Raggruppa per data',
                    folder: 'Raggruppa per cartella'
                }
            },
            showPinnedGroupHeader: {
                name: 'Mostra intestazione gruppo fissato',
                desc: "Visualizza l'intestazione della sezione fissata sopra le note fissate."
            },
            showPinnedIcon: {
                name: 'Mostra icona fissata',
                desc: "Visualizza l'icona accanto all'intestazione della sezione fissata."
            },
            optimizeNoteHeight: {
                name: 'Ottimizza altezza nota',
                desc: 'Riduci altezza per note fissate e note senza testo anteprima.'
            },
            slimItemHeight: {
                name: 'Altezza elemento sottile',
                desc: "Imposta l'altezza degli elementi lista sottili su desktop e mobile.",
                resetTooltip: 'Ripristina predefinito (28px)'
            },
            slimItemHeightScaleText: {
                name: 'Scala testo con altezza elemento sottile',
                desc: "Scala testo lista sottile quando l'altezza elemento è ridotta."
            },
            showParentFolder: {
                name: 'Mostra cartella genitore',
                desc: 'Visualizza il nome della cartella genitore per note in sottocartelle o tag.'
            },
            showParentFolderColor: {
                name: 'Mostra colore cartella genitore',
                desc: 'Usa colori cartella su etichette cartelle genitore.'
            },
            showQuickActions: {
                name: 'Mostra azioni rapide (solo desktop)',
                desc: 'Mostra azioni al passaggio del mouse su elementi file.'
            },
            quickActionsRevealInFolder: {
                name: 'Mostra nella cartella',
                desc: 'Azione rapida: Mostra nota nella sua cartella genitore. Visibile solo quando si visualizzano note da sottocartelle o in tag (non mostrata nella cartella reale della nota).'
            },
            quickActionsPinNote: {
                name: 'Fissa nota',
                desc: 'Azione rapida: Fissa o rimuovi fissaggio nota in cima alla lista.'
            },
            quickActionsOpenInNewTab: {
                name: 'Apri in nuova scheda',
                desc: 'Azione rapida: Apri nota in nuova scheda.'
            },
            dualPane: {
                name: 'Layout pannello doppio (non sincronizzato)',
                desc: 'Mostra pannello navigazione e pannello lista affiancati su desktop.'
            },
            dualPaneOrientation: {
                name: 'Orientamento pannello doppio (non sincronizzato)',
                desc: 'Scegli layout orizzontale o verticale quando il pannello doppio è attivo.',
                options: {
                    horizontal: 'Divisione orizzontale',
                    vertical: 'Divisione verticale'
                }
            },
            appearanceBackground: {
                name: 'Colore sfondo',
                desc: 'Scegli colori sfondo per pannelli navigazione e lista.',
                options: {
                    separate: 'Sfondi separati',
                    primary: 'Usa sfondo lista',
                    secondary: 'Usa sfondo navigazione'
                }
            },
            appearanceScale: {
                name: 'Livello zoom',
                desc: 'Controlla il livello zoom complessivo di Notebook Navigator.'
            },
            startView: {
                name: 'Vista iniziale predefinita',
                desc: "Scegli quale pannello visualizzare all'apertura di Notebook Navigator. Il pannello navigazione mostra collegamenti, note recenti e albero cartelle. Il pannello lista mostra subito la lista note.",
                options: {
                    navigation: 'Pannello navigazione',
                    files: 'Pannello lista'
                }
            },
            autoRevealActiveNote: {
                name: 'Mostra automaticamente nota attiva',
                desc: 'Mostra automaticamente note quando aperte da Quick Switcher, link o ricerca.'
            },
            autoRevealIgnoreRightSidebar: {
                name: 'Ignora eventi dalla barra laterale destra',
                desc: 'Non cambiare nota attiva quando si fa clic o si cambiano note nella barra laterale destra.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Seleziona automaticamente prima nota (solo desktop)',
                desc: 'Apri automaticamente la prima nota quando si cambiano cartelle o tag.'
            },
            skipAutoScroll: {
                name: 'Disabilita scorrimento automatico per collegamenti',
                desc: 'Non scorrere il pannello navigazione quando si fa clic su elementi nei collegamenti.'
            },
            autoExpandFoldersTags: {
                name: 'Espandi automaticamente cartelle e tag',
                desc: 'Espandi automaticamente cartelle e tag quando vengono selezionati.'
            },
            navigationBanner: {
                name: 'Banner navigazione (profilo vault)',
                desc: "Visualizza un'immagine sopra il pannello navigazione. Cambia con il profilo vault selezionato.",
                current: 'Banner attuale: {path}',
                chooseButton: 'Scegli immagine',
                clearButton: 'Cancella'
            },
            showShortcuts: {
                name: 'Mostra collegamenti',
                desc: 'Visualizza la sezione collegamenti nel pannello navigazione.'
            },
            showRecentNotes: {
                name: 'Mostra note recenti',
                desc: 'Visualizza la sezione note recenti nel pannello navigazione.'
            },
            recentNotesCount: {
                name: 'Conteggio note recenti',
                desc: 'Numero di note recenti da visualizzare.'
            },
            showTooltips: {
                name: 'Mostra suggerimenti',
                desc: 'Visualizza suggerimenti al passaggio del mouse con informazioni aggiuntive per note e cartelle.'
            },
            showTooltipPath: {
                name: 'Mostra percorso',
                desc: 'Visualizza il percorso cartella sotto i nomi note nei suggerimenti.'
            },
            resetPaneSeparator: {
                name: 'Ripristina posizione separatore pannelli',
                desc: 'Ripristina il separatore trascinabile tra pannello navigazione e pannello lista alla posizione predefinita.',
                buttonText: 'Ripristina separatore',
                notice: 'Posizione separatore ripristinata. Riavvia Obsidian o riapri Notebook Navigator per applicare.'
            },
            multiSelectModifier: {
                name: 'Modificatore selezione multipla',
                desc: 'Scegli quale tasto modificatore attiva la selezione multipla. Quando è selezionato Opzione/Alt, Cmd/Ctrl clic apre note in nuova scheda.',
                options: {
                    cmdCtrl: 'Cmd/Ctrl clic',
                    optionAlt: 'Opzione/Alt clic'
                }
            },
            fileVisibility: {
                name: 'Mostra tipi di file',
                desc: 'Filtra quali tipi di file vengono mostrati nel navigatore. Tipi di file non supportati da Obsidian potrebbero aprirsi in applicazioni esterne.',
                options: {
                    documents: 'Documenti (.md, .canvas, .base)',
                    supported: 'Supportati (apre in Obsidian)',
                    all: 'Tutti (potrebbe aprire esternamente)'
                }
            },
            homepage: {
                name: 'Homepage',
                desc: 'Scegli il file che Notebook Navigator apre automaticamente, come una dashboard.',
                current: 'Attuale: {path}',
                currentMobile: 'Mobile: {path}',
                chooseButton: 'Scegli file',
                clearButton: 'Cancella',
                separateMobile: {
                    name: 'Homepage separata per mobile',
                    desc: "Usa un'homepage diversa per dispositivi mobili."
                }
            },
            excludedNotes: {
                name: 'Nascondi note',
                desc: 'Lista separata da virgole di proprietà frontmatter. Le note contenenti una di queste proprietà saranno nascoste (es. draft, private, archived).',
                placeholder: 'draft, private'
            },
            vaultProfiles: {
                name: 'Profilo vault',
                desc: "I profili memorizzano la visibilità dei tipi di file, cartelle nascoste, tag nascosti e note nascoste. Cambia profilo dall'intestazione del pannello di navigazione.",
                defaultName: 'Predefinito',
                addButton: 'Aggiungi profilo',
                editButton: 'Modifica profilo',
                deleteButton: 'Elimina profilo',
                addModalTitle: 'Aggiungi profilo',
                editModalTitle: 'Modifica profilo',
                addModalPlaceholder: 'Nome profilo',
                deleteModalTitle: 'Elimina {name}',
                deleteModalMessage:
                    'Rimuovere {name}? I filtri per cartelle, tag e note nascosti salvati in questo profilo verranno eliminati.',
                errors: {
                    emptyName: 'Inserisci un nome profilo',
                    duplicateName: 'Nome profilo già esistente'
                }
            },
            excludedFolders: {
                name: 'Nascondi cartelle',
                desc: 'Lista separata da virgole di cartelle da nascondere. Pattern nome: assets* (cartelle che iniziano con assets), *_temp (finiscono con _temp). Pattern percorso: /archive (solo archive radice), /res* (cartelle radice che iniziano con res), /*/temp (cartelle temp un livello sotto), /projects/* (tutte le cartelle dentro projects).',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            showFileDate: {
                name: 'Mostra data',
                desc: 'Visualizza la data sotto i nomi delle note.'
            },
            alphabeticalDateMode: {
                name: 'Quando ordinato per nome',
                desc: 'Data da mostrare quando le note sono ordinate alfabeticamente.',
                options: {
                    created: 'Data creazione',
                    modified: 'Data modifica'
                }
            },
            showFileTags: {
                name: 'Mostra tag file',
                desc: 'Visualizza tag cliccabili negli elementi file.'
            },
            showFileTagAncestors: {
                name: 'Mostra tag genitore',
                desc: 'Visualizza segmenti genitore prima del nome tag.'
            },
            colorFileTags: {
                name: 'Colora tag file',
                desc: 'Applica colori tag ai badge tag su elementi file.'
            },
            showFileTagsInSlimMode: {
                name: 'Mostra tag file in modalità sottile',
                desc: 'Visualizza tag quando data, anteprima e immagine sono nascoste.'
            },
            dateFormat: {
                name: 'Formato data',
                desc: 'Formato per visualizzare date (usa formato date-fns).',
                placeholder: 'MMM d, yyyy',
                help: 'Formati comuni:\nMMM d, yyyy = Mag 25, 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nToken:\nyyyy/yy = anno\nMMMM/MMM/MM = mese\ndd/d = giorno\nEEEE/EEE = giorno settimana',
                helpTooltip: 'Clicca per riferimento formato'
            },
            timeFormat: {
                name: 'Formato ora',
                desc: 'Formato per visualizzare orari (usa formato date-fns).',
                placeholder: 'h:mm a',
                help: 'Formati comuni:\nh:mm a = 2:30 PM (12 ore)\nHH:mm = 14:30 (24 ore)\nh:mm:ss a = 2:30:45 PM\nHH:mm:ss = 14:30:45\n\nToken:\nHH/H = 24 ore\nhh/h = 12 ore\nmm = minuti\nss = secondi\na = AM/PM',
                helpTooltip: 'Clicca per riferimento formato'
            },
            showFilePreview: {
                name: 'Mostra anteprima nota',
                desc: 'Visualizza testo anteprima sotto i nomi note.'
            },
            skipHeadingsInPreview: {
                name: 'Salta intestazioni in anteprima',
                desc: 'Salta righe intestazione quando si genera testo anteprima.'
            },
            skipCodeBlocksInPreview: {
                name: 'Salta blocchi codice in anteprima',
                desc: 'Salta blocchi codice quando si genera testo anteprima.'
            },
            previewProperties: {
                name: 'Proprietà anteprima',
                desc: 'Lista separata da virgole di proprietà frontmatter da verificare per testo anteprima. Sarà usata la prima proprietà con testo.',
                placeholder: 'summary, description, abstract',
                info: "Se nessun testo anteprima viene trovato nelle proprietà specificate, l'anteprima sarà generata dal contenuto della nota."
            },
            previewRows: {
                name: 'Righe anteprima',
                desc: 'Numero di righe da visualizzare per testo anteprima.',
                options: {
                    '1': '1 riga',
                    '2': '2 righe',
                    '3': '3 righe',
                    '4': '4 righe',
                    '5': '5 righe'
                }
            },
            fileNameRows: {
                name: 'Righe titolo',
                desc: 'Numero di righe da visualizzare per titoli note.',
                options: {
                    '1': '1 riga',
                    '2': '2 righe'
                }
            },
            showFeatureImage: {
                name: 'Mostra immagine in evidenza',
                desc: 'Visualizza immagini miniatura dal frontmatter. Suggerimento: Usa il plugin "Featured Image" per impostare automaticamente immagini in evidenza per tutti i tuoi documenti.'
            },
            forceSquareFeatureImage: {
                name: 'Forza immagine in evidenza quadrata',
                desc: 'Renderizza immagini in evidenza come miniature quadrate.'
            },
            featureImageProperties: {
                name: 'Proprietà immagine',
                desc: "Lista separata da virgole di proprietà frontmatter da verificare per immagini miniatura. Sarà usata la prima proprietà con un'immagine. Se vuota e l'impostazione fallback è abilitata, sarà usata la prima immagine incorporata.",
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: 'Usa fallback immagine incorporata',
                desc: 'Usa la prima immagine incorporata nel documento come fallback quando nessuna miniatura viene trovata nelle proprietà frontmatter (richiede Obsidian 1.9.4+). Disabilita questo per verificare che le miniature siano configurate correttamente.'
            },
            showRootFolder: {
                name: 'Mostra cartella radice',
                desc: "Visualizza il nome del vault come cartella radice nell'albero."
            },
            showFolderIcons: {
                name: 'Mostra icone cartelle',
                desc: 'Visualizza icone accanto alle cartelle nel pannello navigazione.'
            },
            inheritFolderColors: {
                name: 'Eredita colori cartelle',
                desc: 'Le cartelle figlie ereditano il colore dalle cartelle genitore.'
            },
            showNoteCount: {
                name: 'Mostra conteggio note',
                desc: 'Visualizza il numero di note accanto a ogni cartella e tag.'
            },
            showSectionIcons: {
                name: 'Mostra icone collegamento',
                desc: 'Visualizza icone per sezioni navigazione come Collegamenti e File recenti.'
            },
            showIconsColorOnly: {
                name: 'Applica colore solo alle icone',
                desc: 'Quando abilitato, i colori personalizzati sono applicati solo alle icone. Quando disabilitato, i colori sono applicati sia alle icone che alle etichette di testo.'
            },
            collapseBehavior: {
                name: 'Comprimi elementi',
                desc: 'Scegli cosa influenza il pulsante espandi/comprimi tutto.',
                options: {
                    all: 'Tutte cartelle e tag',
                    foldersOnly: 'Solo cartelle',
                    tagsOnly: 'Solo tag'
                }
            },
            smartCollapse: {
                name: 'Mantieni elemento selezionato espanso',
                desc: 'Quando si comprime, mantieni la cartella o tag attualmente selezionato e i suoi genitori espansi.'
            },
            navIndent: {
                name: 'Indentazione albero',
                desc: 'Regola la larghezza indentazione per cartelle e tag nidificati.'
            },
            navItemHeight: {
                name: 'Altezza elemento',
                desc: "Regola l'altezza di cartelle e tag nel pannello navigazione."
            },
            navItemHeightScaleText: {
                name: 'Scala testo con altezza elemento',
                desc: "Riduci dimensione testo navigazione quando l'altezza elemento è diminuita."
            },
            navRootSpacing: {
                name: 'Spaziatura elemento radice',
                desc: 'Spaziatura tra cartelle e tag di livello radice.'
            },
            showTags: {
                name: 'Mostra tag',
                desc: 'Visualizza sezione tag sotto le cartelle nel navigatore.'
            },
            showTagIcons: {
                name: 'Mostra icone tag',
                desc: 'Visualizza icone accanto ai tag nel pannello navigazione.'
            },
            tagSortOrder: {
                name: 'Ordine tag',
                desc: 'Scegli come i tag sono ordinati nel pannello navigazione.',
                options: {
                    alphaAsc: 'A a Z',
                    alphaDesc: 'Z a A',
                    frequencyAsc: 'Frequenza (bassa ad alta)',
                    frequencyDesc: 'Frequenza (alta a bassa)'
                }
            },
            showAllTagsFolder: {
                name: 'Mostra cartella tag',
                desc: 'Visualizza "Tag" come cartella comprimibile.'
            },
            showUntagged: {
                name: 'Mostra note senza tag',
                desc: 'Visualizza elemento "Senza tag" per note senza tag.'
            },
            keepEmptyTagsProperty: {
                name: 'Mantieni proprietà tag dopo rimozione ultimo tag',
                desc: 'Mantieni la proprietà tag frontmatter quando tutti i tag sono rimossi. Quando disabilitato, la proprietà tag è eliminata dal frontmatter.'
            },
            hiddenTags: {
                name: 'Nascondi tag',
                desc: 'Lista separata da virgole di prefissi tag o wildcard nome. Usa tag* o *tag per abbinare nomi tag. Nascondere un tag nasconde anche tutti i suoi sotto-tag (es. "archivio" nasconde "archivio/2024/docs").',
                placeholder: 'interno, temp/bozze, archivio/2024'
            },
            enableFolderNotes: {
                name: 'Abilita note cartella',
                desc: 'Quando abilitato, le cartelle con note associate sono visualizzate come link cliccabili.'
            },
            folderNoteType: {
                name: 'Tipo nota cartella predefinito',
                desc: 'Tipo nota cartella creato dal menu contestuale.',
                options: {
                    ask: 'Chiedi durante creazione',
                    markdown: 'Markdown',
                    canvas: 'Tela',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: 'Nome nota cartella',
                desc: 'Nome della nota cartella senza estensione. Lascia vuoto per usare lo stesso nome della cartella.',
                placeholder: 'index'
            },
            folderNoteProperties: {
                name: 'Proprietà nota cartella',
                desc: 'Frontmatter YAML aggiunto a nuove note cartella. I marcatori --- sono aggiunti automaticamente.',
                placeholder: 'theme: dark\nfoldernote: true'
            },
            hideFolderNoteInList: {
                name: 'Nascondi note cartella in lista',
                desc: "Nascondi la nota cartella dall'apparire nella lista note della cartella."
            },
            pinCreatedFolderNote: {
                name: 'Fissa note cartella create',
                desc: 'Fissa automaticamente note cartella quando create dal menu contestuale.'
            },
            confirmBeforeDelete: {
                name: 'Conferma prima di eliminare',
                desc: 'Mostra dialogo conferma quando si eliminano note o cartelle'
            },
            metadataCleanup: {
                name: 'Pulisci metadati',
                desc: 'Rimuove metadati orfani lasciati quando file, cartelle o tag sono eliminati, spostati o rinominati fuori da Obsidian. Questo influenza solo il file impostazioni Notebook Navigator.',
                buttonText: 'Pulisci metadati',
                error: 'Pulizia impostazioni fallita',
                loading: 'Controllo metadati...',
                statusClean: 'Nessun metadato da pulire',
                statusCounts: 'Elementi orfani: {folders} cartelle, {tags} tag, {files} file, {pinned} fissaggi'
            },
            rebuildCache: {
                name: 'Ricostruisci cache',
                desc: 'Usa questo se riscontri tag mancanti, anteprime errate o immagini in evidenza mancanti. Questo può accadere dopo conflitti di sincronizzazione o chiusure inaspettate.',
                buttonText: 'Ricostruisci cache',
                success: 'Cache ricostruita',
                error: 'Impossibile ricostruire cache'
            },
            hotkeys: {
                intro: 'Modifica <cartella plugin>/notebook-navigator/data.json per personalizzare le scorciatoie di Notebook Navigator. Apri il file e individua la sezione "keyboardShortcuts". Ogni voce usa questa struttura:',
                example: '"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]',
                modifierList: [
                    '"Mod" = Cmd (macOS) / Ctrl (Win/Linux)',
                    '"Alt" = Alt/Option',
                    '"Shift" = Shift',
                    '"Ctrl" = Control (preferisci "Mod" per multi-piattaforma)'
                ],
                guidance:
                    'Aggiungi più mappature per supportare tasti alternativi, come le associazioni ArrowUp e K mostrate sopra. Combina modificatori in una voce elencando ogni valore, ad esempio "modifiers": ["Mod", "Shift"]. Sequenze tastiera come "gg" o "dd" non sono supportate. Ricarica Obsidian dopo aver modificato il file.'
            },
            externalIcons: {
                downloadButton: 'Scarica',
                downloadingLabel: 'Scaricamento...',
                removeButton: 'Rimuovi',
                statusInstalled: 'Scaricato (versione {version})',
                statusNotInstalled: 'Non scaricato',
                versionUnknown: 'sconosciuta',
                downloadFailed: 'Impossibile scaricare {name}. Controlla la connessione e riprova.',
                removeFailed: 'Impossibile rimuovere {name}.',
                infoNote:
                    'I pacchetti icone scaricati sincronizzano lo stato installazione tra dispositivi. I pacchetti icone rimangono nel database locale su ogni dispositivo; la sincronizzazione traccia solo se scaricarli o rimuoverli. I pacchetti icone si scaricano dal repository Notebook Navigator (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).',
                providers: {
                    bootstrapIconsDesc: 'https://icons.getbootstrap.com/',
                    fontAwesomeDesc: 'https://fontawesome.com/',
                    materialIconsDesc: 'https://fonts.google.com/icons',
                    phosphorDesc: 'https://phosphoricons.com/',
                    rpgAwesomeDesc: 'https://nagoshiashumari.github.io/Rpg-Awesome/',
                    simpleIconsDesc: 'https://simpleicons.org/'
                }
            },
            useFrontmatterDates: {
                name: 'Leggi metadati dal frontmatter',
                desc: 'Leggi nomi note, timestamp, icone e colori dal frontmatter quando disponibile, tornando ai valori del file system o impostazioni'
            },
            frontmatterIconField: {
                name: 'Campo icona',
                desc: 'Campo frontmatter per icone file. Lascia vuoto per usare icone memorizzate nelle impostazioni.',
                placeholder: 'icon'
            },
            frontmatterColorField: {
                name: 'Campo colore',
                desc: 'Campo frontmatter per colori file. Lascia vuoto per usare colori memorizzati nelle impostazioni.',
                placeholder: 'color'
            },
            frontmatterSaveMetadata: {
                name: 'Salva icone e colori in frontmatter',
                desc: 'Scrivi automaticamente icone e colori file in frontmatter usando i campi configurati sopra.'
            },
            frontmatterIconizeFormat: {
                name: 'Salva in formato Iconize',
                desc: 'Salva icone usando formato Iconize (es. LiHome, FasUser, SiGithub) invece del formato plugin (es. home, fontawesome-solid:user, simple-icons:github).'
            },
            frontmatterMigration: {
                name: 'Migra icone e colori dalle impostazioni',
                desc: 'Memorizzato nelle impostazioni: {icons} icone, {colors} colori.',
                button: 'Migra',
                buttonWorking: 'Migrazione...',
                noticeNone: 'Nessuna icona o colore file memorizzato nelle impostazioni.',
                noticeDone: 'Migrate {migratedIcons}/{icons} icone, {migratedColors}/{colors} colori.',
                noticeFailures: 'Voci fallite: {failures}.',
                noticeError: 'Migrazione fallita. Controlla console per dettagli.'
            },
            frontmatterNameField: {
                name: 'Campo nome',
                desc: 'Campo frontmatter da usare come nome visualizzato nota. Lascia vuoto per usare il nome file.',
                placeholder: 'title'
            },
            frontmatterCreatedField: {
                name: 'Campo timestamp creazione',
                desc: 'Nome campo frontmatter per timestamp creazione. Lascia vuoto per usare solo data file system.',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: 'Campo timestamp modifica',
                desc: 'Nome campo frontmatter per timestamp modifica. Lascia vuoto per usare solo data file system.',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: 'Formato timestamp',
                desc: 'Formato usato per analizzare timestamp nel frontmatter. Lascia vuoto per usare formato ISO 8601',
                helpTooltip: 'Vedi documentazione formato date-fns',
                help: "Formati comuni:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\nyyyy-MM-dd'T'HH:mm:ssXXX → 2025-08-07T16:53:39+02:00\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: 'Sostieni lo sviluppo',
                desc: 'Se ami usare Notebook Navigator, considera di sostenere il suo sviluppo continuo.',
                buttonText: '❤️ Sponsor',
                coffeeButton: '☕️ Offrimi un caffè'
            },
            updateCheckOnStart: {
                name: "Controlla nuova versione all'avvio",
                desc: "Controlla nuove versioni plugin all'avvio e mostra una notifica quando un aggiornamento è disponibile. Ogni versione è annunciata solo una volta, e i controlli avvengono al massimo una volta al giorno.",
                status: 'Nuova versione disponibile: {version}'
            },
            whatsNew: {
                name: 'Novità in Notebook Navigator {version}',
                desc: 'Vedi aggiornamenti e miglioramenti recenti',
                buttonText: 'Visualizza aggiornamenti recenti'
            },
            cacheStatistics: {
                localCache: 'Cache locale',
                items: 'elementi',
                withTags: 'con tag',
                withPreviewText: 'con testo anteprima',
                withFeatureImage: 'con immagine in evidenza',
                withMetadata: 'con metadati'
            },
            metadataInfo: {
                successfullyParsed: 'Analizzati con successo',
                itemsWithName: 'elementi con nome',
                withCreatedDate: 'con data creazione',
                withModifiedDate: 'con data modifica',
                withIcon: 'con icona',
                withColor: 'con colore',
                failedToParse: 'Impossibile analizzare',
                createdDates: 'date creazione',
                modifiedDates: 'date modifica',
                checkTimestampFormat: 'Controlla il tuo formato timestamp.',
                exportFailed: 'Esporta errori'
            }
        }
    },
    whatsNew: {
        title: 'Novità in Notebook Navigator',
        supportMessage: 'Se trovi utile Notebook Navigator, considera di sostenere il suo sviluppo.',
        supportButton: 'Offrimi un caffè',
        thanksButton: 'Grazie!'
    }
};
