let calls = [];
let failNext = false;
let waiters = [];

export function reset() {
    calls = [];
    failNext = false;
    waiters = [];
}

export function failOnce() { failNext = true; }
export function getCalls() { return structuredClone(calls); }
export function waitForCallCount(count) {
    if (calls.length >= count) return Promise.resolve();
    return new Promise(resolve => waiters.push({ count, resolve }));
}

export default class TestStoreProvider {
    static optionsSchema = {
        type: "object",
        properties: { tag: { type: "string" } },
        additionalProperties: false
    };

    static getCacheKey(url) {
        // Share construction by complete Store provider identity.
        return url;
    }

    constructor(services, options = {}) {
        // Record construction before exercising failure and Loader sharing behavior.
        const call = { url: options.url, options: structuredClone(options), number: calls.length + 1 };
        calls.push(call);
        for (const waiter of waiters.filter(item => calls.length >= item.count)) waiter.resolve();
        waiters = waiters.filter(item => calls.length < item.count);
        if (failNext) {
            failNext = false;
            throw new Error("Simulated Store provider failure");
        }
        Object.assign(this, call);
    }
}
