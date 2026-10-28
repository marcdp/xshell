export default {
    meta: {
        title: "Component Contract",
        description: "Inspect and use a public property and method while private state changes."
    },

    dependencies: { counter: "component:x-demo2-counter" },

    template: `
        <p>The exported <code>contract</code> declares the counter's public <code>label</code> property, <code>reset</code> method, and <code>hint</code> slot. Its default export implements private <code>count</code> state and controller methods.</p>
        <x-demo2-counter label="Clicks"><small slot="hint">Click Add one to change private count.</small></x-demo2-counter>
        <x-button label="Change public label" command="changeLabel"></x-button>
        <x-button label="Reset through public method" command="resetCounter"></x-button>
        <p>Public label: {{ state.label }}</p>
        <p>Contract property: {{ state.property }}</p>
        <p>Public reset method: {{ state.reset }}</p>
        <p>Private increment method exposed on host: {{ state.increment }}</p>
        <p>The loader constructs the Web Component from the implementation and exposes only methods named by the contract.</p>
    `,

    state: { label: "", property: "", reset: "", increment: "" },

    controller({ page, state }) {
        const inspect = () => {
            const counter = page.host?.querySelector("x-demo2-counter");
            if (!counter?.constructor?.contract) return;
            state.label = counter.label;
            state.property = Object.keys(counter.constructor.contract.properties).join(", ");
            state.reset = typeof counter.reset;
            state.increment = typeof counter.increment;
        };
        return {
            mount() { inspect(); },
            changeLabel() {
                const counter = page.host.querySelector("x-demo2-counter");
                if (!counter?.constructor?.contract) return;
                counter.label = counter.label === "Clicks" ? "Updated label" : "Clicks";
                inspect();
            },
            resetCounter() {
                page.host.querySelector("x-demo2-counter")?.reset();
                inspect();
            }
        };
    }
};
