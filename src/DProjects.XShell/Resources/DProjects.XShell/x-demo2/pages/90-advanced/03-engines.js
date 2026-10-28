export default {
    meta: {
        title: "Engine Selection",
        description: "Compare module defaults with effective Page engines and a resource override."
    },

    dependencies: {
        clientPage: "page:x-demo2:/pages/90-advanced/04-client-renderer.js"
    },

    template: `
        <p>Module defaults select engines for definition-based Pages and Components. A Page's <code>meta</code> may override either choice.</p>
        <p>Default Page render / state: {{ state.defaultRender }} / {{ state.defaultState }}</p>
        <p>This Page's effective render / state: {{ state.currentRender }} / {{ state.currentState }}</p>
        <p>Client Renderer Page's effective render / state: {{ state.clientRender }} / {{ state.clientState }}</p>
        <p>The Client Renderer Page overrides only the render engine. Its state engine still comes from the Module default.</p>
        <x-button label="Change reactive state" command="increase"></x-button>
        <p>State changes rendered here: {{ state.count }}</p>
        <p>The state engine manages reactivity; the render engine produces output. The loader selects and connects both.</p>
        <p><x-anchor href="04-client-renderer.js">Try the client-rendered Page</x-anchor></p>
    `,

    state: {
        defaultRender: "", defaultState: "", currentRender: "", currentState: "",
        clientRender: "", clientState: "", count: 0
    },

    controller({ config, dependencies, implementation, state }) {
        return {
            load() {
                const defaults = config.modules["x-demo2"].defaults.page;
                const client = dependencies.clientPage.implementation.meta;
                state.defaultRender = defaults.renderEngine;
                state.defaultState = defaults.stateEngine;
                state.currentRender = implementation.meta.renderEngine;
                state.currentState = implementation.meta.stateEngine;
                state.clientRender = client.renderEngine;
                state.clientState = client.stateEngine;
            },
            increase() { state.count += 1; }
        };
    }
};
