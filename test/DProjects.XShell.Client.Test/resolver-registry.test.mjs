import assert from "node:assert/strict";
import test from "node:test";

import Resolver from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/resolver.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/navigation.js";
import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/areas.js";

test("resolver registry snapshots expose rule metadata without mutable definitions", () => {
    const resolver = new Resolver({ config: { app: { basePath: "/app", baseUrl: "https://example.test/app/" }, xshell: { resolver: {} } } });
    const before = resolver.registry;
    assert.deepEqual(before, []);

    resolver.addDefinition("icon:{name}", { src: "/icons/{name}.svg", loader: "icon-svg", cache: true });
    const after = resolver.registry;
    assert.equal(Object.isFrozen(after), true);
    assert.equal(Object.isFrozen(after[0]), true);
    assert.equal(after[0].loader, "icon-svg");
    assert.equal(after[0].src, "/icons/{name}.svg");
    assert.equal(Object.hasOwn(after[0], "url"), false);
    assert.equal(Object.hasOwn(after[0], "regexp"), false);
    assert.throws(() => { after[0].src = "/changed"; }, TypeError);
    assert.deepEqual(before, []);
    const result = resolver.resolve("icon:check");
    assert.equal(result.path, "/icons/check.svg");
    assert.equal(result.url, "https://example.test/app/icons/check.svg");
});

test("resolver resolves absolute URL rules without a logical application path", () => {
    const resolver = new Resolver({ config: { app: { basePath: "/app", baseUrl: "https://example.test/app/" }, xshell: { resolver: {} } } });

    resolver.addDefinition("icon:{name}", { src: "https://cdn.example.test/icons/{name}.svg", loader: "icon-svg", cache: true });

    const result = resolver.resolve("icon:check");
    assert.equal(result.path, null);
    assert.equal(result.url, "https://cdn.example.test/icons/check.svg");
});

test("resolver patterns preserve literal text and capture named placeholders", () => {
    const resolver = new Resolver({ config: { app: { basePath: "/app", baseUrl: "https://example.test/app/" }, xshell: { resolver: {} } } });

    resolver.addDefinition("icon:x-{name}", { src: "/icons/x-{name}.svg" });
    resolver.addDefinition("page:/_assets/demo/{path}.js", { src: "/_assets/demo/{path}.js" });
    resolver.addDefinition("resource:{group}-{name}", { src: "/resources/{group}/{name}.js" });
    resolver.addDefinition("literal:x+([*|{name}.js", { src: "/literal/{name}.js" });

    assert.equal(resolver.resolve("icon:x-check").path, "/icons/x-check.svg");
    const page = resolver.resolve("page:/_assets/demo/orders/details.js");
    assert.equal(page.definition.src, "/_assets/demo/{path}.js");
    assert.equal(page.path, "/_assets/demo/orders/details.js");
    assert.equal(page.url, "https://example.test/app/_assets/demo/orders/details.js");
    const grouped = resolver.resolve("resource:admin-dashboard-panel");
    assert.equal(grouped.path, "/resources/admin/dashboard-panel.js");
    assert.equal(grouped.url, "https://example.test/app/resources/admin/dashboard-panel.js");
    assert.equal(resolver.has("literal:x+([*|demo.js"), true);
    assert.equal(resolver.has("literal:xxxdemo.js"), false);
    assert.equal(resolver.registry.find(definition => definition.resource === "page:/_assets/demo/{path}.js").resource, "page:/_assets/demo/{path}.js");
});

