export default {
    meta: { title: "Menu Contributions", description: "The cookbook module contributes an explicit navigation menu to its Area." },
    template: `
        <p>The cookbook module contributes an explicit navigation menu to its Area.</p>
        <ul><li x-for="item in state.items">{{ item.label }}</li></ul>
        
    `,
    state: { items: [] },
    controller({ areas, state }) {
        return { load() { state.items = areas.getMenu("navigation", "cookbook"); } };
    }
};
