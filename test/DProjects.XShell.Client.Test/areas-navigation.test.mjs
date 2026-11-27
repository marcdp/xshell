import assert from "node:assert/strict";
import test from "node:test";

import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import Loader from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/loader.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/resolver.js";
import {createThrowingLogger} from "./fixtures/throwing-logger.mjs";

test("Areas rejects malformed global prefixes and segment collisions with Areas or assets", () => {
    // Validate against the effective asset namespace and normalized Area paths.
    const construct = (globalPrefix, areaPrefix = "/area") => new Areas({
        config: { modules: {}, xshell: { assets: { basePath: "/resources/assets" }, services: { navigation: { options: { globalPrefix } } } } },
        bus: { addEventListener() {} }
    }, { default: "main", definitions: { main: { prefix: areaPrefix } } });
    for (const prefix of [null, "", "/", "global", "//elsewhere", "/path//tools", "/space in path", "/global?x", "/global#x",
        "/global/%", "/global/../tools", "/global/%2e", "/global\\tools"]) {
        assert.throws(() => construct(prefix), /globalPrefix must be a non-empty rooted/);
    }
    for (const prefix of ["/area", "/area/tools", "/area/tools/other"]) {
        assert.throws(() => construct("/area/tools/", prefix), /conflicts with Area 'main'/);
    }
    for (const prefix of ["/resources", "/resources/assets", "/resources/assets/global"]) {
        assert.throws(() => construct(prefix), /conflicts with the asset namespace/);
    }
    assert.equal(construct("/area-tools/").globalPrefix, "/area-tools");
    assert.equal(construct(undefined).globalPrefix, "/global");
});

test("Areas identifies modules under a normalized multi-segment assets.basePath", () => {
    const config = { modules: {}, xshell: { assets: { basePath: "/virtual/assets" } } };
    const areas = new Areas({ config, bus: { addEventListener() {} } }, { default: null, definitions: {} });
    assert.equal(areas.getModuleId("/demo/virtual/assets/x/pages/index.js"), "x");
    assert.equal(areas.getModuleId("/demo/virtual/assets/orders/1.4.0.a82c31f943e01abc/pages/index.js"), "orders");
    assert.equal(areas.getModuleId("/demo/_assets/x/pages/index.js"), null);
});

const menusByAreaService = new WeakMap();

function initializeAreas(areas, { bus, config, definitions = {}, registerSources }) {
    const menus = new Menus({ areas, bus, config }, { definitions });
    registerSources?.(menus);
    menus.init();
    areas.init({ menus });
    menusByAreaService.set(areas, menus);
}

function createAreas({ globalPrefix, root = false, bus = {
        addEventListener() {},
        emit() {}
    } } = {}) {
    const config = {
        modules: Object.fromEntries(["customer", "shell", "x-demo"].map(id => [id, { assets: { path: "/_assets/" + id } }])),
        xshell: { assets: { basePath: "/_assets" }, services: { navigation: { options: { globalPrefix } } } }
    };
    const customerRoutes = {
        "/customer/{customerId}": "/_assets/customer/pages/detail.js",
        "/customer-route/{customerId}": "/_assets/customer/pages/route-detail.js"
    };
    const demoRoutes = {
        "/something": "/_assets/x-demo/pages/about.js",
        "/repository/{repositoryId}": "/_assets/x-demo/pages/repository.js?mode=list",
        "/repository/{repositoryId}/projects/{projectId}/items": "/_assets/x-demo/pages/items.js",
        "/repository/{repositoryId}/items": "/_assets/x-demo/pages/items.js",
        "/navigation": "/_assets/x-demo/pages/route-navigation.js",
        "/navigation-route": "/_assets/x-demo/pages/03-navigation/index.js"
    };

    const options = {
        default: "sales",
        definitions: {
            sales: { prefix: "/sales", routes: customerRoutes, menus: { navigation: "customers", tools: "customer-tools", canonical: "customer-canonical" } },
            admin: { prefix: "/admin", routes: customerRoutes, menus: { navigation: "customers", tools: "customer-tools", canonical: "customer-canonical" } },
            main: { prefix: "/main" },
            demo: { prefix: "/demo", routes: demoRoutes, menus: { navigation: "demo-navigation" } },
            ...(root ? { root: { prefix: "", routes: customerRoutes, menus: { navigation: "customers", tools: "customer-tools", canonical: "customer-canonical" } } } : {})
        }
    };
    const definitions = {
        customers: { items: [{
            label: "Customers",
            children: [{ label: "Detail", path: "/detail", href: "/_assets/customer/pages/detail.js" }]
        }] },
        "customer-tools": { items: [{ label: "Tool detail", path: "/tool-detail", href: "/_assets/customer/pages/tool-detail.js" }] },
        "customer-canonical": { items: [{ label: "Canonical only", href: "/_assets/customer/pages/canonical.js" }] },
        "demo-navigation": { sources: [{ source: "demo-runtime-menu-source" }] }
    };
    const areas = new Areas({ config, bus }, options);
    initializeAreas(areas, {
        bus, config, definitions,
        registerSources(menus) {
            menus.registerSource("demo-runtime-menu-source", { resolve: () => [{
                label: "Demo", path: "/", href: "/_assets/x-demo/pages/index.js",
                children: [{ label: "Navigation", path: "/navigation", href: "/_assets/x-demo/pages/03-navigation/index.js" }]
            }] });
        }
    });
    return areas;
}

function createNavigation({ areas = createAreas(), mode = "path", basePath = "", baseUrl = "https://example.test/",
    resolver = null, assetsBasePath = "/_assets", bus = { emit() {} }, container = { querySelectorAll() { return []; } }, logger = new Logger({}) } = {}) {
    return new Navigation({
        logger,
        areas,
        menus: menusByAreaService.get(areas),
        bus,
        config: {
            app: { basePath, baseUrl },
            xshell: { assets: { basePath: assetsBasePath } }
        },
        resolver
    }, { mode }, { container });
}

function resolveNavigationTarget(navigation, href, page = { src: "/" }, params = {}) {
    // Observe the effective Page target through the supported auto-navigation behavior.
    const host = { setAttribute(name, value) { this[name] = value; } };
    void navigation.navigate({ href, params, page: { ...page, host }, open: "auto" });
    return host.src;
}

function createPageResolver() {
    return new Resolver({ config: {
        app: { basePath: "/app", baseUrl: "https://example.test/app/" },
        xshell: { resolver: { page: {
            "x-demo:/{path}": { src: "/_assets/x-demo/{path}", loader: "page-js" },
            "x:/{path}": { src: "/_assets/x/{path}", loader: "page-js" },
            "/_assets/x-demo/{path}.js": { src: "/_assets/x-demo/{path}.js", loader: "page-js" }
        } } }
    }});
}

function createEmbedPage(src) {
    // Capture src assignments to the named outlet.
    const outlet = { setAttribute(name, value) { this[name] = value; } };
    const host = {
        setAttribute(name, value) { this[name] = value; },
        querySelector(selector) { return selector === 'x-page[outlet="content"]' ? outlet : null; }
    };
    return { page: { src, host }, outlet };
}

test("Navigation resolves Page resources through Resolver into public URLs in path and hash modes", () => {
    const href = "page:x-demo:/pages/items.js?repositoryId=12#details";
    const page = { src: "/demo/_assets/x-demo/pages/origin.js" };
    for (const mode of ["path", "hash"]) {
        const navigation = createNavigation({ mode, basePath: "/app", resolver: createPageResolver() });
        assert.ok(["_areas", "_bus", "_config", "_container", "_stack", "_buildUrlFinal", "_resolveCanonicalHref"].every(name => !(name in navigation)));
        const prefix = mode === "hash" ? "/app/#!" : "/app";
        assert.equal(resolveNavigationTarget(navigation, href, page), "/demo/_assets/x-demo/pages/items.js?repositoryId=12#details");
        assert.equal(navigation.buildUrlAbsolute({ href, page, params: { sort: "name" } }), `${prefix}/demo/repository/12/items?sort=name#details`);
        assert.equal(navigation.buildUrlAbsolute({ href: "page:x-demo:/pages/about.js", page }), `${prefix}/demo/something`);
        for (const file of ["secrets.js", "secrets-secret.js", "secrets-passkey.js"]) {
            const path = `/pages/preferences/${file}`;
            assert.equal(navigation.buildUrlAbsolute({ href: `page:x:${path}`, page }), `${prefix}/demo/_assets/x${path}`);
        }
        assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/about.js", page }), `${prefix}/demo/something`);
        assert.equal(navigation.buildUrlAbsolute({ href: "relative.js", page }), `${prefix}/demo/_assets/x-demo/pages/relative.js`);
        for (const external of ["https://example.com", "mailto:user@example.com", "tel:+123456789", "custom:outside"]) {
            assert.equal(navigation.buildUrlAbsolute({ href: external, page }), external);
        }
    }
});

