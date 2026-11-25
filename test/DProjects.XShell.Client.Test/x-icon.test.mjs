import assert from "node:assert/strict";
import test from "node:test";

import iconDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-icon.js";

test("x-icon inherits the container text color through its stroke", () => {
    assert.match(iconDefinition.style, /:host svg \{[^}]*fill:none;[^}]*stroke:currentcolor;/);
    assert.doesNotMatch(iconDefinition.style, /fill:currentcolor/);
});

test("x-icon size variants only change dimensions", () => {
    assert.match(iconDefinition.style, /:host\(\.size-x2\) svg \{height:2em;width:2em;\}/);
});
