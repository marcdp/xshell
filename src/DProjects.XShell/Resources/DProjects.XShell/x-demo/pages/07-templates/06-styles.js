
export default {
    meta: {
        title: "Styles",
        description: "Demonstrates reactive CSS styles, dynamic classes, and Page-level styling."
    },

    style: `
        .demo-preview {
            padding: 1rem;
            border: 1px solid var(--x-color-border);
            border-radius: .5rem;
            margin: .5rem 0;
        }
        .demo-highlight {
            background: var(--x-color-primary);
            color: white;
            padding: .5rem;
            border-radius: .25rem;
        }
        .demo-muted {
            opacity: .6;
        }
    `,

    template: `
        <p>X Templates support reactive styling through the <code>x-style:</code> directive. A Page can also define scoped CSS in its <code>style</code> property.</p>

        <h2>Reactive styles</h2>
        <p>Use <code>x-style:property</code> to bind an individual CSS property to reactive state.</p>
        <x-datafield type="select" label="Text color" x-prop:domain="state.colors" x-model="state.color"></x-datafield>
        <p x-style:color="state.color">This text changes color when the selected value changes.</p>
        <pre x-pre><code>&lt;p x-style:color="state.color"&gt;Reactive color&lt;/p&gt;</code></pre>

        <h2>Multiple style properties</h2>
        <p>Bind several CSS properties independently to the same element.</p>
        <x-datafields columns="2">
            <x-datafield type="select" label="Background" x-prop:domain="state.backgrounds" x-model="state.background"></x-datafield>
            <x-datafield type="select" label="Text alignment" x-prop:domain="state.alignments" x-model="state.alignment"></x-datafield>
        </x-datafields>
        <div class="demo-preview" x-style:background-color="state.background" x-style:text-align="state.alignment">
            This preview uses two reactive style properties.
        </div>
        <pre x-pre><code>&lt;div x-style:background-color="state.background"
     x-style:text-align="state.alignment"&gt;
    Reactive preview
&lt;/div&gt;</code></pre>

        <h2>Dynamic CSS classes</h2>
        <p>Use an attribute binding to update an element's CSS class from state. This is useful when several visual properties should change together.</p>
        <x-datafield type="checkbox" label="Highlight text" x-model="state.highlighted"></x-datafield>
        <p x-attr:class="state.highlighted ? 'demo-highlight' : 'demo-muted'">
            This element changes between highlighted and muted styles.
        </p>
        <pre x-pre><code>&lt;p x-attr:class="state.highlighted ? 'demo-highlight' : 'demo-muted'"&gt;
    Styled content
&lt;/p&gt;</code></pre>

        <h2>Page-level styles</h2>
        <p>Define reusable CSS rules in a Page's <code>style</code> property instead of repeating inline styles throughout the template.</p>
        <div class="demo-preview">This container uses the Page's <code>.demo-preview</code> class.</div>
        <pre x-pre><code>export default {
    style: &#96;
        .demo-preview {
            padding: 1rem;
            border: 1px solid var(--x-color-border);
            border-radius: .5rem;
        }
    &#96;,
    template: &#96;
        &lt;div class="demo-preview"&gt;Styled content&lt;/div&gt;
    &#96;
};</code></pre>

        <h2>State-driven appearance</h2>
        <p>Styles can respond to application state without directly manipulating DOM elements.</p>
        <p>
            <x-button label="Enable" command="enable"></x-button>
            <x-button label="Disable" command="disable"></x-button>
        </p>
        <div class="demo-preview" x-style:opacity="state.enabled ? 1 : 0.4">
            Appearance: {{ state.enabled ? "Enabled" : "Disabled" }}
        </div>
        <pre x-pre><code>&lt;div x-style:opacity="state.enabled ? 1 : 0.4"&gt;
    {{ state.enabled ? "Enabled" : "Disabled" }}
&lt;/div&gt;</code></pre>

        <h2>When to use each approach</h2>
        <p>Use <code>x-style:</code> for individual CSS properties that depend on state. Use reusable CSS classes for visual variants, and the Page's <code>style</code> property for its own presentation rules.</p>
        <p>For formatted values in template expressions, continue with <x-anchor href="07-transformers.js">Transformers</x-anchor>.</p>
    `,

    state: {
        color: "royalblue",
        colors: [
            {value:"royalblue", label:"Blue"},
            {value:"tomato", label:"Red"},
            {value:"seagreen", label:"Green"},
            {value:"inherit", label:"Default"}
        ],
        background: "transparent",
        backgrounds: [
            {value:"transparent", label:"Transparent"},
            {value:"#e8f0fe", label:"Light blue"},
            {value:"#fff3cd", label:"Light yellow"},
            {value:"#e8f5e9", label:"Light green"}
        ],
        alignment: "left",
        alignments: [
            {value:"left", label:"Left"},
            {value:"center", label:"Center"},
            {value:"right", label:"Right"}
        ],
        highlighted: false,
        enabled: true
    },

    controller({state}) {
        return {
            enable() {state.enabled = true;},
            disable() {state.enabled = false;}
        };
    }
};
