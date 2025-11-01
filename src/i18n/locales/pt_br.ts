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
 * Portuguese (Brazil) language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_PT_BR = {
    // Common UI elements
    common: {
        cancel: 'Cancelar',
        delete: 'Excluir',
        remove: 'Remover',
        submit: 'Enviar',
        noSelection: 'Nenhuma seleção',
        untagged: 'Sem tags',
        untitled: 'Sem título',
        featureImageAlt: 'Imagem destacada',
        unknownError: 'Erro desconhecido',
        updateBannerTitle: 'Atualização do Notebook Navigator disponível',
        updateBannerInstruction: 'Atualize em Configurações -> Plugins da comunidade',
        updateIndicatorLabel: 'Nova versão disponível'
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Selecione uma pasta ou tag para ver notas',
        emptyStateNoNotes: 'Sem notas',
        pinnedSection: '📌 Fixadas',
        notesSection: 'Notas',
        filesSection: 'Arquivos',
        hiddenItemAriaLabel: '{name} (oculto)'
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Sem tags',
        hiddenTags: 'Tags ocultas',
        tags: 'Tags'
    },

    // Navigation pane
    navigationPane: {
        shortcutsHeader: 'Atalhos',
        recentNotesHeader: 'Notas recentes',
        recentFilesHeader: 'Arquivos recentes',
        reorderRootFoldersTitle: 'Reordenar seções de navegação',
        reorderRootFoldersHint: 'Arraste cabeçalhos ou itens para alterar ordem',
        vaultRootLabel: 'Cofre',
        resetRootToAlpha: 'Redefinir para ordem alfabética',
        resetRootToFrequency: 'Redefinir para ordem de frequência',
        dragHandleLabel: 'Arraste para reordenar',
        pinShortcuts: 'Fixar atalhos',
        unpinShortcuts: 'Desafixar atalhos'
    },

    shortcuts: {
        folderExists: 'Pasta já está nos atalhos',
        noteExists: 'Nota já está nos atalhos',
        tagExists: 'Tag já está nos atalhos',
        searchExists: 'Atalho de pesquisa já existe',
        emptySearchQuery: 'Digite uma consulta antes de salvar',
        emptySearchName: 'Digite um nome antes de salvar a pesquisa',
        add: 'Adicionar aos atalhos',
        remove: 'Remover dos atalhos',
        moveUp: 'Mover para cima',
        moveDown: 'Mover para baixo',
        folderNotesPinned: '{count} notas de pasta fixadas'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Recolher itens',
        expandAllFolders: 'Expandir todos os itens',
        scrollToTop: 'Rolar para o topo',
        newFolder: 'Nova pasta',
        newNote: 'Nova nota',
        mobileBackToNavigation: 'Voltar à navegação',
        changeSortOrder: 'Alterar ordem de classificação',
        defaultSort: 'Padrão',
        customSort: 'Personalizado',
        showFolders: 'Mostrar navegação',
        hideFolders: 'Ocultar navegação',
        reorderRootFolders: 'Reordenar pastas e tags raiz',
        finishRootFolderReorder: 'Finalizar reordenação raiz',
        toggleDescendantNotes: 'Mostrar notas de subpastas / descendentes',
        autoExpandFoldersTags: 'Expandir automaticamente pastas e tags',
        showExcludedItems: 'Mostrar pastas, tags e notas ocultas',
        hideExcludedItems: 'Ocultar pastas, tags e notas ocultas',
        showDualPane: 'Mostrar painéis duplos',
        showSinglePane: 'Mostrar painel único',
        changeAppearance: 'Alterar aparência',
        search: 'Pesquisar'
    },

    // Search input
    searchInput: {
        placeholder: 'Pesquisar...',
        placeholderOmnisearch: 'Omnisearch...',
        clearSearch: 'Limpar pesquisa',
        saveSearchShortcut: 'Salvar atalho de pesquisa',
        removeSearchShortcut: 'Remover atalho de pesquisa',
        shortcutModalTitle: 'Salvar atalho de pesquisa',
        shortcutNameLabel: 'Nome do atalho',
        shortcutNamePlaceholder: 'Digite o nome do atalho'
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Abrir em nova aba',
            openToRight: 'Abrir à direita',
            openInNewWindow: 'Abrir em nova janela',
            openMultipleInNewTabs: 'Abrir {count} notas em novas abas',
            openMultipleFilesInNewTabs: 'Abrir {count} arquivos em novas abas',
            openMultipleToRight: 'Abrir {count} notas à direita',
            openMultipleFilesToRight: 'Abrir {count} arquivos à direita',
            openMultipleInNewWindows: 'Abrir {count} notas em novas janelas',
            openMultipleFilesInNewWindows: 'Abrir {count} arquivos em novas janelas',
            pinNote: 'Fixar nota',
            pinFile: 'Fixar arquivo',
            unpinNote: 'Desafixar nota',
            unpinFile: 'Desafixar arquivo',
            pinMultipleNotes: 'Fixar {count} notas',
            pinMultipleFiles: 'Fixar {count} arquivos',
            unpinMultipleNotes: 'Desafixar {count} notas',
            unpinMultipleFiles: 'Desafixar {count} arquivos',
            duplicateNote: 'Duplicar nota',
            duplicateFile: 'Duplicar arquivo',
            duplicateMultipleNotes: 'Duplicar {count} notas',
            duplicateMultipleFiles: 'Duplicar {count} arquivos',
            openVersionHistory: 'Abrir histórico de versões',
            revealInFolder: 'Revelar na pasta',
            revealInFinder: 'Revelar no Finder',
            showInExplorer: 'Mostrar no explorador de arquivos',
            copyDeepLink: 'Copiar URL do Obsidian',
            copyPath: 'Copiar caminho',
            copyRelativePath: 'Copiar caminho relativo',
            renameNote: 'Renomear nota',
            renameFile: 'Renomear arquivo',
            deleteNote: 'Excluir nota',
            deleteFile: 'Excluir arquivo',
            deleteMultipleNotes: 'Excluir {count} notas',
            deleteMultipleFiles: 'Excluir {count} arquivos',
            moveToFolder: 'Mover para...',
            moveMultipleToFolder: 'Mover {count} arquivos para...',
            addTag: 'Adicionar tag',
            removeTag: 'Remover tag',
            removeAllTags: 'Remover todas as tags',
            changeIcon: 'Alterar ícone',
            changeColor: 'Alterar cor'
        },
        folder: {
            newNote: 'Nova nota',
            newFolder: 'Nova pasta',
            newCanvas: 'Nova tela',
            newBase: 'Nova base',
            newDrawing: 'Novo desenho',
            duplicateFolder: 'Duplicar pasta',
            searchInFolder: 'Pesquisar na pasta',
            createFolderNote: 'Criar nota de pasta',
            deleteFolderNote: 'Excluir nota de pasta',
            changeIcon: 'Alterar ícone',
            changeColor: 'Alterar cor',
            changeBackground: 'Alterar plano de fundo',
            excludeFolder: 'Ocultar pasta',
            unhideFolder: 'Reexibir pasta',
            moveFolder: 'Mover para...',
            renameFolder: 'Renomear pasta',
            deleteFolder: 'Excluir pasta'
        },
        tag: {
            changeIcon: 'Alterar ícone',
            changeColor: 'Alterar cor',
            changeBackground: 'Alterar plano de fundo',
            showTag: 'Mostrar tag',
            hideTag: 'Ocultar tag'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: 'Aparência padrão',
        slimPreset: 'Simples (sem data/visualização/imagem)',
        titleRows: 'Linhas do título',
        previewRows: 'Linhas de visualização',
        defaultOption: (rows: number) => `Padrão (${rows})`,
        defaultTitleOption: (rows: number) => `Linhas de título padrão (${rows})`,
        defaultPreviewOption: (rows: number) => `Linhas de visualização padrão (${rows})`,
        titleRowOption: (rows: number) => `${rows} linha${rows === 1 ? '' : 's'} de título`,
        previewRowOption: (rows: number) => `${rows} linha${rows === 1 ? '' : 's'} de visualização`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Pesquisar ícones...',
            recentlyUsedHeader: 'Usados recentemente',
            emptyStateSearch: 'Digite para pesquisar ícones',
            emptyStateNoResults: 'Nenhum ícone encontrado',
            showingResultsInfo: 'Mostrando 50 de {count} resultados. Digite mais para refinar.',
            emojiInstructions: 'Digite ou cole qualquer emoji para usá-lo como ícone',
            removeIcon: 'Remover ícone'
        },
        colorPicker: {
            currentColor: 'Atual',
            newColor: 'Nova',
            presetColors: 'Cores predefinidas',
            recentColors: 'Cores recentes',
            clearRecentColors: 'Limpar cores recentes',
            removeRecentColor: 'Remover cor',
            removeColor: 'Remover cor',
            apply: 'Aplicar',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
            colors: {
                red: 'Vermelho',
                orange: 'Laranja',
                amber: 'Âmbar',
                yellow: 'Amarelo',
                lime: 'Lima',
                green: 'Verde',
                emerald: 'Esmeralda',
                teal: 'Azul-petróleo',
                cyan: 'Ciano',
                sky: 'Céu',
                blue: 'Azul',
                indigo: 'Índigo',
                violet: 'Violeta',
                purple: 'Roxo',
                fuchsia: 'Fúcsia',
                pink: 'Rosa',
                rose: 'Rosa-claro',
                gray: 'Cinza',
                slate: 'Ardósia',
                stone: 'Pedra'
            }
        },
        tagOperation: {
            renameTitle: 'Renomear tag {tag}',
            deleteTitle: 'Excluir tag {tag}',
            newTagPrompt: 'Novo nome da tag',
            newTagPlaceholder: 'Digite o novo nome da tag',
            renameWarning: 'Renomear a tag {oldTag} modificará {count} {files}.',
            deleteWarning: 'Excluir a tag {tag} modificará {count} {files}.',
            modificationWarning: 'Isso atualizará as datas de modificação dos arquivos.',
            affectedFiles: 'Arquivos afetados:',
            andMore: '...e mais {count}',
            confirmRename: 'Renomear tag',
            confirmDelete: 'Excluir tag',
            file: 'arquivo',
            files: 'arquivos'
        },
        fileSystem: {
            newFolderTitle: 'Nova pasta',
            renameFolderTitle: 'Renomear pasta',
            renameFileTitle: 'Renomear arquivo',
            deleteFolderTitle: "Excluir '{name}'?",
            deleteFileTitle: "Excluir '{name}'?",
            folderNamePrompt: 'Digite o nome da pasta:',
            renamePrompt: 'Digite o novo nome:',
            renameVaultTitle: 'Alterar nome de exibição do cofre',
            renameVaultPrompt: 'Digite um nome de exibição personalizado (deixe em branco para usar o padrão):',
            deleteFolderConfirm: 'Tem certeza de que deseja excluir esta pasta e todo o seu conteúdo?',
            deleteFileConfirm: 'Tem certeza de que deseja excluir este arquivo?',
            removeAllTagsTitle: 'Remover todas as tags',
            removeAllTagsFromNote: 'Tem certeza de que deseja remover todas as tags desta nota?',
            removeAllTagsFromNotes: 'Tem certeza de que deseja remover todas as tags de {count} notas?'
        },
        folderNoteType: {
            title: 'Selecione o tipo de nota de pasta',
            folderLabel: 'Pasta: {name}'
        },
        folderSuggest: {
            placeholder: 'Mover para pasta...',
            navigatePlaceholder: 'Navegar para pasta...',
            instructions: {
                navigate: 'para navegar',
                move: 'para mover',
                select: 'para selecionar',
                dismiss: 'para descartar'
            }
        },
        homepage: {
            placeholder: 'Pesquisar arquivos...',
            instructions: {
                navigate: 'para navegar',
                select: 'para definir página inicial',
                dismiss: 'para descartar'
            }
        },
        navigationBanner: {
            placeholder: 'Pesquisar imagens...',
            instructions: {
                navigate: 'para navegar',
                select: 'para definir banner',
                dismiss: 'para descartar'
            }
        },
        tagSuggest: {
            placeholder: 'Pesquisar tags...',
            navigatePlaceholder: 'Navegar para tag...',
            addPlaceholder: 'Pesquisar tag para adicionar...',
            removePlaceholder: 'Selecionar tag para remover...',
            createNewTag: 'Criar nova tag: #{tag}',
            instructions: {
                navigate: 'para navegar',
                select: 'para selecionar',
                dismiss: 'para descartar',
                add: 'para adicionar tag',
                remove: 'para remover tag'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Falha ao criar pasta: {error}',
            createFile: 'Falha ao criar arquivo: {error}',
            renameFolder: 'Falha ao renomear pasta: {error}',
            renameFolderNoteConflict: 'Não é possível renomear: "{name}" já existe nesta pasta',
            renameFile: 'Falha ao renomear arquivo: {error}',
            deleteFolder: 'Falha ao excluir pasta: {error}',
            deleteFile: 'Falha ao excluir arquivo: {error}',
            duplicateNote: 'Falha ao duplicar nota: {error}',
            createCanvas: 'Falha ao criar tela: {error}',
            createDatabase: 'Falha ao criar base de dados: {error}',
            duplicateFolder: 'Falha ao duplicar pasta: {error}',
            openVersionHistory: 'Falha ao abrir histórico de versões: {error}',
            versionHistoryNotFound: 'Comando de histórico de versões não encontrado. Certifique-se de que o Obsidian Sync está ativado.',
            revealInExplorer: 'Falha ao revelar arquivo no explorador: {error}',
            folderNoteAlreadyExists: 'Nota de pasta já existe',
            folderAlreadyExists: 'A pasta "{name}" já existe',
            folderNotesDisabled: 'Ative as notas de pasta nas configurações para converter arquivos',
            folderNoteAlreadyLinked: 'Este arquivo já funciona como uma nota de pasta',
            folderNoteUnsupportedExtension: 'Extensão de arquivo não suportada: {extension}',
            folderNoteMoveFailed: 'Falha ao mover arquivo durante conversão: {error}',
            folderNoteRenameConflict: 'Um arquivo chamado "{name}" já existe na pasta',
            folderNoteConversionFailed: 'Falha ao converter arquivo em nota de pasta',
            folderNoteConversionFailedWithReason: 'Falha ao converter arquivo em nota de pasta: {error}',
            folderNoteOpenFailed: 'Arquivo convertido, mas falha ao abrir nota de pasta: {error}',
            failedToDeleteFile: 'Falha ao excluir {name}: {error}',
            failedToDeleteMultipleFiles: 'Falha ao excluir {count} arquivos',
            versionHistoryNotAvailable: 'Serviço de histórico de versões não disponível',
            drawingAlreadyExists: 'Já existe um desenho com este nome',
            failedToCreateDrawing: 'Falha ao criar desenho',
            noFolderSelected: 'Nenhuma pasta está selecionada no Notebook Navigator',
            noFileSelected: 'Nenhum arquivo está selecionado'
        },
        notices: {
            hideFolder: 'Pasta oculta: {name}',
            showFolder: 'Pasta exibida: {name}'
        },
        notifications: {
            deletedMultipleFiles: '{count} arquivos excluídos',
            movedMultipleFiles: '{count} arquivos movidos para {folder}',
            folderNoteConversionSuccess: 'Arquivo convertido em nota de pasta em "{name}"',
            folderMoved: 'Pasta "{name}" movida',
            deepLinkCopied: 'URL do Obsidian copiada para a área de transferência',
            pathCopied: 'Caminho copiado para a área de transferência',
            relativePathCopied: 'Caminho relativo copiado para a área de transferência',
            tagAddedToNote: 'Tag adicionada a 1 nota',
            tagAddedToNotes: 'Tag adicionada a {count} notas',
            tagRemovedFromNote: 'Tag removida de 1 nota',
            tagRemovedFromNotes: 'Tag removida de {count} notas',
            tagsClearedFromNote: 'Todas as tags removidas de 1 nota',
            tagsClearedFromNotes: 'Todas as tags removidas de {count} notas',
            noTagsToRemove: 'Sem tags para remover',
            noFilesSelected: 'Nenhum arquivo selecionado',
            tagOperationsNotAvailable: 'Operações de tag não disponíveis',
            tagsRequireMarkdown: 'Tags só são suportadas em notas Markdown',
            iconPackDownloaded: '{provider} baixado',
            iconPackUpdated: '{provider} atualizado ({version})',
            iconPackRemoved: '{provider} removido',
            iconPackLoadFailed: 'Falha ao carregar {provider}',
            hiddenFileReveal: 'Arquivo está oculto. Ative "Mostrar itens ocultos" para exibi-lo'
        },
        confirmations: {
            deleteMultipleFiles: 'Tem certeza de que deseja excluir {count} arquivos?',
            deleteConfirmation: 'Esta ação não pode ser desfeita.'
        },
        defaultNames: {
            untitled: 'Sem título',
            untitledNumber: 'Sem título {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Não é possível mover uma pasta para dentro de si mesma ou de uma subpasta.',
            itemAlreadyExists: 'Um item chamado "{name}" já existe neste local.',
            failedToMove: 'Falha ao mover: {error}',
            failedToAddTag: 'Falha ao adicionar tag "{tag}"',
            failedToClearTags: 'Falha ao limpar tags',
            failedToMoveFolder: 'Falha ao mover pasta "{name}"',
            failedToImportFiles: 'Falha ao importar: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} arquivos já existem no destino',
            addedTag: 'Tag "{tag}" adicionada a {count} arquivos',
            filesAlreadyHaveTag: '{count} arquivos já têm esta tag ou uma mais específica',
            clearedTags: 'Todas as tags removidas de {count} arquivos',
            noTagsToClear: 'Sem tags para remover',
            fileImported: '1 arquivo importado',
            filesImported: '{count} arquivos importados'
        }
    },

    // Date grouping
    dateGroups: {
        today: 'Hoje',
        yesterday: 'Ontem',
        previous7Days: 'Últimos 7 dias',
        previous30Days: 'Últimos 30 dias'
    },

    // Weekdays
    weekdays: {
        sunday: 'Domingo',
        monday: 'Segunda-feira',
        tuesday: 'Terça-feira',
        wednesday: 'Quarta-feira',
        thursday: 'Quinta-feira',
        friday: 'Sexta-feira',
        saturday: 'Sábado'
    },

    // Plugin commands
    commands: {
        open: 'Abrir',
        openHomepage: 'Abrir página inicial',
        revealFile: 'Revelar arquivo',
        search: 'Pesquisar',
        toggleDualPane: 'Alternar layout de painel duplo',
        deleteFile: 'Excluir arquivos',
        createNewNote: 'Criar nova nota',
        moveFiles: 'Mover arquivos',
        convertToFolderNote: 'Converter em nota de pasta',
        pinAllFolderNotes: 'Fixar todas as notas de pasta',
        navigateToFolder: 'Navegar para pasta',
        navigateToTag: 'Navegar para tag',
        addShortcut: 'Adicionar aos atalhos',
        toggleDescendants: 'Alternar descendentes',
        toggleHidden: 'Alternar pastas, tags e notas ocultas',
        toggleTagSort: 'Alternar ordem de classificação de tags',
        collapseExpand: 'Recolher / expandir todos os itens',
        addTag: 'Adicionar tag aos arquivos selecionados',
        removeTag: 'Remover tag dos arquivos selecionados',
        removeAllTags: 'Remover todas as tags dos arquivos selecionados',
        rebuildCache: 'Reconstruir cache'
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator',
        ribbonTooltip: 'Notebook Navigator',
        revealInNavigator: 'Revelar no Notebook Navigator'
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Última modificação em',
        createdAt: 'Criado em',
        file: 'arquivo',
        files: 'arquivos',
        folder: 'pasta',
        folders: 'pastas'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: 'Relatório de metadados com falhas exportado para: {filename}',
            exportFailed: 'Falha ao exportar relatório de metadados'
        },
        sections: {
            general: 'Geral',
            navigationPane: 'Painel de navegação',
            icons: 'Pacotes de ícones',
            folders: 'Pastas',
            tags: 'Tags',
            search: 'Pesquisar',
            listPane: 'Painel de lista',
            notes: 'Notas',
            hotkeys: 'Atalhos de teclado',
            advanced: 'Avançado'
        },
        groups: {
            general: {
                filtering: 'Filtragem',
                behavior: 'Comportamento',
                view: 'Aparência',
                desktopAppearance: 'Aparência do desktop',
                mobileAppearance: 'Aparência do celular',
                formatting: 'Formatação'
            },
            navigation: {
                behavior: 'Comportamento',
                appearance: 'Aparência'
            },
            list: {
                display: 'Aparência',
                quickActions: 'Ações rápidas'
            },
            notes: {
                frontmatter: 'Frontmatter',
                display: 'Aparência'
            }
        },
        items: {
            searchProvider: {
                name: 'Provedor de pesquisa',
                desc: 'Escolha entre pesquisa rápida por nome de arquivo ou pesquisa de texto completo com o plugin Omnisearch.',
                options: {
                    internal: 'Pesquisa por filtro',
                    omnisearch: 'Omnisearch (texto completo)'
                },
                info: {
                    filterSearch: {
                        title: 'Pesquisa por filtro (padrão):',
                        description:
                            'Pesquisa rápida e leve que filtra arquivos por nome e tags na pasta atual e subpastas. Suporta filtragem de tags com prefixo # (por exemplo, #projeto), exclusão com prefixo ! (por exemplo, !rascunho, !#arquivado) e localização de notas sem tags com !#. Ideal para navegação rápida no contexto atual.'
                    },
                    omnisearch: {
                        title: 'Omnisearch:',
                        description:
                            'Pesquisa de texto completo que pesquisa todo o seu cofre e depois filtra os resultados para mostrar apenas arquivos da pasta atual, subpastas ou tags selecionadas. Requer o plugin Omnisearch instalado - se não estiver disponível, a pesquisa retornará automaticamente para Pesquisa por filtro.',
                        warningNotInstalled: 'Plugin Omnisearch não instalado. Pesquisa por filtro está sendo usada.',
                        limitations: {
                            title: 'Limitações conhecidas:',
                            performance: 'Desempenho: Pode ser lento, especialmente ao pesquisar menos de 3 caracteres em cofres grandes',
                            pathBug:
                                'Bug de caminho: Não pode pesquisar em caminhos com caracteres não ASCII e não pesquisa subcaminhos corretamente, afetando quais arquivos aparecem nos resultados da pesquisa',
                            limitedResults:
                                'Resultados limitados: Como o Omnisearch pesquisa todo o cofre e retorna um número limitado de resultados antes da filtragem, arquivos relevantes da pasta atual podem não aparecer se houver muitas correspondências em outro lugar no cofre',
                            previewText:
                                'Texto de visualização: As visualizações de notas são substituídas por trechos de resultados do Omnisearch, que podem não mostrar o destaque real da correspondência de pesquisa se ele aparecer em outro lugar no arquivo'
                        }
                    }
                }
            },
            listPaneTitle: {
                name: 'Título do painel de lista',
                desc: 'Escolha onde o título do painel de lista é mostrado.',
                options: {
                    header: 'Mostrar no cabeçalho',
                    list: 'Mostrar no painel de lista',
                    hidden: 'Não mostrar'
                }
            },
            sortNotesBy: {
                name: 'Ordenar notas por',
                desc: 'Escolha como as notas são ordenadas na lista.',
                options: {
                    'modified-desc': 'Data de edição (mais recente no topo)',
                    'modified-asc': 'Data de edição (mais antiga no topo)',
                    'created-desc': 'Data de criação (mais recente no topo)',
                    'created-asc': 'Data de criação (mais antiga no topo)',
                    'title-asc': 'Título (A no topo)',
                    'title-desc': 'Título (Z no topo)'
                }
            },
            includeDescendantNotes: {
                name: 'Mostrar notas de subpastas / descendentes',
                desc: 'Incluir notas de subpastas aninhadas e descendentes de tags ao visualizar uma pasta ou tag.'
            },
            limitPinnedToCurrentFolder: {
                name: 'Mostrar notas fixadas apenas na pasta pai',
                desc: 'Notas fixadas aparecem apenas ao visualizar sua pasta'
            },
            separateNoteCounts: {
                name: 'Mostrar contagens atuais e descendentes separadamente',
                desc: 'Exibir contagens de notas no formato "atual ▾ descendentes" em pastas e tags.'
            },
            groupNotes: {
                name: 'Agrupar notas',
                desc: 'Exibir cabeçalhos entre notas agrupadas por data ou pasta. Visualizações de tags usam grupos de data quando o agrupamento de pastas está ativado.',
                options: {
                    none: 'Não agrupar',
                    date: 'Agrupar por data',
                    folder: 'Agrupar por pasta'
                }
            },
            showPinnedGroupHeader: {
                name: 'Mostrar cabeçalho do grupo fixado',
                desc: 'Exibir o cabeçalho da seção fixada acima das notas fixadas.'
            },
            optimizeNoteHeight: {
                name: 'Otimizar altura da nota',
                desc: 'Reduzir altura para notas fixadas e notas sem texto de visualização.'
            },
            slimItemHeight: {
                name: 'Altura do item simples',
                desc: 'Defina a altura dos itens de lista simples no desktop e celular.',
                resetTooltip: 'Restaurar para padrão (28px)'
            },
            slimItemHeightScaleText: {
                name: 'Dimensionar texto com altura do item simples',
                desc: 'Dimensionar texto da lista simples quando a altura do item é reduzida.'
            },
            showParentFolderNames: {
                name: 'Mostrar nomes de pastas pai',
                desc: 'Exibir o nome da pasta pai para notas em subpastas ou tags.'
            },
            showParentFolderColors: {
                name: 'Mostrar cores de pastas pai',
                desc: 'Usar cores de pasta em rótulos de pastas pai.'
            },
            showQuickActions: {
                name: 'Mostrar ações rápidas (apenas desktop)',
                desc: 'Mostrar ações de passar o mouse em itens de arquivo.'
            },
            quickActionsRevealInFolder: {
                name: 'Revelar na pasta',
                desc: 'Ação rápida: Revelar nota em sua pasta pai. Visível apenas ao visualizar notas de subpastas ou em tags (não mostrado na pasta real da nota).'
            },
            quickActionsPinNote: {
                name: 'Fixar nota',
                desc: 'Ação rápida: Fixar ou desafixar nota no topo da lista.'
            },
            quickActionsOpenInNewTab: {
                name: 'Abrir em nova aba',
                desc: 'Ação rápida: Abrir nota em nova aba.'
            },
            dualPane: {
                name: 'Layout de painel duplo (não sincronizado)',
                desc: 'Mostrar painel de navegação e painel de lista lado a lado no desktop.'
            },
            dualPaneOrientation: {
                name: 'Orientação do painel duplo (não sincronizado)',
                desc: 'Escolha layout horizontal ou vertical quando o painel duplo estiver ativo.',
                options: {
                    horizontal: 'Divisão horizontal',
                    vertical: 'Divisão vertical'
                }
            },
            appearanceBackground: {
                name: 'Cor de fundo',
                desc: 'Escolha cores de fundo para painéis de navegação e lista.',
                options: {
                    separate: 'Fundos separados',
                    primary: 'Usar fundo da lista',
                    secondary: 'Usar fundo da navegação'
                }
            },
            appearanceScale: {
                name: 'Nível de zoom',
                desc: 'Controla o nível de zoom geral do Notebook Navigator.'
            },
            startView: {
                name: 'Visualização inicial padrão',
                desc: 'Escolha qual painel exibir ao abrir o Notebook Navigator. O painel de navegação mostra atalhos, notas recentes e árvore de pastas. O painel de lista mostra a lista de notas imediatamente.',
                options: {
                    navigation: 'Painel de navegação',
                    files: 'Painel de lista'
                }
            },
            autoRevealActiveNote: {
                name: 'Revelar automaticamente a nota ativa',
                desc: 'Revelar automaticamente notas quando abertas pelo Alternador Rápido, links ou pesquisa.'
            },
            autoRevealIgnoreRightSidebar: {
                name: 'Ignorar eventos da barra lateral direita',
                desc: 'Não alterar a nota ativa ao clicar ou alterar notas na barra lateral direita.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Selecionar automaticamente a primeira nota (apenas desktop)',
                desc: 'Abrir automaticamente a primeira nota ao alternar pastas ou tags.'
            },
            skipAutoScroll: {
                name: 'Desativar rolagem automática para atalhos',
                desc: 'Não rolar o painel de navegação ao clicar em itens nos atalhos.'
            },
            autoExpandFoldersTags: {
                name: 'Expandir automaticamente pastas e tags',
                desc: 'Expandir automaticamente pastas e tags quando forem selecionadas.'
            },
            navigationBanner: {
                name: 'Banner de navegação',
                desc: 'Exibir uma imagem acima do painel de navegação.',
                current: 'Banner atual: {path}',
                chooseButton: 'Escolher imagem',
                clearButton: 'Limpar'
            },
            showShortcuts: {
                name: 'Mostrar atalhos',
                desc: 'Exibir a seção de atalhos no painel de navegação.'
            },
            showRecentNotes: {
                name: 'Mostrar notas recentes',
                desc: 'Exibir a seção de notas recentes no painel de navegação.'
            },
            recentNotesCount: {
                name: 'Contagem de notas recentes',
                desc: 'Número de notas recentes a exibir.'
            },
            showTooltips: {
                name: 'Mostrar dicas',
                desc: 'Exibir dicas de ferramentas ao passar o mouse com informações adicionais para notas e pastas.'
            },
            showTooltipPath: {
                name: 'Mostrar caminho',
                desc: 'Exibir o caminho da pasta abaixo dos nomes de notas nas dicas de ferramentas.'
            },
            resetPaneSeparator: {
                name: 'Redefinir posição do separador de painéis',
                desc: 'Redefinir o separador arrastável entre o painel de navegação e o painel de lista para a posição padrão.',
                buttonText: 'Redefinir separador',
                notice: 'Posição do separador redefinida. Reinicie o Obsidian ou reabra o Notebook Navigator para aplicar.'
            },
            multiSelectModifier: {
                name: 'Modificador de seleção múltipla',
                desc: 'Escolha qual tecla modificadora alterna a seleção múltipla. Quando Opção/Alt está selecionado, Cmd/Ctrl clique abre notas em uma nova aba.',
                options: {
                    cmdCtrl: 'Cmd/Ctrl clique',
                    optionAlt: 'Opção/Alt clique'
                }
            },
            fileVisibility: {
                name: 'Mostrar tipos de arquivo',
                desc: 'Filtrar quais tipos de arquivo são mostrados no navegador. Tipos de arquivo não suportados pelo Obsidian podem abrir em aplicativos externos.',
                options: {
                    documents: 'Documentos (.md, .canvas, .base)',
                    supported: 'Suportados (abre no Obsidian)',
                    all: 'Todos (pode abrir externamente)'
                }
            },
            homepage: {
                name: 'Página inicial',
                desc: 'Escolha o arquivo que o Notebook Navigator abre automaticamente, como um painel.',
                current: 'Atual: {path}',
                currentMobile: 'Celular: {path}',
                chooseButton: 'Escolher arquivo',
                clearButton: 'Limpar',
                separateMobile: {
                    name: 'Página inicial separada para celular',
                    desc: 'Usar uma página inicial diferente para dispositivos móveis.'
                }
            },
            excludedNotes: {
                name: 'Ocultar notas',
                desc: 'Lista separada por vírgulas de propriedades do frontmatter. Notas contendo qualquer uma dessas propriedades serão ocultadas (por exemplo, rascunho, privado, arquivado).',
                placeholder: 'rascunho, privado'
            },
            excludedFolders: {
                name: 'Ocultar pastas',
                desc: 'Lista separada por vírgulas de pastas a ocultar. Padrões de nome: assets* (pastas que começam com assets), *_temp (terminam com _temp). Padrões de caminho: /arquivo (apenas arquivo raiz), /res* (pastas raiz que começam com res), /*/temp (pastas temp um nível abaixo), /projetos/* (todas as pastas dentro de projetos).',
                placeholder: 'modelos, assets*, /arquivo, /res*'
            },
            showFileDate: {
                name: 'Mostrar data',
                desc: 'Exibir a data abaixo dos nomes das notas.'
            },
            alphabeticalDateMode: {
                name: 'Ao ordenar por nome',
                desc: 'Data a mostrar quando as notas são ordenadas alfabeticamente.',
                options: {
                    created: 'Data de criação',
                    modified: 'Data de modificação'
                }
            },
            showFileTags: {
                name: 'Mostrar tags de arquivo',
                desc: 'Exibir tags clicáveis em itens de arquivo.'
            },
            showFileTagAncestors: {
                name: 'Mostrar tags pai',
                desc: 'Exibir segmentos pai antes do nome da tag.'
            },
            colorFileTags: {
                name: 'Colorir tags de arquivo',
                desc: 'Aplicar cores de tag aos emblemas de tag em itens de arquivo.'
            },
            showFileTagsInSlimMode: {
                name: 'Mostrar tags de arquivo no modo simples',
                desc: 'Exibir tags quando data, visualização e imagem estão ocultas.'
            },
            dateFormat: {
                name: 'Formato de data',
                desc: 'Formato para exibir datas (usa formato date-fns).',
                placeholder: 'MMM d, yyyy',
                help: 'Formatos comuns:\nMMM d, yyyy = Mai 25, 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = ano\nMMMM/MMM/MM = mês\ndd/d = dia\nEEEE/EEE = dia da semana',
                helpTooltip: 'Clique para referência de formato'
            },
            timeFormat: {
                name: 'Formato de hora',
                desc: 'Formato para exibir horas (usa formato date-fns).',
                placeholder: 'h:mm a',
                help: 'Formatos comuns:\nh:mm a = 2:30 PM (12 horas)\nHH:mm = 14:30 (24 horas)\nh:mm:ss a = 2:30:45 PM\nHH:mm:ss = 14:30:45\n\nTokens:\nHH/H = 24 horas\nhh/h = 12 horas\nmm = minutos\nss = segundos\na = AM/PM',
                helpTooltip: 'Clique para referência de formato'
            },
            showFilePreview: {
                name: 'Mostrar visualização de nota',
                desc: 'Exibir texto de visualização abaixo dos nomes das notas.'
            },
            skipHeadingsInPreview: {
                name: 'Pular cabeçalhos na visualização',
                desc: 'Pular linhas de cabeçalho ao gerar texto de visualização.'
            },
            skipCodeBlocksInPreview: {
                name: 'Pular blocos de código na visualização',
                desc: 'Pular blocos de código ao gerar texto de visualização.'
            },
            previewProperties: {
                name: 'Propriedades de visualização',
                desc: 'Lista separada por vírgulas de propriedades do frontmatter para verificar texto de visualização. A primeira propriedade com texto será usada.',
                placeholder: 'resumo, descrição, abstrato',
                info: 'Se nenhum texto de visualização for encontrado nas propriedades especificadas, a visualização será gerada a partir do conteúdo da nota.'
            },
            previewRows: {
                name: 'Linhas de visualização',
                desc: 'Número de linhas a exibir para texto de visualização.',
                options: {
                    '1': '1 linha',
                    '2': '2 linhas',
                    '3': '3 linhas',
                    '4': '4 linhas',
                    '5': '5 linhas'
                }
            },
            fileNameRows: {
                name: 'Linhas de título',
                desc: 'Número de linhas a exibir para títulos de notas.',
                options: {
                    '1': '1 linha',
                    '2': '2 linhas'
                }
            },
            showFeatureImage: {
                name: 'Mostrar imagem destacada',
                desc: 'Exibir imagens em miniatura do frontmatter. Dica: Use o plugin "Featured Image" para definir automaticamente imagens destacadas para todos os seus documentos.'
            },
            forceSquareFeatureImage: {
                name: 'Forçar imagem destacada quadrada',
                desc: 'Renderizar imagens destacadas como miniaturas quadradas.'
            },
            featureImageProperties: {
                name: 'Propriedades de imagem',
                desc: 'Lista separada por vírgulas de propriedades do frontmatter para verificar imagens em miniatura. A primeira propriedade com uma imagem será usada. Se vazia e a configuração de fallback estiver ativada, a primeira imagem incorporada será usada.',
                placeholder: 'miniatura, featureRedimensionado, feature'
            },
            useEmbeddedImageFallback: {
                name: 'Usar fallback de imagem incorporada',
                desc: 'Usar a primeira imagem incorporada no documento como fallback quando nenhuma miniatura for encontrada nas propriedades do frontmatter (requer Obsidian 1.9.4+). Desative isso para verificar se as miniaturas estão configuradas corretamente.'
            },
            showRootFolder: {
                name: 'Mostrar pasta raiz',
                desc: 'Exibir o nome do cofre como a pasta raiz na árvore.'
            },
            inheritFolderColors: {
                name: 'Herdar cores de pastas',
                desc: 'Pastas filhas herdam cor das pastas pai.'
            },
            showNoteCount: {
                name: 'Mostrar contagem de notas',
                desc: 'Exibir o número de notas ao lado de cada pasta e tag.'
            },
            showIcons: {
                name: 'Mostrar ícones',
                desc: 'Exibir ícones para pastas, tags e notas.'
            },
            showIconsColorOnly: {
                name: 'Aplicar cor apenas aos ícones',
                desc: 'Quando ativado, cores personalizadas são aplicadas apenas aos ícones. Quando desativado, as cores são aplicadas aos ícones e aos rótulos de texto.'
            },
            collapseBehavior: {
                name: 'Recolher itens',
                desc: 'Escolha o que o botão expandir/recolher tudo afeta.',
                options: {
                    all: 'Todas as pastas e tags',
                    foldersOnly: 'Apenas pastas',
                    tagsOnly: 'Apenas tags'
                }
            },
            smartCollapse: {
                name: 'Manter item selecionado expandido',
                desc: 'Ao recolher, manter a pasta ou tag atualmente selecionada e seus pais expandidos.'
            },
            navIndent: {
                name: 'Indentação da árvore',
                desc: 'Ajustar a largura da indentação para pastas e tags aninhadas.'
            },
            navItemHeight: {
                name: 'Altura do item',
                desc: 'Ajustar a altura de pastas e tags no painel de navegação.'
            },
            navItemHeightScaleText: {
                name: 'Dimensionar texto com altura do item',
                desc: 'Reduzir o tamanho do texto de navegação quando a altura do item é diminuída.'
            },
            navRootSpacing: {
                name: 'Espaçamento de item raiz',
                desc: 'Espaçamento entre pastas e tags de nível raiz.'
            },
            showTags: {
                name: 'Mostrar tags',
                desc: 'Exibir seção de tags abaixo das pastas no navegador.'
            },
            tagSortOrder: {
                name: 'Ordem de classificação de tags',
                desc: 'Escolha como as tags são ordenadas no painel de navegação.',
                options: {
                    alphaAsc: 'A a Z',
                    alphaDesc: 'Z a A',
                    frequencyAsc: 'Frequência (baixa para alta)',
                    frequencyDesc: 'Frequência (alta para baixa)'
                }
            },
            showAllTagsFolder: {
                name: 'Mostrar pasta de tags',
                desc: 'Exibir "Tags" como uma pasta recolhível.'
            },
            showUntagged: {
                name: 'Mostrar notas sem tags',
                desc: 'Exibir item "Sem tags" para notas sem tags.'
            },
            keepEmptyTagsProperty: {
                name: 'Manter propriedade de tags após remover última tag',
                desc: 'Manter a propriedade de tags do frontmatter quando todas as tags forem removidas. Quando desativado, a propriedade de tags é excluída do frontmatter.'
            },
            hiddenTags: {
                name: 'Tags ocultas',
                desc: 'Lista separada por vírgulas de prefixos de tag ou curingas de nome. Use tag* ou *tag para corresponder nomes de tags. Ocultar uma tag também oculta todas as suas sub-tags (por exemplo, "arquivo" oculta "arquivo/2024/docs").',
                placeholder: 'interno, temp/rascunhos, arquivo/2024'
            },
            enableFolderNotes: {
                name: 'Ativar notas de pasta',
                desc: 'Quando ativado, pastas com notas associadas são exibidas como links clicáveis.'
            },
            folderNoteType: {
                name: 'Tipo de nota de pasta padrão',
                desc: 'Tipo de nota de pasta criado a partir do menu de contexto.',
                options: {
                    ask: 'Perguntar ao criar',
                    markdown: 'Markdown',
                    canvas: 'Tela',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: 'Nome da nota de pasta',
                desc: 'Nome da nota de pasta sem extensão. Deixe em branco para usar o mesmo nome da pasta.',
                placeholder: 'índice'
            },
            folderNoteProperties: {
                name: 'Propriedades da nota de pasta',
                desc: 'Frontmatter YAML adicionado a novas notas de pasta. Os marcadores --- são adicionados automaticamente.',
                placeholder: 'tema: escuro\nnotapasta: true'
            },
            hideFolderNoteInList: {
                name: 'Ocultar notas de pasta na lista',
                desc: 'Ocultar a nota de pasta de aparecer na lista de notas da pasta.'
            },
            pinCreatedFolderNote: {
                name: 'Fixar notas de pasta criadas',
                desc: 'Fixar automaticamente notas de pasta quando criadas a partir do menu de contexto.'
            },
            confirmBeforeDelete: {
                name: 'Confirmar antes de excluir',
                desc: 'Mostrar diálogo de confirmação ao excluir notas ou pastas'
            },
            metadataCleanup: {
                name: 'Limpar metadados',
                desc: 'Remove metadados órfãos deixados para trás quando arquivos, pastas ou tags são excluídos, movidos ou renomeados fora do Obsidian. Isso afeta apenas o arquivo de configurações do Notebook Navigator.',
                buttonText: 'Limpar metadados',
                error: 'Falha na limpeza de configurações',
                loading: 'Verificando metadados...',
                statusClean: 'Sem metadados para limpar',
                statusCounts: 'Itens órfãos: {folders} pastas, {tags} tags, {files} arquivos, {pinned} fixações'
            },
            rebuildCache: {
                name: 'Reconstruir cache',
                desc: 'Use isso se você tiver tags ausentes, visualizações incorretas ou imagens destacadas ausentes. Isso pode acontecer após conflitos de sincronização ou fechamentos inesperados.',
                buttonText: 'Reconstruir cache',
                success: 'Cache reconstruído',
                error: 'Falha ao reconstruir cache'
            },
            hotkeys: {
                intro: 'Edite <pasta do plugin>/notebook-navigator/data.json para personalizar os atalhos de teclado do Notebook Navigator. Abra o arquivo e localize a seção "keyboardShortcuts". Cada entrada usa esta estrutura:',
                example: '"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]',
                modifierList: [
                    '"Mod" = Cmd (macOS) / Ctrl (Win/Linux)',
                    '"Alt" = Alt/Option',
                    '"Shift" = Shift',
                    '"Ctrl" = Control (prefira "Mod" para multiplataforma)'
                ],
                guidance:
                    'Adicione vários mapeamentos para suportar teclas alternativas, como as associações ArrowUp e K mostradas acima. Combine modificadores em uma entrada listando cada valor, por exemplo "modifiers": ["Mod", "Shift"]. Sequências de teclado como "gg" ou "dd" não são suportadas. Recarregue o Obsidian após editar o arquivo.'
            },
            externalIcons: {
                downloadButton: 'Baixar',
                downloadingLabel: 'Baixando...',
                removeButton: 'Remover',
                statusInstalled: 'Baixado (versão {version})',
                statusNotInstalled: 'Não baixado',
                versionUnknown: 'desconhecida',
                downloadFailed: 'Falha ao baixar {name}. Verifique sua conexão e tente novamente.',
                removeFailed: 'Falha ao remover {name}.',
                infoNote:
                    'Pacotes de ícones baixados sincronizam o estado de instalação entre dispositivos. Os pacotes de ícones permanecem no banco de dados local em cada dispositivo; a sincronização apenas rastreia se devem ser baixados ou removidos. Pacotes de ícones são baixados do repositório Notebook Navigator (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).',
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
                name: 'Ler metadados do frontmatter',
                desc: 'Ler nomes de notas, timestamps, ícones e cores do frontmatter quando disponível, retornando aos valores do sistema de arquivos ou configurações'
            },
            frontmatterIconField: {
                name: 'Campo de ícone',
                desc: 'Campo do frontmatter para ícones de arquivo. Deixe em branco para usar ícones armazenados nas configurações.',
                placeholder: 'ícone'
            },
            frontmatterColorField: {
                name: 'Campo de cor',
                desc: 'Campo do frontmatter para cores de arquivo. Deixe em branco para usar cores armazenadas nas configurações.',
                placeholder: 'cor'
            },
            frontmatterSaveMetadata: {
                name: 'Salvar ícones e cores no frontmatter',
                desc: 'Escrever automaticamente ícones e cores de arquivo no frontmatter usando os campos configurados acima.'
            },
            frontmatterIconizeFormat: {
                name: 'Salvar no formato Iconize',
                desc: 'Salvar ícones usando formato Iconize (por exemplo, LiHome, FasUser, SiGithub) em vez do formato do plugin (por exemplo, home, fontawesome-solid:user, simple-icons:github).'
            },
            frontmatterMigration: {
                name: 'Migrar ícones e cores das configurações',
                desc: 'Armazenado nas configurações: {icons} ícones, {colors} cores.',
                button: 'Migrar',
                buttonWorking: 'Migrando...',
                noticeNone: 'Sem ícones ou cores de arquivo armazenados nas configurações.',
                noticeDone: 'Migrados {migratedIcons}/{icons} ícones, {migratedColors}/{colors} cores.',
                noticeFailures: 'Entradas com falha: {failures}.',
                noticeError: 'Falha na migração. Verifique o console para detalhes.'
            },
            frontmatterNameField: {
                name: 'Campo de nome',
                desc: 'Campo do frontmatter a usar como nome de exibição da nota. Deixe em branco para usar o nome do arquivo.',
                placeholder: 'título'
            },
            frontmatterCreatedField: {
                name: 'Campo de timestamp de criação',
                desc: 'Nome do campo do frontmatter para o timestamp de criação. Deixe em branco para usar apenas a data do sistema de arquivos.',
                placeholder: 'criado'
            },
            frontmatterModifiedField: {
                name: 'Campo de timestamp de modificação',
                desc: 'Nome do campo do frontmatter para o timestamp de modificação. Deixe em branco para usar apenas a data do sistema de arquivos.',
                placeholder: 'modificado'
            },
            frontmatterDateFormat: {
                name: 'Formato de timestamp',
                desc: 'Formato usado para analisar timestamps no frontmatter. Deixe em branco para usar formato ISO 8601',
                helpTooltip: 'Veja documentação de formato date-fns',
                help: "Formatos comuns:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: 'Apoiar o desenvolvimento',
                desc: 'Se você adora usar o Notebook Navigator, considere apoiar seu desenvolvimento contínuo.',
                buttonText: '❤️ Patrocinar',
                coffeeButton: '☕️ Me pague um café'
            },
            updateCheckOnStart: {
                name: 'Verificar nova versão ao iniciar',
                desc: 'Verifica novas versões do plugin na inicialização e mostra uma notificação quando uma atualização está disponível. Cada versão é anunciada apenas uma vez, e as verificações ocorrem no máximo uma vez por dia.',
                status: 'Nova versão disponível: {version}'
            },
            whatsNew: {
                name: 'O que há de novo',
                desc: 'Veja atualizações e melhorias recentes',
                buttonText: 'Ver atualizações recentes'
            },
            cacheStatistics: {
                localCache: 'Cache local',
                items: 'itens',
                withTags: 'com tags',
                withPreviewText: 'com texto de visualização',
                withFeatureImage: 'com imagem destacada',
                withMetadata: 'com metadados'
            },
            metadataInfo: {
                successfullyParsed: 'Analisados com sucesso',
                itemsWithName: 'itens com nome',
                withCreatedDate: 'com data de criação',
                withModifiedDate: 'com data de modificação',
                withIcon: 'com ícone',
                withColor: 'com cor',
                failedToParse: 'Falha ao analisar',
                createdDates: 'datas de criação',
                modifiedDates: 'datas de modificação',
                checkTimestampFormat: 'Verifique seu formato de timestamp.',
                exportFailed: 'Exportar erros'
            }
        }
    },
    whatsNew: {
        title: 'O que há de novo no Notebook Navigator',
        supportMessage: 'Se você acha o Notebook Navigator útil, considere apoiar seu desenvolvimento.',
        supportButton: 'Me pague um café',
        thanksButton: 'Obrigado!'
    }
};
