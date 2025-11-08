export const enum AssertId {
    RebuildCacheUnknown
}

export function assertNever(id: number, x: never): never {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(`Unreachable state (id=${id}): ${x as unknown as any}`);
}