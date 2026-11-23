let calls = [];
let failNext = false;
let deferred = false;
let releases = [];
let waiters = [];

export function reset() {
    calls = [];
    failNext = false;
    deferred = false;
    releases = [];
    waiters = [];
}

export function failOnce() { failNext = true; }
export function deferCreates() { deferred = true; }
export function releaseCreates() { for (const release of releases.splice(0)) release(); }
export function getCalls() { return structuredClone(calls); }
export function waitForCallCount(count) {
    if (calls.length >= count) return Promise.resolve();
    return new Promise(resolve => waiters.push({ count, resolve }));
}

export default class TestFilesystemProvider {
    static async create({url}) {
        // Record the provider URL before exercising failure or in-flight sharing behavior.
        const call = { url, number: calls.length + 1 };
        calls.push(call);
        for (const waiter of waiters.filter(item => calls.length >= item.count)) waiter.resolve();
        waiters = waiters.filter(item => calls.length < item.count);
        if (deferred) await new Promise(resolve => releases.push(resolve));
        if (failNext) {
            failNext = false;
            throw new Error("Simulated Filesystem provider failure");
        }
        return { ...call };
    }
}
