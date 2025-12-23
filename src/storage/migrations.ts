/*
 * Notebook Navigator Ex - Plugin for Obsidian
 * Copyright (c) 2025 Pavel Sapehin
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

import { getDefaultTags, IndexedDBStorage, TagsV2 } from "./IndexedDBStorage"

export interface MigrationSummary {
    successCount: number
    failCount: number
    totalCount: number
}

const emptySummary: MigrationSummary = {
    successCount: 0,
    failCount: 0,
    totalCount: 0,
}

function getMigrationVersion(versionBefore: number, versionAfter: number): string {
    return `${versionBefore}-${versionAfter}`
}

async function emptyMigrateFunc(storage: IndexedDBStorage): Promise<MigrationSummary> {
    return emptySummary
}


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Internal {

    export class Migration {
        public readonly version: string

        constructor(
            public readonly versionBefore: number,
            public readonly versionAfter: number,
            public readonly migrateFunc: (storage: IndexedDBStorage) => Promise<MigrationSummary>
        ) {
            this.version = getMigrationVersion(this.versionBefore, this.versionAfter)
        }
    }

    export class MigrationRegistry {
        private readonly migrations: Migration[] = []

        public addMigration(migration: Migration) {
            if (migration.versionAfter === migration.versionBefore) {
                throw new Error("Versions must be different withing a single migration")
            }

            if (this.migrations.length > 0 && this.migrations[this.migrations.length - 1].versionAfter !== migration.versionBefore) {
                throw new Error("Non-incremental migrations are not supported")
            }

            this.migrations.push(migration)
        }

        public async apply(storage: IndexedDBStorage, versionBefore: number, versionAfter: number) {
            const isIncrement = versionBefore < versionAfter

            let prevMatch: { versionBefore: number, versionAfter: number } | undefined

            const matchedMigrations: readonly Migration[] =
                this.migrations.filter(x => {
                    const currentBefore = isIncrement ? x.versionBefore : x.versionAfter
                    const currentAfter = isIncrement ? x.versionAfter : x.versionBefore
                    const before = isIncrement ? prevMatch == null ? versionBefore : prevMatch.versionAfter : versionAfter
                    const after = isIncrement ? versionAfter : prevMatch == null ? versionBefore : prevMatch.versionBefore

                    const isMatch = (before >= currentBefore && before < currentAfter && currentAfter < after) ||
                        (after > currentBefore && after <= currentAfter)
                    
                    if (isMatch) {
                        prevMatch = x
                    }

                    return isMatch
                })

            if (matchedMigrations.length > 0) {
                await storage.init()
                const applyMigration = async (migration: Migration): Promise<boolean> => {
                    try {
                        console.log(`Migration has been started from ${migration.versionBefore} to ${migration.versionAfter}...`)

                        const summary = await migration.migrateFunc(storage)

                        console.log(`Migration updated ${summary.successCount} rows with ${summary.failCount} errors. Total rows: ${summary.totalCount}.`)

                        return true
                    } catch (e: unknown) {
                        console.error(e)
                        return false
                    }
                }

                for (const migration of matchedMigrations) {
                    const migrationResult = await applyMigration(migration)

                    if (migrationResult !== true) {
                        return false
                    }
                }
            }

            return true
        }
    }

}

async function migrate74to73(storage: IndexedDBStorage): Promise<MigrationSummary> {
    const files = storage.getAllFiles()
    let totalCount = 0
    let successCount = 0
    let failCount = 0

    for (const file of files) {
        totalCount++

        const tags = file.data.tags as TagsV2;
        const tagsV1 = getDefaultTags(tags)

        try {
            await storage.updateFileContent({ path: file.path, tags: tagsV1 })
            successCount++
        } catch (e: unknown) {
            console.error(e)
            failCount++
        }
    }

    return {
        totalCount,
        successCount,
        failCount
    }
}

const contentMigrations = new Internal.MigrationRegistry()

contentMigrations.addMigration(new Internal.Migration(7.4, 7.3, migrate74to73))
contentMigrations.addMigration(new Internal.Migration(7.3, 5.3, emptyMigrateFunc))
contentMigrations.addMigration(new Internal.Migration(5.3, 7.3, emptyMigrateFunc))

export { contentMigrations }