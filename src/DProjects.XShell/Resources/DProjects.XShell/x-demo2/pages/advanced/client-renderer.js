export default {
    meta: { renderEngine: "x-client" },
    template: `
        <h1>Client Renderer</h1>
        <p>This Page selects the x-client render engine while retaining the same Page contract.</p>
        <label>Name <input x-model="state.name"></label>
        <p>Hello {{ state.name }}.</p>
        
    `,
    state: { name: "Ada" }
};