test("Navigation rejects unresolved Page references before generating a browser URL", () => {
    const navigation = createNavigation({ resolver: createPageResolver() });
    assert.throws(() => navigation.buildUrlAbsolute({ href: "page:missing:/pages/index.js" }), /unable to resolve Page reference/);
    assert.throws(() => navigation.buildUrlAbsolute({ href: "page:x-demo:/../index.js" }), /unable to resolve Page reference/);
});

test("Global Page URLs bypass aliases and routes in both modes, even with a root Area", async () => {
    const bus = new EventTarget();
    bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
    const areas = createAreas({ globalPrefix: "/shared/tools/", root: true, bus });
    const prefix = areas.globalPrefix;
    const asset = "/_assets/customer/pages/detail.js";
    const page = { src: "/admin" + asset };
    const changes = [];
    bus.addEventListener("xshell:area:change", event => changes.push(event.detail.areaId));
    bus.emit("xshell:navigation:end", { src: page.src });
    bus.emit("xshell:navigation:end", { src: prefix + asset });
    assert.equal(areas.getCurrentArea().id, "admin");
    assert.deepEqual(changes, ["admin"]);
    assert.deepEqual(areas.getAreas().map(area => area.id).sort(), ["admin", "demo", "main", "root", "sales"]);
    assert.equal(areas.resolveAreaId(prefix + asset), null);
    assert.equal(areas.resolveAreaId(prefix + "?tab=one#test"), null);
    assert.equal(areas.resolveAreaId(prefix + "#test"), null);
    assert.equal(areas.resolveAreaId(prefix + "-extra" + asset), "root");
    assert.equal(areas.resolveAreaId(page.src), "admin");

    for (const [mode, base] of [["path", "/app"], ["hash", "/app/#!"]]) {
        const resolver = new Resolver({ config: { app: { baseUrl: "https://example.test/app/" }, xshell: { resolver: { page: {
            "customer:/pages/detail.js": { src: asset, loader: "page-js" },
            "/_assets/customer/{path}.js": { src: "/_assets/customer/{path}.js", loader: "page-js" }
        } } } } });
        const navigation = createNavigation({ areas, mode, basePath: "/app", resolver });
        const globalSource = prefix + asset + "?tab=one&count=2#summary";
        const globalPage = { src: globalSource };
        assert.equal(navigation.buildUrlAbsolute({
            href: "page:customer:/pages/detail.js?tab=one#summary", page, scope: "global", params: { count: 2 }
        }), base + globalSource);
        for (const href of [globalSource, base + globalSource]) {
            assert.equal(navigation.buildUrlAbsolute({ href, page }), base + globalSource);
        }
        assert.equal(navigation.buildUrlAbsolute({ href: asset, page: globalPage }), base + prefix + asset);
        assert.equal(navigation.buildUrlAbsolute({ href: "./detail.js?tab=other#details", page: globalPage }),
            base + prefix + asset + "?tab=other#details");
        assert.equal(navigation.buildUrlAbsolute({ href: "./editor.js", page: globalPage }), base + prefix + "/_assets/customer/pages/editor.js");
        assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/editor.js", page: globalPage }),
            base + prefix + "/_assets/customer/pages/editor.js");
        assert.equal(navigation.buildUrlAbsolute({ href: page.src, scope: "global", page: globalPage }), base + prefix + asset);
        assert.equal(navigation.buildUrlAbsolute({ href: prefix + asset, scope: "area", page: globalPage }), base + "/admin/detail");
        assert.equal(navigation.buildUrlAbsolute({ href: asset, page: globalPage, scope: "area" }), base + "/admin/detail");
        assert.equal(navigation.buildUrlAbsolute({ href: "/sales/detail", page: globalPage }), base + "/sales/detail");
        assert.equal(navigation.buildUrlAbsolute({ href: "/detail", page: globalPage }), base + "/detail");
        assert.equal(navigation.buildUrlAbsolute({ href: "/detail", page: globalPage, scope: "area" }), base + "/detail");
        assert.equal(navigation.buildUrlAbsolute({ href: asset, page }), base + "/admin/detail");
        assert.equal(navigation.resolveRoute(prefix + "/customer/42"), null);
        assert.throws(() => navigation.buildUrlAbsolute({ href: prefix + "/detail", page }), /must identify a canonical Page resource/);

        // A named embed retains the same resolved global URL.
        const embedded = createEmbedPage(page.src);
        await navigation.navigate({ href: asset, page: embedded.page, scope: "global", open: "embed", outlet: "content" });
        assert.equal(embedded.outlet.src, prefix + asset);
    }
});

test("Global validation uses the effective asset namespace and the Page Resolver", () => {
    const assetsBasePath = "/content/assets";
    const asset = assetsBasePath + "/tool/pages/editor.js";
    const config = { app: { baseUrl: "https://example.test/app/" }, xshell: { resolver: { page: {
        "tool:/pages/editor.js": { src: asset, loader: "page-js" },
        [asset]: { src: asset, loader: "page-js" }
    } } } };
    const navigation = createNavigation({ assetsBasePath, resolver: new Resolver({ config }) });
    const error = /must identify a canonical Page resource under '\/content\/assets'/;
    assert.equal(navigation.buildUrlAbsolute({ href: "page:tool:/pages/editor.js", scope: "global" }), "/global" + asset);
    assert.equal(navigation.buildUrlAbsolute({ href: "/global" + asset + "?mode=edit#details" }), "/global" + asset + "?mode=edit#details");
    for (const href of ["/customers", assetsBasePath, assetsBasePath + "-other/tool.js", "/_assets/tool/pages/editor.js",
        assetsBasePath + "/tool/styles/editor.css", assetsBasePath + "/tool/pages/unrecognized.js", "/global/customers"]) {
        assert.throws(() => navigation.buildUrlAbsolute({ href, scope: "global" }), error);
    }
    assert.equal(navigation.buildUrlAbsolute({ href: "https://example.test/customers", scope: "global" }), "https://example.test/customers");
});

test("A unique root-Area home keeps its native URL when another Area includes the same Page", async t => {
    const rootHome = "/_assets/x-demo/pages/index.js";
    const config = { xshell: { assets: { basePath: "/_assets" } }, modules: { shell: {}, "x-demo": {} } };
    const team = { label: "Team", path: "/home", href: "/_assets/x/pages/home.js" };
    const welcome = { label: "Welcome", path: "/welcome", href: rootHome };
    const definitions = { team: { items: [team, welcome] }, welcome: { items: [welcome] } };
    const bus = new EventTarget();
    const areas = new Areas({ config, bus }, { default: "team", definitions: {
        team: { prefix: "/team", menus: { navigation: "team" } },
        root: { prefix: "", menus: { navigation: "welcome" } }
    } });
    initializeAreas(areas, { bus, config, definitions });

    // An explicit navigation should write the same URL that the native link advertised.
    const host = { src: "/global/_assets/x-demo/pages/editor.js", getAttribute: () => "main" };
    const page = { src: host.src, host };
    const historyUrls = [];
    const previousHistory = globalThis.history;
    globalThis.history = { pushState: (_, title, url) => historyUrls.push(url) };
    t.after(() => { globalThis.history = previousHistory; });
    const navigation = createNavigation({ areas, basePath: "/app", resolver: createPageResolver(), container: { querySelectorAll: () => [host] } });
    const nativeHref = navigation.buildUrlAbsolute({ href: rootHome, page });
    assert.equal(nativeHref, "/app/welcome");
    await navigation.navigate({ href: rootHome, page, open: "top" });
    assert.equal(host.src, rootHome);
    assert.deepEqual(historyUrls, [nativeHref]);
});

