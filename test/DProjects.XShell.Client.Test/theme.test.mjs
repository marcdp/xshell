import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ThemeContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/contracts/theme.json" with { type: "json" };
import XModule from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/module.js";
import settingsDefinition from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/pages/settings.js";
import Theme from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/services/theme-default.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import ServiceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with { type: "json" };
import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };

const stylesDirectory = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/styles/", import.meta.url);
const css = readFileSync(new URL("index.css", stylesDirectory), "utf8");
const xDirectory = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/", import.meta.url);
const xshellDirectory = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/", import.meta.url);

async function withThemeEnvironment(saved, callback) {
    const attributes = new Map([["data-theme", "stale"]]);
    const storage = new Map();
    const emitted = [];
    const preferences = {
        async get(name, defaultValue) { return storage.has(name) ? storage.get(name) : defaultValue; },
        async set(name, value) { storage.set(name, value); }
    };
    if (saved !== undefined) storage.set("xshell.theme", saved);

    const originalDocument = globalThis.document;

    globalThis.document = {
        documentElement: {
            removeAttribute(name) { attributes.delete(name); },
            setAttribute(name, value) { attributes.set(name, value); }
        }
    };
    try {
        await callback({
            attributes,
            storage,
            preferences,
            emitted,
            bus: { emit(type, detail) { emitted.push({ type, detail }); } }
        });
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test("X theme variables use one native light-dark definition", () => {
    assert.match(css, /:root\s*\{[\s\S]*?color-scheme:\s*light dark;/);
    assert.match(css, /:root\[data-theme="light"\]\s*\{\s*color-scheme:\s*light;/);
    assert.match(css, /:root\[data-theme="dark"\]\s*\{\s*color-scheme:\s*dark;/);

    const expectedDeclarations = [
        "--x-color-background-page: light-dark(#FFFFFF, #121314);",
        "--x-color-text: light-dark(#303030, #DDDDDD);",
        "--x-layout-main-border: 1px light-dark(#B4B4BB, #313236) solid;",
        "--x-button-background: light-dark(var(--x-color-background), transparent);",
        "--x-datafield-border-focus: light-dark(#444444, #888899);",
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

test("theme initializes missing and invalid preferences to system", async () => {
    for (const saved of [undefined, "sepia"]) {
        await withThemeEnvironment(saved, async ({ attributes, bus, emitted, preferences }) => {
            const theme = new Theme({ bus, preferences });
            await settle();

            assert.equal(theme.mode, "system");
            assert.deepEqual(theme.getModes(), ["system", "light", "dark"]);
            assert.equal(attributes.has("data-theme"), false);
            assert.deepEqual(emitted, []);
        });
    }
});

test("theme restores saved light and dark preferences", async () => {
    for (const saved of ["light", "dark"]) {
        await withThemeEnvironment(saved, async ({ attributes, bus, emitted, preferences }) => {
            const theme = new Theme({ bus, preferences });
            await settle();

            assert.equal(theme.mode, saved);
            assert.equal(attributes.get("data-theme"), saved);
            assert.deepEqual(emitted, [{ type: "x:theme:changed", detail: { mode: saved } }]);
        });
    }
});

test("setMode applies and announces changes immediately, then persists them in order", async () => {
    await withThemeEnvironment("system", async ({ attributes, storage, bus, emitted, preferences }) => {
        const theme = new Theme({ bus, preferences });
        await settle();
        const snapshots = [];
        bus.emit = (type, detail) => {
            snapshots.push({ mode: theme.mode, attribute: attributes.get("data-theme"), stored: storage.get("xshell.theme") });
            emitted.push({ type, detail });
        };

        theme.setMode("light");
        assert.equal(theme.mode, "light");
        assert.equal(attributes.get("data-theme"), "light");
        assert.equal(storage.get("xshell.theme"), "system");

        theme.setMode("dark");
        assert.equal(attributes.get("data-theme"), "dark");

        theme.setMode("system");
        await settle();
        assert.equal(attributes.has("data-theme"), false);
        assert.equal(storage.get("xshell.theme"), "system");
        assert.deepEqual(emitted, [
            { type: "x:theme:changed", detail: { mode: "light" } },
            { type: "x:theme:changed", detail: { mode: "dark" } },
            { type: "x:theme:changed", detail: { mode: "system" } }
        ]);
        assert.deepEqual(snapshots.map(item => [item.mode, item.attribute]), [["light", "light"], ["dark", "dark"], ["system", undefined]]);
        assert.equal(emitted.some(event => event.type === "xshell:theme:change"), false);
    });
});

test("toggleMode cycles system, light, dark, and system with one event per change", async () => {
    await withThemeEnvironment("system", async ({ storage, bus, emitted, preferences }) => {
        const theme = new Theme({ bus, preferences });
        await settle();

        theme.toggleMode();
        assert.equal(theme.mode, "light");
        assert.equal(emitted.length, 1);
        theme.toggleMode();
        assert.equal(theme.mode, "dark");
        assert.equal(emitted.length, 2);
        theme.toggleMode();
        await settle();
        assert.equal(theme.mode, "system");
        assert.equal(emitted.length, 3);
        assert.equal(storage.get("xshell.theme"), "system");
        assert.deepEqual(emitted, [
            { type: "x:theme:changed", detail: { mode: "light" } },
            { type: "x:theme:changed", detail: { mode: "dark" } },
            { type: "x:theme:changed", detail: { mode: "system" } }
        ]);
    });
});

test("invalid and repeated modes do not apply or emit notifications", async () => {
    await withThemeEnvironment("light", async ({ attributes, storage, bus, emitted, preferences }) => {
        const theme = new Theme({ bus, preferences });
        await settle();

        theme.setMode("sepia");
        theme.setMode("light");
        assert.equal(theme.mode, "light");
        assert.equal(attributes.get("data-theme"), "light");
        assert.equal(storage.get("xshell.theme"), "light");
        assert.deepEqual(emitted, [{ type: "x:theme:changed", detail: { mode: "light" } }]);

        theme.setMode("dark");
        theme.setMode("dark");
        assert.deepEqual(emitted.slice(1), [
            { type: "x:theme:changed", detail: { mode: "dark" } }
        ]);
    });
});

test("a selection during restoration wins over the saved theme", async () => {
    await withThemeEnvironment("dark", async ({ attributes, storage, bus, emitted, preferences }) => {
        let finishRead;
        preferences.get = () => new Promise(resolve => { finishRead = resolve; });
        const theme = new Theme({ bus, preferences });
        theme.setMode("light");
        finishRead("dark");
        await settle();
        assert.equal(theme.mode, "light");
        assert.equal(attributes.get("data-theme"), "light");
        assert.equal(storage.get("xshell.theme"), "light");
        assert.deepEqual(emitted, [{type:"x:theme:changed", detail:{mode:"light"}}]);
    });
});

test("theme read and write failures leave the UI responsive", async () => {
    await withThemeEnvironment(undefined, async ({ attributes, bus, preferences }) => {
        preferences.get = async () => { throw new Error("read failed"); };
        let writes = 0;
        preferences.set = async () => { writes++; throw new Error("write failed"); };
        const theme = new Theme({ bus, preferences });
        await settle();
        theme.setMode("dark");
        theme.toggleMode();
        await settle();
        assert.equal(theme.mode, "system");
        assert.equal(attributes.has("data-theme"), false);
        assert.equal(writes, 2);
    });
});

test("theme contract validates and the configured service resolves as a singleton", async () => {
    assert.equal(new JsonValidator().validate(ThemeContract, ServiceSchema, {"./contract.schema.json":ContractSchema}).valid, true);
    assert.deepEqual(ThemeContract.events["x:theme:changed"], {
        description: "Emitted on the Bus when the selected theme mode changes.",
        detail: {
            mode: {
                type: "string",
                required: true,
                description: "The newly selected theme mode."
            }
        }
    });
    assert.equal(Object.hasOwn(ThemeContract.events, "xshell:theme:change"), false);

    await withThemeEnvironment("dark", async ({ bus, preferences }) => {
        const contractItem = {
            id: "theme",
            url: "https://example.test/contracts/theme.json",
            moduleId: "x",
            contract: ThemeContract,
            size: 1,
            status: "loaded",
            time: 0
        };
        const config = {
            app: { baseUrl: "https://example.test/" },
            modules: { x: { files: [{ path: "/services/theme.js", size: 1 }] } },
            xshell: { services: { theme: { contract: "theme", implementation: "/services/theme.js" } } }
        };
        const services = new Services({
            config,
            loader: { async load() { return Theme; } },
            contracts: { getContractItemById() { return contractItem; } },
            areas: { getModuleId() { return "x"; } },
            bus
        });

        services.register("bus", bus);
        services.register("preferences", preferences);
        await services.init();
        assert.equal(services.getServiceInfo("theme").state, "registered");
        const theme = services.resolve("theme");
        await settle();
        assert.strictEqual(services.resolve("theme"), theme);
        assert.equal(theme.mode, "dark");
        assert.equal(services.getServiceInfo("theme").state, "created");
    });
});

test("XShell initializes services before modules and navigation", () => {
    const source = readFileSync(new URL("xshell.js", xshellDirectory), "utf8");
    const servicesInit = source.indexOf("await this._services.init()");
    const modulesResolve = source.indexOf('const modules = await this._services.initialize("modules")');
    const areasResolve = source.indexOf('const areas = this._services.resolve("areas")');
    const areasInit = source.indexOf("areas.init({ modules })");
    const navigationInit = source.indexOf('await this._services.initialize("navigation")');

    assert.ok(servicesInit >= 0);
    assert.ok(areasResolve > servicesInit);
    assert.ok(modulesResolve > areasResolve);
    assert.ok(areasInit > modulesResolve);
    assert.ok(navigationInit > areasInit);
});

test("the x module registers and resolves theme through controller injection", () => {
    const moduleConfig = readFileSync(new URL("manifest.jsonc", xDirectory), "utf8");
    let resolutions = 0;

    assert.match(moduleConfig, /"theme"\s*:\s*\{\s*"contract"\s*:\s*"theme"\s*,\s*"implementation"\s*:\s*"\/services\/theme-default\.js"/);
    assert.equal(existsSync(new URL("module.js", xDirectory)), true);
    new XModule({ get theme() { resolutions++; return {}; } });
    assert.equal(resolutions, 1);

    const source = readFileSync(new URL("module.js", xDirectory), "utf8");
    assert.doesNotMatch(source, /localStorage|setTheme|toggleTheme|xshell:theme:change|x:theme:changed/);
});

test("settings uses the injected theme service and preserves language selection", () => {
    const listeners = new Map();
    const selectedThemes = [];
    const selectedLanguages = [];
    const state = { ...settingsDefinition.state };
    const theme = {
        mode: "dark",
        getModes() { return ["system", "light", "dark"]; },
        setMode(mode) { selectedThemes.push(mode); }
    };
    const i18n = {
        config: {
            langs: [
                { id: "en", label: "EN" },
                { id: "es", label: "ES" }
            ]
        },
        getDefaultLang() { return "es"; },
        setLanguage(language) { selectedLanguages.push(language); }
    };
    const controller = settingsDefinition.controller({
        state,
        theme,
        i18n,
        bus: {},
        events: { on(target, name, handler) { listeners.set(name, handler); } }
    });

    controller.load();
    assert.equal(state.theme, "dark");
    assert.deepEqual(state.themes, [
        { value: "system", label: "System" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" }
    ]);
    assert.equal(state.language, "es");
    assert.deepEqual(state.languages, [{ value: "en", label: "EN" }, { value: "es", label: "ES" }]);

    theme.mode = "light";
    listeners.get("x:theme:changed")();
    assert.equal(state.theme, "light");

    state.theme = "light";
    listeners.get("change:theme")();
    state.language = "en";
    listeners.get("change:language")();
    assert.deepEqual(selectedThemes, ["light"]);
    assert.deepEqual(selectedLanguages, ["en"]);

    const source = readFileSync(new URL("pages/settings.js", xDirectory), "utf8");
    assert.doesNotMatch(source, /moduleController|localStorage|debugger/);
});
