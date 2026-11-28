import test from "node:test";
import {chromiumOnly, runInChromium} from "./helpers/chromium.mjs";

async function verifyLogsPage() {
    const [
        {createPageClassFromJsDefinition},
        {createComponentClassFromJsDefinition}, {default: renderer}, {default: proxy}, {default: LogReader}
    ] = await Promise.all([
        "xshell/loaders/page-js.js",
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
    let discoveries = 0;
    const params = new URLSearchParams(location.search);
    const noReader = params.has("disabled");
    const live = params.has("live");
    const pagePath = live ? "/pages/live-logs.js" : "/pages/logs.js";
    const logReader = noReader ? new LogReader({}) : {
        getCategories() {
            return ++discoveries === 1 ? [null, "inventory,棚卸し", "Uncategorized"] : ["new category"];
        },
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
    for (const name of ["x-button", "x-toolbar", "x-object", "x-listview-head", "x-listview-column", "x-listview-body",
        "x-listview-item", "x-listview", "x-logview"]) {
        const owner = name === "x-logview" ? "x-logs" : "x";
        const file = "/components/" + name + ".js";
        const path = "/_assets/" + owner + "/current" + file;
        const {default: component} = await import("/resources/" + owner + file);
        await createComponentClassFromJsDefinition(path, context(owner, name, path), {
            ...component, meta: {id: name, renderEngine: "x-client"}
        });
    }
    const src = "/_assets/x-logs/current" + pagePath;
    const {default: definition} = await import("/resources/x-logs" + pagePath);
    const Page = await createPageClassFromJsDefinition(src, context("x-logs", src, src), definition);
    const instance = new Page({src, context: {}, bus});
    const host = document.createElement("main");
    host.setAttribute("src", src);
    document.body.append(host);
    const action = label => host.querySelector(`x-button[label="${label}"]`)?.shadowRoot.querySelector(".button");
    const record = (id, ...args) => ({id, timestamp: id * 1000 + 5, level: "warn", category: null, args});
    const reply = (index, items, cursor = null) => queries[index].resolve({items, nextCursor: cursor, hasMore: cursor !== null});
    const view = () => host.querySelector("x-logview")?.shadowRoot;
    const items = () => [...(view()?.querySelectorAll("x-listview-item") ?? [])];
    const rows = () => items().map(element => element.textContent);
    const inspector = () => view()?.querySelector("x-object");
    const form = () => host.querySelector("form");
    const categories = () => [...host.querySelectorAll('input[name="category"]')];
    const levels = () => [...host.querySelectorAll('input[name="level"]')];
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
    const nextQuery = async count => until(() => queries.length === count, "Expected query " + count);
    const press = async label => {
        await until(() => action(label), "Missing action " + label);
        action(label).click();
    };
    const markup = '<img src="bad" onerror="window.executed = true">';
    const circular = {};
    circular.self = circular;
    const sample = {...record(3, markup, circular, 42n, new Error("stored error"), {unserializable: true},
        new Map([["key", "value"]]), new Set(["value"])), category: "inventory,棚卸し"};
    const verifyInspector = async () => {
        check(!view().querySelector("img") && !window.executed, "Stored text was interpreted as HTML");
        const item = items().find(item => item.value === sample.id);
        check(item.label.includes(".005") && item.textContent.includes(sample.category), "Milliseconds or Unicode category missing");
        item.querySelector("span").click();
        await until(() => inspector()?.value === sample.args, "Original arguments were not passed to the inspector");
        const nested = () => [...inspector().shadowRoot.querySelectorAll("x-object")];
        await until(() => nested().length === 7 && nested()[2].shadowRoot.textContent.includes("42n"), "Structured arguments did not render");
        nested()[1].expand();
        await until(() => nested()[1].shadowRoot.querySelector("x-object")?.shadowRoot.textContent.includes("[Circular]"), "Circular argument was lost");
        return inspector();
    };

    await until(() => categories().length === 3, "Discovered categories were not offered");
    check(categories()[0].value !== categories()[2].value && categories()[0].parentNode.textContent !== categories()[2].parentNode.textContent,
        "Null and named Uncategorized choices are indistinguishable");

    if (!live) {
        await nextQuery(1);
        check(queries[0].options.limit === 100 && queries[0].options.order === "desc", "Incorrect historical query");
        reply(0, [sample, {...record(2, "older"), timestamp: NaN}], "opaque:older");
        await until(() => rows()[0]?.includes(markup), "Historical display order is wrong");
        check(items()[1].label === "Invalid timestamp", "Invalid timestamp was not handled safely");
        await verifyInspector();
        await press("Older");
        await nextQuery(2);
        check(queries[1].options.cursor === "opaque:older", "Older query lost its cursor");
        reply(1, [record(1, "older page")]);
        await until(() => rows()[0]?.includes("older page") && !inspector(), "Older page or selection did not update");
        categories().slice(0, 2).forEach(input => input.click());
        await press("Refresh");
        await nextQuery(3);
        check(queries[2].options.cursor === "opaque:older", "Refresh lost the cursor");
        await until(() => discoveries === 2 && categories().length === 3 && categories().filter(input => input.checked).length === 2,
            "Refresh did not preserve selections and discover the new category");
        for (const input of levels()) input.checked = input.value === "warn";
        host.querySelector('[name="from"]').value = "2025-01-01T00:00";
        host.querySelector('[name="to"]').value = "2025-01-02T00:00";
        form().requestSubmit();
        await nextQuery(4);
        reply(2, [record(2, "stale result")]);
        const options = queries[3].options;
        check(!options.cursor && options.levels.join() === "warn" && JSON.stringify(options.categories) === JSON.stringify([null, sample.category])
            && options.from === new Date("2025-01-01T00:00").getTime() && options.to === new Date("2025-01-02T00:00").getTime(),
            "Filters did not reach the reader or reset pagination");
        await wait(30);
        check(rows()[0]?.includes("older page"), "Stale query overwrote the display");
        reply(3, [sample], "next-cursor");
        await until(() => rows()[0]?.includes(markup), "Filtered page did not render");
        await press("Older");
        await nextQuery(5);
        reply(4, [record(1, "second filtered page")]);
        await until(() => rows()[0]?.includes("second filtered page"), "Filtered pagination did not render");
        await press("Newer");
        await nextQuery(6);
        check(!queries[5].options.cursor && queries[5].options.levels.join() === "warn", "Newer lost the applied filter or cursor");
        reply(5, []);
        await until(() => host.textContent.includes("No matching logs"), "Empty result was not shown");
        await press("Refresh");
        await nextQuery(7);
        queries[6].reject(new Error("Reader unavailable"));
        await until(() => host.querySelector('[role="alert"]')?.textContent === "Reader unavailable", "Query error was not shown");
        await press("Refresh");
        await nextQuery(8);
        await instance.unmount();
        await instance.unload();
        reply(7, [sample]);
        await wait(40);
        check(subscriptions.length === 0 && queries.length === 8 && !items().length, "Historical Page observed or updated after disposal");
        return;
    }

    await until(() => subscriptions.length === 1 && host.textContent.includes("Loading logs"), "Live registration or loading state missing");
    check(queries.length === 0, "Query started before subscription registration");
    subscriptions[0].resolve(unsubscribe(0));
    await nextQuery(1);
    check(queries[0].options.limit === 200 && queries[0].options.order === "desc", "Live query is unbounded or ordered incorrectly");
    subscriptions[0].callback();
    subscriptions[0].callback();
    await wait(30);
    check(queries.length === 1, "Live reads overlapped");
    reply(0, [sample, record(2, "older")]);
    await nextQuery(2);
    reply(1, [sample, record(2, "older")]);
    await until(() => rows()[1]?.includes(markup), "Live records did not render oldest first");
    const diagnosticsBefore = diagnostics.length;
    await wait(50);
    check(queries.length === 2 && discoveries === 1 && diagnostics.length === diagnosticsBefore, "Idle live viewer triggered work");
    const originalInspector = await verifyInspector();
    subscriptions[0].callback();
    await nextQuery(3);
    const replacement = record(3, "replacement arguments");
    reply(2, [record(4, "new tail"), replacement]);
    await until(() => rows()[1]?.includes("new tail") && inspector()?.value === replacement.args, "New row or replaced arguments did not render");
    check(inspector() === originalInspector, "Refreshing recreated the inspector");
    await wait(50);
    check(queries.length === 3 && discoveries === 1 && diagnostics.length === diagnosticsBefore, "Open inspection triggered a logging feedback loop");

    await press("Pause");
    await until(() => subscriptions[0].cleaned === 1, "Pause did not release observation");
    subscriptions[0].callback();
    await wait(30);
    check(queries.length === 3, "Paused callback queried");
    categories()[2].click();
    levels().forEach(input => { input.checked = false; });
    levels()[0].dispatchEvent(new Event("change", {bubbles: true}));
    await nextQuery(4);
    check(queries[3].options.levels.length === 0 && queries[3].options.categories[0] === "Uncategorized",
        "Live filters discarded no-level selection or the real Uncategorized category");
    reply(3, []);
    await until(() => !inspector(), "Selection outlived a removed record");
    await press("Refresh");
    await nextQuery(5);
    reply(4, []);
    await until(() => discoveries === 2 && categories().some(input => input.checked && input.value === '"Uncategorized"'),
        "Paused refresh did not discover new categories and preserve selections");
    host.hidden = true;
    await wait(50);
    host.hidden = false;
    await wait(50);
    check(subscriptions.length === 1, "Visibility changes resumed explicitly paused monitoring");

    await press("Resume");
    await until(() => subscriptions.length === 2, "Resume did not subscribe");
    await press("Pause");
    await press("Resume");
    await until(() => subscriptions.length === 3, "Rapid resume did not subscribe");
    subscriptions[1].resolve(unsubscribe(1));
    subscriptions[2].resolve(unsubscribe(2));
    await until(() => subscriptions[1].cleaned === 1, "Late paused registration leaked");
    await nextQuery(6);
    check(queries[5].options.categories[0] === "Uncategorized", "Resume lost live filters");
    subscriptions[2].callback();
    reply(5, []);
    await nextQuery(7);
    check(queries[6].options.categories[0] === "Uncategorized" && discoveries === 2, "Notification lost filters or rediscovered categories");
    reply(6, []);
    host.hidden = true;
    await until(() => subscriptions[2].cleaned === 1, "Hidden Page kept its subscription");
    host.hidden = false;
    await until(() => subscriptions.length === 4, "Visible Page did not resume observation");
    await instance.unmount();
    await instance.unload();
    subscriptions[3].resolve(unsubscribe(3));
    await until(() => subscriptions[3].cleaned === 1, "Disposed Page leaked late registration");
    check(queries.length === 7, "Disposed Page queried after late registration");
}

test("Historical Logs queries, paginates and inspects persisted records through the Page lifecycle", chromiumOnly,
    () => runInChromium(verifyLogsPage, ["historical", "historical&disabled"], {realTime: true}));

test("Live Logs reconciles a bounded window and releases subscriptions through the Page lifecycle", chromiumOnly,
    () => runInChromium(verifyLogsPage, ["live", "live&disabled"], {realTime: true}));
