import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import layoutDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-main.js";

const stylesDirectory = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/styles/", import.meta.url);
const css = readFileSync(new URL("index.css", stylesDirectory), "utf8");

test("X theme variables use one native light-dark definition", () => {
    assert.match(css, /:root\s*\{[\s\S]*?color-scheme:\s*light dark;/);
    assert.match(css, /:root\[data-theme="light"\]\s*\{\s*color-scheme:\s*light;/);
    assert.match(css, /:root\[data-theme="dark"\]\s*\{\s*color-scheme:\s*dark;/);

    const expectedDeclarations = [
        "--x-color-background-page: light-dark(#FFFFFF, #121314);",
        "--x-color-text: light-dark(#303030, #DDDDDD);",
        "--x-layout-main-border: 1px light-dark(#B4B4BB, #313236) solid;",
        "--x-button-background: light-dark(var(--x-color-background-x-gray), transparent);",
        "--x-datafield-border-focus: light-dark(#B4B4BB, #888899);",
        "--x-tooltip-color: light-dark(#ffffff, #202124);"
    ];
    for (const declaration of expectedDeclarations) assert.ok(css.includes(declaration), declaration);

    for (const name of [
        "--x-color-primary", "--x-color-text", "--x-color-background-page",
        "--x-layout-main-border", "--x-markdown-code-color", "--x-button-background",
        "--x-datafield-border", "--x-dropdown-background", "--x-notice-background-info",
        "--x-object-string", "--x-skeleton-background", "--x-tooltip-background"
    ]) {
        assert.equal(css.match(new RegExp(`${name.replaceAll("-", "\\-")}:`, "g"))?.length, 1, `${name} is declared once`);
    }

    assert.equal(existsSync(new URL("light.css", stylesDirectory)), false);
    assert.equal(existsSync(new URL("dark.css", stylesDirectory)), false);
    assert.doesNotMatch(css, /@import\s+url\(["'](?:light|dark)\.css["']\)/);
});

test("the datafield border retains its theme-specific width", () => {
    assert.match(css, /--x-datafield-border-width:\s*\.1em;/);
    assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{\s*--x-datafield-border-width:\s*\.05em;/);
    assert.match(css, /:root\[data-theme="dark"\]\s*\{\s*--x-datafield-border-width:\s*\.05em;/);
});

test("the main layout applies and persists system, light, and dark modes", async () => {
    const attributes = new Map([["data-theme", "dark"]]);
    const storage = new Map([["xshell.theme", "system"]]);
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;

    globalThis.document = {
        documentElement: {
            removeAttribute(name) { attributes.delete(name); },
            setAttribute(name, value) { attributes.set(name, value); }
        }
    };
    globalThis.localStorage = {
        getItem(name) { return storage.get(name) ?? null; },
        setItem(name, value) { storage.set(name, value); }
    };

    try {
        const state = { ...layoutDefinition.state, keyword: "" };
        const controller = layoutDefinition.controller({
            state,
            events: { on() {} },
            areas: {},
            bus: {},
            getPage() { return null; },
            host: {}
        });

        await controller.load();
        assert.equal(state.theme, "system");
        assert.equal(state.themeIcon, "x-monitor");
        assert.equal(attributes.has("data-theme"), false);

        await controller.toggleTheme();
        assert.equal(state.theme, "light");
        assert.equal(attributes.get("data-theme"), "light");
        assert.equal(storage.get("xshell.theme"), "light");

        await controller.toggleTheme();
        assert.equal(state.theme, "dark");
        assert.equal(attributes.get("data-theme"), "dark");
        assert.equal(storage.get("xshell.theme"), "dark");

        await controller.toggleTheme();
        assert.equal(state.theme, "system");
        assert.equal(attributes.has("data-theme"), false);
        assert.equal(storage.get("xshell.theme"), "system");
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
        if (originalLocalStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originalLocalStorage;
    }
});
