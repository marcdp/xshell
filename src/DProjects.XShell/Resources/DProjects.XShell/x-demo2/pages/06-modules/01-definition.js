export default {
    meta: {
        title: "Module Definition",
        description: "Compare the local definition, resolved configuration, and live Module instance."
    },

    template: `
        <p><code>module.jsonc</code> owns one local definition: <code>modules.x-demo2</code>, the entry without <code>configUrl</code>.</p>
        <p>Bootstrap resolves references and normalizes that definition into effective configuration.</p>
        <ul>
            <li>Effective ID and label: {{ state.id }} — {{ state.label }}</li>
            <li>Definition document: {{ state.configUrl }}</li>
            <li>Virtual resource path: {{ state.assetsPath }}</li>
            <li>Inventory entries: {{ state.fileCount }}</li>
        </ul>
        <p>Modules creates one runtime instance for this ID: {{ state.instance }}</p>
        <p>That instance uses the effective configuration: {{ state.sameConfig }}</p>
        <p>External entries with <code>configUrl</code> are references to other definitions, not additional local definitions.</p>
        <p><x-anchor href="02-references.js">Inspect the referenced Modules</x-anchor></p>
    `,

    state: {
        id: "x-demo2",
        label: "",
        configUrl: "",
        assetsPath: "",
        fileCount: 0,
        instance: "",
        sameConfig: false
    },

    controller({ config, modules, state }) {
        return {
            load() {
                const resolved = config.modules["x-demo2"];
                const instance = modules.getModuleById("x-demo2");
                state.label = resolved.label;
                state.configUrl = resolved.configUrl;
                state.assetsPath = resolved.assets.path;
                state.fileCount = resolved.files.length;
                state.instance = instance?.id || "Missing";
                state.sameConfig = instance?.config === resolved;
            }
        };
    }
};
