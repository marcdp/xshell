export default {
    meta: {
        title: "Events and Models",
        description: "Events call named controller commands; model bindings update assignable state."
    },

    template: `
        <p>Events call named controller commands; model bindings update assignable state.</p>
        <label>Message <input x-model="state.message"></label>
        <button x-on:click="clear">Clear</button>
        <p>{{ state.message }}</p>
        <pre x-pre><code>export default {
    template: &#96;&lt;input x-model="state.message"&gt;
               &lt;button x-on:click="clear"&gt;Clear&lt;/button&gt;
               &lt;p&gt;{{ state.message }}&lt;/p&gt;&#96;,
    state: { message: "Hello" },
    controller({ state }) {
        return {
            clear() {
                state.message = "";
            }
        };
    }
};</code></pre>
        
    `,

    state: {
        message: "Hello"
    },

    controller({ state }) {
        return {
            clear() {
                state.message = "";
            }
        };
    }
};
