import assert from "node:assert/strict";
import test from "node:test";

import Areas from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js";
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import Logger from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";
import Navigation from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js";

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

const customerAssets = "/_assets/customers/1.0.0.dev";
const inventoryAssets = "/_assets/inventory/1.0.0.dev";

function createMultiInventory(sources, files = ["index.js", "02-settings.html", "01-help.md"]) {
    const owner = (path, label) => ({ label, assets: { path }, files: files.map(file => ({ path: path + "/pages/" + file })) });
    const config = {
        app: { basePath: "/app", baseUrl: "https://example.test/app/" },
        xshell: { assets: { basePath: "/_assets" } },
        modules: { customers: owner(customerAssets, "Customers"), inventory: owner(inventoryAssets, "Inventory") }
    };
    const bus = new EventTarget();
    bus.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
    const areas = new Areas({ config, bus }, { default: "main", definitions: {
        main: { prefix: "main", menus: { navigation: "management" } },
        customers: { prefix: "customers", menus: { navigation: "management" } }
    } });
    const menus = new Menus({ config, bus, areas }, { definitions: { management: { sources } } });
    return { config, bus, areas, menus };
}

test("inventory prefixes separate equal root and nested aliases and preserve Area-independent resource targets", async () => {
    const { config, bus, areas, menus } = createMultiInventory([
        { source: customerAssets + "/pages", path: " /customers/// ", default: false },
        { source: inventoryAssets + "/pages", path: "inventory", default: true }
    ]);
    menus.init();
    areas.init({ menus, modules: {} });
    assert.equal(areas.getArea("main").home, "/main/inventory");
    assert.equal(areas.getArea("customers").home, "/customers/inventory");

    for (const areaId of ["main", "customers"]) {
        const roots = menus.getMenu("navigation", areaId).items;
        assert.deepEqual(roots.map(({ path, href, default: isDefault, children }) => [
            path, href, isDefault, children.map(({ path, href }) => [path, href])
        ]), [["customers", customerAssets, false], ["inventory", inventoryAssets, true]].map(([name, assets, isDefault]) => {
            const path = `/${areaId}/${name}`;
            const href = "/" + areaId + assets + "/pages/";
            return [path, href + "index.js", isDefault, [[path + "/help", href + "01-help.md"], [path + "/settings", href + "02-settings.js"]]];
        }));
    }

    for (const mode of ["path", "hash"]) {
        const container = { querySelectorAll: () => [] };
        const navigation = new Navigation({ logger: new Logger({}), config, bus, areas, menus }, { mode }, { container });
        for (const [name, assets] of [["customers", customerAssets], ["inventory", inventoryAssets]]) {
            const host = { setAttribute(name, value) { this[name] = value; } };
            await navigation.navigate({ href: `/main/${name}/settings?view=full#details`, page: { src: "/main/", host }, open: "auto" });
            assert.equal(host.src, "/main" + assets + "/pages/02-settings.js?view=full#details");
        }
    }
});

test("inventories without explicit defaults remain candidates in source order", () => {
    const { areas, menus } = createMultiInventory([
        { source: customerAssets + "/pages", path: "customers" },
        { source: inventoryAssets + "/pages", path: "inventory" }
    ]);
    menus.init();
    areas.init({ menus, modules: {} });
    assert.deepEqual(menus.getMenu("navigation").items.map(item => item.default), [true, true]);
    assert.equal(areas.getDefaultArea().home, "/main/customers");
});

test("inventories that expose the same root alias fail with both destinations", () => {
    const { menus } = createMultiInventory([{ source: customerAssets + "/pages" }, { source: inventoryAssets + "/pages" }]);
    assert.throws(() => menus.init(), /Area 'main'.*'\/main\/'.*slot 'navigation'.*customers.*slot 'navigation'.*inventory/);
    assert.equal(menus.getMenu("navigation"), null);
});

test("inventory filenames that produce the same alias retain both targets for validation", () => {
    const { menus } = createMultiInventory([{ source: customerAssets + "/pages", path: "customers" }],
        ["index.js", "01-help.js", "02-help.md"]);
    assert.throws(() => menus.init(), /Area 'main'.*'\/main\/customers\/help'.*01-help\.js.*02-help\.md/);
});
