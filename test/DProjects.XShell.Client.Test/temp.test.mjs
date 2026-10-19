import assert from "node:assert/strict";
import test from "node:test";

import Temp from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/temp.js";

class FakeFile {
    constructor(name) {
        this.name = name;
    }
}

class FakeFormData {
    entries = [];

    append(name, value) {
        this.entries.push([name, value]);
    }
}

class FakeXMLHttpRequest {
    static instances = [];

    listeners = new Map();
    uploadListeners = new Map();
    upload = {
        addEventListener: (name, listener) => this.uploadListeners.set(name, listener)
    };

    constructor() {
        FakeXMLHttpRequest.instances.push(this);
    }

    addEventListener(name, listener) {
        this.listeners.set(name, listener);
    }

    open(method, url) {
        this.method = method;
        this.url = url;
    }

    send(body) {
        this.body = body;
    }

    progress(event) {
        this.uploadListeners.get("progress")?.(event);
    }

    respond(status, responseText, statusText = "") {
        this.status = status;
        this.responseText = responseText;
        this.statusText = statusText;
        this.listeners.get("load")?.();
    }

    fail() {
        this.listeners.get("error")?.();
    }
}

function installBrowserFakes() {
    const previous = {
        File: globalThis.File,
        FormData: globalThis.FormData,
        XMLHttpRequest: globalThis.XMLHttpRequest
    };
    globalThis.File = FakeFile;
    globalThis.FormData = FakeFormData;
    globalThis.XMLHttpRequest = FakeXMLHttpRequest;
    return () => {
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete globalThis[name];
            else globalThis[name] = value;
        }
    };
}

test("Temp uploads in parallel, preserves input order, reports named progress, and converts failures to error strings", async () => {
    const restore = installBrowserFakes();
    FakeXMLHttpRequest.instances = [];
    try {
        const temp = new Temp({ config: { xshell: { temp: { url: "https://example.test/temp///" } } } });
        const first = new FakeFile("first.txt");
        const second = new FakeFile("second.txt");
        const progress = [];
        const resultPromise = temp.upload([first, second], value => progress.push(value));

        assert.equal(FakeXMLHttpRequest.instances.length, 2);
        const [firstRequest, secondRequest] = FakeXMLHttpRequest.instances;
        assert.equal(firstRequest.method, "POST");
        assert.equal(firstRequest.url, "https://example.test/temp");
        assert.deepEqual(firstRequest.body.entries, [["file", first]]);
        assert.deepEqual(secondRequest.body.entries, [["file", second]]);

        firstRequest.progress({ lengthComputable: true, loaded: 25, total: 100 });
        secondRequest.progress({ lengthComputable: false, loaded: 1, total: 2 });
        secondRequest.respond(500, "ignored", "Server Error");
        firstRequest.respond(201, "temp:/first.txt");

        assert.deepEqual(await resultPromise, ["temp:/first.txt", "error: HTTP 500: Server Error"]);
        assert.deepEqual(progress, [{ name: "first.txt", loaded: 25, total: 100, percent: 25 }]);
    } finally {
        restore();
    }
});

test("Temp accepts one File and preserves network-error and URL-resolution behavior", async () => {
    const restore = installBrowserFakes();
    FakeXMLHttpRequest.instances = [];
    try {
        const temp = new Temp({ config: { xshell: { temp: { url: "https://example.test/temp/" } } } });
        const resultPromise = temp.upload(new FakeFile("failed.txt"));
        FakeXMLHttpRequest.instances[0].fail();

        assert.deepEqual(await resultPromise, ["error: Upload failed"]);
        assert.equal(
            temp.getAbsoluteUrl("temp:/folder/file.txt?size=123"),
            "https://example.test/temp/folder/file.txt?size=123"
        );
    } finally {
        restore();
    }
});
