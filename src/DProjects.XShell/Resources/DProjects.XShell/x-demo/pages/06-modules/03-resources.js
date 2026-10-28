
export default {
    meta: {
        title: "Module Resources",
        description: "Explore Module resources, file inventories, virtual asset paths, and logical references."
    },

    template: `
        <p>A Module owns resources that can be consumed by other parts of the application. XShell discovers those resources through the Module's file inventory and makes them addressable through the Resolver and Loader.</p>

        <h2>Organizing resources</h2>
        <p>A Module can contain different resource types:</p>
        <pre x-pre><code>my-module/
├── module.jsonc
├── module.js
├── pages/
│   └── index.js
├── components/
│   └── my-card.js
├── datasets/
│   └── statuses.json
├── icons/
├── styles/
└── ...</code></pre>
        <p>Not every Module needs all of these directories. The required structure depends on the resources it provides.</p>

        <h2>Resource identifiers</h2>
        <p>Consumers request resources through logical references rather than hardcoded asset URLs.</p>
        <pre x-pre><code>page:x-demo:/pages/index.js
dataset:x-demo:statuses

component:x-button
icon:x-file</code></pre>
        <p>The first two references explicitly identify <code>x-demo</code>. The Component and icon examples use global logical names supplied by the <code>x</code> Module.</p>

        <h2>Physical and virtual locations</h2>
        <p>Bootstrap gives each Module a virtual asset namespace. Resource identifiers resolve through this namespace to concrete resource URLs.</p>
        <x-datafields columns="2">
            <x-datafield label="Definition URL">{{ state.configUrl }}</x-datafield>
            <x-datafield label="Physical assets URL">{{ state.assetsUrl }}</x-datafield>
            <x-datafield label="Virtual assets path">{{ state.assetsPath }}</x-datafield>
            <x-datafield label="Inventory entries">{{ state.fileCount }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const module = config.modules["x-demo"];

const definitionUrl = module.configUrl;
const assetsUrl = module.assets.url;
const assetsPath = module.assets.path;
const files = module.files;</code></pre>

        <h2>Resource inventory</h2>
        <p>Each Module has an effective file inventory. It describes the files available under its asset namespace.</p>
        <p>Page files: <strong>{{ state.pageCount }}</strong></p>
        <p>DataSet files: <strong>{{ state.datasetCount }}</strong></p>
        <p>Example inventory paths:</p>
        <ul>
            <li x-for="item in state.examples" x-key="path"><code>{{ item.path }}</code></li>
        </ul>
        <p>The inventory is also used by features such as automatic navigation and optional Module controllers.</p>

        <h2>Resolving a Module DataSet</h2>
        <p>The cookbook contains <code>datasets/statuses.json</code>. Its logical reference is <code>dataset:x-demo:statuses</code>.</p>
        <x-datafields columns="2">
            <x-datafield label="Logical resource">{{ state.resource }}</x-datafield>
            <x-datafield label="Selected loader">{{ state.loaderName }}</x-datafield>
            <x-datafield label="Resolved URL">{{ state.datasetUrl }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const result = resolver.resolve(
    "dataset:x-demo:statuses"
);

// result.url
// result.definition.loader</code></pre>
        <p>Resolution determines where the resource is and which loader handles it. It does not load the DataSet itself.</p>

        <h2>Loading the resource</h2>
        <p>Use <code>loader.load()</code> to obtain the concrete value.</p>
        <x-button label="Load statuses" command="loadStatuses"></x-button>
        <p>Status: {{ state.status }}</p>
        <ul>
            <li x-for="row in state.rows" x-key="code">{{ row.code }} — {{ row.label }}</li>
        </ul>
        <pre x-pre><code>const dataset = await loader.load(
    "dataset:x-demo:statuses"
);

const rows = dataset.tables[0].rows;</code></pre>

        <p>Continue with <x-anchor href="04-controller.js">Module Controller</x-anchor> to see how a Module uses its configuration and inventory at startup.</p>
    `,

    state: {
        configUrl: "",
        assetsUrl: "",
        assetsPath: "",
        fileCount: 0,
        pageCount: 0,
        datasetCount: 0,
        examples: [],
        resource: "dataset:x-demo:statuses",
        loaderName: "",
        datasetUrl: "",
        status: "Not loaded",
        rows: []
    },

    controller({config, resolver, loader, state}) {
        return {
            load() {
                const module = config.modules["x-demo"];
                const files = module.files;
                const prefix = module.assets.path;
                const result = resolver.resolve(state.resource);

                state.configUrl = module.configUrl;
                state.assetsUrl = module.assets.url;
                state.assetsPath = prefix;
                state.fileCount = files.length;

                state.pageCount = files.filter(file =>
                    file.path.startsWith(prefix + "/pages/") &&
                    /\.(js|html|md)$/.test(file.path)
                ).length;

                state.datasetCount = files.filter(file =>
                    file.path.startsWith(prefix + "/datasets/") &&
                    file.path.endsWith(".json")
                ).length;

                state.examples = files
                    .filter(file =>
                        file.path.startsWith(prefix + "/pages/") ||
                        file.path.startsWith(prefix + "/datasets/")
                    )
                    .slice(0, 5)
                    .map(file => ({path: file.path}));

                state.loaderName = result?.definition?.loader || "No match";
                state.datasetUrl = result?.url || "Not resolved";
            },

            async loadStatuses() {
                state.status = "Loading";

                try {
                    const dataset = await loader.load(state.resource);
                    state.rows = dataset.tables[0].rows;
                    state.status = "Loaded";
                } catch (error) {
                    state.rows = [];
                    state.status = "Load failed: " + error.message;
                }
            }
        };
    }
};
