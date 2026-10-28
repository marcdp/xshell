export default {
    template: `
        <h1>Module Definition</h1>
        <p>This Page reads the single local module definition selected by bootstrap.</p>
        <p>Module ID: {{ state.id }}</p>
        <p>Label: {{ state.label }}</p>
        <p>Version: {{ state.version }}</p>
        
    `,
    state: { id: "", label: "", version: "" },
    controller({ state, config }) {
        return { load() { const module = config.modules["x-demo2"]; state.id = "x-demo2"; state.label = module.label; state.version = module.version; } };
    }
};
