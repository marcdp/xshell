export default {
    meta: {
        title: "Module References",
        description: "Inspect references and their canonical resolved Modules."
    },

    template: `
        <p>The root <code>module.jsonc</code> references <code>x</code>, <code>x-filesystem</code>, and <code>xshell-docs</code> through <code>configUrl</code>.</p>
        <p>Bootstrap follows each reference to its local definition. The effective configuration and runtime instance below share each canonical ID.</p>
        <ul><li x-for="item in state.modules">{{ item.id }} — {{ item.label }}<br>Definition: {{ item.configUrl }}<br>Runtime instance: {{ item.instance }}</li></ul>
        <p>Only <code>x-demo2</code> participates in the cookbook Area. Referencing a Module does not add it to that Area's menu.</p>
        <p>Resource dependencies are separate: a Page or Component can declare an <code>icon:x-file</code> resource supplied by the referenced <code>x</code> Module.</p>
        <p><x-anchor href="03-dependencies.js">Load that dependency</x-anchor></p>
    `,

    state: { modules: [] },

    controller({ config, modules, state }) {
        return {
            load() {
                state.modules = ["x", "x-filesystem", "xshell-docs"].map(id => ({
                    id,
                    label: config.modules[id]?.label || id,
                    configUrl: config.modules[id]?.configUrl || "Missing definition",
                    instance: modules.getModuleById(id)?.id || "Missing"
                }));
            }
        };
    }
};
