
export default {
    meta: {
        title: "Loops",
        description: "Demonstrates list rendering, loop indexes, keyed items, and reactive array updates."
    },

    template: `
        <p>Use the <code>x-for</code> directive to render repeated content from arrays. XShell creates an element for each item and updates the rendered list when the source changes.</p>

        <h2>Basic loops</h2>
        <p>The expression <code>item in state.colors</code> iterates over an array and exposes each value through the local variable <code>item</code>.</p>
        <ul>
            <li x-for="item in state.colors">{{ item }}</li>
        </ul>
        <pre x-pre><code>&lt;ul&gt;
    &lt;li x-for="item in state.colors"&gt;{{ item }}&lt;/li&gt;
&lt;/ul&gt;</code></pre>

        <h2>Object properties</h2>
        <p>Array items can be objects. Access their properties using the loop variable.</p>
        <ul>
            <li x-for="item in state.products" x-key="id">
                <strong>{{ item.name }}</strong> — {{ item.category }}
            </li>
        </ul>
        <pre x-pre><code>&lt;li x-for="item in state.products" x-key="id"&gt;
    {{ item.name }} — {{ item.category }}
&lt;/li&gt;</code></pre>

        <h2>Loop indexes</h2>
        <p>Use <code>(item, index)</code> to access both the current item and its position in the collection.</p>
        <ol>
            <li x-for="(item, index) in state.colors">{{ index + 1 }}. {{ item }}</li>
        </ol>
        <pre x-pre><code>&lt;li x-for="(item, index) in state.colors"&gt;
    {{ index + 1 }}. {{ item }}
&lt;/li&gt;</code></pre>

        <h2>Reactive arrays</h2>
        <p>Change the array to see the rendered list update automatically. This example adds new items, removes the last item, and reverses the list.</p>
        <p>
            <x-button label="Add item" command="add"></x-button>
            <x-button label="Remove last" command="removeLast"></x-button>
            <x-button label="Reverse order" command="reverse"></x-button>
            <x-button label="Reset" command="reset"></x-button>
        </p>
        <ul>
            <li x-for="item in state.items" x-key="id">{{ item.label }} (ID: {{ item.id }})</li>
        </ul>
        <p x-if="state.items.length == 0">The list is empty.</p>
        <pre x-pre><code>&lt;ul&gt;
    &lt;li x-for="item in state.items" x-key="id"&gt;{{ item.label }}&lt;/li&gt;
&lt;/ul&gt;</code></pre>

        <h2>Stable keys</h2>
        <p>Use <code>x-key</code> to identify each item by a stable property, such as its ID. Stable keys help the renderer associate repeated elements with their corresponding data when items are reordered.</p>
        <pre x-pre><code>&lt;li x-for="item in state.items" x-key="id"&gt;
    {{ item.label }}
&lt;/li&gt;</code></pre>
        <p>Prefer a stable item identifier over its current array position when the list can change order.</p>

        <h2>Updating collections</h2>
        <p>Assigning a new array makes changes explicit and triggers reactive updates.</p>
        <pre x-pre><code>// Add an item.
state.items = [...state.items, {id:3, label:"Third"}];

// Remove an item.
state.items = state.items.filter(item => item.id !== 3);

// Reverse the order.
state.items = [...state.items].reverse();</code></pre>

        <h2>Complete Page example</h2>
        <p>A Page can combine a reactive array with controller commands to manage repeated content.</p>
        <pre x-pre><code>export default {
    template: &#96;
        &lt;x-button label="Add" command="add"&gt;&lt;/x-button&gt;
        &lt;ul&gt;
            &lt;li x-for="item in state.items" x-key="id"&gt;{{ item.label }}&lt;/li&gt;
        &lt;/ul&gt;
    &#96;,
    state: {
        items: [{id:1, label:"First"}],
        nextId: 2
    },
    controller({state}) {
        return {
            add() {
                const id = state.nextId++;
                state.items = [...state.items, {id, label:"Item " + id}];
            }
        };
    }
};</code></pre>

        <h2>Next steps</h2>
        <p>Loops render collections, while event directives let users interact with repeated content. Continue with <x-anchor href="05-events.js">Events and Models</x-anchor>.</p>
    `,

    state: {
        colors: ["Red", "Green", "Blue"],
        products: [
            {id:1, name:"Notebook", category:"Stationery"},
            {id:2, name:"Keyboard", category:"Electronics"},
            {id:3, name:"Monitor", category:"Electronics"}
        ],
        items: [
            {id:1, label:"First"},
            {id:2, label:"Second"}
        ],
        nextId: 3
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
            reverse() {
                state.items = [...state.items].reverse();
            },
            reset() {
                state.items = [{id:1, label:"First"}, {id:2, label:"Second"}];
                state.nextId = 3;
            }
        };
    }
};
