export default {
    meta: { title: "Loops", description: "The for directive renders one item per array entry." },
    template: `
        <p>The for directive renders one item per array entry.</p>
        <button x-on:click="add">Add item</button>
        <ul><li x-for="item in state.items" x-key="id">{{ item.label }}</li></ul>
        
    `,
    state: { items: [{ id: 1, label: "First" }, { id: 2, label: "Second" }] },
    controller({ state }) {
        return { add() { const id = state.items.length + 1; state.items = [...state.items, { id, label: "Item " + id }]; } };
    }
};
