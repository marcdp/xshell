
export default {
    meta: {
        title: "Template Basics",
        description: "Introduces X Template interpolation, expressions, and basic state bindings."
    },

    template: `
        <p>X Templates are XShell's declarative rendering syntax. They combine HTML with expressions and directives that connect the Page's template to its reactive state.</p>

        <h2>Text interpolation and state binding</h2>
        <p>Use double braces to render a JavaScript expression as text.</p>
        <x-datafield type="text" label="Your name" x-model="state.name"></x-datafield>
        <p>Hello, <strong>{{ state.name }}</strong>!</p>
        <pre x-pre><code>&lt;x-datafield type="text" x-model="state.name"&gt;&lt;/x-datafield&gt;
&lt;p&gt;Hello, {{ state.name }}!&lt;/p&gt;</code></pre>
        <p>Interpolation reads <code>state.name</code>; <code>x-model</code> is a directive that writes user changes back to that assignable expression. For state ownership, controller mutations, and conditional Page behavior, see <x-anchor href="../02-pages/04-state.js">Page State</x-anchor>.</p>

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
        <p>A Page can combine template syntax with initial state. A controller is optional when no additional behavior is needed.</p>
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

        <h2>Technical reference</h2>
        <p>See the canonical <x-anchor x-attr:href="state.docsSyntax">X Template syntax guide</x-anchor> and <x-anchor x-attr:href="state.docsBindings">bindings guide</x-anchor> for the complete supported forms and constraints.</p>
    `,

    state: {
        name: "Ada",
        docsSyntax: "",
        docsBindings: ""
    },

    controller({config, state}) {
        return {
            load() {
                const docsPath = config.modules["xshell-docs"].assets.path +
                    "/pages/40-extensions/x-templates";
                state.docsSyntax = docsPath + "/20-syntax.md";
                state.docsBindings = docsPath + "/40-bindings.md";
            }
        };
    }
};