test("Navigation diagnoses auto and embed decisions without forwarding addresses or parameters", async t => {
    const {logger, calls: {debug, trace, error: failure}} = await createThrowingLogger(t);
    const navigation = createNavigation({ logger, resolver: createPageResolver() });
    const page = { src: "/demo/_assets/x-demo/pages/origin.js" };
    assert.equal(resolveNavigationTarget(navigation, "page:x-demo:/pages/items.js", page, { repositoryId: "12" }),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=12");
    const embedded = createEmbedPage(page.src);
    await navigation.navigate({ href: "page:x-demo:/pages/about.js", page: embedded.page, open: "embed", outlet: "content" });
    assert.equal(embedded.outlet.src, "/_assets/x-demo/pages/about.js");
    await assert.rejects(navigation.navigate({ href: "page:missing:/pages/index.js?token=private-query#private-fragment", open: "top" }), /unable to resolve Page reference/);
    assert.deepEqual(debug.mock.calls.filter(call => call.arguments[0] === "Navigation: mode selected")
        .map(call => call.arguments[1].mode), ["in-place", "embed"]);
    assert.equal(failure.mock.calls[0].arguments[0], "Navigation: operation failed");
    assert.doesNotMatch(JSON.stringify([...trace.mock.calls, ...debug.mock.calls, ...failure.mock.calls].map(call => call.arguments)),
        /private-query|private-fragment|repositoryId|\/pages\//);
});

for (const mode of ["hash", "path"]) {
    test(`Navigation restores independent stack classes through ${mode} history and reload`, async t => {
        // Exercise the history listeners and DOM reconciliation against a browser-shaped location.
        const previousGlobals = { document: globalThis.document, window: globalThis.window, location: globalThis.location, history: globalThis.history };
        t.after(() => {
            for (const [name, value] of Object.entries(previousGlobals)) {
                if (value === undefined) delete globalThis[name];
                else globalThis[name] = value;
            }
        });
        const urls = [new URL(mode === "hash" ? "/app/#!/demo/repository/12#root" : "/app/demo/repository/12#root", "https://example.test")];
        let position = 0;
        const setUrl = (href, replace = false) => {
            if (!replace) {
                urls.splice(position + 1);
                position++;
            }
            urls[position] = new URL(href, urls[position] ?? urls[position - 1]);
        };
        const location = {
            get pathname() { return urls[position].pathname; },
            get search() { return urls[position].search; },
            get hash() { return urls[position].hash; },
            set hash(value) { setUrl(value); },
            replace(value) { setUrl(value, true); }
        };
        const listeners = {};
        let mounted = [];
        const createElement = () => {
            const attributes = {};
            const events = {};
            return {
                setAttribute(name, value) { attributes[name] = value; if (name === "src") this.src = value; },
                getAttribute(name) { return attributes[name]; },
                addEventListener(name, listener) { events[name] = listener; },
                close() { return events.close({ target: this }); },
                async removePage() { mounted.splice(mounted.indexOf(this), 1); }
            };
        };
        Object.assign(globalThis, {
            location,
            history: { pushState: (_, title, href) => setUrl(href), replaceState: (_, title, href) => setUrl(href, true) },
            window: { addEventListener: (name, listener) => { listeners[name] = listener; } },
            document: { location, createElement }
        });
        const {logger, calls: {error: logged}} = await createThrowingLogger(t);
        const startNavigation = async () => {
            const container = { querySelectorAll: () => mounted, appendChild: page => mounted.push(page) };
            const navigation = createNavigation({ mode, basePath: "/app", resolver: createPageResolver(), container, logger });
            await navigation.init();
            return navigation;
        };
        const go = async delta => {
            position += delta;
            await listeners[mode === "hash" ? "hashchange" : "popstate"]();
        };
        const navigation = await startNavigation();
        const href = "page:x-demo:/pages/items.js#section";
        const origin = { src: mounted[0].src, host: mounted[0] };
        await navigation.navigate({ href, page: origin, open: "stack" });
        assert.equal(Object.hasOwn(navigation.stack[1], "classes"), false);

        const sizes = ["size-compact", "size-narrow", "size-medium", "size-wide", "size-full"];
        for (const size of sizes) {
            const classes = [size];
            await navigation.navigate({ href, page: origin, open: "stack", classes, params: { sort: "name" }, nav: { title: "Items" } });
            classes.push("late-mutation");
            assert.deepEqual(navigation.stack.at(-1).classes, [size]);
            assert.deepEqual(mounted.at(-1).stackClasses, [size]);
            assert.equal(new URL(mounted.at(-1).src, urls[position]).searchParams.has("classes"), false);
        }
        const top = mounted.at(-1);
        const current = { src: top.src, host: top };
        const positionBeforeReplacement = position;
        // Replace only the classes of the same target and keep its host and source.
        const previous = navigation.stack.at(-1);
        await navigation.navigate({ ...previous, page: current, classes: ["size-compact", "caller-style"] });
        assert.equal(mounted.at(-1), top);
        assert.equal(top.src, current.src);
        assert.deepEqual(top.stackClasses, ["size-compact", "caller-style"]);
        await go(-1);
        assert.equal(mounted.at(-1), top);
        assert.deepEqual(top.stackClasses, ["size-full"]);
        await go(1);
        assert.deepEqual(top.stackClasses, ["size-compact", "caller-style"]);
        assert.equal(position, positionBeforeReplacement + 1);

        mounted = [];
        const restored = await startNavigation();
        assert.equal(restored.stack[0].href, "/demo/repository/12#root");
        assert.equal(Object.hasOwn(restored.stack[1], "classes"), false);
        assert.deepEqual(restored.stack.slice(2).map(item => item.classes[0]), [...sizes.slice(0, -1), "size-compact"]);
        assert.deepEqual(restored.stack.at(-1).params, { sort: "name" });
        assert.deepEqual(restored.stack.at(-1).nav, { title: "Items" });
        assert.equal(restored.stack.at(-1).href.endsWith("#section"), true);
        assert.deepEqual(mounted.at(-1).stackClasses, ["size-compact", "caller-style"]);

        await mounted.at(-1).close();
        assert.deepEqual(mounted.at(-1).stackClasses, ["size-wide"]);
        assert.deepEqual(restored.stack.at(-1).classes, ["size-wide"]);
        const entryToReplace = { host: mounted.at(-1), src: mounted.at(-1).src };
        const beforeReplacing = position;
        await restored.navigate({ href: "page:x-demo:/pages/new.js", page: entryToReplace, replace: true });
        assert.equal(position, beforeReplacing);
        assert.equal(mounted.at(-1).stackClasses, undefined);
        assert.deepEqual(mounted.at(-2).stackClasses, ["size-medium"]);
        await restored.navigate({ href: origin.src, page: origin, open: "top", classes: ["size-full"] });
        assert.equal(restored.stack.length, 1);
        assert.equal(Object.hasOwn(restored.stack[0], "classes"), false);

        // Invalid requests leave the existing Page, stack, and history entry intact.
        const before = { position, url: urls[position].href, stack: restored.stack, src: mounted[0].src };
        const error = /must identify a canonical Page resource/;
        await assert.rejects(restored.navigate({ href: "/customers", scope: "global", open: "top" }), error);
        await assert.rejects(restored.navigate({ href: "/global/customers", open: "stack" }), error);
        assert.deepEqual({ position, url: urls[position].href, stack: restored.stack, src: mounted[0].src }, before);

        // Invalid browser destinations cannot replace the valid mounted stack.
        setUrl(mode === "hash" ? "/app/#!/global/customers" : "/app/global/customers", true);
        await listeners[mode === "hash" ? "hashchange" : "popstate"]();
        assert.deepEqual(logged.mock.calls.at(-1).arguments, ["Navigation: browser history restoration failed", {mode}]);
        assert.deepEqual(restored.stack, before.stack);
        assert.equal(mounted[0].src, before.src);
        await assert.rejects(startNavigation(), error);
        assert.equal(mounted[0].src, before.src);
    });
}

test("Navigation embeds explicit asset and Page references while retaining relative, menu and route destinations", async () => {
    const asset = "/_assets/x/0.9.0.dev/pages/about.js";
    const { page, outlet } = createEmbedPage("/main/_assets/shell/0.9.0.dev/pages/origin.js");
    const { page: unprefixedPage, outlet: unprefixedOutlet } = createEmbedPage("/_assets/x-demo/pages/03-navigation/origin.js");
    for (const mode of ["path", "hash"]) {
        for (const basePath of ["/", "/app"]) {
            const navigation = createNavigation({ mode, basePath, resolver: createPageResolver() });
            const appPrefix = basePath === "/" ? "" : basePath;
            const browserPrefix = appPrefix + (mode === "hash" ? "/#!" : "");
            const suffix = "?filter=all%20items#summary";
            const cases = [
                [asset, asset],
                [`/main${asset}`, `/main${asset}`],
                [`#!${asset}#summary`, `${asset}#summary`],
                [`${appPrefix}${asset}${suffix}`, `${asset}?filter=all%20items&sort=name#summary`, { sort: "name" }],
                [`${appPrefix}/main${asset}${suffix}`, `/main${asset}${suffix}`],
                ["page:x-demo:/pages/about.js?filter=all#summary", "/_assets/x-demo/pages/about.js?filter=all#summary"],
                ["relative.js?filter=all#summary", "/main/_assets/shell/0.9.0.dev/pages/relative.js?filter=all#summary"],
                ["/demo/navigation", "/demo/_assets/x-demo/pages/03-navigation/index.js"],
                ["/demo/repository/12?sort=name#summary", "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name#summary"]
            ];
            for (const [href, expected, params] of cases) {
                outlet.src = null;
                await navigation.navigate({ href, params, page, open: "embed", outlet: "content" });
                assert.equal(outlet.src, expected, `${mode} ${basePath} ${href}`);
            }

            // Relative destinations continue to find an Area through the menu of an unprefixed originating Page.
            await navigation.navigate({ href: "index.js", page: unprefixedPage, open: "embed", outlet: "content" });
            assert.equal(unprefixedOutlet.src, "/demo/_assets/x-demo/pages/03-navigation/index.js");
            assert.deepEqual(navigation.stack, []);
            assert.equal(navigation.buildUrlAbsolute({ href: asset, page, open: "embed" }), `${browserPrefix}/main${asset}`);
            assert.equal(navigation.buildUrlAbsolute({ href: "page:x-demo:/pages/about.js", page, open: "embed" }), `${browserPrefix}/demo/something`);
        }
    }
});

test("Navigation keeps canonical asset destinations Area-aware through public URL and auto navigation behavior", async () => {
    const navigation = createNavigation();
    const href = "/_assets/x/0.9.0.dev/pages/about.js?view=all#summary";
    const { page } = createEmbedPage("/main/_assets/shell/0.9.0.dev/pages/origin.js");
    const expected = "/main" + href;
    assert.equal(navigation.buildUrlAbsolute({ href, page }), expected);
    await navigation.navigate({ href, page });
    assert.equal(page.host.src, expected);
});

test("x-page resolves embed resources and supplies stack classes before connecting the layout", async t => {
    // Supply the DOM operations used by x-page and forward src changes through its attribute callback.
    globalThis.HTMLElement = class extends EventTarget {
        attributes = new Map();
        attachShadow() {
            this.shadowRoot = { appendChild(node) {
                this.initialStackClasses = node.stackClasses;
                this.firstChild = node;
            } };
        }
        setAttribute(name, value) {
            this.attributes.set(name, value);
            if (name === "src") this.attributeChangedCallback(name, null, value);
        }
    };
    globalThis.CSSStyleSheet = class { replaceSync() {} };
    globalThis.document = { createElement(localName) { return { localName, setAttribute() {}, removeAttribute() {} }; } };
    t.after(() => {
        for (const key of ["HTMLElement", "CSSStyleSheet", "document"]) delete globalThis[key];
    });
    const { createXPageClass } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/x-page.js");

    // Resolve real resource URLs and replace only the concrete layout and Page implementations.
    const asset = "/_assets/customer/pages/detail.js";
    const loader = `data:text/javascript,${encodeURIComponent("export default class { async load() { return class { constructor(options) { this.options = options; } async load() {} async mount() {} }; } }")}`;
    const config = {
        app: { basePath: "/app", baseUrl: "https://example.test/app/" },
        xshell: {
            ui: { layouts: { embed: "test-layout", stack: "test-layout" } },
            resolver: {
                layout: { "test-layout": { src: "/layout.js", loader } },
                page: { [asset]: { src: asset, loader } }
            }
        }
    };
    const bus = { emit() {} };
    const areas = createAreas();
    const resolver = new Resolver({ config });
    const navigation = createNavigation({ areas, resolver, basePath: config.app.basePath });
    const resourceLoader = new Loader({ bus, resolver }, {});
    const modules = { resolveModuleId: href => areas.getModuleId(href) };
    const XPage = createXPageClass({ logger: new Logger({}), config, loader: resourceLoader, bus, navigation, areas, menus: menusByAreaService.get(areas), modules });

    for (const [prefix, breadcrumbPath] of [["", null], ["/sales", "/sales/detail"], ["/global", null]]) {
        const outlet = new XPage();
        const page = { src: "/sales/_assets/customer/pages/origin.js", host: { querySelector() { return outlet; } } };
        const href = `${prefix}${asset}?view=all#summary`;
        await navigation.navigate({ href, page, open: "embed", outlet: "content" });
        assert.equal(outlet.src, href);
        await outlet.load();
        assert.equal(outlet.status, "loaded");
        assert.equal(outlet.attributes.get("module"), "customer");
        assert.deepEqual(outlet.page.options, { src: href, context: outlet.context, bus, navigation });
        assert.equal(outlet.breadcrumb?.at(-1)?.path ?? null, breadcrumbPath);
        const { resource, path, url, status } = resourceLoader.registry.at(-1);
        assert.deepEqual({ resource, path, url, status }, {
            resource: `page:${asset}?view=all#summary`, path: asset, url: `https://example.test/app${asset}`, status: "loaded"
        });
    }

    // An explicit title and breadcrumb still accompany a global Page invocation.
    const globalPage = new XPage();
    globalPage.src = navigation.buildUrl({ href: "/global" + asset, nav: { title: "Tool", breadcrumb: [{ label: "Tools", href: "/global" }] } });
    await globalPage.load();
    assert.equal(globalPage.label, "Tool");
    assert.deepEqual(globalPage.breadcrumb.map(item => item.label), ["Tools", "Tool"]);

    const stacked = new XPage();
    stacked.layout = "stack";
    stacked.src = `/sales${asset}`;
    stacked.stackClasses = ["size-narrow"];
    await stacked.load();
    assert.deepEqual(stacked.shadowRoot.initialStackClasses, ["size-narrow"]);
    assert.ok(resourceLoader.registry.some(({ resource, status }) => resource === "layout:test-layout" && status === "loaded"));

    const loadedPage = stacked.page;
    stacked.stackClasses = ["size-wide"];
    assert.deepEqual(stacked.shadowRoot.firstChild.stackClasses, ["size-wide"]);
    assert.equal(stacked.page, loadedPage);
    assert.equal(stacked.src, `/sales${asset}`);
});

test("Navigation.init preserves path-mode fragments on load and popstate without changing root home selection", async (t) => {
    const areas = createAreas();
    const location = { pathname: "/app/demo/repository/12", search: "?sort=name", hash: "#summary" };
    const pushedUrls = [];
    let onPopstate;
    const createDom = () => {
        const mounted = [];
        return { mounted, container: { querySelectorAll: () => mounted, appendChild: page => mounted.push(page) } };
    };
    globalThis.document = { location, createElement() {
        const attributes = {};
        return {
            setAttribute(name, value) { attributes[name] = value; this[name] = value; },
            getAttribute(name) { return attributes[name] ?? null; },
            addEventListener() {},
            async removePage() {}
        };
    } };
    globalThis.window = { addEventListener(type, listener) { if (type === "popstate") onPopstate = listener; } };
    globalThis.history = { pushState(state, title, url) { pushedUrls.push(url); } };
    t.after(() => {
        delete globalThis.document;
        delete globalThis.window;
        delete globalThis.history;
    });

    const dom = createDom();
    const navigation = createNavigation({ areas, basePath: "/app", container: dom.container });
    await navigation.init();
    assert.equal(navigation.stack[0].href, "/demo/repository/12#summary");
    assert.deepEqual(navigation.stack[0].params, { sort: "name" });
    assert.equal(dom.mounted[0].src, "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name#summary");

    location.pathname = "/app/sales/detail";
    location.search = "?customer=42";
    location.hash = "#actions";
    await onPopstate();
    assert.equal(navigation.stack[0].href, "/sales/detail#actions");
    assert.deepEqual(navigation.stack[0].params, { customer: "42" });
    assert.equal(dom.mounted[0].src, "/sales/_assets/customer/pages/detail.js?customer=42#actions");

    for (const pathname of ["/app", "/app/"]) {
        location.pathname = pathname;
        location.search = "";
        location.hash = "#section";
        const rootDom = createDom();
        const rootNavigation = createNavigation({ areas, basePath: "/app", container: rootDom.container });
        await rootNavigation.init();
        assert.equal(rootNavigation.stack[0].href, areas.getDefaultArea().home);
    }
    assert.equal(pushedUrls.length, 2);
});

function createSharedRouteContext({ definitions, defaultArea, mode = "path", basePath = "", baseUrl = "https://example.test/", assetsBasePath = "/_assets",
    routes = { "/repository/{repositoryId}/items": "/_assets/shared/pages/items.js" } }) {
    const config = { modules: { shared: { assets: { path: assetsBasePath + "/shared" } } }, xshell: { assets: { basePath: assetsBasePath } } };
    const bus = { addEventListener() {}, emit() {} };
    const areaDefinitions = Object.fromEntries(Object.entries(definitions).map(([id, area]) => [id, { routes, ...area }]));
    const areas = new Areas({ config, bus }, { default: defaultArea, definitions: areaDefinitions });
    initializeAreas(areas, { bus, config });
    return { areas, navigation: createNavigation({ areas, mode, basePath, baseUrl, assetsBasePath }) };
}

test("Navigation embeds explicit asset paths even when a route matches the configured asset namespace", async () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "main",
        definitions: { main: { prefix: "/main" }, root: { prefix: "/" } },
        assetsBasePath: "/resources/assets",
        routes: { "/resources/{section}/{module}/{folder}/{file}": "/resources/assets/shared/pages/fallback.js" }
    });
    const href = "/resources/assets/shared/pages/about.js";
    const { page, outlet } = createEmbedPage("/main/resources/assets/shared/pages/origin.js");

    for (const prefix of ["", "/main"]) {
        const target = prefix + href;
        assert.equal(navigation.resolveRoute(target).target, "/resources/assets/shared/pages/fallback.js");
        await navigation.navigate({ href: target, page, open: "embed", outlet: "content" });
        assert.equal(outlet.src, target);
    }

    await navigation.navigate({ href: href.replace("/assets/", "/assets-other/"), page, open: "embed", outlet: "content" });
    assert.equal(outlet.src, "/main/resources/assets/shared/pages/fallback.js?section=assets-other&module=shared&folder=pages&file=about.js");
});

