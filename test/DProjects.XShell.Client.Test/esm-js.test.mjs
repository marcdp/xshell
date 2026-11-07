import assert from "node:assert/strict";
import test from "node:test";

import LoaderEsmJs from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/esm-js.js";

test("esm-js imports an ES module and returns its default export", async () => {
    const source = "data:text/javascript," + encodeURIComponent("export const named = 'kept'; export default { value: 42 };");

    const result = await new LoaderEsmJs().load(source, {});

    assert.deepEqual(result, { value: 42 });
});
