import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import home from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-home/components/x-home.js";
import page from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-home/pages/index.js";
import demo from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/03-navigation/07-home.js";
import componentSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/component.schema.json" with { type: "json" };
import pageSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json" with { type: "json" };
import contractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import moduleSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/module.schema.json" with { type: "json" };
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Events from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/scoped/events.js";

const key = "x-home.favorites";
const rootAssets = "/_assets/root/1.0.0.hash/pages";
const homeAssets = "/_assets/x-home/0.9.0.hash";
const readManifest = module => JSON.parse(readFileSync(new URL(`../../src/DProjects.XShell/Resources/DProjects.XShell/${module}/manifest.jsonc`, import.meta.url), "utf8")
    .replace(/^\s*\/\/[^\r\n]*/gm, ""));
const manifest = readManifest("x-home").modules["x-home"];
const homeMenu = manifest.menus.navigation.map(item => ({...item, href: homeAssets + item.href}));

function setup({ saved, delayedRead } = {}) {
    // Exercise composition, route selection and scoped event dispatch with in-memory Preferences.
    const bus = new EventTarget();
    bus.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, {detail}));
    const config = {app: {basePath: "/app"}, modules: {root: {}, "x-home": {}}, xshell: {assets: {basePath: "/_assets"}}};
    const areas = new Areas({bus, config}, {
        default: "main", definitions: {main: {modules: ["root"], icon: "main-icon", description: "Main Area"},
            launcher: {prefix: "launcher", modules: ["x-home"]}, empty: {prefix: "empty"}}
    });
    let dynamic = [{label: "Reports", path: "reports", href: rootAssets + "/reports.js", icon: "reports-icon"}];
    areas.registerSource("live", {dependsOn: ["test:refresh"], resolve: () => dynamic});
    const menus = {
        root: [
            {label: "Start", path: "start", href: rootAssets + "/index.js"},
            {label: "Group", path: "folder", childrenSource: "live", children: [
                {label: "Command", command: "command:run"},
                {label: "Invalid", href: "javascript:void(0)"},
                {label: "Other", href: rootAssets + "/other.js"},
                {label: "Asset alias", path: rootAssets + "/asset.js", href: rootAssets + "/asset.js"}
            ]}
        ],
        "x-home": homeMenu
    };
    areas.init({modules: {getModuleById: id => ({id, config: {menus: {navigation: menus[id]}}})}});
    const navigation = new Navigation({areas, bus, config, resolver: {
        resolve: resource => resource === "page:x-home:/pages/index.js" ? {path: homeAssets + "/pages/index.js"} : null
    }}, {mode: "hash"}, {container: {}});
    const navigated = [];
    navigation._stackToBrowser = stack => navigated.push(stack[0].href);
    let firstRead = delayedRead;
    const preferences = {
        async get(name, fallback) {
            assert.equal(name, key);
            if (firstRead) {
                const pending = firstRead;
                firstRead = null;
                return pending;
            }
            return saved ?? fallback;
        },
        async set(name, value) {
            assert.equal(name, key);
            saved = structuredClone(value);
            bus.emit("preferences:changed", {name});
        }
    };
    function mount(areaId = "") {
        const state = Object.assign(new EventTarget(), structuredClone(home.state), {areaId});
        const events = new Events(command => controller[command]());
        const controller = home.controller({state, events, areas, bus, navigation, preferences, config});
        const loaded = controller.load();
        return {state, controller, loaded, dispose() {controller.unload(); events.dispose();}};
    }
    return {areas, bus, mount, navigation, navigated, read: () => saved,
        updateMenu(items) {dynamic = items; bus.emit("test:refresh");},
        changeArea(src) {bus.emit("xshell:navigation:end", {src});},
        preferences};
}

const toggle = (controller, favorite) => controller.toggleFavorite({event: {currentTarget: {dataset: {favorite}}}});

test("Home module, Component, Page and cookbook demo use the existing schemas and composition", () => {
    const effective = {...manifest, assets: {path: homeAssets, url: "https://example.test/x-home/"}, files: [],
        configUrl: "https://example.test/x-home/manifest.json", menus: {navigation: homeMenu}};
    const check = (value, schema) => {
        const definition = Object.fromEntries(Object.entries(value).map(([name, item]) => [name, typeof item === "function" ? {} : item]));
        const result = new JsonValidator().validate(definition, schema, {"./contract.schema.json": contractSchema});
        assert.equal(result.valid, true, JSON.stringify(result.errors));
    };
    check(effective, moduleSchema);
    check(home, componentSchema);
    check(page, pageSchema);
    check(demo, pageSchema);
    assert.equal(manifest.dependencies.x, "module:x:latest");
    assert.equal(page.meta.title, "Home");
    assert.equal(page.contract.properties.areaId.query, true);
    assert.equal(page.dependencies.home, "component:x-home");
    assert.match(page.template, /<x-home x-attr:area-id="state.areaId">/);

    const cookbook = readManifest("x-demo");
    const options = cookbook.xshell.services.areas.options;
    assert.equal(options.default, "cookbook");
    assert.deepEqual(options.definitions.cookbook.modules, ["x-demo"]);
    assert.deepEqual(options.definitions.launcher.modules, ["x-home"]);
    assert.equal(cookbook.modules["x-demo"].dependencies["x-home"], "module:x-home:latest");
    const {areas, navigation} = setup();
    assert.equal(areas.getArea("launcher").home, "/launcher/home");
    assert.equal(navigation.buildUrlAbsolute({href: "page:x-home:/pages/index.js"}), "/app/#!/launcher/home");
});