function createNoRouteContext() {
    const config = { modules: { empty: {} }, xshell: { assets: { basePath: "/_assets" } } };
    const bus = { addEventListener() {}, emit() {} };
    const areas = new Areas({ config, bus }, {
        default: "empty", definitions: { empty: { prefix: "/empty" } }
    });
    initializeAreas(areas, { bus, config });
    return { areas, navigation: createNavigation({ areas }) };
}

test("Menus.resolveHref searches recursively across selected Area menus and ignores query and fragment", () => {
    const areas = createAreas();

    assert.equal(menusByAreaService.get(areas).resolveHref("/sales/_assets/customer/pages/detail.js?customer=42#summary", "sales")?.path, "/sales/detail");
    assert.equal(menusByAreaService.get(areas).resolveHref("/sales/_assets/customer/pages/tool-detail.js#actions", "sales")?.path, "/sales/tool-detail");
    assert.equal(menusByAreaService.get(areas).resolveHref("/sales/_assets/customer/pages/missing.js", "sales"), null);
});

test("Areas expose route descriptors in declaration order", () => {
    const areas = createRouteAreas();

    assert.deepEqual(areas.getArea("combined").routes, [
        { path: "/items/{id}", href: "/_assets/first/1.0.0.dev/pages/items.js", module: "first" },
        { path: "/items/new", href: "/_assets/second/1.0.0.dev/pages/new.js", module: "second" },
        { path: "/unowned", href: "/_assets/unknown/pages/index.js", module: null },
        { path: "/items", href: "/_assets/first/1.0.0.dev/pages/items.js", module: "first" }
    ]);
});

