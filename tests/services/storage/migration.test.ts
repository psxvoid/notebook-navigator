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

import { IndexedDBStorage } from 'src/storage/IndexedDBStorage';
import { Internal, MigrationSummary } from '../../../src/storage/migrations';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

type MigrationFunc = (storage: IndexedDBStorage) => Promise<MigrationSummary>

const createMigrationFunc = function (acc?: MigrationFunc[]): MigrationFunc {
    const spy = vi.fn(() => Promise.resolve({} as MigrationSummary))

    if (acc != null) {
        acc.push(spy)
    }

    return spy
}

const createMockStorage = function (): IndexedDBStorage {
    return { init: vi.fn(() => Promise.resolve()) } as unknown as IndexedDBStorage
}

describe('migrations', () => {
    describe('MigrationRegistry', () => {
        let registry: Internal.MigrationRegistry
        let storage: IndexedDBStorage
        let migrationSpies: Mock<MigrationFunc>[]
        let versionBefore: number
        let versionAfter: number
        let result: boolean

        beforeEach(() => {
            registry = new Internal.MigrationRegistry()
        })

        describe("addMigration", () => {
            it("should throw when both version are the same in a single migration", () => {
                const act = () => {
                    registry.addMigration(new Internal.Migration(5.3, 5.3, createMigrationFunc()))
                }

                expect(act).toThrow("Versions must be different withing a single migration")
            })

            it("two incremental migrations and one backward-compatible", () => {
                const act = () => {
                    registry.addMigration(new Internal.Migration(5.3, 7.3, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.3, 7.4, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.4, 7.3, createMigrationFunc()))
                }

                expect(act).not.toThrow()
            })

            it("two incremental migrations and two backward-compatible", () => {
                const act = () => {
                    registry.addMigration(new Internal.Migration(5.3, 7.3, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.3, 7.4, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.4, 7.3, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.3, 5.3, createMigrationFunc()))
                }

                expect(act).not.toThrow()
            })

            it("three migrations, incremental version", () => {
                const act = () => {
                    registry.addMigration(new Internal.Migration(5.3, 7.3, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.3, 7.4, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.4, 9.0, createMigrationFunc()))
                }

                expect(act).not.toThrow()
            })

            it("three migrations, second version is not incremental", () => {
                const act = () => {
                    registry.addMigration(new Internal.Migration(5.3, 7.3, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.35, 7.4, createMigrationFunc()))
                    registry.addMigration(new Internal.Migration(7.4, 9.0, createMigrationFunc()))
                }

                expect(act).toThrow("Non-incremental migrations are not supported")
            })
        })

        describe("apply", () => {
            const act = async () => {
                result = await registry.apply(storage, versionBefore, versionAfter)
            }

            describe('three migrations, incremental versions', () => {
                beforeEach(() => {
                    storage = createMockStorage()
                    migrationSpies = []
                    registry.addMigration(new Internal.Migration(5.3, 7.3, createMigrationFunc(migrationSpies)))
                    registry.addMigration(new Internal.Migration(7.3, 7.4, createMigrationFunc(migrationSpies)))
                    registry.addMigration(new Internal.Migration(7.4, 7.5, createMigrationFunc(migrationSpies)))
                })

                describe('below supported versions', () => {
                    beforeEach(() => {
                        versionBefore = 4.3
                        versionAfter = 5.3
                    })

                    beforeEach(act)

                    it('should not apply any migrations', () => {
                        for (const spy of migrationSpies) {
                            expect(spy).toHaveBeenCalledTimes(0)
                        }
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should not init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(0)
                    })
                })

                describe('matches first one only (below upper)', () => {
                    beforeEach(() => {
                        versionBefore = 5.3
                        versionAfter = 6.3
                    })

                    beforeEach(act)

                    it('should first migration only', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(0)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should not init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches first one only (equal to upper)', () => {
                    beforeEach(() => {
                        versionBefore = 5.3
                        versionAfter = 7.3
                    })

                    beforeEach(act)

                    it('should first migration only', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(0)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should not init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches first two only (below upper)', () => {
                    beforeEach(() => {
                        versionBefore = 5.3
                        versionAfter = 7.35
                    })

                    beforeEach(act)

                    it('should apply first two migration only', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(0)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches first two only (equal to upper)', () => {
                    beforeEach(() => {
                        versionBefore = 5.3
                        versionAfter = 7.4
                    })

                    beforeEach(act)

                    it('should apply first two migration only', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(0)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches all three (below upper)', () => {
                    beforeEach(() => {
                        versionBefore = 5.3
                        versionAfter = 7.45
                    })

                    beforeEach(act)

                    it('should apply all three migrations', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches first two only (equal to upper)', () => {
                    beforeEach(() => {
                        versionBefore = 5.3
                        versionAfter = 7.5
                    })

                    beforeEach(act)

                    it('should apply all three migrations', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches last two (equal to lower)', () => {
                    beforeEach(() => {
                        versionBefore = 7.3
                        versionAfter = 7.5
                    })

                    beforeEach(act)

                    it('should apply last two migrations', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches first two only (higher than lower)', () => {
                    beforeEach(() => {
                        versionBefore = 7.35
                        versionAfter = 7.5
                    })

                    beforeEach(act)

                    it('should apply last two migrations', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches last one (equal to lower)', () => {
                    beforeEach(() => {
                        versionBefore = 7.4
                        versionAfter = 7.5
                    })

                    beforeEach(act)

                    it('should apply last migration', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches first two only (higher than lower)', () => {
                    beforeEach(() => {
                        versionBefore = 7.45
                        versionAfter = 7.5
                    })

                    beforeEach(act)

                    it('should apply last two migrations', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches all three (full)', () => {
                    beforeEach(() => {
                        versionBefore = 5.3
                        versionAfter = 7.5
                    })

                    beforeEach(act)

                    it('should apply all three', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                    })

                    it('should apply migrations in the correct order', () => {
                        expect(migrationSpies[1]).toHaveBeenCalledAfter(migrationSpies[0])
                        expect(migrationSpies[2]).toHaveBeenCalledAfter(migrationSpies[1])
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })
            })

            describe('two incremental migrations and two backward-compatible', () => {
                beforeEach(() => {
                    storage = createMockStorage()
                    migrationSpies = []
                    registry.addMigration(new Internal.Migration(5.3, 7.3, createMigrationFunc(migrationSpies)))
                    registry.addMigration(new Internal.Migration(7.3, 7.4, createMigrationFunc(migrationSpies)))
                    registry.addMigration(new Internal.Migration(7.4, 7.3, createMigrationFunc(migrationSpies)))
                    registry.addMigration(new Internal.Migration(7.3, 5.3, createMigrationFunc(migrationSpies)))
                })

                describe('matches two backward-compatible (full revert)', () => {
                    beforeEach(() => {
                        versionBefore = 7.4
                        versionAfter = 5.3
                    })

                    beforeEach(act)

                    it('should apply last two migrations only', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[3]).toHaveBeenCalledTimes(1)
                    })

                    it('should apply migrations in the correct order', () => {
                        expect(migrationSpies[3]).toHaveBeenCalledAfter(migrationSpies[2])
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches first backward-compatible revert', () => {
                    beforeEach(() => {
                        versionBefore = 7.4
                        versionAfter = 7.3
                    })

                    beforeEach(act)

                    it('should apply last two migrations only', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(1)
                        expect(migrationSpies[3]).toHaveBeenCalledTimes(0)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })

                describe('matches second backward-compatible revert', () => {
                    beforeEach(() => {
                        versionBefore = 7.3
                        versionAfter = 5.3
                    })

                    beforeEach(act)

                    it('should apply last two migrations only', () => {
                        expect(migrationSpies[0]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[1]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[2]).toHaveBeenCalledTimes(0)
                        expect(migrationSpies[3]).toHaveBeenCalledTimes(1)
                    })

                    it('should be successful', () => {
                        expect(result).toBeTruthy()
                    })

                    it('should init storage', () => {
                        expect(storage.init).toHaveBeenCalledTimes(1)
                    })
                })
            })
        })
    })
})