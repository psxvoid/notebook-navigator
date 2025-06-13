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
export const STRINGS_ES = {
    // Common UI elements
    common: {
        cancel: 'Cancelar', // Button text for canceling dialogs and operations (English: Cancel)
        delete: 'Eliminar', // Button text for delete operations in dialogs (English: Delete)
        submit: 'Enviar', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'Sin selección', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Sin etiquetas', // Label for notes without any tags (English: Untagged)
        untitled: 'Sin título', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'Imagen destacada', // Alt text for thumbnail/preview images (English: Feature image)
    },

    // File list
    fileList: {
        emptyStateNoSelection: 'Selecciona una carpeta o etiqueta para ver las notas', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'Sin notas', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Fijadas', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
    },

    // Folder tree
    folderTree: {
        rootFolderName: 'Bóveda', // Display name for the vault root folder in the tree (English: Vault)
    },

    // Tag list
    tagList: {
        sectionHeader: 'Etiquetas', // Header text for the tags section below folders (English: Tags)
        untaggedLabel: 'Sin etiquetas', // Label for the special item showing notes without tags (English: Untagged)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Contraer todas las carpetas', // Tooltip for button that collapses all expanded folders (English: Collapse all folders)
        expandAllFolders: 'Expandir todas las carpetas', // Tooltip for button that expands all folders (English: Expand all folders)
        newFolder: 'Nueva carpeta', // Tooltip for create new folder button (English: New folder)
        newNote: 'Nueva nota', // Tooltip for create new note button (English: New note)
        mobileBackToFolders: 'Volver a carpetas', // Mobile-only back button text to return to folder list (English: Back to folders)
        changeSortOrder: 'Cambiar orden de clasificación', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Predeterminado', // Label for default sorting mode (English: Default)
        customSort: 'Personalizado', // Label for custom sorting mode (English: Custom)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Abrir en nueva pestaña',
            openToRight: 'Abrir a la derecha',
            openInNewWindow: 'Abrir en nueva ventana',
            pinNote: 'Fijar nota',
            unpinNote: 'Desfijar nota',
            duplicateNote: 'Duplicar nota',
            openVersionHistory: 'Abrir historial de versiones',
            revealInFinder: 'Mostrar en Finder',
            showInExplorer: 'Mostrar en el explorador del sistema',
            copyDeepLink: 'Copiar enlace profundo',
            renameNote: 'Renombrar nota',
            deleteNote: 'Eliminar nota',
        },
        folder: {
            newNote: 'Nueva nota',
            newFolder: 'Nueva carpeta',
            newCanvas: 'Nuevo lienzo',
            newBase: 'Nueva base de datos',
            duplicateFolder: 'Duplicar carpeta',
            searchInFolder: 'Buscar en carpeta',
            changeIcon: 'Cambiar icono',
            removeIcon: 'Quitar icono',
            changeColor: 'Cambiar color',
            removeColor: 'Quitar color',
            renameFolder: 'Renombrar carpeta',
            deleteFolder: 'Eliminar carpeta',
        },
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Buscar iconos...',
            recentlyUsedHeader: 'Usados recientemente',
            emptyStateSearch: 'Empieza a escribir para buscar iconos',
            emptyStateNoResults: 'No se encontraron iconos',
            showingResultsInfo: 'Mostrando 50 de {count} resultados. Escribe más para filtrar.',
        },
        colorPicker: {
            header: 'Elegir color de carpeta',
            colors: {
                red: 'Rojo',
                orange: 'Naranja',
                amber: 'Ámbar',
                yellow: 'Amarillo',
                lime: 'Lima',
                green: 'Verde',
                emerald: 'Esmeralda',
                teal: 'Verde azulado',
                cyan: 'Cian',
                sky: 'Cielo',
                blue: 'Azul',
                indigo: 'Índigo',
                violet: 'Violeta',
                purple: 'Púrpura',
                fuchsia: 'Fucsia',
                pink: 'Rosa',
                rose: 'Rosa claro',
                gray: 'Gris',
                slate: 'Pizarra',
                stone: 'Piedra',
            },
        },
        fileSystem: {
            newFolderTitle: 'Nueva carpeta',
            renameFolderTitle: 'Renombrar carpeta',
            renameFileTitle: 'Renombrar archivo',
            deleteFolderTitle: '¿Eliminar \'{name}\'?',
            deleteFileTitle: '¿Eliminar \'{name}\'?',
            folderNamePrompt: 'Introduce el nombre de la carpeta:',
            renamePrompt: 'Introduce el nuevo nombre:',
            deleteFolderConfirm: '¿Estás seguro de que quieres eliminar esta carpeta y todo su contenido?',
            deleteFileConfirm: '¿Estás seguro de que quieres eliminar este archivo?',
        },
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Error al crear la carpeta: {error}',
            createFile: 'Error al crear el archivo: {error}',
            renameFolder: 'Error al renombrar la carpeta: {error}',
            renameFile: 'Error al renombrar el archivo: {error}',
            deleteFolder: 'Error al eliminar la carpeta: {error}',
            deleteFile: 'Error al eliminar el archivo: {error}',
            duplicateNote: 'Error al duplicar la nota: {error}',
            createCanvas: 'Error al crear el lienzo: {error}',
            createDatabase: 'Error al crear la base de datos: {error}',
            duplicateFolder: 'Error al duplicar la carpeta: {error}',
            openVersionHistory: 'Error al abrir el historial de versiones: {error}',
            versionHistoryNotFound: 'Comando de historial de versiones no encontrado. Asegúrate de que Obsidian Sync esté habilitado.',
            revealInExplorer: 'Error al mostrar el archivo en el explorador del sistema: {error}',
        },
        defaultNames: {
            untitled: 'Sin título',
            untitledNumber: 'Sin título {number}',
        },
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'No se puede mover una carpeta dentro de sí misma o una subcarpeta.',
            itemAlreadyExists: 'Ya existe un elemento llamado "{name}" en esta ubicación.',
            failedToMove: 'Error al mover: {error}',
        },
    },

    // Date grouping
    dateGroups: {
        today: 'Hoy',
        yesterday: 'Ayer',
        previous7Days: 'Últimos 7 días',
        previous30Days: 'Últimos 30 días',
    },

    // Weekdays
    weekdays: {
        sunday: 'Domingo',
        monday: 'Lunes',
        tuesday: 'Martes',
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes',
        saturday: 'Sábado',
    },

    // Plugin commands
    commands: {
        open: 'Abrir', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealActiveFile: 'Mostrar archivo activo', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal active file)
        focusFileList: 'Enfocar lista de archivos', // Command palette: Moves keyboard focus to the file list pane (English: Focus file list)
    },

    // Plugin UI
    plugin: {
        viewName: 'Navegador de Cuadernos', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Navegador de Cuadernos', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Mostrar en el Navegador de Cuadernos', // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Settings
    settings: {
        sections: {
            noteDisplay: 'Visualización de notas',
            folderDisplay: 'Visualización de carpetas',
            tagDisplay: 'Visualización de etiquetas',
            advanced: 'Avanzado',
        },
        items: {
            sortNotesBy: {
                name: 'Ordenar notas por',
                desc: 'Elige cómo se ordenan las notas en la lista de notas.',
                options: {
                    'modified-desc': 'Fecha de edición (más reciente primero)',
                    'modified-asc': 'Fecha de edición (más antigua primero)',
                    'created-desc': 'Fecha de creación (más reciente primero)',
                    'created-asc': 'Fecha de creación (más antigua primero)',
                    'title-asc': 'Título (A primero)',
                    'title-desc': 'Título (Z primero)',
                },
            },
            groupByDate: {
                name: 'Agrupar notas por fecha',
                desc: 'Cuando se ordena por fecha, agrupa las notas bajo encabezados de fecha.',
            },
            showNotesFromSubfolders: {
                name: 'Mostrar notas de subcarpetas',
                desc: 'Muestra todas las notas de las subcarpetas en la vista de carpeta actual.',
            },
            autoRevealActiveNote: {
                name: 'Mostrar automáticamente la nota activa',
                desc: 'Muestra y selecciona automáticamente las notas cuando se abren desde el Conmutador rápido, enlaces o búsqueda.',
            },
            autoSelectFirstFile: {
                name: 'Seleccionar automáticamente el primer archivo al cambiar de carpeta',
                desc: 'Selecciona y abre automáticamente el primer archivo al cambiar de carpeta.',
            },
            excludedNotes: {
                name: 'Notas excluidas',
                desc: 'Lista de propiedades del frontmatter separadas por comas. Las notas que contengan cualquiera de estas propiedades se ocultarán (ej.: draft, private, archived).',
                placeholder: 'draft, private',
            },
            excludedFolders: {
                name: 'Carpetas excluidas',
                desc: 'Lista de carpetas a ocultar separadas por comas. Admite comodines: assets* (empieza con), *_temp (termina con).',
                placeholder: 'templates, assets*, *_temp',
            },
            showDate: {
                name: 'Mostrar fecha',
                desc: 'Muestra la fecha debajo de los nombres de las notas.',
            },
            dateFormat: {
                name: 'Formato de fecha',
                desc: 'Formato para mostrar fechas (usa formato date-fns).',
                placeholder: 'd \'de\' MMMM \'de\' yyyy',
                help: 'Formatos comunes:\nd \'de\' MMMM \'de\' yyyy = 25 de mayo de 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = año\nMMMM/MMM/MM = mes\ndd/d = día\nEEEE/EEE = día de la semana',
                helpTooltip: 'Clic para referencia de formato',
            },
            timeFormat: {
                name: 'Formato de hora',
                desc: 'Formato para mostrar horas en los grupos Hoy y Ayer (usa formato date-fns).',
                placeholder: 'HH:mm',
                help: 'Formatos comunes:\nHH:mm = 14:30 (24 horas)\nh:mm a = 2:30 PM (12 horas)\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nTokens:\nHH/H = 24 horas\nhh/h = 12 horas\nmm = minutos\nss = segundos\na = AM/PM',
                helpTooltip: 'Clic para referencia de formato',
            },
            showFilePreview: {
                name: 'Mostrar vista previa de nota',
                desc: 'Muestra texto de vista previa debajo de los nombres de las notas.',
            },
            skipHeadingsInPreview: {
                name: 'Omitir encabezados en vista previa',
                desc: 'Omite las líneas de encabezado al generar el texto de vista previa.',
            },
            skipNonTextInPreview: {
                name: 'Omitir elementos no textuales en vista previa',
                desc: 'Omite imágenes, incrustaciones y otros elementos no textuales del texto de vista previa.',
            },
            previewRows: {
                name: 'Filas de vista previa',
                desc: 'Número de filas a mostrar para el texto de vista previa.',
                options: {
                    '1': '1 fila',
                    '2': '2 filas',
                    '3': '3 filas',
                    '4': '4 filas',
                    '5': '5 filas',
                },
            },
            fileNameRows: {
                name: 'Filas de título',
                desc: 'Número de filas a mostrar para los títulos de las notas.',
                options: {
                    '1': '1 fila',
                    '2': '2 filas',
                },
            },
            showFeatureImage: {
                name: 'Mostrar imagen destacada',
                desc: 'Muestra imágenes en miniatura desde el frontmatter. Consejo: Usa el plugin "Featured Image" para establecer automáticamente imágenes destacadas para todos tus documentos.',
            },
            featureImageProperty: {
                name: 'Propiedad de imagen destacada',
                desc: 'El nombre de la propiedad del frontmatter para las imágenes en miniatura. ¡Importante! En el plugin Featured Image puedes elegir crear miniaturas redimensionadas, ¡esto mejorará significativamente el rendimiento! Usa 42 píxeles para máximo rendimiento, o 84 píxeles para pantallas retina. La propiedad redimensionada se llama "featureResized" por defecto.',
                placeholder: 'feature',
            },
            showRootFolder: {
                name: 'Mostrar carpeta raíz',
                desc: 'Muestra "Bóveda" como la carpeta raíz en el árbol.',
            },
            showFolderFileCount: {
                name: 'Mostrar conteo de notas en carpetas',
                desc: 'Muestra el número de notas en cada carpeta.',
            },
            showFolderIcons: {
                name: 'Mostrar iconos de carpetas',
                desc: 'Muestra iconos junto a los nombres de las carpetas en el árbol.',
            },
            showTags: {
                name: 'Mostrar etiquetas',
                desc: 'Muestra la sección de etiquetas debajo de las carpetas en el navegador.',
            },
            showUntagged: {
                name: 'Mostrar notas sin etiquetas',
                desc: 'Muestra el elemento "Sin etiquetas" para notas sin ninguna etiqueta.',
            },
            confirmBeforeDelete: {
                name: 'Confirmar antes de eliminar notas',
                desc: 'Muestra un diálogo de confirmación al eliminar notas o carpetas',
            },
            supportDevelopment: {
                name: 'Apoyar el desarrollo',
                desc: 'Si te encanta usar el Navegador de Cuadernos, considera apoyar su desarrollo continuo.',
                buttonText: '❤️ Patrocinar en GitHub',
            },
        },
    },
};