test("Areas derive target ownership across independent Areas", () => {
    const areas = createRouteAreas();

    assert.deepEqual(areas.getArea("first-only").routes, [
        { path: "/items", href: "/_assets/first/1.0.0.dev/pages/items.js", module: "first" },
        { path: "/repository/{repositoryId}", href: "/_assets/first/1.0.0.dev/pages/repository.js", module: "first" }
    ]);
    assert.deepEqual(areas.getArea("outsider-only").routes, [
        { path: "/outsider", href: "/_assets/outsider/1.0.0.dev/pages/index.js", module: "outsider" }
    ]);
    assert.equal(areas.getArea("combined").routes.some(route => route.module === "outsider"), false);
});

test("Area routes are immutable and do not apply the Area prefix", () => {
    const areas = createRouteAreas();
    const area = areas.getArea("combined");

    assert.equal(Object.isFrozen(area.routes), true);
    assert.equal(Object.isFrozen(area.routes[0]), true);
    assert.equal(area.routes[0].path, "/items/{id}");
    assert.equal(area.routes[0].href, "/_assets/first/1.0.0.dev/pages/items.js");
});

test("Navigation forward ambiguity follows Area route declaration order", () => {
    const areas = createRouteAreas();
    const navigation = createNavigation({ areas });

    assert.equal(
        resolveNavigationTarget(navigation, "/demo/items/new"),
        "/demo/_assets/first/1.0.0.dev/pages/items.js?id=new"
    );
});

test("Navigation keeps canonical URLs when an earlier route or menu alias would change the destination", () => {
    const navigation = createNavigation({ areas: createRouteAreas() });
    const shadowed = "/demo/_assets/second/1.0.0.dev/pages/new.js";
    assert.equal(navigation.buildUrlAbsolute({ href: shadowed }), shadowed);
    assert.equal(resolveNavigationTarget(navigation, shadowed), shadowed);

    const withMenus = createNavigation();
    const routeTarget = "/demo/_assets/x-demo/pages/route-navigation.js";
    assert.equal(resolveNavigationTarget(withMenus, "/demo/navigation"), "/demo/_assets/x-demo/pages/03-navigation/index.js");
    assert.equal(withMenus.buildUrlAbsolute({ href: routeTarget }), routeTarget);
});

test("Navigation reverse routes respect nested and global ownership and try later safe patterns", () => {
    const target = "/_assets/shared/pages/items.js";
    const { navigation } = createSharedRouteContext({
        defaultArea: "shop",
        definitions: {
            root: { prefix: "", routes: { "/global/{id}": target, "/shop/{id}": target } },
            shop: { prefix: "/shop", routes: { "/{id}/items": target, "/shop/items/{id}": target } },
            tools: { prefix: "/shop/tools", routes: { "/items/{id}": target } }
        }
    });
    const rootPage = { src: "/_assets/shared/pages/root.js" };
    const candidate = "/shop/_assets/shared/pages/items.js?id=tools";
    assert.equal(navigation.buildUrlAbsolute({ href: candidate }), "/shop/shop/items/tools");
    assert.equal(resolveNavigationTarget(navigation, "/shop/shop/items/tools"), candidate);
    assert.equal(navigation.resolveRoute("/global/42"), null);
    assert.equal(navigation.buildUrlAbsolute({ href: target + "?id=42", page: rootPage }), "/shop/42/items");

    const { navigation: onlyShadowed } = createSharedRouteContext({
        defaultArea: "root",
        definitions: { root: { prefix: "", routes: { "/global/{id}": target, "/tools/{id}": target } }, tools: { prefix: "/tools", routes: {} } }
    });
    assert.equal(onlyShadowed.buildUrlAbsolute({ href: target + "?id=42" }), target + "?id=42");
});

test("Navigation keeps explicit Area hrefs when the destination has a route only in another Area", () => {
    const target = "/_assets/shared/pages/items.js";
    const { navigation } = createSharedRouteContext({
        defaultArea: "sales",
        definitions: { sales: { prefix: "/sales", routes: { "/items": target } }, admin: { prefix: "/admin", routes: {} } }
    });
    assert.equal(navigation.buildUrlAbsolute({ href: target }), "/sales/items");
    assert.equal(navigation.buildUrlAbsolute({ href: "/admin" + target }), "/admin" + target);
});

test("Menus.resolveHref keeps ambiguous canonical Pages scoped to the selected Area", () => {
    const areas = createAreas();

    assert.equal(menusByAreaService.get(areas).resolveHref("/sales/_assets/customer/pages/detail.js", "sales")?.path, "/sales/detail");
    assert.equal(menusByAreaService.get(areas).resolveHref("/admin/_assets/customer/pages/detail.js", "admin")?.path, "/admin/detail");
    assert.equal(menusByAreaService.get(areas).resolveHref("/admin/_assets/customer/pages/detail.js", "sales"), null);
});

test("Menus.resolveHref discovers named dynamic menus by their effective destinations", () => {
    const areas = createAreas();

    assert.equal(menusByAreaService.get(areas).resolveHref("/_assets/x-demo/pages/03-navigation/index.js")?.path, "/demo/navigation");
    assert.equal(menusByAreaService.get(areas).resolveHref("/_assets/x-demo/pages/03-navigation/index.js", "main"), null);
    assert.equal(menusByAreaService.get(areas).resolveHref("/_assets/x-demo/pages/index.js")?.path, "/demo/");
});

test("Menus.resolvePath matches an exact friendly path in its owning Area", () => {
    const areas = createAreas();

    assert.equal(menusByAreaService.get(areas).resolvePath("/sales/detail")?.href, "/sales/_assets/customer/pages/detail.js");
    assert.equal(menusByAreaService.get(areas).resolvePath("/sales/detail?customer=42"), null);
});

