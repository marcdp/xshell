
export default {
    meta: {
        title: "Engines",
        description: "Explains render and state engines, Module defaults, Page overrides, and engine selection."
    },

    dependencies: {
        clientPage: "page:x-demo2:/pages/90-advanced/04-client-renderer.js"
    },

    template: `
        <p>XShell separates rendering from state management. A <strong>render engine</strong> produces and updates the user interface, while a <strong>state engine</strong> tracks changes to reactive state. The Page or Component loader coordinates both.</p>

        <h2>Engine responsibilities</h2>
        <x-datafields columns="2">
            <x-datafield label="Render engine">Compiles templates and updates rendered output.</x-datafield>
            <x-datafield label="State engine">Creates reactive state and detects changes.</x-datafield>
            <x-datafield label="Page loader">Connects engines with the controller, dependencies, and lifecycle.</x-datafield>
        </x-datafields>
        <pre x-pre><code>Page / Component loader
    |
    +-- State engine  -> Reactive state
    |
    +-- Render engine -> User interface
    |
    +-- Controller    -> Application behavior</code></pre>
        <p>The loader manages Page and Component orchestration. Engines focus on their own responsibilities rather than replacing the Page or Component contract.</p>

        <h2>Module defaults</h2>
        <p>A Module defines its default engine choices for Pages and Components in <code>module.jsonc</code>.</p>
        <x-datafields columns="2">
            <x-datafield label="Default Page render engine">{{ state.defaultPageRender }}</x-datafield>
            <x-datafield label="Default Page state engine">{{ state.defaultPageState }}</x-datafield>
            <x-datafield label="Default Component render engine">{{ state.defaultComponentRender }}</x-datafield>
            <x-datafield label="Default Component state engine">{{ state.defaultComponentState }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>"defaults": {
    "page": {
        "renderEngine": "x",
        "stateEngine": "proxy"
    },
    "component": {
        "renderEngine": "x",
        "stateEngine": "proxy"
    }
}</code></pre>
        <p>These are the actual defaults configured by the <code>x-demo2</code> Module. They apply when a Page or Component does not select a different engine.</p>

        <h2>Page-level overrides</h2>
        <p>A Page can override the Module defaults through its <code>meta</code> properties.</p>
        <pre x-pre><code>export default {
    meta: {
        title: "Client Renderer",
        renderEngine: "x-client"
    },
    template: &#96;
        &lt;p&gt;Hello {{ state.name }}.&lt;/p&gt;
    &#96;,
    state: {
        name: "Ada"
    }
};</code></pre>
        <p>This example selects <code>x-client</code> for rendering but leaves the state engine unspecified, so the Module's <code>proxy</code> default still applies.</p>

        <h2>Effective engine selection</h2>
        <p>XShell selects each engine independently. An explicit Page setting takes precedence over the corresponding Module default.</p>
        <x-datafields columns="2">
            <x-datafield label="This Page — render">{{ state.currentRender }}</x-datafield>
            <x-datafield label="This Page — state">{{ state.currentState }}</x-datafield>
            <x-datafield label="Client Renderer — render">{{ state.clientRender }}</x-datafield>
            <x-datafield label="Client Renderer — state">{{ state.clientState }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const renderEngine =
    implementation.meta.renderEngine ||
    moduleConfig.defaults.page.renderEngine;

const stateEngine =
    implementation.meta.stateEngine ||
    moduleConfig.defaults.page.stateEngine;</code></pre>
        <p>These expressions illustrate the selection rules used by the Page loader.</p>

        <h2>Reactive state in action</h2>
        <p>This Page uses the Module's default engines. Change its state to see the reactive update.</p>
        <p>
            <x-button label="Increment" command="increase"></x-button>
            <x-button label="Reset" command="reset"></x-button>
        </p>
        <p>Counter: <strong>{{ state.count }}</strong></p>
        <pre x-pre><code>state: {
    count: 0
},

controller({state}) {
    return {
        increase() {
            state.count++;
        }
    };
}</code></pre>
        <p>The controller updates reactive state. The state engine detects the change, and the render engine updates the displayed counter.</p>

        <h2>Render engines</h2>
        <p>The <code>x</code> render engine supports X Templates, including interpolation, conditional directives, loops, and reactive bindings.</p>
        <p>The <code>x-client</code> engine is another available rendering implementation. It can be selected without changing the Page's state model or controller contract.</p>
        <p><x-anchor href="04-client-renderer.js">Open the Client Renderer example</x-anchor></p>

        <h2>Loading engines</h2>
        <p>The Page loader resolves the selected engine implementations through the normal resource loading pipeline.</p>
        <pre x-pre><code>const stateEngine = await loader.load(
    "state-engine:" + implementation.meta.stateEngine
);

const renderEngine = await loader.load(
    "render-engine:" + implementation.meta.renderEngine
);</code></pre>
        <p>Engine instances are created and connected by the Page loader. Application Pages do not normally need to load or instantiate them directly.</p>

        <h2>When to override an engine</h2>
        <p>Keep the Module defaults for most Pages and Components. Specify an override when a particular resource needs a different rendering strategy or state implementation.</p>
        <p>Engine overrides belong in the resource definition, while navigation, controller logic, and service injection continue to use the same Page or Component APIs.</p>
        <p>For more information about resource loading, continue with <x-anchor href="05-loading.js">Resolver and Loader</x-anchor>.</p>
    `,

    state: {
        defaultPageRender: "",
        defaultPageState: "",
        defaultComponentRender: "",
        defaultComponentState: "",
        currentRender: "",
        currentState: "",
        clientRender: "",
        clientState: "",
        count: 0
    },

    controller({config, dependencies, implementation, state}) {
        return {
            load() {
                const defaults = config.modules["x-demo2"].defaults;
                const current = implementation.meta;
                const client = dependencies.clientPage.implementation.meta;

                state.defaultPageRender = defaults.page.renderEngine;
                state.defaultPageState = defaults.page.stateEngine;
                state.defaultComponentRender = defaults.component.renderEngine;
                state.defaultComponentState = defaults.component.stateEngine;

                state.currentRender = current.renderEngine;
                state.currentState = current.stateEngine;
                state.clientRender = client.renderEngine;
                state.clientState = client.stateEngine;
            },

            increase() {
                state.count++;
            },

            reset() {
                state.count = 0;
            }
        };
    }
};
