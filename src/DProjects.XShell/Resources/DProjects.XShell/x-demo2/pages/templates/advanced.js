export default {
    template: `
        <h1>Advanced Templates</h1>
        <p>A nested expression can display a derived value without duplicating state.</p>
        <label>First <input x-model="state.first"></label>
        <label>Last <input x-model="state.last"></label>
        <p>{{ state.first + " " + state.last }}</p>
        
    `,
    state: { first: "Ada", last: "Lovelace" }
};
