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
export const STRINGS_ZH = {
    // Common UI elements
    common: {
        cancel: '取消', // Button text for canceling dialogs and operations (English: Cancel)
        delete: '删除', // Button text for delete operations in dialogs (English: Delete)
        submit: '提交', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: '未选择', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: '无标签', // Label for notes without any tags (English: Untagged)
        untitled: '无标题', // Default name for notes without a title (English: Untitled)
        featureImageAlt: '特色图片', // Alt text for thumbnail/preview images (English: Feature image)
    },

    // File list
    fileList: {
        emptyStateNoSelection: '选择文件夹或标签以查看笔记', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: '无笔记', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 已固定', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
    },

    // Folder tree
    folderTree: {
        rootFolderName: '仓库', // Display name for the vault root folder in the tree (English: Vault)
    },

    // Tag list
    tagList: {
        untaggedLabel: '无标签', // Label for the special item showing notes without tags (English: Untagged)
        favoriteTags: '收藏', // Label for the favorites virtual folder (English: Favorites)
        hiddenTags: '隐藏标签', // Label for the hidden tags virtual folder (English: Hidden tags)
        allTags: '标签', // Label for the tags virtual folder when favorites exist (English: Tags)
        tags: '标签', // Label for the tags virtual folder when no favorites exist (English: Tags)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: '全部折叠', // Tooltip for button that collapses all expanded items (English: Collapse all)
        expandAllFolders: '全部展开', // Tooltip for button that expands all items (English: Expand all)
        newFolder: '新建文件夹', // Tooltip for create new folder button (English: New folder)
        newNote: '创建新笔记', // Tooltip for create new note button (English: Create new note)
        mobileBackToFolders: '返回文件夹', // Mobile-only back button text to return to folder list (English: Back to folders)
        changeSortOrder: '更改排序方式', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: '默认', // Label for default sorting mode (English: Default)
        customSort: '自定义', // Label for custom sorting mode (English: Custom)
        showFolders: '显示导航', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: '隐藏导航', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        toggleSubfolders: '显示子文件夹中的笔记', // Tooltip for button to toggle showing notes from subfolders (English: Show notes from subfolders)
        autoExpandFoldersTags: '自动展开文件夹和标签', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: '在新标签页中打开',
            openToRight: '在右侧打开',
            openInNewWindow: '在新窗口中打开',
            openMultipleInNewTabs: '在新标签页中打开 {count} 个笔记',
            openMultipleToRight: '在右侧打开 {count} 个笔记',
            openMultipleInNewWindows: '在新窗口中打开 {count} 个笔记',
            pinNote: '固定笔记',
            unpinNote: '取消固定笔记',
            pinMultipleNotes: '固定 {count} 个笔记',
            unpinMultipleNotes: '取消固定 {count} 个笔记',
            duplicateNote: '复制笔记',
            duplicateMultipleNotes: '复制 {count} 个笔记',
            openVersionHistory: '打开版本历史',
            revealInFinder: '在访达中显示',
            showInExplorer: '在系统资源管理器中显示',
            copyDeepLink: '复制深层链接',
            renameNote: '重命名笔记',
            deleteNote: '删除笔记',
            deleteMultipleNotes: '删除 {count} 个笔记',
        },
        folder: {
            newNote: '创建新笔记',
            newFolder: '新建文件夹',
            newCanvas: '新建画布',
            newBase: '新建数据库',
            newDrawing: '新建绘图',
            duplicateFolder: '复制文件夹',
            searchInFolder: '在文件夹中搜索',
            createFolderNote: '创建文件夹笔记',
            deleteFolderNote: '删除文件夹笔记',
            changeIcon: '更改图标',
            removeIcon: '移除图标',
            changeColor: '更改颜色',
            removeColor: '移除颜色',
            renameFolder: '重命名文件夹',
            deleteFolder: '删除文件夹',
        },
        tag: {
            changeIcon: '更改图标',
            removeIcon: '移除图标',
            changeColor: '更改颜色',
            removeColor: '移除颜色',
        },
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: '搜索图标...',
            recentlyUsedHeader: '最近使用',
            emptyStateSearch: '开始输入以搜索图标',
            emptyStateNoResults: '未找到图标',
            showingResultsInfo: '显示 {count} 个结果中的 50 个。输入更多内容以缩小范围。',
        },
        colorPicker: {
            header: '选择文件夹颜色',
            colors: {
                red: '红色',
                orange: '橙色',
                amber: '琥珀色',
                yellow: '黄色',
                lime: '青柠色',
                green: '绿色',
                emerald: '翡翠色',
                teal: '青绿色',
                cyan: '青色',
                sky: '天蓝色',
                blue: '蓝色',
                indigo: '靛蓝色',
                violet: '紫罗兰色',
                purple: '紫色',
                fuchsia: '品红色',
                pink: '粉色',
                rose: '玫瑰色',
                gray: '灰色',
                slate: '石板色',
                stone: '石灰色',
            },
        },
        tagOperation: {
            renameTitle: '重命名标签',
            deleteTitle: '删除标签',
            newTagPrompt: '输入新的标签名称：',
            newTagPlaceholder: '新名称',
            renameWarning: '这将重命名所有受影响笔记中的标签。',
            deleteWarning: '这将从所有受影响笔记中删除标签。',
            modificationWarning: '标签修改',
            affectedFiles: '{count} 个文件受影响',
            andMore: '以及 {count} 个更多...',
            confirmRename: '重命名标签',
            confirmDelete: '删除标签',
            file: '个文件',
            files: '个文件',
        },
        fileSystem: {
            newFolderTitle: '新建文件夹',
            renameFolderTitle: '重命名文件夹',
            renameFileTitle: '重命名文件',
            deleteFolderTitle: '删除 \'{name}\'？',
            deleteFileTitle: '删除 \'{name}\'？',
            folderNamePrompt: '输入文件夹名称：',
            renamePrompt: '输入新名称：',
            deleteFolderConfirm: '您确定要删除此文件夹及其所有内容吗？',
            deleteFileConfirm: '您确定要删除此文件吗？',
        },
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: '创建文件夹失败：{error}',
            createFile: '创建文件失败：{error}',
            renameFolder: '重命名文件夹失败：{error}',
            renameFile: '重命名文件失败：{error}',
            deleteFolder: '删除文件夹失败：{error}',
            deleteFile: '删除文件失败：{error}',
            duplicateNote: '复制笔记失败：{error}',
            createCanvas: '创建画布失败：{error}',
            createDatabase: '创建数据库失败：{error}',
            duplicateFolder: '复制文件夹失败：{error}',
            openVersionHistory: '打开版本历史失败：{error}',
            versionHistoryNotFound: '未找到版本历史命令。请确保已启用 Obsidian 同步。',
            revealInExplorer: '在系统资源管理器中显示文件失败：{error}',
            folderNoteAlreadyExists: '文件夹笔记已存在',
            failedToDeleteFile: '删除 {name} 失败: {error}',
            drawingAlreadyExists: '同名绘图已存在',
            failedToCreateDrawing: '创建绘图失败',
            noFolderSelected: 'Notebook Navigator 中未选择文件夹',
        },
        notifications: {
            deletedMultipleFiles: '已删除 {count} 个文件',
            deepLinkCopied: '深层链接已复制到剪贴板',
        },
        confirmations: {
            deleteMultipleFiles: '确定要删除 {count} 个文件吗？',
            deleteConfirmation: '此操作无法撤销。',
        },
        defaultNames: {
            untitled: '无标题',
            untitledNumber: '无标题 {number}',
        },
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: '无法将文件夹移动到自身或其子文件夹中。',
            itemAlreadyExists: '此位置已存在名为 "{name}" 的项目。',
            failedToMove: '移动失败：{error}',
            failedToAddTag: '添加标签 "{tag}" 失败',
            failedToClearTags: '清除标签失败',
        },
        notifications: {
            filesAlreadyExist: '{count} 个文件在目标位置已存在',
            addedTag: '已将标签 "{tag}" 添加到 {count} 个文件',
            filesAlreadyHaveTag: '{count} 个文件已经有此标签或更具体的标签',
            clearedTags: '已从 {count} 个文件中清除所有标签',
            noTagsToClear: '没有要清除的标签',
        },
    },

    // Date grouping
    dateGroups: {
        today: '今天',
        yesterday: '昨天',
        previous7Days: '过去 7 天',
        previous30Days: '过去 30 天',
    },

    // Weekdays
    weekdays: {
        sunday: '星期日',
        monday: '星期一',
        tuesday: '星期二',
        wednesday: '星期三',
        thursday: '星期四',
        friday: '星期五',
        saturday: '星期六',
    },

    // Plugin commands
    commands: {
        open: '打开', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealFile: '显示文件', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        focusFile: '聚焦文件', // Command palette: Moves keyboard focus to the file list pane (English: Focus file)
        toggleNavigationPane: '切换导航面板', // Command palette: Toggles the visibility of the navigation pane (English: Toggle navigation pane)
        deleteFile: '删除文件', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: '创建新笔记', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        toggleSubfolders: '切换显示子文件夹中的笔记', // Command palette: Toggles showing notes from subfolders (English: Toggle show notes from subfolders)
    },

    // Plugin UI
    plugin: {
        viewName: '笔记本导航器', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: '笔记本导航器', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: '在笔记本导航器中显示', // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: '最后修改于',
        createdAt: '创建于',
        file: '个文件',
        files: '个文件',
        folder: '个文件夹',
        folders: '个文件夹',
    },

    // Settings
    settings: {
        sections: {
            notes: '笔记显示',
            navigationPane: '文件夹显示',
            tags: '标签显示',
            folders: '文件夹笔记',
            listPane: '列表窗格',
            advanced: '高级',
        },
        items: {
            sortNotesBy: {
                name: '笔记排序方式',
                desc: '选择笔记列表中的笔记排序方式。',
                options: {
                    'modified-desc': '编辑日期（最新优先）',
                    'modified-asc': '编辑日期（最旧优先）',
                    'created-desc': '创建日期（最新优先）',
                    'created-asc': '创建日期（最旧优先）',
                    'title-asc': '标题（A 优先）',
                    'title-desc': '标题（Z 优先）',
                },
            },
            groupByDate: {
                name: '按日期分组笔记',
                desc: '按日期排序时，在日期标题下分组笔记。',
            },
            showNotesFromSubfolders: {
                name: '显示子文件夹中的笔记',
                desc: '在当前文件夹视图中显示所有子文件夹中的笔记。',
            },
            showParentFolderNames: {
                name: '显示父文件夹名称',
                desc: '为子文件夹中的笔记显示父文件夹名称。',
            },
            autoRevealActiveNote: {
                name: '自动定位活动笔记',
                desc: '从快速切换器、链接或搜索打开笔记时自动显示并选择。',
            },
            autoSelectFirstFileOnFocusChange: {
                name: '切换文件夹或标签时自动选择第一个笔记',
                desc: '切换文件夹或标签时自动选择并打开第一个笔记。',
            },
            autoExpandFoldersTags: {
                name: '自动展开文件夹和标签',
                desc: '选择文件夹和标签时自动展开它们。',
            },
            showTooltips: {
                name: '显示工具提示',
                desc: '悬停时显示笔记和文件夹的额外信息工具提示。',
            },
            excludedNotes: {
                name: '排除的笔记',
                desc: '逗号分隔的前置元数据属性列表。包含任何这些属性的笔记将被隐藏（例如：draft, private, archived）。',
                placeholder: 'draft, private',
            },
            excludedFolders: {
                name: '排除的文件夹',
                desc: '逗号分隔的要隐藏的文件夹列表。支持通配符：assets*（以...开头），*_temp（以...结尾）。',
                placeholder: 'templates, assets*, *_temp',
            },
            fileVisibility: {
                name: '显示文件类型',
                desc: '选择在导航器中显示哪些文件类型。Obsidian不支持的文件将在系统默认应用程序中打开。',
                options: {
                    markdownOnly: '仅 Markdown',
                    supported: '支持的文件',
                    all: '所有文件',
                },
            },
            showDate: {
                name: '显示日期',
                desc: '在笔记名称下方显示日期。',
            },
            dateFormat: {
                name: '日期格式',
                desc: '用于显示日期的格式（使用 date-fns 格式）。',
                placeholder: 'yyyy年M月d日',
                help: '常用格式：\nyyyy年M月d日 = 2022年5月25日\nyyyy-MM-dd = 2022-05-25\nMM/dd/yyyy = 05/25/2022\n\n标记：\nyyyy/yy = 年\nMMMM/MMM/MM/M = 月\ndd/d = 日\nEEEE/EEE = 星期',
                helpTooltip: '点击查看格式参考',
            },
            timeFormat: {
                name: '时间格式',
                desc: '用于显示时间的格式（使用 date-fns 格式）。',
                placeholder: 'HH:mm',
                help: '常用格式：\nHH:mm = 14:30（24小时制）\nh:mm a = 2:30 PM（12小时制）\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\n标记：\nHH/H = 24小时制\nhh/h = 12小时制\nmm = 分钟\nss = 秒\na = 上午/下午',
                helpTooltip: '点击查看格式参考',
            },
            showFilePreview: {
                name: '显示笔记预览',
                desc: '在笔记名称下方显示预览文本。',
            },
            skipHeadingsInPreview: {
                name: '预览中跳过标题',
                desc: '生成预览文本时跳过标题行。',
            },
            skipNonTextInPreview: {
                name: '预览中跳过非文本',
                desc: '从预览文本中跳过图片、嵌入和其他非文本元素。',
            },
            previewRows: {
                name: '预览行数',
                desc: '预览文本显示的行数。',
                options: {
                    '1': '1 行',
                    '2': '2 行',
                    '3': '3 行',
                    '4': '4 行',
                    '5': '5 行',
                },
            },
            fileNameRows: {
                name: '标题行数',
                desc: '笔记标题显示的行数。',
                options: {
                    '1': '1 行',
                    '2': '2 行',
                },
            },
            showFeatureImage: {
                name: '显示特色图片',
                desc: '从前置元数据显示缩略图。提示：使用"Featured Image"插件自动为所有文档设置特色图片。',
            },
            featureImageProperties: {
                name: '图片属性',
                desc: '用于缩略图的前置元数据属性的逗号分隔列表。将使用第一个包含图片的属性。',
                tip: '使用"Featured Image"插件自动设置图片。为获得最佳性能，请使用 42px 缩略图或 84px 用于视网膜显示器。',
                placeholder: 'featureResized, feature',
                embedFallback: '如果在上述属性中未找到图片，将使用文档中的第一个嵌入图片（需要 Obsidian 1.9.4+）',
            },
            showRootFolder: {
                name: '显示根文件夹',
                desc: '在树中显示"仓库"作为根文件夹。',
            },
            showNoteCount: {
                name: '显示笔记数',
                desc: '显示每个文件夹和标签中的笔记数量。',
            },
            showIcons: {
                name: '显示图标',
                desc: '在导航面板中的文件夹和标签旁显示图标。',
            },
            collapseButtonBehavior: {
                name: '折叠按钮行为',
                desc: '选择展开/折叠全部按钮影响的内容。',
                options: {
                    all: '所有文件夹和标签',
                    foldersOnly: '仅文件夹',
                    tagsOnly: '仅标签',
                },
            },
            showTags: {
                name: '显示标签',
                desc: '在导航器中的文件夹下方显示标签部分。',
            },
            showTagsAboveFolders: {
                name: '在文件夹上方显示标签',
                desc: '在导航器中的文件夹之前显示标签部分。',
            },
            showFavoriteTagsFolder: {
                name: '显示收藏文件夹',
                desc: '当配置了收藏标签时，将"收藏"显示为可折叠文件夹。',
            },
            showAllTagsFolder: {
                name: '显示标签文件夹',
                desc: '在可折叠文件夹中显示"标签"。',
            },
            showUntagged: {
                name: '显示无标签笔记',
                desc: '为没有任何标签的笔记显示"无标签"项目。',
            },
            showUntaggedInFavorites: {
                name: '在收藏部分显示无标签笔记',
                desc: '在收藏部分显示无标签笔记，可以在文件夹内或直接在收藏下方显示。',
            },
            favoriteTags: {
                name: '收藏标签',
                desc: '收藏标签模式的逗号分隔列表。支持精确匹配、通配符（*）和正则表达式（/模式/）。',
                placeholder: '收件箱, 项目-*, /^日记-\\d{4}/',
            },
            hiddenTags: {
                name: '隐藏标签',
                desc: '要从标签树中隐藏的标签模式逗号分隔列表。支持精确匹配、通配符（*）和正则表达式（/模式/）。',
                placeholder: '内部, 临时-*, /^归档-\\d{4}/',
            },
            enableFolderNotes: {
                name: '启用文件夹笔记',
                desc: '启用后，具有关联笔记的文件夹将显示为可点击的链接。',
            },
            folderNoteName: {
                name: '文件夹笔记名称',
                desc: '文件夹笔记的名称。留空以使用与文件夹相同的名称。',
                placeholder: '留空以使用文件夹名称',
            },
            hideFolderNoteInList: {
                name: '在列表中隐藏文件夹笔记',
                desc: '隐藏文件夹笔记，使其不出现在文件夹的笔记列表中。',
            },
            confirmBeforeDelete: {
                name: '删除前确认',
                desc: '删除笔记或文件夹时显示确认对话框',
            },
            useFrontmatterDates: {
                name: '从前言读取元数据',
                desc: '如果可用，从前言读取笔记名称和时间戳，否则使用文件系统值',
            },
            frontmatterNameField: {
                name: '名称字段',
                desc: '用作笔记显示名称的前言字段。留空使用文件名。',
                placeholder: 'title',
            },
            frontmatterCreatedField: {
                name: '创建时间戳字段',
                desc: '创建时间戳的前言字段名称。留空仅使用文件系统日期。',
                placeholder: 'created',
            },
            frontmatterModifiedField: {
                name: '修改时间戳字段',
                desc: '修改时间戳的前言字段名称。留空仅使用文件系统日期。',
                placeholder: 'modified',
            },
            frontmatterDateFormat: {
                name: '时间戳格式',
                desc: '用于解析前言中时间戳的格式',
                placeholder: "yyyy-MM-dd'T'HH:mm:ss",
                helpTooltip: '查看 date-fns 格式文档',
                help: '常用格式:\nyyyy-MM-dd\'T\'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM',
            },
            supportDevelopment: {
                name: '支持开发',
                desc: '如果您喜欢使用笔记本导航器，请考虑支持其持续开发。',
                buttonText: '❤️ 在 GitHub 上赞助',
            },
        },
    },
};