export default {
    meta: {
        title: "Areas and Menus",
        description: "Inspect the current navigation context and its composed module menu."
    },

    template: `
        <p>An Area groups participating Modules into a navigation context. It does not create more Module instances.</p>
        <p>Current Area: <strong>{{ state.label }}</strong> ({{ state.id }})</p>
        <p>Navigation prefix: {{ state.prefix }}</p>
        <p>Participating Modules: {{ state.modules }}</p>
        <p>x-demo2 menu source in effective configuration: {{ state.source }}</p>
        <p>The authored source is <code>"/pages"</code>. Areas uses the module file inventory to compose this effective menu:</p>
        <ul><li x-for="item in state.items">{{ item.label }} — {{ item.path }} ({{ item.children }} child Pages)</li></ul>
        <p>Page navigation uses the active Area's paths. The menu remains navigation data; Page loading uses the canonical resource href.</p>
        <p><x-anchor href="05-resolution.js">Inspect path resolution for this Page</x-anchor></p>
    `,

    state: {
        id: "",
        label: "",
        prefix: "",
        modules: "",
        source: "",
        items: []
    },

    controller({ areas, config, state }) {
        return {
            load() {
                const area = areas.getCurrentArea();
                state.id = area?.id || "";
                state.label = area?.label || "";
                state.prefix = area?.prefix || "/";
                state.modules = area?.modules.join(", ") || "";
                state.source = config.modules["x-demo2"].menus.navigation;
                state.items = (areas.getMenu("navigation", area?.id)[0]?.children || []).map(item => ({
                    label: item.label,
                    path: item.path,
                    children: item.children.length
                }));
            }
        };
    }
};
