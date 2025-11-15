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

export { contentMigrations }