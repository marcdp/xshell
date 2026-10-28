export default {
    meta: { title: "Conditions", description: "The if and show directives control whether content exists or is visible." },
    template: `
        <p>The if and show directives control whether content exists or is visible.</p>
        <button x-on:click="toggle">Toggle</button>
        <p x-if="state.visible">Created only while visible.</p>
        <p x-show="state.visible">Hidden while false.</p>
        
    `,
    state: { visible: true },
    controller({ state }) { return { toggle() { state.visible = !state.visible; } }; }
};
