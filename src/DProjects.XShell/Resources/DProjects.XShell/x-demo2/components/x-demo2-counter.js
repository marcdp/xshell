export const contract = {
    description: "A small counter with a public label and reset method.",
    properties: {
        label: { type: "string", default: "Counter", attribute: true, state: true, description: "Visible label." }
    },
    methods: { reset: { description: "Set the private count back to zero." } },
    slots: { "hint": { description: "Optional help text." } }
};

export default {
    template: `
        <p>{{ state.label }}: {{ state.count }}</p>
        <button x-on:click="increment">Add one</button>
        <slot name="hint"></slot>
    `,
    state: { count: 0 },
    controller({ state }) {
        return {
            increment() { state.count += 1; },
            reset() { state.count = 0; }
        };
    }
};
