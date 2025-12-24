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

import { CacheCustomFields } from "../../src/types";
import { TagsV2 } from "../../src/storage/IndexedDBStorage";
import { EMPTY_MAP } from "../../src/utils/empty";

export class StubTagCacheV2 {
    private readonly cache = new Map<string, TagsV2>();

    public set(path: string, tags: readonly string[]) {
        this.cache.set(path, new Map([[CacheCustomFields.TagDefault, tags]]))
    }

    public get(path: string): TagsV2 {
        return this.cache.get(path) ?? EMPTY_MAP
    }

    public clear(): void {
        this.cache.clear()
    }
}