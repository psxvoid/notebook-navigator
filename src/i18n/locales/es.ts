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
        collapseAllFolders: 'Contraer todo', // Tooltip for button that collapses all expanded items (English: Collapse all)
        expandAllFolders: 'Expandir todo', // Tooltip for button that expands all items (English: Expand all)
        newFolder: 'Nueva carpeta', // Tooltip for create new folder button (English: New folder)
        newNote: 'Nueva nota', // Tooltip for create new note button (English: New note)
        mobileBackToFolders: 'Volver a carpetas', // Mobile-only back button text to return to folder list (English: Back to folders)
        changeSortOrder: 'Cambiar orden de clasificación', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Predeterminado', // Label for default sorting mode (English: Default)
        customSort: 'Personalizado', // Label for custom sorting mode (English: Custom)
        showFolders: 'Mostrar navegación', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'Ocultar navegación', // Tooltip for button to hide the navigation pane (English: Hide navigation)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Abrir en nueva pestaña',
            openToRight: 'Abrir a la derecha',
            openInNewWindow: 'Abrir en nueva ventana',
            openMultipleInNewTabs: 'Abrir {count} notas en nuevas pestañas',
            openMultipleToRight: 'Abrir {count} notas a la derecha',
            openMultipleInNewWindows: 'Abrir {count} notas en nuevas ventanas',
            pinNote: 'Fijar nota',
            unpinNote: 'Desfijar nota',
            pinMultipleNotes: 'Fijar {count} notas',
            unpinMultipleNotes: 'Desfijar {count} notas',
            duplicateNote: 'Duplicar nota',
            duplicateMultipleNotes: 'Duplicar {count} notas',
            openVersionHistory: 'Abrir historial de versiones',
            revealInFinder: 'Mostrar en Finder',
            showInExplorer: 'Mostrar en el explorador del sistema',
            copyDeepLink: 'Copiar enlace profundo',
            renameNote: 'Renombrar nota',
            deleteNote: 'Eliminar nota',
            deleteMultipleNotes: 'Eliminar {count} notas',
        },
        folder: {
            newNote: 'Nueva nota',
            newFolder: 'Nueva carpeta',
            newCanvas: 'Nuevo lienzo',
            newBase: 'Nueva base de datos',
            newDrawing: 'Nuevo dibujo',
            duplicateFolder: 'Duplicar carpeta',
            searchInFolder: 'Buscar en carpeta',
            createFolderNote: 'Crear nota de carpeta',
            deleteFolderNote: 'Eliminar nota de carpeta',
            changeIcon: 'Cambiar icono',
            removeIcon: 'Quitar icono',
            changeColor: 'Cambiar color',
            removeColor: 'Quitar color',
            renameFolder: 'Renombrar carpeta',
            deleteFolder: 'Eliminar carpeta',
        },
        tag: {
            changeIcon: 'Cambiar icono',
            removeIcon: 'Quitar icono',
            changeColor: 'Cambiar color',
            removeColor: 'Quitar color',
            renameTag: 'Renombrar etiqueta',
            deleteTag: 'Eliminar etiqueta',
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
        tagOperation: {
            renameTitle: 'Renombrar etiqueta',
            deleteTitle: 'Eliminar etiqueta',
            newTagPrompt: 'Introduce el nuevo nombre de la etiqueta:',
            newTagPlaceholder: 'nuevo-nombre',
            renameWarning: 'Esto renombrará la etiqueta en todas las notas afectadas.',
            deleteWarning: 'Esto eliminará la etiqueta de todas las notas afectadas.',
            modificationWarning: 'Modificación de etiqueta',
            affectedFiles: '{count} archivo(s) afectado(s)',
            andMore: 'y {count} más...',
            confirmRename: 'Renombrar etiqueta',
            confirmDelete: 'Eliminar etiqueta',
            file: 'archivo',
            files: 'archivos',
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
            folderNoteAlreadyExists: 'La nota de carpeta ya existe',
            failedToDeleteFile: 'Error al eliminar {name}: {error}',
            drawingAlreadyExists: 'Ya existe un dibujo con este nombre',
            failedToCreateDrawing: 'Error al crear el dibujo',
            renameTag: 'Error al renombrar la etiqueta: {error}',
            deleteTag: 'Error al eliminar la etiqueta: {error}',
            tagAlreadyExists: 'Ya existe una etiqueta con este nombre',
        },
        notifications: {
            deletedMultipleFiles: '{count} archivos eliminados',
            deepLinkCopied: 'Enlace profundo copiado al portapapeles',
            tagRenamed: 'Etiqueta renombrada exitosamente',
            tagDeleted: 'Etiqueta eliminada exitosamente',
        },
        confirmations: {
            deleteMultipleFiles: '¿Está seguro de que desea eliminar {count} archivos?',
            deleteConfirmation: 'Esta acción no se puede deshacer.',
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
        notifications: {
            movedMultipleFiles: '{count} archivos movidos',
            filesAlreadyExist: '{count} archivos ya existen en el destino',
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
        toggleNavigationPane: 'Alternar panel de navegación', // Command palette: Toggles the visibility of the navigation pane (English: Toggle navigation pane)
    },

    // Plugin UI
    plugin: {
        viewName: 'Navegador de Cuadernos', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Navegador de Cuadernos', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Mostrar en el Navegador de Cuadernos', // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Última modificación',
        createdAt: 'Creado el',
        file: 'archivo',
        files: 'archivos',
        folder: 'carpeta',
        folders: 'carpetas',
    },

    // Settings
    settings: {
        sections: {
            timeDisplay: 'Visualización de tiempo',
            noteDisplay: 'Visualización de notas',
            folderDisplay: 'Visualización de carpetas',
            tagDisplay: 'Visualización de etiquetas',
            folderNotes: 'Notas de carpeta',
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
            showSubfolderNamesInList: {
                name: 'Mostrar nombres de carpetas principales',
                desc: 'Muestra el nombre de la carpeta principal para las notas de subcarpetas.',
            },
            autoRevealActiveNote: {
                name: 'Mostrar automáticamente la nota activa',
                desc: 'Muestra y selecciona automáticamente las notas cuando se abren desde el Conmutador rápido, enlaces o búsqueda.',
            },
            autoSelectFirstFile: {
                name: 'Seleccionar automáticamente el primer archivo al cambiar de carpeta',
                desc: 'Selecciona y abre automáticamente el primer archivo al cambiar de carpeta.',
            },
            showTooltips: {
                name: 'Mostrar tooltips',
                desc: 'Muestra tooltips con información adicional para archivos y carpetas al pasar el cursor.',
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
            collapseButtonBehavior: {
                name: 'Comportamiento del botón contraer',
                desc: 'Elige qué afecta el botón de expandir/contraer todo.',
                options: {
                    all: 'Todas las carpetas y etiquetas',
                    foldersOnly: 'Solo carpetas',
                    tagsOnly: 'Solo etiquetas',
                },
            },
            showTags: {
                name: 'Mostrar etiquetas',
                desc: 'Muestra la sección de etiquetas debajo de las carpetas en el navegador.',
            },
            showUntagged: {
                name: 'Mostrar notas sin etiquetas',
                desc: 'Muestra el elemento "Sin etiquetas" para notas sin ninguna etiqueta.',
            },
            enableFolderNotes: {
                name: 'Habilitar notas de carpeta',
                desc: 'Cuando está habilitado, las carpetas con notas asociadas se muestran como enlaces clicables.',
            },
            folderNoteName: {
                name: 'Nombre de la nota de carpeta',
                desc: 'Nombre del archivo de nota de carpeta. Dejar vacío para usar el mismo nombre que la carpeta.',
                placeholder: 'Dejar vacío para el nombre de la carpeta',
            },
            hideFolderNoteInList: {
                name: 'Ocultar notas de carpeta en la lista de archivos',
                desc: 'Ocultar la nota de carpeta para que no aparezca en la lista de archivos de la carpeta.',
            },
            confirmBeforeDelete: {
                name: 'Confirmar antes de eliminar notas',
                desc: 'Muestra un diálogo de confirmación al eliminar notas o carpetas',
            },
            useFrontmatterDates: {
                name: 'Leer metadatos del frontmatter',
                desc: 'Leer nombres de notas y marcas de tiempo del frontmatter cuando estén disponibles, usando valores del sistema como respaldo',
            },
            frontmatterNameField: {
                name: 'Campo de nombre',
                desc: 'Campo del frontmatter para usar como nombre de la nota. Dejar vacío para usar el nombre del archivo.',
                placeholder: 'title',
            },
            frontmatterCreatedField: {
                name: 'Campo de marca de tiempo de creación',
                desc: 'Nombre del campo del frontmatter para la marca de tiempo de creación. Dejar vacío para usar solo la fecha del sistema.',
                placeholder: 'created',
            },
            frontmatterModifiedField: {
                name: 'Campo de marca de tiempo de modificación',
                desc: 'Nombre del campo del frontmatter para la marca de tiempo de modificación. Dejar vacío para usar solo la fecha del sistema.',
                placeholder: 'modified',
            },
            frontmatterDateFormat: {
                name: 'Formato de marca de tiempo',
                desc: 'Formato utilizado para analizar marcas de tiempo en el frontmatter',
                placeholder: "yyyy-MM-dd'T'HH:mm:ss",
                helpTooltip: 'Ver documentación de formato date-fns',
                help: 'Formatos comunes:\nyyyy-MM-dd\'T\'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM',
            },
            supportDevelopment: {
                name: 'Apoyar el desarrollo',
                desc: 'Si te encanta usar el Navegador de Cuadernos, considera apoyar su desarrollo continuo.',
                buttonText: '❤️ Patrocinar en GitHub',
            },
        },
    },
};