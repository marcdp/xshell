
export default {
    meta: {
        title: "Client Renderer",
        description: "Demonstrates client-side X Template compilation using the x-client render engine.",
        renderEngine: "x-client"
    },

    template: `
        <p>The <code>x-client</code> render engine compiles X Templates in the browser instead of relying on server-compiled template code. It uses the same X Template syntax and Page contract as the default <code>x</code> engine.</p>

        <h2>Selecting the renderer</h2>
        <p>Set <code>meta.renderEngine</code> to <code>x-client</code> to select the client-side renderer for an individual Page.</p>
        <pre x-pre><code>export default {
    meta: {
        title: "Client Renderer",
        renderEngine: "x-client"
    },
    template: &#96;
        &lt;p&gt;Hello {{ state.name }}!&lt;/p&gt;
    &#96;,
    state: {
        name: "Ada"
    }
};</code></pre>
        <p>The state engine is not overridden, so this Page inherits <code>proxy</code> from the <code>x-demo2</code> Module defaults.</p>

        <h2>Reactive text binding</h2>
        <p>Client-compiled templates use the same interpolation and model-binding syntax as other X Templates.</p>
        <x-datafield type="text" label="Your name" x-model="state.name"></x-datafield>
        <p>Hello, <strong>{{ state.name }}</strong>!</p>
        <pre x-pre><code>&lt;x-datafield type="text" label="Name" x-model="state.name"&gt;&lt;/x-datafield&gt;
&lt;p&gt;Hello {{ state.name }}!&lt;/p&gt;</code></pre>

        <h2>Conditional rendering</h2>
        <p>The client renderer supports structural directives such as <code>x-if</code>, <code>x-elseif</code>, and <code>x-else</code>.</p>
        <x-datafield type="checkbox" label="Show details" x-model="state.showDetails"></x-datafield>
        <p x-if="state.showDetails">These details are rendered when the checkbox is selected.</p>
        <p x-else>Details are currently hidden.</p>
        <pre x-pre><code>&lt;p x-if="state.showDetails"&gt;Visible details&lt;/p&gt;
&lt;p x-else&gt;Details are hidden&lt;/p&gt;</code></pre>

        <h2>Loops</h2>
        <p>Use <code>x-for</code> and <code>x-key</code> to render collections with stable item identities.</p>
        <p>
            <x-button label="Add item" command="add"></x-button>
            <x-button label="Remove last" command="removeLast"></x-button>
        </p>
        <ul>
            <li x-for="item in state.items" x-key="id">{{ item.label }}</li>
        </ul>
        <p x-if="state.items.length == 0">No items available.</p>
        <pre x-pre><code>&lt;li x-for="item in state.items" x-key="id"&gt;
    {{ item.label }}
&lt;/li&gt;</code></pre>

        <h2>Controller commands</h2>
        <p>The Page controller works the same way regardless of the selected render engine. Commands update reactive state, and the renderer updates the displayed content.</p>
        <p>
            <x-button label="Increment" command="increment"></x-button>
            <x-button label="Reset" command="reset"></x-button>
        </p>
        <p>Counter: <strong>{{ state.count }}</strong></p>
        <pre x-pre><code>controller({state}) {
    return {
        increment() {
            state.count++;
        },
        reset() {
            state.count = 0;
        }
    };
}</code></pre>

        <h2>Client versus default renderer</h2>
        <x-datafields columns="2">
            <x-datafield label="x">Uses server-compiled X Template render code.</x-datafield>
            <x-datafield label="x-client">Parses and compiles X Templates in the browser.</x-datafield>
            <x-datafield label="Template syntax">Both use X Template expressions and directives.</x-datafield>
            <x-datafield label="Page contract">Both use the same state, controller, dependencies, and lifecycle model.</x-datafield>
        </x-datafields>
        <p>The main distinction is where template compilation occurs. The renderer choice does not require changing the Page's controller or reactive state model.</p>

        <h2>When to use x-client</h2>
        <p>The default <code>x</code> engine uses render code produced during server-side compilation. The <code>x-client</code> engine is useful when a template needs to be parsed and compiled in the browser.</p>
        <p>Keep the default engine unless there is a reason to compile a particular template on the client.</p>
        <p>For engine configuration and selection rules, return to <x-anchor href="03-engines.js">Engines</x-anchor>.</p>
    `,

    state: {
        name: "Ada",
        showDetails: true,
        items: [
            {id:1, label:"First"},
            {id:2, label:"Second"}
        ],
        nextId: 3,
        count: 0
    },

    controller({state}) {
        return {
            add() {
                const id = state.nextId++;
                state.items = [...state.items, {id, label:"Item " + id}];
            },

            removeLast() {
                state.items = state.items.slice(0, -1);
            },

            increment() {
                state.count++;
            },

            reset() {
                state.count = 0;
            }
        };
    }
};
