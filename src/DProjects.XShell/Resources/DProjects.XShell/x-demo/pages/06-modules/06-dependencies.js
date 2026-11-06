
export default {
    meta: {
        title: "Using Module Resources",
        description: "Demonstrates declaring, receiving, and using resources provided by registered Modules."
    },

    dependencies: {
        button: "component:x-button",
        fileIcon: "icon:x-file",
        statuses: "dataset:x-demo:statuses"
    },

    template: `
        <p>Once provider Modules have been registered, a Page or Component can declare the particular resources it needs through logical references.</p>

        <h2>Declarative dependencies</h2>
        <p>Use a Page's <code>dependencies</code> property for resources known when the Page definition is loaded.</p>
        <pre x-pre><code>dependencies: {
    button: "component:x-button",
    fileIcon: "icon:x-file",
    statuses: "dataset:x-demo:statuses"
}</code></pre>
        <p>The first two resources come from the referenced <code>x</code> Module. The DataSet belongs to <code>x-demo</code>.</p>

        <h2>Accessing loaded dependencies</h2>
        <p>XShell loads declared dependencies before constructing the Page controller. Their results are injected through the <code>dependencies</code> argument.</p>
        <x-datafields columns="2">
            <x-datafield label="Component class">{{ state.buttonName }}</x-datafield>
            <x-datafield label="Icon element">{{ state.iconName }}</x-datafield>
            <x-datafield label="DataSet table">{{ state.tableName }}</x-datafield>
            <x-datafield label="DataSet rows">{{ state.rowCount }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>controller({dependencies, state}) {
    return {
        load() {
            state.buttonName = dependencies.button.name;
            state.iconName = dependencies.fileIcon.nodeName;
            state.rowCount =
                dependencies.statuses.tables[0].rows.length;
        }
    };
}</code></pre>

        <h2>Using the DataSet</h2>
        <p>The DataSet is already available through the declarative dependency. No additional loading step is required to display its rows.</p>
        <ul>
            <li x-for="row in state.rows" x-key="code">
                {{ row.code }} — {{ row.label }}
            </li>
        </ul>

        <h2>Dynamic resource loading</h2>
        <p>For contrast, use the injected <code>loader</code> service when a resource is selected at runtime rather than known with the Page definition.</p>
        <x-button label="Load icon dynamically" command="loadIcon"></x-button>
        <p>Status: <strong>{{ state.status }}</strong></p>
        <p>Dynamic result: {{ state.dynamicResult }}</p>
        <p>The interactive Resolver and Loader Page inspects this dynamic process in detail; this Page keeps its focus on declarative consumption.</p>

        <h2>Module references versus resource dependencies</h2>
        <p>These two declarations serve different purposes.</p>
        <pre x-pre><code>// Application manifest.jsonc
"modules": {
    "x": {
        "configUrl": "url:../x/manifest.jsonc"
    }
}

// Individual Page
dependencies: {
    icon: "icon:x-file"
}</code></pre>
        <p>The Module reference makes the provider Module available during bootstrap. The Page dependency requests one of its resources.</p>

        <h2>When to use each approach</h2>
        <x-datafields columns="2">
            <x-datafield label="Module reference">Include another Module in application configuration.</x-datafield>
            <x-datafield label="Declarative dependency">Load a resource needed by a particular Page or Component.</x-datafield>
            <x-datafield label="Dynamic loading">Load a resource selected while the application is running.</x-datafield>
        </x-datafields>

        <p>For a deeper explanation of resource resolution, caching, and loading, see <x-anchor href="../90-advanced/05-resolver-and-loader.js">Resolver and Loader</x-anchor>.</p>

        <h2>Technical reference</h2>
        <p>See canonical <x-anchor x-attr:href="state.docsModules">Modules</x-anchor> documentation for provider registration and <x-anchor x-attr:href="state.docsLoaders">Loaders</x-anchor> for declarative dependency semantics.</p>
    `,

    state: {
        buttonName: "",
        iconName: "",
        tableName: "",
        rowCount: 0,
        rows: [],
        status: "Not loaded dynamically",
        dynamicResult: "",
        docsModules: "",
        docsLoaders: ""
    },

    controller({config, dependencies, loader, state}) {
        return {
            load() {
                const table = dependencies.statuses.tables[0];
                state.buttonName = dependencies.button?.name || "Unavailable";
                state.iconName = dependencies.fileIcon?.nodeName || "Unavailable";
                state.tableName = table.name;
                state.rowCount = table.rows.length;
                state.rows = table.rows;
                const docsPath = config.modules["xshell-docs"].assets.path + "/pages/10-architecture";
                state.docsModules = docsPath + "/30-modules.md";
                state.docsLoaders = docsPath + "/90-loaders.md";
            },

            async loadIcon() {
                state.status = "Loading";
                try {
                    const icon = await loader.load("icon:x-file");
                    state.dynamicResult = icon.nodeName;
                    state.status = "Loaded";
                } catch (error) {
                    state.dynamicResult = "";
                    state.status = "Load failed: " + error.message;
                }
            }
        };
    }
};
