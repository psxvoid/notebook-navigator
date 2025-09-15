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
export const STRINGS_JA = {
    // Common UI elements
    common: {
        cancel: 'キャンセル', // Button text for canceling dialogs and operations (English: Cancel)
        delete: '削除', // Button text for delete operations in dialogs (English: Delete)
        remove: '削除', // Button text for remove operations in dialogs (English: Remove)
        submit: '送信', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: '選択なし', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'タグなし', // Label for notes without any tags (English: Untagged)
        untitled: '無題', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'アイキャッチ画像', // Alt text for thumbnail/preview images (English: Feature image)
        unknownError: '不明なエラー' // Generic fallback when an error has no message (English: Unknown error)
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'フォルダまたはタグを選択してノートを表示', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'ノートなし', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 ピン留め', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
        notesSection: 'ノート', // Header shown between pinned and regular items when showing documents only (English: Notes)
        filesSection: 'ファイル' // Header shown between pinned and regular items when showing supported or all files (English: Files)
    },

    // Tag list
    tagList: {
        untaggedLabel: 'タグなし', // Label for the special item showing notes without tags (English: Untagged)
        favoriteTags: 'お気に入り', // Label for the favorites virtual folder (English: Favorites)
        hiddenTags: '非表示タグ', // Label for the hidden tags virtual folder (English: Hidden tags)
        allTags: 'タグ', // Label for the tags virtual folder when favorites exist (English: Tags)
        tags: 'タグ' // Label for the tags virtual folder when no favorites exist (English: Tags)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'アイテムを折りたたむ', // Tooltip for button that collapses expanded items (English: Collapse items)
        expandAllFolders: 'すべてのアイテムを展開', // Tooltip for button that expands all items (English: Expand all items)
        newFolder: '新規フォルダ', // Tooltip for create new folder button (English: New folder)
        newNote: '新規ノート', // Tooltip for create new note button (English: New note)
        mobileBackToNavigation: 'ナビゲーションに戻る', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: '並び順を変更', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'デフォルト', // Label for default sorting mode (English: Default)
        customSort: 'カスタム', // Label for custom sorting mode (English: Custom)
        showFolders: 'ナビゲーションを表示', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'ナビゲーションを非表示', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        toggleDescendantNotes: '子孫のノートを表示（フォルダとタグ）', // Tooltip for button to toggle showing notes from descendants (English: Show notes from descendants (folders and tags))
        autoExpandFoldersTags: 'フォルダとタグを自動展開', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showExcludedItems: '非表示項目を表示', // Tooltip for button to show hidden items (English: Show hidden items)
        hideExcludedItems: '非表示項目を隠す', // Tooltip for button to hide hidden items (English: Hide hidden items)
        showDualPane: 'デュアルペインを表示', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: 'シングルペインを表示', // Tooltip for button to show single-pane layout (English: Show single pane)
        changeAppearance: '外観を変更', // Tooltip for button to change folder appearance settings (English: Change appearance)
        search: '検索' // Tooltip for search button (English: Search)
    },
    // Search input
    searchInput: {
        placeholder: '検索...', // Placeholder text for search input (English: Search...)
        clearSearch: '検索をクリア' // Tooltip for clear search button (English: Clear search)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: '新しいタブで開く',
            openToRight: '右側で開く',
            openInNewWindow: '新しいウィンドウで開く',
            openMultipleInNewTabs: '{count}個のノートを新しいタブで開く',
            openMultipleToRight: '{count}個のノートを右側で開く',
            openMultipleInNewWindows: '{count}個のノートを新しいウィンドウで開く',
            pinNote: 'ノートをピン留め',
            unpinNote: 'ピン留めを解除',
            pinMultipleNotes: '{count}個のノートをピン留め',
            unpinMultipleNotes: '{count}個のノートのピン留めを解除',
            duplicateNote: 'ノートを複製',
            duplicateMultipleNotes: '{count}個のノートを複製',
            openVersionHistory: 'バージョン履歴を開く',
            revealInFolder: 'フォルダで表示',
            revealInFinder: 'Finderで表示',
            showInExplorer: 'システムエクスプローラーで表示',
            copyDeepLink: 'ディープリンクをコピー',
            renameNote: 'ノートの名前を変更',
            deleteNote: 'ノートを削除',
            deleteMultipleNotes: '{count}個のノートを削除',
            moveToFolder: '移動先...',
            moveMultipleToFolder: '{count}個のファイルを移動先...',
            addTag: 'タグを追加',
            removeTag: 'タグを削除',
            removeAllTags: 'すべてのタグを削除',
            // File-specific context menu items (non-markdown files)
            openMultipleFilesInNewTabs: '{count}個のファイルを新しいタブで開く',
            openMultipleFilesToRight: '{count}個のファイルを右側で開く',
            openMultipleFilesInNewWindows: '{count}個のファイルを新しいウィンドウで開く',
            pinFile: 'ファイルをピン留め',
            unpinFile: 'ピン留めを解除',
            pinMultipleFiles: '{count}個のファイルをピン留め',
            unpinMultipleFiles: '{count}個のファイルのピン留めを解除',
            duplicateFile: 'ファイルを複製',
            duplicateMultipleFiles: '{count}個のファイルを複製',
            renameFile: 'ファイルの名前を変更',
            deleteFile: 'ファイルを削除',
            deleteMultipleFiles: '{count}個のファイルを削除'
        },
        folder: {
            newNote: '新規ノート',
            newFolder: '新規フォルダ',
            newCanvas: '新規キャンバス',
            newBase: '新規データベース',
            newDrawing: '新規図面',
            duplicateFolder: 'フォルダを複製',
            searchInFolder: 'フォルダ内を検索',
            createFolderNote: 'フォルダノートを作成',
            deleteFolderNote: 'フォルダーノートを削除',
            changeIcon: 'アイコンを変更',
            removeIcon: 'アイコンを削除',
            changeColor: '色を変更',
            removeColor: '色を削除',
            excludeFolder: 'フォルダを非表示',
            renameFolder: 'フォルダの名前を変更',
            deleteFolder: 'フォルダを削除'
        },
        tag: {
            changeIcon: 'アイコンを変更',
            removeIcon: 'アイコンを削除',
            changeColor: '色を変更',
            removeColor: '色を削除',
            addToFavorites: 'お気に入りに追加',
            removeFromFavorites: 'お気に入りから削除',
            hideTag: 'タグを非表示'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: 'デフォルトの外観',
        slimPreset: 'スリム（日付/プレビュー/画像なし）',
        titleRows: 'タイトル行数',
        previewRows: 'プレビュー行数',
        defaultOption: (rows: number) => `デフォルト (${rows})`,
        defaultTitleOption: (rows: number) => `デフォルトタイトル行数 (${rows})`,
        defaultPreviewOption: (rows: number) => `デフォルトプレビュー行数 (${rows})`,
        titleRowOption: (rows: number) => `タイトル${rows}行`,
        previewRowOption: (rows: number) => `プレビュー${rows}行`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'アイコンを検索...',
            recentlyUsedHeader: '最近使用したアイコン',
            emptyStateSearch: '入力してアイコンを検索',
            emptyStateNoResults: 'アイコンが見つかりません',
            showingResultsInfo: '{count}件中50件を表示中。絞り込むには続けて入力してください。',
            emojiInstructions: '絵文字を入力または貼り付けてアイコンとして使用'
        },
        colorPicker: {
            currentColor: '現在',
            newColor: '新規',
            presetColors: 'プリセット色',
            recentColors: '最近使用した色',
            clearRecentColors: '最近使用した色をクリア',
            apply: '適用',
            hexLabel: 'HEX',
            rgbLabel: 'RGB',
            colors: {
                red: '赤',
                orange: 'オレンジ',
                amber: '琥珀',
                yellow: '黄',
                lime: 'ライム',
                green: '緑',
                emerald: 'エメラルド',
                teal: 'ティール',
                cyan: 'シアン',
                sky: 'スカイ',
                blue: '青',
                indigo: '藍',
                violet: 'バイオレット',
                purple: '紫',
                fuchsia: 'フクシア',
                pink: 'ピンク',
                rose: 'ローズ',
                gray: 'グレー',
                slate: 'スレート',
                stone: 'ストーン'
            }
        },
        tagOperation: {
            renameTitle: 'タグの名前を変更',
            deleteTitle: 'タグを削除',
            newTagPrompt: '新しいタグ名を入力：',
            newTagPlaceholder: '新しい名前',
            renameWarning: 'これにより、影響を受けるすべてのノートでタグが名前変更されます。',
            deleteWarning: 'これにより、影響を受けるすべてのノートからタグが削除されます。',
            modificationWarning: 'タグの変更',
            affectedFiles: '{count}個のファイルが影響を受けます',
            andMore: 'さらに{count}個...',
            confirmRename: 'タグを名前変更',
            confirmDelete: 'タグを削除',
            file: 'ファイル',
            files: 'ファイル'
        },
        fileSystem: {
            newFolderTitle: '新規フォルダ',
            renameFolderTitle: 'フォルダの名前を変更',
            renameFileTitle: 'ファイルの名前を変更',
            deleteFolderTitle: "'{name}'を削除しますか？",
            deleteFileTitle: "'{name}'を削除しますか？",
            folderNamePrompt: 'フォルダ名を入力：',
            renamePrompt: '新しい名前を入力：',
            renameVaultTitle: 'ボールトの表示名を変更',
            renameVaultPrompt: 'カスタム表示名を入力（空にするとデフォルトを使用）：',
            deleteFolderConfirm: 'このフォルダとそのすべての内容を削除してもよろしいですか？',
            deleteFileConfirm: 'このファイルを削除してもよろしいですか？',
            removeAllTagsTitle: 'すべてのタグを削除',
            removeAllTagsFromNote: 'このノートからすべてのタグを削除してもよろしいですか？',
            removeAllTagsFromNotes: '{count}個のノートからすべてのタグを削除してもよろしいですか？'
        },
        folderSuggest: {
            placeholder: 'フォルダに移動...',
            navigatePlaceholder: 'フォルダにナビゲート...',
            instructions: {
                navigate: 'でナビゲート',
                move: 'で移動',
                select: 'で選択',
                dismiss: 'でキャンセル'
            }
        },
        tagSuggest: {
            placeholder: 'タグを検索...',
            navigatePlaceholder: 'タグにナビゲート...',
            addPlaceholder: '追加するタグを検索...',
            removePlaceholder: '削除するタグを選択...',
            createNewTag: '新しいタグを作成: #{tag}',
            instructions: {
                navigate: 'でナビゲート',
                select: 'で選択',
                dismiss: 'でキャンセル',
                add: 'タグを追加',
                remove: 'タグを削除'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'フォルダの作成に失敗しました：{error}',
            createFile: 'ファイルの作成に失敗しました：{error}',
            renameFolder: 'フォルダの名前変更に失敗しました：{error}',
            renameFolderNoteConflict: '名前を変更できません："{name}"はこのフォルダに既に存在します',
            renameFile: 'ファイルの名前変更に失敗しました：{error}',
            deleteFolder: 'フォルダの削除に失敗しました：{error}',
            deleteFile: 'ファイルの削除に失敗しました：{error}',
            duplicateNote: 'ノートの複製に失敗しました：{error}',
            createCanvas: 'キャンバスの作成に失敗しました：{error}',
            createDatabase: 'データベースの作成に失敗しました：{error}',
            duplicateFolder: 'フォルダの複製に失敗しました：{error}',
            openVersionHistory: 'バージョン履歴を開くのに失敗しました：{error}',
            versionHistoryNotFound: 'バージョン履歴コマンドが見つかりません。Obsidian Syncが有効になっていることを確認してください。',
            revealInExplorer: 'システムエクスプローラーでファイルを表示できませんでした：{error}',
            folderNoteAlreadyExists: 'フォルダノートはすでに存在します',
            failedToDeleteFile: '{name}の削除に失敗しました: {error}',
            failedToDeleteMultipleFiles: '{count}個のファイルの削除に失敗しました',
            versionHistoryNotAvailable: 'バージョン履歴サービスが利用できません',
            drawingAlreadyExists: 'この名前の図面が既に存在します',
            failedToCreateDrawing: '図面の作成に失敗しました',
            noFolderSelected: 'Notebook Navigatorでフォルダが選択されていません',
            noFileSelected: 'ファイルが選択されていません'
        },
        notices: {
            excludedFolder: 'フォルダを除外: {name}'
        },
        notifications: {
            deletedMultipleFiles: '{count}個のファイルを削除しました',
            movedMultipleFiles: '{count}個のファイルを{folder}に移動しました',
            folderMoved: 'フォルダ「{name}」を移動しました',
            deepLinkCopied: 'ディープリンクをクリップボードにコピーしました',
            tagAddedToNote: '1個のノートにタグを追加しました',
            tagAddedToNotes: '{count}個のノートにタグを追加しました',
            tagRemovedFromNote: '1個のノートからタグを削除しました',
            tagRemovedFromNotes: '{count}個のノートからタグを削除しました',
            tagsClearedFromNote: '1個のノートからすべてのタグをクリアしました',
            tagsClearedFromNotes: '{count}個のノートからすべてのタグをクリアしました',
            noTagsToRemove: '削除するタグがありません',
            noFilesSelected: 'ファイルが選択されていません',
            tagOperationsNotAvailable: 'タグ操作は利用できません'
        },
        confirmations: {
            deleteMultipleFiles: '本当に{count}個のファイルを削除しますか？',
            deleteConfirmation: 'この操作は元に戻せません。'
        },
        defaultNames: {
            untitled: '無題',
            untitledNumber: '無題 {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'フォルダを自分自身またはそのサブフォルダに移動することはできません。',
            itemAlreadyExists: 'この場所に "{name}" という名前のアイテムがすでに存在します。',
            failedToMove: '移動に失敗しました：{error}',
            failedToAddTag: 'タグ "{tag}" の追加に失敗しました',
            failedToClearTags: 'タグのクリアに失敗しました',
            failedToMoveFolder: 'フォルダ「{name}」の移動に失敗しました',
            foldersCannotHaveTags: 'フォルダにタグを付けることはできません',
            failedToImportFiles: 'Failed to import: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count}個のファイルが移動先に既に存在します',
            addedTag: '{count}個のファイルにタグ "{tag}" を追加しました',
            filesAlreadyHaveTag: '{count}個のファイルには既にこのタグまたはより具体的なタグがあります',
            clearedTags: '{count}個のファイルからすべてのタグをクリアしました',
            noTagsToClear: 'クリアするタグがありません',
            fileImported: 'Imported 1 file',
            filesImported: 'Imported {count} files'
        }
    },

    // Date grouping
    dateGroups: {
        today: '今日',
        yesterday: '昨日',
        previous7Days: '過去7日間',
        previous30Days: '過去30日間'
    },

    // Weekdays
    weekdays: {
        sunday: '日曜日',
        monday: '月曜日',
        tuesday: '火曜日',
        wednesday: '水曜日',
        thursday: '木曜日',
        friday: '金曜日',
        saturday: '土曜日'
    },

    // Plugin commands
    commands: {
        open: '開く', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealFile: 'ファイルを表示', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        search: '検索', // Command palette: Toggle search in the file list (English: Search)
        toggleDualPane: 'デュアルペインレイアウトを切り替え', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: 'ファイルを削除', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: '新規ノートを作成', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: 'ファイルを移動', // Command palette: Move selected files to another folder (English: Move files)
        navigateToFolder: 'フォルダにナビゲート', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: 'タグにナビゲート', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        toggleDescendants: '子孫切り替え', // Command palette: Toggles showing notes from descendants (English: Toggle descendants)
        toggleHidden: '非表示項目を切り替え', // Command palette: Toggles showing hidden items (English: Toggle hidden items)
        collapseExpand: 'すべての項目を折りたたむ/展開', // Command palette: Collapse or expand all folders and tags (English: Collapse / expand all items)
        addTag: '選択したファイルにタグを追加', // Command palette: Opens a dialog to add a tag to selected files (English: Add tag to selected files)
        removeTag: '選択したファイルからタグを削除', // Command palette: Opens a dialog to remove a tag from selected files (English: Remove tag from selected files)
        removeAllTags: '選択したファイルからすべてのタグを削除' // Command palette: Removes all tags from selected files (English: Remove all tags from selected files)
    },

    // Plugin UI
    plugin: {
        viewName: 'ノートブックナビゲーター', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'ノートブックナビゲーター', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'ノートブックナビゲーターで表示' // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: '最終更新',
        createdAt: '作成日時',
        file: 'ファイル',
        files: 'ファイル',
        folder: 'フォルダ',
        folders: 'フォルダ'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: '失敗したメタデータレポートをエクスポートしました: {filename}',
            exportFailed: 'メタデータレポートのエクスポートに失敗しました'
        },
        sections: {
            notes: 'ノート表示',
            navigationPane: 'フォルダ表示',
            tags: 'タグ表示',
            folders: 'フォルダノート',
            listPane: 'リストペイン',
            advanced: '詳細設定'
        },
        items: {
            sortNotesBy: {
                name: 'ノートの並び順',
                desc: 'ノートリストでのノートの並び順を選択します。',
                options: {
                    'modified-desc': '編集日時（新しい順）',
                    'modified-asc': '編集日時（古い順）',
                    'created-desc': '作成日時（新しい順）',
                    'created-asc': '作成日時（古い順）',
                    'title-asc': 'タイトル（A順）',
                    'title-desc': 'タイトル（Z順）'
                }
            },
            groupByDate: {
                name: '日付でノートをグループ化',
                desc: '日付でソートする際、日付ヘッダーの下にノートをグループ化します。'
            },
            optimizeNoteHeight: {
                name: 'ノートの高さを最適化',
                desc: 'ピン留めされたノートとプレビューテキストのないノートの高さを削減。'
            },
            showParentFolderNames: {
                name: '親フォルダ名を表示',
                desc: 'サブフォルダまたはタグ内のノートに親フォルダ名を表示します。'
            },
            showQuickActions: {
                name: 'クイックアクションを表示 (デスクトップのみ)',
                desc: 'ファイルアイテムにホバーアクションを表示します。'
            },
            quickActionsRevealInFolder: {
                name: 'フォルダで表示',
                desc: 'クイックアクション：ノートを親フォルダで表示。サブフォルダまたはタグ内でノートを表示している場合のみ表示されます（ノートの実際のフォルダでは表示されません）。'
            },
            quickActionsPinNote: {
                name: 'ノートをピン留め',
                desc: 'クイックアクション：ノートをリストの上部にピン留めまたは解除。'
            },
            quickActionsOpenInNewTab: {
                name: '新しいタブで開く',
                desc: 'クイックアクション：ノートを新しいタブで開く。'
            },
            dualPane: {
                name: 'デュアルペインレイアウト（デスクトップのみ）',
                desc: 'デスクトップでナビゲーションペインとリストペインを並べて表示します。'
            },
            autoRevealActiveNote: {
                name: 'アクティブなノートを自動表示',
                desc: 'クイックスイッチャー、リンク、検索から開いたときに自動的にノートを表示します。'
            },
            autoRevealIgnoreRightSidebar: {
                name: '右サイドバーを無視',
                desc: '右サイドバーからの自動表示を無効化。'
            },
            autoSelectFirstFileOnFocusChange: {
                name: '最初のノートを自動選択（デスクトップのみ）',
                desc: 'フォルダまたはタグを切り替えた際に自動的に最初のノートを開きます。'
            },
            autoExpandFoldersTags: {
                name: 'フォルダとタグを自動展開',
                desc: 'フォルダやタグを選択した際に自動的に展開します。'
            },
            showTooltips: {
                name: 'ツールチップを表示（デスクトップのみ）',
                desc: 'ノートとフォルダの追加情報をホバー時にツールチップで表示します。'
            },
            excludedNotes: {
                name: 'ノートを非表示',
                desc: 'カンマ区切りのフロントマター属性のリスト。これらの属性を含むノートは非表示になります（例：draft, private, archived）。',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: 'フォルダを非表示',
                desc: '非表示にするフォルダのカンマ区切りリスト。名前パターン: assets*（assetsで始まるフォルダ）、*_temp（_tempで終わる）。パスパターン: /archive（ルートのアーカイブのみ）、/res*（resで始まるルートフォルダ）、/*/temp（1階層下のtempフォルダ）、/projects/*（projects内のすべてのフォルダ）。',
                placeholder: 'templates, assets*, /archive, /res*',
                info: '自動クリーンアップ：右クリックで除外する際、重複するパターンが削除されます（例：/projectsを除外し、/projects/appが既にリストにある場合、削除されます）。'
            },
            fileVisibility: {
                name: 'ファイルタイプを表示',
                desc: 'ナビゲーターに表示されるファイルタイプをフィルタリングします。Obsidianでサポートされていないファイルタイプは、外部アプリケーションで開かれる場合があります。',
                options: {
                    documents: 'ドキュメント (.md, .canvas, .base)',
                    supported: 'サポート (Obsidianで開く)',
                    all: 'すべて (外部で開く場合あり)'
                }
            },
            showFileDate: {
                name: '日付を表示',
                desc: 'ノート名の下に日付を表示します。'
            },
            showFileTags: {
                name: 'タグを表示',
                desc: 'ファイルアイテムにクリック可能なタグを表示します。タグの色を使用して、異なるタグタイプを視覚的に区別できます。'
            },
            dateFormat: {
                name: '日付形式',
                desc: '日付表示の形式（date-fns形式を使用）。',
                placeholder: 'yyyy年M月d日',
                help: '一般的な形式：\nyyyy年M月d日 = 2022年5月25日\nyyyy-MM-dd = 2022-05-25\nMM/dd/yyyy = 05/25/2022\n\nトークン：\nyyyy/yy = 年\nMMMM/MMM/MM/M = 月\ndd/d = 日\nEEEE/EEE = 曜日',
                helpTooltip: 'クリックして形式リファレンスを表示'
            },
            timeFormat: {
                name: '時刻形式',
                desc: '時刻を表示する形式（date-fns形式を使用）。',
                placeholder: 'HH:mm',
                help: '一般的な形式：\nHH:mm = 14:30（24時間制）\nh:mm a = 2:30 PM（12時間制）\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nトークン：\nHH/H = 24時間制\nhh/h = 12時間制\nmm = 分\nss = 秒\na = AM/PM',
                helpTooltip: 'クリックして形式リファレンスを表示'
            },
            showFilePreview: {
                name: 'ノートプレビューを表示 (*)',
                desc: 'ノート名の下にプレビューテキストを表示します。'
            },
            skipHeadingsInPreview: {
                name: 'プレビューで見出しをスキップ',
                desc: 'プレビューテキスト生成時に見出し行をスキップします。'
            },
            previewProperties: {
                name: 'プレビュープロパティ',
                desc: 'プレビューテキストを検索するフロントマタープロパティのカンマ区切りリスト。テキストがある最初のプロパティが使用されます。',
                placeholder: '要約, 説明, 概要',
                info: '指定されたプロパティにプレビューテキストが見つからない場合、プレビューはノートの内容から生成されます。'
            },
            previewRows: {
                name: 'プレビュー行数',
                desc: 'プレビューテキストの表示行数。',
                options: {
                    '1': '1行',
                    '2': '2行',
                    '3': '3行',
                    '4': '4行',
                    '5': '5行'
                }
            },
            fileNameRows: {
                name: 'タイトル行数',
                desc: 'ノートタイトルの表示行数。',
                options: {
                    '1': '1行',
                    '2': '2行'
                }
            },
            showFeatureImage: {
                name: 'アイキャッチ画像を表示 (*)',
                desc: 'フロントマターからサムネイル画像を表示します。ヒント：「Featured Image」プラグインを使用して、すべてのドキュメントに自動的にアイキャッチ画像を設定できます。'
            },
            featureImageProperties: {
                name: '画像プロパティ',
                desc: 'サムネイル画像用のフロントマタープロパティのカンマ区切りリスト。画像を持つ最初のプロパティが使用されます。空でフォールバック設定が有効な場合、最初の埋め込み画像が使用されます。',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: '埋め込み画像をフォールバックとして使用',
                desc: 'フロントマタープロパティにサムネイルが見つからない場合、ドキュメント内の最初の埋め込み画像をフォールバックとして使用します（Obsidian 1.9.4以降が必要）。サムネイルが正しく設定されていることを確認するには、これを無効にします。'
            },
            showRootFolder: {
                name: 'ルートフォルダを表示',
                desc: 'ツリーにルートフォルダ名を表示します。'
            },
            inheritFolderColors: {
                name: 'フォルダの色を継承',
                desc: 'サブフォルダが親フォルダから色を継承します。'
            },
            showNoteCount: {
                name: 'ノート数を表示',
                desc: '各フォルダとタグの横にノート数を表示します。'
            },
            showIcons: {
                name: 'アイコンを表示',
                desc: 'ナビゲーションパネルのフォルダとタグの横にアイコンを表示します。'
            },
            collapseBehavior: {
                name: '項目を折りたたむ',
                desc: '展開/折りたたみボタンが影響する項目を選択します。',
                options: {
                    all: 'すべてのフォルダとタグ',
                    foldersOnly: 'フォルダのみ',
                    tagsOnly: 'タグのみ'
                }
            },
            smartCollapse: {
                name: '選択中の項目を展開したままにする',
                desc: '折りたたむ時、現在選択されているフォルダまたはタグとその親を展開したままにします。'
            },
            navItemHeight: {
                name: '行高',
                desc: 'ナビゲーションペイン内のフォルダとタグの高さを調整します。'
            },
            navIndent: {
                name: 'ツリーインデント',
                desc: 'ネストされたフォルダとタグのインデント幅を調整します。'
            },
            showTags: {
                name: 'タグを表示 (*)',
                desc: 'ナビゲーターのフォルダの下にタグセクションを表示します。'
            },
            showTagsAboveFolders: {
                name: 'タグをフォルダの上に表示',
                desc: 'ナビゲーターでタグセクションをフォルダの前に表示します。'
            },
            showFavoriteTagsFolder: {
                name: 'お気に入りフォルダを表示',
                desc: 'お気に入りタグが設定されている場合、「お気に入り」を折りたたみ可能なフォルダとして表示します。'
            },
            showAllTagsFolder: {
                name: 'タグフォルダを表示',
                desc: '「タグ」を折りたたみ可能なフォルダとして表示します。'
            },
            showUntagged: {
                name: 'タグなしノートを表示',
                desc: 'タグのないノート用に「タグなし」項目を表示します。'
            },
            showUntaggedInFavorites: {
                name: 'お気に入りセクションにタグなしノートを表示',
                desc: 'お気に入りセクションにタグなしノートを表示します。フォルダ内またはお気に入りの直下に表示されます。'
            },
            favoriteTags: {
                name: 'お気に入りタグ',
                desc: 'タグの接頭辞のカンマ区切りリスト。タグを追加すると、すべてのサブタグが含まれます（例："photo"には"photo/camera/fuji"が含まれる）。',
                placeholder: 'インボックス, プロジェクト/作業, 日記/2025'
            },
            hiddenTags: {
                name: '非表示タグ',
                desc: '非表示にするタグの接頭辞のカンマ区切りリスト。タグを非表示にすると、すべてのサブタグも非表示になります（例："アーカイブ"で"アーカイブ/2024/docs"も非表示）。',
                placeholder: '内部, temp/下書き, アーカイブ/2024'
            },
            enableFolderNotes: {
                name: 'フォルダノートを有効化',
                desc: '有効にすると、関連するノートを持つフォルダがクリック可能なリンクとして表示されます。'
            },
            folderNoteName: {
                name: 'フォルダノート名',
                desc: 'フォルダノートの名前。空のままにするとフォルダと同じ名前を使用します。',
                placeholder: 'フォルダ名には空のまま'
            },
            folderNoteProperties: {
                name: 'フォルダノートプロパティ',
                desc: '新しく作成されたフォルダノートに追加するフロントマタープロパティ（カンマ区切り）。',
                placeholder: 'foldernote, darktheme'
            },
            hideFolderNoteInList: {
                name: 'リストでフォルダノートを非表示',
                desc: 'フォルダのノートリストにフォルダノートが表示されないようにします。'
            },
            confirmBeforeDelete: {
                name: '削除前に確認',
                desc: 'ノートやフォルダを削除する際に確認ダイアログを表示'
            },
            useFrontmatterDates: {
                name: 'フロントマターからメタデータを読み込む (*)',
                desc: '利用可能な場合、フロントマターからノート名とタイムスタンプを読み取り、それ以外はファイルシステムの値を使用'
            },
            frontmatterNameField: {
                name: '名前フィールド',
                desc: 'ノートの表示名として使用するフロントマターフィールド。空のままにするとファイル名を使用。',
                placeholder: 'タイトル'
            },
            frontmatterCreatedField: {
                name: '作成タイムスタンプフィールド',
                desc: '作成タイムスタンプのフロントマターフィールド名。空のままにするとファイルシステムの日付のみを使用。',
                placeholder: '作成日'
            },
            frontmatterModifiedField: {
                name: '変更タイムスタンプフィールド',
                desc: '変更タイムスタンプのフロントマターフィールド名。空のままにするとファイルシステムの日付のみを使用。',
                placeholder: '更新日'
            },
            frontmatterDateFormat: {
                name: 'タイムスタンプ形式',
                desc: 'フロントマター内のタイムスタンプを解析するために使用される形式。空のままにするとISO 8601形式を使用',
                helpTooltip: 'date-fnsフォーマットのドキュメントを参照',
                help: "一般的な形式:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: '開発をサポート',
                desc: 'ノートブックナビゲーターを愛用していただいている場合は、継続的な開発をサポートすることをご検討ください。',
                buttonText: '❤️ GitHubでスポンサーになる'
            },
            whatsNew: {
                name: '新着情報',
                desc: '最近の更新と改善を確認',
                buttonText: '最近の更新を表示'
            },
            cacheStatistics: {
                localCache: '(*) ローカルキャッシュ',
                items: '項目',
                withTags: 'タグ付き',
                withPreviewText: 'プレビューテキスト付き',
                withFeatureImage: 'フィーチャー画像付き',
                withMetadata: 'メタデータ付き'
            },
            metadataInfo: {
                successfullyParsed: '正常に解析済み',
                itemsWithName: '名前付き項目',
                withCreatedDate: '作成日付き',
                withModifiedDate: '変更日付き',
                failedToParse: '解析に失敗',
                createdDates: '作成日',
                modifiedDates: '変更日',
                checkTimestampFormat: 'タイムスタンプ形式を確認してください。',
                exportFailed: 'エラーをエクスポート'
            }
        }
    },
    whatsNew: {
        title: 'Notebook Navigatorの新機能',
        supportMessage: 'Notebook Navigatorが役立つと思われる場合は、開発のサポートをご検討ください。',
        supportButton: '❤️ サポート',
        thanksButton: 'ありがとう！'
    }
};
