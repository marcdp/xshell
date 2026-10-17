import assert from "node:assert/strict";
import test from "node:test";
import datasetDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-dataset.js";
import LoaderDatasetUrl from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/dataset-url.js";
import validateDataset from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/validation/dataset.js";

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function setup(loader) {
    const handlers = new Map();
    const pending = [];
    const state = new Proxy({ value: null, src: "", tables: [] }, {
        set(target, key, value) {
            const oldValue = target[key];
            target[key] = value;
            if (!Object.is(oldValue, value)) pending.push(Promise.resolve(handlers.get(`change:${key}`)?.({ newValue: value, oldValue })));
            return true;
        }
    });
    const controller = datasetDefinition.controller({
        state,
        events: { on(target, event, listener) { handlers.set(event, listener); } },
        loader
    });
    controller.load();
    return {
        state,
        async flush() {
            while (pending.length) await Promise.all(pending.splice(0));
            await new Promise(resolve => setImmediate(resolve));
        }
    };
}

function createLoader() {
    const requests = new Map();
    return {
        requests,
        load(src) {
            const request = deferred();
            requests.set(src, request);
            return request.promise;
        }
    };
}

const datasetA = { tables: [{ name: "a", rows: [{ id: "a" }] }] };
const datasetB = { tables: [{ name: "b", rows: [{ id: "b" }] }] };

test("x-dataset ignores an older source result that completes last", async () => {
    const loader = createLoader();
    const component = setup(loader);
    component.state.src = "dataset:a";
    component.state.src = "dataset:b";

    loader.requests.get("dataset:b").resolve(datasetB);
    await component.flush();
    assert.equal(component.state.value, datasetB);

    loader.requests.get("dataset:a").resolve(datasetA);
    await component.flush();
    assert.equal(component.state.value, datasetB);
    assert.equal(component.state.tables[0].name, "b");
    assert.deepEqual(component.state.tables[0].rows, datasetB.tables[0].rows);
});

test("x-dataset clearing src invalidates pending work and clears only source-derived values", async () => {
    const loader = createLoader();
    const component = setup(loader);
    component.state.src = "dataset:a";
    component.state.src = "";
    loader.requests.get("dataset:a").resolve(datasetA);
    await component.flush();
    assert.equal(component.state.value, null);

    component.state.src = "dataset:b";
    loader.requests.get("dataset:b").resolve(datasetB);
    await component.flush();
    component.state.src = "";
    await component.flush();
    assert.equal(component.state.value, null);

    component.state.src = "dataset:direct";
    component.state.value = datasetA;
    component.state.src = "";
    loader.requests.get("dataset:direct").resolve(datasetB);
    await component.flush();
    assert.equal(component.state.value, datasetA);
});

test("x-dataset ignores an obsolete failure and accepts the current result", async () => {
    const loader = createLoader();
    const component = setup(loader);
    component.state.src = "dataset:a";
    component.state.src = "dataset:b";
    loader.requests.get("dataset:a").reject(new Error("obsolete"));
    loader.requests.get("dataset:b").resolve(datasetB);
    await component.flush();
    assert.equal(component.state.value, datasetB);
});

test("x-dataset direct values invalidate pending source results", async () => {
    const loader = createLoader();
    const component = setup(loader);
    component.state.src = "dataset:a";
    component.state.value = datasetB;
    loader.requests.get("dataset:a").resolve(datasetA);
    await component.flush();
    assert.equal(component.state.value, datasetB);
    assert.equal(component.state.tables[0].name, "b");
    assert.deepEqual(component.state.tables[0].rows, datasetB.tables[0].rows);
});

test("DataSet validation rejects invalid roots through the normal validation error", async t => {
    t.mock.method(console, "error", () => {});
    for (const value of [null, "dataset", 42, true, [], {}, { tables: "invalid" }]) {
        await assert.rejects(validateDataset("test.json", value), /Invalid dataset: test\.json/);
    }
    await assert.doesNotReject(validateDataset("valid.json", datasetA));
});

test("dataset-url returns valid DataSets and rejects invalid parsed values", async t => {
    t.mock.method(console, "error", () => {});
    const loader = new LoaderDatasetUrl();
    t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => datasetA }));
    assert.equal(await loader.load("valid.json"), datasetA);

    globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => null }));
    await assert.rejects(loader.load("invalid.json"), /Invalid dataset: invalid\.json/);
});
