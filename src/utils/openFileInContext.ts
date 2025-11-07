import type { App, PaneType, TFile } from 'obsidian';
import type { CommandQueueService } from '../services/CommandQueueService';

interface OpenFileInContextParams {
    app: App;
    commandQueue: CommandQueueService | null;
    file: TFile;
    context: PaneType;
    active?: boolean;
}

/**
 * Opens a file in a new workspace context (tab, split, window) while respecting the command queue.
 */
export async function openFileInContext({ app, commandQueue, file, context, active = true }: OpenFileInContextParams): Promise<void> {
    const openFile = async () => {
        const leaf = app.workspace.getLeaf(context);
        if (!leaf) {
            throw new Error(`Unable to open file in ${context} context: leaf not available`);
        }
        await leaf.openFile(file, { active });
    };

    if (commandQueue) {
        await commandQueue.executeOpenInNewContext(file, context, openFile);
        return;
    }

    await openFile();
}
