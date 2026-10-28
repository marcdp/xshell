export default {
    meta: {
        title: "Declarative Dependencies",
        description: "The loader resolves dependencies before constructing this Page controller."
    },

    dependencies: { button: "component:x-button" },
    template: `
        <p>The loader resolves dependencies before constructing this Page controller.</p>
        <p>Loaded button component: {{ state.loaded }}</p>
        <pre x-pre><code>export default {
    dependencies: { button: "component:x-button" },
    template: &#96;&lt;p&gt;Loaded button component: {{ state.loaded }}&lt;/p&gt;&#96;,
    state: { loaded: "" },
    controller({ dependencies, state }) {
        return {
            load() {
                state.loaded = dependencies.button?.name || typeof dependencies.button;
            }
        };
    }
};</code></pre>
        
    `,

    state: {
        loaded: ""
    },

    controller({ dependencies, state }) {
        return {
            load() {
                state.loaded = dependencies.button?.name || typeof dependencies.button;
            }
        };
    }
};
