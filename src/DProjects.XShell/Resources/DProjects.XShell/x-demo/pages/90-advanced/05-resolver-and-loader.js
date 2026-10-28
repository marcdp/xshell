
export default {
    meta: {
        title: "Resolver and Loader",
        description: "Demonstrates resource resolution, dynamic loading, dependencies, and caching."
    },

    dependencies: {
        fileIcon: "icon:x-file"
    },

    template: `
        <p>XShell uses a Resolver and a Loader to locate and obtain application resources. Pages, Components, icons, DataSets, styles, and other resources share the same loading pipeline.</p>

        <h2>How resource loading works</h2>
        <p>A logical reference identifies a resource without requiring the caller to know its physical URL or implementation format.</p>
        <pre x-pre><code>Logical resource: icon:x-file
    |
    v
Resolver
    |  Finds the matching rule
    |  Determines the URL and loader
    v
Loader
    |  Dispatches to icon-svg
    v
SVG element</code></pre>
        <p>The <strong>Resolver</strong> decides where a resource is and which loader handles it. The <strong>Loader</strong> obtains the actual value.</p>

        <h2>Resource identifiers</h2>
        <p>Resource references begin with a type such as <code>icon:</code>, <code>component:</code>, <code>page:</code>, or <code>dataset:</code>. References may use global names or identify an owning Module explicitly.</p>
        <pre x-pre><code>icon:x-file
icon:x:x-file

component:x-button
component:x:x-button

page:x-demo:/pages/index.js
dataset:x-demo:statuses</code></pre>
        <p>Global and Module-qualified references use the same Resolver and Loader. Module qualification identifies ownership; it does not change the loading mechanism.</p>

        <h2>Interactive resource inspector</h2>
        <p>Select a resource to inspect its resolution information, then load it to see the result.</p>
        <p>
            <x-button label="Icon" command="inspectIcon"></x-button>
            <x-button label="Component" command="inspectComponent"></x-button>
            <x-button label="Module DataSet" command="inspectDataset"></x-button>
            <x-button label="Static DataSet" command="inspectStatic"></x-button>
        </p>

        <x-datafields columns="2">
            <x-datafield label="Logical reference">{{ state.resource }}</x-datafield>
            <x-datafield label="Matched rule">{{ state.rule }}</x-datafield>
            <x-datafield label="Selected loader">{{ state.loaderName }}</x-datafield>
            <x-datafield label="Resolved URL">{{ state.url }}</x-datafield>
        </x-datafields>

        <p>Status: <strong>{{ state.status }}</strong></p>
        <p><x-button label="Load selected resource" command="loadSelected"></x-button></p>
        <p>Loaded value: <strong>{{ state.value }}</strong></p>
        <p>Resolution describes a resource without fetching or constructing it. Loading performs the operation needed to obtain its runtime value.</p>

        <h2>Resolving resources</h2>
        <p>Use <code>resolver.resolve()</code> to inspect how a logical reference maps to a concrete resource.</p>
        <pre x-pre><code>const result = resolver.resolve("icon:x-file");

const url = result.url;
const loaderName = result.definition.loader;</code></pre>
        <p>Resolver rules can be generated from Module inventories or supplied through application configuration.</p>

        <h2>Loading resources dynamically</h2>
        <p>Use <code>loader.load()</code> to resolve and load a resource in one operation.</p>
        <pre x-pre><code>const icon = await loader.load("icon:x-file");
const component = await loader.load("component:x-button");
const dataset = await loader.load("dataset:x-demo:statuses");</code></pre>
        <p>The result depends on the resource type. For example, an icon loader returns an SVG element, while a Component loader returns a Component class.</p>

        <h2>Declarative dependencies</h2>
        <p>When a Page or Component knows which resources it needs, declare them using <code>dependencies</code>. XShell loads those resources before constructing the controller.</p>
        <pre x-pre><code>export default {
    dependencies: {
        fileIcon: "icon:x-file"
    },

    controller({dependencies, state}) {
        return {
            load() {
                state.iconName = dependencies.fileIcon.nodeName;
            }
        };
    }
};</code></pre>
        <p>This Page declares <code>icon:x-file</code> as a dependency. The resolved value is available in the controller as <code>dependencies.fileIcon</code>.</p>
        <p>Declaratively loaded icon: <strong>{{ state.iconName }}</strong></p>
        <p>Use declarative dependencies for resources known when the Page is defined. Use <code>loader.load()</code> for resources selected dynamically at runtime.</p>

        <h2>Loading multiple resources</h2>
        <p>The Loader also accepts an object of resource references and returns an object containing the loaded values under the same keys.</p>
        <pre x-pre><code>const resources = await loader.load({
    icon: "icon:x-file",
    component: "component:x-button"
});

// resources.icon
// resources.component</code></pre>

        <h2>Resource-specific loaders</h2>
        <p>Each loader understands a particular resource format. The generic Loader coordinates dispatch without needing to know how every resource type is implemented.</p>
        <x-datafields columns="2">
            <x-datafield label="icon-svg">Loads an SVG icon element.</x-datafield>
            <x-datafield label="component-js">Loads or creates a Web Component class.</x-datafield>
            <x-datafield label="page-js">Loads or creates a Page class.</x-datafield>
            <x-datafield label="module-js">Imports an ES module.</x-datafield>
            <x-datafield label="dataset-url">Loads and materializes a DataSet.</x-datafield>
        </x-datafields>

        <h2>Caching</h2>
        <p>Resolver rules can enable Loader caching. Cached resources are reused instead of performing the concrete load again.</p>
        <pre x-pre><code>{
    cache: true,
    cacheMode: "full"
}</code></pre>
        <p>The <code>full</code> mode uses the complete logical reference as the cache key. The <code>path</code> mode ignores query parameters when computing cache identity. Whether caching is enabled depends on the matching resolver rule.</p>
        <p>Two different logical references may resolve to the same URL but still have separate cache entries.</p>

        <h2>Errors and missing resources</h2>
        <p>Resolution can fail when no rule matches. Loading can fail even after successful resolution, for example when the underlying resource is unavailable.</p>
        <pre x-pre><code>try {
    const value = await loader.load("icon:x-file");
} catch (error) {
    console.error("Resource load failed:", error);
}</code></pre>
        <p>A resolved URL does not guarantee that the resource can be loaded successfully.</p>

        <h2>Next steps</h2>
        <p>For examples of how engines are selected and loaded, see <x-anchor href="03-engines.js">Engines</x-anchor>. To understand how Modules expose resources, see <x-anchor href="../06-modules/03-resources.js">Module Resources</x-anchor>.</p>
    `,

    state: {
        resource: "",
        rule: "",
        loaderName: "",
        url: "",
        status: "Choose a resource",
        value: "",
        iconName: ""
    },

    controller({resolver, loader, dependencies, state}) {
        return {
            load() {
                state.iconName = dependencies.fileIcon?.nodeName || "Unavailable";
                this.inspectIcon();
            },

            inspectIcon() {
                this.inspect("icon:x-file");
            },

            inspectComponent() {
                this.inspect("component:x-button");
            },

            inspectDataset() {
                this.inspect("dataset:x-demo:statuses");
            },

            inspectStatic() {
                this.inspect("dataset:static:A=Active|I=Inactive");
            },

            inspect(resource) {
                state.resource = resource;
                state.value = "";

                const result = resolver.resolve(resource);

                state.rule = result?.definition?.resource || "No matching rule";
                state.loaderName = result?.definition?.loader || "None";
                state.url = result?.url || "None";
                state.status = result ? "Resolved; ready to load" : "Resolution failed";
            },

            async loadSelected() {
                const resource = state.resource;
                if (!resource) return;

                state.status = "Loading";
                state.value = "";

                try {
                    const value = await loader.load(resource);

                    if (resource.startsWith("icon:")) {
                        state.value = value.nodeName + " element";
                    } else if (resource.startsWith("component:")) {
                        state.value = "Component class: " + (value.name || "Anonymous");
                    } else if (resource.startsWith("dataset:")) {
                        const tables = value.tables || [];
                        const rows = tables.reduce((count, table) =>
                            count + (table.rows?.length || 0), 0);
                        state.value = tables.length + " table(s), " + rows + " row(s)";
                    } else {
                        state.value = "Resource loaded";
                    }

                    state.status = "Loaded";
                } catch (error) {
                    state.status = "Load failed: " + error.message;
                    state.value = "";
                }
            }
        };
    }
};
