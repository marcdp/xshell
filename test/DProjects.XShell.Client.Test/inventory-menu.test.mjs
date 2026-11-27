import assert from "node:assert/strict";
import test from "node:test";

import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";

for (const [rootIndex, runtimeIndex] of [["index.js", "index.js"], ["index.html", "index.js"], ["index.md", "index.md"]]) {
test(`inventory menu normalizes root ${rootIndex} and nested Page destinations`, () => {
    const paths = [
        `/_assets/x-demo/pages/${rootIndex}`,
        "/_assets/x-demo/pages/01-guides/index.html",
        "/_assets/x-demo/pages/01-guides/01-start.js",
        "/_assets/x-demo/pages/01-guides/02-readme.md"
    ];
    const module = { id: "x-demo" };
    const definitions = { demo: { label: "Browse", sources: [{ source: "/_assets/x-demo/pages" }] } };
    const config = {
        xshell: { assets: { basePath: "/_assets" } },
        modules: { "x-demo": { assets: { path: "/_assets/x-demo" }, label: "Demo", files: paths.map(path => ({ path })) } }
    };
    const bus = new EventTarget();
    const areas = new Areas({ config, bus }, {
        default: "demo", definitions: { demo: { prefix: "/demo", modules: [], menus: { navigation: "demo" } } }
    });
    const menus = new Menus({ areas, bus, config }, { definitions });
    menus.init();
    areas.init({ menus, modules: { getModuleById() { return module; } } });
    const menu = menus.getMenu("navigation");
    const [root] = menu.items;
    assert.equal(menu.label, "Browse");
    assert.equal(root.label, "Demo");
    assert.equal(areas.getArea("demo").home, "/demo/");
    assert.equal(root.module, "x-demo");
    assert.equal(root.path, "/demo/");
    assert.equal(root.href, `/demo/_assets/x-demo/pages/${runtimeIndex}`);
    assert.equal(root.children[0].href, "/demo/_assets/x-demo/pages/01-guides/index.js");
    assert.equal(root.children[0].children[0].href, "/demo/_assets/x-demo/pages/01-guides/01-start.js");
    assert.equal(root.children[0].children[1].href, "/demo/_assets/x-demo/pages/01-guides/02-readme.md");
});
}

test("inventory menu uses Page metadata for files and directory index Pages", () => {
    const files = [
        { path: "/_assets/x-demo/pages/index.js", resource: { type: "page", title: "Ignored root title" } },
        { path: "/_assets/x-demo/pages/03-advanced/index.html", resource: {
            type: "page", title: "Advanced Topics", description: "Explore advanced features.", icon: "x-settings"
        } },
        { path: "/_assets/x-demo/pages/03-advanced/01-resolvers.js", resource: {
            type: "page", title: "Resource Resolution", description: "Resolve logical resources.", icon: "x-route"
        } },
        { path: "/_assets/x-demo/pages/04-plain.js" }
    ];
    const module = { id: "x-demo" };
    const definitions = { demo: { sources: [{ source: "/_assets/x-demo/pages" }] } };
    const config = {
        xshell: { assets: { basePath: "/_assets" } },
        modules: { "x-demo": { assets: { path: "/_assets/x-demo" }, label: "Demo", files } }
    };
    const bus = new EventTarget();
    const areas = new Areas({ config, bus }, {
        default: "demo", definitions: { demo: { prefix: "/demo", modules: [], menus: { navigation: "demo" } } }
    });

    const menus = new Menus({ areas, bus, config }, { definitions });
    menus.init();
    areas.init({ menus, modules: { getModuleById() { return module; } } });

    const [root] = menus.getMenu("navigation").items;
    assert.equal(root.label, "Demo");
    assert.equal(root.children[0].label, "Advanced Topics");
    assert.equal(root.children[0].description, "Explore advanced features.");
    assert.equal(root.children[0].icon, "x-settings");
    assert.equal(root.children[0].path, "/demo/advanced");
    assert.equal(root.children[0].href, "/demo/_assets/x-demo/pages/03-advanced/index.js");
    assert.equal(root.children[0].children[0].label, "Resource Resolution");
    assert.equal(root.children[0].children[0].description, "Resolve logical resources.");
    assert.equal(root.children[0].children[0].icon, "x-route");
    assert.equal(root.children[1].label, "Plain");
    assert.equal(Object.hasOwn(root.children[1], "description"), false);
});
