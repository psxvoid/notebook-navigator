import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockLocalStorageStore = new Map<string, unknown>();

vi.mock('../../src/utils/localStorage', () => {
    return {
        localStorage: {
            init: vi.fn(),
            get: vi.fn((key: string) => (mockLocalStorageStore.has(key) ? mockLocalStorageStore.get(key)! : null)),
            set: vi.fn((key: string, value: unknown) => {
                mockLocalStorageStore.set(key, value);
                return true;
            }),
            remove: vi.fn((key: string) => {
                mockLocalStorageStore.delete(key);
                return true;
            })
        }
    };
});

vi.stubGlobal('window', globalThis);

import { RecentStorageService } from '../../src/services/RecentStorageService';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { STORAGE_KEYS } from '../../src/types';
import { localStorage } from '../../src/utils/localStorage';

describe('RecentStorageService', () => {
    let service: RecentStorageService;
    const notifyChange = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        mockLocalStorageStore.clear();
        vi.clearAllMocks();
        service = new RecentStorageService({
            settings: DEFAULT_SETTINGS,
            keys: STORAGE_KEYS,
            notifyChange
        });
        service.hydrate();
    });

    afterEach(() => {
        service.flushPendingPersists();
        vi.useRealTimers();
    });

    it('returns independent copies of the recent icons map', () => {
        const icons = service.getRecentIcons();
        icons.lucide = ['lucide-home'];

        const next = service.getRecentIcons();
        expect(next).toEqual({});
    });

    it('persists icon selections when callers mutate the returned map', () => {
        const icons = service.getRecentIcons();
        icons.lucide = ['lucide-home'];

        service.setRecentIcons(icons);
        service.flushPendingPersists();

        expect(localStorage.set).toHaveBeenCalledWith(STORAGE_KEYS.recentIconsKey, {
            lucide: ['home']
        });
        expect(notifyChange).toHaveBeenCalled();
    });

    it('normalizes legacy phosphor identifiers when persisting recent icons', () => {
        const icons = service.getRecentIcons();
        icons.phosphor = ['phosphor:ph-apple-logo', 'ph-apple-logo', 'phosphor:apple-logo'];

        service.setRecentIcons(icons);
        service.flushPendingPersists();

        expect(localStorage.set).toHaveBeenCalledWith(STORAGE_KEYS.recentIconsKey, {
            phosphor: ['phosphor:apple-logo']
        });
    });

    it('cleans stored legacy identifiers on hydrate', () => {
        mockLocalStorageStore.set(STORAGE_KEYS.recentIconsKey, {
            phosphor: ['phosphor:ph-sword']
        });

        service.hydrate();

        const icons = service.getRecentIcons();
        expect(icons.phosphor).toEqual(['phosphor:sword']);
        expect(localStorage.set).toHaveBeenCalledWith(STORAGE_KEYS.recentIconsKey, {
            phosphor: ['phosphor:sword']
        });
    });
});
