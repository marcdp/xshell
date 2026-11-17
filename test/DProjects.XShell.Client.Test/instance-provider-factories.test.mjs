import assert from "node:assert/strict";
import test from "node:test";

import FilesystemFile from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-file.js";
import FilesystemHttp from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-http.js";
import FilesystemMem from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-mem.js";
import FilesystemOpfs from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-filesystem/js/filesystem-opfs.js";

test("instance providers accept the shared factory context", () => {
    // Create every filesystem provider through the object-based factory contract.
    const services = {};
    const providers = [
        FilesystemMem.create({url: "mem", services}),
        FilesystemHttp.create({url: "https://example.test/files", services}),
        FilesystemOpfs.create({url: "opfs", services}),
        FilesystemFile.create({url: "file", services})
    ];

    assert.deepEqual(providers.map(provider => provider.url), ["mem://", "https://example.test/files", "opfs:", "file:"]);
});
