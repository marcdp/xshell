import assert from "node:assert/strict";
import test from "node:test";

import { createZip } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/utils/zip.js";

const modified = new Date(2024, 0, 2, 3, 4, 6);
const files = new Map([
    ["/docs", {type: "directory", modified}],
    ["/docs/readme.txt", {type: "file", modified, bytes: new TextEncoder().encode("hello")}]
]);

function createFilesystem() {
    return {
        async getEntry(path) {
            return files.get(path);
        },
        async *getEntries(path) {
            if (path === "/docs") yield {name: "readme.txt", path: "/docs/readme.txt"};
        },
        async loadReadStream(path) {
            const bytes = files.get(path).bytes;
            return new ReadableStream({start(controller) { controller.enqueue(bytes); controller.close(); }});
        }
    };
}

test("createZip reports entry-oriented progress without changing the archive", async () => {
    const filesystem = createFilesystem();
    const withoutLogger = await createZip(filesystem, ["/docs"]);
    const messages = [];
    const withLogger = await createZip(filesystem, ["/docs"], {logger: message => messages.push(message)});

    assert.deepEqual(new Uint8Array(await withLogger.arrayBuffer()), new Uint8Array(await withoutLogger.arrayBuffer()));
    assert.equal(withLogger.type, "application/zip");
    assert.ok(messages.some(message => message.includes("Adding directory: docs/")));
    assert.ok(messages.some(message => message.includes("Adding file: docs/readme.txt")));
    assert.ok(messages.some(message => message.includes("Added file: docs/readme.txt") && message.includes("5 bytes")));
    assert.ok(messages.some(message => message.includes("Writing ZIP central directory")));
    assert.ok(messages.some(message => message.includes("ZIP archive finalized with 2 entries")));
    assert.ok(messages.indexOf("Adding file: docs/readme.txt") < messages.indexOf("Added file: docs/readme.txt (5 bytes)"));
});

test("createZip rejects a non-function logger", async () => {
    await assert.rejects(createZip(createFilesystem(), ["/docs"], {logger: true}), {
        name: "TypeError",
        message: "logger must be a function"
    });
});
