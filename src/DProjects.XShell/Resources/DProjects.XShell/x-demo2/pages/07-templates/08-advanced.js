export default {
    meta: { title: "Advanced Templates", description: "A nested expression can display a derived value without duplicating state." },
    template: `
        <p>A nested expression can display a derived value without duplicating state.</p>
        <label>First <input x-model="state.first"></label>
        <label>Last <input x-model="state.last"></label>
        <p>{{ state.first + " " + state.last }}</p>
        
    `,
    state: { first: "Ada", last: "Lovelace" }
};
