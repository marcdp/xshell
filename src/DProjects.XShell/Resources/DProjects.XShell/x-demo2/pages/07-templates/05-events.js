
export default {
    meta: {
        title: "Events and Models",
        description: "Demonstrates event handlers, controller commands, two-way model bindings, and reactive inputs."
    },

    template: `
        <p>X Templates connect user interactions to Page controllers through <code>x-on:</code> and synchronize input values with reactive state through <code>x-model</code>.</p>

        <h2>Event handlers</h2>
        <p>Use <code>x-on:event</code> to invoke a named controller command when an element emits an event.</p>
        <p>
            <x-button label="Increment" x-on:click="increment"></x-button>
            <x-button label="Decrement" x-on:click="decrement"></x-button>
            <x-button label="Reset" x-on:click="reset"></x-button>
        </p>
        <p>Counter: <strong>{{ state.count }}</strong></p>
        <pre x-pre><code>&lt;x-button label="Increment" x-on:click="increment"&gt;&lt;/x-button&gt;

controller({state}) {
    return {
        increment() {
            state.count++;
        }
    };
}</code></pre>

        <h2>Commands on XShell components</h2>
        <p>Components such as <code>x-button</code> can invoke controller commands through their <code>command</code> property.</p>
        <p>
            <x-button label="Set greeting" command="setGreeting"></x-button>
            <x-button label="Clear greeting" command="clearGreeting"></x-button>
        </p>
        <p>Greeting: <strong>{{ state.greeting || "(empty)" }}</strong></p>
        <pre x-pre><code>&lt;x-button label="Clear greeting" command="clearGreeting"&gt;&lt;/x-button&gt;

controller({state}) {
    return {
        clearGreeting() {
            state.greeting = "";
        }
    };
}</code></pre>
        <p>Use <code>command</code> when a component exposes that API. Use <code>x-on:</code> for direct event handling.</p>

        <h2>Two-way model binding</h2>
        <p>The <code>x-model</code> directive connects an editable value to an assignable state property. Changes in either direction are reflected in the other.</p>
        <x-datafield type="text" label="Your name" x-model="state.name"></x-datafield>
        <p>Hello, <strong>{{ state.name || "stranger" }}</strong>!</p>
        <p><x-button label="Use Ada" command="useAda"></x-button></p>
        <pre x-pre><code>&lt;x-datafield type="text" label="Name" x-model="state.name"&gt;&lt;/x-datafield&gt;
&lt;p&gt;Hello, {{ state.name }}!&lt;/p&gt;</code></pre>

        <h2>Different input types</h2>
        <p>Model binding works with different datafield types, allowing form values to be managed through the same reactive state.</p>
        <x-datafields columns="2">
            <x-datafield type="text" label="Title" x-model="state.title"></x-datafield>
            <x-datafield type="number" label="Quantity" x-model="state.quantity"></x-datafield>
            <x-datafield type="checkbox" label="Enabled" x-model="state.enabled"></x-datafield>
            <x-datafield type="select" label="Priority" x-prop:domain="state.priorities" x-model="state.priority"></x-datafield>
        </x-datafields>
        <x-json x-prop:value="state.formValues"></x-json>
        <pre x-pre><code>&lt;x-datafield type="text" x-model="state.title"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="number" x-model="state.quantity"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="checkbox" x-model="state.enabled"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Event arguments</h2>
        <p>An <code>x-on:</code> handler receives an argument object containing the triggering event. The event can identify the element or provide additional data.</p>
        <p>
            <button data-action="save" x-on:click="showEvent">Save</button>
            <button data-action="cancel" x-on:click="showEvent">Cancel</button>
        </p>
        <p>Last action: <strong>{{ state.lastAction }}</strong></p>
        <pre x-pre><code>&lt;button data-action="save" x-on:click="showEvent"&gt;Save&lt;/button&gt;

controller({state}) {
    return {
        showEvent({event}) {
            state.lastAction = event.currentTarget.dataset.action;
        }
    };
}</code></pre>

        <h2>Complete Page example</h2>
        <p>Combine model bindings with controller commands to build a small interactive Page.</p>
        <pre x-pre><code>export default {
    template: &#96;
        &lt;input x-model="state.message"&gt;
        &lt;button x-on:click="clear"&gt;Clear&lt;/button&gt;
        &lt;p&gt;{{ state.message }}&lt;/p&gt;
    &#96;,
    state: {
        message: "Hello"
    },
    controller({state}) {
        return {
            clear() {
                state.message = "";
            }
        };
    }
};</code></pre>

        <h2>Next steps</h2>
        <p>Events handle user interactions, while model bindings keep form controls synchronized with state. Continue with <x-anchor href="06-styles.js">Styles</x-anchor> to explore dynamic presentation.</p>
    `,

    state: {
        count: 0,
        greeting: "Hello",
        name: "Ada",
        title: "Example item",
        quantity: 3,
        enabled: true,
        priority: "normal",
        priorities: [
            {value:"low", label:"Low"},
            {value:"normal", label:"Normal"},
            {value:"high", label:"High"}
        ],
        formValues: {},
        lastAction: "None"
    },

    controller({state, events}) {
        const refreshForm = () => {
            state.formValues = {
                title: state.title,
                quantity: state.quantity,
                enabled: state.enabled,
                priority: state.priority
            };
        };

        return {
            load() {
                events.on(state, ["change:title", "change:quantity", "change:enabled", "change:priority"], refreshForm);
                refreshForm();
            },
            increment() {state.count++;},
            decrement() {state.count--;},
            reset() {state.count = 0;},
            setGreeting() {state.greeting = "Hello from XShell!";},
            clearGreeting() {state.greeting = "";},
            useAda() {state.name = "Ada";},
            showEvent({event}) {state.lastAction = event.currentTarget.dataset.action;}
        };
    }
};
