export default {
    meta: {
        title: "Styles",
        description: "The style directive binds a style property to state."
    },

    template: `
        <p>The style directive binds a style property to state.</p>
        <button x-on:click="toggle">Toggle color</button>
        <p x-style:color="state.color">This text changes color.</p>
        
    `,

    state: {
        color: "royalblue"
    },

    controller({ state }) {
        return {
            toggle() {
                state.color = state.color === "royalblue" ? "tomato" : "royalblue";
            }
        };
    }
};
