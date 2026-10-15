// contract
export const contract = {
    description: "Module resources",
    events: {},
    properties: {},
    methods: {}
};

// page
export default {
    template: `
        <h2>Resources</h2>

        <p>
            <code>/_assets</code> is the virtual asset base. Each effective module generation has its own runtime path:
            <code>/_assets/&lt;module-id&gt;/&lt;generation&gt;/&lt;resource&gt;</code>.
        </p>

        <ul>
            <li><code>/_assets/x/&lt;generation&gt;/components/x-button.js</code></li>
            <li><code>/_assets/x-demo/&lt;generation&gt;/pages/06-modules/index.js</code></li>
        </ul>

        <pre x-pre><code>client URL
    ↓
Service Worker mapping
    ↓
module assets.url
    ↓
physical resource</code></pre>

        <p>
            Bootstrap records that generation-qualified virtual prefix as <code>assets.path</code>. The Service Worker maps it to the module's
            physical <code>assets.url</code>; <code>configUrl</code> remains the separate module configuration document URL.
        </p>

        <p>
            Module resources may be backed by expanded directories or ZIP packages. Application code uses the effective
            <code>assets.path</code> rather than reconstructing a generation or depending on the physical storage layout.
        </p>

        <h3>Current x-demo resource mapping</h3>

        <x-datafields>
            <x-datafield label="configUrl"><code>{{ state.configUrl }}</code></x-datafield>
            <x-datafield label="assets.url"><code>{{ state.assetUrl }}</code></x-datafield>
            <x-datafield label="assets.path"><code>{{ state.assetPath }}</code></x-datafield>
        </x-datafields>
    `,

    state: {
        configUrl: "",
        assetUrl: "",
        assetPath: ""
    },

    controller({ state, config }) {
        return {
            load() {
                // inspect the physical mapping recorded by bootstrap
                const moduleConfig = config.modules["x-demo"] || {};
                state.configUrl = moduleConfig.configUrl || "";
                state.assetUrl = moduleConfig.assets.url || "";
                state.assetPath = moduleConfig.assets.path || "";
            }
        };
    }
};
