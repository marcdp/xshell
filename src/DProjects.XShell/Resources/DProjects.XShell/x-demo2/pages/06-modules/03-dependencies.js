export default {
    meta: {
        title: "Declarative Dependencies",
        description: "Inspect resources loaded before this Page controller is constructed."
    },

    dependencies: {
        button: "component:x-button",
        fileIcon: "icon:x-file"
    },

    template: `
        <p>This Page declares two resources from the referenced <code>x</code> Module. The Page loader resolves and loads them before constructing this controller.</p>
        <pre x-pre><code>dependencies: {
    button: "component:x-button",
    fileIcon: "icon:x-file"
}</code></pre>
        <p>Loaded Component class: {{ state.button }}</p>
        <p>Loaded icon element: {{ state.icon }}</p>
        <p>The module reference lets bootstrap discover <code>x</code>. These resource dependencies use the normal Resolver → Loader pipeline. Neither mechanism creates another runtime Module instance.</p>
    `,

    state: { button: "", icon: "" },

    controller({ dependencies, state }) {
        return {
            load() {
                state.button = dependencies.button?.name || "Missing";
                state.icon = dependencies.fileIcon?.nodeName || "Missing";
            }
        };
    }
};
