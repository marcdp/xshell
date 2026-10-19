import assert from "node:assert/strict";
import test from "node:test";

test("HTML utilities import without a DOM", async () => {
    assert.equal("document" in globalThis, false);
    await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/utils/html.js");
    assert.equal("document" in globalThis, false);
});
