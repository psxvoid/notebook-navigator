export type MaybePromise = void | Promise<unknown>;

export interface AsyncErrorRecord {
    error: unknown;
    timestamp: number;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return typeof value === 'object' && value !== null && typeof (value as PromiseLike<unknown>).then === 'function';
}

type AsyncAction = () => MaybePromise;

interface RunAsyncActionOptions {
    onError?: (error: unknown) => void;
}

const MAX_ASYNC_ERROR_HISTORY = 20;
const asyncErrorHistory: AsyncErrorRecord[] = [];

function recordAsyncError(error: unknown) {
    asyncErrorHistory.push({ error, timestamp: Date.now() });
    if (asyncErrorHistory.length > MAX_ASYNC_ERROR_HISTORY) {
        asyncErrorHistory.shift();
    }
}

const defaultErrorHandler = (error: unknown) => {
    console.error('Unhandled async action error', error);
    recordAsyncError(error);
};

export function runAsyncAction(action: AsyncAction, options?: RunAsyncActionOptions): void {
    const handleError = options?.onError ?? defaultErrorHandler;

    try {
        const result = action();
        if (isPromiseLike(result)) {
            void result.catch(handleError);
        }
    } catch (error) {
        handleError(error);
    }
}

export function getAsyncErrorHistory(): AsyncErrorRecord[] {
    return [...asyncErrorHistory];
}
