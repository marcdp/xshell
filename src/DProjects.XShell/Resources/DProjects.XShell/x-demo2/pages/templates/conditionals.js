export default {
    template: `
        <h1>Conditions</h1>
        <p>The if and show directives control whether content exists or is visible.</p>
        <button x-on:click="toggle">Toggle</button>
        <p x-if="state.visible">Created only while visible.</p>
        <p x-show="state.visible">Hidden while false.</p>
        
    `,
    state: { visible: true },
    controller({ state }) { return { toggle() { state.visible = !state.visible; } }; }
};
