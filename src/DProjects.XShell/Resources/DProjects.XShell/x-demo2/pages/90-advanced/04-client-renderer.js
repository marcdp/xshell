export default {
    meta: {
        title: "Client Renderer",
        description: "This Page selects the x-client render engine while retaining the same Page contract.",
        renderEngine: "x-client"
    },

    template: `
        <p>This Page selects the x-client render engine while retaining the same Page contract.</p>
        <label>Name <input x-model="state.name"></label>
        <p>Hello {{ state.name }}.</p>
        
    `,

    state: {
        name: "Ada"
    }
};