test("Home discovers Area tiles and only actionable Pages, including nested Pages", async () => {
    const app = setup();
    const {state, controller, loaded} = app.mount();
    await loaded;
    const [main, empty, launcher] = state.areaTiles;
    assert.deepEqual([main.label, main.description, main.icon, main.current, main.link.href],
        ["main", "Main Area", "main-icon", true, "/start"]);
    assert.equal(empty.link, null);
    assert.equal(launcher.link.href, "/launcher/home");
    assert.deepEqual(state.quickLinks.map(link => [link.label, link.href, link.favoriteId, link.icon]), [
        ["Start", "/start", "/start", "x-page"],
        ["Other", rootAssets + "/other.js", null, "x-page"],
        ["Asset alias", rootAssets + "/asset.js", null, "x-page"],
        ["Reports", "/reports", "/reports", "reports-icon"]
    ]);
    assert.deepEqual(state.favorites, []);
    app.changeArea("/launcher/home");
    assert.equal(state.areaTiles.find(area => area.current).id, "launcher");
    assert.equal(state.quickLinks[0].label, "Home");
    assert.equal(state.areaTiles[0].link.url, "/app/#!/start");
    await controller.openArea({event: {button: 0, currentTarget: {dataset: {area: "main"}}, preventDefault() {}}});
    assert.deepEqual(app.navigated, ["/start"]);

    state.areaId = "main";
    state.dispatchEvent(new Event("change:areaId"));
    assert.equal(state.quickLinks[0].label, "Start");
    state.areaId = "missing";
    state.dispatchEvent(new Event("change:areaId"));
    assert.deepEqual(state.quickLinks, []);
});

test("Home restores, deduplicates, pins and unpins stable favorites as menus change", async () => {
    const app = setup({saved: ["/reports", "/reports", "/missing", null, rootAssets + "/asset.js"]});
    const {controller, state, loaded} = app.mount();
    await loaded;
    assert.deepEqual(state.favorites.map(link => link.label), ["Reports"]);
    assert.equal(state.quickLinks.at(-1).pinLabel, "Unpin");
    app.updateMenu([]);
    assert.deepEqual(state.favorites, []);
    assert.ok(!state.quickLinks.some(link => link.label === "Reports"));
    app.updateMenu([{label: "New Reports", path: "reports", href: rootAssets + "/new-reports.js"}]);
    assert.deepEqual(state.favorites.map(link => link.label), ["New Reports"]);

    await toggle(controller, "/start");
    assert.deepEqual(app.read(), ["/reports", "/missing", "/start"]);
    await toggle(controller, "/reports");
    await toggle(controller, rootAssets + "/asset.js");
    assert.deepEqual(app.read(), ["/missing", "/start"]);
    const other = app.mount("launcher");
    await other.loaded;
    assert.deepEqual(other.state.favorites.map(link => link.label), ["Start"]);
    const refreshed = controller.restoreFavorites();
    await app.preferences.set(key, ["/launcher/home"]);
    await refreshed;
    await Promise.resolve();
    assert.deepEqual(state.favorites.map(link => link.label), ["Home"]);
});

test("A pending preference read cannot overwrite a pin or update an unloaded Component", async () => {
    const initial = Promise.withResolvers();
    const app = setup({delayedRead: initial.promise});
    const {controller, state, loaded} = app.mount();
    await toggle(controller, "/start");
    initial.resolve(["/reports"]);
    await loaded;
    assert.deepEqual(state.favorites.map(link => link.label), ["Start"]);

    const pending = Promise.withResolvers();
    const anotherApp = setup({delayedRead: pending.promise});
    const detached = anotherApp.mount();
    detached.dispose();
    pending.resolve(["/reports"]);
    await detached.loaded;
    anotherApp.changeArea("/launcher/home");
    assert.deepEqual(detached.state.favorites, []);
    assert.equal(detached.state.areaTiles.find(area => area.current).id, "main");
});

test("Concurrent launcher instances preserve distinct pins", async () => {
    const app = setup();
    const first = app.mount();
    const second = app.mount();
    await Promise.all([first.loaded, second.loaded]);
    await Promise.all([toggle(first.controller, "/start"), toggle(second.controller, "/reports")]);
    assert.deepEqual(app.read(), ["/start", "/reports"]);
    assert.deepEqual(first.state.favorites.map(link => link.favoriteId), app.read());
    assert.deepEqual(second.state.favorites.map(link => link.favoriteId), app.read());
});
