export default {
    meta: {
        title: "Buttons",
        description: "Demonstrates the usage of buttons with labels, icons, and commands."
    },

    template: `
        <p>Buttons expose labels, icons, and controller commands.</p>
        <x-button label="Default"></x-button>
        <x-button class="submit" label="Submit"></x-button>
        <x-button icon="x-add" label="Add one" command="increment"></x-button>
        <p>Clicked: {{ state.count }}</p>
        <pre x-pre><code>export default {
    template: &#96;&lt;x-button label="Add one" command="increment"&gt;&lt;/x-button&gt;
               &lt;p&gt;Clicked: {{ state.count }}&lt;/p&gt;&#96;,
    state: {
        count: 0
    },
    controller({ state }) {
        return {
            increment() {
                state.count += 1;
            }
        };
    }
};</code></pre>
        
    `,

    state: {
        count: 0
    },

    controller({ state }) {
        return {
            increment() {
                state.count += 1;
            }
        };
    }
};
