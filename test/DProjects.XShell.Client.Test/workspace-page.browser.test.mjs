import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

async function verifyWorkspace() {
    const [
        { default: workspace }, { default: menuitem }, { default: anchor }, { default: embedLayout }, { default: Areas },
        { default: Navigation }, { createXPageClass }, { createPageClassFromJsDefinition }, { createComponentClassFromJsDefinition },
        { default: renderEngine }, { default: stateEngine }
    ] = await Promise.all([
        "x/pages/workspace.js", "x/components/x-menuitem.js", "x/components/x-anchor.js", "x/layouts/x-layout-embed.js",
        "xshell/services/areas.js", "xshell/services/navigation.js", "xshell/x-page.js",
        "xshell/loaders/page-js.js", "xshell/loaders/component-js.js", "xshell/render-engines/x-client.js", "xshell/state-engines/proxy.js"
    ].map(path => import("/resources/" + path)));

    // Use actual Page, Component, renderer, and Navigation behavior with a small in-memory resource loader.
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const waitFor = async (condition, message) => {
        for (let attempt = 0; attempt < 50; attempt++) {
            if (condition()) return;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error(message);
    };
    window.requestAnimationFrame = callback => setTimeout(callback, 0);
    const { mode, generation, item, entry = "direct" } = Object.fromEntries(new URLSearchParams(location.search));
    const basePath = "/app";
    const workspaceSrc = "/_assets/x/current/pages/workspace.js";
    const firstSrc = "/_assets/x/current/pages/appearance.js";
    const filesSrc = `/_assets/x-filesystem/${generation}/pages/filesystems.js`;
    const detailSrc = `/_assets/x-filesystem/${generation}/pages/detail.js`;
    const defaults = { renderEngine: "x-client", stateEngine: "proxy" };
    const config = {
        app: { basePath, baseUrl: location.origin + basePath + "/", label: "Test application" },
        xshell: { assets: { basePath: "/_assets" }, ui: { layouts: { main: "test-main", stack: "test-stack", embed: "x-layout-embed" } } },
        modules: {
            x: { defaults: { page: defaults, component: defaults }, menus: {
                preferences: { scope: "global", label: "Preferences", items: [{ id: "appearance", label: "Appearance", href: firstSrc }] }
            } },
            "x-filesystem": { menus: { preferences: { items: [{ id: "filesystems", label: "Storage", children: [
                { id: "filesystems", label: "Filesystems", href: filesSrc }
            ] }] } } }
        }
    };
    const bus = new EventTarget();
    bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
    const areas = new Areas({ config, bus }, { default: null, definitions: {} });
    const modules = { resolveModuleId: src => areas.getModuleId(src), getModuleById: id => ({ id, config: config.modules[id] }) };
    areas.init({ modules });
    const resolver = { resolve: href => href === "page:x:/pages/workspace.js" ? { path: workspaceSrc } : null };
    const navigation = new Navigation({ areas, bus, config, resolver }, { mode });
    const pages = new Map();
    const loader = { async load(resource) {
        if (typeof resource !== "string" || resource.startsWith("schema:")) return {};
        if (resource.startsWith("layout:")) return customElements.get(resource.slice(7));
        if (resource.startsWith("state-engine:")) return stateEngine;
        if (resource.startsWith("render-engine:")) return renderEngine;
        const path = resource.slice(5).split("?")[0];
        if (!pages.has(path)) throw new Error("Unexpected Page resource " + path);
        return pages.get(path);
    } };
    const services = { areas, bus, config, loader, modules, navigation, events: {
        on(target, type, callback) { target.addEventListener(type, callback); }
    } };
    services.services = { beginScope: () => ({ resolve: name => services[name], async dispose() {} }) };
    const context = (resourceName, resourcePath) => ({
        resourceName, resourcePath, resourceDefinition: { moduleId: "x" }, appBasePath: basePath, services
    });
    customElements.define("x-page", createXPageClass(services));
    for (const name of ["test-main", "test-stack"]) customElements.define(name, class extends HTMLElement {});
    for (const [name, definition] of [["x-anchor", anchor], ["x-menuitem", menuitem], ["x-layout-embed", embedLayout]]) {
        const path = "/_assets/x/current/components/" + name + ".js";
        await createComponentClassFromJsDefinition(path, context(name, path), {
            ...definition, meta: { ...definition.meta, id: name, renderEngine: "x-client" }
        });
    }
    const lifecycle = [];
    pages.set(workspaceSrc, await createPageClassFromJsDefinition(workspaceSrc, context(workspaceSrc, workspaceSrc), workspace));
    for (const src of ["/home.js", firstSrc, filesSrc, detailSrc]) {
        pages.set(src, await createPageClassFromJsDefinition(src, context(src, src), {
            meta: { title: src.split("/").at(-1) },
            template: "<p>Embedded content</p>",
            controller: () => ({
                mount() { lifecycle.push(["mount", src]); },
                unmount() { lifecycle.push(["unmount", src]); },
                unload() { lifecycle.push(["unload", src]); }
            })
        }));
    }

    // Enter directly from a browser URL or through the public Stack parameter API.
    const params = { "menu-name": "preferences", "show-title": "false", other: "preserved" };
    if (item !== undefined) params.item = item;
    const expectedItem = item === "filesystems" ? item : "appearance";
    const expectedSrc = expectedItem === "filesystems" ? filesSrc : firstSrc;
    if (entry === "direct") {
        params.src = "/legacy-untrusted.js";
        const url = workspaceSrc + "?" + new URLSearchParams(params);
        history.replaceState(null, "", mode === "hash" ? basePath + "/#!" + url : basePath + url);
        await navigation.init();
    } else {
        await navigation.navigate({ href: "/home.js", open: "top" });
        await waitFor(() => navigation.getXPage()?.page, "Home did not mount");
        await navigation.navigate({
            href: "page:x:/pages/workspace.js", params, page: navigation.getXPage().page, open: "stack", classes: ["size-compact"]
        });
    }
    const historyLength = history.length;
    const host = navigation.getXPages().at(-1);
    const outlet = () => host.querySelector('x-page[outlet="content"]');
    const selection = () => [...host.querySelectorAll("x-menuitem[selected]")].map(element => element.dataset.item);
    const verifyQuery = id => {
        const reflected = navigation.stack.at(-1).params;
        check(reflected.item === id, "Unexpected reflected item " + JSON.stringify(reflected));
        check(reflected.other === "preserved" && reflected["show-title"] === "false", "Unrelated query values changed");
        check(!Object.hasOwn(reflected, "src"), "Legacy source remained in Workspace query");
        check(!location.href.includes("legacy-untrusted") && !decodeURIComponent(location.href).includes(filesSrc), "Embedded path leaked into the URL");
        if (entry === "direct") {
            const search = mode === "hash" ? location.hash.split("?")[1] : location.search;
            check(new URLSearchParams(search).get("item") === id, "Browser URL did not reflect the selected ID");
        }
        check(location.pathname.startsWith(basePath + "/"), "App base path changed");
    };
    await waitFor(() => outlet()?.page?.src === expectedSrc && selection().join() === expectedItem, "Initial Workspace selection did not render");
    verifyQuery(expectedItem);
    const embedded = outlet();
    const heading = () => embedded.shadowRoot.querySelector("x-layout-embed")?.shadowRoot.querySelector(".header");
    await waitFor(heading, "Embedded heading did not render");
    check(getComputedStyle(heading()).display === "none", "show-title=false did not hide the heading");
    check(entry !== "stack" || host.layout === "stack" && host.shadowRoot.firstElementChild.stackClasses.includes("size-compact"),
        "Stack presentation was lost");

    // Click the actual nested menu component anchor and keep its outlet during internal navigation.
    const clickItem = async (id, keyboard = false) => {
        const menu = host.querySelector(`[data-item="${id}"]`);
        const link = () => menu.shadowRoot.querySelector("x-anchor")?.shadowRoot.querySelector("a");
        await waitFor(link, "Menu anchor did not render");
        if (keyboard) link().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
        else link().click();
    };
    if (expectedItem === "filesystems") {
        await clickItem("appearance", true);
        await waitFor(() => embedded.page?.src === firstSrc, "Keyboard activation did not switch sections");
    }
    await clickItem("filesystems");
    await waitFor(() => embedded.page?.src === filesSrc && selection().join() === "filesystems", "Nested activation did not switch sections");
    verifyQuery("filesystems");
    check(outlet() === embedded && history.length === historyLength, "Selection replaced the outlet or added browser history");
    check(lifecycle.some(([phase, src]) => phase === "unload" && src === firstSrc), "Replaced Page did not unload");
    await navigation.navigate({ href: detailSrc, page: embedded.page });
    await waitFor(() => embedded.page?.src === detailSrc, "Internal navigation did not reuse the outlet");
    check(outlet() === embedded && selection().join() === "filesystems", "Internal navigation changed Workspace selection");
    verifyQuery("filesystems");
    check(lifecycle.some(([phase, src]) => phase === "unmount" && src === filesSrc), "Embedded Page did not unmount");
    check(lifecycle.some(([phase, src]) => phase === "unload" && src === filesSrc), "Embedded Page did not unload");
}

const browser = process.env.XSHELL_TEST_BROWSER;
test("Workspace reflects IDs and reuses its outlet across selection and embedded navigation",
    { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" }, async () => {
        const root = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
        const html = `<!doctype html><body data-result="pending"><script type="module">
            try {
                await (${verifyWorkspace})();
                document.body.dataset.result = "passed";
            } catch (error) {
                document.body.dataset.result = "failed";
                document.body.prepend(error.stack);
            }
        </script>`;
        const server = createServer(async (request, response) => {
            const path = new URL(request.url, "http://localhost").pathname;
            if (path === "/app/test") {
                response.writeHead(200, { "Content-Type": "text/html" }).end(html);
            } else if (/^\/resources\/[\w./-]+\.js$/.test(path)) {
                try {
                    const script = await readFile(new URL("./" + path.slice(11), root));
                    response.writeHead(200, { "Content-Type": "text/javascript" }).end(script);
                } catch {
                    response.writeHead(404).end();
                }
            } else {
                response.writeHead(404).end();
            }
        });
        const temp = await mkdtemp(join(tmpdir(), "xshell-workspace-"));
        try {
            await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
            for (const [index, params] of [
                "mode=path&generation=old", "mode=hash&generation=new&item=unknown", "mode=path&generation=new&item=filesystems&entry=stack",
                "mode=path&generation=old&item=filesystems"
            ].entries()) {
                const url = `http://127.0.0.1:${server.address().port}/app/test?${params}`;
                const { stdout } = await promisify(execFile)(browser, [
                    "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
                    `--user-data-dir=${join(temp, "profile-" + index)}`, "--virtual-time-budget=1500", "--dump-dom", url
                ], { timeout: 30_000 });
                const status = stdout.match(/<body[^>]*data-result="([^"]+)"/)?.[1];
                const failure = stdout.match(/<body[^>]*>([\s\S]*?)<script/)?.[1];
                assert.equal(status, "passed", params + " " + (failure || "Browser did not complete Workspace checks"));
            }
        } finally {
            server.close();
            await rm(temp, { recursive: true, force: true, maxRetries: 3 });
        }
    });
