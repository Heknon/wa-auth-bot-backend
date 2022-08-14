/**
 * Waits asynchrounsly "ms" time
 * @param ms Amount of milliseconds to block for
 */
export function wait(ms: number) {
    return new Promise<void>((res) => setTimeout(res, ms));
}

async function timeout(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sleep(fn: () => Promise<any> | any, ms: number) {
    await timeout(ms);
    await fn();
}
