
export default {
    meta: {
        title: "Buttons",
        description: "Demonstrates button styles, icons, labels, commands, and reactive state."
    },

    template: `
        <p>The <code>x-button</code> component performs actions through controller commands. Use <code>x-anchor</code> for navigation.</p>

        <h2>Basic buttons</h2>
        <p>Buttons support several predefined appearance classes.</p>
        <div>
            <x-button label="Default"></x-button>
            <x-button class="submit" label="Submit"></x-button>
            <x-button class="cancel" label="Cancel"></x-button>
            <x-button class="light" label="Light"></x-button>
        </div>
        <pre x-pre><code>&lt;x-button label="Default"&gt;&lt;/x-button&gt;
&lt;x-button class="submit" label="Submit"&gt;&lt;/x-button&gt;
&lt;x-button class="cancel" label="Cancel"&gt;&lt;/x-button&gt;
&lt;x-button class="light" label="Light"&gt;&lt;/x-button&gt;</code></pre>

        <h2>Icons and labels</h2>
        <p>Use <code>icon</code> to display an icon and <code>message</code> for secondary text.</p>
        <div>
            <x-button icon="x-add" label="Add"></x-button>
            <x-button icon="x-file" label="File"></x-button>
            <x-button icon="x-info" label="Details" message="Additional information"></x-button>
        </div>
        <pre x-pre><code>&lt;x-button icon="x-add" label="Add"&gt;&lt;/x-button&gt;
&lt;x-button icon="x-info" label="Details" message="Additional information"&gt;&lt;/x-button&gt;</code></pre>

        <h2>Commands and reactive state</h2>
        <p>The <code>command</code> property invokes a method on the Page controller. Updating reactive state refreshes the displayed value.</p>
        <div>
            <x-button icon="x-add" label="Add" command="increment"></x-button>
            <x-button label="Subtract" command="decrement"></x-button>
            <x-button label="Reset" command="reset"></x-button>
        </div>
        <p>Count: <strong>{{ state.count }}</strong></p>
        <pre x-pre><code>export default {
    template: &#96;
        &lt;x-button label="Add" command="increment"&gt;&lt;/x-button&gt;
        &lt;p&gt;Count: {{ state.count }}&lt;/p&gt;
    &#96;,
    state: { count: 0 },
    controller({ state }) {
        return {
            increment() { state.count++; }
        };
    }
};</code></pre>

        <h2>Disabled buttons</h2>
        <p>A disabled button is displayed in an inactive state.</p>
        <div>
            <x-button label="Disabled" disabled></x-button>
            <x-button class="submit" label="Disabled submit" disabled></x-button>
        </div>
        <pre x-pre><code>&lt;x-button label="Disabled" disabled&gt;&lt;/x-button&gt;</code></pre>
    `,

    state: {
        count: 0
    },

    controller({ state }) {
        return {
            increment() { state.count++; },
            decrement() { state.count--; },
            reset() { state.count = 0; }
        };
    }
};