test("Navigation opens the owning nested Area's friendly path in path and hash modes", async t => {
    const bus = { addEventListener() {}, emit() {} };
    const config = { modules: {}, xshell: { assets: { basePath: "/_assets" } } };
    const areas = new Areas({ config, bus }, { default: "main", definitions: {
        main: { prefix: "/main", menus: { navigation: "main" } },
        tools: { prefix: "/main/tools", menus: { navigation: "tools" } }
    } });
    const asset = "/_assets/customer/pages/help.js";
    initializeAreas(areas, { bus, config, definitions: {
        main: { items: [{ label: "Help", path: "help", href: asset }] },
        tools: { items: [{ label: "Help", path: "help", href: asset }] }
    } });

    // Open the public URL as a browser entry point and observe the Page that Navigation mounts.
    globalThis.window = { addEventListener() {} };
    t.after(() => {
        delete globalThis.document;
        delete globalThis.window;
    });
    for (const [mode, prefix] of [["path", "/app"], ["hash", "/app/#!"]]) {
        const mounted = [];
        const container = { querySelectorAll: () => mounted, appendChild: page => mounted.push(page) };
        const navigation = createNavigation({ areas, mode, basePath: "/app", baseUrl: "https://example.test/app/", container });
        const publicHref = prefix + "/main/tools/help?view=full#summary";
        globalThis.document = {
            location: new URL(publicHref, "https://example.test"),
            createElement: () => ({
                setAttribute(name, value) { this[name] = value; }, getAttribute(name) { return this[name] ?? null; }, addEventListener() {}
            })
        };
        const canonical = `/main/tools${asset}?view=full#summary`;
        await navigation.init();
        assert.equal(mounted.length, 1);
        assert.equal(mounted[0].src, canonical);
        assert.equal(navigation.buildUrlAbsolute({ href: canonical }), publicHref);
    }
});

test("Navigation exposes a friendly path while preserving canonical lookup suffixes", () => {
    const navigation = createNavigation();
    const page = { src: "/sales/_assets/customer/pages/origin.js" };

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js?customer=42#summary", page }),
        "/sales/detail?customer=42#summary"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js#summary", params: { customer: 42 }, page }),
        "/sales/detail?customer=42#summary"
    );
});

function createRouteAreas() {
    const bus = {
        addEventListener() {},
        emit() {}
    };
    const config = {
        modules: Object.fromEntries(["first", "second", "outsider"].map(id => [id, { assets: { path: "/_assets/" + id + "/1.0.0.dev" } }])),
        xshell: { assets: { basePath: "/_assets" } }
    };
    const options = {
        default: "combined",
        definitions: {
            combined: { prefix: "/demo", routes: {
                "/items/{id}": "/_assets/first/1.0.0.dev/pages/items.js",
                "/items/new": "/_assets/second/1.0.0.dev/pages/new.js",
                "/unowned": "/_assets/unknown/pages/index.js",
                "/items": "/_assets/first/1.0.0.dev/pages/items.js"
            } },
            "first-only": { prefix: "/first", routes: {
                "/items": "/_assets/first/1.0.0.dev/pages/items.js",
                "/repository/{repositoryId}": "/_assets/first/1.0.0.dev/pages/repository.js"
            } },
            "outsider-only": { prefix: "/outsider", routes: { "/outsider": "/_assets/outsider/1.0.0.dev/pages/index.js" } }
        }
    };
    const areas = new Areas({ config, bus }, options);
    initializeAreas(areas, { bus, config });
    return areas;
}

test("Navigation falls back to Area-aware canonical hrefs and preserves items without paths", () => {
    const navigation = createNavigation();
    const page = { src: "/sales/_assets/customer/pages/origin.js" };

    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/missing.js", page }), "/sales/_assets/customer/pages/missing.js");
    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/canonical.js", page }), "/sales/_assets/customer/pages/canonical.js");
});

test("Navigation uses the originating Page Area instead of the current Area", () => {
    const navigation = createNavigation();
    const page = { src: "/admin/_assets/customer/pages/origin.js" };

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js", page }),
        "/admin/detail"
    );
    assert.equal(
        resolveNavigationTarget(navigation, "/_assets/customer/pages/detail.js?customer=42#summary", page),
        "/admin/_assets/customer/pages/detail.js?customer=42#summary"
    );
    assert.equal(navigation.buildUrlAbsolute({ href: "/sales/_assets/customer/pages/detail.js", page }), "/sales/detail");
});

test("Navigation discovers the Area with a matching menu when the originating Page belongs to another Area", () => {
    const navigation = createNavigation();
    const page = { src: "/main/_assets/shell/pages/origin.js" };

    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/03-navigation/index.js", page }), "/demo/navigation");
    assert.equal(
        resolveNavigationTarget(navigation, "/_assets/x-demo/pages/03-navigation/index.js", page),
        "/demo/_assets/x-demo/pages/03-navigation/index.js"
    );
});

test("Navigation formats friendly URLs through existing path and hash modes with AppBasePath", () => {
    const page = { src: "/sales/_assets/customer/pages/origin.js" };
    const pathNavigation = createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" });
    const hashNavigation = createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" });

    assert.equal(pathNavigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js", page }), "/app/sales/detail");
    assert.equal(hashNavigation.buildUrlAbsolute({ href: "/_assets/customer/pages/detail.js", page }), "/app/#!/sales/detail");
});

test("Navigation removes AppBasePath from already resolved asset targets before applying an Area", () => {
    const page = { src: "/demo/_assets/x-demo/1.0.0.dev/pages/01-components/01-basics.js" };
    const assetHref = "/_assets/x-demo/1.0.0.dev/pages/01-components/02-forms.js?view=all#examples";

    for (const mode of ["path", "hash"]) {
        for (const basePath of ["", "/prefix", "/prefix/demo"]) {
            const navigation = createNavigation({
                mode,
                basePath,
                baseUrl: `https://example.test${basePath}/`
            });
            const renderedHref = basePath + assetHref;
            const canonicalHref = "/demo" + assetHref;
            const renderedCanonicalHref = basePath + canonicalHref;
            const browserHref = basePath + (mode === "hash" ? "/#!" : "") + canonicalHref;

            assert.equal(resolveNavigationTarget(navigation, renderedHref, page), canonicalHref);
            assert.equal(resolveNavigationTarget(navigation, canonicalHref, page), canonicalHref);
            assert.equal(resolveNavigationTarget(navigation, renderedCanonicalHref, page), canonicalHref);
            assert.equal(navigation.buildUrlAbsolute({ href: renderedHref, page }), browserHref);
            assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref, page }), browserHref);
            assert.equal(navigation.buildUrlAbsolute({ href: renderedCanonicalHref, page }), browserHref);
            if (basePath) assert.equal(browserHref.includes(basePath + "/demo" + basePath), false);
        }
    }
});

test("Navigation does not strip AppBasePath from non-asset logical paths", () => {
    const navigation = createNavigation({ basePath: "/prefix", baseUrl: "https://example.test/prefix/" });
    const page = { src: "/demo/_assets/x-demo/pages/origin.js" };

    assert.equal(resolveNavigationTarget(navigation, "/prefix/reports?view=all#summary", page), "/demo/prefix/reports?view=all#summary");
});

test("Navigation still resolves incoming friendly paths to canonical Page hrefs", () => {
    const navigation = createNavigation();

    assert.equal(
        resolveNavigationTarget(navigation, "/sales/detail?customer=42#summary"),
        "/sales/_assets/customer/pages/detail.js?customer=42#summary"
    );
});

test("Navigation resolves Area routes to canonical Page hrefs with path parameters", () => {
    const navigation = createNavigation();

    assert.equal(
        resolveNavigationTarget(navigation, "/demo/repository/12/projects/7/items"),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7"
    );
});

test("Navigation preserves target query, incoming query, and fragment with route parameters authoritative", () => {
    const navigation = createNavigation();

    assert.equal(
        resolveNavigationTarget(navigation, "/demo/repository/12?repositoryId=999&sort=name&page=3#details"),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name&page=3#details"
    );
});

test("Navigation safely serializes decoded route parameter values", () => {
    const navigation = createNavigation();

    assert.equal(
        resolveNavigationTarget(navigation, "/demo/repository/hello%20world"),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=hello%20world"
    );
    assert.equal(
        resolveNavigationTarget(navigation, "/demo/repository/abc%2Fdef"),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=abc%2Fdef"
    );
});

test("Navigation matches only the resolved Area routes", () => {
    const navigation = createNavigation();

    assert.equal(
        resolveNavigationTarget(navigation, "/sales/customer/12"),
        "/sales/_assets/customer/pages/detail.js?customerId=12"
    );
    assert.equal(resolveNavigationTarget(navigation, "/demo/customer/12"), "/demo/customer/12");
});

test("Navigation gives exact menu paths precedence over matching routes", () => {
    const navigation = createNavigation();

    assert.equal(navigation.resolveRoute("/demo/navigation").href, "/demo/_assets/x-demo/pages/route-navigation.js");
    assert.equal(
        resolveNavigationTarget(navigation, "/demo/navigation"),
        "/demo/_assets/x-demo/pages/03-navigation/index.js"
    );
});

