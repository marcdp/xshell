export default {
    meta: {
        title: "Engine Selection",
        description: "Module defaults choose the state and render engines for definition-based Pages and Components."
    },

    template: `
        <p>Module defaults choose the state and render engines for definition-based Pages and Components.</p>
        <p>Page render engine: {{ state.render }}</p>
        <p>Page state engine: {{ state.reactive }}</p>
        <p>The state engine owns reactivity; the render engine owns output.</p>
        
    `,

    state: {
        render: "",
        reactive: ""
    },

    controller({ config, state }) {
        return {
            load() {
                const defaults = config.modules["x-demo2"].defaults.page;
                state.render = defaults.renderEngine;
                state.reactive = defaults.stateEngine;
            }
        };
    }
};
