import test from "node:test";
import {chromiumOnly, runInChromium} from "./helpers/chromium.mjs";

async function verifyLogsPage() {
    const [
        {default: definition}, {default: button}, {default: object}, {createPageClassFromJsDefinition},
        {createComponentClassFromJsDefinition}, {default: renderer}, {default: proxy}, {default: LogReader}
    ] = await Promise.all([
        "x-logs/pages/logs.js", "x/components/x-button.js", "x/components/x-object.js", "xshell/loaders/page-js.js",
        "xshell/loaders/component-js.js", "xshell/render-engines/x-client.js", "xshell/state-engines/proxy.js", "x-logs/services/log-reader.js"
    ].map(path => import("/resources/" + path)));
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const wait = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (condition, message) => {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (condition()) return;
            await wait();
        }
        throw new Error(message);
    };
    const queries = [];
    const subscriptions = [];
    const diagnostics = [];
    const noReader = new URLSearchParams(location.search).has("disabled");
    const logReader = noReader ? new LogReader({}) : {
        subscribe(callback) {
            const subscription = {...Promise.withResolvers(), callback, cleaned: 0};
            subscriptions.push(subscription);
            return subscription.promise;
        },
        query(options) {
            const query = {...Promise.withResolvers(), options};
            queries.push(query);
            return query.promise;
        }
    };

    // Mount through the real Page, Component and renderer factories and supply reader responses at the service boundary.
    const logger = Object.fromEntries(["trace", "debug", "info", "warn", "error"].map(level =>
        [level, (...args) => diagnostics.push([level, ...args])]));
    const config = {
        app: {basePath: "", baseUrl: location.origin + "/"},
        xshell: {},
        modules: Object.fromEntries(["x", "x-logs"].map(id => [id, {defaults: {
            page: {renderEngine: "x-client", stateEngine: "proxy"}, component: {renderEngine: "x-client", stateEngine: "proxy"}
        }}]))
    };
    const loader = {async load(resource) {
        if (typeof resource !== "string" || resource.startsWith("schema:")) return {};
        if (resource.startsWith("state-engine:")) return proxy;
        if (resource.startsWith("render-engine:")) return renderer;
        throw new Error("Unexpected resource " + resource);
    }};
    const bus = {emit() {}};
    const services = {logger, config, bus, logReader, loader, modules: {}, navigation: {}, timer: globalThis};
    services.services = {beginScope({context}) {
        return {
            resolve: name => name === "events" ? {
                on(target, names, command) {
                    for (const name of Array.isArray(names) ? names : [names]) {
                        target.addEventListener(name, event => context.invokeController(command, event));
                    }
                }
            } : services[name],
            async dispose() {}
        };
    }};
    const context = (moduleId, resourceName, resourcePath) => ({
        resourceName, resourcePath, resourceDefinition: {moduleId}, appBasePath: "", services
    });
    for (const [name, component] of [["x-button", button], ["x-object", object]]) {
        const path = "/_assets/x/current/components/" + name + ".js";
        await createComponentClassFromJsDefinition(path, context("x", name, path), {
            ...component, meta: {id: name, renderEngine: "x-client"}
        });
    }
    const src = "/_assets/x-logs/current/pages/logs.js";
    const Page = await createPageClassFromJsDefinition(src, context("x-logs", src, src), definition);
    const instance = new Page({src, context: {}, bus});
    const host = document.createElement("main");
    host.setAttribute("src", src);
    document.body.append(host);
    const action = label => host.querySelector(`x-button[label="${label}"]`)?.shadowRoot.querySelector(".button");
    const record = (id, ...args) => ({id, timestamp: id * 1000, level: "warn", args});
    const reply = (index, items, cursor = null) => queries[index].resolve({items, nextCursor: cursor, hasMore: cursor !== null});
    const rows = () => [...host.querySelectorAll(".logs summary")].map(element => element.textContent);
    const unsubscribe = index => () => subscriptions[index].cleaned++;

    await instance.load();
    check(subscriptions.length === 0, "An unmounted Page subscribed");
    await instance.mount({host});
    if (noReader) {
        await until(() => host.querySelector('[role="alert"]')?.textContent.includes("No reader provider is configured"), "Disabled reader was not shown");
        check(!host.textContent.includes("No matching logs"), "Disabled reader was shown as an empty query");
        await instance.unmount();
        await instance.unload();
        return;
    }
    await until(() => subscriptions.length === 1 && host.textContent.includes("Loading logs"), "Live registration or loading state missing");
    check(queries.length === 0, "Query started before subscription registration");
    subscriptions[0].resolve(unsubscribe(0));
    await until(() => queries.length === 1, "Initial query did not start");
    subscriptions[0].callback();
    subscriptions[0].callback();
    reply(0, [record(2, "before reconciliation")]);
    await until(() => queries.length === 2, "Changes during initial query were not reconciled");

    // Verify that display uses text and that ordinary live row updates produce no logging diagnostics.
    const markup = '<img src="bad" onerror="window.executed = true">';
    const circular = {};
    circular.self = circular;
    const sample = record(3, markup, circular, 42n, new Error("stored error"), {unserializable: true});
    const priorCount = diagnostics.length;
    reply(1, [sample], "older");
    await until(() => rows()[0]?.includes(markup) && action("Older"), "Newest records or pagination did not render");
    check(!host.querySelector(".logs img") && !window.executed, "Stored text was interpreted as HTML");
    check(diagnostics.length === priorCount, "Live query generated logging diagnostics");
    host.querySelector(".logs details").open = true;
    await until(() => host.querySelector("x-object")?.shadowRoot.textContent.includes("Arguments"), "Stored arguments were not available");
    const inspector = host.querySelector("x-object");
    check(inspector.value === sample.args, "Object inspector received rewritten values");
    const nested = () => [...inspector.shadowRoot.querySelectorAll("x-object")];
    await until(() => nested().length === 5 && nested()[2].shadowRoot.textContent.includes("42n"), "Structured values were not safely rendered");
    nested()[1].expand();
    await until(() => nested()[1].shadowRoot.querySelector("x-object")?.shadowRoot.textContent.includes("[Circular]"), "Object inspector lost a cycle");

    // Historical browsing pauses observation and only manual actions issue historical queries.
    action("Older").click();
    await until(() => queries.length === 3, "Older page did not query");
    check(subscriptions[0].cleaned === 1 && queries[2].options.cursor === "older", "Historical browsing did not pause or use the cursor");
    reply(2, [record(1, "older page")]);
    await until(() => rows()[0]?.includes("older page"), "Older records were not shown");
    subscriptions[0].callback();
    await wait(40);
    check(queries.length === 3 && rows()[0].includes("older page"), "Late live notification replaced the historical page");
    action("Refresh").click();
    await until(() => queries.length === 4, "Paused manual refresh did not query");
    check(queries[3].options.cursor === "older", "Manual refresh lost the historical cursor");

    // Change filters while a query is pending and verify the stale result never reaches the DOM.
    for (const input of host.querySelectorAll('[name="level"]')) input.checked = input.value === "warn";
    host.querySelector('[name="from"]').value = "2025-01-01T00:00";
    host.querySelector('[name="to"]').value = "2025-01-02T00:00";
    host.querySelector("form").requestSubmit();
    reply(3, [record(1, "stale result")]);
    await until(() => queries.length === 5, "New filters did not query");
    check(!rows().some(row => row.includes("stale result")), "Old request overwrote new filters");
    check(queries[4].options.levels.join() === "warn" && !queries[4].options.cursor
        && queries[4].options.from === new Date("2025-01-01T00:00").getTime() && queries[4].options.to === new Date("2025-01-02T00:00").getTime(),
        "Severity or date options did not reach the reader");
    reply(4, []);
    await until(() => host.textContent.includes("No matching logs"), "Empty result was not shown");
    action("Refresh").click();
    await until(() => queries.length === 6, "Error test query did not start");
    queries[5].reject(new Error("Reader unavailable"));
    await until(() => host.querySelector('[role="alert"]')?.textContent === "Reader unavailable", "Query error was not shown");
    action("Resume live").click();
    await until(() => subscriptions.length === 2, "Resume did not subscribe");
    subscriptions[1].resolve(unsubscribe(1));
    await until(() => queries.length === 7, "Resume did not reconcile immediately");
    check(!queries[6].options.cursor && queries[6].options.levels.join() === "warn", "Resume lost active filters");
    reply(6, [record(8, "latest after pause")]);
    await until(() => rows()[0]?.includes("latest after pause"), "Resumed Page did not show the latest record");
    action("Pause live").click();
    await until(() => subscriptions[1].cleaned === 1 && action("Resume live"), "Pause did not release observation");
    action("Resume live").click();
    await until(() => subscriptions.length === 3, "Late registration test did not reach subscribe");
    await instance.unmount();
    await instance.unload();
    subscriptions[2].resolve(unsubscribe(2));
    await until(() => subscriptions[2].cleaned === 1, "Page did not clean up late registration after unload");
    check(queries.length === 7, "Disposed Page queried after late registration");
}

test("Logs Page renders, reconciles, filters and cleans up through the Page lifecycle", chromiumOnly,
    () => runInChromium(verifyLogsPage, ["enabled", "disabled"], {realTime: true}));
