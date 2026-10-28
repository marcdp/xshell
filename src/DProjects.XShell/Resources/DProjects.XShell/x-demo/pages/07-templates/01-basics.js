
export default {
    meta: {
        title: "Template Basics",
        description: "Introduces X Templates, text interpolation, reactive state, and two-way binding."
    },

    template: `
        <p>X Templates are XShell's declarative rendering syntax. They combine HTML with expressions and directives that connect the Page's template to its reactive state.</p>

        <h2>Text interpolation</h2>
        <p>Use double braces to render a JavaScript expression as text.</p>
        <p>Hello, <strong>{{ state.name }}</strong>!</p>
        <pre x-pre><code>&lt;p&gt;Hello, {{ state.name }}!&lt;/p&gt;</code></pre>
        <p>The expression reads the current value of <code>state.name</code>.</p>

        <h2>Reactive state</h2>
        <p>A Page declares its initial values in <code>state</code>. When a reactive value changes, bindings that depend on it update automatically.</p>
        <x-datafield type="text" label="Your name" x-model="state.name"></x-datafield>
        <p>Welcome, <strong>{{ state.name }}</strong>!</p>
        <pre x-pre><code>state: {
    name: "Ada"
}</code></pre>

        <h2>Two-way binding</h2>
        <p>The <code>x-model</code> directive connects an input to a state property. Editing the input updates state, and changes to state update the input.</p>
        <x-datafield type="text" label="Message" x-model="state.message"></x-datafield>
        <p>Current message: {{ state.message }}</p>
        <pre x-pre><code>&lt;x-datafield type="text" x-model="state.message"&gt;&lt;/x-datafield&gt;
&lt;p&gt;{{ state.message }}&lt;/p&gt;</code></pre>

        <h2>Expressions</h2>
        <p>Interpolation can evaluate simple JavaScript expressions, not just direct property references.</p>
        <x-datafields columns="2">
            <x-datafield label="Original name">{{ state.name }}</x-datafield>
            <x-datafield label="Uppercase">{{ state.name | upper }}</x-datafield>
            <x-datafield label="Name length">{{ state.name.length }}</x-datafield>
            <x-datafield label="Greeting">{{ "Hello, " + state.name + "!" }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>{{ state.name }}
{{ state.name | upper }}
{{ state.name.length }}
{{ "Hello, " + state.name + "!" }}</code></pre>
        <p>Keep template expressions short and use controller methods for more substantial application logic.</p>

        <h2>Complete Page example</h2>
        <p>A Page combines a template with reactive state. A controller is optional when no additional behavior is needed.</p>
        <pre x-pre><code>export default {
    template: &#96;
        &lt;x-datafield type="text" label="Name" x-model="state.name"&gt;&lt;/x-datafield&gt;
        &lt;p&gt;Hello, {{ state.name }}!&lt;/p&gt;
    &#96;,
    state: {
        name: "Ada"
    }
};</code></pre>

        <h2>Next steps</h2>
        <p>Text interpolation is only one form of binding. X Templates also support attributes, properties, conditions, loops, and event handling.</p>
        <p>Continue with <x-anchor href="02-bindings.js">Bindings</x-anchor> to explore additional ways to connect template elements to state.</p>
    `,

    state: {
        name: "Ada",
        message: "Hello from XShell"
    }
};
