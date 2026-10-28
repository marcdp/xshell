export default {
    meta: {
        title: "Conditions",
        description: "The if and show directives control whether content exists or is visible."
    },

    template: `
        <p>The if and show directives control whether content exists or is visible.</p>
        <button x-on:click="toggle">Toggle</button>
        <p x-if="state.visible">Created only while visible.</p>
        <p x-show="state.visible">Hidden while false.</p>
        <pre x-pre><code>export default {
    template: &#96;&lt;button x-on:click="toggle"&gt;Toggle&lt;/button&gt;
               &lt;p x-if="state.visible"&gt;Created only while visible.&lt;/p&gt;
               &lt;p x-show="state.visible"&gt;Hidden while false.&lt;/p&gt;&#96;,
    state: { visible: true },
    controller({ state }) {
        return {
            toggle() {
                state.visible = !state.visible;
            }
        };
    }
};</code></pre>
        
    `,

    state: {
        visible: true
    },

    controller({ state }) {
        return {
            toggle() {
                state.visible = !state.visible;
            }
        };
    }
};
