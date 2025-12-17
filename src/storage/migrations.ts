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

import { IndexedDBStorage } from "./IndexedDBStorage"

function getMigrationVersion(versionBefore: number, versionAfter: number): string {
    return `${versionBefore}-${versionAfter}`
}

async function emptyMigrateFunc(storage: IndexedDBStorage): Promise<number> {
    return 0
}

class Migration {
    public readonly version: string

    constructor(
        public readonly versionBefore: number,
        public readonly versionAfter: number,
        public readonly migrateFunc: (storage: IndexedDBStorage) => Promise<number>
    ) {
        this.version = getMigrationVersion(this.versionBefore, this.versionAfter)
    }
}

class MigrationRegistry {
    private readonly migrations = new Map<string, Migration>()

    public addMigration(migration: Migration) {
        this.migrations.set(migration.version, migration)
    }

    public async apply(storage: IndexedDBStorage, versionBefore: number, versionAfter: number) {

        await storage.init()

        const version = getMigrationVersion(versionBefore, versionAfter)

        const migration = this.migrations.get(version)

        if (migration != null) {
            try {
                const updateCount = await migration.migrateFunc(storage)

                console.log(`Migration updated ${updateCount} rows`)

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e: unknown) {
                return false
            }
        }

        return true
    }
}

const contentMigrations = new MigrationRegistry()

contentMigrations.addMigration(new Migration(5.3, 6.3, emptyMigrateFunc))
contentMigrations.addMigration(new Migration(6.3, 5.3, emptyMigrateFunc))
contentMigrations.addMigration(new Migration(6.3, 7.3, emptyMigrateFunc))
contentMigrations.addMigration(new Migration(7.3, 6.3, emptyMigrateFunc))
contentMigrations.addMigration(new Migration(5.3, 7.3, emptyMigrateFunc))
contentMigrations.addMigration(new Migration(7.3, 5.3, emptyMigrateFunc))

export { contentMigrations }