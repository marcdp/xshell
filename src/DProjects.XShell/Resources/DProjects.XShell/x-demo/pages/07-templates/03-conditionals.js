
export default {
    meta: {
        title: "Conditions",
        description: "Demonstrates conditional rendering, alternative branches, and element visibility."
    },

    template: `
        <p>X Templates support conditional directives to control which elements are rendered or displayed. Use <code>x-if</code> for conditional content, <code>x-elseif</code> and <code>x-else</code> for alternatives, and <code>x-show</code> to control visibility.</p>

        <h2>Conditional rendering</h2>
        <p>The <code>x-if</code> directive includes an element only while its expression is truthy.</p>
        <x-datafield type="checkbox" label="Show details" x-model="state.visible"></x-datafield>
        <p x-if="state.visible">These details are rendered because <code>state.visible</code> is true.</p>
        <pre x-pre><code>&lt;p x-if="state.visible"&gt;Visible when true&lt;/p&gt;</code></pre>

        <h2>Conditional visibility</h2>
        <p>The <code>x-show</code> directive keeps an element in the DOM and controls whether it is displayed.</p>
        <p x-show="state.visible">This element remains in the DOM even when hidden.</p>
        <pre x-pre><code>&lt;p x-show="state.visible"&gt;Hidden when false&lt;/p&gt;</code></pre>

        <h2>Rendering versus visibility</h2>
        <p>Both directives respond to reactive state, but they behave differently.</p>
        <x-datafields columns="2">
            <x-datafield label="x-if">Creates or removes content according to the condition.</x-datafield>
            <x-datafield label="x-show">Keeps the element in the DOM and changes its visibility.</x-datafield>
        </x-datafields>
        <p>Use <code>x-if</code> when content should exist only when needed. Use <code>x-show</code> when content should remain mounted while temporarily hidden.</p>

        <h2>Alternative branches</h2>
        <p>Use <code>x-elseif</code> and <code>x-else</code> to select one branch from several alternatives.</p>
        <x-datafield type="select" label="Status" x-prop:domain="state.statusOptions" x-model="state.status"></x-datafield>
        <x-notice x-if="state.status == 'success'" type="success" label="Success" message="The operation completed successfully."></x-notice>
        <x-notice x-elseif="state.status == 'warning'" type="warning" label="Warning" message="The operation requires attention."></x-notice>
        <x-notice x-elseif="state.status == 'error'" type="error" label="Error" message="The operation failed."></x-notice>
        <x-notice x-else type="info" label="Information" message="No operation has been completed."></x-notice>
        <pre x-pre><code>&lt;p x-if="state.status == 'success'"&gt;Success&lt;/p&gt;
&lt;p x-elseif="state.status == 'warning'"&gt;Warning&lt;/p&gt;
&lt;p x-elseif="state.status == 'error'"&gt;Error&lt;/p&gt;
&lt;p x-else&gt;No result&lt;/p&gt;</code></pre>
        <p>The first matching condition is rendered. The <code>x-else</code> branch handles all remaining cases.</p>

        <h2>Conditional expressions</h2>
        <p>Conditions can use JavaScript comparison and logical operators.</p>
        <x-datafield type="number" label="Quantity" x-model="state.quantity"></x-datafield>
        <p x-if="state.quantity <= 0">Out of stock.</p>
        <p x-elseif="state.quantity < 5">Low stock: {{ state.quantity }} remaining.</p>
        <p x-else>In stock: {{ state.quantity }} available.</p>
        <pre x-pre><code>&lt;p x-if="state.quantity &lt;= 0"&gt;Out of stock&lt;/p&gt;
&lt;p x-elseif="state.quantity &lt; 5"&gt;Low stock&lt;/p&gt;
&lt;p x-else&gt;In stock&lt;/p&gt;</code></pre>

        <h2>Complete example</h2>
        <p>A conditional Page can work entirely through reactive state and template directives without requiring a controller.</p>
        <pre x-pre><code>export default {
    template: &#96;
        &lt;x-datafield type="checkbox" x-model="state.visible"&gt;&lt;/x-datafield&gt;
        &lt;p x-if="state.visible"&gt;Visible content&lt;/p&gt;
        &lt;p x-else&gt;Hidden content&lt;/p&gt;
    &#96;,
    state: {
        visible: true
    }
};</code></pre>

        <h2>Next steps</h2>
        <p>Conditional directives control which content appears. To render repeated content from an array, continue with <x-anchor href="04-loops.js">Loops</x-anchor>.</p>
    `,

    state: {
        visible: true,
        status: "info",
        statusOptions: [
            {value:"info", label:"Information"},
            {value:"success", label:"Success"},
            {value:"warning", label:"Warning"},
            {value:"error", label:"Error"}
        ],
        quantity: 3
    }
};
