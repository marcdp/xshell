
export default {
    meta: {
        title: "Menus and Areas",
        description: "Demonstrates Module navigation contributions, Area membership, and routes."
    },

    template: `
        <p>Modules can contribute navigation definitions and routes. Areas use selected Modules to build navigation menus and resolve application paths.</p>

        <h2>Module navigation</h2>
        <p>The <code>x-demo</code> Module declares <code>/pages</code> as the source for its navigation menu.</p>
        <pre x-pre><code>{
    "modules": {
        "x-demo": {
            "menus": {
                "navigation": "/pages"
            }
        }
    }
}</code></pre>
        <p>XShell uses the Module's resource inventory to build a navigation hierarchy from that directory.</p>
        <p>Configured navigation source: <strong>{{ state.source }}</strong></p>

        <h2>Areas</h2>
        <p>An Area defines a navigation context and identifies the Modules that participate in it.</p>
        <pre x-pre><code>"xshell": {
    "areas": {
        "default": "cookbook",
        "definitions": {
            "cookbook": {
                "prefix": "cookbook",
                "label": "Cookbook",
                "modules": ["x-demo"]
            }
        }
    }
}</code></pre>
        <p>This Area includes the <code>x-demo</code> Module. Other referenced Modules remain available as resource providers without automatically contributing menu items.</p>
        <x-datafields columns="2">
            <x-datafield label="Current Area ID">{{ state.areaId }}</x-datafield>
            <x-datafield label="Current Area label">{{ state.areaLabel }}</x-datafield>
            <x-datafield label="Area prefix">{{ state.areaPrefix }}</x-datafield>
            <x-datafield label="Participating Modules">{{ state.areaModules }}</x-datafield>
        </x-datafields>

        <h2>Generated navigation</h2>
        <p>The following categories come from the current Area's effective navigation menu.</p>
        <ul>
            <li x-for="item in state.categories" x-key="path">
                <strong>{{ item.label }}</strong>
                — {{ item.path }}
                ({{ item.count }} children)
            </li>
        </ul>
        <pre x-pre><code>const area = areas.getCurrentArea();
const menu = areas.getMenu("navigation", area.id);

const root = menu[0];
const categories = root.children;</code></pre>

        <h2>Page organization</h2>
        <p>Directory and file names can contain numeric prefixes to control the order of generated navigation entries. Display labels omit those prefixes.</p>
        <pre x-pre><code>pages/
├── 01-components/
├── 02-pages/
├── 03-navigation/
├── 06-modules/
│   ├── index.js
│   ├── 01-definition.js
│   ├── 02-references.js
│   └── ...
└── 90-advanced/</code></pre>
        <p>Examples from the Modules category:</p>
        <ol>
            <li x-for="item in state.modulePages" x-key="path">
                {{ item.label }} — {{ item.path }}
            </li>
        </ol>

        <h2>Module routes</h2>
        <p>Modules can declare route mappings. Routes map an application path to a Page resource.</p>
        <pre x-pre><code>"routes": {
    "/hello/{name}": "/pages/02-pages/03-parameters.js"
}</code></pre>
        <p>The <code>{name}</code> segment is a route parameter consumed by the target Page.</p>
        <p>Configured route target: <code>{{ state.routeTarget }}</code></p>
        <p><x-anchor href="/cookbook/hello/Ada">Open the example route</x-anchor></p>

        <h2>Module versus Area responsibilities</h2>
        <x-datafields columns="2">
            <x-datafield label="Module">Provides Pages, menu sources, routes, and resources.</x-datafield>
            <x-datafield label="Area">Selects participating Modules and establishes a navigation context.</x-datafield>
        </x-datafields>
        <p>A Module can exist without being included in the current Area's menu. Its resources can still be addressed through the Resolver and Loader.</p>

        <p>Continue with <x-anchor href="06-dependencies.js">Using Module Resources</x-anchor> to consume resources from referenced Modules.</p>
    `,

    state: {
        source: "",
        areaId: "",
        areaLabel: "",
        areaPrefix: "",
        areaModules: "",
        categories: [],
        modulePages: [],
        routeTarget: ""
    },

    controller({areas, config, state}) {
        return {
            load() {
                const definition = config.modules["x-demo"];
                const area = areas.getCurrentArea();
                const areaConfig = config.xshell.areas.definitions[area.id];
                const root = areas.getMenu("navigation", area.id)[0];
                const categories = root?.children || [];

                state.source = definition.menus.navigation;
                state.areaId = area.id;
                state.areaLabel = area.label;
                state.areaPrefix = areaConfig.prefix;
                state.areaModules = areaConfig.modules.join(", ");
                state.routeTarget =
                    definition.routes["/hello/{name}"] || "";

                state.categories = categories.map(item => ({
                    label: item.label,
                    path: item.path,
                    count: item.children?.length || 0
                }));

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
