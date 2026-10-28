
export default {
    meta: {
        title: "Creating a Module",
        description: "Define a Module using module.jsonc and inspect its effective runtime configuration."
    },

    template: `
        <p>Every Module has a local definition in <code>module.jsonc</code>. The definition declares the Module's identity and settings. XShell reads it during application bootstrap.</p>

        <h2>Minimal definition</h2>
        <p>A Module is defined by an entry in the <code>modules</code> object.</p>
        <pre x-pre><code>{
    "modules": {
        "my-module": {
            "label": "My Module",
            "version": "1.0.0"
        }
    }
}</code></pre>
        <p>The key <code>my-module</code> is the Module ID. The label is intended for display, while the version identifies the declared Module version.</p>

        <h2>The cookbook definition</h2>
        <p>This application defines <code>x-demo</code> locally, with default engines, a navigation source, and an example route.</p>
        <pre x-pre><code>{
    "modules": {
        "x-demo": {
            "label": "XShell Cookbook",
            "version": "1.0.0",
            "defaults": {
                "page": {
                    "renderEngine": "x",
                    "stateEngine": "proxy"
                },
                "component": {
                    "renderEngine": "x",
                    "stateEngine": "proxy"
                }
            },
            "menus": {
                "navigation": "/pages"
            },
            "routes": {
                "/hello/{name}": "/pages/02-pages/03-parameters.js"
            }
        }
    }
}</code></pre>
        <p>This is an excerpt from the actual definition. The same document also references other Modules and configures the cookbook Area.</p>

        <h2>Module defaults</h2>
        <p>Default engines apply to definition-based Pages and Components unless an individual resource overrides them.</p>
        <x-datafields columns="2">
            <x-datafield label="Page render engine">{{ state.pageRender }}</x-datafield>
            <x-datafield label="Page state engine">{{ state.pageState }}</x-datafield>
            <x-datafield label="Component render engine">{{ state.componentRender }}</x-datafield>
            <x-datafield label="Component state engine">{{ state.componentState }}</x-datafield>
        </x-datafields>

        <h2>Effective configuration</h2>
        <p>Bootstrap resolves and normalizes the local definition. The result is accessible through <code>config.modules</code>.</p>
        <x-datafields columns="2">
            <x-datafield label="Module ID">{{ state.id }}</x-datafield>
            <x-datafield label="Label">{{ state.label }}</x-datafield>
            <x-datafield label="Definition URL">{{ state.configUrl }}</x-datafield>
            <x-datafield label="Virtual asset path">{{ state.assetsPath }}</x-datafield>
            <x-datafield label="Inventory entries">{{ state.fileCount }}</x-datafield>
            <x-datafield label="Runtime Module found">{{ state.runtimeFound }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const definition = config.modules["x-demo"];
const instance = modules.getModuleById("x-demo");

const path = definition.assets.path;
const files = definition.files;</code></pre>
        <p>The effective configuration includes generated information such as the asset path and file inventory. These values are not required in the minimal local definition.</p>

        <h2>Definition versus runtime instance</h2>
        <p>The configuration describes the Module. The runtime Module instance associates that configuration with its controller, routes, and other runtime information.</p>
        <p>Runtime instance uses the resolved configuration: <strong>{{ state.sameConfig }}</strong></p>

        <p>Continue with <x-anchor href="02-references.js">Module References</x-anchor> to see how an application includes Modules defined elsewhere.</p>
    `,

    state: {
        id: "x-demo",
        label: "",
        configUrl: "",
        assetsPath: "",
        fileCount: 0,
        runtimeFound: false,
        sameConfig: false,
        pageRender: "",
        pageState: "",
        componentRender: "",
        componentState: ""
    },

    controller({config, modules, state}) {
        return {
            load() {
                const definition = config.modules["x-demo"];
                const instance = modules.getModuleById("x-demo");
                const defaults = definition.defaults;

                state.label = definition.label;
                state.configUrl = definition.configUrl;
                state.assetsPath = definition.assets.path;
                state.fileCount = definition.files.length;
                state.runtimeFound = !!instance;
                state.sameConfig = instance?.config === definition;

                state.pageRender = defaults.page.renderEngine;
                state.pageState = defaults.page.stateEngine;
                state.componentRender = defaults.component.renderEngine;
                state.componentState = defaults.component.stateEngine;
            }
        };
    }
};
