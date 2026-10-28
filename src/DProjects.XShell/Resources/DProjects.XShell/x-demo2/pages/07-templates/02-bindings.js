
export default {
    meta: {
        title: "Attributes and Properties",
        description: "Demonstrates reactive attribute and property bindings in X Templates."
    },

    template: `
        <p>X Templates bind state values to HTML attributes and DOM properties. Use <code>x-attr:</code> for attributes and <code>x-prop:</code> for JavaScript properties.</p>

        <h2>Attribute bindings</h2>
        <p>Use <code>x-attr:name</code> to update an element's HTML attribute when state changes. Attribute values are represented as strings in the DOM.</p>
        <x-datafield type="text" label="Tooltip" x-model="state.tooltip"></x-datafield>
        <p x-attr:title="state.tooltip">Hover over this text to see the bound tooltip.</p>
        <pre x-pre><code>&lt;p x-attr:title="state.tooltip"&gt;Hover over this text.&lt;/p&gt;</code></pre>

        <h2>Reactive attributes</h2>
        <p>The attribute binding updates automatically when its source value changes.</p>
        <x-datafield type="text" label="Image description" x-model="state.description"></x-datafield>
        <p><x-icon icon="x-info" x-attr:title="state.description"></x-icon> Hover over the icon to inspect its title.</p>
        <pre x-pre><code>&lt;x-icon icon="x-info" x-attr:title="state.description"&gt;&lt;/x-icon&gt;</code></pre>

        <h2>Property bindings</h2>
        <p>Use <code>x-prop:name</code> when a component expects a JavaScript value rather than an HTML attribute string. Property bindings preserve objects, arrays, numbers, and other JavaScript types.</p>
        <x-json x-prop:value="state.record"></x-json>
        <pre x-pre><code>&lt;x-json x-prop:value="state.record"&gt;&lt;/x-json&gt;</code></pre>
        <p>The <code>x-json</code> component receives the actual object stored in <code>state.record</code>, not a serialized string.</p>

        <h2>Reactive property values</h2>
        <p>Change these fields to update the object passed to <code>x-json</code>.</p>
        <x-datafields columns="2">
            <x-datafield type="text" label="Name" x-model="state.name"></x-datafield>
            <x-datafield type="number" label="Count" x-model="state.count"></x-datafield>
        </x-datafields>
        <x-json x-prop:value="state.details"></x-json>
        <pre x-pre><code>&lt;x-json x-prop:value="state.details"&gt;&lt;/x-json&gt;</code></pre>
        <p>The Page updates the object in response to changes in the bound fields.</p>

        <h2>Attributes versus properties</h2>
        <x-datafields columns="2">
            <x-datafield label="x-attr:">Sets an HTML attribute</x-datafield>
            <x-datafield label="x-prop:">Sets a DOM or component property</x-datafield>
            <x-datafield label="Value representation">Attributes use string representations</x-datafield>
            <x-datafield label="JavaScript values">Properties preserve the original value type</x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;p x-attr:title="state.tooltip"&gt;Hover&lt;/p&gt;
&lt;x-json x-prop:value="state.record"&gt;&lt;/x-json&gt;</code></pre>

        <h2>Static versus reactive values</h2>
        <p>Static attributes are written directly in the template. Reactive attributes and properties use binding directives.</p>
        <pre x-pre><code>&lt;x-icon icon="x-info" title="Static tooltip"&gt;&lt;/x-icon&gt;
&lt;x-icon icon="x-info" x-attr:title="state.tooltip"&gt;&lt;/x-icon&gt;
&lt;x-json x-prop:value="state.record"&gt;&lt;/x-json&gt;</code></pre>

        <h2>When to use each binding</h2>
        <p>Use <code>x-attr:</code> for HTML attributes such as <code>title</code>, <code>href</code>, and <code>src</code>. Use <code>x-prop:</code> when passing structured data or other JavaScript values to components.</p>
        <p>For user input and event handling, continue with <x-anchor href="05-events.js">Events and Models</x-anchor>.</p>
    `,

    state: {
        tooltip: "This tooltip comes from reactive state.",
        description: "A reactive icon tooltip",
        record: {
            name: "XShell",
            version: 1,
            features: ["attributes", "properties"]
        },
        name: "Example",
        count: 3,
        details: {
            name: "Example",
            count: 3
        }
    },

    controller({state, events}) {
        const refresh = () => {
            state.details = {name:state.name, count:state.count};
        };

        return {
            load() {
                events.on(state, ["change:name", "change:count"], refresh);
                refresh();
            }
        };
    }
};
