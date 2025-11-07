import type { MenuItem } from 'obsidian';
import { runAsyncAction } from '../async';

export function setAsyncOnClick(item: MenuItem, handler: () => void | Promise<void>): MenuItem {
    return item.onClick(() => {
        runAsyncAction(handler);
    });
}
