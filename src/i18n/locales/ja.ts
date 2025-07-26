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
        submit: '送信', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: '選択なし', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'タグなし', // Label for notes without any tags (English: Untagged)
        untitled: '無題', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'アイキャッチ画像' // Alt text for thumbnail/preview images (English: Feature image)
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'フォルダまたはタグを選択してノートを表示', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'ノートなし', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 ピン留め' // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
    },

    // Folder tree
    folderTree: {
        rootFolderName: '保管庫' // Display name for the vault root folder in the tree (English: Vault)
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
        collapseAllFolders: 'すべて折りたたむ', // Tooltip for button that collapses all expanded items (English: Collapse all)
        expandAllFolders: 'すべて展開', // Tooltip for button that expands all items (English: Expand all)
        newFolder: '新規フォルダ', // Tooltip for create new folder button (English: New folder)
        newNote: '新規ノートを作成', // Tooltip for create new note button (English: Create new note)
        mobileBackToNavigation: 'ナビゲーションに戻る', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: '並び順を変更', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'デフォルト', // Label for default sorting mode (English: Default)
        customSort: 'カスタム', // Label for custom sorting mode (English: Custom)
        showFolders: 'ナビゲーションを表示', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'ナビゲーションを非表示', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        toggleSubfolders: 'サブフォルダのノートを表示', // Tooltip for button to toggle showing notes from subfolders (English: Show notes from subfolders)
        autoExpandFoldersTags: 'フォルダとタグを自動展開', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showDualPane: 'デュアルペインを表示', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: 'シングルペインを表示' // Tooltip for button to show single-pane layout (English: Show single pane)
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
            revealInFinder: 'Finderで表示',
            showInExplorer: 'システムエクスプローラーで表示',
            copyDeepLink: 'ディープリンクをコピー',
            renameNote: 'ノートの名前を変更',
            deleteNote: 'ノートを削除',
            deleteMultipleNotes: '{count}個のノートを削除',
            moveToFolder: 'Move to...',
            moveMultipleToFolder: 'Move {count} files to...',
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
            newNote: '新規ノートを作成',
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
            renameFolder: 'フォルダの名前を変更',
            deleteFolder: 'フォルダを削除'
        },
        tag: {
            changeIcon: 'アイコンを変更',
            removeIcon: 'アイコンを削除',
            changeColor: '色を変更',
            removeColor: '色を削除'
        }
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
            header: 'フォルダの色を選択',
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
            deleteFolderConfirm: 'このフォルダとそのすべての内容を削除してもよろしいですか？',
            deleteFileConfirm: 'このファイルを削除してもよろしいですか？'
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
            instructions: {
                navigate: 'でナビゲート',
                select: 'で選択',
                dismiss: 'でキャンセル'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'フォルダの作成に失敗しました：{error}',
            createFile: 'ファイルの作成に失敗しました：{error}',
            renameFolder: 'フォルダの名前変更に失敗しました：{error}',
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
            drawingAlreadyExists: 'この名前の図面が既に存在します',
            failedToCreateDrawing: '図面の作成に失敗しました',
            noFolderSelected: 'Notebook Navigatorでフォルダが選択されていません',
            noFileSelected: 'ファイルが選択されていません'
        },
        notifications: {
            deletedMultipleFiles: '{count}個のファイルを削除しました',
            deepLinkCopied: 'ディープリンクをクリップボードにコピーしました'
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
            failedToClearTags: 'タグのクリアに失敗しました'
        },
        notifications: {
            filesAlreadyExist: '{count}個のファイルが移動先に既に存在します',
            addedTag: '{count}個のファイルにタグ "{tag}" を追加しました',
            filesAlreadyHaveTag: '{count}個のファイルには既にこのタグまたはより具体的なタグがあります',
            clearedTags: '{count}個のファイルからすべてのタグをクリアしました',
            noTagsToClear: 'クリアするタグがありません'
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
        focusFile: 'ファイルにフォーカス', // Command palette: Moves keyboard focus to the file list pane (English: Focus file)
        toggleDualPane: 'デュアルペインレイアウトを切り替え', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: 'ファイルを削除', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: '新規ノートを作成', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: 'ファイルを移動', // Command palette: Move selected files to another folder (English: Move files)
        navigateToFolder: 'フォルダにナビゲート', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: 'タグにナビゲート', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        toggleSubfolders: 'サブフォルダのノート表示を切り替え' // Command palette: Toggles showing notes from subfolders (English: Toggle subfolder notes)
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
            showNotesFromSubfolders: {
                name: 'サブフォルダのノートを表示',
                desc: '現在のフォルダビューにすべてのサブフォルダのノートを表示します。'
            },
            showParentFolderNames: {
                name: '親フォルダ名を表示',
                desc: 'サブフォルダのノートに親フォルダ名を表示します。'
            },
            dualPane: {
                name: 'デュアルペインレイアウト（デスクトップのみ）',
                desc: 'デスクトップでナビゲーションペインとリストペインを並べて表示します。'
            },
            autoRevealActiveNote: {
                name: 'アクティブなノートを自動表示',
                desc: 'クイックスイッチャー、リンク、検索から開いたときに自動的にノートを表示します。'
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
                name: '除外するノート',
                desc: 'カンマ区切りのフロントマター属性のリスト。これらの属性を含むノートは非表示になります（例：draft, private, archived）。',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: '除外するフォルダ',
                desc: '非表示にするフォルダのカンマ区切りリスト。ワイルドカード対応：assets*（で始まる）、*_temp（で終わる）。',
                placeholder: 'templates, assets*, *_temp'
            },
            fileVisibility: {
                name: 'ファイルタイプを表示',
                desc: 'ナビゲーターに表示するファイルタイプを選択します。Obsidianでサポートされていないファイルは、システムのデフォルトアプリケーションで開かれます。',
                options: {
                    markdownOnly: 'Markdownのみ',
                    supported: 'サポートされているファイル',
                    all: 'すべてのファイル'
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
                name: 'ノートプレビューを表示',
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
                name: 'アイキャッチ画像を表示',
                desc: 'フロントマターからサムネイル画像を表示します。ヒント：「Featured Image」プラグインを使用して、すべてのドキュメントに自動的にアイキャッチ画像を設定できます。'
            },
            featureImageProperties: {
                name: '画像プロパティ',
                desc: 'サムネイル画像用のフロントマタープロパティのカンマ区切りリスト。画像を持つ最初のプロパティが使用されます。',
                tip: '「Featured Image」プラグインを使用して自動的に画像を設定できます。最高のパフォーマンスには42pxのサムネイル、Retinaディスプレイには84pxを使用してください。',
                placeholder: 'featureResized, feature',
                embedFallback:
                    '上記のプロパティに画像が見つからない場合、ドキュメント内の最初の埋め込み画像が使用されます（Obsidian 1.9.4以降が必要）'
            },
            showRootFolder: {
                name: 'ルートフォルダを表示',
                desc: 'ツリーにルートフォルダとして「保管庫」を表示します。'
            },
            showNoteCount: {
                name: 'ノート数を表示',
                desc: '各フォルダとタグのノート数を表示します。'
            },
            showIcons: {
                name: 'アイコンを表示',
                desc: 'ナビゲーションパネルのフォルダとタグの横にアイコンを表示します。'
            },
            collapseButtonBehavior: {
                name: '折りたたみボタンの動作',
                desc: '展開/折りたたみボタンが影響する項目を選択します。',
                options: {
                    all: 'すべてのフォルダとタグ',
                    foldersOnly: 'フォルダのみ',
                    tagsOnly: 'タグのみ'
                }
            },
            showTags: {
                name: 'タグを表示',
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
                desc: 'お気に入りタグパターンのカンマ区切りリスト。完全一致、ワイルドカード（*）、正規表現（/パターン/）をサポートします。',
                placeholder: 'インボックス, プロジェクト-*, /^日記-\\d{4}/'
            },
            hiddenTags: {
                name: '非表示タグ',
                desc: 'タグツリーから非表示にするタグパターンのカンマ区切りリスト。完全一致、ワイルドカード（*）、正規表現（/パターン/）をサポートします。',
                placeholder: '内部, temp-*, /^アーカイブ-\\d{4}/'
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
            hideFolderNoteInList: {
                name: 'リストでフォルダノートを非表示',
                desc: 'フォルダのノートリストにフォルダノートが表示されないようにします。'
            },
            confirmBeforeDelete: {
                name: '削除前に確認',
                desc: 'ノートやフォルダを削除する際に確認ダイアログを表示'
            },
            useFrontmatterDates: {
                name: 'フロントマターからメタデータを読み込む',
                desc: '利用可能な場合、フロントマターからノート名とタイムスタンプを読み取り、それ以外はファイルシステムの値を使用'
            },
            frontmatterNameField: {
                name: '名前フィールド',
                desc: 'ノートの表示名として使用するフロントマターフィールド。空のままにするとファイル名を使用。',
                placeholder: 'title'
            },
            frontmatterCreatedField: {
                name: '作成タイムスタンプフィールド',
                desc: '作成タイムスタンプのフロントマターフィールド名。空のままにするとファイルシステムの日付のみを使用。',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: '変更タイムスタンプフィールド',
                desc: '変更タイムスタンプのフロントマターフィールド名。空のままにするとファイルシステムの日付のみを使用。',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: 'タイムスタンプ形式',
                desc: 'フロントマター内のタイムスタンプを解析するために使用される形式',
                placeholder: "yyyy-MM-dd'T'HH:mm:ss",
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
                localCache: 'ローカルキャッシュ',
                items: '項目',
                withPreviewText: 'プレビューテキスト付き',
                withFeatureImage: 'フィーチャー画像付き',
                withMetadata: 'メタデータ付き'
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
