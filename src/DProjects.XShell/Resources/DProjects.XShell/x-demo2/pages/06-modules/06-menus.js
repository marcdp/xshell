export default {
    meta: {
        title: "Menu Contributions",
        description: "Compare the Module menu source with the Area's effective navigation items."
    },

    template: `
        <p>The Module contributes <code>navigation: "/pages"</code>. Areas builds a menu from its file inventory and adds the cookbook prefix.</p>
        <p>Effective source: {{ state.source }}</p>
        <p>Area: {{ state.area }}</p>
        <ul><li x-for="item in state.items">{{ item.label }} → {{ item.path }} ({{ item.count }} children)</li></ul>
        <p>Numeric directory prefixes control category order. Numeric Page filenames similarly order children; the visible labels omit those prefixes.</p>
        <p>For example, the Modules category starts with:</p>
        <ol><li x-for="item in state.modulePages">{{ item.label }} → {{ item.path }}</li></ol>
    `,

    state: { source: "", area: "", items: [], modulePages: [] },

    controller({ areas, config, state }) {
        return {
            load() {
                const area = areas.getCurrentArea();
                const root = areas.getMenu("navigation", area?.id)[0];
                const categories = root?.children || [];
                state.source = config.modules["x-demo2"].menus.navigation;
                state.area = area?.id || "";
                state.items = categories.map(item => ({
                    label: item.label,
                    path: item.path,
                    count: item.children.length
                }));
                state.modulePages = (categories.find(item => item.path?.endsWith("/modules"))?.children || [])
                    .slice(0, 3).map(item => ({ label: item.label, path: item.path }));
            }
        };
    }
};
