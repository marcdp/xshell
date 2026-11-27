
export default {
    meta: {
        title: "Module Menus and Routes",
        description: "Demonstrates Module menu contributions, Page inventory conventions, and routes."
    },

    template: `
        <p>A Module manifest can contribute menu sources and extend an Area's route configuration.</p>

        <h2>Module navigation</h2>
        <p>The <code>x-demo</code> manifest contributes the <code>cookbook</code> menu, and the Cookbook Area selects it as its <code>navigation</code> slot.</p>
        <x-code language="json" x-pre>{
    "xshell": {
        "services": {
            "menus": {
                "options": {
                    "definitions": {
                        "cookbook": { "sources": [{ "source": "/pages" }] }
                    }
                }
            }
        }
    }
}</x-code>
        <p>XShell uses the Module's resource inventory to build a navigation hierarchy from that directory.</p>
        <p>Configured navigation source: <strong>{{ state.source }}</strong></p>

        <h2>The <code>/pages</code> inventory convention</h2>
        <p>Directory and file names can contain numeric prefixes to control the order of generated navigation entries. Display labels omit those prefixes.</p>
        <x-code language="text" x-pre>pages/
├── 01-components/
├── 02-pages/
├── 03-navigation/
├── 06-modules/
│   ├── index.js
│   ├── 01-definition.js
│   ├── 02-references.js
│   └── ...
└── 90-advanced/</x-code>
        <p>Examples from the Modules category:</p>
        <ol>
            <li x-for="item in state.modulePages" x-key="path">
                {{ item.label }} — {{ item.path }}
            </li>
        </ol>
        <p>These entries appear in Areas that select <code>cookbook</code>. Area composition is demonstrated separately in <x-anchor href="../03-navigation/02-areas.js">Areas and Menus</x-anchor>.</p>

        <h2>Area routes</h2>
        <p>The manifest declares this route under <code>xshell.services.areas.options.definitions.cookbook.routes</code>.</p>
        <x-code language="json" x-pre>"routes": {
    "/hello/{name}": "/pages/02-pages/03-parameters.js"
}</x-code>
        <p>The <code>{name}</code> segment is a route parameter consumed by the target Page.</p>
        <p>Configured route target: <code>{{ state.routeTarget }}</code></p>
        <p><x-anchor href="/cookbook/hello/Ada">Open the example route</x-anchor></p>

        <p>Continue with <x-anchor href="06-dependencies.js">Using Module Resources</x-anchor> to consume resources from referenced Modules.</p>

        <h2>Technical reference</h2>
        <p>See <x-anchor x-attr:href="state.docsModules">Modules</x-anchor> for canonical Module configuration semantics and <x-anchor x-attr:href="state.docsAreas">Areas</x-anchor> for composition behavior.</p>
    `,

    state: {
        source: "",
        modulePages: [],
        routeTarget: "",
        docsModules: "",
        docsAreas: ""
    },

    controller({areas, menus, config, state}) {
        return {
            load() {
                // Read the current menu and the Cookbook Area route target.
                const area = areas.getCurrentArea();
                const root = menus.getMenu("navigation", area.id)?.items[0];
                const categories = root?.children || [];

                state.source = config.xshell.services.menus.options.definitions.cookbook.sources[0].source;
                state.routeTarget = areas.getArea("cookbook")?.routes.find(route => route.path === "/hello/{name}")?.href || "";
                const docsPath = config.modules["xshell-docs"].assets.path + "/pages";
                state.docsModules = docsPath + "/10-architecture/30-modules.md";
                state.docsAreas = docsPath + "/30-subsystems/10-areas.md";

                const modulesCategory = categories.find(item =>
                    item.path?.endsWith("/modules")
                );

                state.modulePages = (modulesCategory?.children || [])
                    .slice(0, 5)
                    .map(item => ({
                        label: item.label,
                        path: item.path
                    }));
            }
        };
    }
};
