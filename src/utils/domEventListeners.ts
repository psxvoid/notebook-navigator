import { runAsyncAction } from './async';

export type AsyncEventHandler<TEvent extends Event = Event> = (event: TEvent) => void | Promise<void>;

/**
 * Attaches an event listener that routes the handler through runAsyncAction
 * and returns a disposer to unregister it.
 */
export function addAsyncEventListener<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: AsyncEventHandler<HTMLElementEventMap[K]>,
    options?: boolean | AddEventListenerOptions
): () => void;
export function addAsyncEventListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    handler: AsyncEventHandler<DocumentEventMap[K]>,
    options?: boolean | AddEventListenerOptions
): () => void;
export function addAsyncEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: AsyncEventHandler<WindowEventMap[K]>,
    options?: boolean | AddEventListenerOptions
): () => void;
export function addAsyncEventListener<TEvent extends Event = Event>(
    target: EventTarget,
    type: string,
    handler: AsyncEventHandler<TEvent>,
    options?: boolean | AddEventListenerOptions
): () => void {
    const wrappedHandler = (event: Event) => {
        runAsyncAction(() => handler(event as TEvent));
    };
    target.addEventListener(type, wrappedHandler as EventListener, options);
    return () => target.removeEventListener(type, wrappedHandler as EventListener, options);
}