test("Navigation.resolveRoute reports a literal match and keeps composed declaration order", () => {
    const navigation = createNavigation({ areas: createRouteAreas() });

    assert.deepEqual(navigation.resolveRoute("/demo/items"), {
        areaId: "combined",
        areaPrefix: "/demo",
        moduleId: "first",
        route: "/items",
        target: "/_assets/first/1.0.0.dev/pages/items.js",
        params: {},
        href: "/demo/_assets/first/1.0.0.dev/pages/items.js"
    });
});

test("Navigation.resolveRoute decodes path parameters and shares forward href construction in both modes", () => {
    const path = "/demo/repository/a%2Fb%2520?repositoryId=ignored&mode=grid&sort=by+name#details";
    const result = {
        areaId: "demo",
        areaPrefix: "/demo",
        moduleId: "x-demo",
        route: "/repository/{repositoryId}",
        target: "/_assets/x-demo/pages/repository.js?mode=list",
        params: { repositoryId: "a/b%20" },
        href: "/demo/_assets/x-demo/pages/repository.js?mode=grid&repositoryId=a%2Fb%2520&sort=by%20name#details"
    };
    for (const mode of ["path", "hash"]) {
        const navigation = createNavigation({ mode, basePath: "/app" });
        assert.deepEqual(navigation.resolveRoute(path), result);
        assert.equal(result.href, resolveNavigationTarget(navigation, path));
    }
});

test("Navigation.resolveRoute selects the longest Area prefix, including an empty root prefix", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "root",
        definitions: {
            root: { prefix: "/" },
            shop: { prefix: "/shop" },
            detail: { prefix: "/shop/detail" },
            empty: { prefix: "/shop/empty", routes: {} }
        }
    });
    const path = "/repository/12/items";

    assert.deepEqual(navigation.resolveRoute(path), {
        areaId: "root",
        areaPrefix: "",
        moduleId: "shared",
        route: "/repository/{repositoryId}/items",
        target: "/_assets/shared/pages/items.js",
        params: { repositoryId: "12" },
        href: "/_assets/shared/pages/items.js?repositoryId=12"
    });
    assert.equal(navigation.resolveRoute("/shop" + path).href, "/shop/_assets/shared/pages/items.js?repositoryId=12");
    const detail = navigation.resolveRoute("/shop/detail" + path);
    assert.equal(detail.areaId, "detail");
    assert.equal(detail.areaPrefix, "/shop/detail");
    assert.equal(detail.href, "/shop/detail/_assets/shared/pages/items.js?repositoryId=12");
    assert.equal(navigation.resolveRoute("/shop/empty" + path), null);
});

test("Navigation.resolveRoute preserves an existing destination Area prefix and a target fragment", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "shop",
        definitions: { shop: { prefix: "/shop" } },
        routes: { "/": "/shop/_assets/shared/pages/index.js?mode=compact#summary" }
    });

    assert.equal(navigation.resolveRoute("/shop").href, "/shop/_assets/shared/pages/index.js?mode=compact#summary");
    assert.equal(navigation.resolveRoute("/shop/?filter=new#top").href, "/shop/_assets/shared/pages/index.js?mode=compact&filter=new#top");
});

test("Navigation.resolveRoute distinguishes missing matches from invalid inputs", () => {
    const navigation = createNavigation();

    for (const path of ["/missing", "/demo/missing?query=1#fragment", "/main/repository/12", "/demo/repository"]) {
        assert.equal(navigation.resolveRoute(path), null);
    }
    for (const path of [undefined, null, 42, "", "   "]) {
        assert.throws(() => navigation.resolveRoute(path), /path must be a non-empty string/);
    }
    for (const path of ["relative/path", "?query=1", "#fragment", "#!/demo/something", "//example.test/path", "https://example.test/path"]) {
        assert.throws(() => navigation.resolveRoute(path), /path must start with a single/);
    }
    assert.throws(() => navigation.resolveRoute("/demo/repository/%E0%A4%A"), /Invalid encoded route parameter/);
});

test("Navigation.resolveRoute leaves browser history, mounted Pages, and the Navigation stack untouched", (t) => {
    const areas = createAreas();
    const mounted = Object.freeze([Object.freeze({ src: "/sales/_assets/customer/pages/detail.js?customer=42" })]);
    const bus = { emit() { assert.fail("Route inspection must not emit navigation events"); } };
    const navigation = createNavigation({ areas, bus, container: { querySelectorAll: () => mounted } });
    const before = structuredClone(navigation.stack);
    const currentArea = areas.getCurrentArea();
    const location = Object.freeze({ href: "https://example.test/sales/detail?customer=42" });
    const writeHistory = () => assert.fail("Route inspection must not write history");
    const history = { pushState: writeHistory, replaceState: writeHistory };
    Object.assign(globalThis, { location, history });
    t.after(() => {
        delete globalThis.location;
        delete globalThis.history;
    });
    assert.equal(navigation.resolveRoute("/demo/something").areaId, "demo");
    assert.deepEqual(navigation.stack, before);
    assert.equal(navigation.getXPage(), mounted[0]);
    assert.equal(navigation.src, null);
    assert.equal(areas.getCurrentArea(), currentArea);
    assert.equal(globalThis.location, location);
    assert.equal(globalThis.history, history);
});

test("Navigation route resolution preserves direct canonical and unmatched fallback behavior", () => {
    const navigation = createNavigation();

    assert.equal(
        resolveNavigationTarget(navigation, "/demo/_assets/x-demo/pages/items.js?repositoryId=12"),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=12"
    );
    assert.equal(resolveNavigationTarget(navigation, "/demo/not-a-route"), "/demo/not-a-route");
});

test("Navigation preserves fallback and canonical access when an Area has no routes", () => {
    const { areas, navigation } = createNoRouteContext();

    assert.deepEqual(areas.getArea("empty").routes, []);
    assert.doesNotThrow(() => resolveNavigationTarget(navigation, "/empty/not-a-route"));
    assert.equal(resolveNavigationTarget(navigation, "/empty/not-a-route"), "/empty/not-a-route");
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/empty/pages/index.js?tab=info#details" }),
        "/empty/_assets/empty/pages/index.js?tab=info#details"
    );
    assert.equal(
        resolveNavigationTarget(navigation, "/empty/_assets/empty/pages/index.js?tab=info#details"),
        "/empty/_assets/empty/pages/index.js?tab=info#details"
    );
});

test("Navigation keeps malformed encoded route parameters distinct from normal no-match fallback", () => {
    const navigation = createNavigation();

    assert.throws(
        () => navigation.resolveRoute("/demo/repository/%E0%A4%A"),
        /Invalid encoded route parameter/
    );
    assert.doesNotThrow(() => navigation.resolveRoute("/demo/not-a-route"));
});

test("Navigation route resolution is mode-independent and keeps browser-facing route URLs", () => {
    const pathNavigation = createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" });
    const hashNavigation = createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" });
    const href = "/demo/repository/12";

    assert.equal(pathNavigation.buildUrlAbsolute({ href }), "/app/demo/repository/12");
    assert.equal(hashNavigation.buildUrlAbsolute({ href }), "/app/#!/demo/repository/12");
    assert.equal(
        resolveNavigationTarget(pathNavigation, href),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12"
    );
    assert.equal(
        resolveNavigationTarget(hashNavigation, href),
        "/demo/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12"
    );
});

test("Navigation reverse maps literal and parameterized canonical Page hrefs", () => {
    const navigation = createNavigation();

    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/about.js" }), "/demo/something");
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12" }),
        "/demo/repository/12"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7" }),
        "/demo/repository/12/projects/7/items"
    );
});

test("Navigation reverse routing consumes route and intrinsic target params while preserving unused query and fragments", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({
            href: "/_assets/x-demo/pages/items.js#summary",
            params: { repositoryId: "12", projectId: "7", sort: "name", page: 3 }
        }),
        "/demo/repository/12/projects/7/items?sort=name&page=3#summary"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12&sort=name#details" }),
        "/demo/repository/12?sort=name#details"
    );
});

test("Navigation reverse routing encodes placeholder values as individual path segments", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js", params: { mode: "list", repositoryId: "hello world" } }),
        "/demo/repository/hello%20world"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js", params: { mode: "list", repositoryId: "abc/def" } }),
        "/demo/repository/abc%2Fdef"
    );
});

test("Navigation reverse routing skips candidates with missing parameters and continues in Area order", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?repositoryId=12" }),
        "/demo/repository/12/items"
    );
    const fallback = navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?projectId=7" });
    assert.equal(fallback, "/sales/_assets/x-demo/pages/items.js?projectId=7");
    assert.equal(fallback.includes("undefined"), false);
});

test("Navigation reverse routing uses the first applicable route for duplicate targets", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7" }),
        "/demo/repository/12/projects/7/items"
    );
});

