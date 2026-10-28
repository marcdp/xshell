export default {
    meta: { title: "Module References", description: "The root descriptor references x and other modules by configUrl." },
    template: `
        <p>The root descriptor references x and other modules by configUrl.</p>
        <ul><li x-for="item in state.modules">{{ item.id }} — {{ item.label }}</li></ul>
        <p>Each module has one canonical definition and one runtime instance.</p>
        
    `,
    state: { modules: [] },
    controller({ state, config }) {
        return { load() { state.modules = ["x", "x-filesystem", "xshell-docs"].map(id => ({ id, label: config.modules[id]?.label || id })); } };
    }
};