test("resolver gives name and path placeholders safe unambiguous semantics", () => {
    const resolver = new Resolver({ config: { app: { basePath: "/app", baseUrl: "https://example.test/app/" }, xshell: { resolver: {
        dataset: {
            "x-demo:{name}": { src: "/_assets/x-demo/datasets/{name}.json", loader: "dataset-url" },
            "x-demo:/{path}": { src: "/_assets/x-demo/{path}", loader: "dataset-url" }
        },
        page: { "x-demo:/{path}": { src: "/_assets/x-demo/{path}", loader: "page-js" } },
        component: { "x:{name}": { src: "/_assets/x/components/{name}.js", loader: "component-js" } },
        icon: { "x-file": { src: "/icons/x-file.svg", loader: "icon-svg" } },
        module: {
            "{name}": { src: "/modules/{name}.js", loader: "module-js" },
            "x-demo:/{path}": { src: "/_assets/x-demo/{path}", loader: "module-js" }
        }
    } } } });

    const cases = [
        ["dataset:x-demo:countries", "/_assets/x-demo/datasets/countries.json", "dataset-url"],
        ["dataset:x-demo:/datasets/countries.json", "/_assets/x-demo/datasets/countries.json", "dataset-url"],
        ["page:x-demo:/pages/index.js", "/_assets/x-demo/pages/index.js", "page-js"],
        ["component:x:x-button", "/_assets/x/components/x-button.js", "component-js"],
        ["dataset:x-demo:/crm/customers.json", "/_assets/x-demo/crm/customers.json", "dataset-url"],
        ["icon:x-file", "/icons/x-file.svg", "icon-svg"],
        ["module:xshell", "/modules/xshell.js", "module-js"]
    ];
    for (const [resource, path, loader] of cases) {
        assert.equal(resolver.has(resource), true, resource);
        const result = resolver.resolve(resource);
        assert.equal(result.path, path, resource);
        assert.equal(result.url, "https://example.test/app" + path, resource);
        assert.equal(result.definition.loader, loader, resource);
    }

    const invalid = [
        "dataset:x-demo:crm/customers",
        "dataset:x-demo:../config",
        "dataset:x-demo:.",
        "dataset:x-demo:..",
        "dataset:x-demo:crm\\customers",
        "dataset:x-demo:%2e%2e",
        "dataset:x-demo:/crm/../config.json",
        "dataset:x-demo:/crm//customers.json",
        "dataset:x-demo:/crm\\customers.json",
        "dataset:x-demo:/%2e%2e/config.json",
        "dataset:x-demo:/crm/%2f/config.json",
        "dataset:x-demo:/crm/./customers.json",
        "dataset:x-demo:/.",
        "dataset:x-demo:/..",
        "dataset:x-demo:",
        "dataset:x-demo:/",
        "dataset:x-demo://crm/customers.json",
        "dataset:x-demo:/crm/customers.json/"
    ];
    const originalError = console.error;
    console.error = () => {};
    try {
        for (const resource of invalid) {
            assert.equal(resolver.has(resource), false, resource);
            assert.equal(resolver.resolve(resource), null, resource);
        }
    } finally {
        console.error = originalError;
    }

    const suffixedCases = [
        ["dataset:x-demo:countries", "/_assets/x-demo/datasets/countries.json"],
        ["dataset:x-demo:countries?page=2", "/_assets/x-demo/datasets/countries.json"],
        ["dataset:x-demo:countries#section", "/_assets/x-demo/datasets/countries.json"],
        ["dataset:x-demo:countries?page=2#section", "/_assets/x-demo/datasets/countries.json"],
        ["page:x-demo:/pages/home.js?mode=edit", "/_assets/x-demo/pages/home.js"],
        ["module:x-demo:/utils/formatter.js#export", "/_assets/x-demo/utils/formatter.js"],
        ["icon:x-file?theme=dark#preview", "/icons/x-file.svg"]
    ];
    for (const [resource, path] of suffixedCases) {
        assert.equal(resolver.has(resource), true, resource);
        const result = resolver.resolve(resource);
        assert.equal(result.path, path, resource);
        assert.equal(result.url, "https://example.test/app" + path, resource);
    }

    const invalidSuffixedCases = [
        "dataset:x-demo:missing/invalid",
        "dataset:x-demo:../config?page=2",
        "dataset:x-demo:/crm/../config.json#section"
    ];
    const originalSuffixedError = console.error;
    console.error = () => {};
    try {
        for (const resource of invalidSuffixedCases) {
            assert.equal(resolver.has(resource), false, resource);
            assert.equal(resolver.resolve(resource), null, resource);
        }
    } finally {
        console.error = originalSuffixedError;
    }
});

test("resolver rejects invalid placeholder grammar", () => {
    const resolver = new Resolver({ config: { app: { basePath: "/app", baseUrl: "https://example.test/app/" }, xshell: { resolver: {} } } });
    const invalidPatterns = [
        ["icon:{}", "empty placeholder name"],
        ["icon:{bad-name}", "invalid placeholder name 'bad-name'"],
        ["icon:{name", "unmatched '{'"],
        ["icon:name}", "unmatched '}'"],
        ["icon:{a}{b}", "adjacent placeholders"],
        ["icon:{name}-{name}", "duplicate placeholder 'name'"]
    ];

    for (const [pattern, reason] of invalidPatterns) {
        assert.throws(() => resolver.addDefinition(pattern, { src: "/resource.js" }), new RegExp(reason));
    }
});

test("navigation and areas keep their domain-specific inspection APIs", () => {
    assert.equal("registry" in Navigation.prototype, false);
    assert.equal("registry" in Areas.prototype, false);
});
