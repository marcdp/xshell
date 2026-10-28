export default {
    meta: { title: "Events and Models", description: "Events call named controller commands; model bindings update assignable state." },
    template: `
        <p>Events call named controller commands; model bindings update assignable state.</p>
        <label>Message <input x-model="state.message"></label>
        <button x-on:click="clear">Clear</button>
        <p>{{ state.message }}</p>
        
    `,
    state: { message: "Hello" },
    controller({ state }) { return { clear() { state.message = ""; } }; }
};
