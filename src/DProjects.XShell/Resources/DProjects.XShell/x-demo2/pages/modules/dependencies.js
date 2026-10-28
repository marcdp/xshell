export default {
    dependencies: { button: "component:x-button" },
    template: `
        <h1>Declarative Dependencies</h1>
        <p>The loader resolves dependencies before constructing this Page controller.</p>
        <p>Loaded button component: {{ state.loaded }}</p>
        <pre x-pre><code>dependencies: { button: "component:x-button" }</code></pre>
        
    `,
    state: { loaded: "" },
    controller({ dependencies, state }) {
        return { load() { state.loaded = dependencies.button?.name || typeof dependencies.button; } };
    }
};
