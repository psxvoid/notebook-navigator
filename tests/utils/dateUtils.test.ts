import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getLanguageMock } = vi.hoisted(() => ({
    getLanguageMock: vi.fn(() => 'en')
}));

vi.mock('obsidian', () => ({
    getLanguage: getLanguageMock
}));

import { DateUtils } from '../../src/utils/dateUtils';

describe('DateUtils.parseFrontmatterDate', () => {
    beforeEach(() => {
        getLanguageMock.mockReturnValue('en');
    });

    afterEach(() => {
        getLanguageMock.mockReturnValue('en');
        getLanguageMock.mockClear();
    });

    it.each(['zh', 'zh-CN', 'zh_CN'])('parses Chinese meridiem markers in frontmatter values (%s)', locale => {
        getLanguageMock.mockReturnValue(locale);

        const timestamp = DateUtils.parseFrontmatterDate('2025年11月1日 下午03:24', 'yyyy年M月d日 a hh:mm');

        expect(timestamp).toBeDefined();
        if (timestamp === undefined) {
            throw new Error('Expected timestamp to be defined');
        }

        expect(new Date(timestamp).getHours()).toBe(15);
    });

    it.each(['zh', 'zh-CN', 'zh_CN'])('parses Chinese morning marker as morning hours (%s)', locale => {
        getLanguageMock.mockReturnValue(locale);

        const timestamp = DateUtils.parseFrontmatterDate('2025年11月1日 上午03:24', 'yyyy年M月d日 a hh:mm');

        expect(timestamp).toBeDefined();
        if (timestamp === undefined) {
            throw new Error('Expected timestamp to be defined');
        }

        expect(new Date(timestamp).getHours()).toBe(3);
    });
});
