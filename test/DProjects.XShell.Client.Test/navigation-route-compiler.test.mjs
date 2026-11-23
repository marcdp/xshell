import assert from "node:assert/strict";
import test from "node:test";

import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";
import { compileRoute } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/utils/route.js";

function createNavigation(routes = []) {
    const area = { id: "test", prefix: "", routes };
    return new Navigation({
        areas: { resolveAreaId() { return "test"; }, getArea() { return area; } },
        bus: {},
        config: {
            app: { basePath: "", baseUrl: "https://example.test/" },
            xshell: {}
        }
    }, { mode: "path" }, { container: {} });
}

test("route compiler handles literal paths", () => {
    const route = compileRoute("/something");

    assert.deepEqual(route.parameters, []);
    assert.equal(route.matcher.test("/something"), true);
    assert.equal(route.matcher.test("/other"), false);
});

test("route compiler preserves parameter declaration order", () => {
    const route = compileRoute("/repository/{repositoryId}/projects/{projectId}/items");

    assert.deepEqual(route.parameters, ["repositoryId", "projectId"]);
    assert.equal(route.matcher.test("/repository/12/projects/7/items"), true);
    assert.equal(route.matcher.test("/repository/12/projects/7/items/extra"), false);
});

test("route compiler escapes literal regex characters and parameters match one segment", () => {
    const route = compileRoute("/v1.0/items/{id}");

    assert.equal(route.matcher.test("/v1.0/items/a"), true);
    assert.equal(route.matcher.test("/v1x0/items/a"), false);
    assert.equal(route.matcher.test("/v1.0/items/a/b"), false);
});

test("route compiler rejects malformed and unsupported patterns", () => {
    for (const path of [
        "/repository/{}",
        "/repository/{123id}",
        "/repository/{repository-id}",
        "/repository/{id}/thing-{other}",
        "/repository/{id",
        "/repository/{id}/items/{id}",
        "/repository/*",
        "/repository/{id}?value"
    ]) {
        assert.throws(() => compileRoute(path), /Invalid route path/);
    }
});

test("Area route matching returns the first matching route and extracted parameters", () => {
    const area = {
        routes: [
            { path: "/repository/{repositoryId}", href: "/_assets/repository/pages/index.js", module: "repository" },
            { path: "/repository/{repositoryId}/projects/{projectId}/items", href: "/_assets/repository/pages/items.js", module: "repository" }
        ]
    };
    const result = createNavigation(area.routes).resolveRoute("/repository/12/projects/7/items");

    assert.equal(result.route, area.routes[1].path);
    assert.equal(result.target, area.routes[1].href);
    assert.deepEqual(result.params, { repositoryId: "12", projectId: "7" });
});

test("Area route matching preserves declaration order for duplicate matches", () => {
    const first = { path: "/items", href: "/_assets/first/pages/items.js", module: "first" };
    const second = { path: "/items", href: "/_assets/second/pages/items.js", module: "second" };

    const result = createNavigation([first, second]).resolveRoute("/items");

    assert.equal(result.target, first.href);
});

test("Area route matching uses the first parameterized candidate without ranking", () => {
    const first = { path: "/items/{id}", href: "/_assets/first/pages/item.js", module: "first" };
    const second = { path: "/items/{name}", href: "/_assets/second/pages/item.js", module: "second" };

    const result = createNavigation([first, second]).resolveRoute("/items/123");

    assert.equal(result.target, first.href);
    assert.deepEqual(result.params, { id: "123" });
});

test("Area route matching does not prefer literal routes over earlier parameterized routes", () => {
    const parameterized = { path: "/items/{id}", href: "/_assets/first/pages/item.js", module: "first" };
    const literal = { path: "/items/special", href: "/_assets/second/pages/special.js", module: "second" };
    assert.equal(createNavigation([parameterized, literal]).resolveRoute("/items/special").target, parameterized.href);
    assert.equal(createNavigation([literal, parameterized]).resolveRoute("/items/special").target, literal.href);
});

test("Area route matching ignores query strings and hash fragments", () => {
    const route = { path: "/repository/{repositoryId}", href: "/_assets/repository/pages/index.js", module: "repository" };
    const result = createNavigation([route]).resolveRoute("/repository/12?tab=history#section");

    assert.deepEqual(result.params, { repositoryId: "12" });
});

test("Area route matching decodes each captured segment without changing boundaries", () => {
    const route = { path: "/repository/{repositoryId}", href: "/_assets/repository/pages/index.js", module: "repository" };
    const result = createNavigation([route]).resolveRoute("/repository/abc%2Fdef");

    assert.deepEqual(result.params, { repositoryId: "abc/def" });
});

test("Area route matching returns null when no route matches", () => {
    const result = createNavigation([{ path: "/items", href: "/items.js", module: "test" }]).resolveRoute("/missing");

    assert.equal(result, null);
});

test("Area route matching reports malformed percent encoding clearly", () => {
    const route = { path: "/repository/{repositoryId}", href: "/items.js", module: "test" };

    assert.throws(
        () => createNavigation([route]).resolveRoute("/repository/%E0%A4%A"),
        /Invalid encoded route parameter/
    );
});

test("Area route matching does not mutate route descriptors or resolve hrefs", () => {
    const route = Object.freeze({ path: "/items", href: "/_assets/test/pages/items.js", module: "test" });
    const result = createNavigation([route]).resolveRoute("/items");

    assert.equal(result.route, route.path);
    assert.equal(result.target, "/_assets/test/pages/items.js");
    assert.deepEqual(result.params, {});
});
