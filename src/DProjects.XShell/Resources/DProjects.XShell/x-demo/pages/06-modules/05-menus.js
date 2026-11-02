
export default {
    meta: {
        title: "Menus and Areas",
        description: "Demonstrates Module menu contributions, Page inventory conventions, and routes."
    },

    template: `
        <p>A Module can contribute menu sources and route mappings. Areas decide which registered Modules participate in a navigation context.</p>

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

        <h2>The <code>/pages</code> inventory convention</h2>
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
        <p>These entries are observed after the current Area includes <code>x-demo</code>. Area composition is demonstrated separately in <x-anchor href="../03-navigation/02-areas.js">Areas and Menus</x-anchor>.</p>

        <h2>Module routes</h2>
        <p>Modules can declare route mappings. Routes map an application path to a Page resource.</p>
        <pre x-pre><code>"routes": {
    "/hello/{name}": "/pages/02-pages/03-parameters.js"
}</code></pre>
        <p>The <code>{name}</code> segment is a route parameter consumed by the target Page.</p>
        <p>Configured route target: <code>{{ state.routeTarget }}</code></p>
        <p><x-anchor href="/cookbook/hello/Ada">Open the example route</x-anchor></p>

        <h2>Contribution availability</h2>
        <p>The current <strong>{{ state.areaId }}</strong> Area includes these Modules: {{ state.areaModules }}. A registered Module that is not an Area member remains available as a resource provider, but its menu contribution is not composed into that Area.</p>

        <p>Continue with <x-anchor href="06-dependencies.js">Using Module Resources</x-anchor> to consume resources from referenced Modules.</p>
    `,

    state: {
        source: "",
        areaId: "",
        areaModules: "",
        modulePages: [],
        routeTarget: ""
    },

    controller({areas, config, state}) {
        return {
            load() {
                const definition = config.modules["x-demo"];
                const area = areas.getCurrentArea();
                const root = areas.getMenu("navigation", area.id)[0];
                const categories = root?.children || [];

                state.source = definition.menus.navigation;
                state.areaId = area.id;
                state.areaModules = area.modules.join(", ");
                state.routeTarget =
                    definition.routes["/hello/{name}"] || "";

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