test("Navigation reverse ambiguity uses Area order without ranking placeholder counts", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "demo",
        definitions: { demo: { prefix: "/demo" } },
        routes: {
            "/repository/{repositoryId}/items": "/_assets/shared/pages/items.js",
            "/repository/{repositoryId}/projects/{projectId}/items": "/_assets/shared/pages/items.js"
        }
    });
    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js", params: { repositoryId: 12, projectId: 7 } }),
        "/demo/repository/12/items?projectId=7");
});

test("Navigation reverse ambiguity skips an inapplicable first route and uses the next candidate", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "demo",
        definitions: { demo: { prefix: "/demo" } },
        routes: {
            "/repository/{repositoryId}/items": "/_assets/shared/pages/items.js",
            "/projects/{projectId}/items": "/_assets/shared/pages/items.js"
        }
    });
    assert.equal(navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js", params: { projectId: 7 } }), "/demo/projects/7/items");
});

test("Navigation treats missing, null, undefined, and empty reverse parameters as inapplicable", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "demo",
        definitions: { demo: { prefix: "/demo" } }
    });

    for (const params of [{}, { repositoryId: null }, { repositoryId: undefined }, { repositoryId: "" }]) {
        assert.doesNotThrow(() => navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js", params }));
        assert.match(navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js", params }), /^\/demo\/_assets\/shared\/pages\/items\.js/);
    }
});

test("Navigation reverse routing keeps exact menu aliases ahead of routes", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/03-navigation/index.js" }),
        "/demo/navigation"
    );
});

test("Navigation reverse routing honors originating Area and discovers routes by destination", () => {
    const navigation = createNavigation();
    const page = { src: "/admin/_assets/customer/pages/origin.js" };

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/customer/pages/route-detail.js?customerId=12", page }),
        "/admin/customer-route/12"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/about.js" }),
        "/demo/something"
    );
});

test("Navigation reverse routing applies an existing Area prefix exactly once", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/demo/_assets/x-demo/pages/about.js" }),
        "/demo/something"
    );
});

test("Navigation keeps Area routes relative while applying a non-root Area prefix exactly once in both directions", () => {
    const navigation = createNavigation();
    const publicHref = "/demo/repository/12/projects/7/items?sort=name#details";
    const canonicalHref = "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#details";

    assert.equal(resolveNavigationTarget(navigation, publicHref), canonicalHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }), publicHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }).includes("/demo/demo/"), false);
    assert.equal(navigation.resolveRoute(publicHref).route, "/repository/{repositoryId}/projects/{projectId}/items");
});

test("Navigation supports forward and reverse routes in an empty-prefix root Area", () => {
    const { areas, navigation } = createSharedRouteContext({
        defaultArea: "root",
        definitions: { root: { prefix: "" } }
    });
    const publicHref = "/repository/12/items?sort=name#details";
    const canonicalHref = "/_assets/shared/pages/items.js?repositoryId=12&sort=name#details";

    assert.equal(resolveNavigationTarget(navigation, publicHref), canonicalHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }), publicHref);
    assert.equal(navigation.buildUrlAbsolute({ href: canonicalHref }).startsWith("//"), false);
    assert.equal(areas.getArea("root").routes[0].path, "/repository/{repositoryId}/items");
});

test("Navigation preserves explicit and originating Area context when multiple Areas expose the same resource", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "sales",
        definitions: {
            sales: { prefix: "/sales" },
            admin: { prefix: "/admin" }
        }
    });
    const adminPage = { src: "/admin/_assets/shared/pages/origin.js" };

    assert.equal(
        resolveNavigationTarget(navigation, "/admin/repository/12/items"),
        "/admin/_assets/shared/pages/items.js?repositoryId=12"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/admin/_assets/shared/pages/items.js?repositoryId=12" }),
        "/admin/repository/12/items"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js?repositoryId=12", page: adminPage }),
        "/admin/repository/12/items"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/shared/pages/items.js?repositoryId=12" }),
        "/sales/repository/12/items"
    );
    assert.equal(
        navigation.buildUrlAbsolute({ href: "/admin/_assets/shared/pages/items.js" }),
        "/admin/_assets/shared/pages/items.js"
    );
});

test("Navigation wraps root and prefixed route URLs through path and hash AppBasePath modes", () => {
    const definitions = { demo: { prefix: "/demo" } };
    const path = createSharedRouteContext({ definitions, defaultArea: "demo", mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" }).navigation;
    const hash = createSharedRouteContext({ definitions, defaultArea: "demo", mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" }).navigation;
    const canonicalHref = "/_assets/shared/pages/items.js?repositoryId=12&sort=name#details";

    assert.equal(path.buildUrlAbsolute({ href: canonicalHref }), "/app/demo/repository/12/items?sort=name#details");
    assert.equal(hash.buildUrlAbsolute({ href: canonicalHref }), "/app/#!/demo/repository/12/items?sort=name#details");
});

test("Navigation reverse routing requires intrinsic target query parameters", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrlAbsolute({ href: "/_assets/x-demo/pages/repository.js?mode=grid&repositoryId=12" }),
        "/sales/_assets/x-demo/pages/repository.js?mode=grid&repositoryId=12"
    );
});

test("Navigation reverse routes consistently in path and hash modes with AppBasePath", () => {
    const pathNavigation = createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" });
    const hashNavigation = createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" });
    const href = "/_assets/x-demo/pages/repository.js?mode=list&repositoryId=12";

    assert.equal(pathNavigation.buildUrlAbsolute({ href }), "/app/demo/repository/12");
    assert.equal(hashNavigation.buildUrlAbsolute({ href }), "/app/#!/demo/repository/12");
});

test("Navigation round-trips canonical route identity with unused query and fragment", () => {
    const navigation = createNavigation();
    const canonical = "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary";
    const publicHref = navigation.buildUrlAbsolute({ href: canonical });

    assert.equal(publicHref, "/demo/repository/12/projects/7/items?sort=name#summary");
    assert.equal(
        resolveNavigationTarget(navigation, publicHref),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary"
    );
});

test("Navigation round-trips encoded route segments without changing segment boundaries", () => {
    const navigation = createNavigation();
    const canonical = "/_assets/x-demo/pages/items.js?repositoryId=hello%20world&projectId=abc%2Fdef&sort=name%20asc#details";
    const publicHref = navigation.buildUrlAbsolute({ href: canonical });

    assert.equal(publicHref, "/demo/repository/hello%20world/projects/abc%2Fdef/items?sort=name%20asc#details");
    assert.equal(
        resolveNavigationTarget(navigation, publicHref),
        "/demo/_assets/x-demo/pages/items.js?repositoryId=hello%20world&projectId=abc%2Fdef&sort=name%20asc#details"
    );
});

test("Navigation round-trips routes through an empty-prefix Area", () => {
    const { navigation } = createSharedRouteContext({
        defaultArea: "root",
        definitions: { root: { prefix: "" } }
    });
    const canonical = "/_assets/shared/pages/items.js?repositoryId=12&sort=name#details";
    const publicHref = navigation.buildUrlAbsolute({ href: canonical });

    assert.equal(publicHref, "/repository/12/items?sort=name#details");
    assert.equal(resolveNavigationTarget(navigation, publicHref), canonical);
});

test("Navigation round-trips routes through path and hash modes with AppBasePath", () => {
    const canonical = "/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary";
    const expected = "/demo/_assets/x-demo/pages/items.js?repositoryId=12&projectId=7&sort=name#summary";
    const cases = [
        { navigation: createNavigation({ mode: "path", basePath: "/app", baseUrl: "https://example.test/app/" }), browserPrefix: "/app" },
        { navigation: createNavigation({ mode: "hash", basePath: "/app", baseUrl: "https://example.test/app/" }), browserPrefix: "/app/#!" }
    ];

    for (const { navigation, browserPrefix } of cases) {
        const publicHref = navigation.buildUrlAbsolute({ href: canonical });
        const applicationHref = publicHref.substring(browserPrefix.length);

        assert.equal(resolveNavigationTarget(navigation, applicationHref), expected);
    }
});

test("Navigation leaves external URLs untouched", () => {
    const navigation = createNavigation();
    const page = { src: "/sales/_assets/customer/pages/origin.js" };

    for (const href of ["https://example.com/a?b=1#c", "http://example.com", "mailto:user@example.com", "tel:+123456789"]) {
        assert.equal(navigation.buildUrlAbsolute({ href, page }), href);
    }
});

test("Navigation resolves relative Page links with colons in query strings", () => {
    const navigation = createNavigation();

    assert.equal(
        navigation.buildUrl({ href: "details?time=10:30", page: { src: "/sales/pages/current.js" } }),
        "/sales/pages/details?time=10:30"
    );
});
